// EC-Lab — Live Serial Monitor
// Connects to the Arduino controller, live-plots T_cold, T_hot, force,
// displacement, and rolling COP. Supports recording to CSV.

(() => {
  const MAX_POINTS = 300;   // rolling window (300 samples ≈ 30 s at 10 Hz)
  const CHART_CFG  = { animation: false, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#7a9cc8', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#4a6280', maxTicksLimit: 6 }, grid: { color: '#1e2d3d' } },
      y: { ticks: { color: '#7a9cc8' }, grid: { color: '#1e2d3d' } },
    },
  };

  function mkDataset(label, color, data = []) {
    return { label, data, borderColor: color, backgroundColor: color + '22',
             borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 };
  }

  // ── Charts ─────────────────────────────────────────────────────────────────
  const labels = [];

  const chartTemp  = new Chart(document.getElementById('chart-temp'),  { type: 'line', data: { labels, datasets: [mkDataset('T cold', '#4db6ff'), mkDataset('T hot', '#ff4d6d')] }, options: { ...CHART_CFG, scales: { ...CHART_CFG.scales, y: { ...CHART_CFG.scales.y, title: { display: true, text: '°C', color: '#7a9cc8' } } } } });
  const chartForce = new Chart(document.getElementById('chart-force'), { type: 'line', data: { labels, datasets: [mkDataset('Force', '#ffb347')] }, options: { ...CHART_CFG } });
  const chartDisp  = new Chart(document.getElementById('chart-disp'),  { type: 'line', data: { labels, datasets: [mkDataset('Displacement', '#c084fc')] }, options: { ...CHART_CFG } });
  const chartCOP   = new Chart(document.getElementById('chart-cop'),   { type: 'line', data: { labels, datasets: [mkDataset('COP', '#00d4aa')] }, options: { ...CHART_CFG, scales: { ...CHART_CFG.scales, y: { ...CHART_CFG.scales.y, min: 0, suggestedMax: 5 } } } });

  const allCharts = [chartTemp, chartForce, chartDisp, chartCOP];

  // ── State ──────────────────────────────────────────────────────────────────
  let connected  = false;
  let recording  = false;
  let recordRows = [];
  let lastTs     = null;
  let sampleCount = 0;
  let sessionStart = null;
  let sessionTimer = null;
  let cycleCount  = 0;
  let prevForce   = 0;
  let prevSign    = 0;
  let copHistory  = [];

  // Rolling work/heat accumulators for COP
  let workAcc = 0, heatAcc = 0;
  let prevDisp = null, prevTcold = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const btnConnect     = document.getElementById('btn-connect');
  const btnRecord      = document.getElementById('btn-record');
  const btnRefresh     = document.getElementById('btn-refresh-ports');
  const portSelect     = document.getElementById('port-select');
  const baudSelect     = document.getElementById('baud-select');
  const statusPill     = document.getElementById('serial-status-pill');
  const statusText     = document.getElementById('serial-status-text');
  const log            = document.getElementById('serial-log');

  // ── Port list ──────────────────────────────────────────────────────────────
  async function refreshPorts() {
    const ports = await window.api.serial.list();
    portSelect.innerHTML = '<option value="">Select port…</option>';
    ports.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.manufacturer ? `${p.path} (${p.manufacturer})` : p.path;
      portSelect.appendChild(opt);
    });
    addLog(ports.length ? `Found ${ports.length} port(s)` : 'No serial ports found', 'ok');
  }

  btnRefresh.addEventListener('click', refreshPorts);
  refreshPorts();

  // ── Connect / Disconnect ───────────────────────────────────────────────────
  btnConnect.addEventListener('click', async () => {
    if (connected) {
      await window.api.serial.disconnect();
      setConnected(false);
    } else {
      const portPath = portSelect.value;
      if (!portPath) { addLog('Select a port first.', 'err'); return; }
      btnConnect.textContent = 'Connecting…';
      btnConnect.disabled = true;
      const res = await window.api.serial.connect({ portPath, baudRate: baudSelect.value });
      btnConnect.disabled = false;
      if (!res.ok) { addLog(`Connect failed: ${res.error}`, 'err'); btnConnect.textContent = 'Connect'; }
    }
  });

  window.api.serial.onStatus(({ connected: c, port, error }) => {
    setConnected(c, port);
    if (error) addLog(`Error: ${error}`, 'err');
  });

  function setConnected(c, port = '') {
    connected = c;
    btnConnect.textContent = c ? 'Disconnect' : 'Connect';
    btnRecord.disabled = !c;
    statusPill.className = 'status-pill ' + (c ? 'connected' : 'disconnected');
    statusText.textContent = c ? `Connected · ${port}` : 'Not connected';
    if (c) {
      addLog(`Connected to ${port}`, 'ok');
      sessionStart = Date.now();
      sampleCount  = 0;
      sessionTimer = setInterval(updateSession, 1000);
    } else {
      if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
      if (recording) stopRecording();
    }
  }

  // ── Record ─────────────────────────────────────────────────────────────────
  btnRecord.addEventListener('click', () => {
    if (recording) stopRecording();
    else startRecording();
  });

  function startRecording() {
    recording   = true;
    recordRows  = ['timestamp_s,T_cold_C,T_hot_C,force_N,displacement_mm,power_W'];
    btnRecord.textContent = '⏹ Stop';
    addLog('Recording started.', 'ok');
  }

  async function stopRecording() {
    recording = false;
    btnRecord.textContent = '⏺ Record';
    if (recordRows.length < 2) { addLog('No data to save.', 'err'); return; }
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const saved = await window.api.fs.saveCsv(`session_${ts}.csv`, recordRows.join('\n'));
    addLog(saved ? `Saved to ${saved}` : 'Save cancelled.', saved ? 'ok' : '');
  }

  // ── Incoming data ──────────────────────────────────────────────────────────
  window.api.serial.onData(({ line }) => {
    const parts = line.split(',');
    if (parts.length < 6) return;

    const [ts_ms, Tc, Th, F, D, P] = parts.map(Number);
    if ([ts_ms, Tc, Th, F, D, P].some(isNaN)) return;

    const ts_s = ts_ms / 1000;
    sampleCount++;

    // Update big number displays
    setVal('val-t-cold', Tc.toFixed(1));
    setVal('val-t-hot',  Th.toFixed(1));
    setVal('val-force',  F.toFixed(1));
    setVal('val-disp',   D.toFixed(1));
    setVal('val-span',   (Th - Tc).toFixed(1) + ' K');

    // Delta indicators
    const prevTc = prevTcold ?? Tc;
    const dT = Tc - prevTc;
    const deltaEl = document.getElementById('delta-t-cold');
    if (Math.abs(dT) > 0.05) {
      deltaEl.textContent = (dT > 0 ? '▲' : '▼') + Math.abs(dT).toFixed(2) + ' K';
      deltaEl.className   = 'reading-delta ' + (dT > 0 ? 'pos' : 'neg');
    }
    prevTcold = Tc;

    // Rolling COP
    if (prevDisp !== null) {
      const dDisp = (D - prevDisp) * 1e-3;
      workAcc += Math.abs(F * dDisp);
      heatAcc += Math.abs(Tc - prevTc) * 1.5;  // simplified heat accumulation
    }
    prevDisp = D;

    const rollingCOP = workAcc > 0.001 ? Math.min(heatAcc / workAcc, 15) : 0;
    copHistory.push(rollingCOP);
    if (copHistory.length > 10) copHistory.shift();
    const smoothCOP = copHistory.reduce((a, b) => a + b, 0) / copHistory.length;
    updateCOP(smoothCOP, Tc + 273.15, Th + 273.15);

    // Cycle detection (force sign change)
    const sign = F > 5 ? 1 : F < -5 ? -1 : 0;
    if (sign !== 0 && sign !== prevSign) {
      if (prevSign !== 0) cycleCount++;
      prevSign = sign;
      document.getElementById('val-cycles').textContent = cycleCount;
    }
    prevForce = F;

    // Rolling label (seconds since session start)
    const elapsed = sessionStart ? ((Date.now() - sessionStart) / 1000).toFixed(1) : ts_s.toFixed(1);
    pushToChart(elapsed, [Tc, Th], [F], [D], [smoothCOP > 0 ? +smoothCOP.toFixed(2) : null]);

    // Record
    if (recording) recordRows.push(`${ts_s},${Tc},${Th},${F},${D},${P}`);

    lastTs = ts_s;
  });

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function updateCOP(cop, Tc_K, Th_K) {
    const el    = document.getElementById('val-cop');
    const bar   = document.getElementById('cop-bar');
    const sub   = document.getElementById('cop-carnot');
    const carnot = Th_K > Tc_K + 0.1 ? Tc_K / (Th_K - Tc_K) : 0;

    el.textContent  = cop > 0 ? cop.toFixed(2) : '—';
    sub.textContent = carnot > 0 ? `Carnot: ${carnot.toFixed(1)}  η=${(cop / carnot * 100).toFixed(0)}%` : '';

    const pct = Math.min(cop / 5 * 100, 100);
    bar.style.width = pct + '%';
    bar.className   = 'cop-bar ' + (cop < 1 ? 'low' : 'good');
  }

  function pushToChart(label, temps, forces, disps, cops) {
    labels.push(label);
    chartTemp.data.datasets[0].data.push(temps[0]);
    chartTemp.data.datasets[1].data.push(temps[1]);
    chartForce.data.datasets[0].data.push(forces[0]);
    chartDisp.data.datasets[0].data.push(disps[0]);
    chartCOP.data.datasets[0].data.push(cops[0]);

    if (labels.length > MAX_POINTS) {
      labels.shift();
      allCharts.forEach(c => c.data.datasets.forEach(ds => ds.data.shift()));
    }
    allCharts.forEach(c => c.update('none'));
  }

  function updateSession() {
    if (!sessionStart) return;
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    const m = Math.floor(s / 60);
    document.getElementById('val-session').textContent = `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
    document.getElementById('val-rate').textContent    = sampleCount > 0 ? (sampleCount / (s || 1)).toFixed(1) : '—';
  }

  function addLog(msg, type = '') {
    const div = document.createElement('div');
    div.className = `log-line ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    if (log.children.length > 100) log.removeChild(log.firstChild);
  }
})();
