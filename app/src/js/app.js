// EC-Lab — global app state, tab routing, update banner

document.addEventListener('DOMContentLoaded', async () => {
  // Version
  const version = await window.api.app.version();
  document.getElementById('app-version').textContent = `v${version}`;

  // Tab switching
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
      window.dispatchEvent(new CustomEvent('tab-change', { detail: target }));
    });
  });

  // Update notifications
  window.api.app.onUpdateAvailable(({ version: v }) => {
    const banner = document.getElementById('update-banner');
    banner.textContent = `Update v${v} downloading…`;
    banner.classList.remove('hidden');
  });

  window.api.app.onUpdateReady(({ version: v }) => {
    const banner = document.getElementById('update-banner');
    banner.textContent = `v${v} ready — click to install`;
    banner.classList.remove('hidden');
    banner.style.cursor = 'pointer';
    banner.onclick = () => window.api.app.installUpdate();
  });

  window.api.app.onUpdateProgress(({ percent }) => {
    const banner = document.getElementById('update-banner');
    banner.textContent = `Updating… ${percent}%`;
  });
});
