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
    const padY = 10;

    if (!points || points.length === 0) {
      return `<div class="empty-state"><div class="icon">📉</div><p>まだ資産の推移データがありません。<br>運動を記録すると、ここにグラフが表示されます。</p></div>`;
    }

    const allVals = points.flatMap(p => series.map(s => p.values[s.key] ?? 0));
    let min = Math.min(...allVals);
    let max = Math.max(...allVals);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const stepX = points.length > 1 ? width / (points.length - 1) : 0;

    const seriesPaths = series.map(s => {
      const coords = points.map((p, i) => {
        const x = i * stepX;
        const v = p.values[s.key] ?? 0;
        const y = padY + (1 - (v - min) / range) * (height - padY * 2);
        return [x, y];
      });
      const d = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
      const areaD = s.showArea
        ? d + ` L${coords[coords.length - 1][0].toFixed(1)},${height} L0,${height} Z`
        : null;
      return { d, areaD, color: s.color, key: s.key };
    });

    const gridLines = [0.25, 0.5, 0.75].map(f => {
      const y = padY + f * (height - padY * 2);
      return `<line class="gridline" x1="0" y1="${y}" x2="${width}" y2="${y}" />`;
    }).join("");

    const lastPoint = points[points.length - 1];
    const dots = series.map(s => {
      const v = lastPoint.values[s.key] ?? 0;
      const x = (points.length - 1) * stepX;
      const y = padY + (1 - (v - min) / range) * (height - padY * 2);
      return `<circle class="dot" cx="${x}" cy="${y}" r="3.5" style="fill:${s.color}" />`;
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
    const padY = 10;

    if (!points || points.length === 0) {
      return `<div class="empty-state"><div class="icon">📉</div><p>まだ資産の推移データがありません。<br>運動を記録すると、ここにグラフが表示されます。</p></div>`;
    }

    const totals = points.map(p => layers.reduce((sum, l) => sum + (p.values[l.key] || 0), 0));
    const max = Math.max(...totals, 1);
    const min = 0;
    const range = (max - min) || 1;
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;

    const toY = (v) => padY + (1 - (v - min) / range) * (height - padY * 2);

    let running = new Array(points.length).fill(0);
    const layerPaths = layers.map(layer => {
      const baseVals = running.slice();
      const topVals = points.map((p, i) => running[i] + (p.values[layer.key] || 0));
      running = topVals;

      const topCoords = topVals.map((v, i) => [i * stepX, toY(v)]);
      const baseCoords = baseVals.map((v, i) => [i * stepX, toY(v)]);

      let d = topCoords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
      for (let i = baseCoords.length - 1; i >= 0; i--) {
        d += ` L${baseCoords[i][0].toFixed(1)},${baseCoords[i][1].toFixed(1)}`;
      }
      d += " Z";

      const lineD = topCoords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");

      return { areaD: d, lineD, color: layer.color };
    });

    const gridLines = [0.25, 0.5, 0.75].map(f => {
      const y = padY + f * (height - padY * 2);
      return `<line class="gridline" x1="0" y1="${y}" x2="${width}" y2="${y}" />`;
    }).join("");

    return `
      <svg class="stacked-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${gridLines}
        ${layerPaths.map(lp => `<path d="${lp.areaD}" fill="${lp.color}" opacity="0.55" />`).join("")}
        ${layerPaths.map(lp => `<path class="stack-line" d="${lp.lineD}" style="stroke:${lp.color}" />`).join("")}
      </svg>
      <div class="stack-legend">
        ${layers.map(l => `<div class="stack-legend-item"><span class="stack-legend-swatch" style="background:${l.color}"></span>${l.label}</div>`).join("")}
      </div>
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
      return `<div class="empty-state"><div class="icon">🥧</div><p>データがありません。</p></div>`;
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
