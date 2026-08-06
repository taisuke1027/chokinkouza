/**
 * record.js — 運動記録画面（20章）
 * ① 複数の運動を「追加予定の運動」リストに積み上げてから、まとめて1回で記録できる
 * ② 事前登録した「運動メニュー」（複数種目をまとめたもの）をタップするだけで
 *    そのままリストに反映できる
 */
const RecordView = {
  state: {
    category: "cardio",
    exerciseId: "walking",
    cardioInputMode: "speed", // "speed" | "distance"
    recordDate: null,         // 記録する日付（YYYY-MM-DD）。未設定なら今日
    queue: [],                // 追加予定の運動リスト
    queueCounter: 0,
  },

  render() {
    const templates = Storage.getTemplates();
    const hasQueue = this.state.queue.length > 0;
    if (!this.state.recordDate) this.state.recordDate = todayStr();

    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">運動を記録する</h2>

        <div class="card">
          <div class="section-label">追加予定の運動${hasQueue ? `（${this.state.queue.length}件）` : ""}</div>
          <div class="queue-box ${hasQueue ? "" : "empty"}" id="queueBox">
            ${hasQueue
              ? this.state.queue.map(item => this.renderQueueRow(item)).join("")
              : `<div class="queue-empty-text">運動を追加してください</div>`}
          </div>
          ${hasQueue ? `<button class="btn-text" id="saveTemplateBtn">${icon("save", { size: 14 })} よく使うメニューとして保存</button>` : ""}
        </div>

        ${hasQueue ? `<button class="btn-primary" id="submitBtn" style="margin-bottom:20px;">記録する</button>` : ""}

        <div class="field-group">
          <label>記録する日付</label>
          <input type="date" id="recordDateInput"
            value="${this.state.recordDate}"
            max="${todayStr()}" min="${AppState.season.startDate.slice(0, 10)}" />
        </div>

        ${templates.length > 0 ? `
          <div class="section-label">登録メニュー</div>
          <div class="template-chip-row" id="templateChipRow">
            ${templates.map(t => `
              <button class="template-chip" data-tid="${t.id}">
                <span>${icon("clipboard", { size: 15 })}</span>
                <span>${t.name}</span>
                <span class="small-muted" style="margin-left:2px;">（${t.items.length}件）</span>
                <span class="template-chip-remove" data-remove-tid="${t.id}">✕</span>
              </button>
            `).join("")}
          </div>
        ` : ""}

        <div class="section-label">種類を選んで追加</div>
        <div class="category-square-row" id="categorySquareRow">
          <button class="category-square" data-cat="cardio">
            <span class="cs-icon">${icon("pulse", { size: 26 })}</span>
            <span class="cs-label">有酸素</span>
          </button>
          <button class="category-square" data-cat="strength">
            <span class="cs-icon">${icon("dumbbell", { size: 26 })}</span>
            <span class="cs-label">筋トレ</span>
          </button>
        </div>
      </div>
    `);
  },

  renderQueueRow(item) {
    const iconName = item.category === "cardio" ? "pulse" : "dumbbell";
    return `
      <div class="ledger-entry">
        <div class="le-left">
          <div class="le-icon">${icon(iconName, { size: 16 })}</div>
          <div>
            <div class="le-name">${item.exerciseDef.name}</div>
            <div class="le-sub">${item.summary}</div>
          </div>
        </div>
        <button class="queue-remove" data-remove-queue="${item.localId}">✕</button>
      </div>
    `;
  },

  renderFields(exDef) {
    if (exDef.inputType === "cardio_speed") {
      const mode = this.state.cardioInputMode;
      return `
        <div class="segment-toggle" id="cardioInputModeToggle" style="justify-content:flex-start; margin:0 0 12px; gap:6px;">
          <button data-mode="speed" class="${mode === "speed" ? "active" : ""}" style="padding:7px 16px; font-size:12.5px;">時速で入力</button>
          <button data-mode="distance" class="${mode === "distance" ? "active" : ""}" style="padding:7px 16px; font-size:12.5px;">距離で入力</button>
        </div>

        ${mode === "speed" ? `
          <div class="field-group">
            <label>速度（km/h）</label>
            <input type="number" inputmode="decimal" id="f_speed" placeholder="5.0" step="0.1" min="0" />
          </div>
        ` : `
          <div class="field-group">
            <label>距離（km）</label>
            <input type="number" inputmode="decimal" id="f_distance" placeholder="2.5" step="0.1" min="0" />
          </div>
          <div class="small-muted" style="margin:-6px 0 14px;">時間と距離から平均速度を自動計算します</div>
        `}

        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="f_duration" placeholder="30" min="1" />
        </div>

        <div class="field-group">
          <label>傾斜（%・任意）</label>
          <input type="number" inputmode="decimal" id="f_incline" placeholder="0" step="1" min="0" />
        </div>
      `;
    }
    if (exDef.inputType === "cardio_distance") {
      return `
        <div class="field-group">
          <label>距離（km）</label>
          <input type="number" inputmode="decimal" id="f_distance" placeholder="1.0" step="0.1" min="0" />
        </div>
        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="f_duration" placeholder="30" min="1" />
        </div>
      `;
    }
    if (exDef.inputType === "cardio_simple") {
      return `
        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="f_duration" placeholder="30" min="1" />
        </div>
      `;
    }
    return `
      <div class="field-row">
        <div class="field-group">
          <label>重量（kg）</label>
          <input type="number" inputmode="decimal" id="f_weight" placeholder="60" step="0.5" min="0" />
        </div>
        <div class="field-group">
          <label>回数</label>
          <input type="number" inputmode="numeric" id="f_repetitions" placeholder="10" min="1" />
        </div>
      </div>
      <div class="field-group">
        <label>セット数</label>
        <input type="number" inputmode="numeric" id="f_sets" placeholder="3" min="1" />
      </div>
    `;
  },

  afterRender() {
    document.getElementById("recordDateInput").addEventListener("change", (e) => {
      this.state.recordDate = e.target.value || todayStr();
    });

    document.getElementById("categorySquareRow").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn) return;
      ExercisePicker.show(btn.dataset.cat);
    });

    const templateRow = document.getElementById("templateChipRow");
    if (templateRow) {
      templateRow.addEventListener("click", (e) => {
        const removeBtn = e.target.closest("[data-remove-tid]");
        if (removeBtn) {
          ConfirmDialog.show("登録メニューから削除しますか？", () => {
            Storage.deleteTemplate(removeBtn.dataset.removeTid);
            showToast("メニューを削除しました");
            Router.refresh();
          }, { confirmLabel: "削除" });
          return;
        }
        const chip = e.target.closest("button[data-tid]");
        if (!chip) return;
        this.loadTemplate(chip.dataset.tid);
      });
    }

    const saveTemplateBtn = document.getElementById("saveTemplateBtn");
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener("click", () => {
        const items = [...this.state.queue];
        if (items.length === 0) {
          showToast("先に運動を追加してください");
          return;
        }
        TemplateSaveView.show(items);
      });
    }

    document.querySelectorAll("[data-remove-queue]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.removeQueue);
        this.state.queue = this.state.queue.filter(item => item.localId !== id);
        Router.refresh();
      });
    });

    document.getElementById("submitBtn")?.addEventListener("click", () => this.submitAll());
  },

  /** 登録メニュー（複数種目まとめて）を「追加予定の運動」リストへ反映する */
  loadTemplate(templateId) {
    const t = Storage.getTemplates().find(x => x.id === templateId);
    if (!t) return;
    let addedCount = 0;
    t.items.forEach(item => {
      const exerciseDef = EXERCISES[item.category] && EXERCISES[item.category].find(e => e.id === item.exerciseId);
      if (!exerciseDef) return;
      this.state.queueCounter += 1;
      this.state.queue.push({
        localId: this.state.queueCounter,
        exerciseDef,
        category: item.category,
        fields: item.fields,
        summary: this.summarize(item.category, item.fields),
      });
      addedCount += 1;
    });
    showToast(`「${t.name}」を追加予定の運動に反映しました（${addedCount}件）`);
    Router.refresh();
  },

  resetForm() {
    this.state.cardioInputMode = "speed";
    // 種目選択はそのまま維持し、入力欄だけ空にする（連続で似た運動を記録しやすくする）
  },

  summarize(category, fields) {
    return category === "cardio"
      ? `${fields.duration}分${fields.distance ? `・${fields.distance}km` : fields.speed ? `・時速${Number(fields.speed).toFixed(1)}km` : ""}`
      : `${fields.weight}kg × ${fields.repetitions}回 × ${fields.sets}set`;
  },

  /**
   * 現在フォームに入力されている内容から1件分のエントリを組み立てる。
   * @param {boolean} showErrors 入力不備時にトーストで知らせるかどうか
   */
  buildEntryFromForm(showErrors) {
    const category = this.state.category;
    const exerciseDef = EXERCISES[category].find(e => e.id === this.state.exerciseId);
    const fields = {};

    if (category === "cardio") {
      fields.duration = readNum("f_duration");
      if (!fields.duration || fields.duration <= 0) {
        if (showErrors) showToast("時間を入力してください");
        return null;
      }
      if (exerciseDef.inputType === "cardio_speed") {
        if (this.state.cardioInputMode === "distance") {
          const distance = readNum("f_distance");
          if (!distance || distance <= 0) {
            if (showErrors) showToast("距離を入力してください");
            return null;
          }
          fields.distance = distance;
          fields.speed = distance / (fields.duration / 60);
        } else {
          const speed = readNum("f_speed");
          if (!speed || speed <= 0) {
            if (showErrors) showToast("速度を入力してください");
            return null;
          }
          fields.speed = speed;
        }
        fields.incline = readNum("f_incline");
      } else if (exerciseDef.inputType === "cardio_distance") {
        const distance = readNum("f_distance");
        if (!distance || distance <= 0) {
          if (showErrors) showToast("距離を入力してください");
          return null;
        }
        fields.distance = distance;
        fields.speed = distance / (fields.duration / 60);
      }
    } else {
      fields.weight = readNum("f_weight");
      fields.repetitions = readNum("f_repetitions");
      fields.sets = readNum("f_sets") || 1;
      if (!fields.weight || !fields.repetitions) {
        if (showErrors) showToast("重量と回数を入力してください");
        return null;
      }
    }

    return { exerciseDef, category, fields, summary: this.summarize(category, fields) };
  },

  submitAll() {
    if (this.state.queue.length === 0) {
      showToast("記録する運動を追加してください");
      return;
    }

    const recordDate = this.state.recordDate || todayStr();

    const results = this.state.queue.map(entry => {
      const result = BptCalculator.processWorkout({
        exerciseDef: entry.exerciseDef,
        category: entry.category,
        inputFields: entry.fields,
        seasonId: AppState.season.id,
        userId: AppState.user.id,
        recordDate,
      });
      result.exerciseDef = entry.exerciseDef;
      return result;
    });

    AppState.season = Storage.getSeason(AppState.season.id);
    AppState.recomputeHabitScore();

    this.state.queue = [];
    this.state.recordDate = null; // 次回はまた「今日」から始める
    this.resetForm();

    ResultView.showBatch(results);
  },
};

function readNum(id) {
  const v = document.getElementById(id);
  if (!v || v.value === "") return null;
  return Number(v.value);
}
