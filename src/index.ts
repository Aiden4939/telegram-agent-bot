import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureSchema } from "./db/schema.js";
import { closeDb } from "./db/database.js";
import { createBot, startBot } from "./services/botHandler.js";

async function main(): Promise<void> {
  ensureSchema();

  const app = createApp();
  const bot = createBot();
  await startBot(bot, app);

  const server = app.listen(env.port, () => {
    console.log(`[app] Listening on :${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[app] Received ${signal}, shutting down...`);
    await bot.stop();
    server.close();
    closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[app] Failed to start:", error);
  process.exit(1);
});
