const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.commandLine.appendSwitch('disable-features', 'Windows10CustomTitlebar');

let mainWindow;

const baseSuggestions = [
  { text: "Open Chrome", match: ["chrome", "google"], command: "start chrome" },
  { text: "Open Edge", match: ["edge", "microsoft"], command: "start msedge" },
  { text: "Open Downloads", match: ["downloads"], command: `start "" "${os.homedir()}\\Downloads"` },
  {
    text: "Turn Off Wi-Fi",
    match: ["wifi", "disable wifi", "turn off wifi"],
    command: `powershell -Command "Start-Process powershell -ArgumentList 'Disable-NetAdapter -Name \\"Wi-Fi\\" -Confirm:\$false' -Verb RunAs"`
  },
  {
    text: "Turn On Wi-Fi",
    match: ["wifi", "enable wifi", "turn on wifi"],
    command: `powershell -Command "Start-Process powershell -ArgumentList 'Enable-NetAdapter -Name \\"Wi-Fi\\" -Confirm:\$false' -Verb RunAs"`
  },
  { text: "Restart PC", match: ["restart", "reboot"], command: "shutdown /r /t 0" },
  { text: "Shutdown PC", match: ["shutdown", "power off"], command: "shutdown /s /t 0" }
];

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

function createWindow() {
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

app.whenReady().then(() => {
  const dynamicApps = getInstalledApps();

  createWindow();

  globalShortcut.register('Alt+N', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle('get-suggestions', () => {
    return [...baseSuggestions, ...dynamicApps];
  });

  ipcMain.on('close-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  });

  ipcMain.on('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('run-command', (_, command) => {
    exec(command, { shell: 'cmd.exe' }, (err) => {
      if (err) console.error("Failed to run command:", err.message);
    });
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

  autoUpdater.checkForUpdatesAndNotify();

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    openAsHidden: true
  });
});

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

app.on('window-all-closed', (e) => {
  e.preventDefault(); // keeps app running in background
});
