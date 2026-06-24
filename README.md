# Telegram Agent Bot

用手機 Telegram 遠端觸發：網頁抓取分析、Cursor Agent 開發任務、OpenAI 閒聊。

## 架構

```
Telegram → telegram-agent-bot (grammy + Express)
              ├─ scrape → playwright-service → OpenAI（回傳分析）
              ├─ dev    → Cursor SDK（local 或 cloud runtime）
              ├─ ops    → 主機操作意圖（目前僅安全提示）
              └─ chat   → OpenAI
```

可選：`SCRAPE_MODE=n8n` 時改由 n8n workflow 編排（見 `n8n/`）。

## 前置需求

- Node.js **>= 22.13**（Cursor SDK 需要；網頁分析/閒聊可用 20+）
- Telegram Bot Token、OpenAI API Key、你的 Telegram userId
- Playwright（本機 dev 需 `npx playwright install chromium`）

## 快速開始（本機）

> **換裝置 / 新對話接手：** 先讀 [docs/NEXT_SESSION.md](docs/NEXT_SESSION.md)

### 1. 環境變數

```bash
cp .env.example .env
# 編輯 .env 填入 TELEGRAM_BOT_TOKEN、ALLOWED_TELEGRAM_USER_IDS、OPENAI_API_KEY、INTERNAL_API_SECRET
```

`INTERNAL_API_SECRET` 可隨機產生，例如：`openssl rand -hex 16`

### 2. 啟動 Playwright 服務

**Docker：**

```bash
docker compose up -d playwright-service
```

**本機：**

```bash
cd playwright-service
npm install
npx playwright install chromium
npm run dev
```

### 3. 啟動 Bot

```bash
npm install
npm run dev
```

Git Bash 若 `tsx watch` 異常，可改用：

```bash
node ./node_modules/tsx/dist/cli.mjs watch src/index.ts
```

### 4. 測試

```
幫我分析 https://example.com 並整理重點
```

```
幫我解釋 line-reminder-bot 的指令有哪些（請 5 條列點）
```

## Docker 一鍵啟動

```bash
cp .env.example .env
# 填好 .env 後：
docker compose up -d
```

會同時啟動 `playwright-service` 與 `telegram-bot`。SQLite 資料存在 volume `bot_data`。

> **開發任務（Cursor SDK）**：
> - `DEV_RUNTIME=local`：容器內需能存取程式碼目錄，並設定 `DEFAULT_CWD`
> - `DEV_RUNTIME=cloud`：由 Cursor Cloud Agent 在雲端 clone `CLOUD_REPOS` 執行，建議搭配 `CLOUD_AUTO_CREATE_PR=true`

## 指令

| 指令 | 說明 |
|------|------|
| `/start` | 快速開始 |
| `/help` | 完整使用說明 |
| `/status` | 模式、session、cwd、狀態 |
| `/cwd [路徑]` | 查看或切換開發目錄 |
| `/new` | 開新開發 Agent session |
| `/cancel` | 取消進行中的開發任務 |
| `/reset` | 緊急重置任務狀態（卡死時用） |

直接傳文字會由 AI 自動判斷 scrape / dev / ops / chat。

## Webhook 部署

適用於有 HTTPS 公網網址的 VPS / Cloud Run 等：

```env
TELEGRAM_MODE=webhook
WEBHOOK_URL=https://your.domain/telegram/webhook
WEBHOOK_PATH=/telegram/webhook
PORT=3001
```

啟動後 Bot 會向 Telegram 註冊 webhook，並在 Express 掛載 `WEBHOOK_PATH` 接收更新。需確保反向代理將 HTTPS 流量轉到 `PORT`。

本機開發請用預設 `TELEGRAM_MODE=polling`。

## 環境變數摘要

| 變數 | 說明 |
|------|------|
| `CURSOR_API_KEY` | Cursor SDK（開發任務） |
| `DEV_RUNTIME` | `local` 或 `cloud`（建議 cloud） |
| `CLOUD_REPOS` | Cloud Agent 目標 repo（`owner/repo`，可多個） |
| `CLOUD_AUTO_CREATE_PR` | Cloud Agent 完成後是否自動開 PR |
| `DEFAULT_CWD` | Agent 預設工作目錄 |
| `ALLOWED_CWD_ROOTS` | `/cwd` 允許切換的根目錄（逗號分隔） |
| `DEV_BRIEF_REPLY` | 開發任務自動加簡短回覆提示（預設 true） |
| `INTENT_ROUTER` | `llm` 或 `rules` |
| `SCRAPE_MODE` | `inline` 或 `n8n` |

## n8n 模式（可選）

```bash
# .env 設定 SCRAPE_MODE=n8n
docker compose --profile n8n up -d
```

於 n8n UI（http://localhost:5678）匯入 `n8n/scrape-note.workflow.json`，啟用 workflow 後測試。
Webhook 回應至少需包含 `summary`，可選包含 `sourceUrl`、`title`。

## API

- `GET /health` — 健康檢查
- `POST /internal/notes` — n8n 回傳分析結果（Header: `X-Internal-Secret`）
