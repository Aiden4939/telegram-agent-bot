import OpenAI from "openai";
import type { Fetch } from "openai/core";
import { env } from "../config/env.js";

/** Node 22 下 OpenAI SDK 預設 node-fetch 處理 gzip 會 ERR_STREAM_PREMATURE_CLOSE */
export const openai = new OpenAI({
  apiKey: env.openaiApiKey,
  fetch: globalThis.fetch as unknown as Fetch,
});
