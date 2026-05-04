// EC-Lab — Electron main process
// Manages the app window, serial port communication, file I/O,
// persistent store, and background auto-updates via electron-updater.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();
let mainWindow = null;
let activePort = null;
let activeParser = null;

// ── Auto-updater ──────────────────────────────────────────────────────────────
autoUpdater.autoDownload         = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease      = false;
autoUpdater.channel              = 'latest';
autoUpdater.verifyUpdateCodeSignature = false;

autoUpdater.on('update-available',  (info) => { send('updater:available',  { version: info.version }); });
autoUpdater.on('update-not-available', ()  => { send('updater:current',    {}); });
autoUpdater.on('download-progress', (p)   => { send('updater:progress',   { percent: Math.round(p.percent) }); });
autoUpdater.on('update-downloaded', (info) => {
  send('updater:downloaded', { version: info.version });
  setTimeout(() => { autoUpdater.quitAndInstall(false, true); }, 8000);
});
autoUpdater.on('error', (err) => console.error('[updater]', err.message));

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0e14',
    show: false,
    autoHideMenuBar: true,
    title: 'EC-Lab',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,   // needed for serialport native bindings via IPC
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 5000);
    setInterval(()  => { autoUpdater.checkForUpdates().catch(() => {}); }, 15 * 60 * 1000);
  });

  mainWindow.on('closed', () => {
    closePort();
    mainWindow = null;
  });
}

// ── Serial port helpers ───────────────────────────────────────────────────────
function closePort() {
  if (activePort && activePort.isOpen) {
    try { activePort.close(); } catch (_) {}
  }
  activePort  = null;
  activeParser = null;
}

// ── IPC: serial ───────────────────────────────────────────────────────────────
ipcMain.handle('serial:list', async () => {
  const { SerialPort } = require('serialport');
  const ports = await SerialPort.list();
  return ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '' }));
});

ipcMain.handle('serial:connect', async (_e, { portPath, baudRate }) => {
  closePort();
  const { SerialPort } = require('serialport');
  const { ReadlineParser } = require('@serialport/parser-readline');

  return new Promise((resolve) => {
    try {
      activePort = new SerialPort({ path: portPath, baudRate: parseInt(baudRate) });
      activeParser = activePort.pipe(new ReadlineParser({ delimiter: '\n' }));

      activeParser.on('data', (line) => {
        send('serial:data', { line: line.trim() });
      });

      activePort.on('open',  ()    => { send('serial:status', { connected: true, port: portPath }); resolve({ ok: true }); });
      activePort.on('error', (err) => { send('serial:status', { connected: false, error: err.message }); resolve({ ok: false, error: err.message }); });
      activePort.on('close', ()    => { send('serial:status', { connected: false }); });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
});

ipcMain.handle('serial:disconnect', () => {
  closePort();
  return { ok: true };
});

// ── IPC: filesystem ───────────────────────────────────────────────────────────
ipcMain.handle('fs:open-file', async (_e, { filters }) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:open-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:read-csv', (_e, filePath) => {
  try {
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:save-csv', async (_e, { defaultName, content }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf8');
  return result.filePath;
});

ipcMain.handle('fs:save-html', async (_e, { defaultName, content }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'HTML Report', extensions: ['html'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf8');
  shell.openPath(result.filePath);
  return result.filePath;
});

ipcMain.handle('fs:read-dir', (_e, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IPC: store ────────────────────────────────────────────────────────────────
ipcMain.handle('store:get',    (_e, key)        => store.get(key));
ipcMain.handle('store:set',    (_e, key, value) => { store.set(key, value); return true; });
ipcMain.handle('store:delete', (_e, key)        => { store.delete(key); return true; });

// ── IPC: app ──────────────────────────────────────────────────────────────────
ipcMain.handle('app:version',        () => app.getVersion());
ipcMain.handle('app:install-update', () => autoUpdater.quitAndInstall(false, true));
ipcMain.handle('app:quit',           () => app.quit());

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  closePort();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
