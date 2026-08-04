/**
 * home.js — ホーム画面（19章）
 */
const HomeView = {
  render() {
    const asset = AppState.getAsset();
    const total = asset.cardio + asset.strength + asset.endurance;
    const prevDay = AppState.getPrevDayTotal();
    const delta = total - prevDay;
    const deltaClass = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
    const deltaIcon = delta > 0.5 ? "▲" : delta < -0.5 ? "▼" : "―";

    const season = AppState.season;
    const seasonGain = total - season.initialAsset;
    const isAtHigh = total >= season.highestAsset - 0.5;
    const habit = AppState.getHabitScore();

    // 「直近14日間」は実際の暦日で区切る（記録が疎らな配列の末尾N件ではなく、
    // 資産ページの期間フィルタと同じ考え方で日付そのもので絞り込む）
    const chartCutoff = addDaysStr(todayStr(), -14);
    const history = Storage.getAssetHistoryBySeason(season.id).filter(h => h.date >= chartCutoff);
    const chartPoints = history.map(h => ({ date: h.date, values: { total: h.total } }));
    const chartSvg = ChartUI.renderSVG(chartPoints, [{ key: "total", color: "#A9803F", showArea: true }], { height: 90 });

    const recentRecords = Storage.getWorkoutRecordsBySeason(season.id)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    return el(`
      <div>
        <div class="card balance-card">
          <div class="balance-label">💰 身体資産</div>
          <div class="balance-amount"><span class="num">${Fmt.bpt(total)}</span><span class="unit">BPT</span></div>
          <div class="balance-delta ${deltaClass}">
            <span>${deltaIcon}</span>
            <span class="num">${Fmt.signedBpt(delta)} BPT</span>
            <span style="opacity:.7; font-weight:500;">前日比</span>
          </div>

          <div class="stat-row">
            <div class="stat-box">
              <div class="k">過去最高 ${isAtHigh ? "🏅" : ""}</div>
              <div class="v num">${Fmt.bpt(season.highestAsset)}</div>
            </div>
            <div class="stat-box">
              <div class="k">今シーズン積立</div>
              <div class="v num">${Fmt.signedBpt(seasonGain)}</div>
            </div>
          </div>
        </div>

        <div class="card habit-card">
          <div class="habit-ring" data-val="${habit.score}" style="--pct:${habit.score}"></div>
          <div class="habit-text">
            <div class="t">習慣スコア ${habit.score} / 100</div>
            <div class="d">有酸素 ${habit.cardioAchievement}%・筋トレ ${habit.strengthAchievement}%達成<br>今週の運動日数：${habit.exerciseDays}日</div>
          </div>
        </div>

        <button class="btn-primary" id="recordCta">＋ 運動を記録する</button>

        <div class="card" style="margin-top:16px;">
          <div class="section-label">直近14日間の資産推移</div>
          ${chartSvg}
        </div>

        <div class="card">
          <div class="flex-between">
            <div class="section-label" style="margin:0;">最近の記録</div>
          </div>
          ${recentRecords.length === 0 ? `
            <div class="empty-state">
              <div class="icon">🌱</div>
              <p>まだ記録がありません。<br>最初の積立を始めましょう。</p>
            </div>
          ` : recentRecords.map(r => this.renderLedgerEntry(r)).join("")}
        </div>
      </div>
    `);
  },

  renderLedgerEntry(r) {
    const def = findExerciseDef(r.exerciseId);
    const icon = r.category === "cardio" ? "🏃" : "🏋️";
    const sub = r.category === "cardio"
      ? `${r.duration ?? "-"}分`
      : `${r.weight ?? "-"}kg × ${r.repetitions ?? "-"}回 × ${r.sets ?? "-"}set`;
    return `
      <button class="ledger-entry clickable" data-record-id="${r.id}">
        <div class="le-left">
          <div class="le-icon">${icon}</div>
          <div>
            <div class="le-name">${def ? def.name : r.exerciseId}</div>
            <div class="le-sub">${Fmt.dateJp(r.date)}・${sub}</div>
          </div>
        </div>
        <div class="le-amt">${Fmt.signedBpt(r.calculatedBPT)}</div>
        <div class="le-chevron">›</div>
      </button>
    `;
  },

  afterRender() {
    document.getElementById("recordCta").addEventListener("click", () => Router.go("record"));
    const recentRecords = Storage.getWorkoutRecordsBySeason(AppState.season.id)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    bindEditableRecordRows(document, recentRecords);
  }
};

function findExerciseDef(exerciseId) {
  return [...EXERCISES.cardio, ...EXERCISES.strength].find(e => e.id === exerciseId);
}
