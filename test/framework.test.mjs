import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPassageSet, normalizeNotation } from '../src/passages.ts';
import { prepareContext, resolvePageCitation } from '../src/context.ts';
import { boundedClip, validClip } from '../src/selection.ts';

const page = (number, text, notation = []) => ({ page: number, text, equations: [], notation, uncertainty: [] });
const prepared = (pages) => [{ kind: 'page', status: 'completed', output: { parsed: { pages } } }];
const fixture = buildPassageSet(prepared([page(2, 'Eigenvector direction', ['λ_1']), page(4, 'Orthogonal basis')]), {}, { pageCount: 4 });
const lecture = { id: 'synthetic-a', title: 'Synthetic notes', collection: 'math', passages: fixture.passages };

test('normalizes Greek symbols and LaTeX notation into matching tokens', () => {
  assert.equal(normalizeNotation('λ_1'), normalizeNotation(String.raw`\lambda_{1}`));
});

test('rejects invalid page records and keeps the original valid page address', () => {
  const result = buildPassageSet(
    prepared([page(0, 'invalid'), page(2, 'kept'), page(2, 'duplicate'), page(4, 'out of range')]),
    {}, { pageCount: 2 },
  );
  assert.equal(result.skipped.pageRecords, 2);
  assert.equal(result.passages.length, 1);
  assert.deepEqual(result.passages[0].pages, [2]);
  assert.equal(result.passages[0].body.text, 'kept');
});

test('ranks notation and does not retrieve across collections', () => {
  const sources = prepareContext('λ_1', 'math', [
    lecture, { ...lecture, id: 'synthetic-b', collection: 'other' },
  ]);
  assert.equal(sources.length, 1);
  assert.deepEqual(sources[0].pages, [2]);
  assert.equal(sources[0].lectureId, 'synthetic-a');
});

test('rejects aliases or pages not passed to the caller', () => {
  const sources = prepareContext('Eigenvector', 'math', [lecture]);
  assert.equal(resolvePageCitation(sources, 'S1', 2)?.page, 2);
  assert.equal(resolvePageCitation(sources, 'S1', 4), null);
  assert.equal(resolvePageCitation(sources, 'S2', 2), null);
});

test('enforces result bounds and stable ordering at equal scores', () => {
  const tied = [lecture, { ...lecture, id: 'a-first' }];
  assert.equal(prepareContext('Eigenvector', 'math', tied, 1)[0].lectureId, 'a-first');
  assert.throws(() => prepareContext('Eigenvector', 'math', tied, 100), RangeError);
  assert.deepEqual(prepareContext('nothing-matches', 'math', tied), []);
});

test('validates and clamps page clip coordinates', () => {
  assert.deepEqual(boundedClip([-10, 0, 10, 30], [0, 0, 100, 100]), [0, 0, 20, 30]);
  assert.equal(validClip([0, 0, 4, 4]), true);
  assert.equal(validClip([0, 0, Infinity, 4]), false);
  assert.equal(validClip([0, 0, 3, 4]), false);
  assert.throws(() => boundedClip([0, 0, 8, 8], [0, 0, 3, 3]), RangeError);
});
