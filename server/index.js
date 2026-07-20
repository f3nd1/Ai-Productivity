import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

// --- OpenAI. Stub if not configured. Model: gpt-4o-mini per spec. ---
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn('⚠  OpenAI not configured (OPENAI_API_KEY missing). /api/draft and /api/tighten return the raw evidence with a clear notice.');
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
  const { name, b8_problem, b9_significance, b10_solution } = req.body;
  if (!b8_problem || !b8_problem.trim()) return res.status(400).json({ error: 'B8 business problem is required.' });
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

// ---------- section_d (singleton) ----------
app.get('/api/section-d', async (_req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase.from('section_d').select('*').limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

app.put('/api/section-d', async (req, res) => {
  if (!supabase) return needDb(res);
  const body = req.body || {};
  // upsert the single row: reuse existing id if present.
  const { data: existing } = await supabase.from('section_d').select('id').limit(1).maybeSingle();
  const row = { ...body };
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

function stubDraft(evidence) {
  return (
    '[AI drafting unavailable — OPENAI_API_KEY not set on the server. ' +
    'The gathered evidence is shown below verbatim so you can edit it by hand.]\n\n' +
    (evidence || '(no evidence provided)')
  );
}

app.post('/api/draft/:questionId', async (req, res) => {
  const qid = String(req.params.questionId).toLowerCase();
  const intent = QUESTION_INTENT[qid];
  if (!intent) return res.status(400).json({ error: `Unknown question id: ${qid}` });
  const evidence = (req.body && req.body.evidence) || '';
  if (!openai) return res.json({ text: stubDraft(evidence), stub: true });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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

app.post('/api/tighten', async (req, res) => {
  const text = (req.body && req.body.text) || '';
  if (!text.trim()) return res.status(400).json({ error: 'No text to tighten.' });
  if (!openai) return res.json({ text, stub: true });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Rewrite the user text into a tighter, more professional register for an IMDA SME AI Impact Awards nomination. ' +
            'Do NOT change any facts, numbers, or claims. Do not add new information. British spelling. Return only the rewritten text.',
        },
        { role: 'user', content: text },
      ],
    });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || text });
  } catch (e) {
    res.status(502).json({ error: `OpenAI request failed: ${e.message}` });
  }
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, supabase: !!supabase, openai: !!openai })
);

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
