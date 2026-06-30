# 下次對話接手指南（NEXT_SESSION）

> **用途：** 換裝置、新開 Cursor 對話時先讀本檔。  
> **最後更新：** 2026-06-24  
> **Repo：** https://github.com/Aiden4939/telegram-agent-bot  
> **Infra：** https://github.com/Aiden4939/inwanding-infra（部署見 `docs/DEPLOY_TELEGRAM_BOT.md`）

---

## A. 專案在做什麼

用手機 **Telegram** 遠端控制：

| 意圖 | 行為 |
|------|------|
| `scrape` | 爬網頁 → OpenAI 摘要 → 直接回傳（不存筆記） |
| `dev` | Cursor SDK local runtime（讀 `DEFAULT_CWD` 程式碼） |
| `ops` | 主機/服務操作（查健康、容器狀態、日誌、磁碟；寫入操作待 Phase 2） |
| `chat` | OpenAI 閒聊 |

技術棧：grammy + Express + SQLite + playwright-service + OpenAI + `@cursor/sdk`

---

## B. 目前已完成

### 功能（Phase 1–2）

- [x] 意圖路由（LLM，失敗退回規則）
- [x] 網頁抓取分析（inline / 可選 n8n）
- [x] Cursor SDK 開發任務 + session（`/new`、`/cancel`）
- [x] 指令：`/start` `/help` `/status` `/cwd` `/new` `/cancel` `/reset`
- [x] dev 回覆：簡短提示 + Telegram 分段傳送
- [x] webhook 模式（遠端用）/ polling 模式（本機預設）
- [x] Dockerfile + 本機 `docker-compose.yml`
- [x] GHCR CI：push `main` → 建 `telegram-agent-bot` + `telegram-playwright-service` image

### 最新變更（2026-06-24）

- [x] 新增 `ops` 意圖（LLM + rules），主機操作需求先走安全提示
- [x] 移除 `/notes`、`/note` 指令與對應文案
- [x] `scrape` 改為「只分析回傳，不落地筆記」
- [x] n8n scrape 回應契約改為至少回傳 `summary`（`sourceUrl/title` 選填）
- [x] rules fallback 補回舊關鍵字（`存/保存/筆記`）避免誤判

### 進行中（ops Phase 1，分支 `feat/ops-phase1-executor`）

- [x] `opsPlanner`：自然語言 → 白名單 action
- [x] `opsExecutor`：查詢型 action（`check_health`、`docker_ps`、`tail_logs`、`disk_usage`）
- [x] `handleOps` 改為背景執行並回傳結果
- [ ] infra 需補：`OPS_DOCKER_ENABLED` + docker socket 掛載（才能查容器/log）
- [ ] Phase 2：高風險操作二次確認（restart/deploy）

### 穩定性修正（2026-06-23）

- [x] **Webhook 逾時不再 crash**：`onTimeout: "return"`，逾時先回 200，handler 背景繼續
- [x] **長任務背景化**：`handleDev` / `handleScrape` / `handleChat` 不阻塞 webhook 回應
- [x] **啟動回收殭屍 session**：`recoverStaleSessions()` 將 DB 中 `running` 重置為 `idle`
- [x] **延後寫入 running**：`openAgent()` 成功後才標 `status=running`
- [x] **dev 並發鎖**：`pendingDevChats` 防止連續觸發多個 dev 任務
- [x] **`/reset` 緊急重置**：清 in-memory 鎖、嘗試 cancel dev、重置 DB session（2026-06-23）

### 遠端部署狀態

- [x] `web-ubuntu` 已部署，`tgbot.inwanding.com` webhook 正常
- [x] 2026-06-23 曾發生 dev 任務卡死（見下方「事故紀錄」），已手動恢復並合併程式修正

### Git（`main`）

| Commit | 說明 |
|--------|------|
| `990a405` | 初始骨架 Phase 1–2 |
| `b824e40` | 修 Cursor SDK model、指令選單 |
| `1e7e41e` | /notes /help /cwd、webhook、Docker |
| `f0bb594` | GHCR build workflow |
| `f245a04` | NEXT_SESSION 交接文件 |
| `fd196c0` | Node 22 原生 fetch 修 OpenAI |
| `2f877db` | fix webhook crash loop on long dev tasks |
| *pending* | feat: add ops intent and switch scrape to analysis-only |

### Infra（`inwanding-infra`）

- [x] compose 加入 `telegram-playwright`、`telegram-bot`
- [x] nginx：`tgbot.inwanding.com`
- [x] deploy workflow 可選 `telegram-bot`
- [x] `scripts/setup-telegrambot-tunnel.sh`
- [x] `docs/DEPLOY_TELEGRAM_BOT.md`

---

## C. 事故紀錄與手動恢復 SOP（2026-06-23）

### 根因

webhook 模式下，dev 任務在 HTTP 請求內同步 `await`，超過 grammY 預設 10 秒 throw uncaught exception → process 退出 → SQLite 卡在 `running` → Telegram 重試同一則 update → crash loop。

### 手動恢復步驟（程式修正部署前用過）

```bash
# SSH 到 web-ubuntu
cd ~/inwanding-infra

# 1. 清除卡住的 session
docker exec telegram-agent-bot sqlite3 /app/data/bot.db \
  "UPDATE telegram_sessions SET status='idle', agent_id=NULL, updated_at=datetime('now') WHERE status='running';"

# 2. 丟棄待重試的 webhook updates（一次性）
#    透過 bot API setWebhook(..., { drop_pending_updates: true })

# 3. 重啟容器
docker compose restart telegram-bot
curl -sS http://127.0.0.1:8080/health -H "Host: tgbot.inwanding.com"
```

### 程式修正後預期行為

| 情境 | 修正前 | 修正後 |
|------|--------|--------|
| dev 超過 10 秒 | crash loop | 回 200，背景繼續 |
| 重啟後 session 卡 running | 永久 busy | 啟動自動回收 |
| 連續兩則 dev | 可能並發 | `pendingDevChats` 擋第二則 |

---

## D. 尚未完成 / 可選改進

- [ ] **部署最新 image 到遠端**（含 webhook 修正 + `/reset`）
- [ ] 實作 `RUN_TIMEOUT_MS`（env 已定義，程式尚未使用）
- [ ] deploy workflow 加 `git pull`（避免主機 compose 過期）
- [ ] `docker-compose.prod-like.yml` 本機模擬遠端
- [ ] 申請第二個 test bot token 給本機開發
- [ ] 區分「解釋 code」與「改 code」的意圖，減少誤判 dev

### 本機與遠端不要同時跑同一個 Bot Token

- 本機：polling（`TELEGRAM_MODE` 未設或 `polling`）
- 遠端：webhook
- **同一 token 只能一邊生效**

---

## E. 本機開發（新裝置 Setup）

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
DEFAULT_CWD=/path/to/inwanding   # 改成你本機的 repo 路徑
INTENT_ROUTER=llm
SCRAPE_MODE=inline
# 本機不要設 TELEGRAM_MODE=webhook
```

---

## F. 重要檔案地圖

```
src/
  services/botHandler.ts        # 指令、訊息路由、webhook 逾時、背景任務
  services/agentOrchestrator.ts # Cursor SDK、session 狀態
  services/llmIntentRouter.ts   # 意圖分類
  repositories/sessionRepository.ts  # session DB + recoverStaleSessions
  config/env.ts                 # 環境變數
  config/helpText.ts            # /help 文案
playwright-service/             # 網頁抓取 :3100
Dockerfile                      # 遠端 image
docker-compose.yml              # 本機 Docker 測試
.github/workflows/docker.yml    # GHCR 建置
docs/NEXT_SESSION.md            # 本檔
```

---

## G. 遠端 vs 本機對照

| | 本機 | 遠端（web-ubuntu） |
|---|------|-------------------|
| 啟動 | tsx watch | GHCR image + infra compose |
| Telegram | polling | webhook → tgbot.inwanding.com |
| Session DB | `./data/bot.db` | volume `telegram_bot_data` |
| 程式碼 | `DEFAULT_CWD` 本機路徑 | `/workspace` 掛載 |

### 遠端更新部署

```bash
# push main 後等 GHCR build 完成，再 SSH：
cd ~/inwanding-infra
docker compose pull telegram-bot
docker compose up -d telegram-bot
docker logs --tail 30 telegram-agent-bot
curl -sS http://127.0.0.1:8080/health -H "Host: tgbot.inwanding.com"
```

---

## H. 相關連結

- Infra 部署 SOP：`inwanding-infra/docs/DEPLOY_TELEGRAM_BOT.md`
- Infra runner：`inwanding-infra/docs/RUNNER.md`
- Cursor 專案規範：`inwanding/.cursor/rules/`

---

## I. 一句話交接

Telegram 遠端 Agent **已部署上線**；2026-06-23 修復 webhook 長任務 crash loop（背景化 + 逾時 return + session 回收）。**下一步：push 本次修正並 `docker compose pull` 更新遠端 image**。本機 polling、遠端 webhook，勿同時跑同一 bot token。
