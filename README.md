# LectureTutor Framework

A TypeScript showcase of the document-grounding layer of LectureTutor, a lecture-PDF study workspace. It turns prepared lecture text and notation into page-addressable passages, then builds a scoped source set that a tutor can cite.

```text
Prepared page records → passage index → notation-aware retrieval → page citation check
```

## Run it

Requires Node.js 24 or newer. No dependency install or account is required.

```sh
npm run demo
npm test
```

The demo uses synthetic linear algebra notes. It prints a clamped page selection, matches the eigenvalue query to page 2, resolves that citation, and rejects a citation to page 99.

## What’s included

- [Passage construction](src/passages.ts): builds page, definition, and overview records from prepared content. It normalizes LaTeX and Greek notation, preserves page provenance, and counts malformed records without including their contents in diagnostics.
- [Selection geometry](src/selection.ts): validates and clamps a rectangle to the page bounds.
- [Context and citation checks](src/context.ts): a standalone in-memory adapter scopes search to one collection, scores prose and notation matches, limits the result set, and resolves citations only against pages supplied in that set. This checks source membership, not whether the text supports a claim.

The passage and selection logic comes from the original project. The in-memory adapter and examples were added for this showcase. It starts from prepared records; it doesn’t parse PDFs, call a language model, authenticate users, or persist data. No real lecture files or private app configuration are included.
