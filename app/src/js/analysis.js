// EC-Lab — Analysis tab: DSC, Stress-Strain, Demonstrator Log

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

  function initCharts() {
    dscChart = new Chart(document.getElementById('chart-dsc'), {
      type: 'line',
      data: { datasets: [] },
      options: { ...CHART_OPT, parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: { ...CHART_OPT.scales,
          x: { ...CHART_OPT.scales.x, type: 'linear', title: { display: true, text: 'Temperature (°C)', color: '#7a9cc8' } },
          y: { ...CHART_OPT.scales.y, title: { display: true, text: 'Heat Flow (mW mg⁻¹)', color: '#7a9cc8' } } },
      },
    });

    tensileChart = new Chart(document.getElementById('chart-tensile'), {
      type: 'line',
      data: { datasets: [] },
      options: { ...CHART_OPT, parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: { ...CHART_OPT.scales,
          x: { ...CHART_OPT.scales.x, type: 'linear', title: { display: true, text: 'Strain (%)', color: '#7a9cc8' } },
          y: { ...CHART_OPT.scales.y, title: { display: true, text: 'Stress (MPa)', color: '#7a9cc8' } } },
      },
    });

    const barOpt = { ...CHART_OPT, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#4a6280' }, grid: { color: '#1e2d3d' } }, y: { ticks: { color: '#7a9cc8' }, grid: { color: '#1e2d3d' }, beginAtZero: true } } };
    demoCOPChart  = new Chart(document.getElementById('chart-demo-cop'),  { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#00d4aa66', borderColor: '#00d4aa', borderWidth: 1 }] }, options: barOpt });
    demoSpanChart = new Chart(document.getElementById('chart-demo-span'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#4db6ff44', borderColor: '#4db6ff', borderWidth: 1 }] }, options: barOpt });
    demoEtaChart  = new Chart(document.getElementById('chart-demo-eta'),  { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#c084fc44', borderColor: '#c084fc', borderWidth: 1 }] }, options: barOpt });
  }

  // ── DSC ────────────────────────────────────────────────────────────────────
  document.getElementById('btn-load-dsc').addEventListener('click', async () => {
    const filePath = await window.api.fs.openFile([{ name: 'CSV', extensions: ['csv'] }]);
    if (!filePath) return;
    document.getElementById('dsc-filename').textContent = filePath.split(/[\\/]/).pop();

    const { ok, content, error } = await window.api.fs.readCsv(filePath);
    if (!ok) { alert(`Could not read file: ${error}`); return; }

    const rows = DSP.parseCSV(content);
    if (!rows.length) { alert('No data found in file.'); return; }

    const tempCol  = Object.keys(rows[0]).find(k => k.toLowerCase().includes('temp'));
    const hfCol    = Object.keys(rows[0]).find(k => k.toLowerCase().includes('heat') || k.toLowerCase().includes('flow'));
    if (!tempCol || !hfCol) { alert('CSV must have columns: temperature_C, heat_flow_mW_mg'); return; }

    const temps = rows.map(r => +r[tempCol]);
    const hf    = rows.map(r => +r[hfCol]);

    const res = DSP.analyzeDSC(temps, hf);

    // Fill results
    document.getElementById('dsc-t-onset').textContent = res.tOnset;
    document.getElementById('dsc-t-offset').textContent = res.tOffset;
    document.getElementById('dsc-dh').textContent = res.deltaH_J_g;
    document.getElementById('dsc-ds').textContent = res.deltaS_mJ_gK;
    document.getElementById('dsc-tstar').textContent = res.tStarK;
    document.getElementById('dsc-results').classList.remove('hidden');

    // Plot
    const smoothData = res.smoothedT.map((x, i) => ({ x, y: res.smoothedHF[i] }));
    const peakData   = res.smoothedT.slice(res.peakRegion.onset, res.peakRegion.offset + 1)
                          .map((x, i) => ({ x, y: res.smoothedHF[res.peakRegion.onset + i] }));

    dscChart.data.datasets = [
      { label: 'DSC signal', data: smoothData, borderColor: '#4db6ff', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: `Peak  ΔH=${res.deltaH_J_g} J/g`, data: peakData, borderColor: '#ffb347', backgroundColor: '#ffb34733', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 },
    ];
    dscChart.update();
  });

  // ── Tensile ────────────────────────────────────────────────────────────────
  document.getElementById('btn-load-tensile').addEventListener('click', async () => {
    const filePath = await window.api.fs.openFile([{ name: 'CSV', extensions: ['csv'] }]);
    if (!filePath) return;
    document.getElementById('tensile-filename').textContent = filePath.split(/[\\/]/).pop();

    const { ok, content, error } = await window.api.fs.readCsv(filePath);
    if (!ok) { alert(`Could not read file: ${error}`); return; }

    const rows = DSP.parseCSV(content);
    const strainCol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('strain'));
    const stressCol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('stress'));
    if (!strainCol || !stressCol) { alert('CSV must have columns: strain_pct, stress_MPa'); return; }

    const strain = rows.map(r => +r[strainCol]);
    const stress = rows.map(r => +r[stressCol]);
    const res = DSP.analyzeTensile(strain, stress);

    document.getElementById('ten-modulus').textContent    = res.E_kPa ?? '—';
    document.getElementById('ten-stress-max').textContent = res.stressMax_MPa;
    document.getElementById('ten-strain-max').textContent = res.strainMax_pct;
    document.getElementById('ten-hysteresis').textContent = res.hysteresis_MJ_m3;
    document.getElementById('tensile-results').classList.remove('hidden');

    const data = strain.map((x, i) => ({ x, y: stress[i] }));
    tensileChart.data.datasets = [
      { label: 'Stress–Strain', data, borderColor: '#ff4d6d', backgroundColor: '#ff4d6d22', borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.3 },
    ];
    tensileChart.update();
  });

  // ── Demonstrator log ───────────────────────────────────────────────────────
  document.getElementById('btn-load-demo').addEventListener('click', async () => {
    const filePath = await window.api.fs.openFile([{ name: 'CSV', extensions: ['csv'] }]);
    if (!filePath) return;
    document.getElementById('demo-filename').textContent = filePath.split(/[\\/]/).pop();

    const { ok, content, error } = await window.api.fs.readCsv(filePath);
    if (!ok) { alert(`Could not read file: ${error}`); return; }

    const rows = DSP.parseCSV(content);
    const mass = parseFloat(document.getElementById('demo-mass').value) || 1.0;
    const res  = DSP.analyzeDemonstrator(rows, mass);

    if (!res) { alert('Could not detect any cycles in this log. Check that force_N column has cycling data.'); return; }

    document.getElementById('demo-cycles').textContent    = res.cycles;
    document.getElementById('demo-cop').textContent       = res.meanCOP;
    document.getElementById('demo-cop-carnot').textContent= res.meanCarnot;
    document.getElementById('demo-eta').textContent       = res.meanEta;
    document.getElementById('demo-span').textContent      = res.meanSpan;
    document.getElementById('demo-results').classList.remove('hidden');

    const cyc = res.results.map((_, i) => i + 1);
    demoCOPChart.data.labels  = cyc;
    demoSpanChart.data.labels = cyc;
    demoEtaChart.data.labels  = cyc;
    demoCOPChart.data.datasets[0].data  = res.results.map(r => r.COP_device);
    demoSpanChart.data.datasets[0].data = res.results.map(r => r.delta_T_span_K);
    demoEtaChart.data.datasets[0].data  = res.results.map(r => +(r.eta_2nd_law * 100).toFixed(1));
    demoCOPChart.update(); demoSpanChart.update(); demoEtaChart.update();
  });

  // Init on tab open (lazy) and immediately
  let inited = false;
  function ensureInit() { if (!inited) { initCharts(); inited = true; } }
  window.addEventListener('tab-change', e => { if (e.detail === 'analysis') ensureInit(); });
  ensureInit();
})();
