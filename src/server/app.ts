/**
 * Fastify Application Setup
 * Registra plugins, CORS, inicializa Workers das filas BullMQ e monta rotas
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { webhookRoutes } from './routes/webhooks.js';
import { catalogRoutes } from './routes/catalog.ts';
import { instagramRoutes } from './routes/instagram.js';
import { queueRoutes } from './routes/queues.js';
import { uploadRoutes } from './routes/upload.js';
import { legalRoutes } from './routes/legal.js';
import { initWhatsAppWorker } from './workers/whatsapp.worker.js';
import { initCatalogWorker } from './workers/catalog.worker.js';
import { initInstagramWorker } from './workers/instagram.worker.js';
import { initTokenRefreshWorker } from './workers/token-refresh.worker.js';

export async function buildFastifyApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: 'info',
    },
  });

  // CORS aberto para desenvolvimento e consumo pelo frontend
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Suporte a upload de arquivos multipart (limite de 100MB para vídeos de Reels)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // Servir pasta pública de uploads
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Inicialização dos 4 Workers independentes do BullMQ
  initWhatsAppWorker();
  initCatalogWorker();
  initInstagramWorker();
  initTokenRefreshWorker();

  // Health check endpoint
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'meta-omnichannel-hub',
      timestamp: new Date().toISOString(),
      queues: ['whatsapp-inbound', 'catalog-sync', 'instagram-publisher', 'instagram-token-refresh'],
      framework: 'Fastify + BullMQ + Prisma',
    };
  });

  // Registro das rotas modulares
  await app.register(webhookRoutes);
  await app.register(catalogRoutes);
  await app.register(instagramRoutes);
  await app.register(queueRoutes);
  await app.register(uploadRoutes);
  await app.register(legalRoutes);

  return app;
}
