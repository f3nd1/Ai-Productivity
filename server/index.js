import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
  // No B8 check here: the client creates the initiative from a name prompt and
  // opens its page, where B8 is required before that section can be saved.
  // initiative_code is deliberately NOT accepted from the client and never
  // inserted: the column's Postgres default pulls from a sequence, so the code
  // is allocated by the database and stays unique and sequential.
  const { name, department, b8_problem, b9_significance, b10_solution, not_applicable } = req.body;
  const { data, error } = await supabase
    .from('initiatives')
    .insert({
      name,
      department,
      b8_problem,
      b9_significance,
      b10_solution,
      not_applicable: not_applicable || {},
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/initiatives/:id', async (req, res) => {
  if (!supabase) return needDb(res);
  const { name, department, b8_problem, b9_significance, b10_solution, not_applicable } = req.body;
  if (!b8_problem || !b8_problem.trim()) return res.status(400).json({ error: 'B8 business problem is required.' });
  const patch = {
    name,
    department,
    b8_problem,
    b9_significance,
    b10_solution,
    updated_at: new Date().toISOString(), // stamped here rather than by a trigger
  };
  // Only overwrite the N/A declarations when the client actually sent them.
  if (not_applicable !== undefined) patch.not_applicable = not_applicable || {};
  const { data, error } = await supabase
    .from('initiatives')
    .update(patch)
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

// ---------- final answers (jsonb on the initiative row) ----------
app.get('/api/initiatives/:id/final-answers', async (req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase
    .from('initiatives')
    .select('final_answers')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data?.final_answers || {});
});

app.put('/api/initiatives/:id/final-answers', async (req, res) => {
  if (!supabase) return needDb(res);
  const answers = (req.body && req.body.answers) || {};
  const { data, error } = await supabase
    .from('initiatives')
    .update({ final_answers: answers })
    .eq('id', req.params.id)
    .select('final_answers')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.final_answers);
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

// ---------- section_d (ONE overall row, not per initiative) ----------
// Section D is the organisation-wide closing section: one set of D14/D15/D16
// covering adoption, process change and future readiness across every
// initiative. The table holds a single row; the app never creates a second.
app.get('/api/section-d', async (_req, res) => {
  if (!supabase) return needDb(res);
  const { data, error } = await supabase.from('section_d').select('*').limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

app.put('/api/section-d', async (req, res) => {
  if (!supabase) return needDb(res);
  const { data: existing } = await supabase.from('section_d').select('id').limit(1).maybeSingle();
  // Reuse the existing row's id so the upsert updates it instead of inserting a
  // second one — that's what keeps this table a singleton.
  const row = existing ? { ...req.body, id: existing.id } : { ...req.body };
  const { data, error } = await supabase.from('section_d').upsert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------- OpenAI drafting ----------
// House style, shared by every prompt below. This is an internal drafting tool
// for one college, so naming the organisation in the output is noise — the
// reader already knows whose evidence this is. Short and factual beats padded:
// a sentence of praise is a sentence that isn't evidence.
const HOUSE_STYLE =
  'Write in plain, simple words. Keep it short: 1 to 3 sentences, around 100 words, and stop there. ' +
  'Do NOT name the organisation or write about it in the third person — this is an internal document ' +
  'and the reader knows which college it is. Just say what happened. ' +
  'No praise, no adjectives like "remarkable", "significant" or "innovative", no sentences about ' +
  'commitment, vision or transformation. State the facts and the figures, nothing else. ' +
  'Better to write one honest sentence than to pad.';

const systemPrompt = () =>
  'You draft answers for a Singapore government (IMDA) SME AI Impact Awards nomination. ' +
  'Write ONLY from the evidence given — never invent numbers, tools, or outcomes not present in the ' +
  `input. If the evidence is thin, write less rather than filling the gap. ${HOUSE_STYLE}`;

const QUESTION_INTENT = {
  b8: 'Describe the specific business challenge faced and how it affected day-to-day work.',
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
    ? `${system}\n\nBackground context — apply it, but do not repeat it verbatim and do not name the ` +
      `organisation in your answer:\n${orgContext}`
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
        { role: 'system', content: withOrgContext(systemPrompt(), cfg.orgContext) },
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
  'Rewrite the user text so it is shorter and clearer, for an IMDA SME AI Impact Awards nomination. ' +
  'Do NOT change any facts, numbers, or claims. Do not add new information. ' +
  'Never add facts, numbers, or claims beyond what the input already states. ' +
  `British spelling. Return only the rewritten text. ${HOUSE_STYLE}`;

// Elaborate: the opposite direction to Tighten — it turns a fragment into
// sentences. Growing the text must never grow the CLAIMS. It used to emit
// "[add: ...]" markers for missing detail; that's been dropped in favour of
// simply writing less, so the output is usable as-is.
const ELABORATE_SYSTEM =
  'You turn a short, fragmentary note into proper sentences for a Singapore government (IMDA) award ' +
  'nomination form. Restate only what is explicitly stated — do not invent facts, numbers, tools, or ' +
  'outcomes, and do not add detail the note does not contain. If the note is thin, the output is ' +
  'short: that is correct, not a failure. Never write a placeholder or a bracketed note about missing ' +
  `information — write only the sentences themselves. Output only the text, no preamble. ${HOUSE_STYLE}`;

// Both modes take one field's text and return one field's text, so they share an
// endpoint; only the system prompt and model tier differ. Elaborate uses the
// analysis model because not inventing facts is the harder instruction to follow.
const REWRITE_MODES = {
  tighten: { system: TIGHTEN_SYSTEM, model: (cfg) => cfg.utilityModel },
  elaborate: { system: ELABORATE_SYSTEM, model: (cfg) => cfg.analysisModel },
};

// The form's own "What to include" guidance, sent by the client from
// questions.js so there's one copy of that text in the codebase. It exists to
// steer WHAT the answer covers — but it's full of illustrative figures
// ("Lost $5,000 monthly due to overstocking"), and a model handed those will
// happily repeat them as if they were this college's numbers. Hence the ban.
function elaborateUserMessage({ text, label, guidance, context }) {
  const parts = [];
  if (label) parts.push(`This field is: ${label}`);
  if (guidance) {
    parts.push(
      `What the form asks this field to cover:\n${guidance}\n\n` +
        'Use that ONLY to decide what kind of content belongs here. It contains made-up examples — ' +
        'never copy their figures, names or wording into your answer. If the note below has no ' +
        'figure of that kind, leave it out entirely rather than borrowing one from the examples.'
    );
  }
  if (context) {
    parts.push(
      `Evidence already recorded for this initiative (you may draw on it, but add nothing beyond ` +
        `it):\n${context}`
    );
  }
  parts.push(`The text to expand:\n${text}`);
  return parts.join('\n\n---\n\n');
}

app.post('/api/tighten', async (req, res) => {
  const text = (req.body && req.body.text) || '';
  const modeKey = REWRITE_MODES[req.body?.mode] ? req.body.mode : 'tighten';
  const mode = REWRITE_MODES[modeKey];
  if (!text.trim()) return res.status(400).json({ error: `No text to ${modeKey}.` });
  const cfg = await effectiveConfig();
  if (!cfg.enabled || !cfg.key) return res.json({ text, stub: true });
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    // Tighten only rewords what's there, so it never gets guidance or context —
    // both could only tempt it to add something.
    const user =
      modeKey === 'elaborate'
        ? elaborateUserMessage({
            text,
            label: req.body?.label,
            guidance: req.body?.guidance,
            context: req.body?.context,
          })
        : text;
    const completion = await client.chat.completions.create({
      model: mode.model(cfg),
      temperature: 0.3,
      messages: [
        { role: 'system', content: withOrgContext(mode.system, cfg.orgContext) },
        { role: 'user', content: user },
      ],
    });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || text });
  } catch (e) {
    res.status(502).json({ error: `OpenAI request failed: ${e.message}` });
  }
});

// ---------- Quick Fill: rough notes -> structured B fields + proposed results ----------
// Quick Fill is propose-and-elaborate, not literal extraction — but the two
// kinds of content follow different rules, and the difference is the whole
// point. WORDS may be expanded; NUMBERS may not be conjured. A wrong figure in
// a government submission is unrecoverable in a way clumsy prose never is.
const QUICK_FILL_SYSTEM =
  'You turn a rough, informal note about an AI initiative into draft evidence for a Singapore ' +
  'government (IMDA) award submission. You follow two DIFFERENT rules for two kinds of content.\n\n' +
  'RULE 0 — THE NAMES. "names" is a list of 3 short title options, not sentences: a few words each, ' +
  'naming what the initiative actually is, worked out from the problem and the solution in the note ' +
  'so they match the other fields. Make them genuinely different from each other — for example one ' +
  'naming the AI tool used, one naming the process it improved, one naming the outcome. Return an ' +
  'empty list only if the note gives no idea what the initiative is.\n\n' +
  'RULE 1 — QUALITATIVE TEXT (b8, b9, b10, and each result\'s "note"). Turn what the note says into ' +
  'proper sentences: 1 to 3 sentences, simple words, around 100 words at most. You may restate and ' +
  'join up what is stated, but you may NOT introduce facts, figures, tools or outcomes the note does ' +
  'not contain. If the note is thin on a field, write one short sentence — do not stretch it, and ' +
  'never write a placeholder or a bracketed note about missing information. Return null for a field ' +
  'only if the note says nothing at all bearing on it.\n\n' +
  'What each field should cover:\n' +
  'b8 — the specific operational challenge: what was going wrong, and how it hit day-to-day work ' +
  '(delays, bottlenecks, rework, manual effort, resource limits).\n' +
  'b9 — how much that problem cost, in measurable terms: time lost, money lost, work delayed, ' +
  'opportunities missed. Only figures the note actually gives.\n' +
  'b10 — what the AI solution was and how well it fixed the problem. NAME THE AI TOOL OR TYPE if ' +
  'the note mentions one (e.g. ChatGPT, Gemini, Claude, Copilot, a chatbot, predictive analytics, ' +
  'computer vision, machine learning). Draw on the measurable results you extract below, so b10 ' +
  'and the results agree. If the note never says which AI was used, do not guess one.\n' +
  'These descriptions tell you what BELONGS in each field. They are not examples to copy, and any ' +
  'figures you write must come from the note itself.\n\n' +
  'RULE 2 — QUANTITATIVE FIGURES (before, after, monthlySaving). These follow the OPPOSITE rule and ' +
  'it is stricter. Fill a figure ONLY when the note contains an actual numeric hint for it. A hint ' +
  'may be vague — "roughly halved", "about 20% faster", "cut it by a third", "a couple of thousand a ' +
  'month" all count, and you should convert them into concrete numbers. When you fill a figure from ' +
  'a vague hint rather than an explicitly stated exact number, set the matching flag in "estimated" ' +
  'to true. If the note gives NO numeric hint for a figure, leave it null and leave its flag false. ' +
  'NEVER produce a number that has no basis in the note — not to look complete, not to fill the ' +
  'shape, not even a plausible industry-typical value. A missing number is correct; an invented one ' +
  'is a false statement in an award submission.\n\n' +
  'Classify each distinct measurable result as productivity (speed/accuracy/efficiency), financial ' +
  '(cost/savings/ROI), or operational (service/quality/process rate). Only include a result if the ' +
  'note actually describes a change or benefit; never fabricate a result to fill out the response.\n\n' +
  'STYLE, for every piece of text you write: plain simple words. Do NOT name the organisation or ' +
  'write about it in the third person — this is an internal document and the reader knows which ' +
  'college it is. No praise, no adjectives like "remarkable" or "significant", no sentences about ' +
  'commitment or transformation. Say what happened and stop.';

const QUICK_FILL_SHAPE =
  'Reply with JSON only, in exactly this shape:\n' +
  '{"names": string[], "b8": string|null, "b9": string|null, "b10": string|null, "results": [{' +
  '"type": "productivity"|"financial"|"operational", "metricOrCategory": string, ' +
  '"before": number|null, "after": number|null, "unit": string|null, ' +
  '"monthlySaving": number|null, "note": string, ' +
  '"estimated": {"before": boolean, "after": boolean, "monthlySaving": boolean}}]}\n' +
  'names = 3 short title options for the initiative (a few words each), derived from the problem ' +
  'and solution you extract for the other fields, and different from one another. ' +
  'b8 = the business problem. b9 = why the problem mattered / its significance. ' +
  'b10 = how well the AI solution addressed it.\n' +
  'before/after = the metric\'s value before and after, in the same unit (productivity and ' +
  'operational results). monthlySaving = money saved per month in SGD (financial results only). ' +
  'Set each "estimated" flag true only for a figure you derived from a vague hint; false for a ' +
  'figure the note states exactly, and false for any figure you left null.';

app.post('/api/quick-fill', async (req, res) => {
  const notes = (req.body && req.body.text) || '';
  if (!notes.trim()) return res.status(400).json({ error: 'No notes to parse.' });
  const cfg = await effectiveConfig();
  // Degraded mode: return the empty structure rather than an error, so the
  // review screen still opens and the user can type into it by hand.
  if (!cfg.enabled || !cfg.key) {
    return res.json({
      b8: null,
      b9: null,
      b10: null,
      results: [],
      stub: true,
      message: `AI parsing unavailable — ${offReason(cfg)}. Fill the fields in by hand below.`,
    });
  }
  try {
    const client = new OpenAI({ apiKey: cfg.key });
    const completion = await client.chat.completions.create({
      model: cfg.analysisModel,
      temperature: 0.2, // extraction, not composition — keep it literal
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: withOrgContext(QUICK_FILL_SYSTEM, cfg.orgContext) },
        { role: 'user', content: `${QUICK_FILL_SHAPE}\n\nThe note:\n\n${notes}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'The AI reply was not valid JSON. Try again, or fill the fields in by hand.' });
    }
    // Shape-checking and coercion happen client-side in quickfill.js, which is
    // the tested single source of truth for what a usable proposal looks like.
    res.json(parsed);
  } catch (e) {
    res.status(502).json({ error: `OpenAI request failed: ${e.message}` });
  }
});

// ---------- Export block: AI-written Quality Action Resolution fields ----------
const EXPORT_SYSTEM =
  'You write the Root Cause & Resolution intake fields for a Quality Action Resolution record, based ' +
  'on one specific AI initiative\'s evidence. Write ONLY from the evidence given — ' +
  'never invent facts, numbers, or outcomes not present in the input. ' +
  'Finding: combine the stated business problem and its significance into one paragraph. ' +
  'Root Cause & Resolution: this one is your analysis. Say why the problem happened, based on what the ' +
  'evidence describes, and what should be done about it. Recommendations are allowed here — they are ' +
  'advice, not claims about the past — but every reason you give must follow from the evidence, and ' +
  'you must never state as fact anything the evidence does not contain. ' +
  'Action Taken: what was actually done for this initiative — the solution approach and what the ' +
  'measurable results\' qualitative notes describe. ' +
  'General Notes: any remaining figures or details not captured elsewhere. ' +
  `Output each of the four fields separately and clearly labeled. ${HOUSE_STYLE}`;

app.post('/api/export-draft', async (req, res) => {
  const evidence = (req.body && req.body.evidence) || '';
  if (!evidence.trim()) return res.status(400).json({ error: 'No evidence to draft from.' });
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
        { role: 'system', content: withOrgContext(EXPORT_SYSTEM, cfg.orgContext) },
        {
          role: 'user',
          content:
            'Evidence for this initiative:\n\n' +
            `${evidence}\n\n` +
            'Label the four fields exactly as "Finding:", "Root Cause & Resolution:", ' +
            '"Action Taken:" and "General Notes:", each on its own line.',
        },
      ],
    });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || '' });
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

// ---------- Change Log (read-only git history) ----------
const execFileP = promisify(execFile);
const repoRoot = path.join(__dirname, '..');
let changelogCache = { data: null, ts: 0 };

// Whether a commit author is the Claude Code bot vs a real person.
function authorLabel(email, name) {
  return /noreply@anthropic\.com|claude/i.test(email || '') ? 'Claude' : name || 'Unknown';
}

// Parse `git log` output delimited by NUL (between tokens) and 0x1f (between fields).
// Token layout per commit: <fields>\0<name-only file list>\0 → after split on \0 the
// tokens alternate [fields, files, fields, files, ...] (index 0 is an empty lead-in).
function parseGitLog(stdout) {
  const tokens = stdout.split('\0');
  const commits = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const fields = tokens[i];
    const filesBlock = tokens[i + 1] || '';
    const [hash, shortHash, authorDate, email, name, subject, body] = fields.split('\x1f');
    if (!hash) continue;
    const files = filesBlock.split('\n').map((s) => s.trim()).filter(Boolean);
    commits.push({
      shortHash,
      authorDate, // ISO 8601
      subject: subject || '(no subject)',
      body: (body || '').trim(),
      author: authorLabel(email, name),
      files,
      filesChanged: files.length,
    });
  }
  return commits;
}

app.get('/api/changelog', async (_req, res) => {
  if (Date.now() - changelogCache.ts < 60_000 && changelogCache.data) {
    return res.json(changelogCache.data);
  }
  try {
    // Read-only. Fields separated by 0x1f, commit records bracketed by NUL, with
    // --name-only appending the file list after each record.
    const format = '%x00%H%x1f%h%x1f%aI%x1f%ae%x1f%an%x1f%s%x1f%b%x00';
    const { stdout } = await execFileP(
      'git',
      ['log', '-n', '30', '--name-only', `--pretty=format:${format}`],
      { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 }
    );
    const commits = parseGitLog(stdout);
    changelogCache = { data: { commits }, ts: Date.now() };
    res.json({ commits });
  } catch (e) {
    // No .git, git not installed, etc. — surface a clear message, not a crash.
    res.status(500).json({ error: `Could not read git history: ${e.message}` });
  }
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
