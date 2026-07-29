const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { reciprocalRankFusion, _private } = require('../services/searchService');

function item(id) {
  return {
    chunk: {
      _id: {
        toString: () => id,
      },
    },
  };
}

test('RRF ignores malformed lists and duplicate chunks inside the same list', () => {
  const results = reciprocalRankFusion([
    [item('a'), item('a'), item('b')],
    null,
    [item('b')],
  ]);

  assert.equal(results.length, 2);

  const byId = new Map(results.map((result) => [result.chunk._id.toString(), result.score]));
  assert.equal(byId.get('a'), 1 / 61);
  assert.equal(byId.get('b'), 1 / 63 + 1 / 61);
});

test('candidate limit uses at least topK and caps broad searches', () => {
  assert.equal(_private.getCandidateLimit(8), 16);
  assert.equal(_private.getCandidateLimit(60), 60);
});

test('embedding validation rejects empty and non-finite vectors', () => {
  assert.equal(_private.isValidEmbedding([0.1, 0.2, 0.3]), true);
  assert.equal(_private.isValidEmbedding([]), false);
  assert.equal(_private.isValidEmbedding([0.1, Number.NaN]), false);
  assert.equal(_private.isValidEmbedding('not-a-vector'), false);
});

test('invalid topK falls back to default', () => {
  assert.equal(_private.normalizeLimit(0), 8);
  assert.equal(_private.normalizeLimit('bad'), 8);
  assert.equal(_private.normalizeLimit(5), 5);
});

test('Atlas vector numCandidates scales above limit and respects max cap', () => {
  assert.equal(_private.getAtlasNumCandidates(8), 160);
  assert.equal(_private.getAtlasNumCandidates(600), 10000);
});

test('Atlas vector filter casts valid document ids for aggregation', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const single = _private.atlasDocumentFilter(id);
  assert.equal(single.documentId.toString(), id);

  const multiple = _private.atlasDocumentFilter([id]);
  assert.equal(multiple.documentId.$in[0].toString(), id);
});
