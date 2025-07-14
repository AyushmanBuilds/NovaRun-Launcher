const input = document.getElementById('commandInput');
const results = document.getElementById('results');
let suggestions = [];
let selectedIndex = -1;

// 🔁 Initialize Suggestions
async function initializeSuggestions() {
  const [base, openApps] = await Promise.all([
    window.electronAPI.getSuggestions(),
    window.electronAPI.getOpenApps()
  ]);

  const closeAppSuggestions = openApps.map(app => ({
    text: `Close ${app}`,
    match: [app.toLowerCase(), 'close'],
    command: `taskkill /IM "${app}" /F`
  }));

  const closeAllSuggestion = {
    text: 'Close All Apps',
    match: ['close all'],
    command: openApps.map(app => `taskkill /IM "${app}" /F`).join(' && ')
  };

  suggestions = [...base, ...closeAppSuggestions, closeAllSuggestion];
  showMatches('');
}
initializeSuggestions();

// 🔍 Show Suggestions
function showMatches(query) {
  const matches = suggestions.filter(s => s.text.toLowerCase().includes(query.toLowerCase()));
  results.replaceChildren();
  selectedIndex = -1;

  if (!matches.length) return results.classList.remove('show');
  results.classList.add('show');

  const frag = document.createDocumentFragment();
  for (const s of matches) {
    const div = document.createElement('div');
    div.textContent = '> ' + s.text;
    div.classList.add('suggestion-item');
    div.addEventListener('click', () => runCommand(s.command));
    frag.appendChild(div);
  }
  results.appendChild(frag);
}

// 🏃‍♂️ Run Command
function runCommand(cmd) {
  window.electronAPI.runCommand(cmd);
  input.value = '';
  results.innerHTML = '';
  results.classList.remove('show');
}

// 🎯 Input Handlers
input.addEventListener('input', () => {
  showMatches(input.value.trim());
});

input.addEventListener('keydown', (e) => {
  const items = results.querySelectorAll('div');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % items.length;
  } else if (e.key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    items[selectedIndex].click();
    return;
  } else {
    return;
  }

  e.preventDefault();
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
});

// 🔘 Titlebar Controls
document.getElementById('closeBtn').onclick = () => window.electronAPI.closeWindow();
document.getElementById('minimizeBtn').onclick = () => window.electronAPI.minimizeWindow();
document.getElementById('maximizeBtn').onclick = () => window.electronAPI.maximizeWindow();

// 🔢 Version
window.electronAPI.getAppVersion().then(v => {
  document.getElementById('version').textContent = `v${v}`;
});

// 🌐 Tab Switching
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`${tab}Tab`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  if (tab === 'commands') input.focus();
}

document.querySelectorAll('.nav-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey) {
    if (['1', '2', '3'].includes(e.key)) {
      const tab = { '1': 'commands', '2': 'performance', '3': 'settings' }[e.key];
      switchTab(tab);
    }
  }
});

// 📊 Live System Stats (Throttled)
const cpuText = document.getElementById('cpuText');
const ramText = document.getElementById('ramText');
const cpuPath = document.getElementById('cpuPath');
const ramPath = document.getElementById('ramPath');

function updateMeter(path, textEl, percent) {
  path.setAttribute('stroke-dasharray', `${percent}, 100`);
  textEl.textContent = `${percent}%`;
}

setInterval(() => {
  window.electronAPI.getSystemStats?.().then(stats => {
    if (stats) {
      updateMeter(cpuPath, cpuText, stats.cpu);
      updateMeter(ramPath, ramText, stats.ram);
    }
  });
}, 1500); // smoother throttle
