import { normalizeNotation, type Passage } from './passages.ts';

export type IndexedLecture = {
  id: string;
  title: string;
  collection: string;
  passages: Passage[];
};

export type Source = {
  alias: string;
  lectureId: string;
  title: string;
  pages: number[];
  passage: Passage;
};

const words = (text: string) =>
  new Set(normalizeNotation(text).split(' ').filter((token) => token.length > 1));

// The full application uses a different search adapter. This small adapter
// makes the same prepared passage model demonstrable without external services.
export function prepareContext(question: string, collection: string, lectures: IndexedLecture[], limit = 4): Source[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
    throw new RangeError('limit must be an integer from 1 to 8');
  }
  const query = words(question);
  const matches = lectures
    .filter((lecture) => lecture.collection === collection)
    .flatMap((lecture) => lecture.passages
      .filter((passage) => passage.pages.length > 0)
      .map((passage) => {
        const notation = words(passage.terms);
        const prose = words(passage.prose);
        const score = [...query].reduce((sum, word) =>
          sum + (notation.has(word) ? 2 : prose.has(word) ? 1 : 0), 0);
        return { lecture, passage, score };
      }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score ||
      a.lecture.id.localeCompare(b.lecture.id, 'en') || a.passage.ordinal - b.passage.ordinal);
  return matches.slice(0, limit).map(({ lecture, passage }, index) => ({
    alias: `S${index + 1}`,
    lectureId: lecture.id,
    title: lecture.title,
    pages: [...passage.pages],
    passage,
  }));
}

export function resolvePageCitation(sources: Source[], alias: string, page: number) {
  const source = sources.find((entry) => entry.alias === alias && entry.pages.includes(page));
  return source ? { lectureId: source.lectureId, title: source.title, page } : null;
}
