import OpenAI from "openai";
import { env } from "../config/env.js";

const openai = new OpenAI({ apiKey: env.openaiApiKey });

export async function chat(message: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: env.llmModel,
    messages: [
      {
        role: "system",
        content:
          "你是友善的助理，用繁體中文簡潔回答。若使用者想存網頁筆記，請提示他附上網址並說明要存進筆記。",
      },
      { role: "user", content: message },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "（無回覆）";
}

export async function summarizeWebPage(
  url: string,
  title: string,
  text: string
): Promise<string> {
  const clipped = text.slice(0, 12000);
  const completion = await openai.chat.completions.create({
    model: env.llmModel,
    messages: [
      {
        role: "system",
        content:
          "你是筆記整理助理。請用繁體中文輸出結構化摘要：標題、重點條列、可執行待辦（若適用）。保持精簡。",
      },
      {
        role: "user",
        content: `網址：${url}\n頁面標題：${title}\n\n內容：\n${clipped}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "（無法產生摘要）";
}
