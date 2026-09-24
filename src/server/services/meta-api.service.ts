/**
 * Meta Platform API Service
 * Wrappers reais para WhatsApp Cloud API, Meta Commerce Manager Batch API
 * e Instagram Graph API com fallback e logs detalhados de requisição.
 */

import { config } from '../config.js';

export interface MetaBatchRequestItem {
  method: 'CREATE' | 'UPDATE' | 'DELETE';
  retailer_id: string;
  data?: {
    title?: string;
    description?: string;
    availability?: 'in stock' | 'out of stock';
    condition?: 'new' | 'refurbished' | 'used';
    price?: number;
    currency?: string;
    url?: string;
    image_url?: string;
    brand?: string;
  };
}

export class MetaApiService {
  private systemToken: string;
  private catalogId: string;
  private phoneNumberId: string;
  private igUserId: string;

  constructor() {
    this.systemToken = config.META_SYSTEM_USER_TOKEN;
    this.catalogId = config.META_CATALOG_ID;
    this.phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
    this.igUserId = config.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  }

  // ==========================================
  // 1. WHATSAPP CLOUD API
  // ==========================================

  /**
   * Envia mensagem de texto simples
   */
  async sendWhatsAppText(to: string, text: string) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    };

    return this.postWhatsApp(payload);
  }

  /**
   * Envia Mensagem de Produto Único (Single Product Message)
   * Exibe o card com imagem, preço e botão nativo "Ver Detalhes"
   */
  async sendWhatsAppSingleProduct(to: string, productRetailerId: string, text: string) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text },
        footer: { text: 'Toque abaixo para ver disponibilidade e comprar' },
        action: {
          catalog_id: this.catalogId,
          product_retailer_id: productRetailerId,
        },
      },
    };

    return this.postWhatsApp(payload);
  }

  /**
   * Envia Mensagem Multi-Produtos (Multi-Product Message / Product List)
   * Agrupa até 30 itens em seções navegáveis dentro do WhatsApp
   */
  async sendWhatsAppMultiProduct(
    to: string,
    title: string,
    body: string,
    sections: Array<{ title: string; product_items: Array<{ product_retailer_id: string }> }>
  ) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: title },
        body: { text: body },
        action: {
          catalog_id: this.catalogId,
          sections,
        },
      },
    };

    return this.postWhatsApp(payload);
  }

  /**
   * Envia Menu Interativo com Botões Rápidos
   */
  async sendWhatsAppButtons(
    to: string,
    text: string,
    buttons: Array<{ id: string; title: string }>
  ) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };

    return this.postWhatsApp(payload);
  }

  private async postWhatsApp(payload: any) {
    const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
    
    // Se não houver token real configurado, simula resposta positiva no ambiente local
    if (!this.systemToken || this.systemToken.startsWith('EAA_TEST')) {
      return {
        simulated: true,
        endpoint: url,
        messages: [{ id: `wamid.SIMULATED_${Date.now()}` }],
        payload,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.systemToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`WhatsApp API Error (${response.status}): ${JSON.stringify(err)}`);
    }

    return response.json();
  }

  // ==========================================
  // 2. META COMMERCE MANAGER (CATALOG BATCH API)
  // ==========================================

  /**
   * Envia lote de atualizações de produtos via Catalog Batch API
   * POST /{catalog_id}/batch
   */
  async batchUpdateCatalog(requests: MetaBatchRequestItem[]) {
    const url = `https://graph.facebook.com/v21.0/${this.catalogId}/batch`;

    // Se estiver em modo de teste/simulação
    if (!this.systemToken || this.systemToken.startsWith('EAA_TEST')) {
      return {
        simulated: true,
        endpoint: url,
        catalog_id: this.catalogId,
        handles: requests.map((r) => `batch_handle_${r.retailer_id}_${Date.now()}`),
        total_requests: requests.length,
        status: 'SUCCESS',
        requests_sent: requests,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.systemToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Catalog Batch API Error (${response.status}): ${JSON.stringify(err)}`);
    }

    return response.json();
  }

  // ==========================================
  // 3. INSTAGRAM GRAPH API (2-PHASE PUBLISHER)
  // ==========================================

  /**
   * Fase 1: Criação do Container de Mídia (POST /{ig_user_id}/media)
   */
  async createInstagramMediaContainer(params: {
    mediaType: 'IMAGE' | 'REELS' | 'STORIES';
    mediaUrl: string;
    caption?: string;
  }) {
    const url = `https://graph.facebook.com/v21.0/${this.igUserId}/media`;

    if (!this.systemToken || this.systemToken.startsWith('EAA_TEST')) {
      return {
        simulated: true,
        id: `ig_container_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        status: 'IN_PROGRESS',
        params,
      };
    }

    const body: Record<string, any> = {
      caption: params.caption,
    };

    if (params.mediaType === 'IMAGE') {
      body.image_url = params.mediaUrl;
    } else if (params.mediaType === 'REELS') {
      body.media_type = 'REELS';
      body.video_url = params.mediaUrl;
    } else if (params.mediaType === 'STORIES') {
      body.media_type = 'STORIES';
      body.image_url = params.mediaUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.systemToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Instagram Media Container Error (${response.status}): ${JSON.stringify(err)}`);
    }

    return response.json();
  }

  /**
   * Fase 2: Polling de Status do Container (GET /{container_id}?fields=status_code)
   */
  async checkInstagramContainerStatus(containerId: string) {
    if (!this.systemToken || this.systemToken.startsWith('EAA_TEST')) {
      return {
        id: containerId,
        status_code: 'FINISHED', // 'IN_PROGRESS' | 'FINISHED' | 'ERROR'
      };
    }

    const url = `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.systemToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to check container status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fase 3: Publicação Final (POST /{ig_user_id}/media_publish)
   */
  async publishInstagramMedia(creationId: string) {
    const url = `https://graph.facebook.com/v21.0/${this.igUserId}/media_publish`;

    if (!this.systemToken || this.systemToken.startsWith('EAA_TEST')) {
      return {
        simulated: true,
        id: `ig_media_published_${Date.now()}`,
        status: 'PUBLISHED',
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.systemToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creation_id: creationId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Instagram Publish Error (${response.status}): ${JSON.stringify(err)}`);
    }

    return response.json();
  }
}

export const metaApi = new MetaApiService();
