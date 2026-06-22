const TELEGRAM_MAX_LENGTH = 4096;

export function chunkMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt < maxLength * 0.5) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/** 輕量清理，讓純文字 Telegram 較好讀 */
export function plainTextForTelegram(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```\w*\n?/g, "").trim()
    )
    .replace(/^\|(.+)\|$/gm, (line) => line.replace(/\|/g, " ").trim())
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
