// ================== Suggestions & Input ==================
const input = document.getElementById('commandInput');
const results = document.getElementById('results');
let suggestions = [];
let selectedIndex = -1;
let lastQuery = '';

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

function showMatches(query) {
  lastQuery = query;
  requestIdleCallback(() => {
    const matches = suggestions.filter(s =>
      s.text.toLowerCase().includes(query.toLowerCase())
    );

    results.replaceChildren();
    selectedIndex = -1;
    if (!matches.length) return results.classList.remove('show');

    results.classList.add('show');

    const frag = document.createDocumentFragment();
    matches.forEach((s, idx) => {
      const div = document.createElement('div');
      div.textContent = '> ' + s.text;
      div.className = 'suggestion-item';
      div.addEventListener('click', () => runCommand(s.command));
      frag.appendChild(div);
    });
    results.appendChild(frag);
  });
}

function runCommand(cmd) {
  window.electronAPI.runCommand(cmd);
  input.value = '';
  results.classList.remove('show');
  results.replaceChildren();
  selectedIndex = -1;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

input.addEventListener('input', debounce(() => {
  const query = input.value.trim();
  showMatches(query);
}, 80));

input.addEventListener('keydown', (e) => {
  const items = results.querySelectorAll('.suggestion-item');
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
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
});

// ================== Window Controls ==================
document.getElementById('closeBtn').onclick = () => window.electronAPI.closeWindow();
document.getElementById('minimizeBtn').onclick = () => window.electronAPI.minimizeWindow();
document.getElementById('maximizeBtn').onclick = () => window.electronAPI.maximizeWindow();

// ================== Version ==================
window.electronAPI.getAppVersion().then(v => {
  document.getElementById('version').textContent = `v${v}`;
});

// ================== Tab Switching ==================
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
  if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
    const tab = { '1': 'commands', '2': 'performance', '3': 'settings' }[e.key];
    switchTab(tab);
  }
});

// ================== Performance Meters ==================
const ramText = document.getElementById('ramText');
const ramPath = document.getElementById('ramPath');
const coreMetersContainer = document.getElementById('coreMeters');

function updateMeter(path, textEl, percent) {
  const safe = isNaN(percent) ? 0 : Math.min(Math.max(percent, 0), 100);
  path.setAttribute('stroke-dasharray', `${safe}, 100`);
  textEl.textContent = `${safe}%`;
}

function createCoreMeter(index) {
  const meter = document.createElement('div');
  meter.className = 'core-meter';
  meter.innerHTML = `
    <svg viewBox="0 0 36 36">
      <path class="bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
      <path id="corePath${index}" class="progress" stroke-dasharray="0, 100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
    </svg>
    <div class="label"><span id="coreText${index}">0%</span><br>Core ${index + 1}</div>
  `;
  return meter;
}

// ✅ SMOOTH STAT UPDATER
let lastStats = {};
let animationFrameId;

function updateStatsSmoothly(newStats) {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(() => {
    if (!newStats) return;

    // RAM
    updateMeter(ramPath, ramText, newStats.ram);

    // Init core meters if not done
    if (coreMetersContainer.childElementCount === 0 && newStats.cores?.length) {
      newStats.cores.forEach((_, i) => {
        coreMetersContainer.appendChild(createCoreMeter(i));
      });
    }

    // Update cores
    newStats.cores?.forEach((usage, i) => {
      const path = document.getElementById(`corePath${i}`);
      const text = document.getElementById(`coreText${i}`);
      if (path && text) updateMeter(path, text, usage);
    });

    lastStats = newStats;
  });
}

setInterval(() => {
  window.electronAPI.getSystemStats?.().then(updateStatsSmoothly);
}, 1200);
