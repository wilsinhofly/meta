/**
 * Instagram Publishing, Scheduling & Token Management Routes
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, InstagramPostData } from '../db/prisma.js';
import { instagramPublishQueue, instagramTokenRefreshQueue } from '../queues/index.js';
import { config } from '../config.js';
import { exchangeInstagramToken } from '../services/instagram-token.service.js';
import { processTokenRefresh } from '../workers/token-refresh.worker.js';

const postSchema = z.object({
  mediaType: z.enum(['IMAGE', 'REELS', 'STORIES']),
  caption: z.string().min(1),
  mediaUrl: z.string().url(),
  scheduledFor: z.string().datetime().optional(),
});

const exchangeTokenSchema = z.object({
  shortLivedToken: z.string().min(1, 'Token de curta duração é obrigatório'),
  clientSecret: z.string().optional(),
  persistToEnv: z.boolean().optional().default(true),
});

/**
 * Função reutilizável para extrair HH:mm no formato 24h
 */
export function extractTimeSlot(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Função reutilizável para consultar se um determinado horário (HH:mm)
 * já está em uso por QUALQUER post com status SCHEDULED ou DRAFT.
 * Retorna { available: boolean, conflictingPost?: InstagramPostData, timeSlot: string }
 */
export async function isTimeSlotAvailable(
  proposedDateTime: Date | string,
  excludePostId?: string
): Promise<{ available: boolean; conflictingPost?: InstagramPostData; timeSlot: string }> {
  const targetDate = typeof proposedDateTime === 'string' ? new Date(proposedDateTime) : proposedDateTime;
  const targetTimeSlot = extractTimeSlot(targetDate);
  const allPosts = await db.getPosts();

  const conflictingPost = allPosts.find((p) => {
    if (excludePostId && p.id === excludePostId) return false;
    // Checa posts agendados ou rascunhos com data agendada definida
    if (!['SCHEDULED', 'DRAFT'].includes(p.status) || !p.scheduledFor) {
      return false;
    }
    const pTimeSlot = extractTimeSlot(p.scheduledFor);
    return pTimeSlot === targetTimeSlot;
  });

  return {
    available: !conflictingPost,
    conflictingPost,
    timeSlot: targetTimeSlot,
  };
}

/**
 * Middleware para proteger endpoints administrativos de credenciais
 * Exige cabeçalho 'x-admin-key' idêntico ao ADMIN_API_KEY
 */
function requireAdminAuth(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  const adminKeyHeader = request.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY || config.ADMIN_API_KEY;

  if (!adminKeyHeader || adminKeyHeader !== expectedKey) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Acesso negado: header "x-admin-key" ausente ou inválido.',
    });
    return;
  }
  done();
}

export async function instagramRoutes(fastify: FastifyInstance) {
  /**
   * Listar publicações do Instagram (público do app)
   */
  fastify.get('/api/instagram/posts', async () => {
    const posts = await db.getPosts();
    return {
      total: posts.length,
      posts,
    };
  });

  /**
   * Rota dedicada: Retorna apenas a lista de horários ocupados (HH:mm)
   * por posts agendados ou rascunhos (SCHEDULED ou DRAFT com scheduledFor)
   */
  fastify.get('/api/instagram/scheduled-times', async () => {
    const posts = await db.getPosts();
    const busySlots: { timeSlot: string; scheduledFor: string; postId: string; status: string }[] = [];
    const uniqueTimes = new Set<string>();

    for (const post of posts) {
      if (['SCHEDULED', 'DRAFT'].includes(post.status) && post.scheduledFor) {
        const timeSlot = extractTimeSlot(post.scheduledFor);
        busySlots.push({
          timeSlot,
          scheduledFor: new Date(post.scheduledFor).toISOString(),
          postId: post.id,
          status: post.status,
        });
        uniqueTimes.add(timeSlot);
      }
    }

    return {
      totalBusySlots: busySlots.length,
      busyTimes: Array.from(uniqueTimes).sort(),
      details: busySlots,
    };
  });

  /**
   * Status e informações das credenciais do Instagram (PROTEGIDO POR x-admin-key)
   */
  fastify.get(
    '/api/instagram/token-status',
    { preHandler: requireAdminAuth },
    async () => {
      const activeToken =
        process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN ||
        process.env.INSTAGRAM_ACCESS_TOKEN ||
        process.env.META_SYSTEM_USER_TOKEN ||
        '';

      const credential = await db.getLatestCredential('INSTAGRAM');

      let isShortLivedCandidate = false;
      let preview = 'Nenhum token configurado';
      let daysRemaining: number | null = null;

      if (activeToken) {
        preview = `${activeToken.slice(0, 10)}...${activeToken.slice(-6)}`;
        isShortLivedCandidate = activeToken.startsWith('IGAA') && !credential?.expiresAt;
      }

      if (credential?.expiresAt) {
        const diffMs = new Date(credential.expiresAt).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
      }

      return {
        configured: Boolean(activeToken),
        tokenPreview: preview,
        isShortLivedCandidate,
        expiresAt: credential?.expiresAt || null,
        daysRemaining,
        lastCheckedAt: credential?.lastCheckedAt || null,
        channel: 'INSTAGRAM',
        tokenType: credential?.tokenType || (activeToken.startsWith('IGAA') ? 'USER_ACCESS' : 'SYSTEM_USER'),
      };
    }
  );

  /**
   * Rota de Admin: Troca de token de curta duração por Long-Lived Token (60 dias) (PROTEGIDO POR x-admin-key)
   * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token
   */
  fastify.post(
    '/api/instagram/exchange-token',
    { preHandler: requireAdminAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = exchangeTokenSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: 'Parâmetros inválidos',
          details: parseResult.error.format(),
        });
      }

      const { shortLivedToken, persistToEnv } = parseResult.data;
      const clientSecret =
        parseResult.data.clientSecret ||
        process.env.INSTAGRAM_APP_SECRET ||
        process.env.META_APP_SECRET ||
        config.INSTAGRAM_APP_SECRET ||
        config.META_APP_SECRET;

      if (!clientSecret || !clientSecret.trim()) {
        return reply.code(400).send({
          error: 'Chave secreta ausente',
          message:
            'Forneça o clientSecret no corpo da requisição ou configure INSTAGRAM_APP_SECRET no .env do servidor.',
        });
      }

      try {
        const result = await exchangeInstagramToken({
          shortLivedToken,
          clientSecret,
          persistToEnv,
        });

        return reply.code(200).send({
          success: true,
          message: 'Token de longa duração (60 dias) gerado e persistido com sucesso!',
          data: {
            tokenType: result.tokenType,
            expiresInDays: Math.round(result.expiresIn / 86400),
            expiresAt: result.expiresAt,
            accountInfo: result.accountInfo,
            tokenPreview: `${result.accessToken.slice(0, 10)}...${result.accessToken.slice(-6)}`,
          },
        });
      } catch (err: any) {
        console.error('[API Exchange Token] Falha ao trocar token:', err.message);
        return reply.code(500).send({
          success: false,
          error: err.message,
        });
      }
    }
  );

  /**
   * Rota de Admin: Forçar disparo imediato do Token Refresh (PROTEGIDO POR x-admin-key)
   */
  fastify.post(
    '/api/instagram/refresh-token-now',
    { preHandler: requireAdminAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await processTokenRefresh();
        return reply.code(200).send({
          success: true,
          ...result,
        });
      } catch (err: any) {
        return reply.code(500).send({
          success: false,
          error: err.message,
        });
      }
    }
  );

  /**
   * Agendar ou publicar imediatamente
   */
  fastify.post('/api/instagram/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = postSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const { mediaType, caption, mediaUrl, scheduledFor } = parseResult.data;

    // Regra anti-repetição de horário exato (mesmo HH:mm de outro post agendado)
    if (scheduledFor) {
      const targetDate = new Date(scheduledFor);
      if (isNaN(targetDate.getTime())) {
        return reply.code(400).send({ error: 'Data de agendamento inválida.' });
      }

      if (targetDate.getTime() <= Date.now()) {
        return reply.code(400).send({
          error: 'A data/horário de agendamento deve ser futura (pelo menos alguns minutos à frente).',
        });
      }

      // Validação centralizada e reutilizável
      const check = await isTimeSlotAvailable(targetDate);
      if (!check.available && check.conflictingPost) {
        const conflictDateFormatted = check.conflictingPost.scheduledFor
          ? new Date(check.conflictingPost.scheduledFor).toLocaleString('pt-BR')
          : 'data futura';
        return reply.code(409).send({
          error: `Já existe um post agendado para o horário ${check.timeSlot}. Escolha outro horário.`,
          message: `Já existe um post agendado para o horário ${check.timeSlot}. Escolha outro horário. (Conflito com post agendado para ${conflictDateFormatted})`,
          conflictingTime: check.timeSlot,
          conflictingPostId: check.conflictingPost.id,
        });
      }
    }

    const post = await db.addPost({
      igUserId: config.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      mediaType,
      caption,
      mediaUrl,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      status: scheduledFor ? 'SCHEDULED' : 'PROCESSING_CONTAINER',
    });

    let delay = 0;
    if (scheduledFor) {
      const scheduledTime = new Date(scheduledFor).getTime();
      const now = Date.now();
      delay = Math.max(0, scheduledTime - now);
    }

    const job = await instagramPublishQueue.add(
      `publish-${post.id}`,
      {
        postId: post.id,
        mediaType: post.mediaType,
        mediaUrl: post.mediaUrl,
        caption: post.caption,
      },
      { delay }
    );

    return reply.code(201).send({
      message: scheduledFor
        ? `Post agendado para ${new Date(scheduledFor).toLocaleString('pt-BR')} e enfileirado na BullMQ`
        : 'Processo de publicação em 2 fases iniciado na Meta Graph API',
      post,
      jobId: job.id,
    });
  });
}
