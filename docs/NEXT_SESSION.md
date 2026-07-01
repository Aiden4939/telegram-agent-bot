# 下次對話接手指南（NEXT_SESSION）

> **用途：** 換裝置、新開 Cursor 對話時先讀本檔。  
> **最後更新：** 2026-07-01  
> **Repo：** https://github.com/Aiden4939/telegram-agent-bot（`main` @ `68e8fb9`）  
> **Infra：** https://github.com/Aiden4939/inwanding-infra（`main` @ `4ed6a91`）  
> **部署 SOP：** `inwanding-infra/docs/DEPLOY_TELEGRAM_BOT.md`

---

## A. 功能清單（`main` 現況）

用手機 **Telegram** 傳文字，AI 自動判斷意圖並執行：

| 意圖 | 功能 | 備註 |
|------|------|------|
| `scrape` | 爬網頁 → OpenAI 摘要 → 直接回傳 | 含 URL；`SCRAPE_MODE=inline`（預設）或 `n8n` |
| `dev` | Cursor Agent 開發任務 | `DEV_RUNTIME=local`（本機）或 `cloud`（Production） |
| `ops` | 主機/服務查詢 | 見下方 ops action 表 |
| `github` | GitHub 唯讀查詢 | issues / PR 列表（**不含** create issue） |
| `chat` | OpenAI 閒聊 | 兜底意圖 |

### 指令

| 指令 | 說明 |
|------|------|
| `/start` | 歡迎訊息 |
| `/help` | 完整使用說明 |
| `/status` | 狀態、session、cloud repos、任務鎖 |
| `/cwd [路徑]` | 查看或切換開發目錄（local dev） |
| `/new` | 新開發 session |
| `/cancel` | 取消 dev / scrape / ops / github 進行中任務 |
| `/reset` | 緊急重置（清鎖、嘗試 cancel dev、重置 DB session） |

### ops 支援的 action

| action | 說明 | Production 預設 |
|--------|------|-----------------|
| `check_health` | HTTP 健康檢查（`OPS_HEALTH_URLS`） | ✅ 啟用 |
| `docker_ps` | 容器狀態 | ❌ `OPS_DOCKER_ENABLED=false` 時回友善停用訊息 |
| `tail_logs` | 容器日誌 tail | ❌ 同上 |
| `disk_usage` | 磁碟使用 | ❌ 停用（需 host 層查詢） |

### github 支援的 action（Phase 1 唯讀）

| action | 說明 |
|--------|------|
| `list_issues` | 列出 issues（`state`: open / closed / all） |
| `list_prs` | 列出 Pull Requests |

需設定 `GITHUB_TOKEN` + `GITHUB_ALLOWED_REPOS`（infra 端為 `TELEGRAM_GITHUB_*`）。

### dev runtime

| 模式 | 環境 | 說明 |
|------|------|------|
| `local` | 本機 polling | 讀 `DEFAULT_CWD` 工作區 |
| `cloud` | Production webhook | Cursor Cloud Agent；需 `CLOUD_REPOS` |

**護欄（Phase 0B）：** `TELEGRAM_MODE=webhook` 時必須 `DEV_RUNTIME=cloud`，否則啟動失敗。

### 技術棧

grammy + Express + SQLite + playwright-service + OpenAI + `@cursor/sdk` + GitHub REST API

---

## B. GH-4 進度（Issue #4）

| 項目 | 狀態 |
|------|------|
| Phase 0A：移除 docker.sock、Docker ops 預設停用 | ✅ merge `main` |
| Phase 0B：webhook 強制 cloud runtime 護欄 | ✅ `68e8fb9` |
| Phase 1：GitHub 唯讀查詢（issues / PR） | ✅ `68e8fb9` |
| 意圖路由：GitHub 關鍵字優先於 scrape | ✅ |
| Agent review（Bugbot 2 輪，發現項已修正） | ✅ |
| 測試 32 項全過、`npm run build` | ✅ |
| infra `TELEGRAM_GITHUB_*` 映射與文件 | ✅ infra `4ed6a91` |
| **遠端 deploy + Telegram 實測** | ⏳ **待做** |
| create issue（寫入） | ❌ 本輪範圍外 |

### Bugbot 修正摘要

- `inferIssueState` 子字串誤判、`Closed` 大小寫
- `GITHUB_DEV_OVERRIDE` 移除 `merge`（避免「merge request」誤走 dev）
- `/reset` 補上 GitHub pending 鎖回報
- `resolveAllowedRepo` 短名稱誤匹配與單一 allowlist 誤預設

---

## C. 遠端部署（⏳ 待做）

**等 GHCR build 完成後：**

```bash
# SSH web-ubuntu
cd ~/inwanding-infra
git pull

# 編輯 .env，補上：
# TELEGRAM_GITHUB_TOKEN=ghp_...
# TELEGRAM_GITHUB_ALLOWED_REPOS=Aiden4939/telegram-agent-bot
# TELEGRAM_GITHUB_ISSUE_LIMIT=10

docker compose pull telegram-playwright telegram-bot
docker compose up -d telegram-playwright telegram-bot
```

**驗證：**

- `/status`
- 「幫我看 telegram-agent-bot 有哪些 open issue」
- 「幫我看現在服務是否健康」

詳見 `inwanding-infra/docs/DEPLOY_TELEGRAM_BOT.md`。

---

## D. 本機開發

```bash
git clone git@github.com:Aiden4939/telegram-agent-bot.git
cd telegram-agent-bot
cp .env.example .env
# 填入 token、OpenAI、CURSOR_API_KEY、GITHUB_* 等（勿 commit .env）

npm install
npm rebuild better-sqlite3   # 換 Node 版本後

# 終端 1：playwright
cd playwright-service && npm install && npx playwright install chromium
node ./node_modules/tsx/dist/cli.mjs watch src/index.ts

# 終端 2：bot
cd ..
node ./node_modules/tsx/dist/cli.mjs watch src/index.ts
```

### 關鍵 `.env`（本機）

```
TELEGRAM_BOT_TOKEN=...
ALLOWED_TELEGRAM_USER_IDS=...
OPENAI_API_KEY=...
INTERNAL_API_SECRET=...
CURSOR_API_KEY=...
DEFAULT_CWD=/path/to/inwanding
INTENT_ROUTER=llm
SCRAPE_MODE=inline
GITHUB_TOKEN=...                    # 選填，測試 github 意圖
GITHUB_ALLOWED_REPOS=owner/repo
# 本機不要設 TELEGRAM_MODE=webhook
```

**同一 bot token 只能一邊生效：** 本機 polling、遠端 webhook，勿同時跑。

---

## E. 重要檔案地圖

```
src/
  services/botHandler.ts         # 指令、訊息路由、各意圖 handler
  services/agentOrchestrator.ts  # Cursor SDK（local / cloud）
  services/llmIntentRouter.ts    # 意圖分類（LLM + rules fallback）
  services/intentRouter.ts       # rules 意圖分類
  services/opsPlanner.ts         # ops 自然語言 → action
  services/opsExecutor.ts        # ops 白名單執行器
  services/githubPlanner.ts      # GitHub 自然語言 → action
  services/githubExecutor.ts     # GitHub REST API
  services/forceReset.ts         # /reset 緊急重置
  config/validateEnv.ts          # Production runtime 護欄
  config/env.ts                  # 環境變數
  config/helpText.ts             # /help 文案
playwright-service/              # 網頁抓取 :3100
Dockerfile
.github/workflows/docker.yml     # GHCR 建置
docs/NEXT_SESSION.md             # 本檔
```

---

## F. Git 近期 commit（`main`）

| Commit | 說明 |
|--------|------|
| `68e8fb9` | feat #4: Phase 0B 護欄與 GitHub 唯讀查詢 |
| `3714d3c` | feat #no-issue: 區分 Docker ops 停用與 CLI 不可用訊息 |
| `8a09067` | feat #no-issue: Phase 0A 移除 Bot Docker Socket 依賴 |

---

## G. 事故紀錄（2026-06-23，webhook crash loop）

webhook 模式下 dev 任務同步 await 超過 10 秒 → process crash → session 卡 `running`。

**已修正：** 背景化 handler、`onTimeout: "return"`、啟動回收殭屍 session、`/reset` 緊急重置。

手動恢復（部署修正前曾用過）：

```bash
docker exec svc-telegram-bot sqlite3 /app/data/bot.db \
  "UPDATE telegram_sessions SET status='idle', agent_id=NULL, updated_at=datetime('now') WHERE status='running';"
docker compose restart telegram-bot
```

---

## H. 尚未完成 / 後續可選

- [ ] **遠端 deploy GH-4 image + `.env` 實測**（見上方 C 節）
- [ ] GitHub create issue / PR 操作（寫入，需新 phase）
- [ ] Ops Gateway（高風險操作安全通道）
- [ ] `RUN_TIMEOUT_MS` 程式端強制逾時（env 已定義）
- [ ] ops Phase 2：restart/deploy 二次確認

---

## I. 一句話交接

**GH-4 程式與 infra 設定已完成並 push `main`；Bugbot review 已做且修正。** 下一步只剩 **web-ubuntu 部署**：`git pull`、補 `TELEGRAM_GITHUB_*`、等 GHCR build、`docker compose pull/up`、Telegram 驗證 GitHub 查詢。
