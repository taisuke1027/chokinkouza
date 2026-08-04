/**
 * more.js — その他メニュー
 */
const MoreView = {
  render() {
    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">その他</h2>

        <div class="card" style="padding:0; overflow:hidden;">
          ${this.menuItem("📚", "シーズン成績", "過去シーズンの記録を見る", "seasons")}
          ${this.menuItem("🔬", "科学的根拠・計算方法", "BPTの考え方と出典について", "science")}
        </div>

        <div class="card">
          <div class="section-label">このシーズンについて</div>
          <div class="flex-between" style="padding:6px 0;"><span class="small-muted">開始日</span><span class="num">${Fmt.dateFullJp(AppState.season.startDate)}</span></div>
          <div class="flex-between" style="padding:6px 0;"><span class="small-muted">シーズン番号</span><span class="num">Season ${AppState.season.seasonNumber}</span></div>
          <button class="btn-secondary" id="endSeasonBtn" style="margin-top:12px;">シーズンを終了して新しく始める</button>
        </div>
      </div>
    `);
  },

  menuItem(icon, title, sub, view) {
    return `
      <button class="menu-item-btn" data-go="${view}" style="width:100%; display:flex; align-items:center; gap:14px; padding:16px 18px; background:none; border:none; border-bottom:1px solid var(--rule); text-align:left;">
        <div style="font-size:20px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:14px;">${title}</div>
          <div style="font-size:11.5px; color:var(--ink-faint); margin-top:2px;">${sub}</div>
        </div>
        <div style="color:var(--ink-faint);">›</div>
      </button>
    `;
  },

  afterRender() {
    document.querySelectorAll(".menu-item-btn").forEach(b => {
      b.addEventListener("click", () => Router.go(b.dataset.go));
    });
    document.getElementById("endSeasonBtn").addEventListener("click", () => {
      ConfirmDialog.show(
        `現在のシーズンを終了し、新しいシーズンを Season ${AppState.season.seasonNumber + 1} として開始します。よろしいですか？`,
        () => {
          const newSeason = SeasonManager.endCurrentSeasonAndStartNext();
          AppState.season = newSeason;
          AppState.recomputeHabitScore();
          showToast("新しいシーズンが始まりました");
          Router.go("home");
        },
        { confirmLabel: "開始する", danger: false }
      );
    });
  }
};
