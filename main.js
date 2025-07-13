const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

app.commandLine.appendSwitch('disable-features', 'Windows10CustomTitlebar');

let mainWindow;

// Suggestions
const baseSuggestions = [
  { text: "Open Chrome", match: ["chrome", "google"], command: "start chrome" },
  { text: "Open Edge", match: ["edge", "microsoft"], command: "start msedge" },
  { text: "Open Downloads", match: ["downloads"], command: `start "" "${os.homedir()}\\Downloads"` },
  {
    text: "Turn Off Wi-Fi",
    match: ["wifi", "disable wifi", "turn off wifi"],
    command: `powershell -Command "Start-Process powershell -ArgumentList 'Disable-NetAdapter -Name \\"Wi-Fi\\" -Confirm:\\$false' -Verb RunAs"`
  },
  {
    text: "Turn On Wi-Fi",
    match: ["wifi", "enable wifi", "turn on wifi"],
    command: `powershell -Command "Start-Process powershell -ArgumentList 'Enable-NetAdapter -Name \\"Wi-Fi\\" -Confirm:\\$false' -Verb RunAs"`
  },
  { text: "Restart PC", match: ["restart", "reboot"], command: "shutdown /r /t 0" },
  { text: "Shutdown PC", match: ["shutdown", "power off"], command: "shutdown /s /t 0" }
];

// App shortcuts
function getInstalledApps() {
  const dirs = [
    path.join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(process.env.ProgramData, 'Microsoft\\Windows\\Start Menu\\Programs')
  ];
  const apps = [];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    function walk(current) {
      fs.readdirSync(current, { withFileTypes: true }).forEach(f => {
        const fullPath = path.join(current, f.name);
        if (f.isDirectory()) walk(fullPath);
        else if (f.name.endsWith('.lnk') || f.name.endsWith('.url')) {
          const name = f.name.replace(/\.(lnk|url)$/i, '');
          apps.push({ text: name, match: [name.toLowerCase()], command: `start "" "${fullPath}"` });
        }
      });
    }
    walk(dir);
  });

  return apps;
}

function createWindow() {
  if (mainWindow) return; // Don't recreate if already exists

  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: false,
    resizable: true,
    hasShadow: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function logEvent(eventName, detail = '') {
  const line = `[${new Date().toISOString()}] ${eventName}: ${detail}\n`;
  fs.appendFileSync('analytics.log', line);
}

// App ready
app.whenReady().then(() => {
  logEvent('App Launched');
  const dynamicApps = getInstalledApps();
  createWindow();

  // Global shortcut
  globalShortcut.register('Alt+N', () => {
    if (!mainWindow) createWindow();
    if (mainWindow.isDestroyed()) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('get-suggestions', () => [...baseSuggestions, ...dynamicApps]);

  ipcMain.on('run-command', (_, command) => {
    logEvent('Command Run', command);
    exec(command, { shell: 'cmd.exe' });
  });

  ipcMain.on('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });

  ipcMain.on('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize();
    }
  });

  ipcMain.handle('get-open-apps', async () => {
    return new Promise((resolve) => {
      exec('tasklist /FO CSV /NH', (err, stdout) => {
        if (err) return resolve([]);
        const processes = stdout.split('\r\n').map(line => {
          const cols = line.split('","').map(s => s.replace(/^"|"$/g, ''));
          return cols[0];
        }).filter(Boolean);
        resolve(Array.from(new Set(processes)));
      });
    });
  });

  ipcMain.handle('get-system-stats', () => {
 const si = require('systeminformation');

ipcMain.handle('get-system-stats', async () => {
  const cpu = await si.currentLoad();
  const mem = await si.mem();

  return {
    cpu: Math.round(cpu.currentload),
    ram: Math.round((mem.active / mem.total) * 100)
  };
});
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  return { cpu: cpuPercent, ram: usedMemPercent };
});


  // Auto update
  autoUpdater.checkForUpdatesAndNotify();

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    openAsHidden: true
  });
});

// AutoUpdater events
autoUpdater.on('checking-for-update', () => log.info("🔍 Checking for update..."));
autoUpdater.on('update-available', info => log.info("✅ Update available", info));
autoUpdater.on('update-not-available', () => log.info("🚫 No update available"));
autoUpdater.on('error', err => log.error("❌ Update error", err));
autoUpdater.on('download-progress', progress => {
  log.info(`⬇️ Downloaded ${progress.percent.toFixed(2)}%`);
});
autoUpdater.on('update-downloaded', () => {
  log.info("🎉 A new version has been downloaded.");
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart NovaRun to apply the update?',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

app.on('window-all-closed', e => e.preventDefault());
