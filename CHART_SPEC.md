# Chart Spec Reference

This document describes the JSON chart spec used to build `<atlas-chart>` instances and ECharts options.

## Overview
Each chart is defined by a JSON object that includes:
- the R2 query location
- the chart type and data series
- axis definitions
- optional title/label/description/info content

Specs are loaded at runtime from `public/chart-specs.json` and applied to `<atlas-chart>` elements that declare `data-chart-id`.

## Base Shape
```json
{
  "id": "unique-chart-id",
  "title": "Chart Title",
  "label": "Ecosystem",
  "description": "Short text (optional)",
  "descriptionHtml": "HTML string (optional)",
  "infoHtml": "HTML string (optional)",
  "chartType": "line",
  "query": {
    "source": "flipside",
    "dataset": "sa-activity"
  },
  "xAxis": {
    "field": "DATE",
    "type": "category",
    "label": "Date",
    "labelDensity": 0.85
  },
  "xWindowDays": 365,
  "enableSecondaryAxis": false,
  "yAxis": {
    "label": "Wallets",
    "min": 0,
    "max": 1000
  },
  "yAxes": [],
  "series": [],
  "seriesFromField": null,
  "seriesFromColumns": null,
  "legend": true,
  "sort": {
    "field": "DATE",
    "order": "asc",
    "type": "date"
  }
}
```

## Fields
- `id` (string, required): Unique ID used by `data-chart-id`.
- `title` (string, required): Chart title shown in the component header.
- `label` (string, optional): Small badge aligned to the right of the header.
- `description` (string, optional): Plain text description. Ignored if `descriptionHtml` is provided.
- `descriptionHtml` (string, optional): HTML string injected into `slot="description"`.
- `infoHtml` (string, optional): HTML string injected into `slot="info"`.
- `chartType` (string, required): `bar`, `line`, `area`, or `stacked-bar`.
- `query` (object, required): R2 location:
  - `source`: e.g. `flipside`
  - `dataset`: e.g. `sa-activity`
- `xAxis` (object, required):
  - `field`: column name in R2 data
  - `type`: `category` or `time` (default: `category`)
  - `label`: axis label (optional)
  - `labelDensity`: controls how many labels to show relative to width (lower = fewer labels). Allowed range: `0.1`–`1.0`. The last label is always shown. Internally this is scaled to allow denser labeling without exposing values above `1.0`.
- `xWindowDays` (number, optional): Show only the most recent N days based on the max date in the dataset. Applied only when the X-axis column type is `date`.
- `enableSecondaryAxis` (boolean, optional): When `true`, allows multiple Y axes (using `yAxes` or `yAxisIndex`). Default is `false`, which forces a single axis even if series set `yAxisIndex`.
- `yAxis` (object, optional):
  - `label`: axis label
  - `min` / `max`: numeric bounds
- `yAxes` (array, optional): Multiple axes (left/right). Only used when `enableSecondaryAxis` is `true`. Each entry supports:
  - `label`: axis label
  - `min` / `max`: numeric bounds
  - `position`: `left` or `right` (defaults to left for the first axis, right for the second)
If `enableSecondaryAxis` is `true` and `yAxes` is omitted, a secondary right axis is created automatically when any series uses `yAxisIndex: 1`.
- `series` (array, optional): Explicit series definitions (see below).
- `seriesFromField` (object, optional): Auto‑series builder when each row contains a `NAME`/`WALLETS` style pair.
- `seriesFromColumns` (object, optional): Select specific columns as datasets and optionally rename them.
- `legend` (boolean, optional): Set to `false` to hide legend.
- `sort` (object, optional): Sort rows before plotting.
  - `field`: column name to sort by (default: `xAxis.field`)
  - `order`: `asc` or `desc` (default: `asc`)
  - `type`: `date`, `number`, or `string` (auto‑inferred if omitted)

## Series (Explicit)
Use `series` when each series maps to a column or a derived value.

```json
{
  "series": [
    {
      "name": "DAU in SAGE",
      "field": "ACTIVE_PLAYER_PROFILES_SB",
      "type": "bar",
      "stack": "total",
      "yAxisIndex": 0
    },
    {
      "name": "DAU in rest of Ecosystem",
      "derive": {
        "op": "subtract",
        "fields": ["ACTIVE_USERS_ALL", "ACTIVE_PLAYER_PROFILES_SB"]
      },
      "type": "bar",
      "stack": "total",
      "yAxisIndex": 0
    }
  ]
}
```

`derive.op` supports: `add`, `subtract`, `multiply`, `divide`.
`yAxisIndex` targets a specific axis when using `enableSecondaryAxis` (0 = first axis, 1 = second). It is ignored when `enableSecondaryAxis` is `false`.
When `chartType` is `stacked-bar`, bar series default to `stack: "total"` if `stack` is not provided. Non‑bar series (like a line overlay) do not stack unless explicitly set.

## Series From Field (Pivot)
Use `seriesFromField` when the dataset has one row per date and series name, for example:
`DATE`, `NAME`, `WALLETS`. Each unique `NAME` becomes a series.

```json
{
  "seriesFromField": {
    "nameField": "NAME",
    "valueField": "WALLETS",
    "type": "line"
  }
}
```
Use `yAxisIndex` here to route all generated series to a specific axis.

## Series From Columns (Selective)
Use `seriesFromColumns` when each column is a dataset, but you only want specific columns and/or custom names.

```json
{
  "seriesFromColumns": {
    "fields": [
      { "field": "FF", "name": "Faction Fleet", "type": "bar", "stack": "total" },
      { "field": "STARBASED", "name": "SAGE (Loyalty Points)", "type": "bar", "stack": "total" },
      { "field": "FIC", "name": "SAGE (FICs)", "type": "bar", "stack": "total" }
    ]
  }
}
```
Each field can also set `yAxisIndex` to target a secondary axis.

## Example: Stacked Bar (DAU Split)
```json
{
  "id": "dau-stacked",
  "title": "Daily Active Users",
  "label": "Ecosystem",
  "chartType": "stacked-bar",
  "query": { "source": "flipside", "dataset": "sa-activity" },
  "xAxis": { "field": "DATE", "type": "category" },
  "xWindowDays": 365,
  "sort": { "field": "DATE", "order": "asc", "type": "date" },
  "series": [
    {
      "name": "DAU in SAGE",
      "field": "ACTIVE_PLAYER_PROFILES_SB",
      "type": "bar",
      "stack": "total"
    },
    {
      "name": "DAU in rest of Ecosystem",
      "derive": {
        "op": "subtract",
        "fields": ["ACTIVE_USERS_ALL", "ACTIVE_PLAYER_PROFILES_SB"]
      },
      "type": "bar",
      "stack": "total"
    }
  ],
  "descriptionHtml": "Daily Active Users (DAU) in SAGE represents the number of unique wallets playing SAGE: Starbased on a given day. DAU in Ecosystem represents the wallets interacting with the broader Star Atlas ecosystem (e.g., Lockers, Marketplace). <em>[Data as of yesterday]</em>"
}
```

## Example: Multi‑Series Line (Per NAME)
```json
{
  "id": "line-chart",
  "title": "Daily Active Users",
  "label": "Ecosystem",
  "chartType": "line",
  "query": { "source": "flipside", "dataset": "dau-in-sa" },
  "xAxis": { "field": "DATE", "type": "category" },
  "xWindowDays": 365,
  "sort": { "field": "DATE", "order": "asc", "type": "date" },
  "seriesFromField": {
    "nameField": "NAME",
    "valueField": "WALLETS",
    "type": "line"
  },
  "descriptionHtml": "Daily Active Users (DAU) in SAGE represents the number of unique wallets playing SAGE: Starbased on a given day. DAU in Ecosystem represents the wallets interacting with the broader Star Atlas ecosystem (e.g., Lockers, Marketplace). <em>[Data as of yesterday]</em>"
}
```

## Example: Column‑Driven Stacked Bar (ATLAS Emissions) + Line Overlay
```json
{
  "id": "atlas-emissions",
  "title": "ATLAS Emissions",
  "label": "Tokenomics",
  "chartType": "stacked-bar",
  "query": { "source": "flipside", "dataset": "atlas-emission" },
  "xAxis": { "field": "DATE", "type": "category" },
  "xWindowDays": 90,
  "sort": { "field": "DATE", "order": "asc", "type": "date" },
  "seriesFromColumns": {
    "fields": [
      { "field": "FF", "name": "Faction Fleet", "type": "bar", "stack": "total" },
      { "field": "STARBASED", "name": "SAGE (Loyalty Points)", "type": "bar", "stack": "total" },
      { "field": "FIC", "name": "SAGE (FICs)", "type": "bar", "stack": "total" }
    ]
  },
  "series": [
    { "name": "ATLAS 3M Avg", "field": "ATLAS_3M_AVG", "type": "line" }
  ],
  "description": "ATLAS Emissions through Faction Fleet (SCORE) and SAGE Starbased. In Starbased players claim ATLAS for accumulated Loyalty Points and sell Faction Infrastructure Contracts (FICSs) to NPC bidders."
}
```

## Usage
Add the chart element with `data-chart-id`:
```html
<atlas-chart data-chart-id="line-chart" class="chart-block"></atlas-chart>
```

The runtime loader will:
1. Fetch the spec from `public/chart-specs.json`
2. Fetch the query data from R2
3. Build an ECharts option
4. Apply the plan to the component
