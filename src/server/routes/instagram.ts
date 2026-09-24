/**
 * Instagram Publishing, Scheduling & Token Management Routes
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/prisma.js';
import { instagramPublishQueue } from '../queues/index.js';
import { config } from '../config.js';
import { exchangeInstagramToken } from '../services/instagram-token.service.js';

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

export async function instagramRoutes(fastify: FastifyInstance) {
  /**
   * Listar publicações do Instagram
   */
  fastify.get('/api/instagram/posts', async () => {
    const posts = await db.getPosts();
    return {
      total: posts.length,
      posts,
    };
  });

  /**
   * Status e informações das credenciais do Instagram
   */
  fastify.get('/api/instagram/token-status', async () => {
    const activeToken =
      process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN ||
      process.env.INSTAGRAM_ACCESS_TOKEN ||
      process.env.META_SYSTEM_USER_TOKEN ||
      '';

    const credential = await db.getLatestCredential('INSTAGRAM');

    let isShortLivedCandidate = false;
    let preview = 'Nenhum token configurado';

    if (activeToken) {
      preview = `${activeToken.slice(0, 10)}...${activeToken.slice(-6)}`;
      isShortLivedCandidate = activeToken.startsWith('IGAA') && !credential?.expiresAt;
    }

    return {
      configured: Boolean(activeToken),
      tokenPreview: preview,
      isShortLivedCandidate,
      expiresAt: credential?.expiresAt || null,
      lastCheckedAt: credential?.lastCheckedAt || null,
      channel: 'INSTAGRAM',
      tokenType: credential?.tokenType || (activeToken.startsWith('IGAA') ? 'USER_ACCESS' : 'SYSTEM_USER'),
    };
  });

  /**
   * Rota de Admin: Troca automática de token de curta duração por Long-Lived Token (60 dias)
   * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token
   */
  fastify.post('/api/instagram/exchange-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = exchangeTokenSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Parâmetros inválidos',
        details: parseResult.error.format(),
      });
    }

    const { shortLivedToken, persistToEnv } = parseResult.data;
    // Usa clientSecret passado no body ou o configurado nas variáveis de ambiente
    const clientSecret =
      parseResult.data.clientSecret ||
      process.env.INSTAGRAM_APP_SECRET ||
      process.env.META_APP_SECRET ||
      config.INSTAGRAM_APP_SECRET ||
      config.META_APP_SECRET;

    if (!clientSecret || !clientSecret.trim()) {
      return reply.code(400).send({
        error: 'Chave secreta ausente',
        message: 'Forneça o clientSecret no corpo da requisição ou configure INSTAGRAM_APP_SECRET/META_APP_SECRET no .env do servidor.',
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
  });

  /**
   * Agendar ou publicar imediatamente
   */
  fastify.post('/api/instagram/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = postSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const { mediaType, caption, mediaUrl, scheduledFor } = parseResult.data;

    // Cria registro no banco de dados
    const post = await db.addPost({
      igUserId: config.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      mediaType,
      caption,
      mediaUrl,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      status: scheduledFor ? 'SCHEDULED' : 'PROCESSING_CONTAINER',
    });

    // Calcula delay caso haja agendamento futuro
    let delay = 0;
    if (scheduledFor) {
      const scheduledTime = new Date(scheduledFor).getTime();
      const now = Date.now();
      delay = Math.max(0, scheduledTime - now);
    }

    // Enfileira na fila BullMQ instagram-publisher
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
        ? `Post agendado para ${scheduledFor} e enfileirado na BullMQ`
        : 'Processo de publicação em 2 fases iniciado na Meta Graph API',
      post,
      jobId: job.id,
    });
  });
}
