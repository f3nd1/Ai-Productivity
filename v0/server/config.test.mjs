// node config.test.mjs
import assert from 'node:assert';
import { maskKey, mergeConfig } from './config.js';

assert.equal(maskKey('sk-abcd1234'), 'sk-...1234');
assert.equal(maskKey(''), null);
assert.equal(maskKey(null), null);

// key precedence: saved settings key wins over env
assert.equal(mergeConfig(null, 'sk-env').key, 'sk-env');
assert.equal(mergeConfig({ openai_key: 'sk-db' }, 'sk-env').key, 'sk-db');
assert.equal(mergeConfig(null, null).key, null);

// enabled defaults on; explicit false respected
assert.equal(mergeConfig(null, 'k').enabled, true);
assert.equal(mergeConfig({ openai_enabled: false }, 'k').enabled, false);

// utility model falls back to analysis model
assert.equal(mergeConfig({ analysis_model: 'gpt-4o' }, 'k').utilityModel, 'gpt-4o');
assert.equal(mergeConfig({ analysis_model: 'gpt-4o', utility_model: 'gpt-4o-mini' }, 'k').utilityModel, 'gpt-4o-mini');
assert.equal(mergeConfig(null, 'k').analysisModel, 'gpt-4o-mini');

console.log('config.test.mjs: all assertions passed');
