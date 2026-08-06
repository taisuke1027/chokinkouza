/**
 * decayCalculator.js
 * ------------------------------------------------------------------
 * 資産の減価（デトレーニング）計算（12〜14章）。
 *
 * 「休養＝悪」にしないため、以下の方針を取る：
 *   ・直近に軽い運動以上の活動があれば無活動日数はリセットされる
 *   ・無活動日数に応じて区間ごとに異なる日次減価率を適用する
 *   ・資産種別（心肺／筋力／筋持久力）ごとに速度係数を変える
 *
 * [SCIENCE] デトレーニングによる体力低下は運動中止後、数日〜数週間の
 *           単位で進行し、心肺機能の低下は筋力よりも早い傾向がある
 *           （Mujika & Padilla, 2000, Sports Medicine 等のレビュー）。
 * [APP DEFINITION] 上記の「相対的な速さの違い」の方向性のみを採用し、
 *           具体的な日次減価率はアプリ独自のゲームバランス値とする。
 * ------------------------------------------------------------------
 */

const DecayCalculator = {
  /**
   * 無活動日数（daysInactive）に対応する「区間の日次減価率」を返す。
   */
  getDailyRateForDay(daysInactive) {
    const curve = CONFIG.DECAY.CURVE;
    for (const tier of curve) {
      if (daysInactive >= tier.fromDay && daysInactive <= tier.toDay) {
        return tier.dailyRate;
      }
    }
    return curve[curve.length - 1].dailyRate;
  },

  /**
   * 指定した無活動日数の範囲（fromDaysInactive 〜 toDaysInactive）について、
   * 資産種別ごとの減価額を計算する。1日ずつ複利的に減らす。
   *
   * @param {object} asset { cardio, strength, endurance }
   * @param {number} fromDaysInactive 減価計算開始時点の無活動日数
   * @param {number} numDays 何日分の減価を計算するか
   * @param {number} pressureMultiplier 「プレッシャーレベル」倍率（デフォルト1.0=基準値）
   * @returns {{ cardio:number, strength:number, endurance:number, total:number }}
   *          （マイナス値＝減少額）
   */
  calculateDecay(asset, fromDaysInactive, numDays, pressureMultiplier = 1.0) {
    let cardio = asset.cardio;
    let strength = asset.strength;
    let endurance = asset.endurance;
    const startCardio = cardio, startStrength = strength, startEndurance = endurance;

    for (let i = 0; i < numDays; i++) {
      const daysInactive = fromDaysInactive + i;
      const baseRate = this.getDailyRateForDay(daysInactive) * pressureMultiplier;
      if (baseRate <= 0) continue;
      cardio -= cardio * baseRate * CONFIG.DECAY.SPEED_FACTOR.cardio;
      strength -= strength * baseRate * CONFIG.DECAY.SPEED_FACTOR.strength;
      endurance -= endurance * baseRate * CONFIG.DECAY.SPEED_FACTOR.endurance;
    }

    return {
      cardio: cardio - startCardio,
      strength: strength - startStrength,
      endurance: endurance - startEndurance,
      total: (cardio + strength + endurance) - (startCardio + startStrength + startEndurance),
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DecayCalculator;
}
