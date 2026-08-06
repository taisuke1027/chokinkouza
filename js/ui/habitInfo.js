/**
 * habitInfo.js — 習慣スコアの説明オーバーレイ
 */
const HabitInfoView = {
  show() {
    const habit = AppState.getHabitScore();
    const w = CONFIG.HABIT.WEIGHTS;
    const currentRank = HabitCalculator.getRank(habit.score);

    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">習慣スコアとは</div>
          <div class="edit-sheet-sub">直近1週間の運動習慣を0〜100点で表す指標</div>

          <div class="habit-rank-badge" style="color:${currentRank.color}; background:${currentRank.bg}; font-size:13px; padding:6px 14px; margin:10px 0 4px;">
            <img src="${currentRank.iconFile}" alt="${currentRank.name}" class="rank-badge-icon rank-badge-icon-lg" />
            現在のランク：${currentRank.name}
          </div>

          <div class="rank-ladder">
            ${CONFIG.HABIT_RANKS.slice().reverse().map(r => `
              <div class="rank-ladder-item ${r.name === currentRank.name ? "current-rank" : ""}" style="color:${r.color}; background:${r.bg};">
                <span style="display:flex; align-items:center; gap:8px;"><img src="${r.iconFile}" alt="${r.name}" class="rank-badge-icon" />${r.name}</span>
                <span class="rl-range">${r.min}〜${r.max}点</span>
              </div>
            `).join("")}
          </div>

          <div style="font-size:12.5px; color:var(--ink-soft); line-height:1.8; margin-top:6px;">
            <p style="margin:0;">身体資産（BPT）とは完全に切り離して管理される指標です。4つの要素を重み付けして合算しています。</p>
          </div>

          <div class="sim-table-wrap" style="max-height:none; overflow:visible; margin-top:12px;">
            <table class="sim-table">
              <thead>
                <tr><th>項目</th><th>評価基準</th><th>配点</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td class="stage-label">有酸素達成率</td>
                  <td class="stage-label">週${CONFIG.HABIT.WEEKLY_CARDIO_MINUTES_GOAL}分が目安</td>
                  <td class="num">${Math.round(w.cardioAchievement * 100)}点</td>
                </tr>
                <tr>
                  <td class="stage-label">筋力達成率</td>
                  <td class="stage-label">週${CONFIG.HABIT.WEEKLY_STRENGTH_DAYS_GOAL}日が目安</td>
                  <td class="num">${Math.round(w.strengthAchievement * 100)}点</td>
                </tr>
                <tr>
                  <td class="stage-label">継続度</td>
                  <td class="stage-label">連続${CONFIG.HABIT.CONSISTENCY_MAX_WEEKS}週で満点</td>
                  <td class="num">${Math.round(w.consistency * 100)}点</td>
                </tr>
                <tr>
                  <td class="stage-label">運動日数率</td>
                  <td class="stage-label">週7日が満点</td>
                  <td class="num">${Math.round(w.exerciseDays * 100)}点</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="small-muted" style="margin-top:8px; line-height:1.6;">週150分の有酸素運動・週2回以上の筋トレは、WHOの身体活動ガイドライン等で目安とされる基準を参考にしています。各項目は100%が上限で、それ以上運動しても加点は増えません。</p>

          <div style="font-size:12.5px; color:var(--ink-soft); margin-top:14px;">
            <p style="margin:0 0 8px; font-weight:700; color:var(--ink);">今週のあなたの内訳</p>
            <div class="calc-detail">
              <div class="cd-row"><span>有酸素達成率</span><b>${habit.cardioAchievement}%</b></div>
              <div class="cd-row"><span>筋力達成率</span><b>${habit.strengthAchievement}%</b></div>
              <div class="cd-row"><span>今週の運動日数</span><b>${habit.exerciseDays}日</b></div>
              <div class="cd-row"><span>合計スコア</span><b>${habit.score} / 100</b></div>
            </div>
          </div>

          <ul style="font-size:12.5px; color:var(--ink-soft); line-height:1.8; margin:12px 0 0; padding-left:18px;">
            <li>週単位の評価なので、「今日サボったら即減点」にはなりません</li>
            <li>「継続度」があるので、何週も途切れず続けていること自体も加点対象になります</li>
            <li>身体資産（BPT）とは別軸の指標です</li>
          </ul>

          <div class="edit-actions">
            <button class="btn-primary" id="habitInfoCloseBtn">閉じる</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("habitInfoCloseBtn").addEventListener("click", () => overlay.remove());
  }
};
