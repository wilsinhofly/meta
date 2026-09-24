/**
 * Catalog Management & Meta Commerce Manager Synchronization Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/prisma.js';
import { catalogSyncQueue } from '../queues/index.js';

const productSchema = z.object({
  retailerId: z.string().min(3),
  title: z.string().min(2),
  description: z.string().min(5),
  price: z.number().int().positive(), // centavos
  currency: z.string().default('BRL'),
  availability: z.enum(['in stock', 'out of stock']).default('in stock'),
  condition: z.enum(['new', 'refurbished', 'used']).default('new'),
  url: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  brand: z.string().default('MinhaMarca'),
  category: z.string().optional(),
});

export async function catalogRoutes(fastify: FastifyInstance) {
  /**
   * Listar todos os produtos do catálogo
   */
  fastify.get('/api/catalog/products', async () => {
    const products = await db.getProducts();
    return {
      total: products.length,
      products,
    };
  });

  /**
   * Criar ou atualizar produto
   * Automaticamente despacha delta para a fila catalog-sync
   */
  fastify.post('/api/catalog/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = productSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Dados inválidos', details: parseResult.error.format() });
    }

    const data = parseResult.data;
    const product = await db.upsertProduct(data as any);

    // Enfileira na fila BullMQ com debounce de 2 segundos
    const job = await catalogSyncQueue.add(
      `sync-${product.retailerId}`,
      {
        mode: 'SINGLE_UPDATE',
        retailerIds: [product.retailerId],
        operation: 'UPDATE',
      },
      { delay: 1500 }
    );

    return reply.code(201).send({
      message: 'Produto salvo e delta enfileirado para sincronização com o Meta Commerce Manager',
      product,
      jobId: job.id,
    });
  });

  /**
   * Disparar sincronização manual em lote de todos os produtos
   */
  fastify.post('/api/catalog/sync-all', async () => {
    const products = await db.getProducts();
    const skus = products.map((p) => p.retailerId);

    const job = await catalogSyncQueue.add('batch-full-sync', {
      mode: 'BATCH_FULL_SYNC',
      retailerIds: skus,
      operation: 'UPDATE',
    });

    return {
      message: `Lote de ${skus.length} produtos enfileirado com sucesso para a Meta Catalog Batch API`,
      jobId: job.id,
      productsCount: skus.length,
    };
  });

  /**
   * Feed Agendado XML (RSS 2.0 / Google Merchant Specification)
   * Utilizado pela Meta para reconciliação diária programada do estoque
   */
  fastify.get('/api/catalog/export-feed', async (request: FastifyRequest, reply: FastifyReply) => {
    const products = await db.getProducts();

    const itemsXml = products
      .map(
        (p) => `
    <item>
      <g:id>${p.retailerId}</g:id>
      <g:title><![CDATA[${p.title}]]></g:title>
      <g:description><![CDATA[${p.description}]]></g:description>
      <g:link>${p.url}</g:link>
      <g:image_link>${p.imageUrl}</g:image_link>
      <g:brand>${p.brand}</g:brand>
      <g:condition>${p.condition}</g:condition>
      <g:availability>${p.availability}</g:availability>
      <g:price>${(p.price / 100).toFixed(2)} BRL</g:price>
    </item>`
      )
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Catálogo Oficial Meta Commerce Manager</title>
    <link>https://sualoja.com.br</link>
    <description>Feed automático de reconciliação de produtos</description>
    ${itemsXml}
  </channel>
</rss>`;

    reply.header('Content-Type', 'application/xml; charset=utf-8');
    return reply.send(xml);
  });
}
