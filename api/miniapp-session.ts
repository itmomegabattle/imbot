import type { IncomingMessage, ServerResponse } from "http";
import { config } from "../src/config";

export default async function miniAppSession(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") { response.statusCode = 405; return response.end("Method Not Allowed"); }
  let body = "";
  for await (const chunk of request) { body += chunk; if (body.length > 128_000) { response.statusCode = 413; return response.end("Payload Too Large"); } }
  const upstream = await fetch(`${config.apiBaseUrl}/api/v1/participant/mini-app/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  response.statusCode = upstream.status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(await upstream.text());
}
