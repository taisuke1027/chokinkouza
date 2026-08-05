/**
 * enduranceCalculator.js
 * ------------------------------------------------------------------
 * 筋持久力刺激量の算出（5-3章）。
 *
 * [APP DEFINITION] 筋持久力は単独の入力フォームを持たず、
 *   ・有酸素運動刺激の一部
 *   ・高反復筋トレ刺激の一部
 * を按分することで算出する（長時間・高反復の運動が筋持久力に寄与する
 * という考え方の近似）。
 * ------------------------------------------------------------------
 */

const EnduranceCalculator = {
  /**
   * @param {"cardio"|"strength"} sourceCategory
   * @param {number} sourceStimulus 元となる心肺 or 筋力の刺激量
   * @param {boolean} isHighRep 筋トレの場合、高反復だったか
   * @returns {{ stimulus:number }}
   */
  calculateFromSource(sourceCategory, sourceStimulus, isHighRep = false) {
    let share = 0;
    if (sourceCategory === "cardio") {
      share = CONFIG.ENDURANCE.CARDIO_SHARE_TO_ENDURANCE;
    } else if (sourceCategory === "strength" && isHighRep) {
      share = CONFIG.ENDURANCE.HIGH_REP_STRENGTH_SHARE_TO_ENDURANCE;
    }
    return { stimulus: sourceStimulus * share };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = EnduranceCalculator;
}
