// EC-Lab — Material Comparison tab

(() => {
  // SMA reference data (from Xu et al. 2024 and literature)
  const SMA_REF = {
    label: 'TiNiCuCo SMA (Xu 2024)',
    deltaT_K: 20.0,
    cop: 10,
    cost_eur_m2: 500,
    cycles: 1000000,
    color: '#ff4d6d',
  };

  const COLORS = ['#00d4aa','#4db6ff','#ffb347','#c084fc','#4cefb3','#ff6b9d'];

  const CHART_OPT = {
    animation: false, responsive: true, maintainAspectRatio: false, indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#4a6280' }, grid: { color: '#1e2d3d' }, beginAtZero: true },
      y: { ticks: { color: '#7a9cc8', font: { size: 11 } }, grid: { color: '#1e2d3d' } },
    },
  };

  let charts = {};

  function initCharts() {
    charts.dt     = new Chart(document.getElementById('chart-cmp-dt'),     { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }] }, options: { ...CHART_OPT } });
    charts.cop    = new Chart(document.getElementById('chart-cmp-cop'),    { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }] }, options: { ...CHART_OPT } });
    charts.cost   = new Chart(document.getElementById('chart-cmp-cost'),   { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }] }, options: { ...CHART_OPT, scales: { ...CHART_OPT.scales, x: { ...CHART_OPT.scales.x, type: 'logarithmic' } } } });
    charts.cycles = new Chart(document.getElementById('chart-cmp-cycles'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }] }, options: { ...CHART_OPT } });
  }

  async function refreshCheckboxes() {
    const samples  = await DB.load();
    const container = document.getElementById('compare-checkboxes');
    container.innerHTML = '';

    // Always show SMA reference
    const refItem = document.createElement('label');
    refItem.className = 'compare-checkbox-item';
    refItem.innerHTML = `<input type="checkbox" value="__sma_ref__" checked> ${SMA_REF.label}`;
    container.appendChild(refItem);

    samples.forEach(s => {
      const item = document.createElement('label');
      item.className = 'compare-checkbox-item';
      item.innerHTML = `<input type="checkbox" value="${s.id}"> ${s.sampleId || s.material} (${(s.cycles||0).toLocaleString()} cyc)`;
      container.appendChild(item);
    });
  }

  async function runComparison() {
    const samples  = await DB.load();
    const checked  = Array.from(document.querySelectorAll('#compare-checkboxes input:checked')).map(i => i.value);

    const entries = [];

    if (checked.includes('__sma_ref__')) entries.push(SMA_REF);

    checked.filter(v => v !== '__sma_ref__').forEach((id, i) => {
      const s = samples.find(s => s.id === id);
      if (!s) return;
      const exps = s.experiments || [];
      const meanCOP  = exps.length ? exps.reduce((a, e) => a + (e.cop || 0), 0) / exps.length : 0;
      const meanSpan = exps.length ? exps.reduce((a, e) => a + (e.span || 0), 0) / exps.length : 0;

      // Estimate cost by material
      const costMap = { 'Natural Rubber': 1, 'PVDF': 8, 'Silicone': 3 };
      const costKey = Object.keys(costMap).find(k => s.material.includes(k)) || 'Unknown';
      const cost    = costMap[costKey] ?? 10;

      entries.push({
        label:        s.sampleId || s.material,
        deltaT_K:     meanSpan || 0,
        cop:          meanCOP  || 0,
        cost_eur_m2:  cost,
        cycles:       s.cycles || 0,
        color:        COLORS[i % COLORS.length],
      });
    });

    const labels = entries.map(e => e.label);
    const colors = entries.map(e => e.color);

    const update = (chart, data) => {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors.map(c => c + '55');
      chart.data.datasets[0].borderColor = colors;
      chart.update();
    };

    update(charts.dt,     entries.map(e => e.deltaT_K));
    update(charts.cop,    entries.map(e => e.cop));
    update(charts.cost,   entries.map(e => e.cost_eur_m2));
    update(charts.cycles, entries.map(e => e.cycles));

    // Comparison table
    const wrap = document.getElementById('compare-table-wrap');
    wrap.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>ΔT (K)</th>
            <th>Mean COP</th>
            <th>Cost (€/m²)</th>
            <th>Cycles run</th>
            <th>Cost / (ΔT × COP)</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => {
            const fom = e.deltaT_K > 0 && e.cop > 0 ? (e.cost_eur_m2 / (e.deltaT_K * e.cop)).toFixed(2) : '—';
            return `<tr>
              <td style="color:${e.color};font-weight:600">${e.label}</td>
              <td>${e.deltaT_K || '—'}</td>
              <td>${e.cop ? e.cop.toFixed(2) : '—'}</td>
              <td>${e.cost_eur_m2}</td>
              <td>${e.cycles.toLocaleString()}</td>
              <td>${fom}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  document.getElementById('btn-run-compare').addEventListener('click', runComparison);
  window.addEventListener('tab-change', async e => {
    if (e.detail === 'compare') {
      if (!charts.dt) initCharts();
      await refreshCheckboxes();
      runComparison();
    }
  });
  window.addEventListener('samples-changed', async () => {
    await refreshCheckboxes();
  });

  initCharts();
})();
