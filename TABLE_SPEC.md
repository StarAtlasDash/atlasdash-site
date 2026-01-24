# Table Spec Reference

This document describes the JSON table spec used to build `<atlas-table>` instances.

## Overview
Each table is defined by a JSON object that includes:
- the R2 query location
- column inclusion/label overrides
- optional title/label/description/info content

Specs are loaded at runtime from `public/table-specs.json` and applied to `<atlas-table>` elements that declare `data-table-id`.

## Base Shape
```json
{
  "id": "unique-table-id",
  "title": "Table Title",
  "label": "Game Economy",
  "descriptionMd": "Markdown string (optional)",
  "infoMd": "Markdown string (optional)",
  "query": {
    "source": "flipside",
    "dataset": "sb-active-fleets"
  },
  "excludeColumns": [],
  "columns": [
    { "field": "DATE", "label": "Date", "sortable": true }
  ],
  "enableColumnFilters": true,
  "enableColumnVisibilityToggles": true,
  "enableColumnReorder": false,
  "stickyFirstColumn": true,
  "defaultSort": [
    { "field": "DATE", "desc": false }
  ]
}
```

## Fields
- `id` (string, required): Unique ID used by `data-table-id`.
- `title` (string, required): Table title shown in the component header.
- `label` (string, optional): Small badge aligned to the right of the header.
- `description` (string, optional): Plain text description. Ignored if `descriptionMd` is provided.
- `descriptionMd` (string, optional): Markdown string rendered into `slot="description"`.
- `infoMd` (string, optional): Markdown string rendered into `slot="info"`.
- `query` (object, required): R2 location:
  - `source`: e.g. `flipside`
  - `dataset`: e.g. `sb-active-fleets`
- `excludeColumns` (array, optional): Column names to omit entirely (opt‑out).
- `columns` (array, optional): Column overrides by `field`:
  - `label`: custom header text
  - `hidden`: hidden by default (still toggleable if column visibility is enabled)
  - `filter`: enable/disable column filter (default: `true`)
  - `sortable`: enable/disable sorting (default: `true`)
- `enableColumnFilters` (boolean, optional): Show filter inputs per column (default: `true`).
- `enableColumnVisibilityToggles` (boolean, optional): Show “Columns” toggle UI (default: `true`).
- `enableColumnReorder` (boolean, optional): Allow drag‑reorder on headers (default: `false`).
- `stickyFirstColumn` (boolean, optional): Make the first visible column sticky and render it as a row header (default: `true`).
- `defaultSort` (array, optional): Initial sort state.

## Example
```json
{
  "id": "fleet-activity-table",
  "title": "Fleet Activity SAGE (Table)",
  "label": "Game Economy",
  "query": { "source": "flipside", "dataset": "sb-active-fleets" },
  "excludeColumns": ["UNUSED_FIELD"],
  "columns": [
    { "field": "DATE", "label": "Date" },
    { "field": "MINING_FLEETS_AVG", "label": "Mining", "filter": true },
    { "field": "SCANNING_FLEETS_AVG", "label": "Scanning", "filter": true }
  ],
  "enableColumnReorder": true
}
```

## Usage
Add the table element with `data-table-id`:
```html
<atlas-table data-table-id="fleet-activity-table" class="table-block"></atlas-table>
```

The runtime loader will:
1. Fetch the spec from `public/table-specs.json`
2. Fetch the query data from R2
3. Build table columns and state
4. Apply the plan to the component

## Markdown Support
Descriptions and info boxes support a tiny subset of Markdown:
- `**bold**`
- `*italic*`
- `[label](https://example.com)`
- blank lines create new paragraphs
All HTML is escaped before rendering.
