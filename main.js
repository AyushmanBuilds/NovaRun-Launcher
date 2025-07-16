const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const log = require('electron-log');
const si = require('systeminformation');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// 🔧 GPU Rendering Optimizations (Place these early)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('ignore-gpu-blacklist'); // Optional: enables GPU even on restricted systems
let mainWindow;
let updateStarted = false;

// ================== Suggestions ===================
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

// ================== Installed Apps Fetch ===================
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

// ================== Create Window ===================
function createWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    resizable: true,
    alwaysOnTop: false,
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

// ================== Analytics ===================
function logEvent(eventName, detail = '') {
  const line = `[${new Date().toISOString()}] ${eventName}: ${detail}\n`;
  fs.appendFileSync('analytics.log', line);
}

// ================== App Ready ===================
app.whenReady().then(() => {
  logEvent('App Launched');

  const dynamicApps = getInstalledApps();
  createWindow();

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

   ipcMain.handle('get-app-version', () => app.getVersion());

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

  ipcMain.handle('get-system-stats', async () => {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();

    const cores = cpu.cpus.map(c => Math.round(c.load));
    const cpuLoad = Math.round(cpu.currentload);
    const ramLoad = Math.round((mem.active / mem.total) * 100);

    return {
      cpu: cpuLoad,
      ram: ramLoad,
      cores
    };
  } catch (err) {
    console.error('Error fetching system stats:', err);
    return { cpu: 0, ram: 0, cores: [] };
  }
});



  // Safe Auto-update Start
  if (!updateStarted) {
    updateStarted = true;
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Auto-launch on startup
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    openAsHidden: true
  });
});

// ================== AutoUpdater Events ===================
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
      app.quit(); // Ensures graceful shutdown
      autoUpdater.quitAndInstall();
    }
  });
});

// Don't quit app on all windows closed
app.on('window-all-closed', e => e.preventDefault());

// Handle Ctrl+C and graceful quit
app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});
