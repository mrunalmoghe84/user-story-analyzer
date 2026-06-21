// ─── State ───────────────────────────────────────────────────────────────────
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
  const key   = document.getElementById('apiKey').value.trim();

  if (!biz || !story) { setStatus('Please fill in both Business Context and User Story.'); return; }
  if (!key)            { setStatus('Please enter your Anthropic API key.'); return; }

  setLoading(true, 'Analyzing — this takes a few moments…');
  resetResults();

  try {
    const [gapsRaw, protoRaw, docsRaw] = await Promise.all([
      callClaude(key, buildGapPrompt(biz, story)),
      callClaude(key, buildProtoPrompt(biz, story)),
      callClaude(key, buildDocPrompt(biz, story)),
    ]);

    renderGaps(gapsRaw);
    renderPrototype(protoRaw, story);
    renderDocs(docsRaw);

    setLoading(false, 'Analysis complete ✓');
  } catch (err) {
    setLoading(false, `Error: ${err.message}`);
  }
}

// ─── Anthropic API call ───────────────────────────────────────────────────────
async function callClaude(apiKey, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
function buildGapPrompt(biz, story) {
  return `You are a senior product analyst. Analyze this user story for gaps, risks, and missing details.

Business Context: ${biz}

User Story: ${story}

Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "gaps": [
    {"severity": "high|medium|low", "title": "short title", "detail": "explanation under 2 sentences"}
  ],
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "personas": [
    {"name": "Persona Name", "concern": "what they need that the story doesn't address"}
  ]
}

Cover 4–7 gaps across: missing error handling, edge cases, security/auth, performance, accessibility, business rules, and unclear scope.`;
}

function buildProtoPrompt(biz, story) {
  return `You are a UX designer. Generate a clean semantic HTML snippet for a realistic UI prototype based on this user story.

Business Context: ${biz}
User Story: ${story}

Rules:
- Self-contained HTML snippet (no <html>/<head>/<body> tags)
- Inline styles only, no external CSS
- Represent the PRIMARY screen the user interacts with
- Include realistic form fields, labels, buttons, and placeholder data
- Single focused screen/form, card-based white layout
- Approx 40–60 lines of HTML`;
}

function buildDocPrompt(biz, story) {
  return `You are a technical writer. Create structured documentation for this user story.

Business Context: ${biz}
User Story: ${story}

Respond ONLY with valid JSON — no markdown fences, no preamble:
{
  "feature_name": "...",
  "overview": "2–3 sentence summary",
  "problem_statement": "what problem this solves",
  "scope": {
    "in_scope": ["item1", "item2"],
    "out_of_scope": ["item1", "item2"]
  },
  "functional_requirements": ["req1", "req2", "req3", "req4", "req5"],
  "non_functional_requirements": ["perf", "security", "accessibility"],
  "dependencies": ["dep1", "dep2"],
  "open_questions": ["question1", "question2", "question3"]
}`;
}

// ─── Renderers ────────────────────────────────────────────────────────────────
function renderGaps(raw) {
  const data = safeParseJSON(raw);
  if (!data) return;

  // Gaps
  const list = document.getElementById('gap-list');
  list.innerHTML = (data.gaps || []).map(g => {
    const cls = g.severity === 'high' ? 'gap-high' : g.severity === 'medium' ? 'gap-med' : 'gap-low';
    return `<div class="gap-item ${cls}">
      <div class="gap-label">${g.severity.toUpperCase()} — ${g.title}</div>
      <div>${g.detail}</div>
    </div>`;
  }).join('');

  // Acceptance criteria
  document.getElementById('criteria-list').innerHTML =
    (data.acceptance_criteria || [])
      .map(c => `<span class="criteria-chip"><i class="ti ti-check" style="font-size:12px;margin-right:3px;"></i>${c}</span>`)
      .join('');

  // Personas
  document.getElementById('persona-list').innerHTML =
    (data.personas || [])
      .map(p => `<div class="persona-card">
        <div class="persona-name">${p.name}</div>
        <div class="persona-concern">${p.concern}</div>
      </div>`)
      .join('');

  // Badge
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

function renderDocs(raw) {
  const d = safeParseJSON(raw);
  if (!d) return;

  // Build markdown for download/copy
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

  // Build HTML view
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

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('JSON parse error:', e, raw);
    return null;
  }
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
