// Pure-JS signal processing — smoothing, peak detection, integration
// Used by both dsc_analysis and demonstrator COP analysis in the browser.

window.DSP = (() => {

  function linspace(start, end, n) {
    const arr = new Float64Array(n);
    const step = (end - start) / (n - 1);
    for (let i = 0; i < n; i++) arr[i] = start + step * i;
    return arr;
  }

  // Savitzky-Golay smoothing (window=11, poly=3) — simple convolution coefficients
  function smooth(y, halfWin = 5) {
    const n = y.length;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - halfWin); j <= Math.min(n - 1, i + halfWin); j++) {
        sum += y[j]; count++;
      }
      out[i] = sum / count;
    }
    return out;
  }

  // Trapezoidal integration
  function trapz(x, y) {
    let s = 0;
    for (let i = 1; i < x.length; i++) s += (y[i] + y[i - 1]) / 2 * (x[i] - x[i - 1]);
    return s;
  }

  // Find dominant peak (max absolute deviation from mean) — returns index
  function findPeakIndex(y) {
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    let best = 0, bestVal = -Infinity;
    for (let i = 0; i < y.length; i++) {
      const v = Math.abs(y[i] - mean);
      if (v > bestVal) { bestVal = v; best = i; }
    }
    return best;
  }

  // DSC analysis: returns { tOnset, tOffset, deltaH_J_g, deltaS_mJ_gK, tStarK }
  function analyzeDSC(tempArr, heatFlowArr) {
    const T  = Float64Array.from(tempArr);
    const HF = smooth(Float64Array.from(heatFlowArr));

    const peakIdx = findPeakIndex(HF);
    const mean    = HF.reduce((a, b) => a + b, 0) / HF.length;
    const std     = Math.sqrt(HF.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / HF.length);
    const threshold = mean + std * 0.5;

    // Walk outward from peak to find onset / offset
    let onset = peakIdx, offset = peakIdx;
    for (let i = peakIdx; i >= 0;  i--) { if (Math.abs(HF[i] - mean) > threshold * 0.1) onset  = i; else break; }
    for (let i = peakIdx; i < T.length; i++) { if (Math.abs(HF[i] - mean) > threshold * 0.1) offset = i; else break; }

    const tOnset  = T[onset];
    const tOffset = T[offset];
    const tStarK  = (tOnset + tOffset) / 2 + 273.15;

    // Linear baseline subtraction then integrate
    const seg_T  = Array.from(T.slice(onset, offset + 1));
    const seg_HF = Array.from(HF.slice(onset, offset + 1));
    const n = seg_T.length;
    const baseline = seg_HF.map((_, i) => seg_HF[0] + (seg_HF[n - 1] - seg_HF[0]) * (i / Math.max(n - 1, 1)));
    const corrected = seg_HF.map((v, i) => v - baseline[i]);

    const deltaH = Math.abs(trapz(seg_T, corrected));  // J/g (mW/mg * °C = mJ/mg = J/g)
    const deltaS = deltaH / tStarK * 1000;              // mJ g⁻¹ K⁻¹

    return {
      tOnset:       +tOnset.toFixed(2),
      tOffset:      +tOffset.toFixed(2),
      tStarK:       +tStarK.toFixed(2),
      deltaH_J_g:   +deltaH.toFixed(3),
      deltaS_mJ_gK: +deltaS.toFixed(3),
      smoothedT:  Array.from(T),
      smoothedHF: Array.from(HF),
      peakRegion: { onset, offset },
    };
  }

  // Stress-strain analysis
  function analyzeTensile(strainArr, stressArr) {
    const strain = Float64Array.from(strainArr);
    const stress = Float64Array.from(stressArr);
    const n = strain.length;

    // Initial modulus from linear region (first 5%)
    let linEnd = 0;
    while (linEnd < n - 1 && strain[linEnd] < 5) linEnd++;
    let E_kPa = NaN;
    if (linEnd > 1) {
      // least-squares slope
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i <= linEnd; i++) {
        const x = strain[i] / 100, y = stress[i] * 1000;
        sx += x; sy += y; sxy += x * y; sx2 += x * x;
      }
      const m = linEnd + 1;
      E_kPa = (m * sxy - sx * sy) / (m * sx2 - sx * sx);
    }

    const half = Math.floor(n / 2);
    const loading  = { s: Array.from(strain.slice(0, half)), st: Array.from(stress.slice(0, half)) };
    const unloading = { s: Array.from(strain.slice(half)).reverse(), st: Array.from(stress.slice(half)).reverse() };

    // Hysteresis: area between loading and unloading curves (approximate)
    const hysteresis = Math.abs(
      trapz(loading.s, loading.st) - trapz(unloading.s, unloading.st)
    );

    return {
      E_kPa:         isNaN(E_kPa) ? null : +E_kPa.toFixed(1),
      stressMax_MPa: +Math.max(...stress).toFixed(3),
      strainMax_pct: +Math.max(...strain).toFixed(1),
      hysteresis_MJ_m3: +hysteresis.toFixed(4),
    };
  }

  // Detect cycles from force signal (zero-crossing of derivative)
  function detectCycles(force, minCycleLen = 5) {
    const d = force.map((v, i) => i === 0 ? 0 : v - force[i - 1]);
    const cycles = [];
    let i = 0;
    while (i < d.length - 1) {
      if (d[i] >= 0 && d[i + 1] < 0) {
        let j = i + 1;
        while (j < d.length - 1 && !(d[j] < 0 && d[j + 1] >= 0)) j++;
        if (j - i >= minCycleLen) cycles.push([i, j]);
        i = j;
      } else i++;
    }
    return cycles;
  }

  // COP analysis from demonstrator log
  function analyzeDemonstrator(rows, filmMass_g = 1.0) {
    const ts    = rows.map(r => +r.timestamp_s);
    const Tc    = rows.map(r => +r.T_cold_C);
    const Th    = rows.map(r => +r.T_hot_C);
    const force = rows.map(r => +r.force_N);
    const disp  = rows.map(r => +r.displacement_mm * 1e-3);
    const power = rows.map(r => +r.power_W);

    const cycles = detectCycles(force);
    if (!cycles.length) return null;

    const results = cycles.map(([s, e]) => {
      const seg = { ts: ts.slice(s, e), Tc: Tc.slice(s, e), Th: Th.slice(s, e), force: force.slice(s, e), disp: disp.slice(s, e), power: power.slice(s, e) };
      const n = seg.ts.length;

      const W_mech = Math.abs(trapz(seg.disp, seg.force));
      const W_elec = trapz(seg.ts, seg.power);
      const W = Math.max(W_mech, W_elec);

      const cp = 1.5; // J g⁻¹ K⁻¹ for elastomers
      const deltaT_cold = Math.max(...seg.Tc) - Math.min(...seg.Tc);
      const Q_cold = filmMass_g * cp * deltaT_cold;

      const T_cold_K = seg.Tc.reduce((a, b) => a + b, 0) / n + 273.15;
      const T_hot_K  = seg.Th.reduce((a, b) => a + b, 0) / n + 273.15;
      const span = T_hot_K - T_cold_K;

      const COP_device  = W > 1e-6 ? Q_cold / W : 0;
      const COP_Carnot  = span > 0.01 ? T_cold_K / span : 0;
      const eta         = COP_Carnot > 0 ? COP_device / COP_Carnot : 0;

      return { W_mech_J: +W_mech.toFixed(4), Q_cold_J: +Q_cold.toFixed(4), COP_device: +COP_device.toFixed(3), COP_Carnot: +COP_Carnot.toFixed(3), eta_2nd_law: +eta.toFixed(3), T_cold_mean_C: +(T_cold_K - 273.15).toFixed(2), T_hot_mean_C: +(T_hot_K - 273.15).toFixed(2), delta_T_span_K: +span.toFixed(2) };
    });

    const mean = key => results.reduce((a, r) => a + r[key], 0) / results.length;

    return {
      cycles: results.length,
      results,
      meanCOP:     +mean('COP_device').toFixed(3),
      meanCarnot:  +mean('COP_Carnot').toFixed(3),
      meanEta:     +(mean('eta_2nd_law') * 100).toFixed(1),
      meanSpan:    +mean('delta_T_span_K').toFixed(2),
    };
  }

  // Parse generic CSV string → array of objects
  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => !l.startsWith('#') && l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ? vals[i].trim() : ''; });
      return obj;
    });
  }

  return { analyzeDSC, analyzeTensile, analyzeDemonstrator, parseCSV, smooth };
})();
