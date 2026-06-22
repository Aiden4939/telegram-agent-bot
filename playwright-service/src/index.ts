import express, { type Request, type Response } from "express";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 3100);
const scrapeTimeoutMs = Number(process.env.SCRAPE_TIMEOUT_MS || 60000);

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post("/scrape", async (req: Request, res: Response) => {
  const url = req.body?.url as string | undefined;

  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ ok: false, error: "Invalid url" });
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: scrapeTimeoutMs,
    });

    const title = await page.title();
    const text = await page.innerText("body");

    res.json({
      ok: true,
      url,
      title: title.trim(),
      text: text.replace(/\s+/g, " ").trim().slice(0, 100000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`[playwright-service] Listening on :${port}`);
});
