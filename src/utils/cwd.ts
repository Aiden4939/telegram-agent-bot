import path from "node:path";
import { env } from "../config/env.js";
import { getSession } from "../repositories/sessionRepository.js";

export function resolveAllowedCwd(requested: string): string | null {
  const normalized = path.resolve(requested);
  const allowed = env.allowedCwdRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return (
      normalized === resolvedRoot ||
      normalized.startsWith(resolvedRoot + path.sep)
    );
  });
  return allowed ? normalized : null;
}

export function getCurrentCwd(chatId: string): string {
  return getSession(chatId)?.cwd || env.defaultCwd;
}
