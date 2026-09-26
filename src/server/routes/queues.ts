/**
 * BullMQ Queues Monitoring & Simulation Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getAllQueueMetrics,
  getAllRecentJobs,
  whatsappQueue,
  catalogSyncQueue,
  instagramPublishQueue,
} from '../queues/index.js';
import { db } from '../db/prisma.js';

export async function queueRoutes(fastify: FastifyInstance) {
  /**
   * Métricas em tempo real das 3 filas BullMQ
   */
  fastify.get('/api/queues/metrics', async () => {
    return getAllQueueMetrics();
  });

  /**
   * Lista de jobs recentes
   */
  fastify.get('/api/queues/jobs', async () => {
    const jobs = await getAllRecentJobs(50);
    return {
      total: jobs.length,
      jobs,
    };
  });

  /**
   * Reexecutar job com falha
   */
  fastify.post('/api/queues/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { queueName: string; jobId: string };
    let success = false;

    if (body.queueName === 'whatsapp-inbound') {
      success = await whatsappQueue.retry(body.jobId);
    } else if (body.queueName === 'catalog-sync') {
      success = await catalogSyncQueue.retry(body.jobId);
    } else if (body.queueName === 'instagram-publisher') {
      success = await instagramPublishQueue.retry(body.jobId);
    }

    if (!success) {
      return reply.code(404).send({ error: 'Job não encontrado ou não está com status de falha' });
    }

    return { message: 'Job reenfileirado com sucesso', jobId: body.jobId };
  });

  /**
   * Simulador de Eventos para Testes
   * Permite disparar simulações de webhooks e processos diretamente da UI ou CLI
   */
  fastify.post('/api/queues/simulate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      type: 'whatsapp_message' | 'catalog_delta' | 'instagram_reel';
      payload?: any;
    };

    if (body.type === 'whatsapp_message') {
      const senderPhone = body.payload?.waId || '5511999887766';
      const text = body.payload?.text || 'Olá! Gostaria de ver o catálogo de tênis';
      const wamid = `wamid.HBgLNTUxMTk5OTg4Nzc2NhUCABEYEj${Date.now().toString().slice(-10)}`;

      const job = await whatsappQueue.add('simulated-inbound', {
        waId: senderPhone,
        name: body.payload?.name || 'Cliente Teste',
        wamid,
        timestamp: Math.floor(Date.now() / 1000),
        type: 'text',
        text,
        productRetailerId: body.payload?.productRetailerId,
        buttonId: body.payload?.buttonId,
      });

      return {
        message: 'Evento de mensagem do WhatsApp simulado e enfileirado na BullMQ',
        jobId: job.id,
        wamid,
      };
    }

    if (body.type === 'catalog_delta') {
      const sku = body.payload?.sku || 'SKU-TENIS-AZUL-42';
      const newPrice = body.payload?.price || 27990;

      await db.upsertProduct({
        retailerId: sku,
        title: 'Tênis Running Ultralight Azul 42 (Promoção)',
        description: 'Amortecimento com retorno de energia, cabedal respirável em mesh.',
        price: newPrice,
      });

      const job = await catalogSyncQueue.add(`sync-${sku}`, {
        mode: 'SINGLE_UPDATE',
        retailerIds: [sku],
        operation: 'UPDATE',
      });

      return {
        message: `Delta de produto ${sku} enfileirado para envio ao Meta Commerce Manager`,
        jobId: job.id,
      };
    }

    if (body.type === 'instagram_reel') {
      const post = await db.addPost({
        igUserId: '17841400000000000',
        mediaType: 'REELS',
        caption: body.payload?.caption || 'Reels demonstrativo com novo drop esportivo! 👟🔥 #running #esporte',
        mediaUrl: body.payload?.mediaUrl || 'https://meta.3facil.com/uploads/reels-test-9-16.mp4',
        status: 'PROCESSING_CONTAINER',
      });

      const job = await instagramPublishQueue.add(`publish-reel-${post.id}`, {
        postId: post.id,
        mediaType: post.mediaType,
        mediaUrl: post.mediaUrl,
        caption: post.caption,
      });

      return {
        message: 'Pipeline assíncrono de Reels do Instagram iniciado (Container + Polling + Publish)',
        jobId: job.id,
        postId: post.id,
      };
    }

    return reply.code(400).send({ error: 'Tipo de simulação desconhecido' });
  });

  /**
   * Lista de conversas do WhatsApp (para CRM e Handoff humano)
   */
  fastify.get('/api/whatsapp/conversations', async () => {
    const convs = await db.getConversations();
    return {
      total: convs.length,
      conversations: convs,
    };
  });
}
