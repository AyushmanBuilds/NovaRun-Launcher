const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSuggestions: () => ipcRenderer.invoke('get-suggestions'),
  getOpenApps: () => ipcRenderer.invoke('get-open-apps'),
  runCommand: (cmd) => ipcRenderer.send('run-command', cmd),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats')
});
