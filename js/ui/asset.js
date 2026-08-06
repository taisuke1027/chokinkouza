/**
 * asset.js — 「資産」画面
 * 「推移」と「内訳」をセグメントトグルで切り替える統合画面（①対応）。
 */
const AssetView = {
  state: { mode: "trend", period: "1m" },

  colors: { total: "#23262B", cardio: "#6E8FAE", strength: "#A9803F", endurance: "#8FA678" },
  labels: { cardio: "心肺", strength: "筋力", endurance: "筋持久力" },

  periods: [
    { key: "1w", label: "1週間", days: 7 },
    { key: "1m", label: "1ヶ月", days: 30 },
    { key: "3m", label: "3ヶ月", days: 90 },
    { key: "6m", label: "6ヶ月", days: 180 },
    { key: "season", label: "シーズン", days: null },
    { key: "all", label: "全期間", days: null },
  ],

  render() {
    const asset = AppState.getAsset();
    const total = asset.cardio + asset.strength + asset.endurance;
    const season = AppState.season;
    const sinceStart = total - season.initialAsset;
    const prevDay = AppState.getPrevDaySnapshot();
    const dayDelta = total - prevDay.total;

    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">資産</h2>

        <div class="card recap-card">
          <div class="section-label">合計</div>
          <div class="recap-amount"><span class="num">${Fmt.bpt(total)}</span><span class="unit">BPT</span></div>
          <div class="recap-stat-row">
            <span>利用開始日比</span>
            <span class="val">
              <span class="num">${Fmt.signedBpt(sinceStart)}</span>
              <span class="delta-icon ${sinceStart > 0.5 ? "up" : sinceStart < -0.5 ? "down" : "flat"}">${sinceStart > 0.5 ? "↗" : sinceStart < -0.5 ? "↘" : "―"}</span>
            </span>
          </div>
          <div class="recap-stat-row">
            <span>前日比</span>
            <span class="val">
              <span class="num">${Fmt.signedBpt(dayDelta)}</span>
              <span class="delta-icon ${dayDelta > 0.5 ? "up" : dayDelta < -0.5 ? "down" : "flat"}">${dayDelta > 0.5 ? "↗" : dayDelta < -0.5 ? "↘" : "―"}</span>
            </span>
          </div>
        </div>

        <div class="segment-toggle" id="assetModeToggle">
          <button data-mode="trend" class="${this.state.mode === "trend" ? "active" : ""}">推移</button>
          <button data-mode="breakdown" class="${this.state.mode === "breakdown" ? "active" : ""}">内訳</button>
        </div>

        <div id="assetBody">
          ${this.state.mode === "trend" ? this.renderTrendBody() : this.renderBreakdownBody(asset, total)}
        </div>
      </div>
    `);
  },

  // ---- 推移（旧: 資産推移ページ） ----
  renderTrendBody() {
    const season = AppState.season;
    const full = Storage.getAssetHistoryBySeason(season.id);
    const period = this.periods.find(p => p.key === this.state.period);
    let filtered = full;
    if (period.days) {
      const cutoff = addDaysStr(todayStr(), -period.days);
      filtered = full.filter(h => h.date >= cutoff);
    }

    return `
      <div class="card">
        <div class="picker-pill-row">
          <button class="picker-pill" id="periodPill">${icon("calendar", { size: 14 })} ${period.label} <span class="caret">▾</span></button>
        </div>

        <div id="chartHost">${this.renderChart(filtered)}</div>

        <hr class="hr-dash" />
        ${this.renderTrendBreakdown(filtered)}
      </div>

      <div class="card">
        <div class="section-label">記録一覧</div>
        ${this.renderList(filtered)}
      </div>
    `;
  },

  renderChart(filtered) {
    const points = filtered.map(h => ({ date: h.date, values: { total: h.total, cardio: h.cardio, strength: h.strength, endurance: h.endurance } }));
    const series = [
      { key: "total", color: this.colors.total, label: "総資産", width: 2.5 },
      { key: "cardio", color: this.colors.cardio, label: "心肺", width: 1.75 },
      { key: "strength", color: this.colors.strength, label: "筋力", width: 1.75 },
      { key: "endurance", color: this.colors.endurance, label: "筋持久力", width: 1.75 },
    ];
    return ChartUI.renderMultiLine(points, series, { height: 190 });
  },

  renderTrendBreakdown(filtered) {
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    if (!first || !last) return "";

    const rows = [
      { key: "total", color: this.colors.total, label: "総資産" },
      { key: "cardio", color: this.colors.cardio, label: "心肺" },
      { key: "strength", color: this.colors.strength, label: "筋力" },
      { key: "endurance", color: this.colors.endurance, label: "筋持久力" },
    ];
    return rows.map(l => {
      const change = last[l.key] - first[l.key];
      return `
        <div class="flex-between" style="padding:7px 0;">
          <span style="display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--ink-soft);">
            <span class="stack-legend-swatch" style="background:${l.color}"></span>${l.label}
          </span>
          <span class="num" style="font-weight:700; color:${change >= 0 ? "var(--brass-deep)" : "var(--clay)"}">${Fmt.signedBpt(change)}</span>
        </div>
      `;
    }).join("");
  },

  renderList(filtered) {
    if (filtered.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("folder", { size: 26 })}</div><p>この期間のデータはまだありません。</p></div>`;
    }
    return [...filtered].reverse().slice(0, 30).map(h => `
      <div class="ledger-entry">
        <div class="le-left">
          <div class="le-icon">${icon("calendar", { size: 16 })}</div>
          <div>
            <div class="le-name">${Fmt.dateJp(h.date)}</div>
            <div class="le-sub">心肺${Fmt.bpt(h.cardio)}・筋力${Fmt.bpt(h.strength)}・筋持久${Fmt.bpt(h.endurance)}</div>
          </div>
        </div>
        <div class="le-amt">${Fmt.bpt(h.total)}</div>
      </div>
    `).join("");
  },

  // ---- 内訳（旧: ポートフォリオページ） ----
  renderBreakdownBody(asset, total) {
    const t = total || 1;
    const segments = [
      { key: "cardio", color: this.colors.cardio, value: asset.cardio },
      { key: "strength", color: this.colors.strength, value: asset.strength },
      { key: "endurance", color: this.colors.endurance, value: asset.endurance },
    ];
    const donutSvg = ChartUI.renderDonut(segments, { centerLabel: { k: "合計", v: Fmt.bpt(t) } });

    return `
      <div class="card">
        <div class="section-label">身体資産の内訳</div>
        ${donutSvg}
        ${segments.map(seg => this.renderLegendRow(seg, t)).join("")}
      </div>

      <div class="card">
        <div class="section-label">今後の展望</div>
        <p style="font-size:12.5px; color:var(--ink-soft); line-height:1.8; margin:0;">
          将来的には「心肺重視」「筋力重視」「バランス型」といった目標ポートフォリオを
          選択できるようにする予定です。現在は運動記録に応じて自動的に配分が計算されます。
        </p>
      </div>
    `;
  },

  renderLegendRow(seg, total) {
    const pct = seg.value / total;
    return `
      <div class="legend-row">
        <div class="lg-left"><span class="legend-dot" style="background:${seg.color}"></span>${this.labels[seg.key]}</div>
        <div>
          <div class="lg-val num">${Fmt.bpt(seg.value)} BPT</div>
          <div class="lg-pct">${Fmt.pct(pct)}</div>
        </div>
      </div>
    `;
  },

  afterRender() {
    document.getElementById("assetModeToggle").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      this.state.mode = btn.dataset.mode;
      Router.refresh();
    });

    if (this.state.mode === "trend") {
      document.getElementById("periodPill").addEventListener("click", () => {
        Picker.show("期間を選択", this.periods, this.state.period, (key) => {
          this.state.period = key;
          Router.refresh();
        });
      });
    }
  }
};
