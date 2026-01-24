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
  "descriptionMd": "Markdown string (optional)",
  "infoMd": "Markdown string (optional)",
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
  "xZoom": {
    "enabled": true,
    "showSlider": true,
    "inside": true,
    "windowDays": 120
  },
  "enableSecondaryAxis": false,
  "lockYAxisMax": true,
  "yAxisMaxRound": true,
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
- `description` (string, optional): Plain text description. Ignored if `descriptionMd` is provided.
- `descriptionMd` (string, optional): Markdown string rendered into `slot="description"`.
- `infoMd` (string, optional): Markdown string rendered into `slot="info"`.
- `descriptionHtml` / `infoHtml` (string, optional): Legacy fields, treated as markdown (raw HTML is escaped).
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
- `xZoom` (object, optional): Enables horizontal scrolling via ECharts `dataZoom` on the X-axis.
  - `enabled` (boolean, optional): Defaults to `true` when `xZoom` is provided.
  - `showSlider` (boolean, optional): Show the draggable slider (default: `true`).
  - `inside` (boolean, optional): Enable scroll/zoom via mouse wheel or touch (default: `true`).
  - `showDataShadow` (boolean or `"auto"`, optional): Show the mini preview in the slider. Defaults to ECharts behavior (`"auto"`).
  - `shadowField` (string, optional): Column name used to build the slider’s data shadow. Values are summed when multiple rows share the same X value.
  - `shadowSeriesName` (string, optional): Use an existing series (by `name`) to drive the slider’s data shadow.
  - `start` / `end` (number, optional): Window in percent (0–100).
  - `startValue` / `endValue` (string/number, optional): Window by axis values (takes precedence over `start`/`end`).
  - `windowDays` (number, optional): For date axes, show the most recent N days without trimming the dataset.
  - `windowPoints` (number, optional): Show the most recent N points on any axis.
  - `filterMode` (string, optional): Controls how out-of-window data is handled.
    - `filter` (default): removes data outside the window; axis ranges adjust to the visible data.
    - `empty`: keeps categories/indices but sets out-of-window values to empty (useful for maintaining alignment).
    - `none`: leaves data intact (can reduce axis drift, but may introduce visual artifacts).
  - `zoomLock` (boolean, optional): Lock the window size so the slider can only pan, not resize.
  - `brushSelect` (boolean, optional): Allow selecting a custom range by dragging on the slider background (default: `true` in ECharts).
  - `height` (number, optional): Slider height.
  - `bottom` (number|string, optional): Slider offset from the bottom.
  - `gridBottom` (number, optional): Overrides grid bottom padding when a slider is used.
`xZoom` shadow precedence: `shadowSeriesName` → `shadowField`.
`xZoom` window precedence: `startValue`/`endValue` → `start`/`end` → `windowDays`/`windowPoints`.
- `enableSecondaryAxis` (boolean, optional): When `true`, allows multiple Y axes (using `yAxes` or `yAxisIndex`). Default is `false`, which forces a single axis even if series set `yAxisIndex`.
- `lockYAxisMax` (boolean, optional): Locks the Y-axis max to the highest value in the full dataset so the scale stays fixed while sliding. Default is `true`. Set to `false` to allow the axis to rescale to the visible window.
- `yAxisMaxRound` (boolean, optional): Trims insignificant digits from the computed max (no rounding up). For example, `32,456,789` becomes `32,000,000`. Default is `true`. Set to `false` to use the exact computed max.
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
  "descriptionMd": "Daily Active Users (DAU) in SAGE represents the number of unique wallets playing SAGE: Starbased on a given day. DAU in Ecosystem represents the wallets interacting with the broader Star Atlas ecosystem (e.g., Lockers, Marketplace). *[Data as of yesterday]*"
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
  "descriptionMd": "Daily Active Users (DAU) in SAGE represents the number of unique wallets playing SAGE: Starbased on a given day. DAU in Ecosystem represents the wallets interacting with the broader Star Atlas ecosystem (e.g., Lockers, Marketplace). *[Data as of yesterday]*"
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

## Markdown Support
Descriptions and info boxes support a tiny subset of Markdown:
- `**bold**`
- `*italic*`
- `[label](https://example.com)`
- blank lines create new paragraphs
All HTML is escaped before rendering.
