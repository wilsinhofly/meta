import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/api/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'Nenhum arquivo enviado' });
      }

      // Validação de tipo de arquivo
      const mime = data.mimetype;
      const isImage = mime.startsWith('image/');
      const isVideo = mime.startsWith('video/');

      if (!isImage && !isVideo) {
        return reply.code(400).send({
          error: 'Formato inválido. Apenas imagens (JPEG, PNG) ou vídeos (MP4, MOV) são permitidos.',
        });
      }

      // Gera nome único para o arquivo
      const ext = path.extname(data.filename) || (isImage ? '.jpg' : '.mp4');
      const uniqueFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, uniqueFileName);
      await pipeline(data.file, fs.createWriteStream(filePath));

      // Gera a URL pública acessível
      const origin = request.headers['x-forwarded-proto'] && request.headers.host
        ? `${request.headers['x-forwarded-proto']}://${request.headers.host}`
        : `${request.protocol}://${request.hostname}`;

      const publicUrl = `${origin}/uploads/${uniqueFileName}`;

      return reply.code(201).send({
        success: true,
        fileName: uniqueFileName,
        mediaUrl: publicUrl,
        type: isVideo ? 'REELS' : 'IMAGE',
        mimeType: mime,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.code(500).send({
        error: 'Falha ao salvar arquivo no servidor',
        message: err.message,
      });
    }
  });
}
