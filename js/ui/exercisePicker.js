/**
 * exercisePicker.js — 種目選択→入力の2段階オーバーレイ
 * 記録画面の「有酸素」「筋トレ」ボタンから呼び出される。
 * RecordView の状態・フィールド描画・入力検証ロジックをそのまま再利用する。
 */
const ExercisePicker = {
  category: "cardio",

  show(category) {
    this.category = category;
    this.renderList();
  },

  renderList() {
    this.removeOverlay();
    const list = EXERCISES[this.category];
    const root = document.getElementById("overlayRoot");

    const overlay = el(`
      <div class="overlay" id="exercisePickerOverlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="flex-between" style="margin-bottom:10px;">
            <div class="edit-sheet-title" style="margin:0; display:flex; align-items:center; gap:6px;">${this.category === "cardio" ? icon("pulse", { size: 17 }) + " 有酸素運動を選ぶ" : icon("dumbbell", { size: 17 }) + " 筋トレ種目を選ぶ"}</div>
            <button class="picker-close-btn" id="epCloseBtn">✕</button>
          </div>
          <div class="picker-list">
            ${list.map(e => `
              <button class="picker-row" data-ex="${e.id}">
                <span>${e.name}</span>
                <span class="picker-row-chevron">›</span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    document.getElementById("epCloseBtn").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll("[data-ex]").forEach(btn => {
      btn.addEventListener("click", () => this.showInput(btn.dataset.ex));
    });
  },

  showInput(exerciseId) {
    RecordView.state.category = this.category;
    RecordView.state.exerciseId = exerciseId;
    RecordView.state.cardioInputMode = "speed";
    const exerciseDef = EXERCISES[this.category].find(e => e.id === exerciseId);

    this.removeOverlay();
    const root = document.getElementById("overlayRoot");

    const overlay = el(`
      <div class="overlay" id="exercisePickerOverlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">${exerciseDef.name}</div>
          <div class="edit-sheet-sub">記録内容を入力してください</div>

          <div id="epFieldsHost">${RecordView.renderFields(exerciseDef)}</div>

          <div class="edit-actions">
            <button class="btn-primary" id="epAddBtn">追加</button>
            <button class="btn-secondary" id="epBackBtn">戻る</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    this.wireModeToggle(exerciseDef);

    document.getElementById("epBackBtn").addEventListener("click", () => this.renderList());
    document.getElementById("epAddBtn").addEventListener("click", () => {
      const entry = RecordView.buildEntryFromForm(true);
      if (!entry) return;
      RecordView.state.queueCounter += 1;
      RecordView.state.queue.push({ ...entry, localId: RecordView.state.queueCounter });
      RecordView.resetForm();
      this.removeOverlay();
      showToast("リストに追加しました");
      Router.refresh();
      // 追加した内容がすぐ見えるよう、画面の先頭（追加予定の運動）まで戻す
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("mainView").scrollTop = 0;
    });
  },

  wireModeToggle(exerciseDef) {
    const modeToggle = document.getElementById("cardioInputModeToggle");
    if (!modeToggle) return;
    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      RecordView.state.cardioInputMode = btn.dataset.mode;
      document.getElementById("epFieldsHost").innerHTML = RecordView.renderFields(exerciseDef);
      this.wireModeToggle(exerciseDef);
    });
  },

  removeOverlay() {
    const existing = document.getElementById("exercisePickerOverlay");
    if (existing) existing.remove();
  }
};
