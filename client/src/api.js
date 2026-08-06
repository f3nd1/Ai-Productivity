// Single point of truth for the API prefix: every request is prefixed with the
// app's base path (import.meta.env.BASE_URL — '/' in dev, '/ai_impact_builder/'
// in the subpath deploy). This means no call site needs to know where the app
// is mounted, and the client works at the domain root or under a subpath alike.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function req(method, url, body) {
  const fullUrl = API_BASE + url; // url always begins with '/api/...'
  const res = await fetch(fullUrl, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Defensive guard: a misrouted request (wrong base path or nginx config)
  // returns the SPA's HTML shell instead of JSON. Fail with a clear, actionable
  // message rather than the cryptic "Unexpected token '<'" that JSON.parse would
  // otherwise throw on the HTML below.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON from ${fullUrl} but received "${contentType || 'no content-type'}" ` +
        `(HTTP ${res.status}). The API request was likely misrouted — check the app's base ` +
        `path and the nginx/proxy config.`
    );
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  listInitiatives: () => req('GET', '/api/initiatives'),
  createInitiative: (b) => req('POST', '/api/initiatives', b),
  updateInitiative: (id, b) => req('PUT', `/api/initiatives/${id}`, b),
  deleteInitiative: (id) => req('DELETE', `/api/initiatives/${id}`),

  listResults: () => req('GET', '/api/results'),
  createResult: (b) => req('POST', '/api/results', b),
  updateResult: (id, b) => req('PUT', `/api/results/${id}`, b),
  deleteResult: (id) => req('DELETE', `/api/results/${id}`),

  // Section D is one overall row for the whole submission, not per initiative.
  getSectionD: () => req('GET', '/api/section-d'),
  saveSectionD: (b) => req('PUT', '/api/section-d', b),

  getFinalAnswers: (initiativeId) => req('GET', `/api/initiatives/${initiativeId}/final-answers`),
  saveFinalAnswers: (initiativeId, answers) =>
    req('PUT', `/api/initiatives/${initiativeId}/final-answers`, { answers }),

  draft: (qid, evidence) => req('POST', `/api/draft/${qid}`, { evidence }),
  tighten: (text) => req('POST', '/api/tighten', { text }),
  elaborate: (text) => req('POST', '/api/tighten', { text, mode: 'elaborate' }),
  exportDraft: (evidence) => req('POST', '/api/export-draft', { evidence }),
  quickFill: (text) => req('POST', '/api/quick-fill', { text }),
  health: () => req('GET', '/api/health'),

  changelog: () => req('GET', '/api/changelog'),

  getSettings: () => req('GET', '/api/settings'),
  saveSettings: (b) => req('PUT', '/api/settings', b),
  openaiModels: () => req('GET', '/api/settings/openai-models'),
  testOpenai: () => req('POST', '/api/settings/test-openai', {}),
};
