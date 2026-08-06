/**
 * app.js — アプリのエントリーポイント
 */
const AppState = {
  user: null,
  season: null,

  init() {
    const { user, season } = SeasonManager.initUserAndSeason();
    this.user = user;
    this.season = season;

    // 前回起動からの未適用の減価をここで一括反映（12章）
    const prevAssetSnapshot = this.getAsset();
    const decayResult = SeasonManager.applyPendingDecay(this.season);
    this.season = Storage.getSeason(this.season.id); // 更新後の値を取り直す

    // 前日比表示のため、起動時点の資産をスナップショットしておく
    const stored = Storage.getPrevDayAsset();
    if (!stored || stored.date !== todayStr()) {
      Storage.setPrevDayAsset({
        date: todayStr(),
        cardio: prevAssetSnapshot.cardio,
        strength: prevAssetSnapshot.strength,
        endurance: prevAssetSnapshot.endurance,
        total: prevAssetSnapshot.cardio + prevAssetSnapshot.strength + prevAssetSnapshot.endurance,
      });
    }

    this.recomputeHabitScore();

    if (decayResult.applied && decayResult.totalDecay.total < -1) {
      // 減価が発生した場合、静かに通知する（脅すようなトーンにはしない）
      setTimeout(() => showToast(`資産が更新されました（${Fmt.signedBpt(decayResult.totalDecay.total)} BPT）`), 600);
    }
  },

  getAsset() {
    return Storage.getAssetBySeason(this.season.id);
  },

  getAssetTotal() {
    const a = this.getAsset();
    return a.cardio + a.strength + a.endurance;
  },

  getPrevDayTotal() {
    const stored = Storage.getPrevDayAsset();
    return stored ? stored.total : this.getAssetTotal();
  },

  getPrevDaySnapshot() {
    const stored = Storage.getPrevDayAsset();
    const asset = this.getAsset();
    return stored || { cardio: asset.cardio, strength: asset.strength, endurance: asset.endurance, total: this.getAssetTotal() };
  },

  // ---- 習慣スコア ----
  currentWeekStart(dateStr = todayStr()) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay(); // 0=Sun
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diffToMonday);
    return todayStr(d);
  },

  computeConsecutiveWeeks() {
    // 直近から遡って、運動記録が1件以上ある週が連続している数を数える
    const records = Storage.getWorkoutRecordsBySeason(this.season.id);
    if (records.length === 0) return 0;
    let weeks = 0;
    let cursor = this.currentWeekStart();
    for (let i = 0; i < 52; i++) {
      const weekEnd = addDaysStr(cursor, 6);
      const hasRecord = records.some(r => {
        const d = r.date.slice(0, 10);
        return d >= cursor && d <= weekEnd;
      });
      if (!hasRecord) break;
      weeks += 1;
      cursor = addDaysStr(cursor, -7);
    }
    return weeks;
  },

  recomputeHabitScore() {
    const weekStart = this.currentWeekStart();
    const weekEnd = addDaysStr(weekStart, 6);
    const records = Storage.getWorkoutRecordsBySeason(this.season.id)
      .filter(r => {
        const d = r.date.slice(0, 10);
        return d >= weekStart && d <= weekEnd;
      });
    const consecutiveWeeks = this.computeConsecutiveWeeks();
    const result = HabitCalculator.calculateWeeklyScore(records, consecutiveWeeks);
    const entry = Models.createHabitScore(this.season.id, weekStart);
    Object.assign(entry, result);
    Storage.upsertHabitScore(entry);
    return entry;
  },

  getHabitScore() {
    return Storage.getLatestHabitScore(this.season.id) || this.recomputeHabitScore();
  },
};

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

document.addEventListener("DOMContentLoaded", () => {
  const splashStart = Date.now();

  // しばまるの「走るコマ送りアニメーション」を開始する
  const splashMascotEl = document.getElementById("splashMascot");
  const RUN_FRAME_COUNT = 8;
  const RUN_FRAME_INTERVAL_MS = 90;
  let runFrameTimer = null;
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (splashMascotEl && !prefersReducedMotion) {
    let frame = 1;
    runFrameTimer = setInterval(() => {
      frame = (frame % RUN_FRAME_COUNT) + 1;
      splashMascotEl.src = `icons/mascot/run/run_${String(frame).padStart(2, "0")}.png`;
    }, RUN_FRAME_INTERVAL_MS);
  }

  AppState.init();
  Router.init();

  // スプラッシュは最低でも一定時間は表示し、パッと消えないようにする
  const MIN_SPLASH_MS = 2000;
  const elapsed = Date.now() - splashStart;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  setTimeout(() => {
    if (runFrameTimer) clearInterval(runFrameTimer);
    const splash = document.getElementById("splashScreen");
    if (splash) {
      splash.classList.add("splash-hidden");
      setTimeout(() => splash.remove(), 450);
    }
  }, remaining);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(err => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
});
