/**
 * Instagram Publisher Queue Worker
 * Suporta dois fluxos oficiais da Meta:
 * 
 * 1. Fluxo "Instagram API with Instagram Login" (Tokens 'IGAA...', base: https://graph.instagram.com)
 *    - Obtém o ID do usuário via GET https://graph.instagram.com/me com cache em memória
 *    - Cria container, faz polling e publica via graph.instagram.com
 *    - IMPORTANTE (EXPIRAÇÃO DE TOKEN):
 *      Tokens gerados no painel ou via Instagram Login geralmente vêm com validade de curta duração (1 hora).
 *      Para uso em produção, eles devem ser trocados por um Long-Lived User Access Token (válido por 60 dias) via:
 *      GET https://graph.instagram.com/access_token
 *          ?grant_type=ig_exchange_token
 *          &client_secret={INSTAGRAM_APP_SECRET}
 *          &access_token={SHORT_LIVED_TOKEN}
 *      Consulte a documentação oficial da Meta sobre "Long-Lived Access Tokens for Instagram Basic Display / Graph API".
 * 
 * 2. Fluxo "Facebook Login for Business / System User" (Tokens 'EAA...', base: https://graph.facebook.com)
 *    - Usa INSTAGRAM_BUSINESS_ACCOUNT_ID vinculado à página
 *    - Cria container, faz polling e publica via graph.facebook.com
 */

import { instagramPublishQueue, QueueJob } from '../queues/index.js';
import { db } from '../db/prisma.js';
import { config } from '../config.js';

export interface InstagramPublishPayload {
  postId: string;
  mediaType: 'IMAGE' | 'REELS' | 'STORIES';
  mediaUrl: string;
  caption: string;
}

const GRAPH_API_VERSION = 'v21.0';
const PLACEHOLDER_ACCOUNT_ID = '17841400000000000';

// Cache em memória para o Instagram User ID obtido via /me
let cachedInstagramUserId: { id: string; token: string; timestamp: number } | null = null;

/**
 * Obtém o ID do usuário do Instagram fazendo GET /me na Instagram Graph API
 */
async function getInstagramUserId(accessToken: string): Promise<string> {
  const now = Date.now();
  // Cache válido por 1 hora se for o mesmo token
  if (
    cachedInstagramUserId &&
    cachedInstagramUserId.token === accessToken &&
    now - cachedInstagramUserId.timestamp < 3600 * 1000
  ) {
    return cachedInstagramUserId.id;
  }

  const endpoint = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
  console.log(`[Instagram Worker] Buscando ID da conta via GET https://graph.instagram.com/me...`);

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.id) {
    // Alerta específico sobre possível expiração de token de curta duração
    let extraContext = '';
    if (response.status === 400 || response.status === 401 || (data.error && data.error.code === 190)) {
      extraContext =
        ' (Possível token expirado: tokens IGAA de curta duração duram apenas 1 hora. Troque por token de longa duração via GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token).';
    }

    const errorMsg = `Falha ao obter ID da conta do Instagram via /me (HTTP ${response.status}): ${
      data.error ? data.error.message : JSON.stringify(data)
    }${extraContext}`;

    console.error(`[Instagram Worker] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`[Instagram Worker] Conta do Instagram autenticada com sucesso: ${data.username || ''} (ID: ${data.id})`);

  cachedInstagramUserId = {
    id: data.id,
    token: accessToken,
    timestamp: now,
  };

  return data.id;
}

export function initInstagramWorker() {
  instagramPublishQueue.process(async (job: QueueJob<InstagramPublishPayload>) => {
    const { postId, mediaType, mediaUrl, caption } = job.data;

    // Detectar qual fluxo e token usar
    const isInstagramLoginFlow =
      Boolean(process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN) ||
      (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.startsWith('IGAA')) ||
      (process.env.META_SYSTEM_USER_TOKEN && process.env.META_SYSTEM_USER_TOKEN.startsWith('IGAA'));

    let accessToken = '';
    let apiBaseUrl = '';
    let instagramUserId = '';

    if (isInstagramLoginFlow) {
      // FLUXO 1: Instagram API with Instagram Login (graph.instagram.com)
      accessToken =
        process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN ||
        process.env.INSTAGRAM_ACCESS_TOKEN ||
        process.env.META_SYSTEM_USER_TOKEN ||
        '';

      if (!accessToken || accessToken.trim() === '' || accessToken === 'IGAA...') {
        const errorMsg =
          'Credenciais do Instagram não configuradas: INSTAGRAM_LOGIN_ACCESS_TOKEN ausente ou inválido.';
        await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
        throw new Error(errorMsg);
      }

      apiBaseUrl = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

      try {
        // Obtém dinamicamente o ID da conta via endpoint /me
        instagramUserId = await getInstagramUserId(accessToken);
      } catch (err: any) {
        const rawFallback = process.env.INSTAGRAM_USER_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

        // Se houver fallback configurado, validamos rigorosamente contra valores vazios ou placeholder
        if (
          rawFallback &&
          rawFallback.trim() !== '' &&
          rawFallback !== PLACEHOLDER_ACCOUNT_ID
        ) {
          instagramUserId = rawFallback.trim();
          console.warn(`[Instagram Worker] Usando INSTAGRAM_USER_ID do .env como fallback: ${instagramUserId}`);
        } else {
          // Se o fallback for ausente ou for o placeholder '17841400000000000', falhamos imediatamente
          const finalError = rawFallback === PLACEHOLDER_ACCOUNT_ID
            ? `Credenciais do Instagram inválidas: O ID configurado no .env é um placeholder (${PLACEHOLDER_ACCOUNT_ID}) e a consulta automática /me falhou: ${err.message}`
            : err.message;

          await db.updatePost(postId, { status: 'FAILED', errorMessage: finalError });
          throw new Error(finalError);
        }
      }
    } else {
      // FLUXO 2: Facebook Login for Business / System User (graph.facebook.com)
      accessToken =
        process.env.META_ACCESS_TOKEN ||
        process.env.META_SYSTEM_USER_TOKEN ||
        config.META_SYSTEM_USER_TOKEN;

      instagramUserId =
        process.env.INSTAGRAM_USER_ID ||
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
        process.env.INSTAGRAM_ACCOUNT_ID ||
        config.INSTAGRAM_BUSINESS_ACCOUNT_ID;

      apiBaseUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

      if (
        !accessToken ||
        accessToken.trim() === '' ||
        accessToken.startsWith('EAA_TEST') ||
        accessToken === 'EAA...'
      ) {
        const errorMsg =
          'Credenciais do Instagram não configuradas: Token de acesso ausente ou inválido (configure META_SYSTEM_USER_TOKEN no .env).';
        await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
        throw new Error(errorMsg);
      }

      if (
        !instagramUserId ||
        instagramUserId.trim() === '' ||
        instagramUserId === PLACEHOLDER_ACCOUNT_ID
      ) {
        const errorMsg =
          'Credenciais do Instagram não configuradas: ID da conta comercial ausente ou inválido (configure INSTAGRAM_BUSINESS_ACCOUNT_ID no .env).';
        await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
        throw new Error(errorMsg);
      }
    }

    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      const errorMsg = `URL de mídia inválida para publicação no Instagram: "${mediaUrl}". A Meta exige uma URL pública HTTPS/HTTP acessível.`;
      await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
      throw new Error(errorMsg);
    }

    console.log(
      `[Instagram Worker] Iniciando publicação real (${
        isInstagramLoginFlow ? 'Instagram Login API' : 'Graph Facebook API'
      }) para o post ${postId} na conta IG: ${instagramUserId}`
    );

    // 1. Atualiza status no banco para PROCESSING_CONTAINER
    await db.updatePost(postId, { status: 'PROCESSING_CONTAINER' });

    // 2. FASE 1: Criação do Container de Mídia (POST /{INSTAGRAM_USER_ID}/media)
    const containerEndpoint = `${apiBaseUrl}/${instagramUserId}/media`;
    const containerBody: Record<string, any> = {
      caption: caption || '',
    };

    if (mediaType === 'IMAGE') {
      containerBody.image_url = mediaUrl;
    } else if (mediaType === 'REELS') {
      containerBody.media_type = 'REELS';
      containerBody.video_url = mediaUrl;
    } else if (mediaType === 'STORIES') {
      containerBody.media_type = 'STORIES';
      containerBody.image_url = mediaUrl;
    } else {
      containerBody.image_url = mediaUrl;
    }

    const containerResponse = await fetch(containerEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(containerBody),
    });

    const containerData = await containerResponse.json().catch(() => ({}));

    if (!containerResponse.ok || !containerData.id) {
      const errorDetails = containerData.error ? containerData.error.message : JSON.stringify(containerData);
      const errorMsg = `Erro na criação do container no Instagram (HTTP ${containerResponse.status}): ${errorDetails}`;
      console.error(`[Instagram Worker] ${errorMsg}`);
      await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
      throw new Error(errorMsg);
    }

    const containerId = containerData.id;
    console.log(`[Instagram Worker] Container criado com sucesso: ${containerId}`);
    await db.updatePost(postId, { containerId });

    // 3. FASE 2: Polling de Status do Container (GET /{container_id}?fields=status_code) até FINISHED
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 30; // Aguarda até 60 segundos
    const pollIntervalMs = 2000;

    while (!isReady && attempts < maxAttempts) {
      attempts++;
      console.log(`[Instagram Worker] Polling de status container ${containerId} (tentativa ${attempts}/${maxAttempts})...`);

      const statusUrl = `${apiBaseUrl}/${containerId}?fields=status_code,status`;
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const statusData = await statusResponse.json().catch(() => ({}));

      if (!statusResponse.ok) {
        const errorMsg = `Falha ao consultar status do container ${containerId}: HTTP ${statusResponse.status}`;
        console.error(`[Instagram Worker] ${errorMsg}`);
        await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
        throw new Error(errorMsg);
      }

      const statusCode = statusData.status_code;

      if (statusCode === 'FINISHED') {
        isReady = true;
        console.log(`[Instagram Worker] Container ${containerId} pronto para publicação (FINISHED).`);
        break;
      } else if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        const errorMsg = `Meta rejeitou o container ${containerId}. Status: ${statusCode}. Detalhes: ${
          statusData.status || 'Erro no processamento da mídia'
        }`;
        console.error(`[Instagram Worker] ${errorMsg}`);
        await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
        throw new Error(errorMsg);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    if (!isReady) {
      const errorMsg = `Timeout: O processamento do container ${containerId} pela Meta excedeu o limite de ${
        maxAttempts * 2
      } segundos.`;
      console.error(`[Instagram Worker] ${errorMsg}`);
      await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
      throw new Error(errorMsg);
    }

    // 4. FASE 3: Publicação Final (POST /{INSTAGRAM_USER_ID}/media_publish)
    await db.updatePost(postId, { status: 'READY_TO_PUBLISH' });

    const publishEndpoint = `${apiBaseUrl}/${instagramUserId}/media_publish`;
    const publishResponse = await fetch(publishEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
      }),
    });

    const publishData = await publishResponse.json().catch(() => ({}));

    if (!publishResponse.ok || !publishData.id) {
      const errorDetails = publishData.error ? publishData.error.message : JSON.stringify(publishData);
      const errorMsg = `Erro na publicação final da mídia no Instagram (HTTP ${publishResponse.status}): ${errorDetails}`;
      console.error(`[Instagram Worker] ${errorMsg}`);
      await db.updatePost(postId, { status: 'FAILED', errorMessage: errorMsg });
      throw new Error(errorMsg);
    }

    const publishedMediaId = publishData.id;
    console.log(`[Instagram Worker] Post publicado com sucesso na Meta! ID da Mídia: ${publishedMediaId}`);

    // 5. Atualiza post para PUBLISHED com o ID definitivo retornado pela Graph API
    await db.updatePost(postId, {
      status: 'PUBLISHED',
      metaMediaId: publishedMediaId,
      publishedAt: new Date(),
    });

    return {
      status: 'PUBLISHED',
      containerId,
      metaMediaId: publishedMediaId,
    };
  });
}
