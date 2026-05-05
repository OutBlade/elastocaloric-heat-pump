// EC-Lab — Analysis tab: DSC, Stress-Strain, Demonstrator Log, Material Calculator

(() => {
  const CHART_OPT = {
    animation: false, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#7a9cc8', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#4a6280', maxTicksLimit: 8 }, grid: { color: '#1e2d3d' } },
      y: { ticks: { color: '#7a9cc8' }, grid: { color: '#1e2d3d' } },
    },
  };

  let dscChart = null, tensileChart = null;
  let demoCOPChart = null, demoSpanChart = null, demoEtaChart = null;
  let matChart = null;

  function initCharts() {
    dscChart = new Chart(document.getElementById('chart-dsc'), {
      type: 'line', data: { datasets: [] },
      options: { ...CHART_OPT, parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: { ...CHART_OPT.scales,
          x: { ...CHART_OPT.scales.x, type: 'linear', title: { display: true, text: 'Temperature (°C)', color: '#7a9cc8' } },
          y: { ...CHART_OPT.scales.y, title: { display: true, text: 'Heat Flow (mW mg⁻¹)', color: '#7a9cc8' } } } },
    });
    tensileChart = new Chart(document.getElementById('chart-tensile'), {
      type: 'line', data: { datasets: [] },
      options: { ...CHART_OPT, parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: { ...CHART_OPT.scales,
          x: { ...CHART_OPT.scales.x, type: 'linear', title: { display: true, text: 'Strain (%)', color: '#7a9cc8' } },
          y: { ...CHART_OPT.scales.y, title: { display: true, text: 'Stress (MPa)', color: '#7a9cc8' } } } },
    });
    const barOpt = { ...CHART_OPT, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#4a6280' }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#7a9cc8' }, grid: { color: '#1e2d3d' }, beginAtZero: true } } };
    demoCOPChart  = new Chart(document.getElementById('chart-demo-cop'),  { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#00d4aa66', borderColor: '#00d4aa', borderWidth: 1 }] }, options: barOpt });
    demoSpanChart = new Chart(document.getElementById('chart-demo-span'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#4db6ff44', borderColor: '#4db6ff', borderWidth: 1 }] }, options: barOpt });
    demoEtaChart  = new Chart(document.getElementById('chart-demo-eta'),  { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#c084fc44', borderColor: '#c084fc', borderWidth: 1 }] }, options: barOpt });

    matChart = new Chart(document.getElementById('chart-mat-calc'), {
      type: 'bar', data: { labels: [], datasets: [] },
      options: { ...CHART_OPT, indexAxis: 'y', plugins: { legend: { labels: { color: '#7a9cc8', font: { size: 10 } } } },
        scales: { x: { ticks: { color: '#4a6280' }, grid: { color: '#1e2d3d' }, beginAtZero: true }, y: { ticks: { color: '#7a9cc8', font: { size: 11 } }, grid: { color: '#1e2d3d' } } } },
    });
  }

  // ── Helper: load CSV from file or pasted text ──────────────────────────────
  async function loadCSV(pasteAreaId, filenameId, btnId) {
    // If paste area has content, use that; otherwise open file dialog
    const pasteArea = document.getElementById(pasteAreaId);
    if (pasteArea && pasteArea.value.trim()) {
      return { content: pasteArea.value.trim(), name: 'pasted data' };
    }
    const filePath = await window.api.fs.openFile([{ name: 'CSV', extensions: ['csv'] }]);
    if (!filePath) return null;
    const { ok, content, error } = await window.api.fs.readCsv(filePath);
    if (!ok) { alert(`Could not read file: ${error}`); return null; }
    document.getElementById(filenameId).textContent = filePath.split(/[\\/]/).pop();
    return { content, name: filePath.split(/[\\/]/).pop() };
  }

  // ── DSC ────────────────────────────────────────────────────────────────────
  document.getElementById('btn-load-dsc').addEventListener('click', async () => {
    const res = await loadCSV('paste-dsc', 'dsc-filename', 'btn-load-dsc');
    if (!res) return;
    document.getElementById('dsc-filename').textContent = res.name;

    const rows = DSP.parseCSV(res.content);
    if (!rows.length) { alert('No data found.'); return; }
    const tempCol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('temp'));
    const hfCol   = Object.keys(rows[0]).find(k => k.toLowerCase().includes('heat') || k.toLowerCase().includes('flow'));
    if (!tempCol || !hfCol) { alert('CSV must have columns: temperature_C, heat_flow_mW_mg'); return; }

    const temps = rows.map(r => +r[tempCol]);
    const hf    = rows.map(r => +r[hfCol]);
    const result = DSP.analyzeDSC(temps, hf);

    document.getElementById('dsc-t-onset').textContent = result.tOnset;
    document.getElementById('dsc-t-offset').textContent = result.tOffset;
    document.getElementById('dsc-dh').textContent = result.deltaH_J_g;
    document.getElementById('dsc-ds').textContent = result.deltaS_mJ_gK;
    document.getElementById('dsc-tstar').textContent = result.tStarK;
    document.getElementById('dsc-results').classList.remove('hidden');

    dscChart.data.datasets = [
      { label: 'DSC signal', data: result.smoothedT.map((x, i) => ({ x, y: result.smoothedHF[i] })), borderColor: '#4db6ff', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: `Peak  ΔH=${result.deltaH_J_g} J/g`, data: result.smoothedT.slice(result.peakRegion.onset, result.peakRegion.offset + 1).map((x, i) => ({ x, y: result.smoothedHF[result.peakRegion.onset + i] })), borderColor: '#ffb347', backgroundColor: '#ffb34733', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 },
    ];
    dscChart.update();

    // Auto-fill material calculator with DSC results
    document.getElementById('mat-dh').value    = result.deltaH_J_g;
    document.getElementById('mat-tstar').value = result.tStarK;
    addCalcHint('DSC values auto-filled into Material Calculator below.');
  });

  // ── Tensile ────────────────────────────────────────────────────────────────
  document.getElementById('btn-load-tensile').addEventListener('click', async () => {
    const res = await loadCSV('paste-tensile', 'tensile-filename', 'btn-load-tensile');
    if (!res) return;
    document.getElementById('tensile-filename').textContent = res.name;

    const rows = DSP.parseCSV(res.content);
    const strainCol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('strain'));
    const stressCol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('stress'));
    if (!strainCol || !stressCol) { alert('CSV must have columns: strain_pct, stress_MPa'); return; }

    const strain = rows.map(r => +r[strainCol]);
    const stress = rows.map(r => +r[stressCol]);
    const result = DSP.analyzeTensile(strain, stress);

    document.getElementById('ten-modulus').textContent    = result.E_kPa ?? '—';
    document.getElementById('ten-stress-max').textContent = result.stressMax_MPa;
    document.getElementById('ten-strain-max').textContent = result.strainMax_pct;
    document.getElementById('ten-hysteresis').textContent = result.hysteresis_MJ_m3;
    document.getElementById('tensile-results').classList.remove('hidden');

    tensileChart.data.datasets = [
      { label: 'Stress–Strain', data: strain.map((x, i) => ({ x, y: stress[i] })), borderColor: '#ff4d6d', backgroundColor: '#ff4d6d22', borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.3 },
    ];
    tensileChart.update();
  });

  // ── Demonstrator log ───────────────────────────────────────────────────────
  document.getElementById('btn-load-demo').addEventListener('click', async () => {
    const res = await loadCSV('paste-demo', 'demo-filename', 'btn-load-demo');
    if (!res) return;
    document.getElementById('demo-filename').textContent = res.name;

    const rows = DSP.parseCSV(res.content);
    const mass = parseFloat(document.getElementById('demo-mass').value) || 1.0;
    const result = DSP.analyzeDemonstrator(rows, mass);
    if (!result) { alert('No cycles detected. Check that force_N column has cycling data.'); return; }

    document.getElementById('demo-cycles').textContent     = result.cycles;
    document.getElementById('demo-cop').textContent        = result.meanCOP;
    document.getElementById('demo-cop-carnot').textContent = result.meanCarnot;
    document.getElementById('demo-eta').textContent        = result.meanEta;
    document.getElementById('demo-span').textContent       = result.meanSpan;
    document.getElementById('demo-results').classList.remove('hidden');

    const cyc = result.results.map((_, i) => i + 1);
    demoCOPChart.data.labels  = cyc; demoSpanChart.data.labels = cyc; demoEtaChart.data.labels = cyc;
    demoCOPChart.data.datasets[0].data  = result.results.map(r => r.COP_device);
    demoSpanChart.data.datasets[0].data = result.results.map(r => r.delta_T_span_K);
    demoEtaChart.data.datasets[0].data  = result.results.map(r => +(r.eta_2nd_law * 100).toFixed(1));
    demoCOPChart.update(); demoSpanChart.update(); demoEtaChart.update();
  });

  // ── Material Calculator ────────────────────────────────────────────────────
  // Computes theoretical ΔT_ad and COP from fundamental material properties.
  // Useful for planning experiments from literature values before making a sample.

  const LITERATURE_PRESETS = {
    'Natural Rubber':         { dh: 3.0,  tstar: 298, rho: 0.92, cp: 1.88, eps: 300, cost: 1   },
    'PVDF film':              { dh: 1.2,  tstar: 310, rho: 1.78, cp: 1.30, eps: 10,  cost: 8   },
    'Silicone (PDMS)':        { dh: 2.0,  tstar: 295, rho: 1.03, cp: 1.46, eps: 350, cost: 3   },
    'TiNiCuCo SMA (Xu 2024)': { dh: 22.0, tstar: 320, rho: 6.45, cp: 0.47, eps: 8,  cost: 500 },
    'NiTi wire':              { dh: 18.0, tstar: 308, rho: 6.45, cp: 0.47, eps: 8,  cost: 200 },
  };

  // Populate preset selector
  const presetSel = document.getElementById('mat-preset');
  Object.keys(LITERATURE_PRESETS).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    presetSel.appendChild(opt);
  });
  presetSel.addEventListener('change', () => {
    const p = LITERATURE_PRESETS[presetSel.value];
    if (!p) return;
    document.getElementById('mat-dh').value    = p.dh;
    document.getElementById('mat-tstar').value = p.tstar;
    document.getElementById('mat-rho').value   = p.rho;
    document.getElementById('mat-cp').value    = p.cp;
    document.getElementById('mat-eps').value   = p.eps;
    document.getElementById('mat-cost').value  = p.cost;
    runCalc();
  });

  document.getElementById('btn-run-calc').addEventListener('click', runCalc);
  ['mat-dh','mat-tstar','mat-cp','mat-eps'].forEach(id => {
    document.getElementById(id).addEventListener('input', runCalc);
  });

  function runCalc() {
    const dH   = parseFloat(document.getElementById('mat-dh').value)    || 0;   // J/g
    const Tstar = parseFloat(document.getElementById('mat-tstar').value) || 300; // K
    const cp   = parseFloat(document.getElementById('mat-cp').value)    || 1.5; // J/g·K
    const eps  = parseFloat(document.getElementById('mat-eps').value)   || 200; // %
    const cost = parseFloat(document.getElementById('mat-cost').value)  || 1;

    if (dH <= 0 || cp <= 0) return;

    // ΔT_ad = ΔH / c_p  (latent heat divided by specific heat capacity)
    const deltaT_ad = dH / cp;

    // Theoretical COP at various temperature spans (Carnot-based estimate)
    const spans    = [2, 5, 8, 10, 15, 20];
    const copVals  = spans.map(span => span < deltaT_ad ? (Tstar - span / 2) / span : 0);

    // Figure of merit: ΔT_ad × COP@5K / cost
    const cop5K = copVals[1] || 0;
    const fom   = cop5K > 0 ? +(deltaT_ad * cop5K / cost).toFixed(3) : 0;

    document.getElementById('mc-delta-t').textContent = deltaT_ad.toFixed(2);
    document.getElementById('mc-cop-5k').textContent  = cop5K > 0 ? cop5K.toFixed(1) : '< span';
    document.getElementById('mc-ds').textContent      = (dH / Tstar * 1000).toFixed(2);
    document.getElementById('mc-fom').textContent     = fom;
    document.getElementById('mat-calc-results').classList.remove('hidden');

    // Bar chart: COP vs span
    matChart.data.labels = spans.map(s => s + ' K');
    matChart.data.datasets = [{
      label: 'Max theoretical COP',
      data: copVals,
      backgroundColor: copVals.map(v => v > 3 ? '#00d4aa66' : v > 1 ? '#4db6ff55' : '#ff4d6d44'),
      borderColor:     copVals.map(v => v > 3 ? '#00d4aa'   : v > 1 ? '#4db6ff'   : '#ff4d6d'),
      borderWidth: 1.5,
    }];
    matChart.update();

    // Comparison table against SMA reference
    const sma = LITERATURE_PRESETS['TiNiCuCo SMA (Xu 2024)'];
    const smaT = sma.dh / sma.cp;
    const smaCOP = (sma.tstar - 2.5) / 5;
    const smaFOM = +(smaT * smaCOP / sma.cost).toFixed(3);

    const ratio_dt   = +(deltaT_ad / smaT).toFixed(2);
    const ratio_cost = +(cost / sma.cost).toFixed(4);
    const ratio_fom  = smaFOM > 0 ? +(fom / smaFOM).toFixed(2) : '—';

    document.getElementById('mc-vs-sma').innerHTML = `
      <div class="result-item"><span class="result-label">ΔT vs SMA</span><span class="result-value" style="color:${ratio_dt > 0.5 ? 'var(--amber)' : 'var(--blue)'}">${ratio_dt}×</span></div>
      <div class="result-item"><span class="result-label">Cost vs SMA</span><span class="result-value" style="color:var(--green)">${ratio_cost}×</span></div>
      <div class="result-item"><span class="result-label">FOM vs SMA</span><span class="result-value" style="color:${ratio_fom > 1 ? 'var(--green)' : 'var(--text-secondary)'}">${ratio_fom}×</span></div>
    `;
  }

  function addCalcHint(msg) {
    const el = document.getElementById('calc-hint');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 4000); }
  }

  // Init on tab open
  let inited = false;
  function ensureInit() { if (!inited) { initCharts(); inited = true; runCalc(); } }
  window.addEventListener('tab-change', e => { if (e.detail === 'analysis') ensureInit(); });
  ensureInit();
})();
