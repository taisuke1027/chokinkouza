/**
 * seasons.js — シーズン成績画面（17〜18章）
 */
const SeasonsView = {
  render() {
    const seasons = SeasonManager.getAllSeasons(AppState.user.id);

    return el(`
      <div>
        <h2 style="font-family:var(--font-display); font-size:19px; margin:8px 0 16px;">シーズン成績</h2>
        ${seasons.map(s => this.renderSeasonCard(s)).join("")}
      </div>
    `);
  },

  renderSeasonCard(s) {
    const records = Storage.getWorkoutRecords().filter(r => r.seasonId === s.id);
    const exerciseDays = new Set(records.map(r => r.date.slice(0, 10))).size;
    const totalMinutes = records.filter(r => r.category === "cardio").reduce((sum, r) => sum + (r.duration || 0), 0);
    const habitScores = Storage.getHabitScores().filter(h => h.seasonId === s.id);
    const avgHabit = habitScores.length ? Math.round(habitScores.reduce((sum, h) => sum + h.score, 0) / habitScores.length) : 0;
    const maxStreak = this.computeMaxStreak(records);
    const net = s.currentAsset - s.initialAsset;

    return `
      <div class="card season-card">
        <div class="sn-status ${s.status === "ended" ? "ended" : ""}">${s.status === "ended" ? "終了" : "進行中"}</div>
        <div class="sn-title">Season ${s.seasonNumber}</div>
        <div class="small-muted">${Fmt.dateFullJp(s.startDate)} 〜 ${s.endDate ? Fmt.dateFullJp(s.endDate) : "継続中"}</div>

        <div class="season-stat-grid">
          <div><div class="k">初期資産</div><div class="v num">${Fmt.bpt(s.initialAsset)}</div></div>
          <div><div class="k">${s.status === "ended" ? "最終資産" : "現在資産"}</div><div class="v num">${Fmt.bpt(s.currentAsset)}</div></div>
          <div><div class="k">最高資産</div><div class="v num">${Fmt.bpt(s.highestAsset)}</div></div>
          <div><div class="k">最低資産</div><div class="v num">${Fmt.bpt(s.lowestAsset)}</div></div>
          <div><div class="k">総運動日数</div><div class="v num">${exerciseDays}日</div></div>
          <div><div class="k">総有酸素時間</div><div class="v num">${totalMinutes}分</div></div>
          <div><div class="k">最大連続運動日数</div><div class="v num">${maxStreak}日</div></div>
          <div><div class="k">平均習慣スコア</div><div class="v num">${avgHabit}</div></div>
        </div>

        <hr class="hr-dash" />
        <div class="flex-between">
          <span class="small-muted">シーズン損益</span>
          <span class="num" style="font-weight:700; color:${net >= 0 ? "var(--brass-deep)" : "var(--clay)"}">${Fmt.signedBpt(net)} BPT</span>
        </div>
      </div>
    `;
  },

  computeMaxStreak(records) {
    const days = [...new Set(records.map(r => r.date.slice(0, 10)))].sort();
    if (days.length === 0) return 0;
    let max = 1, cur = 1;
    for (let i = 1; i < days.length; i++) {
      const diff = Fmt.daysBetween(days[i - 1], days[i]);
      if (diff === 1) { cur += 1; max = Math.max(max, cur); } else { cur = 1; }
    }
    return max;
  }
};
