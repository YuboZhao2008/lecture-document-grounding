import { prepareContext, resolvePageCitation } from './context.ts';
import { buildPassageSet } from './passages.ts';
import { boundedClip } from './selection.ts';

const { passages } = buildPassageSet(
  [{ kind: 'page', status: 'completed', output: { parsed: { pages: [
    { page: 2, text: 'An eigenvector keeps its direction up to scaling.', equations: ['Av = λv'], notation: ['λ_1'], uncertainty: [] },
    { page: 5, text: 'An orthogonal basis has perpendicular vectors.', equations: [], notation: [], uncertainty: [] },
  ] } } }],
  { definitions: [{ term: 'eigenvalue', meaning: 'The scalar λ in Av = λv.', pages: [2] }] },
  { pageCount: 5 },
);

const sources = prepareContext('eigenvalue λ_1', 'linear-algebra', [
  { id: 'synthetic-01', title: 'Synthetic linear algebra notes', collection: 'linear-algebra', passages },
]);
console.log('Clamped example selection:', boundedClip([-20, 10, 80, 60], [0, 0, 600, 800]));
console.log('Prepared context:', sources.map(({ alias, title, pages }) => ({ alias, title, pages })));
console.log('Supplied page:', resolvePageCitation(sources, 'S1', 2));
console.log('Page outside the supplied context:', resolvePageCitation(sources, 'S1', 99));
