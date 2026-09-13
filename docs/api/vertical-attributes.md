# Vertical attribute schema validation

Module: `backend/src/policies/attributes.js` — pure, no DB, no HTTP calls.
It only throws `HttpError(400, ...)`, matching the house style of
`backend/src/policies/validation.js`.

## Where the schema lives

`verticals.config` (JSONB, `NOT NULL DEFAULT '{}'`) may carry:

```json
{
  "allowUnknownAttributes": false,
  "attributes": [
    { "key": "bedrooms",  "type": "int",    "required": true, "min": 0, "max": 50 },
    { "key": "area",      "type": "number", "min": 1 },
    { "key": "furnished", "type": "bool" },
    { "key": "title",     "type": "string", "minLength": 2, "maxLength": 120 },
    { "key": "condition", "type": "enum",   "options": ["NEW", "USED"] }
  ]
}
```

- `key` must match `^[a-z][a-z0-9_]{0,49}$` and be unique.
- `type` is one of `string | int | number | bool | enum`.
- `allowUnknownAttributes` defaults to **true** (permissive while verticals are
  being authored); set it to `false` to lock a vertical down.
- At most 100 attribute definitions per vertical.

## API

```js
import { validateAttributes, attributeSchemaFromConfig } from '../policies/attributes.js';

const attributes = validateAttributes(vertical, req.body.attributes);
```

`validateAttributes(vertical, attributes)` returns a normalised object safe to
persist into `jobs.attributes`. It coerces `"3" -> 3`, `"true" -> true`, trims
strings, drops omitted optional attributes, and — when unknowns are allowed —
passes through scalar unknown keys (objects/arrays are rejected).

## The jobs vertical is exempt

If `vertical.slug` is missing or equal to `jobs`, the validator returns `{}`
immediately without inspecting the payload. The live jobs vertical therefore
cannot regress: its listings keep the `{}` default they have today.

## Error codes

| Code | Meaning |
| --- | --- |
| `INVALID_ATTRIBUTES` | payload shape/type/range/enum/length violation |
| `MISSING_ATTRIBUTE` | a `required: true` attribute was absent or blank |
| `UNKNOWN_ATTRIBUTE` | key not in the schema while `allowUnknownAttributes: false` |
| `INVALID_VERTICAL_CONFIG` | the vertical's own schema is malformed (operator error, not caller error) |

All are HTTP 400.

## Not wired yet

The current jobs write path does not require this validator. Any non-jobs listing write
must call it with the vertical row loaded from `listVerticals()` before persisting `attributes`.
