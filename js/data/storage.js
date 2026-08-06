/**
 * storage.js
 * ------------------------------------------------------------------
 * localStorage を用いた永続化レイヤー。
 * オフラインでも基本機能（記録・資産確認）が使えるようにするため、
 * サーバー通信を前提としない構造にしてある（33章 ⑤）。
 *
 * 将来バックエンドに置き換える場合も、Storage の公開APIの形は
 * 変えずに中身だけ差し替えられるようにしている。
 * ------------------------------------------------------------------
 */

const STORAGE_PREFIX = "chikutate.";

const Storage = {
  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Storage read error", key, e);
      return fallback;
    }
  },
  _set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage write error", key, e);
    }
  },

  // ---- User ----
  getUser() { return this._get("user", null); },
  saveUser(user) { this._set("user", user); },

  // ---- Seasons (配列) ----
  getSeasons() { return this._get("seasons", []); },
  saveSeasons(seasons) { this._set("seasons", seasons); },
  getSeason(seasonId) { return this.getSeasons().find(s => s.id === seasonId) || null; },
  upsertSeason(season) {
    const seasons = this.getSeasons();
    const idx = seasons.findIndex(s => s.id === season.id);
    if (idx >= 0) seasons[idx] = season; else seasons.push(season);
    this.saveSeasons(seasons);
  },

  // ---- Assets (seasonId -> asset, 1シーズン1レコード) ----
  getAssets() { return this._get("assets", {}); },
  saveAssets(assets) { this._set("assets", assets); },
  getAssetBySeason(seasonId) {
    const existing = this.getAssets()[seasonId];
    if (existing) return existing;
    // 何らかの理由（不整合なデータ、旧バージョンからの移行など）で
    // そのシーズンの資産データが見つからない場合、初期資産を作って自己修復する。
    // クラッシュさせるより、ユーザーには気づかれない形で復旧させる方が良い。
    console.warn("Asset data missing for season", seasonId, "- recreating with initial values.");
    const fresh = Models.createAsset(seasonId);
    this.saveAssetForSeason(seasonId, fresh);
    return this.getAssets()[seasonId];
  },
  saveAssetForSeason(seasonId, asset) {
    const assets = this.getAssets();
    assets[seasonId] = Models.serializeAsset(asset);
    this.saveAssets(assets);
  },

  // ---- WorkoutRecords (配列) ----
  getWorkoutRecords() { return this._get("workoutRecords", []); },
  saveWorkoutRecords(records) { this._set("workoutRecords", records); },
  addWorkoutRecord(record) {
    const records = this.getWorkoutRecords();
    records.push(record);
    this.saveWorkoutRecords(records);
  },
  updateWorkoutRecord(record) {
    const records = this.getWorkoutRecords();
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    this.saveWorkoutRecords(records);
  },
  deleteWorkoutRecord(recordId) {
    this.saveWorkoutRecords(this.getWorkoutRecords().filter(r => r.id !== recordId));
  },
  getWorkoutRecordsBySeason(seasonId) {
    return this.getWorkoutRecords().filter(r => r.seasonId === seasonId);
  },

  // ---- HabitScores (配列) ----
  getHabitScores() { return this._get("habitScores", []); },
  saveHabitScores(list) { this._set("habitScores", list); },
  upsertHabitScore(entry) {
    const list = this.getHabitScores();
    const idx = list.findIndex(h => h.seasonId === entry.seasonId && h.weekStart === entry.weekStart);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    this.saveHabitScores(list);
  },
  getLatestHabitScore(seasonId) {
    const list = this.getHabitScores().filter(h => h.seasonId === seasonId);
    if (list.length === 0) return null;
    return list.sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  },

  // ---- AssetHistory (配列、日次) ----
  getAssetHistory() { return this._get("assetHistory", []); },
  saveAssetHistory(list) { this._set("assetHistory", list); },
  getAssetHistoryBySeason(seasonId) {
    return this.getAssetHistory().filter(h => h.seasonId === seasonId).sort((a, b) => a.date.localeCompare(b.date));
  },
  upsertAssetHistoryEntry(entry) {
    const list = this.getAssetHistory();
    const idx = list.findIndex(h => h.seasonId === entry.seasonId && h.date === entry.date);
    if (idx >= 0) {
      // 同日は増減フローを合算し、資産スナップショットは最新値で上書きする
      const existing = list[idx];
      existing.dailyGain = (existing.dailyGain || 0) + entry.dailyGain;
      existing.dailyDecay = (existing.dailyDecay || 0) + entry.dailyDecay;
      existing.gainCardio = (existing.gainCardio || 0) + (entry.gainCardio || 0);
      existing.gainStrength = (existing.gainStrength || 0) + (entry.gainStrength || 0);
      existing.gainEndurance = (existing.gainEndurance || 0) + (entry.gainEndurance || 0);
      existing.decayCardio = (existing.decayCardio || 0) + (entry.decayCardio || 0);
      existing.decayStrength = (existing.decayStrength || 0) + (entry.decayStrength || 0);
      existing.decayEndurance = (existing.decayEndurance || 0) + (entry.decayEndurance || 0);
      existing.cardio = entry.cardio;
      existing.strength = entry.strength;
      existing.endurance = entry.endurance;
      existing.total = entry.total;
    } else {
      list.push(entry);
    }
    this.saveAssetHistory(list);
  },

  // ---- プレッシャーレベル（減価倍率、ユーザー設定） ----
  getPressureLevel() {
    const v = this._get("pressureLevel", CONFIG.DECAY.PRESSURE_LEVEL.DEFAULT);
    return typeof v === "number" ? v : CONFIG.DECAY.PRESSURE_LEVEL.DEFAULT;
  },
  setPressureLevel(value) {
    const clamped = Math.min(CONFIG.DECAY.PRESSURE_LEVEL.MAX, Math.max(CONFIG.DECAY.PRESSURE_LEVEL.MIN, Number(value)));
    this._set("pressureLevel", clamped);
  },

  // ---- 記録結果画面のマスコット全身ポーズ（交互表示の記憶） ----
  getLastMascotBodyIndex() {
    const v = this._get("lastMascotBodyIndex", -1);
    return typeof v === "number" ? v : -1;
  },
  setLastMascotBodyIndex(i) { this._set("lastMascotBodyIndex", i); },

  // ---- 運動メニュー（事前登録テンプレート） ----
  getTemplates() {
    const raw = this._get("templates", []);
    // 以前のバージョン（1メニュー=1種目）で保存されたデータが残っていても
    // 壊れないよう、読み込み時に新しいスキーマ（items配列）へ変換する
    return raw.map(t => this._normalizeTemplate(t));
  },
  _normalizeTemplate(t) {
    if (t && Array.isArray(t.items)) return t;
    if (!t) return { id: uid("tpl"), name: "メニュー", items: [], createdAt: new Date().toISOString() };
    return {
      id: t.id || uid("tpl"),
      name: t.name || "メニュー",
      items: t.exerciseId ? [{ category: t.category, exerciseId: t.exerciseId, fields: t.fields || {} }] : [],
      createdAt: t.createdAt || new Date().toISOString(),
    };
  },
  saveTemplates(list) { this._set("templates", list); },
  addTemplate(template) {
    const list = this.getTemplates();
    list.push(template);
    this.saveTemplates(list);
  },
  deleteTemplate(templateId) {
    this.saveTemplates(this.getTemplates().filter(t => t.id !== templateId));
  },

  // ---- 個人能力基準値（10章: 過去の自分との比較） ----
  // exerciseId ごとに、これまで観測した実績から「現在の基準値」を保持する。
  getBaselines() { return this._get("baselines", {}); },
  saveBaselines(b) { this._set("baselines", b); },
  getBaseline(exerciseId) { return this.getBaselines()[exerciseId] || null; },
  updateBaseline(exerciseId, value) {
    const baselines = this.getBaselines();
    baselines[exerciseId] = value;
    this.saveBaselines(baselines);
  },

  // ---- 最終減価適用日（デトレーニング計算の基準） ----
  getLastDecayDate() { return this._get("lastDecayDate", null); },
  setLastDecayDate(dateStr) { this._set("lastDecayDate", dateStr); },

  // ---- 資産の直近サマリ（前日比表示用） ----
  getPrevDayAsset() { return this._get("prevDayAsset", null); },
  setPrevDayAsset(v) { this._set("prevDayAsset", v); },

  // ---- 全データ削除（デバッグ／リセット用） ----
  resetAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
