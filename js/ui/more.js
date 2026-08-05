/**
 * more.js — その他メニュー
 */
const MoreView = {
  render() {
    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">その他</h2>

        <div class="card" style="padding:0; overflow:hidden;">
          ${this.menuItem(icon("book", { size: 20 }), "シーズン成績", "過去シーズンの記録を見る", "seasons")}
          ${this.menuItem(icon("flask", { size: 20 }), "科学的根拠・計算方法", "BPTの考え方と出典について", "science")}
        </div>

        <div class="card">
          <div class="section-label">このシーズンについて</div>
          <div class="flex-between" style="padding:6px 0;"><span class="small-muted">開始日</span><span class="num">${Fmt.dateFullJp(AppState.season.startDate)}</span></div>
          <div class="flex-between" style="padding:6px 0;"><span class="small-muted">シーズン番号</span><span class="num">Season ${AppState.season.seasonNumber}</span></div>
          <button class="btn-secondary" id="recalcHistoryBtn" style="margin-top:12px;">${icon("gauge", { size: 15 })} 資産履歴を再計算する</button>
          <div class="small-muted" style="margin-top:8px; line-height:1.6;">運動記録は変えずに、シーズン開始日から今日までの資産推移・減価を最新の計算方法で作り直します。過去の計算に誤差があった場合の修正に使えます。</div>
          <button class="btn-secondary" id="endSeasonBtn" style="margin-top:14px;">シーズンを終了して新しく始める</button>
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

    document.getElementById("recalcHistoryBtn").addEventListener("click", () => {
      ConfirmDialog.show(
        "運動記録はそのままに、資産の推移・減価を最新の計算方法で作り直します。よろしいですか？",
        () => {
          const result = SeasonManager.recalculateSeasonHistory(AppState.season.id);
          AppState.season = Storage.getSeason(AppState.season.id);
          AppState.recomputeHabitScore();
          showToast(`資産履歴を再計算しました（現在資産: ${Fmt.bpt(result.newTotal)} BPT）`);
          Router.refresh();
        },
        { confirmLabel: "再計算する", danger: false }
      );
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
