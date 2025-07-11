const { contextBridge, ipcRenderer } = require('electron');
  
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => app.getVersion(),
    closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  getSuggestions: () => ipcRenderer.invoke('get-suggestions'),
  runCommand: (command) => ipcRenderer.send('run-command', command),
  getOpenApps: () => ipcRenderer.invoke('get-open-apps') // ✅ new method exposed
});
