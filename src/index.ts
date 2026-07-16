import { createBot } from "./bot";
import { logger } from "./logger";
import { startMiniAppServer } from "./miniapp/server";
import { config } from "./config";

async function main() {
  logger.info("Starting ITMO Megabattle participant bot...");
  startMiniAppServer();

  const bot = createBot();
  await configureMiniAppMenuButton(bot);

  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());

  await bot.start({
    onStart: (info) => logger.info(`Bot started as @${info.username}`),
  });
}

async function configureMiniAppMenuButton(bot: ReturnType<typeof createBot>) {
  if (!config.miniAppUrl) {
    await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
    logger.info("Mini App menu button reset to commands: MINI_APP_URL is not set");
    return;
  }
  if (!config.miniAppUrl.startsWith("https://")) {
    await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
    logger.info("Mini App menu button reset to commands: Telegram requires MINI_APP_URL to be HTTPS");
    return;
  }
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "IMB App",
      web_app: { url: config.miniAppUrl },
    },
  });
  logger.info(`Mini App menu button configured: ${config.miniAppUrl}`);
}

main().catch((err) => {
  logger.error("Fatal error on startup:", err);
  process.exit(1);
});
