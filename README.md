# Telegram Agent Bot（Phase 1）

用手機 Telegram 遠端觸發：爬網頁 → LLM 總結 → 存入 SQLite 筆記。

## 架構

```
Telegram → telegram-agent-bot (grammy)
              ├─ scrape 意圖 → playwright-service → OpenAI → SQLite
              └─ 其他訊息 → OpenAI 閒聊
```

可選：`SCRAPE_MODE=n8n` 時改由 n8n workflow 編排（見 `n8n/`）。

## 前置需求

- Node.js 20+
- Telegram Bot Token、OpenAI API Key、你的 Telegram userId
- Playwright（本機 dev 需 `npx playwright install chromium`）

## 快速開始

### 1. 環境變數

```bash
cp .env.example .env
# 編輯 .env 填入 TELEGRAM_BOT_TOKEN、ALLOWED_TELEGRAM_USER_IDS、OPENAI_API_KEY、INTERNAL_API_SECRET
```

`INTERNAL_API_SECRET` 可隨機產生，例如：`openssl rand -hex 16`

### 2. 啟動 Playwright 服務

**Docker（建議）：**

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

### 4. 測試

在 Telegram 對 Bot 傳送：

```
幫我把 https://example.com 存進筆記
```

預期回覆：`已完成，筆記 #1` + 摘要預覽

## Phase 2 新增

- **AI 意圖路由**：自動判斷 `scrape`（存筆記）/ `dev`（開發）/ `chat`（閒聊）
- **Cursor SDK**：開發類任務（需 `CURSOR_API_KEY`）
- 指令：`/new` 開新開發 session、`/cancel` 取消開發任務

### 開發任務範例

```
幫我解釋 line-reminder-bot 的 db pool 在做什麼
```

需先在 `.env` 設定：

```env
CURSOR_API_KEY=你的_cursor_api_key
DEFAULT_CWD=d:/桌面/code/inwanding
```

> Cursor SDK 建議 Node.js >= 22.13

## 指令

| 指令 | 說明 |
|------|------|
| `/start` | 使用說明 |
| `/status` | 目前模式、session、狀態 |
| `/new` | 開新開發 Agent session |
| `/cancel` | 取消進行中的開發任務 |

## n8n 模式（可選）

```bash
# .env 設定 SCRAPE_MODE=n8n
docker compose --profile n8n up -d
```

於 n8n UI（http://localhost:5678）匯入 `n8n/scrape-note.workflow.json`，啟用 workflow 後測試。

## API

- `GET /health` — 健康檢查
- `POST /internal/notes` — n8n 回寫筆記（Header: `X-Internal-Secret`）

## Phase 2（尚未實作）

- Cursor SDK 遠端開發
- LLM 意圖路由
