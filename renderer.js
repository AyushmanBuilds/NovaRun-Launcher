const input = document.getElementById('commandInput');
const results = document.getElementById('results');
let suggestions = [];
let selectedIndex = -1;

// Load suggestions
async function initializeSuggestions() {
  const base = await window.electronAPI.getSuggestions();
  const openApps = await window.electronAPI.getOpenApps();

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

// Show filtered matches
function showMatches(query) {
  const matches = suggestions.filter(s =>
    s.text.toLowerCase().includes(query.toLowerCase())
  );

  results.innerHTML = '';
  selectedIndex = -1;

  if (matches.length === 0) {
    results.classList.remove('show');
    return;
  }

  results.classList.add('show');

  matches.forEach((s, i) => {
    const div = document.createElement('div');
    div.textContent = '> ' + s.text;
    div.classList.add('suggestion-item');
    div.addEventListener('click', () => runCommand(s.command));
    results.appendChild(div);
  });
}

// Run command
function runCommand(cmd) {
  window.electronAPI.runCommand(cmd);
  input.value = '';
  results.innerHTML = '';
  results.classList.remove('show');
}

// Handle typing
input.addEventListener('input', () => {
  showMatches(input.value.trim());
});

// Arrow key nav
input.addEventListener('keydown', (e) => {
  const items = results.querySelectorAll('div');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % items.length;
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    e.preventDefault();
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    items[selectedIndex].click();
    return;
  }

  items.forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
    if (i === selectedIndex) el.scrollIntoView({ block: 'nearest' });
  });
});

// Titlebar buttons
document.getElementById('closeBtn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});
document.getElementById('minimizeBtn').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});
document.getElementById('maximizeBtn').addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

// Version label
window.electronAPI.getAppVersion().then(version => {
  document.getElementById('version').textContent = `v${version}`;
});


// 💡 New: Tab Switching Logic
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Deactivate all
    navButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(tab => tab.classList.remove('active'));

    // Activate clicked
    button.classList.add('active');
    const tabId = button.dataset.tab;
    document.getElementById(`${tabId}Tab`).classList.add('active');

    // Optional: Focus command input when switching back to command tab
    if (tabId === 'commands') input.focus();
  });
});


// 🧠 Performance polling for CPU/RAM (text only version)
function updateSystemStats() {
  window.electronAPI.getSystemStats?.().then(stats => {
    if (!stats) return;

    const cpu = stats.cpu;
    const ram = stats.ram;

    // Text values
    document.getElementById('cpuText').textContent = `${cpu}%`;
    document.getElementById('ramText').textContent = `${ram}%`;

    // Circular meters
    document.getElementById('cpuPath').setAttribute('stroke-dasharray', `${cpu}, 100`);
    document.getElementById('ramPath').setAttribute('stroke-dasharray', `${ram}, 100`);
  });
}

setInterval(updateSystemStats, 2000);

document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey) return;

  const tabMap = {
    '1': 'commands',
    '2': 'performance',
    '3': 'settings'
  };

  const targetTab = tabMap[e.key];
  if (!targetTab) return;

  navButtons.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(tab => tab.classList.remove('active'));

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${targetTab}"]`);
  const activeTab = document.getElementById(`${targetTab}Tab`);

  if (activeBtn && activeTab) {
    activeBtn.classList.add('active');
    activeTab.classList.add('active');
    if (targetTab === 'commands') input.focus();
  }
});

