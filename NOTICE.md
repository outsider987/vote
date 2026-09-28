# 第三方資料與素材

本專案的程式碼以 [MIT 授權](LICENSE) 釋出。下列資料與素材不在 MIT 授權範圍內，仍依各自的來源與條款使用；轉用時請一併保留出處。

## 選舉資料

- `data/mayor-2022.json`、`data/council-2022.json`、`data/mayor-2022-towns.json`、`data/raw/`：整理自中央選舉委員會[選舉資料庫](https://db.cec.gov.tw/)（由 `scripts/` 的腳本產生）。
- 即時開票資料（`results.json`）與候選人資料（`candidates.json`）：取自中央選舉委員會開票網站與選舉資訊網站。

使用這些資料請標示「資料來源：中央選舉委員會」，並遵循中選會及[政府資料開放平臺](https://data.gov.tw/)的使用規範。本專案與中選會無任何關係，數字以中選會公告為準。

## 行政區界

`data/taiwan-atlas-counties-10t.json`、`data/taiwan-atlas-towns-10t.json`（與 `data/raw/` 中的同名檔）取自 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas)。該專案的圖資衍生自內政部的[鄉鎮市區界線](https://data.gov.tw/dataset/7441)與[村里界圖](https://data.gov.tw/dataset/7438)。taiwan-atlas 的授權如下：

```
MIT License

Copyright (c) 2020 Daniel Kao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 黨徽

`data/party-emblems/`：中國國民黨黨徽、民主進步黨黨旗中央圖樣、台灣民眾黨標誌，均取自維基共享資源，屬公有領域。每個檔案的原始網址見 `data/party-emblems/sources.json`。無黨籍與其他政黨以文字圓印表示，不使用其標誌。

## 字型與執行期套件

- 字型 Iansui、Noto Sans TC、Barlow Condensed 在執行時由 Google Fonts 載入（SIL Open Font License 1.1），本專案沒有附帶字型檔。
- three.js（MIT）、topojson-client（ISC）等套件透過 npm 安裝，授權見各套件。
