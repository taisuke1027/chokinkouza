/**
 * config.js
 * ------------------------------------------------------------------
 * 「積立貯筋口座」計算エンジンの設定値。
 *
 * すべての係数は 3層構造 で管理する（指示書 38章）。
 *
 *   [SCIENCE]         科学的に一定のコンセンサスがある事実・関係性
 *   [APP DEFINITION]  科学的知見をアプリ内でどう定式化するかというアプリ独自の設計判断
 *   [GAME BALANCE]    ゲームとしての手触り・バランスのために調整する数値
 *
 * UIやロジックにこの数値を直接ハードコードしないこと。
 * 必ずこのファイル (CONFIG) を経由して参照する。
 * ------------------------------------------------------------------
 */

const CONFIG = {

  // ============================================================
  // 初期資産 [APP DEFINITION]
  // 「人間は最初から身体資産を持っている」というゲーム上の表現。
  // この数値自体に医学的意味はない。
  // ============================================================
  INITIAL_ASSET: {
    cardio: 4000,
    strength: 4000,
    endurance: 2000,
    get total() {
      return this.cardio + this.strength + this.endurance;
    }
  },

  // ============================================================
  // 心肺資産エンジン
  // [SCIENCE] 有酸素運動の効果は FITT (Frequency/Intensity/Time/Type) と
  //           METs (運動強度の代謝当量) によって規定されることが
  //           運動処方の分野で広く合意されている (ACSM Guidelines)。
  // [APP DEFINITION] 心肺刺激量 = 時間 × METs相当強度 × 頻度補正 × 個人能力補正
  // [GAME BALANCE] 刺激量→BPTへの変換係数、逓減カーブの形状。
  // ============================================================
  CARDIO: {
    // [APP DEFINITION] 運動強度をMETs近似値で表現する係数（exercises.js 側で種目ごとに定義）
    // [GAME BALANCE] 刺激量1あたりに換算するBPT量
    STIMULUS_TO_BPT: 4.0,
    // [GAME BALANCE] 頻度補正: 直近7日間の実施回数に応じて微増（継続を評価する）
    FREQUENCY_BONUS_PER_SESSION: 0.02, // 1回につき+2%、上限あり
    FREQUENCY_BONUS_CAP: 0.20,
    // [GAME BALANCE] 個人能力補正の基準値からの伸び率上限（急激な変化を抑える）
    PERSONAL_ADJUST_MIN: 0.8,
    PERSONAL_ADJUST_MAX: 1.3,
  },

  // ============================================================
  // 筋力資産エンジン
  // [SCIENCE] 筋力適応は「量（セット×反復）」「相対強度（%1RM）」
  //           「対象筋群」に依存することが筋力トレーニング研究で
  //           広く支持されている (ACSM Progression Models, 2009 等)。
  // [APP DEFINITION] 筋力刺激量 = セット数 × 反復回数 × 相対強度係数
  //                   × 対象筋群係数 × 個人能力補正
  // [GAME BALANCE] 相対強度の推定式、変換係数。
  // ============================================================
  STRENGTH: {
    // [GAME BALANCE] 刺激量1あたりに換算するBPT量
    STIMULUS_TO_BPT: 25,
    // [APP DEFINITION] 推定1RMを使わずに「相対強度」を近似する場合の簡易モデル。
    //   Epley法に類する式で概算1RMを推定: 1RM ≈ weight × (1 + reps/30)
    EPLEY_REP_DIVISOR: 30,
    // [GAME BALANCE] 反復回数が多すぎる場合（筋持久力寄りの種目）の重み低減
    HIGH_REP_THRESHOLD: 20,
    HIGH_REP_STRENGTH_WEIGHT: 0.4, // 20回超の反復は筋力より筋持久力寄りとして扱う
    PERSONAL_ADJUST_MIN: 0.8,
    PERSONAL_ADJUST_MAX: 1.3,
  },

  // ============================================================
  // 筋持久力資産エンジン
  // [SCIENCE] 高反復・長時間の刺激は筋持久力（乳酸性作業閾値・毛細血管密度等）
  //           に主に寄与するとされる。
  // [APP DEFINITION] 高反復筋トレ・長時間有酸素運動の一部を筋持久力刺激として按分。
  // [GAME BALANCE] 按分比率。
  // ============================================================
  ENDURANCE: {
    // 筋持久力への配分は、元となった運動カテゴリの単価（CARDIO / STRENGTH の
    // STIMULUS_TO_BPT）をそのまま用いて換算する（別の単価を新設しない）。
    // これにより「同じ運動から生まれた価値の一部を別バケツに配分する」という
    // 経済的な一貫性を保つ。[APP DEFINITION]
    // [GAME BALANCE] 有酸素運動のうち何%を筋持久力刺激として計上するか
    CARDIO_SHARE_TO_ENDURANCE: 0.25,
    // [GAME BALANCE] 高反復筋トレのうち何%を筋持久力刺激として計上するか
    HIGH_REP_STRENGTH_SHARE_TO_ENDURANCE: 0.6,
  },

  // ============================================================
  // 逓減モデル（11章）
  // [SCIENCE] 単一セッション内で刺激量に対する適応反応は線形ではなく、
  //           一定量を超えると追加的な効果が縮小する傾向が示唆されている
  //           （漸減的なdose-response関係）。
  // [APP DEFINITION] 刺激量を区間に分け、区間ごとに異なる重みを掛けて合算する。
  // [GAME BALANCE] 区間の閾値と重み。将来調整可能。
  // ============================================================
  DIMINISHING_RETURNS: {
    // 区間は「基準刺激量」を1単位として、閾値（倍数）と、その区間にかかる重み
    TIERS: [
      { upTo: 1.0, weight: 1.00 }, // 最初の刺激: 100%
      { upTo: 2.0, weight: 0.70 }, // 追加刺激: 70%
      { upTo: 3.5, weight: 0.40 }, // さらに追加: 40%
      { upTo: Infinity, weight: 0.20 }, // それ以降: 20%
    ],
    // [GAME BALANCE] 「基準刺激量」の目安値（種目カテゴリごとにおおよそ1回の標準的セッション相当）
    BASE_UNIT: {
      cardio: 240,  // 概ね30分・中強度ウォーキング1回相当
      strength: 40, // 概ね1種目・3〜4セット相当
    }
  },

  // ============================================================
  // 減価モデル（12〜14章）
  // [SCIENCE] デトレーニング研究では、心肺機能（VO2max）は
  //           運動中止後、数日〜数週間の比較的早い段階から低下し始め、
  //           筋力は心肺機能より緩やかに保たれる傾向が報告されている
  //           （Mujika & Padilla, 2000; Sports Medicine のデトレーニング
  //           レビュー等）。ただし低下速度の正確な値は個人差が大きく、
  //           単一の確立された数式が存在するわけではない。
  // [APP DEFINITION] 休養日数に応じた区間別の減価率カーブを資産種別ごとに設定。
  //                   「軽い運動」を行った日は減価をリセット・緩和する。
  // [GAME BALANCE] 各区間の日数・減価率は本モデル独自の設定値であり、
  //                 今後の知見更新やバランス調整で変更されうる。
  // ============================================================
  DECAY: {
    // 資産種別ごとの減価速度係数（大きいほど早く減る）[APP DEFINITION + GAME BALANCE]
    SPEED_FACTOR: {
      cardio: 1.2,     // 心肺は比較的早く変化
      strength: 0.6,   // 筋力はより緩やか
      endurance: 0.9,  // 中間程度
    },
    // 無活動日数に応じた減価カーブ（区間ごとの「1日あたり減価率」）[GAME BALANCE]
    // ユーザーとの調整により、緊張感を重視して基準値の10倍の強さに設定（2026-08時点）
    CURVE: [
      { fromDay: 0, toDay: 3, dailyRate: 0.0000 },   // 0〜3日: ほぼ維持
      { fromDay: 4, toDay: 7, dailyRate: 0.0060 },   // 4〜7日: 緩やかな減価
      { fromDay: 8, toDay: 14, dailyRate: 0.0150 },  // 8〜14日: 徐々に減価率上昇
      { fromDay: 15, toDay: 30, dailyRate: 0.0250 }, // 15〜30日: さらに上昇
      { fromDay: 31, toDay: Infinity, dailyRate: 0.0350 }, // 長期無活動
    ],
    // [GAME BALANCE] 「プレッシャーレベル」: ユーザーがホーム画面から任意で
    // 減価の強さをさらに引き上げられる倍率。CURVEの値がすでに基準（×1.0=最小値）
    // なので、ここでは1.0を下限として上振れのみを許容する。
    PRESSURE_LEVEL: {
      MIN: 1.0,
      MAX: 3.0,
      STEP: 0.5,
      DEFAULT: 1.0,
    },
    // [APP DEFINITION] 「軽い運動」とみなす最低刺激量。これを上回る活動があった日は
    //                   無活動カウントをリセットする。
    LIGHT_ACTIVITY_STIMULUS_THRESHOLD: 20,
  },

  // ============================================================
  // 習慣スコア（15章）
  // [APP DEFINITION] 週単位で「有酸素時間」「筋トレ日数」「達成率」「継続期間」から算出。
  // [GAME BALANCE] 各要素の重み・目標値。
  // ============================================================
  HABIT: {
    WEEKLY_CARDIO_MINUTES_GOAL: 150, // [SCIENCE] WHO/ACSM 等が目安とする週150分の中強度有酸素運動
    WEEKLY_STRENGTH_DAYS_GOAL: 2,    // [SCIENCE] WHO等が目安とする週2回以上の筋力トレーニング
    WEIGHTS: {
      cardioAchievement: 0.35,
      strengthAchievement: 0.35,
      consistency: 0.20, // 継続週数
      exerciseDays: 0.10,
    },
    CONSISTENCY_MAX_WEEKS: 12, // これ以上は満点扱い
  },

  // ============================================================
  // 習慣スコアのランク（バッジ表示用）[GAME BALANCE]
  // 銀行口座やクレジットカードの会員ランクに見立てた5段階。
  // ============================================================
  HABIT_RANKS: [
    { min: 0, max: 19, name: "ブロンズ", iconFile: "icons/ranks/bronze.png", color: "#8A5A32", bg: "#F1E4D8" },
    { min: 20, max: 39, name: "シルバー", iconFile: "icons/ranks/silver.png", color: "#5B6B7A", bg: "#E7EDF1" },
    { min: 40, max: 59, name: "ゴールド", iconFile: "icons/ranks/gold.png", color: "#9C7838", bg: "#F1E7D3" },
    { min: 60, max: 79, name: "プラチナ", iconFile: "icons/ranks/platinum.png", color: "#3E6E8E", bg: "#DCEAF0" },
    { min: 80, max: 100, name: "レジェンド", iconFile: "icons/ranks/legend.png", color: "#6B3FA0", bg: "#EBE0F5" },
  ],

  // ============================================================
  // 継続ボーナス（16章）
  // [APP DEFINITION] あくまでアプリ内のゲーム的ボーナスであり、
  //                   身体能力が「複利」で増えることを意味しない。
  // [GAME BALANCE]
  // ============================================================
  STREAK_BONUS: {
    MILESTONES: [
      { weeks: 4, bonusBPT: 5000, label: "4週継続ボーナス" },
      { weeks: 8, bonusBPT: 12000, label: "8週継続ボーナス" },
      { weeks: 12, bonusBPT: 20000, label: "12週継続ボーナス" },
    ]
  },
};

// ブラウザ / モジュールの両対応
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
