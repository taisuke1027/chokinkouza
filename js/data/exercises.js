/**
 * exercises.js
 * ------------------------------------------------------------------
 * 種目マスタ。
 * cardioCoefficient は [SCIENCE] METs（代謝当量）の一般的な参照値に基づく近似値。
 * 出典の目安: Compendium of Physical Activities（運動強度の標準参照表）。
 * 個々の値はアプリ内での近似であり、個人差・環境差を反映しない。[APP DEFINITION]
 * ------------------------------------------------------------------
 */

const EXERCISES = {
  cardio: [
    { id: "walking", name: "ウォーキング", inputType: "cardio_speed",
      metsBase: 3.5, metsPerKmh: 0.9, // 速度が上がるほどMETs増加の簡易近似 [APP DEFINITION]
    },
    { id: "running", name: "ランニング", inputType: "cardio_speed",
      metsBase: 7.0, metsPerKmh: 1.0,
    },
    { id: "cycling", name: "サイクリング", inputType: "cardio_speed",
      metsBase: 4.0, metsPerKmh: 0.5,
    },
    { id: "swimming", name: "水泳", inputType: "cardio_distance",
      metsBase: 6.0, metsPerKmh: 0,
    },
    { id: "cardio_other", name: "その他有酸素運動", inputType: "cardio_simple",
      metsBase: 5.0, metsPerKmh: 0,
    },
  ],
  strength: [
    { id: "leg_press", name: "レッグプレス", inputType: "strength", muscleGroup: "lower", groupCoefficient: 1.0 },
    { id: "squat", name: "スクワット", inputType: "strength", muscleGroup: "lower_compound", groupCoefficient: 1.2 },
    { id: "bench_press", name: "ベンチプレス", inputType: "strength", muscleGroup: "upper_push", groupCoefficient: 1.1 },
    { id: "lat_pulldown", name: "ラットプルダウン", inputType: "strength", muscleGroup: "upper_pull", groupCoefficient: 1.0 },
    { id: "strength_other", name: "その他筋力トレーニング", inputType: "strength", muscleGroup: "other", groupCoefficient: 0.9 },
  ],
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = EXERCISES;
}
