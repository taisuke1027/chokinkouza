/**
 * cardioCalculator.js
 * ------------------------------------------------------------------
 * 心肺刺激量の算出（8章）。
 *
 * [APP DEFINITION]
 *   心肺刺激量 = 運動時間(分) × 強度係数(METs近似/10) × 頻度補正 × 個人能力補正
 *
 * [SCIENCE] 強度をMETsで近似する考え方は Compendium of Physical
 *           Activities に基づく一般的な手法。時間×強度で総負荷を
 *           近似する発想は運動処方のFITT原則に沿う。
 * ------------------------------------------------------------------
 */

const CardioCalculator = {
  /**
   * @param {object} exerciseDef exercises.js の種目定義
   * @param {object} input { duration(分), speed(km/h, optional), incline(%, optional) }
   * @param {number} recentSessionsCount 直近7日の心肺運動回数（頻度補正用）
   * @returns {{ stimulus:number, details:object }}
   */
  calculate(exerciseDef, input, recentSessionsCount = 0) {
    const duration = Number(input.duration) || 0;
    const speed = Number(input.speed) || 0;
    const incline = Number(input.incline) || 0;

    // [APP DEFINITION] METs近似値: 基礎値 + 速度依存分 + 傾斜依存分
    // 傾斜(%)が上がるほど酸素消費が増えるという一般的傾向を簡易的に反映
    const mets = exerciseDef.metsBase + (exerciseDef.metsPerKmh || 0) * speed + incline * 0.15;

    // [APP DEFINITION] 強度係数はMETs近似値をそのまま用いる
    const intensityFactor = mets;

    // [GAME BALANCE] 頻度補正: 直近7日の実施回数に応じて微増、上限あり
    const freqBonus = Math.min(
      recentSessionsCount * CONFIG.CARDIO.FREQUENCY_BONUS_PER_SESSION,
      CONFIG.CARDIO.FREQUENCY_BONUS_CAP
    );
    const frequencyFactor = 1 + freqBonus;

    const baseStimulus = duration * intensityFactor;
    const stimulus = baseStimulus * frequencyFactor;

    return {
      stimulus,
      details: {
        mets: Number(mets.toFixed(2)),
        intensityFactor: Number(intensityFactor.toFixed(3)),
        frequencyFactor: Number(frequencyFactor.toFixed(3)),
        baseStimulus: Number(baseStimulus.toFixed(1)),
      }
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CardioCalculator;
}
