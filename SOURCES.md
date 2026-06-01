# Sources / 資料來源

本 Skill 的牌義資料完全基於**公共領域**來源，並由作者以現代繁中重寫整理。

## 主要來源

### 1. Arthur Edward Waite — *The Pictorial Key to the Tarot* (1910)

A. E. Waite 撰寫的塔羅權威著作，與 Pamela Colman Smith 合作出版了當代最具影響力的 **Rider-Waite-Smith (RWS) 塔羅牌組**。

- 出版：London: Rider & Co., 1910
- 授權狀態：**全球公共領域**（出版超過 115 年）
- 可自由下載：[Project Gutenberg](https://www.gutenberg.org/) 或 [archive.org](https://archive.org/)

Waite 對每張牌提供：
- Divinatory Meanings（正位占卜含義）
- Reversed（逆位含義）
- Symbolism（象徵描述）

### 2. Pamela Colman Smith 1909 塔羅圖像

由 Pamela Colman Smith（1878-1951）繪製的 78 張塔羅牌圖像，業界俗稱 "Rider-Waite-Smith" 牌組（以原出版商 Rider & Co. 命名）。

- 出版：1909 年
- 授權狀態：美國自 1931 年前出版即進入公共領域；歐盟 / 英國 / 台灣於作者 1951 過世 + 70 年（即 2021 年）後進入公共領域
- **本專案圖像具體來源**：[Wikimedia Commons](https://commons.wikimedia.org/) 的 `RWS_Tarot_NN_*.jpg`（大阿）/ `Cups0N.jpg` / `Wands0N.jpg` / `Swords0N.jpg` / `Pents0N.jpg`（小阿）系列、Resize 至 500-wide
- **可重現驗證**（perceptual hash 比對、distance = 0 表完全同源）：
  ```python
  from PIL import Image
  import imagehash
  wm = Image.open(urlopen('https://upload.wikimedia.org/wikipedia/commons/9/90/RWS_Tarot_00_Fool.jpg'))
  local = Image.open('public/images/major-00-fool.jpg')
  assert imagehash.phash(wm) - imagehash.phash(local) == 0
  ```

### 「Rider-Waite」商標說明

"RIDER-WAITE®" 為 US Games Systems, Inc. 註冊商標（US Trademark Reg. No. 1,309,015）。本專案：
- 圖像本身為公共領域（Pamela Colman Smith 1909 / A.E. Waite 1942）
- 文案 / 行銷 / App 名稱皆不使用 "Rider-Waite" 商標
- 學術引用 "Rider-Waite-Smith" 為業界俗稱、屬指示性合理使用（nominative fair use）、非暗示官方授權

## 本 Skill 的加值

`cards.json` 中每張牌的以下欄位由作者重新整理：

- `upright_keywords`：根據 Waite 原文的 divinatory meanings，挑選 5 個常用現代繁中關鍵字
- `reversed_keywords`：同上，來自 Waite 的 reversed 段落
- `symbolism`：根據 Waite 的 symbolism 描述，以現代繁中重寫 1-2 句象徵詮釋

**這些內容均不直接引用任何現代版權塔羅著作**（如 Biddy Tarot、Labyrinthos、書市中各種現代塔羅手冊）。

## 延伸閱讀（非必要，但推薦）

對於想進一步理解 RWS 傳統的朋友，以下是公共領域或開放授權的資源：

- Waite, A. E. (1910). *The Pictorial Key to the Tarot.* — 原典
- Mathers, S. L. MacGregor (1888). *The Tarot: Its Occult Signification, Use in Fortune-Telling, and Method of Play.* — 更早的黃金黎明學派見解（公共領域）

## 非來源聲明

本 Skill **未使用**以下版權來源的任何內容：

- Biddy Tarot（biddytarot.com，Brigit Esselmont 著作權）
- Labyrinthos Academy（商業網站）
- Rachel Pollack 的《Tarot Wisdom》等現代塔羅書籍

## 貢獻

歡迎提出牌義改進建議。所有接受的貢獻將以 MIT License 納入本 Skill。請確保你提交的內容為原創或公共領域，不涉及第三方版權。
