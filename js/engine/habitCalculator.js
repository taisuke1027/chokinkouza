/**
 * habitCalculator.js
 * ------------------------------------------------------------------
 * 習慣スコア（0〜100）の算出（6章、15章）。
 * 身体資産(BPT)とは完全に独立した指標として扱う。
 *
 * [SCIENCE] 週150分の中強度有酸素運動、週2回以上の筋力トレーニングは
 *           WHO身体活動ガイドライン等で広く紹介される目安値。
 * [APP DEFINITION] 週単位で「有酸素達成率」「筋力達成率」「継続週数」
 *           「運動日数」を加重平均してスコア化する。
 * [GAME BALANCE] 各要素の重み・継続週数の上限は CONFIG.HABIT を参照。
 * ------------------------------------------------------------------
 */

const HabitCalculator = {
  /**
   * @param {Array} weekRecords その週のWorkoutRecord配列
   * @param {number} consecutiveWeeks 継続している週数
   * @returns {{ score:number, cardioAchievement:number, strengthAchievement:number, exerciseDays:number }}
   */
  calculateWeeklyScore(weekRecords, consecutiveWeeks) {
    const cardioMinutes = weekRecords
      .filter(r => r.category === "cardio")
      .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);

    const strengthDays = new Set(
      weekRecords.filter(r => r.category === "strength").map(r => r.date.slice(0, 10))
    ).size;

    const exerciseDays = new Set(weekRecords.map(r => r.date.slice(0, 10))).size;

    const cardioAchievement = Math.min(1, cardioMinutes / CONFIG.HABIT.WEEKLY_CARDIO_MINUTES_GOAL);
    const strengthAchievement = Math.min(1, strengthDays / CONFIG.HABIT.WEEKLY_STRENGTH_DAYS_GOAL);
    const consistency = Math.min(1, consecutiveWeeks / CONFIG.HABIT.CONSISTENCY_MAX_WEEKS);
    const exerciseDaysScore = Math.min(1, exerciseDays / 7);

    const w = CONFIG.HABIT.WEIGHTS;
    const score =
      cardioAchievement * w.cardioAchievement +
      strengthAchievement * w.strengthAchievement +
      consistency * w.consistency +
      exerciseDaysScore * w.exerciseDays;

    return {
      score: Math.round(score * 100),
      cardioAchievement: Math.round(cardioAchievement * 100),
      strengthAchievement: Math.round(strengthAchievement * 100),
      exerciseDays,
    };
  },

  /** スコア(0〜100)に応じたランク情報を返す */
  getRank(score) {
    const ranks = CONFIG.HABIT_RANKS;
    return ranks.find(r => score >= r.min && score <= r.max) || ranks[0];
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = HabitCalculator;
}
