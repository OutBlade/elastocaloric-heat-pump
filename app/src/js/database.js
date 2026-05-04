// EC-Lab — Sample Database
// Persists polymer film samples and their experiment history via electron-store.

window.DB = (() => {
  async function load() {
    return (await window.api.store.get('samples')) || [];
  }

  async function save(samples) {
    await window.api.store.set('samples', samples);
  }

  async function addSample(sample) {
    const samples = await load();
    sample.id = `sample_${Date.now()}`;
    sample.createdAt = new Date().toISOString();
    sample.cycles = 0;
    sample.experiments = [];
    samples.push(sample);
    await save(samples);
    return sample;
  }

  async function deleteSample(id) {
    const samples = (await load()).filter(s => s.id !== id);
    await save(samples);
  }

  async function addExperiment(sampleId, exp) {
    const samples = await load();
    const s = samples.find(s => s.id === sampleId);
    if (!s) return;
    exp.id = `exp_${Date.now()}`;
    exp.date = new Date().toISOString();
    s.experiments = s.experiments || [];
    s.experiments.push(exp);
    if (exp.cycles) s.cycles = (s.cycles || 0) + exp.cycles;
    await save(samples);
    return exp;
  }

  async function updateCycles(sampleId, delta) {
    const samples = await load();
    const s = samples.find(s => s.id === sampleId);
    if (s) { s.cycles = (s.cycles || 0) + delta; await save(samples); }
  }

  return { load, save, addSample, deleteSample, addExperiment, updateCycles };
})();

// ── Samples tab UI ────────────────────────────────────────────────────────────
(() => {
  const grid       = document.getElementById('samples-grid');
  const modal      = document.getElementById('modal-sample');
  const btnNew     = document.getElementById('btn-new-sample');
  const btnClose   = document.getElementById('btn-modal-close');
  const btnCancel  = document.getElementById('btn-modal-cancel');
  const btnSave    = document.getElementById('btn-modal-save');

  const FATIGUE_LIMIT = 100000;  // estimated fatigue life for natural rubber

  function healthColor(cycles) {
    const pct = cycles / FATIGUE_LIMIT;
    if (pct < 0.5) return 'good';
    if (pct < 0.8) return 'warning';
    return 'danger';
  }

  function renderCard(s) {
    const pct = Math.min((s.cycles || 0) / FATIGUE_LIMIT * 100, 100);
    const hClass = healthColor(s.cycles || 0);
    const created = new Date(s.createdAt).toLocaleDateString();
    const lastExp = s.experiments?.length
      ? new Date(s.experiments.at(-1).date).toLocaleDateString()
      : 'No experiments';

    const card = document.createElement('div');
    card.className = 'sample-card';
    card.innerHTML = `
      <div class="sample-card-header">
        <div>
          <div class="sample-material">${s.material}</div>
          <div class="sample-id">${s.sampleId || s.id.slice(-6)}</div>
        </div>
        <div class="sample-date">${created}</div>
      </div>
      <div class="sample-props">
        <div class="sample-prop">Thickness <strong>${s.thickness || '—'} mm</strong></div>
        <div class="sample-prop">Mass <strong>${s.mass || '—'} g</strong></div>
        <div class="sample-prop">Area <strong>${s.width && s.length ? (s.width * s.length / 100).toFixed(1) + ' cm²' : '—'}</strong></div>
        <div class="sample-prop">Last run <strong>${lastExp}</strong></div>
      </div>
      <div class="health-bar-label">
        <span>Fatigue health</span>
        <span>${(s.cycles || 0).toLocaleString()} / ${FATIGUE_LIMIT.toLocaleString()} cycles</span>
      </div>
      <div class="health-bar-wrap">
        <div class="health-bar ${hClass}" style="width:${pct}%"></div>
      </div>
      <div class="sample-card-footer">
        <div class="sample-cycle-count">${s.experiments?.length || 0} experiment(s)</div>
        <div class="sample-actions">
          <button class="btn-ghost" data-add-exp="${s.id}" style="font-size:11px;padding:4px 10px">+ Log run</button>
          <button class="btn-danger" data-delete="${s.id}">✕</button>
        </div>
      </div>
    `;

    // Notes tooltip
    if (s.notes) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:11px;color:var(--text-dim);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)';
      note.textContent = s.notes;
      card.appendChild(note);
    }

    return card;
  }

  async function render() {
    const samples = await DB.load();
    grid.innerHTML = '';
    if (!samples.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⬡</div>
          <h4>No samples yet</h4>
          <p>Add your first polymer film sample to start tracking experiments and cycle counts.</p>
        </div>`;
      return;
    }
    samples.forEach(s => grid.appendChild(renderCard(s)));

    // Delete buttons
    grid.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this sample and all its experiment data?')) {
          await DB.deleteSample(btn.dataset.delete);
          render();
          window.dispatchEvent(new Event('samples-changed'));
        }
      });
    });

    // Add experiment buttons
    grid.querySelectorAll('[data-add-exp]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cycles = parseInt(prompt('How many cycles were run in this session?', '1000'));
        if (isNaN(cycles) || cycles <= 0) return;
        const cop  = prompt('Mean COP (leave blank if unknown):', '');
        const span = prompt('ΔT span K (leave blank if unknown):', '');
        const notes = prompt('Notes:', '') || '';
        await DB.addExperiment(btn.dataset.addExp, {
          cycles,
          cop: cop ? parseFloat(cop) : null,
          span: span ? parseFloat(span) : null,
          notes,
        });
        render();
        window.dispatchEvent(new Event('samples-changed'));
      });
    });
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  btnNew.addEventListener('click', () => modal.classList.remove('hidden'));
  [btnClose, btnCancel].forEach(b => b.addEventListener('click', () => modal.classList.add('hidden')));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  btnSave.addEventListener('click', async () => {
    const s = {
      material:  document.getElementById('s-material').value,
      sampleId:  document.getElementById('s-id').value.trim(),
      thickness: parseFloat(document.getElementById('s-thickness').value) || null,
      width:     parseFloat(document.getElementById('s-width').value)     || null,
      length:    parseFloat(document.getElementById('s-length').value)    || null,
      mass:      parseFloat(document.getElementById('s-mass').value)      || null,
      maxStrain: parseFloat(document.getElementById('s-strain').value)    || 200,
      notes:     document.getElementById('s-notes').value.trim(),
    };
    if (!s.sampleId) { alert('Please enter a Sample ID.'); return; }
    await DB.addSample(s);
    modal.classList.add('hidden');
    // Reset form
    ['s-id','s-thickness','s-width','s-length','s-mass','s-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('s-strain').value = '200';
    render();
    window.dispatchEvent(new Event('samples-changed'));
  });

  // Render on tab open
  window.addEventListener('tab-change', e => { if (e.detail === 'samples') render(); });
  render();
})();
