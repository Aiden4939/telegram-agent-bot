# 下次對話接手指南（NEXT_SESSION）

> **用途：** 換裝置、新開 Cursor 對話時先讀本檔。  
> **最後更新：** 2026-06-22  
> **Repo：** https://github.com/Aiden4939/telegram-agent-bot  
> **Infra：** https://github.com/Aiden4939/inwanding-infra（部署見 `docs/DEPLOY_TELEGRAM_BOT.md`）

---

## A. 專案在做什麼

用手機 **Telegram** 遠端控制：

| 意圖 | 行為 |
|------|------|
| `scrape` | 爬網頁 → OpenAI 摘要 → SQLite 筆記 |
| `dev` | Cursor SDK local runtime（讀 `DEFAULT_CWD` 程式碼） |
| `chat` | OpenAI 閒聊 |

技術棧：grammy + Express + SQLite + playwright-service + OpenAI + `@cursor/sdk`

---

## B. 目前已完成

### 功能（Phase 1–2）

- [x] 意圖路由（LLM，失敗退回規則）
- [x] 存筆記（inline / 可選 n8n）
- [x] Cursor SDK 開發任務 + session（`/new`、`/cancel`）
- [x] 指令：`/start` `/help` `/status` `/notes` `/note` `/cwd`
- [x] dev 回覆：簡短提示 + Telegram 分段傳送
- [x] webhook 模式（遠端用）/ polling 模式（本機預設）
- [x] Dockerfile + 本機 `docker-compose.yml`
- [x] GHCR CI：push `main` → 建 `telegram-agent-bot` + `telegram-playwright-service` image

### Git（`main` 已 push）

| Commit | 說明 |
|--------|------|
| `990a405` | 初始骨架 Phase 1–2 |
| `b824e40` | 修 Cursor SDK model、指令選單 |
| `1e7e41e` | /notes /help /cwd、webhook、Docker |
| `f0bb594` | GHCR build workflow |

### Infra（`inwanding-infra` commit `05162e4`）

- [x] compose 加入 `telegram-playwright`、`telegram-bot`
- [x] nginx：`tgbot.inwanding.com`
- [x] deploy workflow 可選 `telegram-bot`
- [x] `scripts/setup-telegrambot-tunnel.sh`
- [x] `docs/DEPLOY_TELEGRAM_BOT.md`

---

## C. 尚未完成（下一個人要做的）

### 1. 遠端首次部署（優先）

上次 GitHub Action **失敗**，原因：主機 `~/inwanding-infra` **未 `git pull`**，compose 裡沒有 `telegram-playwright` service。

```bash
# SSH 到 web-ubuntu
cd ~/inwanding-infra
git pull origin main
grep telegram-playwright docker-compose.yml   # 確認有這行

# .env 貼上 TELEGRAM_* 變數（見 .env.example）
./scripts/setup-telegrambot-tunnel.sh        # 首次
./scripts/backup-nginx-conf.sh

# 再跑 GitHub Actions：Deploy Service (Manual) → telegram-bot
# 或手動：
docker compose pull telegram-playwright telegram-bot
docker compose up -d telegram-playwright telegram-bot
docker exec edge-nginx nginx -t && docker exec edge-nginx nginx -s reload
curl -s http://127.0.0.1:8080/health -H "Host: tgbot.inwanding.com"
```

### 2. 本機與遠端不要同時跑同一個 Bot Token

- 本機：polling（`TELEGRAM_MODE` 未設或 `polling`）
- 遠端：webhook
- **同一 token 只能一邊生效**；部署遠端前停本機 `tsx watch` / port 3001、3100

### 3. 可選改進

- [ ] deploy workflow 加 `git pull`（避免主機 compose 過期）
- [ ] `docker-compose.prod-like.yml` 本機模擬遠端
- [ ] 申請第二個 test bot token 給本機開發

---

## D. 本機開發（新裝置 Setup）

```bash
git clone git@github.com:Aiden4939/telegram-agent-bot.git
cd telegram-agent-bot
cp .env.example .env
# 填入 token、OpenAI、CURSOR_API_KEY 等（勿 commit .env）

# Node >= 22.13（Cursor SDK）
npm install
npm rebuild better-sqlite3   # 換 Node 版本後

# 終端 1：playwright
cd playwright-service && npm install && npx playwright install chromium
node ./node_modules/tsx/dist/cli.mjs watch src/index.ts

# 終端 2：bot
cd ..
node ./node_modules/tsx/dist/cli.mjs watch src/index.ts
```

Git Bash 若 `npm run dev` segfault，用上面 `node ... tsx` 寫法。

### 關鍵 `.env`（本機）

```
TELEGRAM_BOT_TOKEN=...
ALLOWED_TELEGRAM_USER_IDS=...
OPENAI_API_KEY=...
INTERNAL_API_SECRET=...
CURSOR_API_KEY=...
DEFAULT_CWD=d:/桌面/code/inwanding   # 改成你新裝置的 repo 路徑
INTENT_ROUTER=llm
SCRAPE_MODE=inline
# 本機不要設 TELEGRAM_MODE=webhook
```

---

## E. 重要檔案地圖

```
src/
  services/botHandler.ts      # 指令、訊息路由、webhook/polling 啟動
  services/agentOrchestrator.ts # Cursor SDK
  services/llmIntentRouter.ts # 意圖分類
  config/env.ts               # 環境變數
  config/helpText.ts          # /help 文案
  repositories/                 # SQLite notes + sessions
playwright-service/           # 網頁抓取 :3100
Dockerfile                    # 遠端 image
docker-compose.yml            # 本機 Docker 測試
.github/workflows/docker.yml  # GHCR 建置
```

---

## F. 遠端 vs 本機對照

| | 本機 | 遠端（web-ubuntu） |
|---|------|-------------------|
| 啟動 | tsx watch | GHCR image + infra compose |
| Telegram | polling | webhook → tgbot.inwanding.com |
| 筆記 DB | `./data/bot.db` | volume `telegram_bot_data` |
| 程式碼 | `DEFAULT_CWD` 本機路徑 | `/workspace` 掛載 |

---

## G. 相關連結

- Infra 部署 SOP：`inwanding-infra/docs/DEPLOY_TELEGRAM_BOT.md`
- Infra runner：`inwanding-infra/docs/RUNNER.md`
- Cursor 專案規範：`inwanding/.cursor/rules/`

---

## H. 一句話交接

Telegram 遠端 Agent **功能已齊、已 push GitHub**；**遠端還沒 deploy 成功**（主機需 `git pull` + `.env` + tunnel，再跑 Action）。本機用 polling 開發，遠端用 webhook，**勿同時跑同一 bot token**。
