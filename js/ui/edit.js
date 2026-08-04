/**
 * edit.js — 運動記録の編集オーバーレイ
 * 過去の入力内容を修正すると、資産（BPT）・資産推移・シーズン最高/最低・
 * 自己ベスト基準がすべて連動して再計算される。
 */
const EditRecordView = {
  show(record) {
    this._mode = null;
    const exerciseDef = [...EXERCISES.cardio, ...EXERCISES.strength].find(e => e.id === record.exerciseId);
    const root = document.getElementById("overlayRoot");

    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">記録を修正</div>
          <div class="edit-sheet-sub">${exerciseDef.name}</div>

          <div class="field-group">
            <label>日付</label>
            <input type="date" id="ef_date" value="${record.date.slice(0, 10)}"
              max="${todayStr()}" min="${AppState.season.startDate.slice(0, 10)}" />
          </div>

          <div id="editFieldsHost">${this.renderFields(exerciseDef, record)}</div>

          <div class="edit-actions">
            <button class="btn-primary" id="editSaveBtn">保存する</button>
            <button class="btn-secondary" id="editCancelBtn">キャンセル</button>
            <button class="btn-danger-text" id="editDeleteBtn">この記録を削除する</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("editCancelBtn").addEventListener("click", () => overlay.remove());

    this.wireModeToggle(exerciseDef, record);

    document.getElementById("editSaveBtn").addEventListener("click", () => {
      this.save(record, exerciseDef, overlay);
    });
    document.getElementById("editDeleteBtn").addEventListener("click", () => {
      ConfirmDialog.show("この記録を削除しますか？", () => {
        const result = BptCalculator.deleteWorkout(record.id);
        AppState.season = Storage.getSeason(AppState.season.id);
        AppState.recomputeHabitScore();
        overlay.remove();
        showToast(`記録を削除しました（${Fmt.signedBpt(result.delta.cardio + result.delta.strength + result.delta.endurance)} BPT）`);
        Router.refresh();
      }, { confirmLabel: "削除" });
    });
  },

  renderFields(exerciseDef, record) {
    if (exerciseDef.inputType === "cardio_speed") {
      const mode = this._mode || (record.distance ? "distance" : "speed");
      this._mode = mode;
      return `
        <div class="segment-toggle" id="editCardioModeToggle" style="justify-content:flex-start; margin:0 0 12px; gap:6px;">
          <button data-mode="speed" class="${mode === "speed" ? "active" : ""}" style="padding:7px 16px; font-size:12.5px;">時速で入力</button>
          <button data-mode="distance" class="${mode === "distance" ? "active" : ""}" style="padding:7px 16px; font-size:12.5px;">距離で入力</button>
        </div>

        ${mode === "speed" ? `
          <div class="field-group">
            <label>速度（km/h）</label>
            <input type="number" inputmode="decimal" id="ef_speed" value="${record.speed ?? ""}" step="0.1" min="0" />
          </div>
        ` : `
          <div class="field-group">
            <label>距離（km）</label>
            <input type="number" inputmode="decimal" id="ef_distance" value="${record.distance ?? ""}" step="0.1" min="0" />
          </div>
          <div class="small-muted" style="margin:-6px 0 14px;">時間と距離から平均速度を自動計算します</div>
        `}

        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="ef_duration" value="${record.duration ?? ""}" min="1" />
        </div>

        <div class="field-group">
          <label>傾斜（%・任意）</label>
          <input type="number" inputmode="decimal" id="ef_incline" value="${record.incline ?? ""}" step="1" min="0" />
        </div>
      `;
    }
    if (exerciseDef.inputType === "cardio_distance") {
      return `
        <div class="field-group">
          <label>距離（km）</label>
          <input type="number" inputmode="decimal" id="ef_distance" value="${record.distance ?? ""}" step="0.1" min="0" />
        </div>
        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="ef_duration" value="${record.duration ?? ""}" min="1" />
        </div>
      `;
    }
    if (exerciseDef.inputType === "cardio_simple") {
      return `
        <div class="field-group">
          <label>時間（分）</label>
          <input type="number" inputmode="numeric" id="ef_duration" value="${record.duration ?? ""}" min="1" />
        </div>
      `;
    }
    return `
      <div class="field-row">
        <div class="field-group">
          <label>重量（kg）</label>
          <input type="number" inputmode="decimal" id="ef_weight" value="${record.weight ?? ""}" step="0.5" min="0" />
        </div>
        <div class="field-group">
          <label>回数</label>
          <input type="number" inputmode="numeric" id="ef_repetitions" value="${record.repetitions ?? ""}" min="1" />
        </div>
      </div>
      <div class="field-group">
        <label>セット数</label>
        <input type="number" inputmode="numeric" id="ef_sets" value="${record.sets ?? ""}" min="1" />
      </div>
    `;
  },

  wireModeToggle(exerciseDef, record) {
    const modeToggle = document.getElementById("editCardioModeToggle");
    if (!modeToggle) return;
    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      this._mode = btn.dataset.mode;
      document.getElementById("editFieldsHost").innerHTML = this.renderFields(exerciseDef, record);
      this.wireModeToggle(exerciseDef, record);
    });
  },

  save(record, exerciseDef, overlay) {
    const fields = {};
    if (record.category === "cardio") {
      fields.duration = readNum("ef_duration");
      if (!fields.duration || fields.duration <= 0) { showToast("時間を入力してください"); return; }

      if (exerciseDef.inputType === "cardio_speed") {
        if (this._mode === "distance") {
          const distance = readNum("ef_distance");
          if (!distance || distance <= 0) { showToast("距離を入力してください"); return; }
          fields.distance = distance;
          fields.speed = distance / (fields.duration / 60);
        } else {
          const speed = readNum("ef_speed");
          if (!speed || speed <= 0) { showToast("速度を入力してください"); return; }
          fields.speed = speed;
        }
        fields.incline = readNum("ef_incline");
      } else if (exerciseDef.inputType === "cardio_distance") {
        const distance = readNum("ef_distance");
        if (!distance || distance <= 0) { showToast("距離を入力してください"); return; }
        fields.distance = distance;
        fields.speed = distance / (fields.duration / 60);
      }
    } else {
      fields.weight = readNum("ef_weight");
      fields.repetitions = readNum("ef_repetitions");
      fields.sets = readNum("ef_sets") || 1;
      if (!fields.weight || !fields.repetitions) { showToast("重量と回数を入力してください"); return; }
    }

    const dateInput = document.getElementById("ef_date");
    const newDateKey = dateInput && dateInput.value ? dateInput.value : null;

    const result = BptCalculator.editWorkout(record.id, fields, newDateKey);
    AppState.season = Storage.getSeason(AppState.season.id);
    AppState.recomputeHabitScore();

    overlay.remove();
    showToast(`記録を修正しました（${Fmt.signedBpt(result.deltaTotal)} BPT）`);
    Router.refresh();
  }
};

/** ledger-entry行を「タップで編集」できるようにする共通ヘルパー */
function bindEditableRecordRows(container, records) {
  container.querySelectorAll("[data-record-id]").forEach(rowEl => {
    rowEl.addEventListener("click", () => {
      const rec = records.find(r => r.id === rowEl.dataset.recordId);
      if (rec) EditRecordView.show(rec);
    });
  });
}
