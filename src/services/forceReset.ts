import {
  forceResetDev,
  type ForceResetDevResult,
} from "./agentOrchestrator.js";
import { clearChatTaskLocks } from "./chatTaskState.js";

export interface ForceResetReport extends ForceResetDevResult {
  scrapeLockCleared: boolean;
  devLockCleared: boolean;
}

export async function performForceReset(
  chatId: string
): Promise<ForceResetReport> {
  const devResult = await forceResetDev(chatId);
  const lockResult = clearChatTaskLocks(Number(chatId));

  return {
    ...devResult,
    ...lockResult,
  };
}

export function formatForceResetMessage(report: ForceResetReport): string {
  const lines = ["已強制重置本 chat 的任務狀態："];

  if (report.devRunCancelled) {
    lines.push("• 已取消進行中的 dev run");
  } else if (report.hadActiveRun) {
    lines.push("• 已清除 dev run 記錄（cancel 不支援或失敗）");
  } else {
    lines.push("• 無進行中的 dev run");
  }

  if (report.scrapeLockCleared) {
    lines.push("• 已清除爬蟲鎖（背景任務可能仍在跑）");
  }

  if (report.devLockCleared) {
    lines.push("• 已清除 dev pending 鎖");
  }

  if (report.sessionReset) {
    const from = report.previousSessionStatus ?? "unknown";
    lines.push(`• session：${from} → idle（已清除 agent_id）`);
  } else if (report.previousSessionStatus) {
    lines.push(`• session：維持 ${report.previousSessionStatus}`);
  } else {
    lines.push("• session：無紀錄");
  }

  lines.push("");
  lines.push("可傳 /status 確認是否已閒置。");

  const mayNeedRestart =
    report.scrapeLockCleared ||
    (report.hadActiveRun && !report.devRunCancelled);
  if (mayNeedRestart) {
    lines.push("若仍無回應，請 SSH：docker compose restart telegram-bot");
  }

  return lines.join("\n");
}
