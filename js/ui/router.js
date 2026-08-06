/**
 * router.js — ボトムナビとビュー切り替え
 */
const Router = {
  current: "home",
  views: {
    home: HomeView,
    record: RecordView,
    asset: AssetView,
    ledger: LedgerView,
    more: MoreView,
    seasons: SeasonsView,
    science: ScienceView,
  },

  init() {
    document.getElementById("bottomNav").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      this.go(btn.dataset.view);
    });
    this.go("home");
  },

  go(viewName, params) {
    const isSameView = this.current === viewName;
    this.current = viewName;
    const main = document.getElementById("mainView");
    const view = this.views[viewName];
    if (!view) return;

    main.innerHTML = "";
    try {
      main.appendChild(view.render(params));
      if (view.afterRender) view.afterRender(params);
    } catch (err) {
      console.error(`View "${viewName}" failed to render:`, err);
      main.innerHTML = `
        <div class="empty-state">
          <div class="icon">${icon("warning", { size: 26 })}</div>
          <p>この画面の表示中にエラーが発生しました。<br>お手数ですが、アプリを再読み込みしてください。</p>
        </div>
      `;
    }

    // ボトムナビのハイライト（サブ画面は親タブをハイライト）
    const navMap = { seasons: "more", science: "more" };
    const highlightKey = navMap[viewName] || viewName;
    document.querySelectorAll("#bottomNav button").forEach(b => {
      b.classList.toggle("active", b.dataset.view === highlightKey);
    });

    document.getElementById("seasonChip").textContent = `Season ${AppState.season.seasonNumber}`;

    // 別の画面へ切り替えたときだけ先頭までスクロールする。
    // 同じ画面内の再描画（トグル切り替えなど）ではスクロール位置を保つ。
    if (!isSameView) {
      main.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  },

  refresh() {
    this.go(this.current);
  }
};
