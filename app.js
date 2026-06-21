// ─── Config ───────────────────────────────────────────────────────────────────
// Replace with your Render backend URL after deploying
const BACKEND_URL = 'https://user-story-analyzer-backend.onrender.com';

// Replace with the APP_SECRET you set in Render environment variables
const APP_SECRET  = 'Bajrangbali@2022';

// ─── State ────────────────────────────────────────────────────────────────────
let generatedDoc = '';

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${name}')"]`).classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
}

// ─── Main analysis runner ─────────────────────────────────────────────────────
async function runAnalysis() {
  const biz   = document.getElementById('bizContext').value.trim();
  const story = document.getElementById('userStory').value.trim();

  if (!biz || !story) { setStatus('Please fill in both Business Context and User Story.'); return; }

  setLoading(true, 'Analyzing — this takes a few moments…');
  resetResults();

  try {
    const [gapsData, protoData, docsData] = await Promise.all([
      callBackend('/api/gaps',          { businessContext: biz, userStory: story }),
      callBackend('/api/prototype',     { businessContext: biz, userStory: story }),
      callBackend('/api/documentation', { businessContext: biz, userStory: story }),
    ]);

    renderGaps(gapsData);
    renderPrototype(protoData.html, story);
    renderDocs(docsData);

    setLoading(false, 'Analysis complete ✓');
  } catch (err) {
    setLoading(false, `Error: ${err.message}`);
  }
}

// ─── Backend API call ─────────────────────────────────────────────────────────
async function callBackend(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': APP_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ─── Renderers ────────────────────────────────────────────────────────────────
function renderGaps(data) {
  if (!data) return;

  const list = document.getElementById('gap-list');
  list.innerHTML = (data.gaps || []).map(g => {
    const cls = g.severity === 'high' ? 'gap-high' : g.severity === 'medium' ? 'gap-med' : 'gap-low';
    return `<div class="gap-item ${cls}">
      <div class="gap-label">${g.severity.toUpperCase()} — ${g.title}</div>
      <div>${g.detail}</div>
    </div>`;
  }).join('');

  document.getElementById('criteria-list').innerHTML =
    (data.acceptance_criteria || [])
      .map(c => `<span class="criteria-chip"><i class="ti ti-check" style="font-size:12px;margin-right:3px;"></i>${c}</span>`)
      .join('');

  document.getElementById('persona-list').innerHTML =
    (data.personas || [])
      .map(p => `<div class="persona-card">
        <div class="persona-name">${p.name}</div>
        <div class="persona-concern">${p.concern}</div>
      </div>`)
      .join('');

  const highCount = (data.gaps || []).filter(g => g.severity === 'high').length;
  const badge = document.getElementById('gap-count');
  badge.textContent = highCount;
  badge.style.display = highCount > 0 ? 'inline' : 'none';

  showResults('gaps');
}

function renderPrototype(html, story) {
  const label = story.split(' ').slice(0, 6).join(' ') + '…';
  document.getElementById('proto-title').textContent = label;
  document.getElementById('proto-content').innerHTML = html;
  showResults('proto');
}

function renderDocs(d) {
  if (!d) return;

  generatedDoc = [
    `# ${d.feature_name || 'Feature Documentation'}`,
    '',
    `## Overview\n${d.overview}`,
    '',
    `## Problem Statement\n${d.problem_statement}`,
    '',
    `## Scope`,
    `**In Scope:**`,
    ...(d.scope?.in_scope  || []).map(i => `- ${i}`),
    '',
    `**Out of Scope:**`,
    ...(d.scope?.out_of_scope || []).map(i => `- ${i}`),
    '',
    `## Functional Requirements`,
    ...(d.functional_requirements || []).map((r, i) => `${i + 1}. ${r}`),
    '',
    `## Non-Functional Requirements`,
    ...(d.non_functional_requirements || []).map(r => `- ${r}`),
    '',
    `## Dependencies`,
    ...(d.dependencies || []).map(r => `- ${r}`),
    '',
    `## Open Questions`,
    ...(d.open_questions || []).map((q, i) => `${i + 1}. ${q}`),
  ].join('\n');

  document.getElementById('doc-content').innerHTML = `
    <div class="doc-section">
      <div class="doc-h2">${d.feature_name || 'Feature'}</div>
      <div class="doc-body">${d.overview}</div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Problem Statement</div>
      <div class="doc-body">${d.problem_statement}</div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Scope</div>
      <div class="doc-scope-grid doc-body">
        <div>
          <strong style="color:var(--success)">✓ In Scope</strong>
          <ul>${(d.scope?.in_scope || []).map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
        <div>
          <strong style="color:var(--danger)">✗ Out of Scope</strong>
          <ul>${(d.scope?.out_of_scope || []).map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Functional Requirements</div>
      <div class="doc-body"><ul>${(d.functional_requirements || []).map(r => `<li>${r}</li>`).join('')}</ul></div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Non-Functional Requirements</div>
      <div class="doc-body"><ul>${(d.non_functional_requirements || []).map(r => `<li>${r}</li>`).join('')}</ul></div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Dependencies</div>
      <div class="doc-body"><ul>${(d.dependencies || []).map(r => `<li>${r}</li>`).join('')}</ul></div>
    </div>
    <div class="doc-section">
      <div class="doc-h2">Open Questions</div>
      <div class="doc-body"><ul>${(d.open_questions || []).map(q => `<li>${q}</li>`).join('')}</ul></div>
    </div>
  `;

  showResults('docs');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showResults(key) {
  document.getElementById(`${key}-empty`).style.display = 'none';
  document.getElementById(`${key}-results`).classList.add('visible');
}

function resetResults() {
  ['gaps', 'proto', 'docs'].forEach(k => {
    const empty   = document.getElementById(`${k}-empty`);
    const results = document.getElementById(`${k}-results`);
    if (empty)   empty.style.display = 'flex';
    if (results) results.classList.remove('visible');
  });
  document.getElementById('gap-count').style.display = 'none';
}

function setLoading(loading, msg) {
  const btn     = document.getElementById('analyzeBtn');
  const spinner = document.getElementById('spinner');
  const label   = document.getElementById('btnLabel');

  btn.disabled          = loading;
  spinner.style.display = loading ? 'block' : 'none';
  label.textContent     = loading ? 'Analyzing…' : 'Re-analyze';
  setStatus(msg);
}

function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}

// ─── Export ───────────────────────────────────────────────────────────────────
function copyDoc() {
  navigator.clipboard.writeText(generatedDoc)
    .then(() => setStatus('Documentation copied to clipboard ✓'))
    .catch(() => setStatus('Copy failed — please copy manually.'));
}

function downloadDoc() {
  const blob = new Blob([generatedDoc], { type: 'text/markdown' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'user-story-documentation.md';
  a.click();
  setStatus('Documentation downloaded ✓');
}
