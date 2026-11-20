# File format `*.orgamorph.json`

[Deutsch](dateiformat.md) · English

Orgamorph stores a document as a JSON file ending in `.orgamorph.json`. The schema is in [`schema/orgamorph.schema.json`](../schema/orgamorph.schema.json).

## Principles

- **UTF-8**, 2-space indentation, trailing `\n`.
- **Fixed key order**: identical data gives byte-identical files and small diffs.
- **Empty optional fields are omitted.**
- **Unknown fields are preserved**, written after the known fields.
- **`schemaVersion`** is independent of the app version. Files with a higher version open read-only.
- Dates as `YYYY-MM-DD`, timestamps in `meta` as ISO 8601 (UTC).

## Structure

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | always `"orgamorph"` |
| `schemaVersion` | yes | currently `1` |
| `id` | no | document ID (`d_` + 10 chars), key for browser storage; generated on load if missing |
| `meta` | yes | title, organization, as-of date, timestamps; optional plan header fields `department`, `author` and `logo` (data URL, PNG/JPEG/WebP/SVG, ≤ 400,000 chars) |
| `units` | yes | organizational units; **array order = sibling order**; written depth-first |
| `topics` | no | projects & topics |
| `relations` | no | relations in addition to the line |
| `settings` | no | level names, span-of-control hint |
| `view` | no | presentation state (view, filter, labels) |

**Unit:** `id`, `parentId` (`null` for the root), `name` are required; optional `shortName`, `type`, `responsibilities`, `isStaff`, `lead { title, code, positionNumber, holder }`, `note`. `lead.holder` is personal data: optional and hidden in every output unless explicitly enabled.

**Topic:** `type` is one of `project`, `workingGroup`, `committee`, `crossCutting`, `other`; `period { from?, to? }` (no `to` = permanent); `participants [{ unitId, role: "lead" | "member" }]`; `color`.

**Relation:** `from`, `to`, `kind` (`reportsTo`, `directs`, `informs`, `coordinates`), optional `note`. `coordinates` is mutual.

## Invariants

Exactly one root, no cycles, all references exist, at most one entry per unit and topic, `from ≤ to`, IDs unique across object kinds. Duplicate position numbers and large spans of control are hints, not errors.

## IDs

`<prefix>_<10 chars a–z 0–9>` with prefixes `u`, `t`, `r`, `d`, generated with `crypto.getRandomValues`.

## Changing the format

Every change needs a new `schemaVersion`, a migration in `src/core/migrate.ts`, tests, an updated schema and this documentation.

## Table import (CSV and Excel)

Units can be imported from CSV or XLSX. See [`examples/vorlage-struktur.xlsx`](../examples/vorlage-struktur.xlsx) (sheets “Beispiel” and “Blanko”) and [`examples/beispiel-einheiten.csv`](../examples/beispiel-einheiten.csv). Columns: `id`, `parentId` (ID or short name of the parent), `name` (required), `shortName`, `type`, `leadTitle`, `leadCode`, `positionNumber`, `holder`, `responsibilities`, `isStaff`, `note`. German column names from the template are accepted as well.
