/**
 * bptCalculator.js
 * ------------------------------------------------------------------
 * 運動記録 → 身体資産(BPT)変化 への変換を統括するオーケストレーター。
 * UIコンポーネントはこのモジュールだけを呼び出し、内部の計算詳細を
 * 意識しなくてよい構造にする（28章: 計算エンジンの独立）。
 *
 * 処理フロー（7章）:
 *   運動記録 → 種類判定 → 刺激量算出 → 逓減適用 → 資産配分決定
 *   → 身体適応として反映 → BPT加算
 *
 * 記録の編集・削除にも対応する。編集時は「元の記録が資産に与えた影響」を
 * 打ち消し、新しい入力内容から再計算した影響を適用することで、
 * 過去の記録を修正してもBPTが正しく整合するようにしている。
 * ------------------------------------------------------------------
 */

const BptCalculator = {
  /**
   * 逓減モデル（11章）: 当日すでに積み上がった刺激量(priorStimulus)を踏まえて、
   * 新しい刺激量(addedStimulus)に区間別の重みを適用した「実効刺激量」を返す。
   */
  applyDiminishingReturns(category, priorStimulusToday, addedStimulus) {
    const baseUnit = CONFIG.DIMINISHING_RETURNS.BASE_UNIT[category] || 100;
    const tiers = CONFIG.DIMINISHING_RETURNS.TIERS;
    let pos = priorStimulusToday;
    let remaining = addedStimulus;
    let weightedTotal = 0;

    for (const tier of tiers) {
      const tierEndAbs = tier.upTo === Infinity ? Infinity : tier.upTo * baseUnit;
      if (pos >= tierEndAbs) continue;
      const availableInTier = tierEndAbs - pos;
      const consume = Math.min(remaining, availableInTier);
      weightedTotal += consume * tier.weight;
      pos += consume;
      remaining -= consume;
      if (remaining <= 1e-9) break;
    }
    return weightedTotal;
  },

  /**
   * 種目・カテゴリ・入力内容から刺激量とBPT配分を計算する（新規記録・編集記録で共通）。
   */
  computeGain({ exerciseDef, category, inputFields, priorStimulusToday, recentSessions, baselineValue }) {
    let rawStimulus = 0;
    let calcDetails = {};

    if (category === "cardio") {
      const result = CardioCalculator.calculate(exerciseDef, inputFields, recentSessions || 0);
      rawStimulus = result.stimulus;
      calcDetails = result.details;
    } else {
      const result = StrengthCalculator.calculate(exerciseDef, inputFields, baselineValue);
      rawStimulus = result.stimulus;
      calcDetails = result.details;
      calcDetails.estimated1RM = result.estimated1RM;
    }

    const effectiveStimulus = this.applyDiminishingReturns(category, priorStimulusToday || 0, rawStimulus);
    const isHighRep = !!calcDetails.isHighRep;
    const enduranceResult = EnduranceCalculator.calculateFromSource(category, effectiveStimulus, isHighRep);

    const unitPrice = category === "cardio" ? CONFIG.CARDIO.STIMULUS_TO_BPT : CONFIG.STRENGTH.STIMULUS_TO_BPT;
    const primaryBPT = effectiveStimulus * unitPrice;
    const enduranceBPT = enduranceResult.stimulus * unitPrice;

    const gain = { cardio: 0, strength: 0, endurance: 0 };
    if (category === "cardio") gain.cardio = primaryBPT;
    if (category === "strength") gain.strength = primaryBPT;
    gain.endurance = enduranceBPT;

    return {
      rawStimulus,
      effectiveStimulus,
      gain,
      totalGainBPT: gain.cardio + gain.strength + gain.endurance,
      calcDetails,
    };
  },

  /**
   * 1件の運動記録から身体資産の変化を計算し、資産・履歴・基準値を更新する。
   *
   * @param {object} params
   *   exerciseDef, category, inputFields, seasonId, userId, recordDate(YYYY-MM-DD、省略時は今日)
   * @returns {object} UI表示用の詳細内訳（29章: 計算結果の透明性）
   */
  processWorkout({ exerciseDef, category, inputFields, seasonId, userId, recordDate }) {
    const dateKey = recordDate || todayStr();
    const dateISO = dateKey + "T12:00:00.000Z";

    const sameDayRecords = Storage.getWorkoutRecordsBySeason(seasonId)
      .filter(r => r.date.slice(0, 10) === dateKey && r.category === category);
    const priorStimulusToday = sameDayRecords.reduce((s, r) => s + (r.calculatedStimulus || 0), 0);

    let recentSessions = 0;
    let baselineValue = null;
    let baselineUpdateInfo = null;

    if (category === "cardio") {
      recentSessions = Storage.getWorkoutRecordsBySeason(seasonId)
        .filter(r => r.category === "cardio" && withinLastNDaysOfDate(r.date, dateISO, 7)).length;
    } else {
      const baseline = Storage.getBaseline(exerciseDef.id);
      baselineValue = baseline ? baseline.value : null;
    }

    const computed = this.computeGain({ exerciseDef, category, inputFields, priorStimulusToday, recentSessions, baselineValue });
    const gain = computed.gain;

    if (category === "strength") {
      const est = computed.calcDetails.estimated1RM;
      if (!baselineValue || est > baselineValue) {
        baselineUpdateInfo = { exerciseId: exerciseDef.id, value: est, isNewBest: !!baselineValue };
        Storage.updateBaseline(exerciseDef.id, { value: est, updatedAt: new Date().toISOString() });
      }
    }

    // 資産・履歴への反映は「その日付を起点に前方へ伝播させる」共通ロジックに一本化する。
    // これにより、過去の日付で記録した場合でも、その日以降のすべての資産スナップショットが
    // 正しく更新される（以前は「今日の資産」をそのまま過去の日付のスナップショットとして
    // 保存してしまい、折れ線グラフが不自然に上下するバグがあった）。
    const highestBefore = Storage.getSeason(seasonId).highestAsset;
    this.applyDeltaFromDate(seasonId, dateKey, gain, computed.totalGainBPT);

    const asset = Storage.getAssetBySeason(seasonId);
    const newTotal = asset.cardio + asset.strength + asset.endurance;
    const isNewHigh = newTotal > highestBefore;

    const record = Models.createWorkoutRecord(userId, seasonId, exerciseDef.id, category, inputFields);
    record.date = dateISO;
    record.calculatedStimulus = computed.rawStimulus;
    record.calculatedBPT = computed.totalGainBPT;
    record.gainBreakdown = gain;
    Storage.addWorkoutRecord(record);

    return {
      record,
      gain,
      totalGainBPT: computed.totalGainBPT,
      newAssetTotal: newTotal,
      isNewHigh,
      details: {
        category,
        rawStimulus: Number(computed.rawStimulus.toFixed(1)),
        effectiveStimulus: Number(computed.effectiveStimulus.toFixed(1)),
        diminishingApplied: computed.rawStimulus > 0 ? Number((computed.effectiveStimulus / computed.rawStimulus).toFixed(2)) : 1,
        ...computed.calcDetails,
      },
      baselineUpdateInfo,
    };
  },

  /**
   * 入力内容は変えず、日付だけを変更する（履歴画面の複数選択→まとめて日付変更用）。
   */
  changeWorkoutDate(recordId, newDateKey) {
    const record = Storage.getWorkoutRecords().find(r => r.id === recordId);
    if (!record) return null;
    const fields = {
      duration: record.duration,
      distance: record.distance,
      speed: record.speed,
      incline: record.incline,
      weight: record.weight,
      repetitions: record.repetitions,
      sets: record.sets,
    };
    return this.editWorkout(recordId, fields, newDateKey);
  },

  /**
   * 既存の運動記録を編集し、資産・履歴・シーズン最高/最低・自己ベスト基準を
   * 新しい入力内容（日付の変更を含む）に合わせて修正する。
   *
   * 実装方針: 一旦「旧日付から古い影響を完全に取り消し」、続けて
   * 「新しい日付を基準に再計算した影響を反映」の2段階で処理する。
   * 日付が変わらない場合も同じ経路を通るため、常に同じロジックで扱える。
   */
  editWorkout(recordId, newFields, newDateKey) {
    const record = Storage.getWorkoutRecords().find(r => r.id === recordId);
    if (!record) return null;
    const exerciseDef = findExerciseDefById(record.exerciseId);
    const category = record.category;
    const seasonId = record.seasonId;
    const oldDateKey = record.date.slice(0, 10);
    const targetDateKey = newDateKey || oldDateKey;
    const targetDateISO = targetDateKey + "T12:00:00.000Z";

    const oldGain = record.gainBreakdown || { cardio: 0, strength: 0, endurance: 0 };
    const oldGainTotal = oldGain.cardio + oldGain.strength + oldGain.endurance;

    // 1. 旧日付から古い影響を完全に取り消す
    this.applyDeltaFromDate(
      seasonId, oldDateKey,
      { cardio: -oldGain.cardio, strength: -oldGain.strength, endurance: -oldGain.endurance },
      -oldGainTotal
    );

    // 2. 新しい日付を基準に再計算する（同日の他記録・基準値もその日付基準で見る）
    const sameDayOthers = Storage.getWorkoutRecordsBySeason(seasonId)
      .filter(r => r.id !== recordId && r.category === category && r.date.slice(0, 10) === targetDateKey);
    const priorStimulusToday = sameDayOthers.reduce((s, r) => s + (r.calculatedStimulus || 0), 0);

    let recentSessions = 0;
    let baselineValue = null;
    if (category === "cardio") {
      recentSessions = Storage.getWorkoutRecordsBySeason(seasonId)
        .filter(r => r.id !== recordId && r.category === "cardio" && withinLastNDaysOfDate(r.date, targetDateISO, 7)).length;
    } else {
      baselineValue = this.baselineBeforeDate(exerciseDef.id, targetDateISO, recordId);
    }

    const computed = this.computeGain({ exerciseDef, category, inputFields: newFields, priorStimulusToday, recentSessions, baselineValue });
    const newGain = computed.gain;

    // 3. 新しい日付から新しい影響を反映する
    this.applyDeltaFromDate(seasonId, targetDateKey, newGain, computed.totalGainBPT);

    record.date = targetDateISO;
    record.duration = newFields.duration ?? null;
    record.distance = newFields.distance ?? null;
    record.speed = newFields.speed ?? null;
    record.incline = newFields.incline ?? null;
    record.weight = newFields.weight ?? null;
    record.repetitions = newFields.repetitions ?? null;
    record.sets = newFields.sets ?? null;
    record.calculatedStimulus = computed.rawStimulus;
    record.calculatedBPT = computed.totalGainBPT;
    record.gainBreakdown = newGain;
    Storage.updateWorkoutRecord(record);

    if (category === "strength") this.recomputeBaseline(exerciseDef.id);

    const asset = Storage.getAssetBySeason(seasonId);
    const delta = {
      cardio: newGain.cardio - oldGain.cardio,
      strength: newGain.strength - oldGain.strength,
      endurance: newGain.endurance - oldGain.endurance,
    };
    return {
      record, oldGain, newGain, delta, deltaTotal: computed.totalGainBPT - oldGainTotal,
      newAssetTotal: asset.cardio + asset.strength + asset.endurance,
    };
  },

  /**
   * 運動記録を削除し、その記録が資産に与えていた影響を打ち消す。
   */
  deleteWorkout(recordId) {
    const record = Storage.getWorkoutRecords().find(r => r.id === recordId);
    if (!record) return null;
    const category = record.category;
    const seasonId = record.seasonId;
    const dateKey = record.date.slice(0, 10);
    const oldGain = record.gainBreakdown || { cardio: 0, strength: 0, endurance: 0 };
    const delta = { cardio: -oldGain.cardio, strength: -oldGain.strength, endurance: -oldGain.endurance };
    const deltaTotal = delta.cardio + delta.strength + delta.endurance;

    this.applyDeltaFromDate(seasonId, dateKey, delta, deltaTotal);
    Storage.deleteWorkoutRecord(recordId);
    if (category === "strength") this.recomputeBaseline(record.exerciseId);

    const asset = Storage.getAssetBySeason(seasonId);
    return { deletedRecord: record, delta, newAssetTotal: asset.cardio + asset.strength + asset.endurance };
  },

  /**
   * 指定日以降の資産スナップショット（推移グラフ・現在資産）にdeltaを反映し、
   * シーズンの最高/最低資産を再計算する。
   *
   * dateKey時点の資産履歴エントリが存在しない場合（例: これまで記録の無かった日に
   * 記録を移動した場合）は、直前のスナップショットを基準に新しいエントリを作成する。
   */
  applyDeltaFromDate(seasonId, dateKey, delta, deltaTotal) {
    const asset = Storage.getAssetBySeason(seasonId);
    asset.cardio += delta.cardio;
    asset.strength += delta.strength;
    asset.endurance += delta.endurance;
    asset.updatedAt = new Date().toISOString();
    Storage.saveAssetForSeason(seasonId, asset);

    const fullHistory = Storage.getAssetHistory();
    const seasonHistory = fullHistory.filter(h => h.seasonId === seasonId);
    const entryAtDate = seasonHistory.find(h => h.date === dateKey);

    if (entryAtDate) {
      entryAtDate.cardio += delta.cardio;
      entryAtDate.strength += delta.strength;
      entryAtDate.endurance += delta.endurance;
      entryAtDate.total += deltaTotal;
      entryAtDate.gainCardio = (entryAtDate.gainCardio || 0) + delta.cardio;
      entryAtDate.gainStrength = (entryAtDate.gainStrength || 0) + delta.strength;
      entryAtDate.gainEndurance = (entryAtDate.gainEndurance || 0) + delta.endurance;
      entryAtDate.dailyGain = (entryAtDate.dailyGain || 0) + deltaTotal;
    } else {
      // 直前の既存スナップショット（無ければシーズン初期値）を基準に新規エントリを作る
      const priorEntries = seasonHistory.filter(h => h.date < dateKey).sort((a, b) => b.date.localeCompare(a.date));
      const base = priorEntries[0]
        ? { cardio: priorEntries[0].cardio, strength: priorEntries[0].strength, endurance: priorEntries[0].endurance }
        : { cardio: CONFIG.INITIAL_ASSET.cardio, strength: CONFIG.INITIAL_ASSET.strength, endurance: CONFIG.INITIAL_ASSET.endurance };
      const newSnapshot = {
        cardio: base.cardio + delta.cardio,
        strength: base.strength + delta.strength,
        endurance: base.endurance + delta.endurance,
      };
      fullHistory.push(Models.createAssetHistoryEntry(seasonId, dateKey, newSnapshot, delta, {}));
    }

    // dateKeyより後のすべてのエントリのスナップショットにもdeltaを伝播する（累積値のため）
    fullHistory.forEach(h => {
      if (h.seasonId === seasonId && h.date > dateKey) {
        h.cardio += delta.cardio;
        h.strength += delta.strength;
        h.endurance += delta.endurance;
        h.total += deltaTotal;
      }
    });

    Storage.saveAssetHistory(fullHistory);

    const season = Storage.getSeason(seasonId);
    this.recomputeSeasonExtremes(season);
  },

  /** シーズンの最高/最低/現在資産を、資産履歴全体を見直して再計算する */
  recomputeSeasonExtremes(season) {
    const history = Storage.getAssetHistoryBySeason(season.id);
    const asset = Storage.getAssetBySeason(season.id);
    const currentTotal = asset.cardio + asset.strength + asset.endurance;
    const totals = [season.initialAsset, currentTotal, ...history.map(h => h.total)];
    season.currentAsset = currentTotal;
    season.highestAsset = Math.max(...totals);
    season.lowestAsset = Math.min(...totals);
    Storage.upsertSeason(season);
  },

  /** ある日付「より前」の記録から、その種目の基準値（推定1RM最大値）を求める */
  baselineBeforeDate(exerciseId, dateIso, excludeRecordId) {
    const records = Storage.getWorkoutRecords().filter(r =>
      r.exerciseId === exerciseId && r.category === "strength" && r.id !== excludeRecordId && r.date < dateIso
    );
    let best = 0;
    records.forEach(r => {
      const est = estimated1RMOf(r);
      if (est > best) best = est;
    });
    return best > 0 ? best : null;
  },

  /** 記録全体から基準値（自己ベスト）を再計算する。編集・削除のたびに呼び出す */
  recomputeBaseline(exerciseId) {
    const records = Storage.getWorkoutRecords().filter(r => r.exerciseId === exerciseId && r.category === "strength");
    let best = 0;
    records.forEach(r => {
      const est = estimated1RMOf(r);
      if (est > best) best = est;
    });
    if (best > 0) {
      Storage.updateBaseline(exerciseId, { value: best, updatedAt: new Date().toISOString() });
    } else {
      const baselines = Storage.getBaselines();
      delete baselines[exerciseId];
      Storage.saveBaselines(baselines);
    }
  },
};

function estimated1RMOf(record) {
  const w = Number(record.weight) || 0;
  const reps = Number(record.repetitions) || 0;
  return w * (1 + reps / CONFIG.STRENGTH.EPLEY_REP_DIVISOR);
}

function findExerciseDefById(exerciseId) {
  return [...EXERCISES.cardio, ...EXERCISES.strength].find(e => e.id === exerciseId);
}

function withinLastNDaysOfDate(isoDate, referenceIso, n) {
  const d = new Date(isoDate);
  const ref = new Date(referenceIso);
  const diffMs = ref - d;
  return diffMs >= 0 && diffMs <= n * 24 * 60 * 60 * 1000;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BptCalculator;
}
