/**
 * ledger.js — 履歴画面（②対応）
 * 月ごとのBPT「増加分」（獲得）と「減少分」（デトレーニングによる減少）を
 * 差し引きした収支を表示し、選択中の増加分/減少分の内訳を円グラフで見せる。
 * 日別の記録は複数選択して、まとめて日付を変更できる。
 */
const LedgerView = {
  state: { yearMonth: null, toggle: "income", selectMode: false, selectedIds: new Set() },

  colors: { cardio: "#6E8FAE", strength: "#A9803F", endurance: "#8FA678" },
  labels: { cardio: "心肺", strength: "筋力", endurance: "筋持久力" },
  icons: { cardio: icon("pulse", { size: 16 }), strength: icon("dumbbell", { size: 16 }), endurance: icon("repeat", { size: 15 }) },

  currentMonthStr() {
    return todayStr().slice(0, 7);
  },

  render() {
    if (!this.state.yearMonth) this.state.yearMonth = this.currentMonthStr();
    const agg = this.aggregateMonth(this.state.yearMonth);
    const { label, range } = this.monthLabelAndRange(this.state.yearMonth);

    const activeCategories = this.state.toggle === "income" ? agg.income : agg.expense;
    const activeTotal = this.state.toggle === "income" ? agg.incomeTotal : agg.expenseTotal;

    const segments = ["cardio", "strength", "endurance"].map(k => ({
      key: k, color: this.colors[k], value: activeCategories[k]
    }));
    const hasData = activeTotal > 0.5;

    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">履歴</h2>

        <div class="card">
          <div class="month-nav">
            <button id="prevMonthBtn">‹</button>
            <div class="month-label">
              <div class="y">${label}</div>
              <div class="range">${range}</div>
            </div>
            <button id="nextMonthBtn" ${this.state.yearMonth >= this.currentMonthStr() ? "disabled style=\"opacity:.3;\"" : ""}>›</button>
          </div>

          <div class="iose-row">
            <div class="iose-col"><div class="k">増加分</div><div class="v income num">${Fmt.bpt(agg.incomeTotal)}</div></div>
            <div class="iose-op-col"><div class="k" style="visibility:hidden;">-</div><div class="iose-op">－</div></div>
            <div class="iose-col"><div class="k">減少分</div><div class="v expense num">${Fmt.bpt(agg.expenseTotal)}</div></div>
            <div class="iose-op-col"><div class="k" style="visibility:hidden;">-</div><div class="iose-op">＝</div></div>
            <div class="iose-col"><div class="k">収支</div><div class="v balance num" style="color:${agg.balance >= 0 ? "var(--brass-deep)" : "var(--clay)"}">${Fmt.signedBpt(agg.balance)}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="segment-toggle" id="ioToggle">
            <button data-t="income" class="${this.state.toggle === "income" ? "active" : ""}">増加分</button>
            <button data-t="expense" class="${this.state.toggle === "expense" ? "active" : ""}">減少分</button>
          </div>

          ${hasData ? `
            ${ChartUI.renderPieWithLabels(
              segments.map(s => ({ ...s, label: this.labels[s.key] })),
              { centerLabel: { k: this.state.toggle === "income" ? "増加分" : "減少分", v: Fmt.bpt(activeTotal) } }
            )}
            <div style="margin-top:6px;">
              ${segments.map(s => this.renderCategoryRow(s, activeTotal)).join("")}
            </div>
          ` : `
            <div class="empty-state">
              <div class="icon">${this.state.toggle === "income" ? icon("leaf", { size: 26 }) : icon("smile", { size: 26 })}</div>
              <p>${this.state.toggle === "income" ? "この月はまだ運動記録がありません。" : "この月はデトレーニングによる減少がありませんでした。"}</p>
            </div>
          `}
        </div>

        <div class="card">
          <div class="flex-between">
            <div class="section-label" style="margin:0;">日別の記録</div>
            <button class="btn-text" id="selectModeToggleBtn" style="width:auto; padding:0; font-size:12.5px;">
              ${this.state.selectMode ? "完了" : "選択"}
            </button>
          </div>

          ${this.state.selectMode ? `
            <div class="flex-between select-action-bar">
              <span class="small-muted">${this.state.selectedIds.size}件選択中</span>
              <button class="btn-secondary" id="bulkDateChangeBtn" style="width:auto; padding:8px 14px; font-size:12.5px;" ${this.state.selectedIds.size === 0 ? "disabled" : ""}>${icon("calendar", { size: 14 })} 日付を変更</button>
            </div>
          ` : ""}

          <div style="margin-top:8px;">${this.renderDailyRecords(this.state.yearMonth)}</div>
        </div>
      </div>
    `);
  },

  renderDailyRecords(yearMonth) {
    const seasonIds = SeasonManager.getAllSeasons(AppState.user.id).map(s => s.id);
    const records = Storage.getWorkoutRecords()
      .filter(r => seasonIds.includes(r.seasonId) && r.date.slice(0, 7) === yearMonth)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (records.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("calendar", { size: 26 })}</div><p>この月の運動記録はまだありません。</p></div>`;
    }

    const groups = {};
    records.forEach(r => {
      const dateKey = r.date.slice(0, 10);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(r);
    });
    const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return dateKeys.map(dateKey => `
      <div class="day-group">
        <div class="day-group-label">${this.formatDayLabel(dateKey)}</div>
        ${groups[dateKey].map(r => this.renderRecordRow(r)).join("")}
      </div>
    `).join("");
  },

  formatDayLabel(dateKey) {
    const d = new Date(dateKey + "T00:00:00");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  },

  renderRecordRow(r) {
    const def = [...EXERCISES.cardio, ...EXERCISES.strength].find(e => e.id === r.exerciseId);
    const iconName = r.category === "cardio" ? "pulse" : "dumbbell";
    const sub = r.category === "cardio"
      ? `${r.duration ?? "-"}分`
      : `${r.weight ?? "-"}kg × ${r.repetitions ?? "-"}回 × ${r.sets ?? "-"}set`;

    if (this.state.selectMode) {
      const isSelected = this.state.selectedIds.has(r.id);
      return `
        <button class="ledger-entry clickable" data-select-id="${r.id}">
          <div class="le-left">
            <div class="select-checkbox ${isSelected ? "checked" : ""}">${isSelected ? "✓" : ""}</div>
            <div>
              <div class="le-name">${def ? def.name : r.exerciseId}</div>
              <div class="le-sub">${sub}</div>
            </div>
          </div>
          <div class="le-amt">${Fmt.signedBpt(r.calculatedBPT)}</div>
        </button>
      `;
    }

    return `
      <button class="ledger-entry clickable" data-record-id="${r.id}">
        <div class="le-left">
          <div class="le-icon">${icon(iconName, { size: 16 })}</div>
          <div>
            <div class="le-name">${def ? def.name : r.exerciseId}</div>
            <div class="le-sub">${sub}</div>
          </div>
        </div>
        <div class="le-amt">${Fmt.signedBpt(r.calculatedBPT)}</div>
        <div class="le-chevron">›</div>
      </button>
    `;
  },

  renderCategoryRow(seg, total) {
    const pct = total > 0 ? seg.value / total : 0;
    return `
      <div class="ledger-entry">
        <div class="le-left">
          <div class="cat-icon-circle" style="background:${seg.color}">${this.icons[seg.key]}</div>
          <div>
            <div class="le-name">${this.labels[seg.key]}</div>
            <div class="le-sub">${Fmt.pct(pct)}</div>
          </div>
        </div>
        <div class="le-amt" style="color:var(--ink);">${Fmt.bpt(seg.value)} BPT</div>
      </div>
    `;
  },

  monthLabelAndRange(yearMonth) {
    const [y, m] = yearMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      label: `${y}年${m}月`,
      range: `${m}月1日〜${m}月${lastDay}日`,
    };
  },

  aggregateMonth(yearMonth) {
    const seasonIds = SeasonManager.getAllSeasons(AppState.user.id).map(s => s.id);
    const entries = Storage.getAssetHistory().filter(h => seasonIds.includes(h.seasonId) && h.date.startsWith(yearMonth));

    const income = { cardio: 0, strength: 0, endurance: 0 };
    const expense = { cardio: 0, strength: 0, endurance: 0 };
    for (const e of entries) {
      income.cardio += e.gainCardio || 0;
      income.strength += e.gainStrength || 0;
      income.endurance += e.gainEndurance || 0;
      expense.cardio += e.decayCardio || 0;
      expense.strength += e.decayStrength || 0;
      expense.endurance += e.decayEndurance || 0;
    }
    const incomeTotal = income.cardio + income.strength + income.endurance;
    const expenseTotal = expense.cardio + expense.strength + expense.endurance;

    return { income, expense, incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal };
  },

  shiftMonth(yearMonth, delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },

  showBulkDateChange() {
    const count = this.state.selectedIds.size;
    if (count === 0) { showToast("記録を選択してください"); return; }

    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">日付をまとめて変更</div>
          <div class="edit-sheet-sub">選択した${count}件の記録の日付を変更します</div>
          <div class="field-group">
            <label>新しい日付</label>
            <input type="date" id="bulkDateInput" value="${todayStr()}"
              max="${todayStr()}" min="${AppState.season.startDate.slice(0, 10)}" />
          </div>
          <div class="edit-actions">
            <button class="btn-primary" id="bulkDateApplyBtn">変更する</button>
            <button class="btn-secondary" id="bulkDateCancelBtn">キャンセル</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("bulkDateCancelBtn").addEventListener("click", () => overlay.remove());
    document.getElementById("bulkDateApplyBtn").addEventListener("click", () => {
      const newDate = document.getElementById("bulkDateInput").value;
      if (!newDate) { showToast("日付を選んでください"); return; }

      let successCount = 0;
      this.state.selectedIds.forEach(id => {
        const result = BptCalculator.changeWorkoutDate(id, newDate);
        if (result) successCount += 1;
      });

      AppState.season = Storage.getSeason(AppState.season.id);
      AppState.recomputeHabitScore();

      overlay.remove();
      this.state.selectMode = false;
      this.state.selectedIds = new Set();
      showToast(`${successCount}件の記録の日付を変更しました`);
      Router.refresh();
    });
  },

  afterRender() {
    document.getElementById("prevMonthBtn").addEventListener("click", () => {
      this.state.yearMonth = this.shiftMonth(this.state.yearMonth, -1);
      Router.refresh();
    });
    const nextBtn = document.getElementById("nextMonthBtn");
    if (!nextBtn.disabled) {
      nextBtn.addEventListener("click", () => {
        this.state.yearMonth = this.shiftMonth(this.state.yearMonth, 1);
        Router.refresh();
      });
    }
    document.getElementById("ioToggle").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-t]");
      if (!btn) return;
      this.state.toggle = btn.dataset.t;
      Router.refresh();
    });

    document.getElementById("selectModeToggleBtn").addEventListener("click", () => {
      this.state.selectMode = !this.state.selectMode;
      this.state.selectedIds = new Set();
      Router.refresh();
    });

    const bulkBtn = document.getElementById("bulkDateChangeBtn");
    if (bulkBtn) {
      bulkBtn.addEventListener("click", () => this.showBulkDateChange());
    }

    const seasonIds = SeasonManager.getAllSeasons(AppState.user.id).map(s => s.id);
    const records = Storage.getWorkoutRecords().filter(r => seasonIds.includes(r.seasonId) && r.date.slice(0, 7) === this.state.yearMonth);

    if (this.state.selectMode) {
      document.querySelectorAll("[data-select-id]").forEach(rowEl => {
        rowEl.addEventListener("click", () => {
          const id = rowEl.dataset.selectId;
          if (this.state.selectedIds.has(id)) {
            this.state.selectedIds.delete(id);
          } else {
            this.state.selectedIds.add(id);
          }
          Router.refresh();
        });
      });
    } else {
      bindEditableRecordRows(document, records);
    }
  }
};
