const busyScrapeChats = new Set<number>();
const pendingDevChats = new Set<number>();
const pendingOpsChats = new Set<number>();
const pendingGitHubChats = new Set<number>();

export function isScrapeBusy(chatId: number): boolean {
  return busyScrapeChats.has(chatId);
}

export function isPendingDev(chatId: number): boolean {
  return pendingDevChats.has(chatId);
}

export function isPendingOps(chatId: number): boolean {
  return pendingOpsChats.has(chatId);
}

export function markScrapeBusy(chatId: number): void {
  busyScrapeChats.add(chatId);
}

export function clearScrapeBusy(chatId: number): void {
  busyScrapeChats.delete(chatId);
}

export function markPendingDev(chatId: number): void {
  pendingDevChats.add(chatId);
}

export function clearPendingDev(chatId: number): void {
  pendingDevChats.delete(chatId);
}

export function markPendingOps(chatId: number): void {
  pendingOpsChats.add(chatId);
}

export function clearPendingOps(chatId: number): void {
  pendingOpsChats.delete(chatId);
}

export function isPendingGitHub(chatId: number): boolean {
  return pendingGitHubChats.has(chatId);
}

export function markPendingGitHub(chatId: number): void {
  pendingGitHubChats.add(chatId);
}

export function clearPendingGitHub(chatId: number): void {
  pendingGitHubChats.delete(chatId);
}

export function isChatTaskLocked(chatId: number): boolean {
  return (
    busyScrapeChats.has(chatId) ||
    pendingDevChats.has(chatId) ||
    pendingOpsChats.has(chatId) ||
    pendingGitHubChats.has(chatId)
  );
}

export function clearChatTaskLocks(chatId: number): {
  scrapeLockCleared: boolean;
  devLockCleared: boolean;
  opsLockCleared: boolean;
  githubLockCleared: boolean;
} {
  return {
    scrapeLockCleared: busyScrapeChats.delete(chatId),
    devLockCleared: pendingDevChats.delete(chatId),
    opsLockCleared: pendingOpsChats.delete(chatId),
    githubLockCleared: pendingGitHubChats.delete(chatId),
  };
}
