/**
 * chart.js — 依存ライブラリなしのシンプルなSVG折れ線グラフ
 */
const ChartUI = {
  /**
   * @param {Array<{date:string, values:{[series:string]:number}}>} points
   * @param {Array<{key:string, color:string}>} series
   * @param {object} opts { width, height, showArea }
   */
  renderSVG(points, series, opts = {}) {
    const width = opts.width || 320;
    const height = opts.height || 160;
    const padLeft = 40;
    const padRight = 4;
    const padTop = 10;
    const padBottom = 18;

    if (!points || points.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("trendDown", { size: 26 })}</div><p>まだ資産の推移データがありません。<br>運動を記録すると、ここにグラフが表示されます。</p></div>`;
    }

    const allVals = points.flatMap(p => series.map(s => p.values[s.key] ?? 0));
    let min = Math.min(...allVals);
    let max = Math.max(...allVals);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    const toX = (i) => padLeft + i * stepX;
    const toY = (v) => padTop + (1 - (v - min) / range) * plotH;

    const seriesPaths = series.map(s => {
      const coords = points.map((p, i) => [toX(i), toY(p.values[s.key] ?? 0)]);
      const d = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
      const areaD = s.showArea
        ? d + ` L${coords[coords.length - 1][0].toFixed(1)},${padTop + plotH} L${padLeft},${padTop + plotH} Z`
        : null;
      return { d, areaD, color: s.color, key: s.key };
    });

    // ---- 縦軸（Y軸）: 最大・中間・最小の目盛りとラベル ----
    const yTicks = [0, 0.5, 1].map(f => {
      const y = padTop + f * plotH;
      const val = max - f * range;
      return { y, val };
    });
    const gridLines = yTicks.map(t =>
      `<line class="gridline" x1="${padLeft}" y1="${t.y.toFixed(1)}" x2="${width - padRight}" y2="${t.y.toFixed(1)}" />`
    ).join("");
    const yLabels = yTicks.map(t =>
      `<text x="${padLeft - 6}" y="${t.y.toFixed(1)}" text-anchor="end" dominant-baseline="central" font-size="9.5" fill="#9BA0A6">${Fmt.compactBpt(t.val)}</text>`
    ).join("");

    // ---- 横軸（X軸）: 最初・中間・最後の日付ラベル ----
    const xTickIdx = points.length > 1
      ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
      : [0];
    const uniqueXIdx = [...new Set(xTickIdx)];
    const xLabels = uniqueXIdx.map((i, k) => {
      const anchor = k === 0 ? "start" : (k === uniqueXIdx.length - 1 ? "end" : "middle");
      return `<text x="${toX(i).toFixed(1)}" y="${height - 3}" text-anchor="${anchor}" font-size="9.5" fill="#9BA0A6">${Fmt.dateJp(points[i].date)}</text>`;
    }).join("");

    const lastPoint = points[points.length - 1];
    const dots = series.map(s => {
      const v = lastPoint.values[s.key] ?? 0;
      return `<circle class="dot" cx="${toX(points.length - 1).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="3.5" style="fill:${s.color}" />`;
    }).join("");

    return `
      <svg class="asset-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#A9803F" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#A9803F" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${gridLines}
        ${seriesPaths.map(sp => sp.areaD ? `<path class="area" d="${sp.areaD}" />` : "").join("")}
        ${seriesPaths.map(sp => `<path class="line" d="${sp.d}" style="stroke:${sp.color}" />`).join("")}
        ${dots}
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  },

  /**
   * 積み上げ面グラフ（複数シリーズを積算して描画する）
   * @param {Array<{date:string, values:{[key:string]:number}}>} points
   * @param {Array<{key:string, color:string, label:string}>} layers 下から積む順に指定
   */
  renderStackedArea(points, layers, opts = {}) {
    const width = opts.width || 320;
    const height = opts.height || 180;
    const padLeft = 40;
    const padRight = 4;
    const padTop = 10;
    const padBottom = 18;

    if (!points || points.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("trendDown", { size: 26 })}</div><p>まだ資産の推移データがありません。<br>運動を記録すると、ここにグラフが表示されます。</p></div>`;
    }

    const totals = points.map(p => layers.reduce((sum, l) => sum + (p.values[l.key] || 0), 0));
    const max = Math.max(...totals, 1);
    const min = 0;
    const range = (max - min) || 1;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    const toX = (i) => padLeft + i * stepX;
    const toY = (v) => padTop + (1 - (v - min) / range) * plotH;

    let running = new Array(points.length).fill(0);
    const layerPaths = layers.map(layer => {
      const baseVals = running.slice();
      const topVals = points.map((p, i) => running[i] + (p.values[layer.key] || 0));
      running = topVals;

      const topCoords = topVals.map((v, i) => [toX(i), toY(v)]);
      const baseCoords = baseVals.map((v, i) => [toX(i), toY(v)]);

      let d = topCoords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
      for (let i = baseCoords.length - 1; i >= 0; i--) {
        d += ` L${baseCoords[i][0].toFixed(1)},${baseCoords[i][1].toFixed(1)}`;
      }
      d += " Z";

      const lineD = topCoords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");

      return { areaD: d, lineD, color: layer.color };
    });

    const yTicks = [0, 0.5, 1].map(f => {
      const y = padTop + f * plotH;
      const val = max - f * range;
      return { y, val };
    });
    const gridLines = yTicks.map(t =>
      `<line class="gridline" x1="${padLeft}" y1="${t.y.toFixed(1)}" x2="${width - padRight}" y2="${t.y.toFixed(1)}" />`
    ).join("");
    const yLabels = yTicks.map(t =>
      `<text x="${padLeft - 6}" y="${t.y.toFixed(1)}" text-anchor="end" dominant-baseline="central" font-size="9.5" fill="#9BA0A6">${Fmt.compactBpt(t.val)}</text>`
    ).join("");

    const xTickIdx = points.length > 1
      ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
      : [0];
    const uniqueXIdx = [...new Set(xTickIdx)];
    const xLabels = uniqueXIdx.map((i, k) => {
      const anchor = k === 0 ? "start" : (k === uniqueXIdx.length - 1 ? "end" : "middle");
      return `<text x="${toX(i).toFixed(1)}" y="${height - 3}" text-anchor="${anchor}" font-size="9.5" fill="#9BA0A6">${Fmt.dateJp(points[i].date)}</text>`;
    }).join("");

    return `
      <svg class="stacked-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${gridLines}
        ${layerPaths.map(lp => `<path d="${lp.areaD}" fill="${lp.color}" opacity="0.55" />`).join("")}
        ${layerPaths.map(lp => `<path class="stack-line" d="${lp.lineD}" style="stroke:${lp.color}" />`).join("")}
        ${yLabels}
        ${xLabels}
      </svg>
      <div class="stack-legend">
        ${layers.map(l => `<div class="stack-legend-item"><span class="stack-legend-swatch" style="background:${l.color}"></span>${l.label}</div>`).join("")}
      </div>
    `;
  },

  /**
   * 複数の系列を1つのグラフに重ねて表示する折れ線グラフ（凡例付き）。
   * @param {Array<{date:string, values:{[key:string]:number}}>} points
   * @param {Array<{key:string, color:string, label:string, width?:number}>} series
   */
  renderMultiLine(points, series, opts = {}) {
    const width = opts.width || 320;
    const height = opts.height || 180;
    const padLeft = 40;
    const padRight = 4;
    const padTop = 10;
    const padBottom = 18;

    if (!points || points.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("trendDown", { size: 26 })}</div><p>まだ資産の推移データがありません。<br>運動を記録すると、ここにグラフが表示されます。</p></div>`;
    }

    const allVals = points.flatMap(p => series.map(s => p.values[s.key] ?? 0));
    let min = Math.min(...allVals);
    let max = Math.max(...allVals);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    const toX = (i) => padLeft + i * stepX;
    const toY = (v) => padTop + (1 - (v - min) / range) * plotH;

    const seriesPaths = series.map(s => {
      const coords = points.map((p, i) => [toX(i), toY(p.values[s.key] ?? 0)]);
      const d = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
      return { d, color: s.color, width: s.width || 2 };
    });

    const yTicks = [0, 0.5, 1].map(f => {
      const y = padTop + f * plotH;
      const val = max - f * range;
      return { y, val };
    });
    const gridLines = yTicks.map(t =>
      `<line class="gridline" x1="${padLeft}" y1="${t.y.toFixed(1)}" x2="${width - padRight}" y2="${t.y.toFixed(1)}" />`
    ).join("");
    const yLabels = yTicks.map(t =>
      `<text x="${padLeft - 6}" y="${t.y.toFixed(1)}" text-anchor="end" dominant-baseline="central" font-size="9.5" fill="#9BA0A6">${Fmt.compactBpt(t.val)}</text>`
    ).join("");

    const xTickIdx = points.length > 1
      ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
      : [0];
    const uniqueXIdx = [...new Set(xTickIdx)];
    const xLabels = uniqueXIdx.map((i, k) => {
      const anchor = k === 0 ? "start" : (k === uniqueXIdx.length - 1 ? "end" : "middle");
      return `<text x="${toX(i).toFixed(1)}" y="${height - 3}" text-anchor="${anchor}" font-size="9.5" fill="#9BA0A6">${Fmt.dateJp(points[i].date)}</text>`;
    }).join("");

    const dots = series.map(s => {
      const v = points[points.length - 1].values[s.key] ?? 0;
      return `<circle cx="${toX(points.length - 1).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="3" fill="${s.color}" />`;
    }).join("");

    const legend = `
      <div class="stack-legend">
        ${series.map(s => `<div class="stack-legend-item"><span class="stack-legend-swatch" style="background:${s.color}"></span>${s.label}</div>`).join("")}
      </div>
    `;

    return `
      <svg class="multiline-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${gridLines}
        ${seriesPaths.map(sp => `<path fill="none" stroke="${sp.color}" stroke-width="${sp.width}" d="${sp.d}" />`).join("")}
        ${dots}
        ${yLabels}
        ${xLabels}
      </svg>
      ${legend}
    `;
  },

  /**
   * ドーナツ（円）グラフ。conic-gradientベースでライブラリ不要。
   * @param {Array<{key:string, color:string, value:number}>} segments
   */
  renderDonut(segments, opts = {}) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    const stops = segments.map(seg => {
      const start = (acc / total) * 100;
      acc += seg.value;
      const end = (acc / total) * 100;
      return `${seg.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    }).join(", ");
    const gradient = `conic-gradient(${stops})`;
    const centerLabel = opts.centerLabel
      ? `<div class="donut-center-label"><div class="k">${opts.centerLabel.k}</div><div class="v num">${opts.centerLabel.v}</div></div>`
      : "";
    return `
      <div class="donut-wrap">
        <div class="donut-chart" style="background:${gradient}"></div>
        ${centerLabel}
      </div>
    `;
  },

  /**
   * ラベル・割合を直接図の上に表示する円グラフ（SVGベース）。
   * @param {Array<{key:string, color:string, value:number, label:string}>} segments
   * @param {object} opts { size, centerLabel:{k,v}, minPctForLabel }
   */
  renderPieWithLabels(segments, opts = {}) {
    const size = opts.size || 220;
    const cx = size / 2, cy = size / 2;
    const outerR = opts.outerR || size * 0.42;
    const innerR = opts.innerR ?? outerR * 0.56;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    // ラベルは短い割合表示のみにし、はみ出しを防ぐため十分な角度がある
    // スライスにだけ表示する（項目名は下の凡例リストで確認できる）
    const minPctForLabel = opts.minPctForLabel ?? 0.12;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const pointAt = (r, deg) => [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))];

    let cumDeg = -90;
    const active = segments.filter(s => s.value > 0);

    if (active.length === 0) {
      return `<div class="empty-state"><div class="icon">${icon("pie", { size: 26 })}</div><p>データがありません。</p></div>`;
    }

    // 1種目のみで100%を占める場合、conic-gradientと同様に円全体を描く
    const slices = active.map((seg, i) => {
      const pct = seg.value / total;
      let sweep = pct * 360;
      // 浮動小数の誤差で360ちょうどになりA-arcが描けなくなるのを防ぐ
      if (active.length === 1) sweep = 359.999;
      const startDeg = cumDeg;
      const endDeg = startDeg + sweep;
      cumDeg = endDeg;
      const largeArc = sweep > 180 ? 1 : 0;

      const [x1o, y1o] = pointAt(outerR, startDeg);
      const [x2o, y2o] = pointAt(outerR, endDeg);
      const [x1i, y1i] = pointAt(innerR, endDeg);
      const [x2i, y2i] = pointAt(innerR, startDeg);

      const path = `M ${x1o.toFixed(2)},${y1o.toFixed(2)} A ${outerR},${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)},${y2o.toFixed(2)} L ${x1i.toFixed(2)},${y1i.toFixed(2)} A ${innerR},${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)},${y2i.toFixed(2)} Z`;

      // ラベルはリング内側寄り（外周からはみ出しにくい位置）に置く
      const midDeg = (startDeg + endDeg) / 2;
      const labelR = innerR + (outerR - innerR) * 0.5;
      const [lx, ly] = pointAt(labelR, midDeg);

      return { seg, path, pct, lx, ly };
    });

    const pathsHtml = slices.map(s => `<path d="${s.path}" fill="${s.seg.color}" />`).join("");
    // 白フチ（stroke）を敷いてから塗りつぶすことで、どんな背景色の上でも視認できるようにする
    const labelsHtml = slices.filter(s => s.pct >= minPctForLabel).map(s => `
      <text x="${s.lx.toFixed(1)}" y="${s.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
        font-size="15" font-weight="800" fill="#ffffff"
        stroke="rgba(28,30,34,0.55)" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke fill">${Math.round(s.pct * 100)}%</text>
    `).join("");

    const centerHtml = opts.centerLabel ? `
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="10.5" fill="#9BA0A6">${opts.centerLabel.k}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="15" font-weight="800" fill="#23262B">${opts.centerLabel.v}</text>
    ` : "";

    return `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="width:100%; max-width:240px; height:auto; display:block; margin:0 auto;">
        ${pathsHtml}
        ${labelsHtml}
        ${centerHtml}
      </svg>
    `;
  }
};
