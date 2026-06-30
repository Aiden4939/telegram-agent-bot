import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import type { OpsPlan, OpsResult } from "../types/ops.js";

const execFileAsync = promisify(execFile);

const OPS_HELP = [
  "目前支援的 ops 查詢：",
  "• 檢查服務健康（check_health）",
  "• 查看容器狀態（docker_ps）",
  "• 查看容器日誌（tail_logs，需指定容器）",
  "• 查看磁碟使用（disk_usage）",
].join("\n");

function assertDockerAllowlist(action: string): void {
  if (env.opsAllowedContainers.length === 0) {
    throw new Error(
      `尚未設定 OPS_ALLOWED_CONTAINERS，無法執行 ${action}。`
    );
  }
}

function assertAllowedContainer(container: string): void {
  assertDockerAllowlist("tail_logs");

  if (!env.opsAllowedContainers.includes(container)) {
    throw new Error(
      `容器 ${container} 不在允許清單：${env.opsAllowedContainers.join(", ")}`
    );
  }
}

function resolveContainer(plan: OpsPlan): string {
  const container = plan.container?.trim();
  if (!container) {
    throw new Error("請指定容器名稱，例如 svc-telegram-bot。");
  }
  assertAllowedContainer(container);
  return container;
}

async function runCommand(
  file: string,
  args: string[],
  timeoutMs = env.opsCommandTimeoutMs
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };

    if (execError.code === "ENOENT") {
      throw new Error(`${file} 不可用，請確認容器已安裝或已掛載 docker socket。`);
    }

    return {
      stdout: (execError.stdout ?? "").trim(),
      stderr: (execError.stderr ?? "").trim(),
      exitCode: typeof execError.code === "number" ? execError.code : 1,
    };
  }
}

async function checkHealth(): Promise<OpsResult> {
  const lines: string[] = [];

  for (const url of env.opsHealthUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.opsCommandTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.text();
      const preview = body.slice(0, 120).replace(/\s+/g, " ");
      lines.push(
        `${url} → ${response.ok ? "OK" : "FAIL"} (${response.status}) ${preview}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`${url} → ERROR (${message})`);
    } finally {
      clearTimeout(timeout);
    }
  }

  const detail = lines.join("\n");
  const ok = lines.every((line) => line.includes("→ OK"));

  return {
    ok,
    action: "check_health",
    summary: ok ? "健康檢查通過" : "部分健康檢查失敗",
    detail,
    exitCode: ok ? 0 : 1,
  };
}

async function dockerPs(): Promise<OpsResult> {
  if (!env.opsDockerEnabled) {
    throw new Error(
      "Docker ops 未啟用。請在 infra 設定 OPS_DOCKER_ENABLED=true 並掛載 docker socket。"
    );
  }

  assertDockerAllowlist("docker_ps");

  const lines: string[] = ["NAMES\tSTATUS\tPORTS"];
  let exitCode = 0;

  for (const name of env.opsAllowedContainers) {
    const { stdout, stderr, exitCode: code } = await runCommand("docker", [
      "ps",
      "-a",
      "--filter",
      `name=^/${name}$`,
      "--format",
      "{{.Names}}\t{{.Status}}\t{{.Ports}}",
    ]);

    if (code !== 0) {
      exitCode = code;
    }
    if (stdout) {
      lines.push(stdout);
    } else if (stderr) {
      lines.push(`${name}: ${stderr}`);
    }
  }

  const detail = lines.join("\n").trim();

  return {
    ok: exitCode === 0,
    action: "docker_ps",
    summary: exitCode === 0 ? "已取得容器狀態" : "取得容器狀態失敗",
    detail: detail || "（無輸出）",
    exitCode,
  };
}

async function tailLogs(plan: OpsPlan): Promise<OpsResult> {
  if (!env.opsDockerEnabled) {
    throw new Error(
      "Docker ops 未啟用。請在 infra 設定 OPS_DOCKER_ENABLED=true 並掛載 docker socket。"
    );
  }

  const container = resolveContainer(plan);
  const { stdout, stderr, exitCode } = await runCommand("docker", [
    "logs",
    "--tail",
    String(env.opsLogTailLines),
    container,
  ]);

  const detail = (stdout || stderr).slice(-3500);

  return {
    ok: exitCode === 0,
    action: "tail_logs",
    summary: `已取得 ${container} 最近 ${env.opsLogTailLines} 行日誌`,
    detail: detail || "（無輸出）",
    exitCode,
  };
}

async function diskUsage(): Promise<OpsResult> {
  const { stdout, stderr, exitCode } = await runCommand("df", ["-h"]);
  const detail = (stdout || stderr).slice(0, 3500);

  return {
    ok: exitCode === 0,
    action: "disk_usage",
    summary: exitCode === 0 ? "已取得磁碟使用資訊" : "取得磁碟使用失敗",
    detail: detail || "（無輸出）",
    exitCode,
  };
}

export function formatOpsResult(result: OpsResult): string {
  const status = result.ok ? "成功" : "失敗";
  return [
    `ops ${result.action}：${status}`,
    result.summary,
    "",
    result.detail,
  ].join("\n");
}

export async function executeOpsPlan(plan: OpsPlan): Promise<OpsResult> {
  if (!env.opsEnabled) {
    return {
      ok: false,
      action: plan.action,
      summary: "ops 執行器未啟用",
      detail: "請設定 OPS_ENABLED=true。",
      exitCode: null,
    };
  }

  if (plan.action === "unknown") {
    return {
      ok: false,
      action: "unknown",
      summary: "無法判斷要執行的 ops 動作",
      detail: OPS_HELP,
      exitCode: null,
    };
  }

  switch (plan.action) {
    case "check_health":
      return checkHealth();
    case "docker_ps":
      return dockerPs();
    case "tail_logs":
      return tailLogs(plan);
    case "disk_usage":
      return diskUsage();
    default:
      return {
        ok: false,
        action: plan.action,
        summary: "不支援的 ops 動作",
        detail: OPS_HELP,
        exitCode: null,
      };
  }
}
