// All requests are relative: Vite proxies /api to :3001 in dev; Express serves
// the built client and /api in production.
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
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

  getSectionD: () => req('GET', '/api/section-d'),
  saveSectionD: (b) => req('PUT', '/api/section-d', b),

  draft: (qid, evidence) => req('POST', `/api/draft/${qid}`, { evidence }),
  tighten: (text) => req('POST', '/api/tighten', { text }),
  health: () => req('GET', '/api/health'),
};
