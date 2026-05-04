// EC-Lab — preload / context bridge
// Exposes safe IPC channels to the renderer. No direct Node.js access.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Serial port
  serial: {
    list:       ()               => ipcRenderer.invoke('serial:list'),
    connect:    (opts)           => ipcRenderer.invoke('serial:connect', opts),
    disconnect: ()               => ipcRenderer.invoke('serial:disconnect'),
    onData:     (cb)             => ipcRenderer.on('serial:data',   (_e, d) => cb(d)),
    onStatus:   (cb)             => ipcRenderer.on('serial:status', (_e, d) => cb(d)),
    removeData: ()               => ipcRenderer.removeAllListeners('serial:data'),
    removeStatus: ()             => ipcRenderer.removeAllListeners('serial:status'),
  },

  // File system
  fs: {
    openFile:  (filters)          => ipcRenderer.invoke('fs:open-file', { filters }),
    openDir:   ()                 => ipcRenderer.invoke('fs:open-dir'),
    readCsv:   (path)             => ipcRenderer.invoke('fs:read-csv', path),
    saveCsv:   (name, content)    => ipcRenderer.invoke('fs:save-csv', { defaultName: name, content }),
    saveHtml:  (name, content)    => ipcRenderer.invoke('fs:save-html', { defaultName: name, content }),
    readDir:   (path)             => ipcRenderer.invoke('fs:read-dir', path),
  },

  // Persistent store
  store: {
    get:    (key)          => ipcRenderer.invoke('store:get', key),
    set:    (key, value)   => ipcRenderer.invoke('store:set', key, value),
    delete: (key)          => ipcRenderer.invoke('store:delete', key),
  },

  // App
  app: {
    version:       ()  => ipcRenderer.invoke('app:version'),
    installUpdate: ()  => ipcRenderer.invoke('app:install-update'),
    quit:          ()  => ipcRenderer.invoke('app:quit'),
    onUpdateAvailable: (cb) => ipcRenderer.on('updater:available',  (_e, d) => cb(d)),
    onUpdateReady:     (cb) => ipcRenderer.on('updater:downloaded', (_e, d) => cb(d)),
    onUpdateProgress:  (cb) => ipcRenderer.on('updater:progress',   (_e, d) => cb(d)),
  },
});
