export const OPS_ACTIONS = [
  "check_health",
  "docker_ps",
  "tail_logs",
  "disk_usage",
] as const;

export type OpsAction = (typeof OPS_ACTIONS)[number];

export interface OpsPlan {
  action: OpsAction | "unknown";
  container?: string;
}

export interface OpsResult {
  ok: boolean;
  action: string;
  summary: string;
  detail: string;
  exitCode: number | null;
}
