import { buildFastifyApp } from './src/server/app.ts';
import middie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

async function startServer() {
  try {
    const app = await buildFastifyApp();
    const PORT = 3000;
    const isProduction = process.env.NODE_ENV === 'production';

    // Cria diretório de uploads se não existir
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Handler global de erro para que NENHUM erro não tratado derrube o processo
    app.setErrorHandler((error, request, reply) => {
      request.log.error(error);
      if (!reply.sent) {
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Erro inesperado no servidor',
        });
      }
    });

    if (!isProduction) {
      await app.register(middie);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });

      // Encaminha requisições que não sejam de API nem rotas dedicadas para o Vite
      app.use((req, res, next) => {
        if (
          req.url &&
          (req.url.startsWith('/api') ||
            req.url.startsWith('/webhooks') ||
            req.url.startsWith('/uploads') ||
            req.url.startsWith('/privacy') ||
            req.url.startsWith('/data-deletion'))
        ) {
          return next();
        }
        vite.middlewares(req, res, next);
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        await app.register(fastifyStatic, {
          root: distPath,
          prefix: '/',
          setHeaders: (res: any, pathName: string) => {
            try {
              const applyHeader = (name: string, value: string) => {
                if (res && typeof res.setHeader === 'function') {
                  res.setHeader(name, value);
                } else if (res && typeof res.header === 'function') {
                  res.header(name, value);
                } else if (res && res.raw && typeof res.raw.setHeader === 'function') {
                  res.raw.setHeader(name, value);
                }
              };

              if (typeof pathName === 'string' && pathName.endsWith('index.html')) {
                applyHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                applyHeader('Pragma', 'no-cache');
                applyHeader('Expires', '0');
              } else if (typeof pathName === 'string' && (pathName.includes('/assets/') || /\.[a-f0-9]{8,}\./i.test(pathName))) {
                applyHeader('Cache-Control', 'public, max-age=31536000, immutable');
              } else {
                applyHeader('Cache-Control', 'public, max-age=3600');
              }
            } catch (err) {
              console.error('[setHeaders error]', err);
            }
          },
        });

        app.setNotFoundHandler((req, reply) => {
          if (
            req.url.startsWith('/api') ||
            req.url.startsWith('/webhooks') ||
            req.url.startsWith('/uploads')
          ) {
            reply.code(404).send({ error: 'Endpoint não encontrado' });
          } else {
            // Garante headers anti-cache também quando renderiza o fallback do SPA
            reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            reply.header('Pragma', 'no-cache');
            reply.header('Expires', '0');
            reply.sendFile('index.html');
          }
        });
      }
    }

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Meta Omnichannel Hub] Servidor Fastify rodando na porta ${PORT}`);
  } catch (err) {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
}

// Proteção global do processo contra uncaughtException e unhandledRejection
process.on('uncaughtException', (err) => {
  console.error('[FATAL uncaughtException]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL unhandledRejection]:', reason);
});

startServer();
