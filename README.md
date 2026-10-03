# 開票所

2026 年 11 月 28 日地方選舉的 3D 即時開票網站，涵蓋 22 席直轄市長、縣市長與 919 席直轄市議員、縣市議員。畫面就是開票所：每個縣市是一疊選票，高度等於已開出票數，頂層顏色是目前領先的政黨；計票板上的「正」字一筆一筆增加；當選時蓋上紅色「卜」字章。首頁在 2026 開票前顯示倒數與中選會登記名冊；2022 年結果重播另有測試網址。

本站非中選會官方網站，所有數字取自中央選舉委員會公開資料。

## 專案結構

npm workspaces monorepo，需要 Node 24、npm 11。

| 路徑 | 內容 |
|---|---|
| `apps/web` | 前端：Vite + TypeScript + three.js 靜態網站 |
| `apps/poller` | 後端：抓中選會開票網頁，輸出 `results.json`；也負責候選人名單匯入與本機模擬開票站（詳見 [apps/poller/README.md](apps/poller/README.md)） |
| `packages/shared` | 前後端共用的資料契約（`LiveResults`、`RaceTally`、`CandidateList`、22 縣市代碼） |
| `data/` | 2022 年真實結果、2026 年登記名冊、行政區 TopoJSON、黨徽等資料來源；`scripts/` 是產生這些檔案的 Python 腳本 |
| `drafts/` | 早期視覺草稿 A–H；H「開票所」是正式版的前身，保留作參考 |
| `PRODUCT.md`、`DESIGN.md` | 產品定位與視覺設計系統 |

## 開始

```sh
npm install
npm run dev            # http://127.0.0.1:5188/ 顯示 2026 倒數；重播加 ?source=replay
npm test               # 前端模型與 poller 的測試
npm run typecheck
npm run build          # 輸出 apps/web/dist/，可放任何靜態主機或 CDN
```

`npm run dev` 與 `npm run build` 會先把 `data/` 裡網站需要的檔案同步到 `apps/web/public/data/`（此資料夾不進版控）。

網站有三種版本：

| 網址 | 內容 |
|---|---|
| `/` | **2026 正式版**。開票前可依縣市與選區查閱登記名冊，倒數到 11 月 28 日 16:00；時間到後每 30 秒檢查資料，收到標記為 2026 的 `results.json` 才切換畫面。 |
| `/?source=replay` | **2022 開票重播**，用真實結果模擬整晚開票，測試與展示用。 |
| `/?source=live` | 強制進入即時模式，彩排用。非 2026 的資料會標示「彩排」。 |

加上 `countdown=秒數` 可以測試倒數：

- `/?countdown=10`：10 秒後倒數結束，進入「等待中選會第一筆資料」的狀態。
- `/?source=replay&countdown=10`：倒數 10 秒後開始 2022 開票重播，整段模擬選舉夜。

其他網址參數：

- `?mode=council`：開啟議員模式
- `?c=64000`：鎖定某縣市
- `?d=2`：選該縣市的第幾個選區
- `?t=0.6`：重播跳到 60% 並暫停
- `?intro=0`：略過開場
- `?poll=5`：即時模式每 5 秒更新，彩排用（預設 30 秒，範圍 5–120）

## 資料流程

```
中選會開票網頁（HTML，約 60 秒更新）
        │  apps/poller：條件式請求、限速、斷路器；解析失敗時保留上一筆正確資料
        ▼
results.json（packages/shared 的 LiveResults）
        │  scripts/publish-live.mjs：部署成 Cloudflare 的 vote-live Worker（約 10–20 秒）
        ▼
瀏覽器每 30 秒讀一次（ETag 重新驗證），不直接連中選會
```

觀眾的流量都由 Cloudflare 的 CDN 承擔。poller 只有一個，對中選會的請求量固定，不會隨觀看人數增加。

前端的資料來源層（`apps/web/src/model/`）有兩種實作，畫面程式只讀共同的 `RaceState`：

- **重播**（`replay.ts`）：依排程模擬開票，最後精確收斂到 2022 年真實結果。
- **即時**（`live.ts`）：把 `results.json` 對到畫面。候選人以號次對齊，當選以中選會的 ◎／● 註記為準，所以婦女保障名額也會正確顯示。開票途中，2022 年的選舉人數只用來估算紙堆高度，投票率要等開完票後才依中選會數字顯示。

## 本機彩排整條流程

開三個終端機：

```sh
npm run mock-cec -w @vote/poller -- --port 8787 --duration-ms 600000   # 10 分鐘內把 2022 年開完
npm run poll -w @vote/poller -- --config poller.mock.json               # 寫入 apps/poller/out/results.json
npm run dev                                                             # 開 http://127.0.0.1:5188/?source=live&poll=5
```

開發伺服器的 `/live/` 直接讀 `apps/poller/out/`（可用 `VOTE_LIVE_DIR` 改路徑），彩排資料不會進到正式建置。

`node scripts/publish-live.mjs --once --dry-run` 可驗證目前 `apps/poller/out/` 的 JSON 與 Wrangler 發布打包，不需 Cloudflare 憑證，也不會上傳；這一步不能代替正式網址的連線檢查。

## 選舉夜

時程：

- **目前（9/7 登記名冊）**：`data/registered-2026.json` 收錄 22 縣市的 81 位縣市長、1,502 位議員登記人，共 221 個議員選區。用 `python scripts/prepare_2026_registered.py` 從[中選會的四份登記名冊 PDF](https://web.cec.gov.tw/central/article/64733)重產；登記人尚待審定，沒有正式號次或照片，不會混進開票候選人名單。
- **候選人公開司法紀錄（卷宗）**：`data/records-2026.json` 取自台灣前進「民間版選舉公報」（CC BY 4.0，見 [NOTICE.md](NOTICE.md)），只收有罪判決與起訴中的刑事案件。來源更新後跑 `node scripts/prepare_2026_records.mjs` 重產再推上 main 部署；任何一人對不上登記名冊時腳本會失敗，要先人工確認。卷宗只在 2026 版（登記名冊與即時計票板）出現，2022 重播與彩排不顯示。
- **10/23 抽號次後、11/17 公告後**：
  - 各跑一次 `npm run import-candidates -w @vote/poller -- --config poller.config.json`，取得已審定候選人、號次與議員選區清單。縣市長正式名單預定 11/12 公告、議員 11/17 公告，以[中選會選務日程](https://www.cec.gov.tw/central/article/61722)為準。
  - 接著跑 `node scripts/publish-live.mjs --once` 發布 `candidates.json`；桌機計票板會列出候選人，手機倒數頁會顯示已公布人數。
- **約開票前一週**：中選會公布 2026 開票網站。
  - 把主機與代碼填進 `apps/poller/poller.config.json`。
  - 從台灣的機器跑 `npm run probe -w @vote/poller -- --config poller.config.json`，每一項都要通過。
- **11/28 開票當天**：
  - 16:00 前在台灣的機器上啟動 `npm run poll -w @vote/poller -- --config poller.config.json`。
  - 同一台機器另開 `node scripts/publish-live.mjs`，把結果持續發布到 Cloudflare。
  - 網站 16:00 倒數結束後會自動讀取，一收到 2026 的開票資料就切換成即時畫面。

## 部署（Cloudflare）

正式網站：https://kaipiao-4xj.pages.dev/ 。

網站與選舉夜資料分開部署：

| 服務 | 內容 | 誰來部署 |
|---|---|---|
| Pages 專案 `kaipiao` | 網站本身（`apps/web/dist`） | `npm run deploy:site`；push 到 `main` 時 `.github/workflows/deploy.yml` 會檢查與建置，設定 Cloudflare secrets 後也會部署 |
| Worker `vote-live` | 只有 `results.json` 與 `candidates.json`（`deploy/live/wrangler.jsonc`），網址 `https://vote-live.outsider987.workers.dev/` | 選舉夜由 `scripts/publish-live.mjs` 直接部署 |

兩者分開，程式與資料的部署就不會互相覆蓋。網站透過建置時的 `VITE_LIVE_URL` 讀取 `vote-live` 的資料。`vote-live` 是只有靜態檔的 Worker，請求免費且不限量。Pull request 另有 `ci.yml` 檢查。

- **帳號：** 與本人代管的其他專案同一個 Cloudflare 帳號。帳號的 `workers.dev` 子網域是 `outsider987`（2026-10-03 從原本的名稱改過來），所有 Worker 共用。部署腳本讀 `deploy/.env` 的 `CLOUDFLARE_ACCOUNT_ID`，每次部署都鎖定這個帳號；沒填 `CLOUDFLARE_API_TOKEN` 時改用本機 `wrangler login`。
- **第一次設定：**
  1. 把 `deploy/.env.example` 複製成 `deploy/.env`（不進版控），填入帳號 ID 和 `VITE_LIVE_URL`；本機已 `wrangler login` 時 token 可留空。
  2. 要讓 GitHub Actions 自動部署時，在這個帳號的 My Profile → API Tokens → Create Token 選 **Edit Cloudflare Workers** 範本（需含 Pages 編輯權限）。
  3. 在 GitHub repo 的 Settings → Secrets and variables → Actions 設定：
     - secrets `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`
     - variable `VITE_LIVE_URL`

  沒設 token 時，workflow 只會建置並提醒，不會部署。手動部署網站用 `npm run deploy:site`。
- **預設版本：** 平常不用設 repo 變數 `VITE_SOURCE`，網站就是 2026 正式版（倒數後自動即時）。選舉夜萬一即時資料出問題，可以先把首頁切回 2022 重播：

  ```sh
  VITE_SOURCE=replay npm run deploy:site
  ```

  問題排除後，不帶 `VITE_SOURCE` 再跑一次 `npm run deploy:site` 即可恢復。
- **選舉夜的即時資料：** `scripts/publish-live.mjs` 每 3 秒檢查一次 poller 的輸出。檔案一變，就把它部署成 `vote-live` 的靜態檔。實測從寫出檔案到上線約 10–20 秒。

  執行的機器需要同一份 `deploy/.env`。

免費額度：

- **流量：** 只有靜態檔的 Worker，請求與頻寬都不計費也不設上限（Cloudflare 官方：「Requests to static assets are free and unlimited」）。觀看人數再多都不會超額。
- **部署：** 沒有公布次數上限。選舉夜約每分鐘部署一次 `vote-live`。
- **檔案：** 每個 Worker 最多 20,000 個檔案、單檔 25 MiB。這個網站約 20 個檔案，最大不到 1 MB。
- **其他：** 不需要自己的網域。之後若想用自己的網域可以另外綁定，不影響額度。

即時模式下，頁尾會顯示中選會資料時間與投開票所回報進度；資料停止更新時會以來源時間標示延遲，手機版也會顯示。

2026 年議員改選 919 席。新竹縣、新竹市、基隆市、彰化縣與雲林縣的選區數有調整；其中竹北市分成兩區、新竹市改依村里劃分，所以這兩個縣市在縣市細節圖不沿用 2022 年的鄉鎮對應。正式 2026 開票網站尚未公布，因此目前可驗證資料契約、本機彩排與前端流程，實際頁面格式須在中選會上線後再以 `probe` 驗證。

## 授權

程式碼以 [MIT 授權](LICENSE) 開源，歡迎自由使用、修改、再散布。

選舉資料、行政區界與黨徽不在 MIT 範圍內，各有來源與條款，詳見 [NOTICE.md](NOTICE.md)。

- 選舉資料來自中央選舉委員會。
- 行政區界來自 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas)（MIT）。
- 黨徽取自維基共享資源，屬公有領域。
