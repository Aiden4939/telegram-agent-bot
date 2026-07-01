export function assertProductionRuntimeGuards(): void {
  const telegramMode = process.env.TELEGRAM_MODE?.trim() || "polling";
  const devRuntime = process.env.DEV_RUNTIME?.trim() || "local";

  if (telegramMode === "webhook" && devRuntime !== "cloud") {
    console.error(
      "[env] TELEGRAM_MODE=webhook 時必須使用 DEV_RUNTIME=cloud，避免 Production 旁路修改本機工作區。"
    );
    process.exit(1);
  }
}
