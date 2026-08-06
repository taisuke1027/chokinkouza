/**
 * seasonManager.js
 * ------------------------------------------------------------------
 * シーズンのライフサイクル管理（17〜18章）と、
 * アプリ起動時に行う「未適用日数分の減価」の適用（12章）。
 * ------------------------------------------------------------------
 */

const SeasonManager = {
  initUserAndSeason() {
    let user = Storage.getUser();
    if (!user) {
      user = Models.createUser();
      Storage.saveUser(user);
    }
    let season = user.currentSeasonId ? Storage.getSeason(user.currentSeasonId) : null;
    if (!season) {
      season = this.startNewSeason(user, 1);
    }
    return { user, season };
  },

  startNewSeason(user, seasonNumber) {
    const season = Models.createSeason(seasonNumber, user.id);
    Storage.upsertSeason(season);
    const asset = Models.createAsset(season.id);
    Storage.saveAssetForSeason(season.id, asset);
    user.currentSeasonId = season.id;
    Storage.saveUser(user);
    Storage.setLastDecayDate(todayStr());
    Storage.upsertAssetHistoryEntry(
      Models.createAssetHistoryEntry(season.id, todayStr(), Storage.getAssetBySeason(season.id), {}, {})
    );
    return season;
  },

  /**
   * 現在のシーズンを終了し、記録を保存（Season 1 のデータは完全に保存する、17章）。
   * その後、新しいシーズンを開始する。
   */
  endCurrentSeasonAndStartNext() {
    const user = Storage.getUser();
    const season = Storage.getSeason(user.currentSeasonId);
    season.status = "ended";
    season.endDate = new Date().toISOString();
    Storage.upsertSeason(season);
    return this.startNewSeason(user, season.seasonNumber + 1);
  },

  getAllSeasons(userId) {
    return Storage.getSeasons()
      .filter(s => s.userId === userId)
      .sort((a, b) => b.seasonNumber - a.seasonNumber);
  },

  /**
   * シーズン開始日から今日まで、資産の推移を最初から計算し直す。
   *
   * 過去に減価（デトレーニング）の計算に不具合があった場合など、既存の
   * 資産履歴に誤りが蓄積してしまったケースの救済用。運動記録そのもの
   * （各記録が獲得したBPT内訳）は正しい前提とし、日々の減価だけを
   * 現在の正しいロジックで再計算して、資産履歴・現在資産・シーズンの
   * 最高/最低資産をすべて作り直す。
   */
  recalculateSeasonHistory(seasonId) {
    const season = Storage.getSeason(seasonId);
    if (!season) return null;
    const records = Storage.getWorkoutRecordsBySeason(seasonId);
    const startDateKey = season.startDate.slice(0, 10);
    const endDateKey = todayStr();

    // 日付ごとの獲得BPT内訳・素の刺激量を集計する（獲得側は元々正しく計算されているため
    // 記録に保存済みの gainBreakdown / calculatedStimulus をそのまま使う）
    const gainsByDate = {};
    const stimulusByDate = {};
    records.forEach(r => {
      const dateKey = r.date.slice(0, 10);
      const g = r.gainBreakdown || { cardio: 0, strength: 0, endurance: 0 };
      if (!gainsByDate[dateKey]) gainsByDate[dateKey] = { cardio: 0, strength: 0, endurance: 0 };
      gainsByDate[dateKey].cardio += g.cardio;
      gainsByDate[dateKey].strength += g.strength;
      gainsByDate[dateKey].endurance += g.endurance;
      stimulusByDate[dateKey] = (stimulusByDate[dateKey] || 0) + (r.calculatedStimulus || 0);
    });

    let working = {
      cardio: CONFIG.INITIAL_ASSET.cardio,
      strength: CONFIG.INITIAL_ASSET.strength,
      endurance: CONFIG.INITIAL_ASSET.endurance,
    };
    let highestAsset = working.cardio + working.strength + working.endurance;
    let lowestAsset = highestAsset;
    let inactiveStreak = 0;

    const newHistory = [];
    let cursor = startDateKey;
    let isFirstDay = true;

    while (cursor <= endDateKey) {
      const gain = gainsByDate[cursor] || { cardio: 0, strength: 0, endurance: 0 };
      const dayStimulus = stimulusByDate[cursor] || 0;
      const hadLightActivity = dayStimulus >= CONFIG.DECAY.LIGHT_ACTIVITY_STIMULUS_THRESHOLD;

      let decay = { cardio: 0, strength: 0, endurance: 0 };
      if (isFirstDay) {
        // シーズン初日は減価なし（この日を基準に無活動日数を数え始める）
        inactiveStreak = hadLightActivity ? 0 : 0;
      } else if (hadLightActivity) {
        inactiveStreak = 0;
      } else {
        const dayDecay = DecayCalculator.calculateDecay(working, inactiveStreak, 1, Storage.getPressureLevel());
        decay = { cardio: -dayDecay.cardio, strength: -dayDecay.strength, endurance: -dayDecay.endurance };
        working.cardio += dayDecay.cardio;
        working.strength += dayDecay.strength;
        working.endurance += dayDecay.endurance;
        inactiveStreak += 1;
      }

      working.cardio += gain.cardio;
      working.strength += gain.strength;
      working.endurance += gain.endurance;

      const total = working.cardio + working.strength + working.endurance;
      if (total > highestAsset) highestAsset = total;
      if (total < lowestAsset) lowestAsset = total;

      const hasEvent = gain.cardio || gain.strength || gain.endurance || decay.cardio || decay.strength || decay.endurance;
      if (hasEvent || isFirstDay) {
        newHistory.push(Models.createAssetHistoryEntry(seasonId, cursor, working, gain, decay));
      }

      isFirstDay = false;
      cursor = addDays(cursor, 1);
    }

    // このシーズンの既存履歴をすべて置き換える
    const otherSeasonsHistory = Storage.getAssetHistory().filter(h => h.seasonId !== seasonId);
    Storage.saveAssetHistory([...otherSeasonsHistory, ...newHistory]);

    // 資産・シーズンの最終値を反映する
    const assetRecord = Storage.getAssetBySeason(seasonId);
    assetRecord.cardio = working.cardio;
    assetRecord.strength = working.strength;
    assetRecord.endurance = working.endurance;
    assetRecord.updatedAt = new Date().toISOString();
    Storage.saveAssetForSeason(seasonId, assetRecord);

    season.currentAsset = working.cardio + working.strength + working.endurance;
    season.highestAsset = highestAsset;
    season.lowestAsset = lowestAsset;
    Storage.upsertSeason(season);

    Storage.setLastDecayDate(todayStr());

    return { newTotal: season.currentAsset, entriesCreated: newHistory.length };
  },

  /**
   * アプリ起動時に呼び出す。前回チェック日から今日までの未適用の減価を、
   * 「軽い運動があった日はリセット」しながら適用する。
   */
  applyPendingDecay(season) {
    const lastDecayDate = Storage.getLastDecayDate() || todayStr();
    const daysDiff = dateDiffInDays(lastDecayDate, todayStr());
    if (daysDiff <= 0) return { applied: false };

    const asset = Storage.getAssetBySeason(season.id);
    const records = Storage.getWorkoutRecordsBySeason(season.id);

    // lastDecayDate の翌日から今日まで、1日ずつ処理する
    // （各日に「軽い運動以上の活動」があれば無活動カウントをリセット）
    let inactiveStreak = computeInactiveStreakBefore(lastDecayDate, records, season.startDate.slice(0, 10));
    let cursor = addDays(lastDecayDate, 1);
    let totalDecay = { cardio: 0, strength: 0, endurance: 0, total: 0 };

    for (let i = 0; i < daysDiff; i++) {
      const dateKey = cursor;
      const dayStimulus = sumStimulusForDate(records, dateKey);
      const hadLightActivity = dayStimulus >= CONFIG.DECAY.LIGHT_ACTIVITY_STIMULUS_THRESHOLD;

      if (hadLightActivity) {
        inactiveStreak = 0;
        // 運動があった日は、その運動記録側で履歴が既に更新されているためここでは何もしない
      } else {
        const dayDecay = DecayCalculator.calculateDecay(asset, inactiveStreak, 1, Storage.getPressureLevel());
        asset.cardio += dayDecay.cardio;
        asset.strength += dayDecay.strength;
        asset.endurance += dayDecay.endurance;
        totalDecay.cardio += dayDecay.cardio;
        totalDecay.strength += dayDecay.strength;
        totalDecay.endurance += dayDecay.endurance;
        totalDecay.total += dayDecay.total;
        inactiveStreak += 1;

        // 履歴ページの「支出」集計用に、カテゴリ別の減少量を正の値として記録する
        Storage.upsertAssetHistoryEntry(
          Models.createAssetHistoryEntry(season.id, dateKey, asset, {}, {
            cardio: -dayDecay.cardio,
            strength: -dayDecay.strength,
            endurance: -dayDecay.endurance,
          })
        );
      }

      cursor = addDays(cursor, 1);
    }

    asset.updatedAt = new Date().toISOString();
    Storage.saveAssetForSeason(season.id, asset);

    const newTotal = asset.cardio + asset.strength + asset.endurance;
    season.currentAsset = newTotal;
    if (newTotal < season.lowestAsset) season.lowestAsset = newTotal;
    Storage.upsertSeason(season);

    Storage.setLastDecayDate(todayStr());

    return { applied: true, totalDecay, newTotal };
  },
};

function sumStimulusForDate(records, dateKey) {
  return records
    .filter(r => r.date.slice(0, 10) === dateKey)
    .reduce((sum, r) => sum + (r.calculatedStimulus || 0), 0);
}

function computeInactiveStreakBefore(dateKey, records, seasonStartDateKey) {
  // dateKey時点までの直近の連続無活動日数を概算する（軽い運動閾値を基準）。
  // シーズン開始日より前は「無活動」としてカウントしない
  // （記録が少ない/無いシーズンで無活動日数が実態より過大に見積もられ、
  //   本来0〜3日は減価しないはずが即座に強い減価になってしまうバグを防ぐ）。
  let streak = 0;
  let cursor = dateKey;
  for (let i = 0; i < 60; i++) {
    if (seasonStartDateKey && cursor < seasonStartDateKey) break;
    const stim = sumStimulusForDate(records, cursor);
    if (stim >= CONFIG.DECAY.LIGHT_ACTIVITY_STIMULUS_THRESHOLD) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

function dateDiffInDays(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SeasonManager;
}
