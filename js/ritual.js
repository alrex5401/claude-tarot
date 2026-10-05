/* 仆洛宅塔羅・翻牌儀式模組（網站 public/ 與 app/www/ 共用）
 *
 * 🔒 正本只有這一份：Tarot/ritual/ritual.js。兩邊的 js/ritual.js 由 Tarot/ritual/sync.py 複製，不要直接改副本。
 * 計劃書：000_Agent/plans/2026-10-04-塔羅翻牌儀式.md
 *
 * 硬約束：儀式只管「畫面上怎麼抽、怎麼翻」。交回頁面的抽牌陣列一個位置都不動
 * （spreads.html 的結果渲染、app 的 AI 解讀、心態牌標記都靠陣列順序推牌位）。
 * 筆記的順序（心態牌最先選、二擇一先過程後結果、心態牌最後翻）只用在畫面上。
 */
(function () {
  'use strict';

  // ===== 版面資料：陣列 index → 格位，以及畫面上的抽牌／翻牌順序 =====
  // 只放版面，不放牌位名稱（二擇一的名稱是使用者自訂的，一律讀 draws[i].position）。
  function layout(spread, nChoices) {
    const cells = [];
    let main = [];      // 主牌位的陣列 index，依筆記編號
    let bottom = null;  // 心態牌的陣列 index

    if (spread === 'single' || spread === 'daily') {
      cells.push({ index: 0, row: 0, col: 0 });
      main = [0];
    } else if (spread === 'three') {
      [0, 1, 2].forEach((i) => cells.push({ index: i, row: 0, col: i }));
      main = [0, 1, 2];
    } else if (spread === 'awareness' || spread === 'timeflow') {
      const n = spread === 'awareness' ? 2 : 3;
      for (let i = 0; i < n; i++) cells.push({ index: i, row: 0, col: i });
      main = Array.from({ length: n }, (_, i) => i);
      bottom = n;
      cells.push({ index: bottom, row: 1, col: 0 });
    } else if (spread === 'choices') {
      const n = nChoices === 3 ? 3 : 2;
      // 陣列是現行交錯順序：0 現況、1+2i 第 i 個選擇的過程、2+2i 第 i 個選擇的結果、最後是心態牌
      cells.push({ index: 0, row: 0, col: 0 });
      const procs = [];
      const results = [];
      for (let i = 0; i < n; i++) {
        procs.push(1 + i * 2);
        results.push(2 + i * 2);
        cells.push({ index: 1 + i * 2, row: 1, col: i });
        cells.push({ index: 2 + i * 2, row: 2, col: i });
      }
      main = [0].concat(procs, results); // 筆記：1 現況／2–4 各選擇的過程／5–7 各選擇的結果
      bottom = 1 + n * 2;
      cells.push({ index: bottom, row: 3, col: 0 });
    } else {
      throw new Error('未知的牌陣：' + spread);
    }

    const drawOrder = bottom === null ? main.slice() : [bottom].concat(main);
    const revealOrder = bottom === null ? main.slice() : main.concat([bottom]);
    return { cells, drawOrder, revealOrder, bottomIndex: bottom };
  }

  // ===== 樣式：純 CSS、不用 Tailwind class（計劃書定案：模組複製到兩邊都要能獨立運作） =====
  // touch-action:manipulation：選牌要連點同一區，iOS 會把它當成「點兩下放大」、整個牌陣放大偏移（2026-10-05 實機）；
  // 只關點兩下放大、雙指縮放照常可用。
  const CSS = `
.tr-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;touch-action:manipulation;
  overflow-y:auto;padding:16px 16px 24px;box-sizing:border-box;color:#F5F0FA;font-family:'Noto Serif TC',serif;
  background-color:#1A0B2E;background-image:linear-gradient(135deg,#1A0B2E 0%,#3D1F5F 50%,#1A0B2E 100%)}
.tr-overlay *{box-sizing:border-box}
.tr-top{width:100%;max-width:640px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.tr-title{font-size:18px;margin:0}
.tr-skip{background:transparent;border:1px solid rgba(255,255,255,.25);color:#9F8AB8;border-radius:999px;
  padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}
.tr-hint{min-height:1.6em;margin:14px 0 10px;color:#E8C547;font-size:15px;text-align:center}
.tr-spread{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:640px}
.tr-row{display:flex;justify-content:center;gap:10px;width:100%}
.tr-row.tr-row-bottom{margin-top:6px}
.tr-slot{display:flex;flex-direction:column;align-items:center;gap:4px;width:var(--tr-w);flex:0 0 auto}
.tr-label{font-size:11px;line-height:1.3;color:#9F8AB8;text-align:center;min-height:1.3em;word-break:break-all}
.tr-card{position:relative;width:var(--tr-w);height:calc(var(--tr-w) * 1.67);perspective:800px}
.tr-empty{position:absolute;inset:0;border:1px dashed rgba(232,197,71,.35);border-radius:6px}
.tr-flipper{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .55s ease;opacity:0}
.tr-slot.is-placed .tr-flipper{opacity:1}
.tr-slot.is-revealed .tr-flipper{transform:rotateY(180deg)}
.tr-back,.tr-face{position:absolute;inset:0;border-radius:6px;backface-visibility:hidden;-webkit-backface-visibility:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.35)}
.tr-face{transform:rotateY(180deg);overflow:hidden;background:#F5F0FA}
.tr-face img{width:100%;height:100%;object-fit:cover;display:block}
.tr-face.tr-reversed img{transform:rotate(180deg)}
.tr-plain{background:repeating-linear-gradient(45deg,rgba(232,197,71,.07) 0 1px,transparent 1px 10px),
  repeating-linear-gradient(-45deg,rgba(232,197,71,.07) 0 1px,transparent 1px 10px),#2A1546;
  border:1px solid rgba(232,197,71,.55)}
.tr-plain::before{content:"";position:absolute;inset:5px;border:1px solid rgba(232,197,71,.35);border-radius:4px}
.tr-plain::after{content:"✦";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#E8C547;
  font-size:calc(var(--tr-w) * .22);opacity:.8}
.tr-stage{width:100%;max-width:640px;display:flex;flex-direction:column;align-items:center;margin-top:16px}
.tr-deck{position:relative;width:84px;height:140px;margin:8px 0 18px}
.tr-deck .tr-plain{position:absolute;inset:0;border-radius:6px;animation:tr-shuffle 1s ease-in-out infinite}
.tr-deck .tr-plain:nth-child(2){animation-delay:.15s}
.tr-deck .tr-plain:nth-child(3){animation-delay:.3s}
@keyframes tr-shuffle{0%,100%{transform:translateX(0) rotate(0)}30%{transform:translateX(-26px) rotate(-6deg)}
  60%{transform:translateX(24px) rotate(5deg)}}
.tr-fan{display:flex;width:100%;overflow-x:auto;padding:18px 8px 12px;-webkit-overflow-scrolling:touch}
.tr-pick{flex:0 0 auto;width:56px;height:94px;border-radius:6px;position:relative;margin-left:-30px;cursor:pointer;
  transition:transform .2s ease;padding:0;font:inherit}
.tr-pick:first-child{margin-left:0}
.tr-pick:hover,.tr-pick:focus-visible{transform:translateY(-10px);outline:none;box-shadow:0 0 18px rgba(232,197,71,.45)}
.tr-btn{margin-top:14px;background:#E8C547;color:#1A0B2E;border:0;border-radius:999px;padding:10px 28px;
  font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.tr-btn[hidden]{display:none}
`;

  function injectCss() {
    if (document.getElementById('tr-style')) return;
    const s = document.createElement('style');
    s.id = 'tr-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const FAN_COUNT = 24;      // 整排牌背的張數（只是讓人點的，背後是哪張牌早就定了）
  const PLACE_MS = 260;      // 自己抽：蓋牌依序擺上去的間隔
  const REVEAL_MS = 650;     // 每張翻牌的間隔（比 .tr-flipper 的 transition 稍長）

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 牌寬同時受寬與高限制：整個牌陣加上下方的牌背列與按鈕，要在一個畫面內放得下、不必捲動
  const CHROME_H = 270;  // 上方列＋提示＋下方牌背列／按鈕的高度
  function cardWidth(maxCols, rows) {
    const vw = Math.min(window.innerWidth || 640, 640) - 32;
    const byW = Math.floor((vw - (maxCols - 1) * 10) / maxCols);
    const vh = window.innerHeight || 800;
    const byH = Math.floor(((vh - CHROME_H) / rows - 28) / 1.67); // 28＝名稱一行＋列間距
    return Math.max(40, Math.min(byW, byH, 96));
  }

  // 用 setTimeout 等待、不等 animationend：全域 reduced-motion 規則會讓動畫事件永遠不觸發
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  let active = null; // { overlay, finish }

  function run(opts) {
    // 淺複本：每筆是新物件、內容與順序相同（card 仍指向同一張牌物件）。之後頁面怎麼變都不影響；
    // 呼叫端不要用 === 比對交回的物件。
    const draws = opts.draws.map((d) => Object.assign({}, d));
    // 測試開關與「減少動態效果」：整段不顯示、直接交回
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.__tarotSkipRitual || reduce) return Promise.resolve(draws);
    // 已在進行：丟例外。不可回 null —— null 是「被取消」的專用訊號，頁面看到會靜默不出結果
    if (active) return Promise.reject(new Error('翻牌儀式已在進行中'));
    injectCss();
    const lay = layout(opts.spread, opts.nChoices);

    return new Promise((resolve, reject) => {
      const prevOverflow = document.body.style.overflow;
      const prevFocus = document.activeElement;
      const overlay = el('div', 'tr-overlay');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', '翻牌儀式');

      let done = false;
      function finish(result) {
        if (done) return;
        done = true;
        overlay.remove();
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', onKey);
        active = null;
        if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') {
          prevFocus.focus({ preventScroll: true });
        }
        resolve(result);
      }
      // Esc＝略過動畫；Tab 只在儀式畫面內打轉（背景頁被蓋住，不該拿得到焦點）
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(draws); return; }
        if (e.key !== 'Tab') return;
        const items = Array.from(overlay.querySelectorAll('button')).filter((b) => !b.hidden);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
      active = { overlay, finish };
      document.addEventListener('keydown', onKey);
      try {

      // --- 上方列 ---
      const top = el('div', 'tr-top');
      top.appendChild(el('h2', 'tr-title', '翻牌'));
      const skip = el('button', 'tr-skip', '略過動畫');
      skip.type = 'button';
      skip.addEventListener('click', () => finish(draws));
      top.appendChild(skip);
      overlay.appendChild(top);
      const hint = el('p', 'tr-hint');
      hint.setAttribute('aria-live', 'polite');
      overlay.appendChild(hint);

      // --- 牌陣格位 ---
      const maxRow = Math.max(...lay.cells.map((c) => c.row));
      const maxCols = Math.max(...lay.cells.map((c) => c.col)) + 1;
      overlay.style.setProperty('--tr-w', cardWidth(maxCols, maxRow + 1) + 'px');
      const spreadEl = el('div', 'tr-spread');
      const slots = {};
      for (let r = 0; r <= maxRow; r++) {
        const row = el('div', 'tr-row' + (lay.cells.some((c) => c.row === r && c.index === lay.bottomIndex) ? ' tr-row-bottom' : ''));
        row.dataset.row = String(r);
        lay.cells.filter((c) => c.row === r).sort((a, b) => a.col - b.col).forEach((c) => {
          const d = draws[c.index];
          const slot = el('div', 'tr-slot');
          slot.dataset.index = String(c.index);
          const card = el('div', 'tr-card');
          card.appendChild(el('div', 'tr-empty'));
          const flipper = el('div', 'tr-flipper');
          flipper.appendChild(el('div', 'tr-back tr-plain'));
          const face = el('div', 'tr-face' + (d.reversed ? ' tr-reversed' : ''));
          const img = document.createElement('img');
          img.src = d.card.image;
          img.alt = d.card.name_zh;
          face.appendChild(img);
          flipper.appendChild(face);
          card.appendChild(flipper);
          slot.appendChild(card);
          slot.appendChild(el('div', 'tr-label', d.position || ''));
          row.appendChild(slot);
          slots[c.index] = slot;
        });
        spreadEl.appendChild(row);
      }
      overlay.appendChild(spreadEl);

      const stage = el('div', 'tr-stage');
      overlay.appendChild(stage);
      const flipBtn = el('button', 'tr-btn tr-flip', '翻牌');
      flipBtn.type = 'button';
      flipBtn.hidden = true;
      const doneBtn = el('button', 'tr-btn tr-done', '看結果');
      doneBtn.type = 'button';
      doneBtn.hidden = true;
      doneBtn.addEventListener('click', () => finish(draws));
      overlay.appendChild(flipBtn);
      overlay.appendChild(doneBtn);

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      let placeSeq = 0;
      function place(index) {
        const slot = slots[index];
        slot.dataset.placeSeq = String(placeSeq++);
        slot.classList.add('is-placed');
      }
      function labelOf(index) {
        return draws[index].position || '';
      }

      async function reveal() {
        flipBtn.hidden = true;
        hint.textContent = '';
        for (let k = 0; k < lay.revealOrder.length; k++) {
          if (done) return;
          const slot = slots[lay.revealOrder[k]];
          slot.dataset.revealSeq = String(k);
          slot.classList.add('is-revealed');
          await wait(REVEAL_MS);
        }
        if (done) return;
        doneBtn.hidden = false;
        doneBtn.focus({ preventScroll: true });
      }
      flipBtn.addEventListener('click', reveal);

      function readyToFlip() {
        stage.innerHTML = '';
        hint.textContent = '全部就位，依序翻開。';
        flipBtn.hidden = false;
        flipBtn.focus({ preventScroll: true });
      }

      if (opts.drawMode === 'manual') {
        // 自己抽：實體牌已經抽好，蓋著依筆記順序擺上去
        hint.textContent = '把你抽到的牌蓋著擺上去……';
        skip.focus({ preventScroll: true });
        (async () => {
          for (const idx of lay.drawOrder) {
            if (done) return;
            place(idx);
            await wait(PLACE_MS);
          }
          if (!done) readyToFlip();
        })();
      } else {
        // 隨機抽：洗牌 → 喊停 → 從整排牌背依序點選
        hint.textContent = '心裡想著你的問題，準備好了就按「停」。';
        const deck = el('div', 'tr-deck');
        for (let i = 0; i < 3; i++) deck.appendChild(el('div', 'tr-plain'));
        const stop = el('button', 'tr-btn tr-stop', '停');
        stop.type = 'button';
        stage.appendChild(deck);
        stage.appendChild(stop);
        stop.addEventListener('click', () => {
          stage.innerHTML = '';
          const fan = el('div', 'tr-fan');
          for (let i = 0; i < FAN_COUNT; i++) {
            const b = el('button', 'tr-pick tr-plain');
            b.type = 'button';
            b.setAttribute('aria-label', '選這張牌');
            fan.appendChild(b);
          }
          stage.appendChild(fan);
          let k = 0;
          const ask = () => {
            const idx = lay.drawOrder[k];
            const name = idx === lay.bottomIndex ? '心態牌（蓋著放到最下方）' : (labelOf(idx) || '這一張');
            hint.textContent = `選第 ${k + 1} 張：${name}`;
          };
          ask();
          fan.addEventListener('click', (e) => {
            const b = e.target.closest('.tr-pick');
            if (!b || k >= lay.drawOrder.length) return;
            const next = b.previousElementSibling || b.nextElementSibling;
            b.remove();
            place(lay.drawOrder[k]);
            k++;
            if (k < lay.drawOrder.length) {
              ask();
              if (next) next.focus({ preventScroll: true }); // 鍵盤使用者不必每抽一張就從頭 Tab
            } else readyToFlip();
          });
        });
        stop.focus({ preventScroll: true });
      }
      } catch (err) {
        // 建畫面途中出錯：收掉半個畫面、清掉 active 再丟出去（頁面會退回直接出結果）。
        // 不清 active 的話，之後每一輪 run 都會被當成「已在進行」，抽牌鈕永久失效。
        done = true;
        overlay.remove();
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', onKey);
        active = null;
        reject(err);
      }
    });
  }

  // 取消：同步移除畫面（不做退場動畫：app 的 Siri 路徑接著要捲動到結果區），交回 null。
  // 只有 app index.html 的 consumeSiriDraw 在拿到 Siri 牌之後呼叫。
  function cancel() {
    if (active) active.finish(null);
  }

  window.TarotRitual = { layout, run, cancel };
})();
