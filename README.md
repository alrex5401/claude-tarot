# Claude Tarot

塔羅牌解讀 Skill，供 Claude App（iOS / Android / Web）與 Claude Code（CLI）使用。

**你自己抽卡，AI 負責解讀。**

---

## 特色

- ✅ **三種模式**：單張問卜 / 三牌陣 / 每日能量
- ✅ **Rider-Waite-Smith 傳統**：牌義基於 Arthur Edward Waite《The Pictorial Key to the Tarot》(1910) 公共領域版，現代繁中重寫
- ✅ **78 張完整牌義庫**：22 大阿爾克納 + 56 小阿爾克納（權杖、聖杯、寶劍、錢幣）
- ✅ **無隨機邏輯**：你自己抽，AI 不碰隨機
- ✅ **開源可自由散布**：MIT License，可安心送朋友

---

## 安裝

### 方式一：Claude App / Web（推薦一般使用者）

1. 在 claude.ai 新建一個 **Project**
2. 上傳 `skill/tarot/` 整個資料夾（包含 `SKILL.md` 與 `cards.json`）
3. 在 Project 設定中將 `SKILL.md` 的內容貼到「Project instructions」欄位
4. 之後在這個 Project 內對話，Claude 就會按塔羅解讀師角色回應

### 方式二：Claude Code CLI（工程師）

```bash
# 1. 複製 SKILL.md 到 Claude Code commands 資料夾
mkdir -p ~/.claude/commands
cp skill/tarot/SKILL.md ~/.claude/commands/tarot.md

# 2. 複製 cards.json 到固定位置（或你喜歡的位置，再改 SKILL.md 路徑）
mkdir -p ~/.claude/data
cp skill/tarot/cards.json ~/.claude/data/tarot_cards.json

# 3. 編輯 ~/.claude/commands/tarot.md，把 `cards.json` 參照路徑
#    改成 `~/.claude/data/tarot_cards.json`（如有需要）
```

之後在 Claude Code 對話直接輸入 `/tarot ...` 即可使用。

---

## 使用範例

### 單張問卜
```
問題：這週該不該跟老闆談薪資？
牌：愚者（正位）
```

### 三牌陣問卜
```
問題：跟 A 的合作該不該繼續？
牌1（過去）：戰車（逆位）
牌2（現在）：聖杯五（正位）
牌3（未來）：世界（正位）
```

### 每日能量
```
/tarot daily 牌：愚者（正位）
心情：對今天的會議緊張
```

---

## 抽卡方式

本 Skill **不負責抽卡**。你可以：

- **實體牌組**：洗牌後從牌堆抽出你要的張數，以及判斷正位/逆位
- **抽卡 App**：Labyrinthos、Golden Thread、任何塔羅 App 都可以，只要能給你牌名 + 正/逆位

把抽到的牌名（繁中或英文都行）與正/逆位打字告訴 Claude 即可。

---

## 授權

- **Skill 內容（SKILL.md、cards.json 的現代繁中重寫）**：MIT License
- **來源資料**：
  - Arthur Edward Waite, *The Pictorial Key to the Tarot* (1910) — 公共領域
  - Rider-Waite-Smith 塔羅圖像 (1909) — 公共領域

詳細出處見 `SOURCES.md`。

---

## 回饋與貢獻

本 Skill 為個人專案，分享給朋友使用。如有建議或牌義可改進之處，歡迎聯絡作者。

塔羅是反映性工具，非預測工具。任何解讀僅供參考，不構成醫療、法律、財務建議。
