import { config } from "../config";

async function main() {
  if (!config.webhookBaseUrl.startsWith("https://")) throw new Error("WEBHOOK_BASE_URL must be HTTPS");
  if (!config.webhookSecret) throw new Error("WEBHOOK_SECRET is required");
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${config.webhookBaseUrl}/api/webhook`, secret_token: config.webhookSecret, allowed_updates: ["message", "callback_query"] }),
  });
  const result = await response.json(); if (!response.ok) throw new Error(JSON.stringify(result)); console.log(result);
}
void main();
