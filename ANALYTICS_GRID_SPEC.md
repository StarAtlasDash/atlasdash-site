# Analytics Grid Spec Reference

This document describes the JSON layout spec consumed by `<atlas-analytics-grid>`. The component renders a responsive grid and can hydrate chart/table components when given content specs.

## Overview
The layout spec is a JSON object with explicit `rows`. Each row is an array of items ordered left-to-right. Rows are rendered top-to-bottom.

## Base Shape
```json
{
  "rows": [
    [
      { "id": "chart-revenue", "span": 2, "minHeight": 320 }
    ],
    [
      { "id": "chart-users", "span": 1, "minHeight": 240 },
      { "id": "table-sessions", "span": 1, "minHeight": 240 }
    ]
  ]
}
```

## Fields
- `rows` (array, required): Array of rows.
  - Each row is an array of items rendered left-to-right.
- `id` (string, required): Globally unique ID used for the container element `id`.
- `span` (number, optional): Requested column span when more than one column is available. Default: `1`.
- `minHeight` (number, optional): Minimum height in pixels for the item. Default: `0`.

## Component Configuration
`<atlas-analytics-grid>` is configured via methods.

Attributes:
- `min-column-width`: Minimum column width (pixels). Default: `480`.

Methods:
- `grid.setLayout({ ... })` (layout spec)
- `grid.setContent({ charts, tables })` (chart + table specs)

## Layout Algorithm (Deterministic)
Definitions:
- `C` = number of visible columns (1–4, based on viewport + container width)

Per row:
1. If `C === 1`, span constraints are ignored and items are full-width.
2. If total requested spans ≤ `C`:
   - Items are placed in order.
   - If one item exists, it stretches to full width.
   - If multiple items exist, extra columns are distributed evenly (left-to-right) so the row fills `C` columns.
3. If total requested spans > `C`:
   - The item with the largest `span` is placed in its own full-width row.
   - Items before/after it are resolved separately using the same rules, preserving original order.

The same input + viewport width always produces the same resolved layout.

## Height Rules
- Each grid item applies `min-height: Xpx` based on its `minHeight`.
- Each resolved row uses the maximum `minHeight` across its items so all items align vertically.

## Example JSON Configs
### Wide hero + two half-width tiles
```json
{
  "rows": [
    [
      { "id": "chart-revenue", "span": 2, "minHeight": 320 }
    ],
    [
      { "id": "chart-users", "span": 1, "minHeight": 240 },
      { "id": "table-sessions", "span": 1, "minHeight": 240 }
    ]
  ]
}
```

### Four up, then overflow handling
```json
{
  "rows": [
    [
      { "id": "chart-1", "span": 2, "minHeight": 260 },
      { "id": "chart-2", "span": 2, "minHeight": 260 },
      { "id": "table-1", "span": 1, "minHeight": 220 }
    ]
  ]
}
```

## Example HTML Usage
```html
<atlas-analytics-grid id="economy-grid" min-column-width="480"></atlas-analytics-grid>
<script type="module">
  const grid = document.querySelector('#economy-grid');
  grid.setLayout({
    rows: [
      [{ id: 'chart-revenue', span: 2, minHeight: 320 }],
      [
        { id: 'chart-users', span: 1, minHeight: 240 },
        { id: 'table-sessions', span: 1, minHeight: 240 }
      ]
    ]
  });
  grid.setContent({
    charts: [...],
    tables: [...]
  });
</script>
```
