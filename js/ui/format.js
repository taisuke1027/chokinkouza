/**
 * format.js — 表示用フォーマッタ
 */
const Fmt = {
  bpt(n) {
    const rounded = Math.round(n);
    return rounded.toLocaleString("ja-JP");
  },
  /** 軸ラベルなど、限られたスペース用に「万」単位で短縮表示する */
  compactBpt(n) {
    const rounded = Math.round(n);
    if (Math.abs(rounded) >= 10000) {
      return (rounded / 10000).toFixed(rounded % 10000 === 0 ? 0 : 1) + "万";
    }
    return rounded.toLocaleString("ja-JP");
  },
  signedBpt(n) {
    const rounded = Math.round(n);
    const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "±";
    return sign + rounded.toLocaleString("ja-JP");
  },
  pct(n, digits = 1) {
    return (n * 100).toFixed(digits) + "%";
  },
  dateJp(isoOrDateStr) {
    const d = new Date(isoOrDateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },
  dateFullJp(isoOrDateStr) {
    const d = new Date(isoOrDateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },
  daysBetween(a, b) {
    const da = new Date(a); const db = new Date(b || new Date());
    return Math.round((db - da) / (24 * 60 * 60 * 1000));
  }
};

function showToast(message, ms = 2200) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
