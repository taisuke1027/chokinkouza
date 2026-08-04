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
    let inactiveStreak = computeInactiveStreakBefore(lastDecayDate, records);
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
        const dayDecay = DecayCalculator.calculateDecay(asset, inactiveStreak, 1);
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

function computeInactiveStreakBefore(dateKey, records) {
  // dateKey時点までの直近の連続無活動日数を概算する（軽い運動閾値を基準）
  let streak = 0;
  let cursor = dateKey;
  for (let i = 0; i < 60; i++) {
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
