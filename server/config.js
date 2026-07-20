// Pure helpers for OpenAI settings. No I/O — kept separate so config.test.mjs
// can exercise them without booting the Express server.

export function maskKey(k) {
  return k ? `${k.slice(0, 3)}...${k.slice(-4)}` : null;
}

// Merge the singleton settings row (or null) with the env fallback into the
// effective config. Saved key wins over env; AI enabled by default; utility
// model falls back to the analysis model, then to gpt-4o-mini.
export function mergeConfig(s, envKey) {
  const analysisModel = (s && s.analysis_model) || 'gpt-4o-mini';
  return {
    key: (s && s.openai_key) || envKey || null,
    enabled: s ? s.openai_enabled !== false : true,
    analysisModel,
    utilityModel: (s && s.utility_model) || analysisModel,
    orgContext: (s && s.org_context) || '',
  };
}
