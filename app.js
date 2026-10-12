'use strict';

const $ = selector => document.querySelector(selector);
const video = $('#demo-video');
const cover = $('#film-cover');
const status = $('#video-status');
let pendingSeek = null;

function startVideo(seconds) {
  cover.hidden = true;
  pendingSeek = seconds;
  if (video.readyState >= 1) {
    video.currentTime = seconds;
    pendingSeek = null;
  }
  video.play().then(() => { status.textContent = 'Video playing.'; }).catch(() => {
    status.textContent = 'Use the video controls to start playback.';
  });
  $('#demo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
video.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== null) { video.currentTime = pendingSeek; pendingSeek = null; }
});
document.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  startVideo(Number(button.dataset.play));
}));
video.addEventListener('error', () => { status.textContent = 'The video could not load. Please use the direct video link or reload the page.'; });
video.addEventListener('timeupdate', () => {
  const chapters = [...document.querySelectorAll('.chapter-row [data-play]')];
  const active = chapters.filter(button => video.currentTime >= Number(button.dataset.play)).at(-1);
  chapters.forEach(button => {
    button.classList.toggle('active', button === active);
    if (button === active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
  });
});

const phases = {
  training: ['Action learning + future-touch prediction', 'The VLA policy and tactile expert are optimized jointly while T3 stays frozen. Predictive supervision spans multiple future moments, using pooled tactile targets.', 'One task-training stage'],
  inference: ['Current touch → action generation', 'The tactile expert processes the current observation once. Its layerwise cache is reused by the action expert; no future tactile generation is needed at deployment.', 'Prediction is training-only'],
};
function selectTab(button, attribute) {
  button.closest('[role="tablist"]').querySelectorAll('[role="tab"]').forEach(tab => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  });
  return button.dataset[attribute];
}
document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => {
  const key = selectTab(button, 'phase');
  const [title, description, tag] = phases[key];
  $('#phase-panel').setAttribute('aria-labelledby', button.id);
  $('#phase-panel h3').textContent = title;
  $('#phase-panel p').textContent = description;
  $('#phase-tag').textContent = tag;
}));
document.querySelectorAll('[role="tablist"]').forEach(list => list.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const position = tabs.indexOf(document.activeElement);
  let next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (position + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next].focus(); tabs[next].click();
}));

let results = null;
function setMethodName(element, name) {
  if (name.includes('π₀.₅')) {
    element.textContent = name.replace('π₀.₅', 'π');
    const subscript = document.createElement('sub'); subscript.textContent = '0.5'; element.append(subscript);
  } else element.textContent = name;
}
function renderResults(key) {
  const data = results[key];
  $('#result-benchmark').textContent = data.label;
  $('#result-mean').textContent = data.mean;
  $('#result-gain').textContent = data.gain;
  $('#protocol-note').textContent = data.note;
  $('#result-context').textContent = key === 'real'
    ? 'The four tasks shown in the demo, evaluated over 20 episodes per task.'
    : 'Highest success on every evaluated UniVTAC task, without additional tactile policy pretraining.';
  const chart = $('#bar-chart'); chart.replaceChildren();
  const sorted = [...data.rows].sort((a, b) => b.values[data.averageIndex] - a.values[data.averageIndex]);
  for (const row of sorted) {
    const div = document.createElement('div');
    div.className = 'chart-row' + (row.method === 'SimpleTouch' ? ' ours' : row.method === 'FTP-1' ? ' ftp' : '');
    const name = document.createElement('span'); name.className = 'chart-name'; setMethodName(name, row.method);
    const track = document.createElement('div'); track.className = 'chart-track'; track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div'); fill.className = 'chart-fill'; fill.style.setProperty('--value', row.values[data.averageIndex] + '%'); track.append(fill);
    const value = document.createElement('span'); value.className = 'chart-value'; value.textContent = row.values[data.averageIndex].toFixed(1);
    div.append(name, track, value); chart.append(div);
  }
  const axis = document.createElement('div'); axis.className = 'chart-axis'; axis.setAttribute('aria-hidden', 'true');
  for (const n of ['0', '25', '50', '75', '100']) { const item = document.createElement('span'); item.textContent = n; axis.append(item); }
  chart.append(axis);
  const table = $('#results-table'); table.replaceChildren();
  const caption = document.createElement('caption'); caption.textContent = `${data.label} — task success rates (%)`;
  const head = document.createElement('thead'); const header = document.createElement('tr');
  for (const title of ['Method', ...data.tasks]) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; header.append(cell); }
  head.append(header); const body = document.createElement('tbody');
  const ranks = data.tasks.map((_, i) => [...new Set(data.rows.map(row => row.values[i]))].sort((a, b) => b - a));
  for (const row of data.rows) {
    const tr = document.createElement('tr'); if (row.method === 'SimpleTouch') tr.className = 'table-ours';
    const label = document.createElement('th'); label.scope = 'row'; setMethodName(label, row.method); tr.append(label);
    row.values.forEach((number, index) => {
      const td = document.createElement('td');
      const text = index >= data.averageIndex ? number.toFixed(1) : String(number);
      if (number === ranks[index][0]) { const b = document.createElement('strong'); b.textContent = text; td.append(b); }
      else { td.textContent = text; if (number === ranks[index][1]) td.className = 'second'; }
      tr.append(td);
    }); body.append(tr);
  }
  table.append(caption, head, body);
}
fetch('assets/results.json').then(response => { if (!response.ok) throw new Error('Results unavailable'); return response.json(); }).then(data => {
  results = data; renderResults('simulation');
}).catch(() => { $('#bar-chart').textContent = 'Full results are available in Tables 1 and 2 of the paper.'; });
document.querySelectorAll('[data-benchmark]').forEach(button => button.addEventListener('click', () => {
  if (!results) return;
  const key = selectTab(button, 'benchmark');
  $('#results-panel').setAttribute('aria-labelledby', button.id); renderResults(key);
}));
fetch('assets/abstract.txt').then(response => { if (!response.ok) throw new Error(); return response.text(); }).then(text => { $('#abstract-text').textContent = text.trim(); }).catch(() => {});

$('#copy-citation').addEventListener('click', async () => {
  const text = $('#bibtex').textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    $('#copy-citation').textContent = 'Copied ✓'; $('#copy-status').textContent = 'BibTeX copied to clipboard.';
    setTimeout(() => { $('#copy-citation').textContent = 'Copy BibTeX ⧉'; }, 2200);
  } catch {
    const range = document.createRange(); range.selectNodeContents($('#bibtex'));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    $('#copy-status').textContent = 'Citation selected. Press Control+C or Command+C to copy.';
    $('#copy-citation').textContent = 'Selected — press ⌘/Ctrl+C';
  }
});
const dialog = $('#figure-dialog');
document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
  $('#dialog-img').src = button.dataset.zoom; $('#dialog-img').alt = button.dataset.caption;
  $('#figure-title').textContent = button.dataset.caption; dialog.showModal();
}));
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
