const { contextBridge, ipcRenderer } = require('electron');
const si = require('systeminformation');

contextBridge.exposeInMainWorld('electronAPI', {
  getSuggestions: () => ipcRenderer.invoke('get-suggestions'),
  runCommand: (cmd) => ipcRenderer.send('run-command', cmd),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  getOpenApps: () => ipcRenderer.invoke('get-open-apps'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemStats: async () => {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    return {
      cpu: Math.round(cpu.currentload),
      ram: Math.round((mem.active / mem.total) * 100)
    };
  }
});
