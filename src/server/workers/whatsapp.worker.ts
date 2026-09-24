/**
 * WhatsApp Inbound Queue Worker
 * Responsabilidades:
 * - Deduplicação de mensagens via wamid
 * - Persistência no banco (tabelas Contact, Conversation, Message)
 * - Máquina de estados conversacional do Bot:
 *   - BOT_ROUTING: Triagem inicial
 *   - BOT_IN_MENU: Navegação determinística de catálogo e opções
 *   - HUMAN_QUEUE: Aguardando operador
 *   - HUMAN_ACTIVE: Em atendimento com operador humano
 * - Envio de Single Product Message e Multi-Product List
 * - Uso do Gemini 3.8 Flash (@google/genai) para perguntas abertas
 */
import { whatsappQueue, QueueJob } from '../queues/index.js';
import { db } from '../db/prisma.js';
import { metaApi } from '../services/meta-api.service.js';
import { generateBotResponse } from '../services/gemini.service.js';

export interface WhatsAppInboundPayload {
  waId: string;
  name?: string;
  wamid: string;
  timestamp: number;
  type: 'text' | 'button' | 'interactive' | 'product_inquiry';
  text?: string;
  buttonId?: string;
  productRetailerId?: string;
}

export function initWhatsAppWorker() {
  whatsappQueue.process(async (job: QueueJob<WhatsAppInboundPayload>) => {
    const { waId, name, wamid, text, buttonId, productRetailerId } = job.data;

    // 1. Persiste a mensagem de entrada e valida deduplicação
    const conv = await db.addMessage({
      waId,
      contactName: name,
      wamid,
      direction: 'INBOUND',
      type: 'TEXT',
      body: text || buttonId || productRetailerId || 'Mensagem recebida',
    });

    // 2. Se a conversa já está sob controle de um operador humano, não intervém com o bot
    if (conv.state === 'HUMAN_ACTIVE' || conv.state === 'HUMAN_QUEUE') {
      return {
        action: 'ROUTED_TO_HUMAN_QUEUE',
        waId,
        state: conv.state,
      };
    }

    const rawText = (text || '').trim();
    const normalizedText = rawText.toLowerCase();

    // 3. MÁQUINA DE ESTADOS DETERMINÍSTICA

    // A. Transição para Atendimento Humano (Handoff)
    if (
      normalizedText.includes('atendente') ||
      normalizedText.includes('humano') ||
      normalizedText.includes('operador') ||
      normalizedText.includes('suporte') ||
      buttonId === 'btn_human_support'
    ) {
      await db.setConversationState(waId, 'HUMAN_QUEUE');
      await metaApi.sendWhatsAppText(
        waId,
        '👨‍💼 Entendido! Já transferi seu atendimento para nossa equipe humana (Fila de Atendimento). Em instantes um operador irá lhe responder aqui.'
      );
      await db.addMessage({
        waId,
        wamid: `out_${Date.now()}`,
        direction: 'OUTBOUND',
        type: 'TEXT',
        body: 'Atendimento transferido para a fila humana.',
      });
      return { action: 'HANDOFF_TRIGGERED', waId, newState: 'HUMAN_QUEUE' };
    }

    // B. Solicitação ou Dúvida sobre Produto Específico (Single Product Message)
    if (productRetailerId) {
      const product = await db.getProductByRetailerId(productRetailerId);
      if (product) {
        await metaApi.sendWhatsAppSingleProduct(
          waId,
          product.retailerId,
          `Encontrei este item no nosso catálogo: *${product.title}* por apenas *R$ ${(product.price / 100).toFixed(2).replace('.', ',')}*.`
        );
        await db.addMessage({
          waId,
          wamid: `out_prod_${Date.now()}`,
          direction: 'OUTBOUND',
          type: 'PRODUCT',
          body: `Envio de Produto Único: ${product.title}`,
          payload: { retailerId: product.retailerId, price: product.price },
        });
        return { action: 'SENT_SINGLE_PRODUCT', waId, sku: product.retailerId };
      }
    }

    // C. Ver Catálogo Completo / Multi-Product Message
    if (
      normalizedText === 'catalogo' ||
      normalizedText === 'catálogo' ||
      normalizedText === 'produtos' ||
      normalizedText === 'ver produtos' ||
      buttonId === 'btn_view_catalog'
    ) {
      const allProducts = await db.getProducts();
      const inStock = allProducts.filter((p) => p.availability === 'in stock').slice(0, 10);

      if (inStock.length > 0) {
        const sections = [
          {
            title: 'Destaques da Loja',
            product_items: inStock.slice(0, 4).map((p) => ({
              product_retailer_id: p.retailerId,
            })),
          },
        ];
        await metaApi.sendWhatsAppMultiProduct(
          waId,
          'Catálogo Oficial 3Facil',
          'Selecione uma categoria ou produto abaixo para visualizar detalhes e disponibilidade:',
          sections
        );
      } else {
        await metaApi.sendWhatsAppText(
          waId,
          '🛍️ Nosso catálogo online está disponível em: https://www.3facil.com'
        );
      }

      await db.setConversationState(waId, 'BOT_IN_MENU');
      await db.addMessage({
        waId,
        wamid: `out_list_${Date.now()}`,
        direction: 'OUTBOUND',
        type: 'PRODUCT_LIST',
        body: 'Catálogo de produtos enviado ao cliente.',
        payload: { totalProducts: inStock.length },
      });
      return { action: 'SENT_MULTI_PRODUCT_CATALOG', waId, count: inStock.length };
    }

    // D. FAQ Rápido (Frete / Prazos / Pagamento)
    if (buttonId === 'btn_faq_shipping' || normalizedText.includes('frete') || normalizedText.includes('prazo')) {
      await metaApi.sendWhatsAppText(
        waId,
        '📦 *Informações de Envio e Prazos:*\n• Enviamos para todo o Brasil via Correios e Transportadoras parceiras.\n• Prazo médio de entrega: 3 a 7 dias úteis após a confirmação.\n• O frete exato pode ser calculado ao selecionar os produtos no catálogo!'
      );
      await db.setConversationState(waId, 'BOT_IN_MENU');
      return { action: 'SENT_FAQ_SHIPPING', waId };
    }

    // E. Menu Principal Determinístico (Se o usuário enviou "oi", "olá", "menu" ou iniciou)
    if (
      normalizedText === 'oi' ||
      normalizedText === 'ola' ||
      normalizedText === 'olá' ||
      normalizedText === 'menu' ||
      normalizedText === 'iniciar' ||
      !rawText
    ) {
      await db.setConversationState(waId, 'BOT_IN_MENU');
      await metaApi.sendWhatsAppButtons(
        waId,
        `Olá, ${name || 'amigo(a)'}! Seja bem-vindo ao nosso atendimento oficial. Como podemos ajudar você hoje?`,
        [
          { id: 'btn_view_catalog', title: '🛍️ Ver Catálogo' },
          { id: 'btn_faq_shipping', title: '📦 Prazos e Frete' },
          { id: 'btn_human_support', title: '👨‍💼 Falar com Humano' },
        ]
      );
      await db.addMessage({
        waId,
        wamid: `out_menu_${Date.now()}`,
        direction: 'OUTBOUND',
        type: 'INTERACTIVE_BUTTON',
        body: 'Menu principal do bot enviado.',
      });
      return { action: 'SENT_WELCOME_MENU', waId };
    }

    // F. PERGUNTAS ABERTAS: Usa @google/genai (Gemini 3.8 Flash) com contexto dos produtos reais
    const allProducts = await db.getProducts();
    const catalogSummary = allProducts
      .slice(0, 8)
      .map((p) => `- ${p.title} (SKU: ${p.retailerId}): R$ ${(p.price / 100).toFixed(2)} [${p.availability}]`)
      .join('\n');

    const botAiAnswer = await generateBotResponse(rawText, catalogSummary);

    await metaApi.sendWhatsAppText(waId, botAiAnswer);
    await db.setConversationState(waId, 'BOT_ROUTING');
    await db.addMessage({
      waId,
      wamid: `out_ai_${Date.now()}`,
      direction: 'OUTBOUND',
      type: 'TEXT',
      body: botAiAnswer,
    });

    return { action: 'SENT_AI_RESPONSE', waId };
  });
}
