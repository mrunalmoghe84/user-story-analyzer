// ─── Config ───────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://user-story-analyzer-backend.onrender.com';
const APP_SECRET  = 'Bajrangbali@2022';

// ─── State ────────────────────────────────────────────────────────────────────
let generatedDoc  = '';
let lastGapsData  = null;
let lastDocsData  = null;
let lastPersonas  = null;
let lastCriteria  = null;
let currentIssue  = null;

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${name}')"]`).classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
}

// ─── GitHub: Load open issues into dropdown ───────────────────────────────────
async function loadIssues() {
  const select = document.getElementById('issue-select');
  select.innerHTML = '<option value="">Loading issues...</option>';
  try {
    const res  = await callBackend('/api/github/issues', 'GET');
    const list = await res.json();
    select.innerHTML = '<option value="">— select an issue —</option>' +
      list.map(i => `<option value="${i.number}">#${i.number} — ${i.title}</option>`).join('');
  } catch (e) {
    select.innerHTML = '<option value="">Failed to load issues</option>';
  }
}

// ─── GitHub: Fetch selected issue ────────────────────────────────────────────
async function fetchIssue() {
  const num = document.getElementById('issue-select').value;
  if (!num) return;

  setStatus('Loading issue from GitHub...');
  try {
    const res  = await callBackend('/api/github/fetch-issue', 'POST', { issueNumber: num });
    const issue = await res.json();
    currentIssue = issue;

    document.getElementById('userStory').value = `${issue.title}\n\n${issue.body}`;
    document.getElementById('issue-badge').textContent = `#${issue.number} loaded`;
    document.getElementById('issue-badge').style.display = 'inline';
    setStatus(`Issue #${issue.number} loaded — now click Analyze Story.`);
  } catch (e) {
    setStatus('Error loading issue: ' + e.message);
  }
}

// ─── GitHub: Push results back ────────────────────────────────────────────────
async function pushToGitHub() {
  if (!currentIssue) { setStatus('No GitHub issue loaded.'); return; }

  const btn = document.getElementById('push-btn');
  btn.disabled = true;
  btn.textContent = 'Pushing...';
  setStatus('Posting results to GitHub issue...');

  try {
    const res  = await callBackend('/api/github/push-results', 'POST', {
      issueNumber:       currentIssue.number,
      gaps:              lastGapsData?.gaps || [],
      acceptanceCriteria: lastCriteria || [],
      personas:          lastPersonas || [],
      documentation:     lastDocsData,
    });
    const data = await res.json();

    btn.textContent = '✓ Pushed!';
    setStatus(`Posted to GitHub! View comment: ${data.commentUrl}`);

    // Open the comment in a new tab
    window.open(data.commentUrl, '_blank');
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Push to GitHub';
    setStatus('Error pushing to GitHub: ' + e.message);
  }
}

// ─── Main analysis runner ─────────────────────────────────────────────────────
async function runAnalysis() {
  const biz   = document.getElementById('bizContext').value.trim();
  const story = document.getElementById('userStory').value.trim();

  if (!biz || !story) { setStatus('Please fill in both Business Context and User Story.'); return; }

  setLoading(true, 'Analyzing — this takes a few moments…');
  resetResults();

  try {
    const [gapsRes, protoRes, docsRes] = await Promise.all([
      callBackend('/api/gaps',          'POST', { businessContext: biz, userStory: story }),
      callBackend('/api/prototype',     'POST', { businessContext: biz, userStory: story }),
      callBackend('/api/documentation', 'POST', { businessContext: biz, userStory: story }),
    ]);

    const [gapsData, protoData, docsData] = await Promise.all([
      gapsRes.json(), protoRes.json(), docsRes.json()
    ]);

    // Save state for GitHub push
    lastGapsData = gapsData;
    lastCriteria = gapsData.acceptance_criteria;
    lastPersonas = gapsData.personas;
    lastDocsData = docsData;

    renderGaps(gapsData);
    renderPrototype(protoData.html, story);
    renderDocs(docsData);

    // Show push button if a GitHub issue is loaded
    if (currentIssue) {
      const btn = document.getElementById('push-btn');
      btn.style.display = 'inline-flex';
      btn.disabled = false;
      btn.textContent = 'Push to GitHub';
    }

    setLoading(false, 'Analysis complete ✓');
  } catch (err) {
    setLoading(false, `Error: ${err.message}`);
  }
}

// ─── Backend API call ─────────────────────────────────────────────────────────
function callBackend(path, method = 'POST', body = null) {
  return fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': APP_SECRET,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(res => {
    if (!res.ok) return res.json().then(e => { throw new Error(e.error || `Server error ${res.status}`); });
    return res;
  });
}

// ─── Renderers ────────────────────────────────────────────────────────────────
function renderGaps(data) {
  if (!data) return;

  document.getElementById('gap-list').innerHTML = (data.gaps || []).map(g => {
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
      .map(p => `<div class="persona-card"><div class="persona-name">${p.name}</div><div class="persona-concern">${p.concern}</div></div>`)
      .join('');

  const highCount = (data.gaps || []).filter(g => g.severity === 'high').length;
  const badge = document.getElementById('gap-count');
  badge.textContent = highCount;
  badge.style.display = highCount > 0 ? 'inline' : 'none';

  showResults('gaps');
}

function renderPrototype(html, story) {
  document.getElementById('proto-title').textContent = story.split(' ').slice(0, 6).join(' ') + '…';
  document.getElementById('proto-content').innerHTML = html;
  showResults('proto');
}

function renderDocs(d) {
  if (!d) return;

  generatedDoc = [
    `# ${d.feature_name || 'Feature Documentation'}`, '',
    `## Overview\n${d.overview}`, '',
    `## Problem Statement\n${d.problem_statement}`, '',
    `## Scope`,
    `**In Scope:**`, ...(d.scope?.in_scope || []).map(i => `- ${i}`), '',
    `**Out of Scope:**`, ...(d.scope?.out_of_scope || []).map(i => `- ${i}`), '',
    `## Functional Requirements`, ...(d.functional_requirements || []).map((r, i) => `${i + 1}. ${r}`), '',
    `## Non-Functional Requirements`, ...(d.non_functional_requirements || []).map(r => `- ${r}`), '',
    `## Dependencies`, ...(d.dependencies || []).map(r => `- ${r}`), '',
    `## Open Questions`, ...(d.open_questions || []).map((q, i) => `${i + 1}. ${q}`),
  ].join('\n');

  document.getElementById('doc-content').innerHTML = `
    <div class="doc-section"><div class="doc-h2">${d.feature_name || 'Feature'}</div><div class="doc-body">${d.overview}</div></div>
    <div class="doc-section"><div class="doc-h2">Problem Statement</div><div class="doc-body">${d.problem_statement}</div></div>
    <div class="doc-section"><div class="doc-h2">Scope</div>
      <div class="doc-scope-grid doc-body">
        <div><strong style="color:var(--success)">✓ In Scope</strong><ul>${(d.scope?.in_scope || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
        <div><strong style="color:var(--danger)">✗ Out of Scope</strong><ul>${(d.scope?.out_of_scope || []).map(i => `<li>${i}</li>`).join('')}</ul></div>
      </div>
    </div>
    <div class="doc-section"><div class="doc-h2">Functional Requirements</div><div class="doc-body"><ul>${(d.functional_requirements || []).map(r => `<li>${r}</li>`).join('')}</ul></div></div>
    <div class="doc-section"><div class="doc-h2">Non-Functional Requirements</div><div class="doc-body"><ul>${(d.non_functional_requirements || []).map(r => `<li>${r}</li>`).join('')}</ul></div></div>
    <div class="doc-section"><div class="doc-h2">Dependencies</div><div class="doc-body"><ul>${(d.dependencies || []).map(r => `<li>${r}</li>`).join('')}</ul></div></div>
    <div class="doc-section"><div class="doc-h2">Open Questions</div><div class="doc-body"><ul>${(d.open_questions || []).map(q => `<li>${q}</li>`).join('')}</ul></div></div>
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
    document.getElementById(`${k}-empty`).style.display = 'flex';
    document.getElementById(`${k}-results`).classList.remove('visible');
  });
  document.getElementById('gap-count').style.display = 'none';
  document.getElementById('push-btn').style.display = 'none';
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

function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }

function copyDoc() {
  navigator.clipboard.writeText(generatedDoc)
    .then(() => setStatus('Documentation copied ✓'))
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

// Load issues on page load
window.addEventListener('DOMContentLoaded', loadIssues);
