import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelOutput } from '../src/analyze/analyze.service.ts';

test('parses JSON wrapped in a markdown fence', () => {
  const result = parseModelOutput('```json\n{"mealName":"Nasi goreng","items":[],"kcal":500,"confidence":0.8}\n```');
  assert.equal(result.mealName, 'Nasi goreng');
  assert.equal(result.kcal, 500);
  assert.equal(result.confidence, 0.8);
});

test('rejects a response without JSON', () => {
  assert.throws(() => parseModelOutput('I cannot analyze this.'), /tidak mengembalikan JSON/);
});
