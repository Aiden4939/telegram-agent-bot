const busyScrapeChats = new Set<number>();
const pendingDevChats = new Set<number>();
const pendingOpsChats = new Set<number>();
const pendingSecuritiesChats = new Set<number>();

export function isScrapeBusy(chatId: number): boolean {
  return busyScrapeChats.has(chatId);
}

export function isPendingDev(chatId: number): boolean {
  return pendingDevChats.has(chatId);
}

export function isPendingOps(chatId: number): boolean {
  return pendingOpsChats.has(chatId);
}

export function isPendingSecurities(chatId: number): boolean {
  return pendingSecuritiesChats.has(chatId);
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

export function markPendingSecurities(chatId: number): void {
  pendingSecuritiesChats.add(chatId);
}

export function clearPendingSecurities(chatId: number): void {
  pendingSecuritiesChats.delete(chatId);
}

export function isChatTaskLocked(chatId: number): boolean {
  return (
    busyScrapeChats.has(chatId) ||
    pendingDevChats.has(chatId) ||
    pendingOpsChats.has(chatId) ||
    pendingSecuritiesChats.has(chatId)
  );
}

export function clearChatTaskLocks(chatId: number): {
  scrapeLockCleared: boolean;
  devLockCleared: boolean;
  opsLockCleared: boolean;
  securitiesLockCleared: boolean;
} {
  return {
    scrapeLockCleared: busyScrapeChats.delete(chatId),
    devLockCleared: pendingDevChats.delete(chatId),
    opsLockCleared: pendingOpsChats.delete(chatId),
    securitiesLockCleared: pendingSecuritiesChats.delete(chatId),
  };
}
