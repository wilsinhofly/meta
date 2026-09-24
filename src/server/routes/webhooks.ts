/**
 * Meta Webhooks Route (WhatsApp & Instagram)
 * Endpoint de altíssima performance:
 * - Valida assinatura X-Hub-Signature-256
 * - Enfileira evento na BullMQ em menos de 50ms
 * - Responde imediatamente HTTP 200 para evitar timeout na Meta
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { config } from '../config.js';
import { whatsappQueue } from '../queues/index.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  /**
   * 1. Handshake de Verificação da Meta (GET)
   * A Meta chama este endpoint ao configurar o webhook no App Dashboard
   */
  fastify.get('/webhooks/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === config.META_WEBHOOK_VERIFY_TOKEN) {
      fastify.log.info('Meta Webhook verificado com sucesso.');
      return reply.code(200).send(challenge);
    }

    fastify.log.warn({ query }, 'Tentativa de verificação do Webhook falhou');
    return reply.code(403).send('Verification token mismatch');
  });

  /**
   * 2. Recepção de Eventos em Tempo Real (POST)
   * Recebe mensagens do WhatsApp, status de entrega e interações
   */
  fastify.post('/webhooks/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = JSON.stringify(request.body);

    // Validação de assinatura HMAC-SHA256 se app_secret estiver presente e em produção
    if (config.NODE_ENV === 'production' && config.META_APP_SECRET && signature) {
      const hmac = crypto.createHmac('sha256', config.META_APP_SECRET);
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
      if (signature !== digest) {
        return reply.code(401).send({ error: 'Assinatura inválida' });
      }
    }

    const body = request.body as any;

    // Processamento de mensagens do WhatsApp Cloud API
    if (body?.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];
          const contacts = value.contacts || [];

          for (const msg of messages) {
            const senderPhone = msg.from;
            const contactName = contacts.find((c: any) => c.wa_id === senderPhone)?.profile?.name;
            const messageId = msg.id;

            // Extrai o tipo e conteúdo da mensagem
            let msgType: 'text' | 'button' | 'interactive' = 'text';
            let text = '';
            let buttonId: string | undefined;
            let productRetailerId: string | undefined;

            if (msg.type === 'text') {
              msgType = 'text';
              text = msg.text?.body || '';
            } else if (msg.type === 'interactive') {
              msgType = 'interactive';
              if (msg.interactive?.type === 'button_reply') {
                buttonId = msg.interactive.button_reply.id;
                text = msg.interactive.button_reply.title;
              } else if (msg.interactive?.type === 'list_reply') {
                buttonId = msg.interactive.list_reply.id;
                text = msg.interactive.list_reply.title;
              }
            } else if (msg.type === 'button') {
              msgType = 'button';
              buttonId = msg.button?.payload;
              text = msg.button?.text;
            }

            // ENFILEIRA NA BULLMQ E NÃO ESPERA O PROCESSAMENTO (Desacoplado)
            await whatsappQueue.add('inbound-message', {
              waId: senderPhone,
              name: contactName,
              wamid: messageId,
              timestamp: Number(msg.timestamp || Math.floor(Date.now() / 1000)),
              type: msgType,
              text,
              buttonId,
              productRetailerId,
            });
          }
        }
      }
    }

    // Resposta imediata HTTP 200 (Requisito estrito da Meta para não bloquear a fila)
    return reply.code(200).send({ status: 'EVENT_RECEIVED' });
  });

  /**
   * 3. Status das Credenciais da Meta (Diagnóstico)
   */
  fastify.get('/api/meta/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const isLive = Boolean(
      config.META_SYSTEM_USER_TOKEN &&
      !config.META_SYSTEM_USER_TOKEN.startsWith('EAA_TEST') &&
      config.META_SYSTEM_USER_TOKEN.length > 25
    );

    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3000';
    const calculatedWebhookUrl = `${protocol}://${host}/webhooks/meta`;

    return reply.send({
      isLive,
      statusMode: isLive ? 'PRODUCTION_LIVE' : 'SIMULATION_LOCAL',
      webhookUrl: calculatedWebhookUrl,
      webhookVerifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
      metaAppId: config.META_APP_ID,
      hasAppSecret: Boolean(config.META_APP_SECRET && config.META_APP_SECRET !== 'meta_app_secret_dev'),
      catalogId: config.META_CATALOG_ID,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
      wabaId: config.WHATSAPP_BUSINESS_ACCOUNT_ID,
      igUserId: config.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      tokenMasked: isLive
        ? `${config.META_SYSTEM_USER_TOKEN.slice(0, 10)}...${config.META_SYSTEM_USER_TOKEN.slice(-4)}`
        : 'EAA_TEST_TOKEN_PERMANENT_SYSTEM_USER (Simulação)',
    });
  });
}
