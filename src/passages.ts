// Pure, page-addressable passage builder from LectureTutor.
export const PASSAGE_INDEX_VERSION = "passages-v1";
export const PAGE_SPLIT_BYTES = 2400;
const OVERVIEW_SPLIT_BYTES = 4000;

const GREEK: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", ϵ: "epsilon",
  ζ: "zeta", η: "eta", θ: "theta", ϑ: "theta", ι: "iota", κ: "kappa",
  λ: "lambda", μ: "mu", ν: "nu", ξ: "xi", π: "pi", ρ: "rho", σ: "sigma",
  ς: "sigma", τ: "tau", υ: "upsilon", φ: "phi", ϕ: "phi", χ: "chi",
  ψ: "psi", ω: "omega", Γ: "gamma", Δ: "delta", Θ: "theta", Λ: "lambda",
  Ξ: "xi", Π: "pi", Σ: "sigma", Φ: "phi", Ψ: "psi", Ω: "omega",
  "∇": "nabla", "∂": "partial", "∫": "integral", "∑": "sum", "∏": "prod",
  "∞": "infinity",
};
const COMMANDS: Record<string, string> = {
  int: "integral", iint: "integral", oint: "integral", infty: "infinity",
  varepsilon: "epsilon", epsilon: "epsilon", vartheta: "theta",
  varphi: "phi", ell: "l",
};
// Wrappers whose argument is the symbol; the wrapper name itself is noise.
const WRAPPERS = new Set([
  "mathbf", "mathrm", "mathit", "mathcal", "mathbb", "mathsf", "mathfrak",
  "boldsymbol", "bm", "text", "textbf", "operatorname", "vec", "hat", "bar",
  "tilde", "dot", "ddot", "overline", "underline",
]);
// Layout commands that carry no meaning for retrieval.
const DROP = new Set([
  "left", "right", "big", "bigg", "frac", "dfrac", "tfrac", "cdot", "quad",
  "qquad", "begin", "end", "displaystyle", "limits",
]);

function symbols(text: string) {
  let s = text.replace(/[Ͱ-Ͽ∇∂∫∑∏∞]/g, (c) =>
    GREEK[c] ? ` ${GREEK[c]} ` : c,
  );
  // Unwrap \mathbf{v} etc. repeatedly so nested wrappers collapse.
  for (let i = 0; i < 3; i++)
    s = s.replace(/\\([a-zA-Z]+)\s*\{([^{}]*)\}/g, (m, cmd, arg) =>
      WRAPPERS.has(cmd) ? ` ${arg} ` : m,
    );
  s = s.replace(/\\([a-zA-Z]+)/g, (_, cmd: string) =>
    DROP.has(cmd) || WRAPPERS.has(cmd) ? " " : ` ${COMMANDS[cmd] || cmd}`,
  );
  // Rejoin a symbol with its subscript, e.g. " lambda _1" -> "lambda_1".
  return s.replace(/([A-Za-z0-9])\s+_/g, "$1_");
}

export function normalizeNotation(text: string) {
  const out: string[] = [];
  const add = (t: string) => {
    const v = t.toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  };
  const s = symbols(String(text || ""));
  const sub = /([A-Za-z]+)_(\{([^{}]*)\}|([A-Za-z0-9]+))/g;
  for (const m of s.matchAll(sub)) {
    const inner = (m[3] ?? m[4] ?? "").replace(/[^A-Za-z0-9]/g, "");
    if (inner) add(`${m[1]}_${inner}`);
  }
  for (const word of s.replace(sub, " $1 $2 ").split(/[^A-Za-z0-9]+/)) add(word);
  return out.join(" ");
}

// Pick out the math-looking fragments of prose so the notation weight is not
// diluted by ordinary words.
export function mathFragments(text: string) {
  const parts = String(text || "").match(
    /\$[^$]+\$|\\\([^)]*\\\)|\\[a-zA-Z]+(\{[^{}]*\})?|[A-Za-z]+_(\{[^{}]*\}|[A-Za-z0-9]+)|[Ͱ-Ͽ∇∂∫∑∏∞]/g,
  );
  return (parts || []).join(" ");
}

export type Passage = {
  kind: "page" | "definition" | "overview";
  page: number | null;
  pages: number[];
  ordinal: number;
  body: Record<string, unknown>;
  terms: string;
  prose: string;
  byteSize: number;
};

const bytes = (value: unknown) =>
  Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value));
// Reject embedded NUL in prepared text.
const text = (value: unknown): value is string =>
  typeof value === "string" && !value.includes("\u0000");
const strings = (value: unknown) =>
  Array.isArray(value) && value.every(text) ? (value as string[]) : null;
// Keep page numbers in a practical integer range and honor any known page count.
const MAX_PAGE_NUMBER = 2147483647;
const pageNumber = (value: unknown, pageCount?: number) =>
  Number.isSafeInteger(value) &&
  (value as number) > 0 &&
  (value as number) <= MAX_PAGE_NUMBER &&
  (!pageCount || (value as number) <= pageCount)
    ? (value as number)
    : null;

function chunks(text: string, limit: number) {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n\s*\n/)) {
    if (current && bytes(current) + bytes(para) + 2 > limit) {
      out.push(current);
      current = para;
    } else current = current ? `${current}\n\n${para}` : para;
  }
  if (current || !out.length) out.push(current);
  return out;
}

function validPage(p: any, pageCount?: number) {
  const page = pageNumber(p?.page, pageCount);
  const equations = strings(p?.equations);
  const notation = strings(p?.notation);
  const uncertainty = strings(p?.uncertainty);
  if (!page || !text(p.text) || !equations || !notation || !uncertainty)
    return null;
  return { page, text: p.text as string, equations, notation, uncertainty };
}

// Counts only: diagnostics never carry lecture content.
export type PassageDiagnostics = {
  pageRecords: number;
  definitions: number;
  coverageEntries: number;
  overview: number;
};

// Build passages for one prepared version. Malformed records (possible in
// versions prepared under an older processing key) are skipped and counted,
// never thrown, so callers can diagnose incomplete preparation.
export function buildPassageSet(
  nodes: any[],
  integration: any,
  options: { pageCount?: number } = {},
): { passages: Passage[]; skipped: PassageDiagnostics } {
  const { pageCount } = options;
  const skipped = { pageRecords: 0, definitions: 0, coverageEntries: 0, overview: 0 };
  const raw: Omit<Passage, "ordinal">[] = [];
  const records = new Map<number, ReturnType<typeof validPage>>();
  for (const node of nodes || []) {
    if (node?.kind !== "page" || node.status !== "completed") continue;
    const pages = node.output?.parsed?.pages;
    if (!Array.isArray(pages)) {
      skipped.pageRecords++;
      continue;
    }
    for (const p of pages) {
      const record = validPage(p, pageCount);
      if (!record) skipped.pageRecords++;
      else if (!records.has(record.page)) records.set(record.page, record);
    }
  }
  for (const r of [...records.values()].sort((a, b) => a!.page - b!.page)) {
    const { page, text, equations, notation, uncertainty } = r!;
    const parts = chunks(text, PAGE_SPLIT_BYTES);
    parts.forEach((part, i) => {
      const body =
        i === 0
          ? { page, text: part, equations, notation, uncertainty }
          : { page, text: part, equations: [], notation: [], uncertainty: [] };
      raw.push({
        kind: "page",
        page,
        pages: [page],
        body,
        terms: normalizeNotation(
          [...body.equations, ...body.notation, mathFragments(part)].join(" "),
        ),
        prose: [part, ...body.notation, ...body.uncertainty].join("\n"),
        byteSize: bytes(body),
      });
    });
  }
  const definitions = Array.isArray(integration?.definitions)
    ? integration.definitions
    : [];
  if (integration?.definitions !== undefined && !Array.isArray(integration.definitions))
    skipped.definitions++;
  for (const d of definitions) {
    const pages = Array.isArray(d?.pages)
      ? d.pages.map((p: unknown) => pageNumber(p, pageCount))
      : null;
    if (
      !text(d?.term) ||
      !text(d?.meaning) ||
      !pages ||
      pages.some((p: number | null) => p === null)
    ) {
      skipped.definitions++;
      continue;
    }
    const body = { term: d.term, meaning: d.meaning, pages };
    raw.push({
      kind: "definition",
      page: pages[0] ?? null,
      pages,
      body,
      terms: normalizeNotation(`${d.term} ${mathFragments(d.meaning)}`),
      prose: `${d.term}\n${d.meaning}`,
      byteSize: bytes(body),
    });
  }
  if (integration?.overview !== undefined && !text(integration.overview))
    skipped.overview++;
  if (text(integration?.overview) && integration.overview.trim()) {
    const listed = Array.isArray(integration.coveredPages)
      ? integration.coveredPages
      : [];
    const covered = listed.filter((p: unknown) => pageNumber(p, pageCount));
    skipped.coverageEntries += listed.length - covered.length;
    for (const part of chunks(integration.overview, OVERVIEW_SPLIT_BYTES)) {
      const body = { overview: part };
      raw.push({
        kind: "overview",
        page: null,
        pages: covered,
        body,
        terms: normalizeNotation(mathFragments(part)),
        prose: part,
        byteSize: bytes(body),
      });
    }
  }
  return { passages: raw.map((p, ordinal) => ({ ...p, ordinal })), skipped };
}

export function buildPassages(
  nodes: any[],
  integration: any,
  options: { pageCount?: number } = {},
): Passage[] {
  return buildPassageSet(nodes, integration, options).passages;
}
