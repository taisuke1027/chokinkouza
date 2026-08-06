/**
 * pressureInfo.js — プレッシャーレベル（減少係数）の説明・シミュレーション
 */
const PressureInfoView = {
  show() {
    const pressureLevel = Storage.getPressureLevel();
    const asset = AppState.getAsset();
    const startTotal = asset.cardio + asset.strength + asset.endurance;
    const days = 21;
    const rows = this.simulate(asset, pressureLevel, days);

    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">減少（デトレーニング）の仕組み</div>
          <div class="edit-sheet-sub">運動しない日が続くとどう減っていくか</div>

          <div style="font-size:12.5px; color:var(--ink-soft); line-height:1.8; margin-top:10px;">
            <p style="margin:0 0 8px;">運動をしない日が続くと、身体資産は少しずつ減少します（デトレーニング）。ただし「毎日やらないと減る」わけではありません。</p>
            <ul style="margin:0 0 8px; padding-left:18px;">
              <li>最初の0〜3日はほぼ変化しません</li>
              <li>4日目以降から緩やかに減少が始まり、8日目・15日目・31日目でさらに段階的に強くなります</li>
              <li>その日に運動を記録すれば、その日から無活動日数はリセットされます</li>
              <li>心肺が一番早く低下し、次に筋持久力、筋力が一番緩やかです</li>
            </ul>
            <p style="margin:0;">現在の「プレッシャーレベル」は <b class="num">×${pressureLevel.toFixed(1)}</b> です。下の表は、今のあなたの資産（<b class="num">${Fmt.bpt(startTotal)}</b> BPT）を基準に、運動を全くしなかった場合の推定シミュレーションです。</p>
          </div>

          <div class="sim-table-wrap">
            <table class="sim-table">
              <thead>
                <tr><th>日数</th><th>段階</th><th>その日</th><th>累計</th></tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td>${r.day}日目</td>
                    <td class="stage-label">${r.stage}</td>
                    <td class="negative num">${Fmt.signedBpt(r.dayDecay)}</td>
                    <td class="negative num">${Fmt.signedBpt(r.cumulative)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <p class="small-muted" style="line-height:1.6;">※ 実際の値は、その時点の資産構成（心肺・筋力・筋持久力の内訳）によって多少変わります。</p>

          <div class="edit-actions">
            <button class="btn-primary" id="pressureInfoCloseBtn">閉じる</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("pressureInfoCloseBtn").addEventListener("click", () => overlay.remove());
  },

  /** 現在の資産・プレッシャーレベルを基準に、無活動が続いた場合の推移をシミュレーションする */
  simulate(baseAsset, pressureLevel, days) {
    let asset = { cardio: baseAsset.cardio, strength: baseAsset.strength, endurance: baseAsset.endurance };
    let cumulative = 0;
    const rows = [];
    for (let day = 0; day < days; day++) {
      const dayDecay = DecayCalculator.calculateDecay(asset, day, 1, pressureLevel);
      asset.cardio += dayDecay.cardio;
      asset.strength += dayDecay.strength;
      asset.endurance += dayDecay.endurance;
      cumulative += dayDecay.total;
      const stage = day <= 3 ? "維持" : day <= 7 ? "緩やか" : day <= 14 ? "やや上昇" : day <= 30 ? "上昇" : "最大";
      rows.push({ day: day + 1, stage, dayDecay: dayDecay.total, cumulative });
    }
    return rows;
  }
};
