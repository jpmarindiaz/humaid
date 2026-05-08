# project-qa

Q&A pairs about **the humaid project itself** — what it is, who it's for, who built it, how to use it, who to contact, what the partnerships are. Distinct from the humanitarian Q&A in `../qa-pairs.csv` (which answers flood-response questions).

## Why a separate set

The 471 pairs in `../qa-pairs.csv` answer **flood-response questions** ("how do I evacuate?"). This set answers **project-introspection questions** ("what is humaid?", "who do I contact for help?", "is my data shared?"). Both index into the same `kb.duckdb` so a single retrieval call covers both — but keeping the source files separate lets the project-meta content evolve at a different pace and review process than the humanitarian content.

Project-meta rows are tagged with `phase = 'meta'`. Clients can filter on that to surface project content separately from operational content (e.g. an "About" tab vs the main retrieval flow).

## Layout

```
project-qa/
├── source.ts            structured TypeScript source-of-truth (118 entries)
├── generate.ts          Deno script: source.ts → project-pairs.csv
├── project-pairs.csv    generated, committed (same 11-col schema as qa-pairs.csv)
└── README.md            this file
```

## Why structured TS rather than direct CSV authoring

The project-meta corpus has heavy role × region variance — "Who do I contact?" has eleven distinct answers across role and region combinations, and the contact data needs to update consistently across all of them when a focal-point name changes. Authoring in TypeScript with a typed schema makes that easier to maintain than a CSV. The CSV is the **build output**; `source.ts` is the **source of truth**.

## Schema

Same 11-column schema as `../qa-pairs.csv`:

```
id, role, phase, region, topic, question_en, question_es,
answer_en, answer_es, references, ref_types
```

Project-specific values:

| field | values |
|---|---|
| `id` | `proj-NNNN`, sequential within this CSV |
| `phase` | always `meta` |
| `role` | `any` (universal) OR one of the six humanitarian roles when the answer varies |
| `region` | `generic` (universal) OR `la-mojana` / `putumayo` when the answer varies |
| `topic` | `project-meta-*` slug — `identity`, `partners`, `privacy`, `model`, `help`, `value`, `scenario`, `troubleshoot`, etc. |
| `references` / `ref_types` | links into the repo (`local`) or external URLs (`cloud`) |

## Coverage (118 rows total)

| group | rows |
|---|---|
| `any` (universal) | 75 |
| `local-community` | 13 |
| `humanitarian-staff` | 10 |
| `first-respondants` | 6 |
| `local-authority` | 6 |
| `ngos` | 5 |
| `national-authorities` | 3 |

| region | rows |
|---|---|
| `generic` | 93 |
| `putumayo` | 16 |
| `la-mojana` | 9 |

Top topics: `project-meta-help` (11 — contact-by-role-by-region), `project-meta-scenario` (9), `project-meta-model` (6), `project-meta-kb` (6), `project-meta-partner` (6), `project-meta-value` (6), `project-meta-privacy` (5), `project-meta-alerts` (5), `project-meta-indigenous` (5).

## Sample contact data

All contact info (names, phone numbers, email addresses) under topics `project-meta-help`, `project-meta-focal-point`, and `project-meta-contact` is **placeholder / sample data** explicitly marked `(datos de muestra)` / `(sample data)` in the answers. Real focal points get plumbed in once partner agreements solidify and we have explicit consent to publish their contact details. Implementations should treat the sample contacts as illustrative — they let you demonstrate that the system varies the answer by role and region without exposing a real individual.

## Regenerate

```bash
cd knowledge-base/project-qa
deno run -A generate.ts        # → project-pairs.csv

cd ..
deno task build                 # → kb.duckdb (merges humanitarian + project)
```

## How retrieval works across both sets

`rag/build.ts` reads both `qa-pairs.csv` and `project-qa/project-pairs.csv` and writes a single `kb.duckdb` table with all rows. The index is unified — a query like `"who is the contact in Putumayo?"` retrieves both the project-meta `Who do I contact for help?` row (proj-0021) and any humanitarian rows that happen to mention contacts in Putumayo. Clients that want to separate the two can filter on `phase = 'meta'`:

```sql
-- project-meta only (e.g. an "About" tab):
SELECT id, question_en, answer_en
FROM qa
WHERE phase = 'meta'
  AND role IN ('any', $user_role)
ORDER BY array_cosine_similarity(embedding, $query_vec) DESC
LIMIT 5;

-- humanitarian only (operational queries):
... WHERE phase IN ('pre', 'event', 'post') ...
```

## Adding new pairs

1. Edit `source.ts` — pick the right section (or add a new one), follow the schema.
2. Run `deno run -A generate.ts` — regenerates `project-pairs.csv`.
3. Run `deno task build` from `knowledge-base/` — re-embeds and updates `kb.duckdb`.
4. Test retrieval: `deno task ask "<your question>" --text --k 3`.
