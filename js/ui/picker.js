/**
 * picker.js — リスト選択用のボトムシート
 * 「期間」「グラフ種類」など、複数の選択肢からひとつを選ばせるUIで共通利用する。
 */
const Picker = {
  show(title, options, currentKey, onSelect) {
    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left; padding-bottom:calc(26px + env(safe-area-inset-bottom, 0));">
          <div class="picker-title">${title}</div>
          <div class="picker-list">
            ${options.map(o => `
              <button class="picker-row ${o.key === currentKey ? "selected" : ""}" data-key="${o.key}">
                <span>${o.label}</span>
                ${o.key === currentKey ? '<span class="picker-check">✓</span>' : ""}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll(".picker-row").forEach(row => {
      row.addEventListener("click", () => {
        overlay.remove();
        onSelect(row.dataset.key);
      });
    });
  }
};
