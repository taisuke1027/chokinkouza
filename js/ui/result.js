/**
 * result.js — 積立結果画面（21章、29章: 計算結果の透明性）
 * ①対応: 一度に複数の運動を記録した場合はまとめた合計と内訳を表示する。
 */
const ResultView = {
  /**
   * @param {Array<object>} results BptCalculator.processWorkout の戻り値の配列（exerciseDef付き）
   */
  showBatch(results) {
    const totalGainBPT = results.reduce((s, r) => s + r.totalGainBPT, 0);
    const gain = results.reduce((acc, r) => ({
      cardio: acc.cardio + r.gain.cardio,
      strength: acc.strength + r.gain.strength,
      endurance: acc.endurance + r.gain.endurance,
    }), { cardio: 0, strength: 0, endurance: 0 });
    const newAssetTotal = results[results.length - 1].newAssetTotal;
    const before = newAssetTotal - totalGainBPT;
    const isNewHigh = results.some(r => r.isNewHigh);
    const newBestNames = results
      .filter(r => r.baselineUpdateInfo && r.baselineUpdateInfo.isNewBest)
      .map(r => r.exerciseDef.name);
    const isSingle = results.length === 1;

    const praise = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];
    const mascotBody = nextMascotBody();

    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay" id="resultOverlay">
        <div class="result-sheet">
          <div class="praise-banner">
            <span class="praise-star praise-star-1">${icon("star", { size: 13 })}</span>
            <span class="praise-star praise-star-2">${icon("star", { size: 9 })}</span>
            <span class="praise-star praise-star-3">${icon("star", { size: 11 })}</span>
            ${praise}
          </div>

          <img src="${mascotBody.file}" alt="しばまる" class="result-mascot-body" />

          <div class="complete-label">積み立て完了</div>
          <div class="gain-amount num">${Fmt.signedBpt(totalGainBPT)} BPT</div>
          <div class="small-muted">${isSingle ? results[0].exerciseDef.name : `${results.length}件の運動を記録しました`}</div>

          ${isNewHigh ? `<div class="hanko">${icon("medal", { size: 15 })} 過去最高更新</div>` : ""}
          ${newBestNames.length > 0 ? `<div class="hanko">${icon("star", { size: 14 })} 自己ベスト更新：${newBestNames.join("、")}</div>` : ""}

          <div class="hr-dash"></div>

          ${!isSingle ? `
            <div style="text-align:left;">
              ${results.map(r => this.row(r.exerciseDef.name, r.totalGainBPT)).join("")}
            </div>
            <div class="hr-dash"></div>
          ` : ""}

          <div style="text-align:left;">
            ${gain.cardio > 0.01 ? this.row("心肺", gain.cardio) : ""}
            ${gain.strength > 0.01 ? this.row("筋力", gain.strength) : ""}
            ${gain.endurance > 0.01 ? this.row("筋持久力", gain.endurance) : ""}
          </div>

          <div class="asset-transition">
            <span class="num">${Fmt.bpt(before)}</span>
            <span class="arrow">→</span>
            <span class="to num">${Fmt.bpt(newAssetTotal)}</span>
          </div>

          ${isSingle ? `
            <button class="detail-toggle" id="toggleDetail">計算の内訳を見る ▾</button>
            <div class="calc-detail" id="calcDetail" style="display:none;">
              ${this.renderFormulas(results[0].details, results[0].record)}
              <div class="hr-dash" style="margin:10px 0;"></div>
              ${this.renderDetails(results[0].details)}
            </div>
          ` : ""}

          <div style="margin-top:22px; display:flex; flex-direction:column; gap:10px;">
            <button class="btn-primary" id="closeResultBtn">ホームへ戻る</button>
            <button class="btn-secondary" id="anotherResultBtn">続けて記録する</button>
          </div>
        </div>
      </div>
    `);

    root.appendChild(overlay);

    const toggleBtn = document.getElementById("toggleDetail");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        const d = document.getElementById("calcDetail");
        const isHidden = d.style.display === "none";
        d.style.display = isHidden ? "block" : "none";
        e.target.textContent = isHidden ? "計算の内訳を隠す ▴" : "計算の内訳を見る ▾";
      });
    }
    document.getElementById("closeResultBtn").addEventListener("click", () => {
      overlay.remove();
      Router.go("home");
    });
    document.getElementById("anotherResultBtn").addEventListener("click", () => {
      overlay.remove();
      Router.go("record");
    });
  },

  /**
   * 実際の入力値・計算過程を、具体的な数値を入れた計算式として表示する
   * （29章: 計算結果の透明性）。
   */
  renderFormulas(d, record) {
    const round1 = (n) => Math.round(n * 10) / 10;
    const round2 = (n) => Math.round(n * 100) / 100;

    if (d.category === "cardio") {
      const unitPrice = CONFIG.CARDIO.STIMULUS_TO_BPT;
      const bptFromStimulus = round1(d.effectiveStimulus * unitPrice);
      return `
        <div class="formula-box">
          <div class="fx-line">強度係数(METs近似) = ${d.mets}</div>
          <div class="fx-line">心肺刺激量 = 時間(${record.duration ?? "-"}分) × 強度係数(${d.mets}) × 頻度補正(${d.frequencyFactor})</div>
          <div class="fx-line">          = ${d.rawStimulus}（逓減前）</div>
          <div class="fx-line">逓減後の刺激量 = ${d.rawStimulus} × 適用率(${d.diminishingApplied}) = ${d.effectiveStimulus}</div>
          <div class="fx-line">心肺BPT = ${d.effectiveStimulus} × 心肺単価(${unitPrice}) = ${bptFromStimulus}</div>
          <div class="fx-note">筋持久力への配分がある場合は、この心肺BPTとは別に、同じ単価(${unitPrice})で按分されます。</div>
        </div>
      `;
    }

    // strength
    const unitPrice = CONFIG.STRENGTH.STIMULUS_TO_BPT;
    const bptFromStimulus = round1(d.effectiveStimulus * unitPrice);
    return `
      <div class="formula-box">
        <div class="fx-line">推定1RM = 重量(${record.weight ?? "-"}kg) × (1 + 回数(${record.repetitions ?? "-"}) ÷ 30)</div>
        <div class="fx-line">        = ${d.estimated1RM}kg</div>
        <div class="fx-line">相対強度 = 今回の推定1RM ÷ 自己ベスト1RM = ${d.relativeIntensity}</div>
        <div class="fx-line">筋力刺激量 = セット数(${record.sets ?? "-"}) × 回数(${record.repetitions ?? "-"}) × 相対強度(${d.relativeIntensity}) × 対象筋群係数(${d.groupCoefficient})</div>
        <div class="fx-line">          = ${d.rawStimulus}（逓減前）</div>
        <div class="fx-line">逓減後の刺激量 = ${d.rawStimulus} × 適用率(${d.diminishingApplied}) = ${d.effectiveStimulus}</div>
        <div class="fx-line">筋力BPT = ${d.effectiveStimulus} × 筋力単価(${unitPrice}) = ${bptFromStimulus}</div>
        <div class="fx-note">${d.isHighRep ? "高反復（20回超）のため、一部が筋持久力へ按分されています。" : ""}</div>
      </div>
    `;
  },

  row(label, val) {
    return `<div class="breakdown-row"><span>${label}</span><span class="amt num">${Fmt.signedBpt(val)}</span></div>`;
  },

  renderDetails(d) {
    const labelMap = {
      category: "種別",
      rawStimulus: "刺激量（逓減前）",
      effectiveStimulus: "刺激量（逓減後）",
      diminishingApplied: "逓減の適用率",
      mets: "運動強度（METs近似）",
      intensityFactor: "強度係数",
      frequencyFactor: "頻度補正",
      baseStimulus: "基礎刺激量",
      relativeIntensity: "相対強度",
      groupCoefficient: "対象筋群係数",
      repWeight: "反復重み",
      volumeLoad: "ボリューム（セット×回数）",
      estimated1RM: "推定1RM(kg)",
      isHighRep: "高反復判定",
    };
    return Object.entries(d)
      .filter(([k]) => k !== "category")
      .map(([k, v]) => `<div class="cd-row"><span>${labelMap[k] || k}</span><b>${typeof v === "boolean" ? (v ? "はい" : "いいえ") : v}</b></div>`)
      .join("");
  }
};
