const input = document.getElementById('commandInput');
const results = document.getElementById('results');
let suggestions = [];
let selectedIndex = -1;

// Load initial suggestions and open apps
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

// Show suggestions
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

// Run selected command
function runCommand(cmd) {
  window.electronAPI.runCommand(cmd);
  input.value = '';
  results.innerHTML = '';
  results.classList.remove('show');
}

// Input change
input.addEventListener('input', () => {
  showMatches(input.value.trim());
});

// Keyboard navigation with scroll
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
    if (i === selectedIndex) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
});

document.getElementById('closeBtn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

document.getElementById('minimizeBtn').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

window.electronAPI.getAppVersion().then(version => {
  document.getElementById('version').textContent = `v${version}`;
});

