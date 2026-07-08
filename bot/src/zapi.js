import { config } from './config.js';

const { baseUrl, instanceId, instanceToken, clientToken } = config.zapi;
const apiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

async function post(path, body) {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`Z-API ${path} falhou (${res.status}): ${texto}`);
  }
  return res.json();
}

export function sendText(phone, message) {
  return post('/send-text', { phone, message });
}
