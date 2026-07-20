import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { maskKey, mergeConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- Supabase (service role, server-side only). Stub if not configured. ---
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY } = process.env;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
} else {
  console.warn('⚠  Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). CRUD endpoints will return 503.');
}

// --- OpenAI. The effective key/model/toggle are resolved per request from the
// app_settings singleton (Settings tab), falling back to OPENAI_API_KEY. ---
if (!OPENAI_API_KEY) {
  console.warn('⚠  No OPENAI_API_KEY in env. Configure a key via the Settings tab, or /api/draft and /api/tighten return labelled stubs.');
}

// Load the singleton settings row (or null). Never throws.
async function loadSettings() {
  if (!supabase) return null;
  const { data } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
  return data || null;
}

// Effective OpenAI config for a request: settings row merged with env fallback.
async function effectiveConfig() {
  return mergeConfig(await loadSettings(), OPENAI_API_KEY);
}

const needDb = (res) =>
  res.status(503).json({ error: 'Supabase not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.' });

// ---------- CRUD: initiatives ----------
app.get('/api/initiatives', async (_req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase.from('initiatives').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/initiatives', async (req, res) => {
  if (!supabase) return needDb(res);
  // No B8 check here: the client now creates a blank initiative immediately
  // and opens its page, where B8 is required before that section can be saved.
  const { name, b8_problem, b9_significance, b10_solution } = req.body;
  const { data, error } = await supabase
    .from('initiatives')
    .insert({ name, b8_problem, b9_significance, b10_solution })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/initiatives/:id', async (req, res) => {
  if (!supabase) return needDb(res);
  const { name, b8_problem, b9_significance, b10_solution } = req.body;
  if (!b8_problem || !b8_problem.trim()) return res.status(400).json({ error: 'B8 business problem is required.' });
  const { data, error } = await supabase
    .from('initiatives')
    .update({ name, b8_problem, b9_significance, b10_solution })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/initiatives/:id', async (req, res) => {
  if (!supabase) return needDb(res);
  const { error } = await supabase.from('initiatives').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---------- CRUD: results ----------
app.get('/api/results', async (_req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase.from('results').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/results', async (req, res) => {
  if (!supabase) return needDb(res);
  const { initiative_id, type, fields, note } = req.body;
  if (!initiative_id) return res.status(400).json({ error: 'An initiative must be selected.' });
  if (!['productivity', 'financial', 'operational'].includes(type)) return res.status(400).json({ error: 'Invalid type.' });
  const { data, error } = await supabase
    .from('results')
    .insert({ initiative_id, type, fields: fields || {}, note })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/results/:id', async (req, res) => {
  if (!supabase) return needDb(res);
  const { initiative_id, type, fields, note } = req.body;
  if (!initiative_id) return res.status(400).json({ error: 'An initiative must be selected.' });
  const { data, error } = await supabase
    .from('results')
    .update({ initiative_id, type, fields: fields || {}, note })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/results/:id', async (req, res) => {
  if (!supabase) return needDb(res);
  const { error } = await supabase.from('results').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---------- section_d (one row per initiative) ----------
// Bulk list — used only by the Initiatives list view to build each card's
// status summary (e.g. "Section D complete") without one request per card.
app.get('/api/section-d', async (_req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase.from('section_d').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/initiatives/:id/section-d', async (req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase
    .from('section_d')
    .select('*')
    .eq('initiative_id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

app.put('/api/initiatives/:id/section-d', async (req, res) => {
  if (!supabase) return needDb(res);
  const initiativeId = req.params.id;
  const { data: existing } = await supabase
    .from('section_d')
    .select('id')
    .eq('initiative_id', initiativeId)
    .maybeSingle();
  const row = { ...req.body, initiative_id: initiativeId };
  if (existing) row.id = existing.id;
  const { data, error } = await supabase.from('section_d').upsert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------- OpenAI drafting ----------
const SYSTEM_PROMPT =
  'You draft answers for a Singapore government (IMDA) SME AI Impact Awards nomination. ' +
  'Write ONLY from the evidence given — never invent numbers, tools, or outcomes not present in the input. ' +
  'If evidence is thin, write a shorter, honest paragraph rather than padding with generic claims. ' +
  'Hard limit: 300 words. Plain, professional, third person about the company (United Ceres College).';

const QUESTION_INTENT = {
  b8: 'Describe the specific business challenge United Ceres College faced and how it impacted operations.',
  b9: 'Explain how significant the problem was, with measurable costs or losses.',
  b10: 'Explain how well the AI solution addressed the problem.',
  c11: 'Summarise measurable productivity gains (speed, accuracy, efficiency) after implementing AI.',
  c12: 'Summarise the financial benefits achieved (cost savings, ROI, revenue).',
  c13: 'Summarise operational benefits (customer service, process, quality) with numbers.',
  d14: 'Describe staff training and adoption of the AI solution.',
  d15: 'Describe how the AI solution changed day-to-day work processes.',
  d16: 'Describe key learning points and readiness for deeper future AI use.',
};

function stubDraft(evidence, reason) {
  return (
    `[AI drafting unavailable — ${reason}. ` +
    'The gathered evidence is shown below verbatim so you can edit it by hand.]\n\n' +
    (evidence || '(no evidence provided)')
  );
}

// Reason string when live AI is not available for a request.
function offReason(cfg) {
  return cfg.enabled ? 'no OpenAI API key configured' : 'live AI calls are turned off in Settings';
}

// Fold persistent organisation context into a system prompt when present.
function withOrgContext(system, orgContext) {
  return orgContext
    ? `${system}\n\nOrganisation context (background about United Ceres College — apply it, do not repeat it verbatim):\n${orgContext}`
    : system;
}

app.post('/api/draft/:questionId', async (req, res) => {
  const qid = String(req.params.questionId).toLowerCase();
  const intent = QUESTION_INTENT[qid];
  if (!intent) return res.status(400).json({ error: `Unknown question id: ${qid}` });
  const evidence = (req.body && req.body.evidence) || '';
  const cfg = await effectiveConfig();
  if (!cfg.enabled || !cfg.key) {
    return res.json({ text: stubDraft(evidence, offReason(cfg)), stub: true });
  }
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    const completion = await client.chat.completions.create({
      model: cfg.analysisModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: withOrgContext(SYSTEM_PROMPT, cfg.orgContext) },
        {
          role: 'user',
          content:
            `Question (${qid.toUpperCase()}): ${intent}\n\n` +
            `Evidence to weave into ONE flowing paragraph (do not use bullet points):\n${evidence || '(no evidence provided)'}`,
        },
      ],
    });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || '' });
  } catch (e) {
    res.status(502).json({ error: `OpenAI request failed: ${e.message}` });
  }
});

const TIGHTEN_SYSTEM =
  'Rewrite the user text into a tighter, more professional register for an IMDA SME AI Impact Awards nomination. ' +
  'Do NOT change any facts, numbers, or claims. Do not add new information. British spelling. Return only the rewritten text.';

app.post('/api/tighten', async (req, res) => {
  const text = (req.body && req.body.text) || '';
  if (!text.trim()) return res.status(400).json({ error: 'No text to tighten.' });
  const cfg = await effectiveConfig();
  if (!cfg.enabled || !cfg.key) return res.json({ text, stub: true });
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    const completion = await client.chat.completions.create({
      model: cfg.utilityModel, // lighter task → utility model
      temperature: 0.3,
      messages: [
        { role: 'system', content: withOrgContext(TIGHTEN_SYSTEM, cfg.orgContext) },
        { role: 'user', content: text },
      ],
    });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || text });
  } catch (e) {
    res.status(502).json({ error: `OpenAI request failed: ${e.message}` });
  }
});

// ---------- Settings ----------
app.get('/api/settings', async (_req, res) => {
  const s = await loadSettings();
  const cfg = mergeConfig(s, OPENAI_API_KEY);
  res.json({
    openai_enabled: cfg.enabled,
    analysis_model: cfg.analysisModel,
    utility_model: cfg.utilityModel,
    org_context: cfg.orgContext,
    key_masked: maskKey(cfg.key), // masked only — full key never leaves the server
    has_key: !!cfg.key,
    key_source: s && s.openai_key ? 'settings' : OPENAI_API_KEY ? 'env' : 'none',
    persistable: !!supabase,
  });
});

app.put('/api/settings', async (req, res) => {
  if (!supabase) return needDb(res);
  const { openai_enabled, analysis_model, utility_model, org_context, openai_key } = req.body || {};
  const { data: existing } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
  const row = {
    openai_enabled: openai_enabled !== false,
    analysis_model: analysis_model || 'gpt-4o-mini',
    utility_model: utility_model || null,
    org_context: org_context || null,
  };
  // Only overwrite the stored key when a new non-empty key is supplied;
  // an empty/omitted key preserves the existing one (upsert leaves unlisted columns untouched).
  if (typeof openai_key === 'string' && openai_key.trim()) row.openai_key = openai_key.trim();
  if (existing) row.id = existing.id;
  const { error } = await supabase.from('app_settings').upsert(row);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Model list from the account, using the effective key (ignores the enable toggle
// so models can be picked while live calls are off).
app.get('/api/settings/openai-models', async (_req, res) => {
  const cfg = await effectiveConfig();
  if (!cfg.key) return res.status(400).json({ error: 'No OpenAI key configured (save a key first).' });
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    const list = await client.models.list();
    res.json({ models: list.data.map((m) => m.id).sort() });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/settings/test-openai', async (_req, res) => {
  const cfg = await effectiveConfig();
  if (!cfg.key) return res.json({ ok: false, error: 'No OpenAI key configured.' });
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    await client.chat.completions.create({
      model: cfg.analysisModel,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    res.json({ ok: true, model: cfg.analysisModel });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/health', async (_req, res) => {
  const cfg = await effectiveConfig();
  res.json({ ok: true, supabase: !!supabase, openai: cfg.enabled && !!cfg.key });
});

// ---------- Serve built client (production) ----------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client not built yet. Run: cd client && npm run build');
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI Impact Builder server on http://localhost:${PORT}`));
