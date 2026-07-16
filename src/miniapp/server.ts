import http from "http";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../logger";

const PUBLIC_DIR = path.resolve(process.cwd(), "public/miniapp");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function startMiniAppServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
      if (url.pathname === "/health") {
        sendJson(res, { status: "ok", service: "imbot", backend: config.apiBaseUrl });
        return;
      }
      if (url.pathname === "/api/miniapp/session" && req.method === "POST") {
        proxyMiniAppSession(req, res);
        return;
      }
      serveStatic(url.pathname, res);
    } catch (err) {
      logger.error("MiniApp server error", err);
      sendJson(res, { error: "internal_error" }, 500);
    }
  });

  server.listen(config.miniAppPort, config.miniAppHost, () => {
    logger.info(`Mini App server listening on http://${config.miniAppHost}:${config.miniAppPort}`);
  });
}

function proxyMiniAppSession(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 128_000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/participant/mini-app/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = await response.text();
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(payload);
    } catch (error) {
      logger.error("Mini App backend proxy failed", error);
      sendJson(res, { ok: false, error: "backend_unavailable" }, 503);
    }
  });
}

function serveStatic(requestPath: string, res: http.ServerResponse) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, "Forbidden", 403);
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, "Not found", 404);
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res: http.ServerResponse, data: string, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(data);
}
