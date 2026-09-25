/**
 * Instagram Token Refresh Worker
 * Executa periodicamente a cada 7 dias para verificar e renovar
 * o long-lived access token do Instagram antes da expiração de 60 dias.
 * 
 * Endpoint da Meta:
 * GET https://graph.instagram.com/refresh_access_token
 *     ?grant_type=ig_refresh_token
 *     &access_token={CURRENT_LONG_LIVED_TOKEN}
 * 
 * Regra da Meta:
 * Só é possível renovar tokens que tenham pelo menos 24 horas de emissão
 * e ainda não estejam expirados.
 */

import { instagramTokenRefreshQueue, QueueJob } from '../queues/index.js';
import { db } from '../db/prisma.js';
import { updateEnvFile } from '../services/instagram-token.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

export async function processTokenRefresh(): Promise<{
  action: 'REFRESHED' | 'SKIPPED_NOT_DUE' | 'NO_TOKEN';
  tokenPreview?: string;
  expiresAt?: string;
  message: string;
}> {
  console.log('[Token Refresh Worker] Iniciando verificação de expiração do token do Instagram...');

  // 1. Busca a credencial mais recente no banco
  let credential = await db.getLatestCredential('INSTAGRAM');

  // Fallback para variável de ambiente se ainda não estiver gravado no banco
  let activeToken = credential?.token || process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!activeToken || !activeToken.trim() || activeToken.startsWith('IGAA...') === false && activeToken.startsWith('IGAA') === false) {
    const msg = '[Token Refresh Worker] Nenhum token do fluxo Instagram Login encontrado para renovação.';
    console.log(msg);
    return { action: 'NO_TOKEN', message: msg };
  }

  const now = Date.now();

  // 2. Se temos a data de expiração, verifica se faltam menos de 15 dias
  if (credential?.expiresAt) {
    const expiresTimestamp = new Date(credential.expiresAt).getTime();
    const msUntilExpiration = expiresTimestamp - now;
    const daysUntilExpiration = Math.round(msUntilExpiration / (24 * 60 * 60 * 1000));

    if (msUntilExpiration > FIFTEEN_DAYS_MS) {
      const msg = `[Token Refresh Worker] Token ainda é válido por ~${daysUntilExpiration} dias. Renovação não necessária no momento (gatilho < 15 dias).`;
      console.log(msg);
      return {
        action: 'SKIPPED_NOT_DUE',
        tokenPreview: `${activeToken.slice(0, 10)}...${activeToken.slice(-6)}`,
        expiresAt: credential.expiresAt.toISOString(),
        message: msg,
      };
    }
  }

  // 3. Executa a chamada de renovação oficial da Meta
  console.log('[Token Refresh Worker] Token com menos de 15 dias ou sem data cadastrada. Chamando ig_refresh_token...');
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', activeToken.trim());

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (netErr: any) {
    const errMsg = `[Token Refresh Worker] Erro de rede ao conectar com graph.instagram.com: ${netErr.message}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    const errorDetails = data.error?.message || JSON.stringify(data);
    const errMsg = `[Token Refresh Worker] ERRO CRÍTICO ao renovar token no Instagram (HTTP ${response.status}): ${errorDetails}. Verifique urgentemente antes da expiração final do token!`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  const newLongLivedToken: string = data.access_token;
  const expiresIn: number = data.expires_in || 5184000; // ~60 dias
  const newExpiresAt = new Date(now + expiresIn * 1000);

  console.log(
    `[Token Refresh Worker] ✅ TOKEN RENOVADO COM SUCESSO! Nova validade: ${Math.round(
      expiresIn / 86400
    )} dias (${newExpiresAt.toISOString()})`
  );

  // 4. Salva o novo token e a nova expiração no banco
  await db.saveCredential({
    channel: 'INSTAGRAM',
    tokenType: 'USER_ACCESS',
    token: newLongLivedToken,
    expiresAt: newExpiresAt,
    isValid: true,
    lastCheckedAt: new Date(),
  });

  // 5. Atualiza variáveis de ambiente em memória
  process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN = newLongLivedToken;
  process.env.INSTAGRAM_ACCESS_TOKEN = newLongLivedToken;

  // 6. Persiste no arquivo .env
  updateEnvFile('INSTAGRAM_LOGIN_ACCESS_TOKEN', newLongLivedToken);
  updateEnvFile('INSTAGRAM_ACCESS_TOKEN', newLongLivedToken);

  return {
    action: 'REFRESHED',
    tokenPreview: `${newLongLivedToken.slice(0, 10)}...${newLongLivedToken.slice(-6)}`,
    expiresAt: newExpiresAt.toISOString(),
    message: 'Token de longa duração renovado e persistido com sucesso.',
  };
}

export function initTokenRefreshWorker() {
  // Registra o handler para a fila de refresh
  instagramTokenRefreshQueue.process(async (job: QueueJob) => {
    return await processTokenRefresh();
  });

  // Registra o repeatable job no BullMQ: executa a cada 7 dias
  instagramTokenRefreshQueue.addRepeatableJob(
    'weekly-instagram-token-refresh',
    {},
    SEVEN_DAYS_MS,
    false // Não precisa rodar instantaneamente no primeiro milissegundo, aguarda o ciclo ou chamado sob demanda
  );

  console.log('[Token Refresh Worker] Fila e agendamento de renovação automática registrados (ciclo de 7 dias).');
}
