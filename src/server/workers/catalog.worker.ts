/**
 * Catalog Sync Queue Worker
 * Responsabilidades:
 * - Processar deltas de produtos (criação, edição de preço, baixa de estoque)
 * - Agrupar requisições em lotes compatíveis com a Meta Catalog Batch API (POST /{catalog_id}/batch)
 * - Reconciliação completa de inventário (Batch Full Feed Reconciliation)
 * - Atualizar o status de sincronização (PENDING -> SYNCING -> SYNCED / FAILED)
 */
import { catalogSyncQueue, QueueJob } from '../queues/index.js';
import { db, ProductData } from '../db/prisma.js';
import { metaApi, MetaBatchRequestItem } from '../services/meta-api.service.js';

export interface CatalogSyncPayload {
  mode: 'SINGLE_UPDATE' | 'BATCH_FULL_SYNC';
  retailerIds?: string[];
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';
}

export function initCatalogWorker() {
  catalogSyncQueue.process(async (job: QueueJob<CatalogSyncPayload>) => {
    const { mode, retailerIds = [], operation = 'UPDATE' } = job.data;
    let productsToSync: ProductData[] = [];

    // Modo 1: Sincronização Completa de Reconciliação Diária
    if (mode === 'BATCH_FULL_SYNC' || retailerIds.length === 0) {
      productsToSync = await db.getProducts();
    } else {
      // Modo 2: Delta por SKUs alterados (Criação, Edição de preço ou estoque)
      for (const sku of retailerIds) {
        const prod = await db.getProductByRetailerId(sku);
        if (prod) {
          productsToSync.push(prod);
        }
      }
    }

    if (productsToSync.length === 0) {
      return { message: 'Nenhum produto pendente para sincronização no Meta Commerce Manager.' };
    }

    // Marca status local como SYNCING
    for (const prod of productsToSync) {
      await db.updateProductSyncStatus(prod.retailerId, 'SYNCING');
    }

    // Mapeamento estrito para o formato exigido pelo Meta Commerce Manager
    const batchRequests: MetaBatchRequestItem[] = productsToSync.map((p) => ({
      method: operation,
      retailer_id: p.retailerId,
      data: {
        title: p.title,
        description: p.description,
        availability: p.availability,
        condition: p.condition,
        price: p.price,
        currency: p.currency,
        url: p.url,
        image_url: p.imageUrl,
        brand: p.brand || '3facil',
      },
    }));

    try {
      // Dispara chamada para a Batch API da Meta (POST /{catalog_id}/batch)
      const metaResponse = await metaApi.batchUpdateCatalog(batchRequests);

      // Atualiza status de cada produto para SYNCED
      for (const p of productsToSync) {
        await db.updateProductSyncStatus(p.retailerId, 'SYNCED');
      }

      return {
        status: 'SUCCESS',
        mode,
        syncedCount: productsToSync.length,
        metaHandles: metaResponse.handles || [],
        simulated: metaResponse.simulated || false,
      };
    } catch (err: any) {
      // Marca produtos como FAILED e grava erro
      for (const p of productsToSync) {
        await db.updateProductSyncStatus(p.retailerId, 'FAILED', err.message);
      }
      throw err;
    }
  });
}
