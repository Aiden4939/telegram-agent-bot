const busyScrapeChats = new Set<number>();
const pendingDevChats = new Set<number>();

export function isScrapeBusy(chatId: number): boolean {
  return busyScrapeChats.has(chatId);
}

export function isPendingDev(chatId: number): boolean {
  return pendingDevChats.has(chatId);
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

export function isChatTaskLocked(chatId: number): boolean {
  return busyScrapeChats.has(chatId) || pendingDevChats.has(chatId);
}

export function clearChatTaskLocks(chatId: number): {
  scrapeLockCleared: boolean;
  devLockCleared: boolean;
} {
  return {
    scrapeLockCleared: busyScrapeChats.delete(chatId),
    devLockCleared: pendingDevChats.delete(chatId),
  };
}
