export function assertProductionRuntimeGuards(): void {
  const telegramMode = process.env.TELEGRAM_MODE?.trim() || "polling";
  const devRuntime = process.env.DEV_RUNTIME?.trim() || "local";
  const cloudRepos = process.env.CLOUD_REPOS?.trim() || "";

  if (telegramMode === "webhook" && devRuntime !== "cloud") {
    console.error(
      "[env] TELEGRAM_MODE=webhook 時必須使用 DEV_RUNTIME=cloud，避免 Production 旁路修改本機工作區。"
    );
    process.exit(1);
  }

  if (telegramMode === "webhook" && cloudRepos.length === 0) {
    console.error("[env] TELEGRAM_MODE=webhook 時必須設定 CLOUD_REPOS。");
    process.exit(1);
  }
}
