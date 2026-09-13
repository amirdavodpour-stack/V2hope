# Vertical registry API

Read-only. No write endpoints exist yet; `POST/PUT/DELETE` return `405`.

## GET /api/v1/verticals

Returns the active verticals ordered by `sort_order, slug`.

```json
[{ "id": "…", "slug": "jobs", "name": "Jobs", "nameEn": "Jobs",
   "description": "…", "config": {}, "isActive": true, "sortOrder": 0 }]
```

Backed by `repo.listVerticals()` when `DATABASE_URL` is set. Without a
database the in-memory fallback returns the single seeded `jobs` vertical, so
the API shape is identical in both modes.

## GET /api/v1/categories?vertical=&lt;slug&gt;

- **Param absent (default):** behaviour remains backwards-compatible —
  every active category, ordered by `sort_order, name`. The live jobs vertical
  is therefore unaffected.
- **Param present:** categories are filtered by
  `vertical_id = (SELECT id FROM verticals WHERE slug = $1)`. An unknown slug
  yields `200 []`, not an error.
- **Malformed slug** (anything outside `^[a-z0-9][a-z0-9_-]{0,63}$`, case
  insensitive): `400 INVALID_VERTICAL`. The value is never interpolated into
  SQL; it is always a bound parameter.
- In-memory fallback mode: the legacy dataset belongs to `jobs`, so
  `?vertical=jobs` returns the full list and any other slug returns `[]`.

Existing categories are associated with the `jobs` vertical. `vertical_id` remains
nullable for backwards compatibility; schema initialization repairs legacy rows
that are missing the association.
