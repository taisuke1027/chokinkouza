/**
 * template.js — 運動メニュー（テンプレート）保存オーバーレイ
 * 「追加予定の運動」リスト（＋現在入力中の内容）をまとめて、
 * ひとつの名前付きメニューとして保存する。
 */
const TemplateSaveView = {
  /**
   * @param {Array<{exerciseDef, category, fields, summary}>} items
   */
  show(items) {
    const root = document.getElementById("overlayRoot");
    const defaultName = items.length === 1 ? items[0].exerciseDef.name : "";

    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">メニューとして保存</div>
          <div class="edit-sheet-sub">${items.length}件の運動をまとめて登録します</div>

          <div class="calc-detail template-preview-list" style="margin-bottom:16px;">
            ${items.map(it => `
              <div class="cd-row"><span>${it.exerciseDef.name}</span><b>${it.summary}</b></div>
            `).join("")}
          </div>

          <div class="field-group">
            <label style="font-size:13.5px;">メニュー名</label>
            <input type="text" id="templateNameInput" class="template-name-input" placeholder="例: 毎朝ルーチン" value="${defaultName}" maxlength="20" />
          </div>

          <div class="edit-actions">
            <button class="btn-primary" id="templateSaveBtn">保存する</button>
            <button class="btn-secondary" id="templateCancelBtn">キャンセル</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("templateCancelBtn").addEventListener("click", () => overlay.remove());
    document.getElementById("templateSaveBtn").addEventListener("click", () => {
      const nameInput = document.getElementById("templateNameInput");
      const fallback = items.length === 1 ? items[0].exerciseDef.name : "マイメニュー";
      const name = (nameInput.value || "").trim().slice(0, 20) || fallback;
      const templateItems = items.map(it => ({
        category: it.category,
        exerciseId: it.exerciseDef.id,
        fields: it.fields,
      }));
      const template = Models.createTemplate(name, templateItems);
      Storage.addTemplate(template);
      overlay.remove();
      showToast("メニューを保存しました");
      Router.refresh();
    });
  }
};
