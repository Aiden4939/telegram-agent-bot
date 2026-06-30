import { openai } from "./openaiClient.js";
import { env } from "../config/env.js";
import { OPS_ACTIONS, type OpsAction, type OpsPlan } from "../types/ops.js";

const VALID_ACTIONS = new Set<string>([...OPS_ACTIONS, "unknown"]);

function parseOpsPlanJson(raw: string): OpsPlan | null {
  try {
    const parsed = JSON.parse(raw) as {
      action?: string;
      container?: string;
    };

    if (!parsed.action || !VALID_ACTIONS.has(parsed.action)) {
      return null;
    }

    const container = parsed.container?.trim() || undefined;
    return {
      action: parsed.action as OpsAction | "unknown",
      container,
    };
  } catch {
    return null;
  }
}

export function planOpsActionByRules(text: string): OpsPlan {
  const lower = text.toLowerCase();

  if (/log|日誌/.test(text)) {
    return { action: "tail_logs", container: extractContainerName(text) };
  }

  if (/磁碟|disk|空間|容量/.test(lower)) {
    return { action: "disk_usage" };
  }

  if (/健康|health|連通/.test(lower)) {
    return { action: "check_health" };
  }

  if (/docker|容器/.test(lower)) {
    return { action: "docker_ps" };
  }

  if (/狀態|檢查/.test(lower)) {
    return { action: "check_health" };
  }

  return { action: "unknown" };
}

function extractContainerName(text: string): string | undefined {
  const match = text.match(
    /\b(svc-[a-z0-9-]+|telegram-agent-bot|playwright-service|edge-nginx)\b/i
  );
  return match?.[1];
}

export async function planOpsAction(text: string): Promise<OpsPlan> {
  try {
    const completion = await openai.chat.completions.create({
      model: env.llmModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "你是主機操作規劃器。分析使用者訊息，只回傳 JSON：",
            '{"action":"check_health|docker_ps|tail_logs|disk_usage|unknown","container":"可選，tail_logs 時填容器名"}',
            "",
            "規則：",
            "- check_health：檢查服務健康/連通性（含「docker 是否健康」這類）",
            "- docker_ps：查看容器運行狀態列表",
            "- tail_logs：查看容器最近日誌（需 container）",
            "- disk_usage：查看磁碟使用",
            "- unknown：無法判斷要做哪種操作",
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("LLM ops plan empty");
    }

    const parsed = parseOpsPlanJson(content);
    if (!parsed) {
      throw new Error("LLM ops plan invalid");
    }

    return parsed;
  } catch (error) {
    console.warn("[ops] LLM planning failed, fallback to rules:", error);
    return planOpsActionByRules(text);
  }
}
