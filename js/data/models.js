/**
 * models.js
 * ------------------------------------------------------------------
 * データモデル（指示書 27章）のファクトリ関数群。
 * すべて id 付きの単純なオブジェクトとして生成する。
 * 永続化は storage.js が担当する。
 * ------------------------------------------------------------------
 */

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const Models = {
  createUser() {
    return {
      id: uid("user"),
      createdAt: new Date().toISOString(),
      currentSeasonId: null,
    };
  },

  createSeason(seasonNumber, userId) {
    const initial = CONFIG.INITIAL_ASSET;
    return {
      id: uid("season"),
      userId,
      seasonNumber,
      startDate: new Date().toISOString(),
      endDate: null,
      initialAsset: initial.total,
      currentAsset: initial.total,
      highestAsset: initial.total,
      lowestAsset: initial.total,
      status: "active", // active | ended
    };
  },

  createAsset(seasonId) {
    const initial = CONFIG.INITIAL_ASSET;
    return {
      id: uid("asset"),
      seasonId,
      cardio: initial.cardio,
      strength: initial.strength,
      endurance: initial.endurance,
      get total() {
        return this.cardio + this.strength + this.endurance;
      },
      updatedAt: new Date().toISOString(),
    };
  },

  // Assetはgetterを持つため保存前にプレーンオブジェクト化するヘルパー
  serializeAsset(asset) {
    return {
      id: asset.id,
      seasonId: asset.seasonId,
      cardio: asset.cardio,
      strength: asset.strength,
      endurance: asset.endurance,
      total: asset.cardio + asset.strength + asset.endurance,
      updatedAt: asset.updatedAt,
    };
  },

  createWorkoutRecord(userId, seasonId, exerciseId, category, fields) {
    return {
      id: uid("wr"),
      userId,
      seasonId,
      exerciseId,
      category, // "cardio" | "strength"
      date: new Date().toISOString(),
      duration: fields.duration ?? null,
      distance: fields.distance ?? null,
      speed: fields.speed ?? null,
      incline: fields.incline ?? null,
      weight: fields.weight ?? null,
      repetitions: fields.repetitions ?? null,
      sets: fields.sets ?? null,
      heartRate: fields.heartRate ?? null,
      calculatedStimulus: null,
      calculatedBPT: null,
      // カテゴリ別のBPT内訳（編集時に元の値を正確に取り消すために保持する）
      gainBreakdown: { cardio: 0, strength: 0, endurance: 0 },
    };
  },

  /**
   * 運動メニュー（テンプレート）。複数の運動をひとまとめにして保存できる
   * （例: 「毎朝ルーチン」＝ウォーキング＋レッグプレス）。
   * @param {Array<{category, exerciseId, fields}>} items
   */
  createTemplate(name, items) {
    return {
      id: uid("tpl"),
      name,
      items: items.map(it => ({
        category: it.category,
        exerciseId: it.exerciseId,
        fields: {
          duration: it.fields.duration ?? null,
          distance: it.fields.distance ?? null,
          speed: it.fields.speed ?? null,
          incline: it.fields.incline ?? null,
          weight: it.fields.weight ?? null,
          repetitions: it.fields.repetitions ?? null,
          sets: it.fields.sets ?? null,
        },
      })),
      createdAt: new Date().toISOString(),
    };
  },

  createHabitScore(seasonId, weekStart) {
    return {
      id: uid("habit"),
      seasonId,
      weekStart,
      score: 0,
      cardioAchievement: 0,
      strengthAchievement: 0,
      exerciseDays: 0,
    };
  },

  createAssetHistoryEntry(seasonId, date, asset, gainBreakdown = {}, decayBreakdown = {}) {
    const g = { cardio: gainBreakdown.cardio || 0, strength: gainBreakdown.strength || 0, endurance: gainBreakdown.endurance || 0 };
    const d = { cardio: decayBreakdown.cardio || 0, strength: decayBreakdown.strength || 0, endurance: decayBreakdown.endurance || 0 };
    return {
      id: uid("hist"),
      seasonId,
      date,
      // 当日終了時点の資産スナップショット（推移グラフ用）
      cardio: asset.cardio,
      strength: asset.strength,
      endurance: asset.endurance,
      total: asset.cardio + asset.strength + asset.endurance,
      // 当日の増減フロー（履歴ページの収入・支出集計用。decayは正の値＝減少量として保持）
      dailyGain: g.cardio + g.strength + g.endurance,
      dailyDecay: d.cardio + d.strength + d.endurance,
      gainCardio: g.cardio, gainStrength: g.strength, gainEndurance: g.endurance,
      decayCardio: d.cardio, decayStrength: d.strength, decayEndurance: d.endurance,
    };
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Models, uid, todayStr };
}
