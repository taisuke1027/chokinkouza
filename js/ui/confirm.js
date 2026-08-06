/**
 * confirm.js — アプリ内の確認ダイアログ
 * ブラウザネイティブのconfirm()はプレビュー環境（サンドボックス化されたiframe等）で
 * ブロックされることがあるため、アプリのデザインに沿った確認オーバーレイを自前で用意する。
 */
const ConfirmDialog = {
  /**
   * @param {string} message 確認メッセージ
   * @param {function} onConfirm 「削除」等を選んだ時に呼ばれるコールバック
   * @param {object} opts { confirmLabel, cancelLabel, danger }
   */
  show(message, onConfirm, opts = {}) {
    const confirmLabel = opts.confirmLabel || "削除する";
    const cancelLabel = opts.cancelLabel || "キャンセル";
    const root = document.getElementById("overlayRoot");

    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:center;">
          <div class="edit-sheet-title">確認</div>
          <div class="edit-sheet-sub" style="margin-bottom:18px;">${message}</div>
          <div class="edit-actions">
            <button class="btn-primary ${opts.danger !== false ? "btn-danger-fill" : ""}" id="confirmYesBtn">${confirmLabel}</button>
            <button class="btn-secondary" id="confirmNoBtn">${cancelLabel}</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("confirmNoBtn").addEventListener("click", () => overlay.remove());
    document.getElementById("confirmYesBtn").addEventListener("click", () => {
      overlay.remove();
      onConfirm();
    });
  }
};
