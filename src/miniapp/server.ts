import http from "http";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { appStore } from "../state/appStore";
import { logger } from "../logger";
import { usesRemoteBackend } from "../services/backend";

const PUBLIC_DIR = path.resolve(__dirname, "../../public/miniapp");

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
        sendJson(res, { status: "ok", service: "imbot", backendMode: config.backendMode });
        return;
      }
      if (url.pathname === "/api/miniapp/session" && req.method === "POST") {
        proxyMiniAppSession(req, res);
        return;
      }
      if (url.pathname === "/api/miniapp/profile" && !usesRemoteBackend) {
        sendJson(res, buildProfile(Number(url.searchParams.get("tgId"))));
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

function buildProfile(tgId: number) {
  const user = appStore.getUser(tgId);
  if (!Number.isFinite(tgId) || !user) return { ok: false, error: "user_not_found" };
  const currencies = appStore.userCurrencies(tgId);
  const level = appStore.levelProgress(tgId);
  const events = appStore.eventsForCurrentSeason().map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.date_begin,
    registered: user.registeredEventIds.includes(event.id),
    attended: user.attendedEventIds.includes(event.id),
  }));
  return {
    ok: true,
    user: {
      id: user.id,
      tgId: user.tgId,
      name: `${user.firstName} ${user.lastName}`.trim(),
      username: user.username,
      isManager: user.isManager,
    },
    stats: {
      streak: user.attendedEventIds.length,
      registrations: user.registeredEventIds.length,
      checkins: user.attendedEventIds.length,
    },
    level,
    currencies,
    events,
    scoreHistory: appStore.scoreHistory(tgId).slice(0, 8),
    currencyHistory: appStore.currencyHistory(tgId).slice(0, 8),
  };
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
