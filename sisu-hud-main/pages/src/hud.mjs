import * as common from '/pages/src/common.mjs';

/** DOM references **/
const hudContent      = document.getElementById('hud-content');
const resizeHandle    = document.querySelector('.resize-handle');
const statsContainer  = document.getElementById('stats-container');
const scaleSlider     = document.getElementById('scale-slider');
const resetBtn        = document.getElementById('reset-visibility-btn');
const closeBtn        = document.getElementById('close-btn');
const dialog          = document.getElementById('config-dialog');
const openConfigBtn   = document.getElementById('open-config-btn');
const closeConfigBtn  = document.getElementById('close-config-btn');
const saveConfigBtn   = document.getElementById('save-config-btn');
const configForm      = document.getElementById('config-form');
const iconColorPicker = document.getElementById("icon-color");
const valueColorPicker = document.getElementById("value-color");

/** Constants / Keys (for saving to settingsStore) **/
const fieldStateSettingKey      = 'hudFieldOrder';
const boundingBoxSettingsKey    = 'sisu-hud-bounds';
const textScalingFactorSettingsKey = 'sisu-hud-text-scaling';
const modalSettingsKey          = 'sisu-modal-settings';

// For text scaling
const baseFontSize = 48;

/** Global-ish variables **/
let fields = [
  { id: 'cadence', label: 'Cadence', icon: 'icons/cadence.svg', valueClass: 'cadence-value',  isVisible: true },
  { id: 'draft',   label: 'Draft',   icon: 'icons/wind.svg',     valueClass: 'draft-value',    isVisible: true },
  { id: 'hr',      label: 'Heart Rate', icon: 'icons/heart.svg', valueClass: 'hr-value',       isVisible: true },
  { id: 'power',   label: 'Power',   icon: 'icons/bolt.svg',     valueClass: 'power-value',    isVisible: true },
  { id: 'wkg',     label: 'w/kg',    icon: 'icons/wkg.svg',      valueClass: 'wkg-value',      isVisible: true },
  { id: 'speed',   label: 'Speed',   icon: 'icons/speedometer.svg', valueClass: 'speed-value', isVisible: true },
  { id: 'wbal',    label: 'wBal',    icon: 'icons/battery-half.svg', valueClass: 'wbal-value', isVisible: true },
  { id: 'time',    label: 'Time on Course', icon: 'icons/clock.svg', valueClass: 'time-value', isVisible: true },
  { id: 'kj',      label: 'kj', icon: 'icons/kj.svg', valueClass: 'kj-value', isVisible: true },
  { id: 'distance',label: 'distance', icon: 'icons/ruler-horizontal.svg', valueClass: 'distance-value', isVisible: true },
  { id: 'climb',   label: 'climb', icon: 'icons/mountain.svg', valueClass: 'climb-value', isVisible: true },
  { id: 'grade',   label: 'Grade', icon: 'icons/grade.svg', valueClass: 'grade-value', isVisible: true },
];

// Loaded settings from storage
let settings        = null;
let modalSettings   = {};
let iconColor       = "#000";
let valueColor       = "#008";
let savedScale      = 1;

// Keep track of the user we’re rendering for
let USER = 0;

/** Renderer instance **/
const renderer = new common.Renderer(hudContent, { fps: 2 });
renderer.addCallback(rawData => {
  if (!rawData) return;

  const athlete = rawData.athlete || {};
  const state   = rawData.state   || {};

  const numericPower  = Number(state.power  ?? 0);
  const numericWeight = Number(athlete.weight ?? 0);
  const numericWBal   = Number(rawData.wBal ?? -1);

  const updatedStats = {
    cadence: (state.cadence !== undefined) ? Number(state.cadence).toFixed(0) : "N/A",
    draft:   (state.draft   !== undefined) ? Number(state.draft).toFixed(0)   : "N/A",
    hr:      (state.heartrate && state.heartrate !== 0) ? Number(state.heartrate).toFixed(0) : "--",
    power:   (numericPower || numericPower === 0) ? numericPower.toFixed(0)   : "N/A",
    speed:   (state.speed   !== undefined) ? Number(state.speed).toFixed(1)   : "N/A",
    wkg:     (numericWeight > 0)           ? (numericPower / numericWeight).toFixed(2) : "N/A",
    time:    (state.time    !== undefined) ? formatTime(Number(state.time).toFixed(0)) : "--",
    kj:    (state.kj    !== undefined) ? Number(state.kj).toFixed(0) : "--",
    distance: (state.distance !== undefined)
    ? ((Number(state.distance) / 1000).toFixed(1) + " km")
    : "--",
    climb:    (state.climbing    !== undefined) ? Number(state.climbing).toFixed(0) : "--",
    wbal:    "N/A",
    grade: (state.grade !== undefined)
    ? (Number(state.grade) * 100).toFixed(2)  + " %"
    : "--",
  };

  if (numericWBal >= 0) {
    const kj = numericWBal / 1000;
    updatedStats.wbal = (Math.floor(kj * 10) / 10).toFixed(1) + " kj";
  }

  updateStats(updatedStats);
});

/* ===============================
   1) Load All Settings
   =============================== */
function loadAllSettings() {
  // 1) Grab everything from our shared store
  settings = common.settingsStore.get() || {};

  // 2) Parse or read the keys we care about
  const rawModal   = settings[modalSettingsKey] || "{}";
  modalSettings    = JSON.parse(rawModal);
  iconColor        = modalSettings?.iconColor ?? "#000";
  valueColor        = modalSettings?.valueColor ?? "#008";

  const rawFieldState = settings[fieldStateSettingKey] || "[]";
  const savedFieldState = JSON.parse(rawFieldState);

  // If we have a saved field order/visibility, apply it
  if (Array.isArray(savedFieldState) && savedFieldState.length > 0) {
    savedFieldState.forEach(saved => {
      const orig = fields.find(f => f.id === saved.id);
      if (orig) {
        orig.isVisible = saved.isVisible;
      }
    });

    // Re-sort fields to match saved order
    fields.sort((a, b) =>
      savedFieldState.findIndex(x => x.id === a.id) -
      savedFieldState.findIndex(x => x.id === b.id)
    );
  }

  // 3) Load bounding box
  const hudBox = settings[boundingBoxSettingsKey] || false;
  if (hudBox) {
    hudContent.style.width  = hudBox.width  + "px";
    hudContent.style.height = hudBox.height + "px";
    hudContent.style.top    = hudBox.top    + "px";
    hudContent.style.left   = hudBox.left   + "px";
  } else {
    // defaults
    hudContent.style.top    = "5vh";
    hudContent.style.left   = "5vw";
    hudContent.style.width  = "50vw";
    hudContent.style.height = "40vh";
  }

  // 4) Load text scaling
  savedScale = parseFloat(settings[textScalingFactorSettingsKey] || "1");
  scaleSlider.value = savedScale;
  statsContainer.style.fontSize = (baseFontSize * savedScale) + 'px';

  //Set the iconColorPicker Value
  iconColorPicker.value = iconColor;
  valueColorPicker.value = valueColor;
}

/* ===============================
   2) Apply Current Settings
   =============================== */
function applySettings() {
  // Update color of all existing icons
  document.querySelectorAll('.stat-icon svg').forEach(svgEl => {
    svgEl.style.fill   = iconColor;
    svgEl.style.color  = iconColor;
    svgEl.style.stroke = iconColor;
  });

  document.querySelectorAll('.stat-value').forEach(valueEl => {
    valueEl.style.color = valueColor;
  });

  iconColorPicker.value = iconColor;
  valueColorPicker.value = valueColor;
}

/* ===============================
   3) Save Settings to Store
   =============================== */
function saveModalSettings(newSettings) {
  // Overwrite our local copy
  modalSettings = newSettings;

  // Persist to store
  common.settingsStore.set(modalSettingsKey, JSON.stringify(modalSettings));

  // Update local references
  iconColor = modalSettings.iconColor;
  valueColor = modalSettings.valueColor;
}

/* ===============================
   4) Rendering of Fields
   =============================== */
function renderFields() {
  statsContainer.innerHTML = '';
  fields.forEach(field => {
    if (!field.isVisible) return;

    const row = document.createElement('div');
    row.classList.add('stat-row');
    row.dataset.id = field.id;

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.classList.add('stat-icon');
    iconContainer.dataset.src = field.icon;
    iconContainer.addEventListener('contextmenu', e => {
      e.preventDefault();
      hideField(field.id, row);
    });
    row.appendChild(iconContainer);

    // Data value <span>
    const span = document.createElement('span');
    span.classList.add('stat-value', field.valueClass);
    span.style.color = valueColor;
    row.appendChild(span);

    statsContainer.appendChild(row);

    // Inline the SVG icon
    inlineSvgIcon(iconContainer, field.icon, iconColor);
  });
}

/* ===============================
   5) Initialize Sortable DnD
   =============================== */
function initDragAndDrop() {
  new Sortable(statsContainer, {
    animation: 150,
    handle: '.stat-row',
    onEnd: () => {
      const newOrder = [...statsContainer.querySelectorAll('.stat-row')]
        .map(el => el.dataset.id);
      fields.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      saveFields();
    }
  });
}

/* ===============================
   6) HUD Drag-Resize logic
   =============================== */
let startX, startY, originalWidth, originalHeight;

resizeHandle.addEventListener('mousedown', e => {
  e.preventDefault();
  startX = e.clientX; 
  startY = e.clientY;
  originalWidth  = hudContent.offsetWidth;
  originalHeight = hudContent.offsetHeight;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let newWidth = originalWidth + dx;
  let newHeight = originalHeight + dy;

  const winWidth = window.innerWidth * 0.99;
  const winHeight = window.innerHeight * 0.99;

  newWidth = Math.min(newWidth, winWidth);
  newHeight = Math.min(newHeight, winHeight);

  newWidth = Math.max(newWidth, 100);
  newHeight = Math.max(newHeight, 100);

  hudContent.style.width = newWidth + 'px';
  hudContent.style.height = newHeight + 'px';
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  saveHudBox();
}

function saveHudBox() {
  const rect = hudContent.getBoundingClientRect();
  const hudBox = {
    width:  rect.width,
    height: rect.height,
    top:    rect.top,
    left:   rect.left
  };
  common.settingsStore.set(boundingBoxSettingsKey, hudBox);
}

/* ===============================
   7) Event Listeners & Utilities
   =============================== */
scaleSlider.addEventListener('input', e => {
  const scale = parseFloat(e.target.value);
  statsContainer.style.fontSize = (baseFontSize * scale) + 'px';
  common.settingsStore.set(textScalingFactorSettingsKey, scale);
});

resetBtn.addEventListener('click', resetAllVisibility);

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

window.addEventListener('resize', onWindowResize);
function onWindowResize() {
  const winWidth  = window.innerWidth;
  const winHeight = window.innerHeight;
  clampHud(winWidth, winHeight);
}

function clampHud(winWidth, winHeight) {
  const hudRect = hudContent.getBoundingClientRect();

  // Possibly shrink HUD to fit
  let newW = hudRect.width;
  let newH = hudRect.height;
  if (newW > winWidth)  newW = winWidth;
  if (newH > winHeight) newH = winHeight;

  hudContent.style.width = newW + 'px';
  hudContent.style.height = newH + 'px';

  // Re-check bounding box
  const newRect     = hudContent.getBoundingClientRect();
  let currentLeft   = parseFloat(hudContent.style.left) || newRect.left;
  let currentTop    = parseFloat(hudContent.style.top)  || newRect.top;

  // Clamp position
  if (currentLeft + newRect.width > winWidth) {
    currentLeft = winWidth - newRect.width;
  }
  if (currentTop + newRect.height > winHeight) {
    currentTop = winHeight - newRect.height;
  }
  if (currentLeft < 0) currentLeft = 0;
  if (currentTop < 0)  currentTop  = 0;

  hudContent.style.left = currentLeft + 'px';
  hudContent.style.top  = currentTop + 'px';
}

function saveFields() {
  common.settingsStore.set(fieldStateSettingKey, JSON.stringify(fields));
}

function resetAllVisibility() {
  fields.forEach(f => f.isVisible = true);
  saveFields();
  renderFields();
}

function hideField(fieldId, rowElement) {
  rowElement.remove();
  const field = fields.find(f => f.id === fieldId);
  if (!field) return;
  field.isVisible = false;
  saveFields();
}

/** Inline an SVG icon and optionally set its color */
async function inlineSvgIcon(container, svgUrl, color) {
  try {
    const response = await fetch(svgUrl);
    if (!response.ok) {
      console.error(`Failed to fetch ${svgUrl}`, response.status);
      return;
    }
    const svgText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElem = doc.querySelector('svg');
    if (!svgElem) {
      console.error(`No <svg> found in ${svgUrl}`);
      return;
    }

    container.innerHTML = "";
    if (color) {
      svgElem.style.fill   = color;
      svgElem.style.stroke = color;
      svgElem.style.color  = color;
    }
    container.appendChild(svgElem);

  } catch (err) {
    console.error(`Error loading ${svgUrl}`, err);
  }
}

/** Update <span> elements with fresh data */
function updateStats(data) {
  fields.forEach(field => {
    const span = document.querySelector(`.${field.valueClass}`);
    if (!span) return;
    const val = data[field.id];
    span.textContent = val != null ? val : '--';
    span.color = valueColor;
  });
}

/** Format time helper */
function formatTime(secondsString) {
  if (typeof secondsString !== "string") return "--";
  const totalSeconds = parseInt(secondsString, 10);
  if (Number.isNaN(totalSeconds)) return "--";
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs    = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}

/* ===============================
   8) Dialog / Config UI
   =============================== */
function initDialogUI() {
  if (!dialog) return;

  openConfigBtn?.addEventListener('click', () => {
    dialog.showModal();
  });

  closeConfigBtn?.addEventListener('click', () => {
    dialog.close();
  });

  saveConfigBtn?.addEventListener('click', (e) => {
    e.preventDefault(); // Stop <form> from closing the dialog automatically

    // Grab new form data
    const formData = new FormData(configForm);
    const newSettings = {};

    // Suppose you only have a color picker named "iconColor"
    const pickedColor = formData.get('iconColor') || '#000';
    const valueColor = formData.get('valueColor') || '#008';

    newSettings.iconColor = pickedColor;
    newSettings.valueColor = valueColor;

    // Save, apply, close
    saveModalSettings(newSettings);
    applySettings();
    dialog.close();
  });
}

/* ===============================
   9) Initialize Everything
   =============================== */
function init() {
  // 1) Load all settings from store
  loadAllSettings();

  // 2) Render fields in the stats container
  renderFields();

  // 3) Initialize drag & drop for ordering
  initDragAndDrop();

  // 4) Apply color / style settings to what’s already on screen
  applySettings();

  // 5) Initialize the config dialog events
  initDialogUI();
}

/* ===============================
   10) Main app (renderer, watchers)
   =============================== */
async function main() {
  // Subscribe to athlete data or state updates
  common.subscribe('athlete/watching', async data => {
    if (data.athleteId != USER) {
      USER = data.athleteId;
      console.log("Switched to", USER);
    }
    renderer.setData(data);
    renderer.render();
  });

  // Force re-render on window resize
  addEventListener('resize', () => renderer.render({ force: true }));
  renderer.render();
}

/* ===============================
   Run initialization + main
   =============================== */
document.addEventListener('DOMContentLoaded', () => {
  init();
  main();
});
