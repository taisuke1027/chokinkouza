/**
 * strengthCalculator.js
 * ------------------------------------------------------------------
 * 筋力刺激量の算出（9章、10章）。
 *
 * [APP DEFINITION]
 *   推定1RM ≈ weight × (1 + reps / 30)  … Epley法に類する簡易推定式
 *   相対強度係数 = 推定1RM ÷ 個人基準1RM（過去の自分の実績）
 *   筋力刺激量 = セット数 × 反復回数 × 相対強度係数 × 対象筋群係数 × 個人能力補正
 *
 * [SCIENCE] 反復回数と挙上重量から1RMを推定する式（Epley式等）は
 *           筋力トレーニング研究で広く使われる近似手法。
 *           ただし高反復（概ね20回超）では推定誤差が大きくなるため、
 *           本アプリでは高反復域の重みを下げ、筋持久力側に按分する。
 * ------------------------------------------------------------------
 */

const StrengthCalculator = {
  /**
   * @param {object} exerciseDef
   * @param {object} input { weight(kg), repetitions, sets }
   * @param {number|null} baseline1RM 個人の基準1RM（未設定ならnull→初回として基準を確立）
   * @returns {{ stimulus:number, estimated1RM:number, details:object }}
   */
  calculate(exerciseDef, input, baseline1RM) {
    const weight = Number(input.weight) || 0;
    const reps = Number(input.repetitions) || 0;
    const sets = Number(input.sets) || 1;

    // [APP DEFINITION] Epley法類似の推定1RM
    const estimated1RM = weight * (1 + reps / CONFIG.STRENGTH.EPLEY_REP_DIVISOR);

    // 個人基準がまだ無い場合は、今回の値を基準として立てる（相対強度=1.0）
    const effectiveBaseline = baseline1RM && baseline1RM > 0 ? baseline1RM : estimated1RM;
    let relativeIntensity = estimated1RM / effectiveBaseline;
    relativeIntensity = clamp(
      relativeIntensity,
      CONFIG.STRENGTH.PERSONAL_ADJUST_MIN,
      CONFIG.STRENGTH.PERSONAL_ADJUST_MAX
    );

    // [APP DEFINITION] 高反復は筋力より筋持久力寄りとして重みを下げる
    let repWeight = 1.0;
    if (reps > CONFIG.STRENGTH.HIGH_REP_THRESHOLD) {
      repWeight = CONFIG.STRENGTH.HIGH_REP_STRENGTH_WEIGHT;
    }

    const groupCoefficient = exerciseDef.groupCoefficient || 1.0;

    const volumeLoad = sets * reps; // ボリューム（セット×回数）
    const stimulus = volumeLoad * relativeIntensity * groupCoefficient * repWeight;

    return {
      stimulus,
      estimated1RM: Number(estimated1RM.toFixed(1)),
      details: {
        relativeIntensity: Number(relativeIntensity.toFixed(3)),
        groupCoefficient,
        repWeight,
        volumeLoad,
        isHighRep: reps > CONFIG.STRENGTH.HIGH_REP_THRESHOLD,
      }
    };
  }
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = StrengthCalculator;
}
