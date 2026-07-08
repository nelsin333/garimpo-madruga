import 'dotenv/config';

const required = [
  'ZAPI_INSTANCE_ID',
  'ZAPI_INSTANCE_TOKEN',
  'ZAPI_CLIENT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OWNER_PHONE',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltam variaveis de ambiente: ${missing.join(', ')}`);
  console.error('Copia o .env.example pra .env e preenche as credenciais.');
  process.exit(1);
}

export const config = {
  zapi: {
    baseUrl: process.env.ZAPI_BASE_URL || 'https://api.z-api.io',
    instanceId: process.env.ZAPI_INSTANCE_ID,
    instanceToken: process.env.ZAPI_INSTANCE_TOKEN,
    clientToken: process.env.ZAPI_CLIENT_TOKEN,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  ownerPhone: process.env.OWNER_PHONE.replace(/\D/g, ''),
  port: parseInt(process.env.PORT || '3000', 10),
  replyInGroups: process.env.REPLY_IN_GROUPS === 'true',
};
