const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.commandLine.appendSwitch('disable-features', 'Windows10CustomTitlebar');

let mainWindow;

// Prevent app from quitting when window is closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    show: false, // Don't show initially
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    alwaysOnTop: false,
    hasShadow: true,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Handle hiding instead of destroying the window
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function logEvent(eventName, detail = '') {
  const line = `[${new Date().toISOString()}] ${eventName}: ${detail}\n`;
  fs.appendFileSync('analytics.log', line);
}

app.whenReady().then(() => {
  createWindow();
  logEvent('App Launched');

  globalShortcut.register('Alt+N', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    openAsHidden: true
  });

  autoUpdater.checkForUpdatesAndNotify();
});

// Command runner
ipcMain.on('run-command', (_, command) => {
  exec(command, { shell: 'cmd.exe' });
});

// Suggestions
ipcMain.handle('get-suggestions', () => {
  return [...baseSuggestions, ...getInstalledApps()];
});

// Open apps
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

// Built-in commands
const baseSuggestions = [
  {
    text: "Open Chrome",
    match: ["chrome", "google"],
    command: "start chrome"
  },
  {
    text: "Open Edge",
    match: ["edge", "microsoft"],
    command: "start msedge"
  },
  {
    text: "Open Downloads",
    match: ["downloads"],
    command: `start "" "${os.homedir()}\\Downloads"`
  },
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
  {
    text: "Restart PC",
    match: ["restart", "reboot"],
    command: "shutdown /r /t 0"
  },
  {
    text: "Shutdown PC",
    match: ["shutdown", "power off"],
    command: "shutdown /s /t 0"
  }
];

// Dynamic apps
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
        if (f.isDirectory()) {
          walk(fullPath);
        } else if (f.name.endsWith('.lnk') || f.name.endsWith('.url')) {
          const name = f.name.replace(/\.(lnk|url)$/i, '');
          apps.push({
            text: name,
            match: [name.toLowerCase()],
            command: `start "" "${fullPath}"`
          });
        }
      });
    }
    walk(dir);
  });

  return apps;
}

// Auto update events
autoUpdater.on('update-downloaded', () => {
  const { dialog } = require('electron');
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

autoUpdater.on('download-progress', (progress) => {
  console.log(`Download speed: ${progress.bytesPerSecond}`);
  console.log(`Downloaded ${progress.percent}%`);
});
