import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { assertProductionRuntimeGuards } from "./config/validateEnv.js";
import { ensureSchema } from "./db/schema.js";
import { closeDb } from "./db/database.js";
import { recoverStaleSessions } from "./repositories/sessionRepository.js";
import { createBot, startBot } from "./services/botHandler.js";

async function main(): Promise<void> {
  assertProductionRuntimeGuards();
  ensureSchema();

  const recovered = recoverStaleSessions();
  if (recovered > 0) {
    console.warn(`[session] Recovered ${recovered} stale running session(s)`);
  }

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
