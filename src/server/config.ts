import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional().default(process.env.DATABASE_URL || 'file:/app/data/dev.db'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),

  // Chave de Segurança para rotas de Administração (ex: troca/renovação de credenciais)
  ADMIN_API_KEY: z.string().default(process.env.ADMIN_API_KEY || 'adm_sec_9f8b417e2c04da56e87b1c34a90f1e2d78b6c4e0a3f89d'),

  // Gemini Key
  GEMINI_API_KEY: z.string().default(process.env.GEMINI_API_KEY || ''),

  // Meta Credentials (com suporte a variáveis de compatibilidade META_ACCESS_TOKEN)
  META_APP_ID: z.string().default(process.env.META_APP_ID || '960263353494048'),
  META_APP_SECRET: z.string().default(process.env.META_APP_SECRET || ''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default(process.env.META_WEBHOOK_VERIFY_TOKEN || 'meta_webhook_secret_verify_token_123'),
  META_SYSTEM_USER_TOKEN: z.string().default(process.env.META_ACCESS_TOKEN || process.env.META_SYSTEM_USER_TOKEN || 'EAA_TEST_TOKEN_PERMANENT_SYSTEM_USER'),

  // Instagram Login App Secret & Token
  INSTAGRAM_APP_SECRET: z.string().default(process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || ''),
  INSTAGRAM_LOGIN_ACCESS_TOKEN: z.string().default(process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || ''),

  // Meta Assets & IDs (com suporte a INSTAGRAM_ACCOUNT_ID)
  META_CATALOG_ID: z.string().default(process.env.META_CATALOG_ID || '123456789012345'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(process.env.WHATSAPP_PHONE_NUMBER_ID || '109876543210987'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '567890123456789'),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().default(process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '17841443995002822'),
  FACEBOOK_PAGE_ID: z.string().default(process.env.FACEBOOK_PAGE_ID || '100000000000000'),
  PUBLIC_CDN_BASE_URL: z.string().default(process.env.APP_URL || process.env.PUBLIC_CDN_BASE_URL || 'https://meta.3facil.com'),

  // Intervalo mínimo de segurança entre publicações para a mesma conta (anti-burst)
  INSTAGRAM_PUBLISH_RATE_LIMIT_MINUTES: z
    .string()
    .default(process.env.INSTAGRAM_PUBLISH_RATE_LIMIT_MINUTES || '30')
    .transform((v) => parseInt(v, 10)),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
