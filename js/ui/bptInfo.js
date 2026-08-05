/**
 * bptInfo.js — 「BPTとは」説明オーバーレイ
 */
const BptInfoView = {
  show() {
    const root = document.getElementById("overlayRoot");
    const overlay = el(`
      <div class="overlay">
        <div class="result-sheet" style="text-align:left;">
          <div class="edit-sheet-title">BPT（Body Point）とは</div>
          <div class="edit-sheet-sub">身体資産の単位</div>

          <div style="font-size:12.5px; color:var(--ink-soft); line-height:1.85; margin-top:10px;">
            <p style="margin:0 0 10px;">BPTは、あなたの運動記録をもとにアプリが独自に算出する「身体資産」の単位です。実際のお金や、特定の医学的測定値（筋肉量・VO₂max・消費カロリーなど）を直接表すものではありません。</p>
            <p style="margin:0 0 10px;">「運動＝身体への投資」というコンセプトのもと、運動によって得られる刺激と、身体が起こす適応を、積立残高のような形で可視化することを目的としています。</p>
          </div>

          <div class="calc-detail">
            <div class="cd-row"><span>増える理由</span><b>運動による刺激・適応</b></div>
            <div class="cd-row"><span>減る理由</span><b>デトレーニング（運動不足）</b></div>
            <div class="cd-row"><span>内訳</span><b>心肺・筋力・筋持久力</b></div>
          </div>

          <p class="small-muted" style="margin-top:12px; line-height:1.7;">
            具体的な計算式・科学的根拠は「その他」→「科学的根拠・計算方法」ページに詳しく記載しています。医学的な診断・治療・予後予測などの目的には使用しないでください。
          </p>

          <div class="edit-actions">
            <button class="btn-primary" id="bptInfoCloseBtn">閉じる</button>
            <button class="btn-secondary" id="bptInfoScienceBtn">科学的根拠ページを見る</button>
          </div>
        </div>
      </div>
    `);
    root.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("bptInfoCloseBtn").addEventListener("click", () => overlay.remove());
    document.getElementById("bptInfoScienceBtn").addEventListener("click", () => {
      overlay.remove();
      Router.go("science");
    });
  }
};
