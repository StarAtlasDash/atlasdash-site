# AtlasDash Site

AtlasDash is a public analytics portal for the Star Atlas ecosystem. It presents charts and tables across three core categories—Ecosystem, Game Economy, and Tokenomics—to make on-chain and game data approachable and actionable. Chart rendering is driven by JSON specs that map R2 query data to ECharts.

Chart spec reference: `CHART_SPEC.md`

## Dashboard Categories
- **Ecosystem**: Galactic Marketplace, DAC activity, Daily Active Users, Fleet Rentals, and broader participation signals.
- **Game Economy**: Local marketplaces, faction stats, DAC comparisons, mining, scanning, crafting, and other gameplay loops.
- **Tokenomics**: ATLAS & POLIS supply, inflow/outflow tracking, locker data, and ecosystem-wide financial activity.

## Stack
- **ViteJS** (MPA)
- **TypeScript**
- **Web Components**
- **Apache ECharts**
- **TanStack Table (vanilla)**

## Data Pipeline
All data is served directly from **R2** and fetched client-side by chart/table components. There are no client calls to Workers.

### Endpoint Format
```
https://data.atlasdash.io/<query-source>/<query-response-data>/latest.json
```
Chart and table components provide the `<query-source>` and `<query-response-data>` segments.

### Response Shape
```ts
export interface QueryResponseData {
  columns: {
    name: string;
    type: 'text' | 'number';
  }[];
  rowCount: number;
  rows: any[];
}
```

### Caching
- Expect new data roughly every hour.
- Client-side caching should be short-lived (e.g., in-memory or session-level).
- R2 sources are public and protected by CORS.

## Chart Component (`atlas-chart`)
The `atlas-chart` web component wraps a single Apache ECharts instance with consistent layout, legend behavior, and responsive resizing.

### Register (required)
```ts
import { registerAtlasChart } from './components/atlas-chart';

registerAtlasChart();
```

### Basic Usage
```html
<atlas-chart
  title="DAU in SAGE vs Ecosystem"
  description="180-day view of activity split."
  chart-type="stacked-bar"
>
  <div slot="info">
    <p>Multi-paragraph context and methodology go here.</p>
    <p>This slot is optional and only shows when provided.</p>
  </div>
</atlas-chart>
```

```ts
const chart = document.querySelector('atlas-chart');
chart?.setOption({
  xAxis: { type: 'category', data: ['2024-01-01', '2024-01-02'] },
  yAxis: { type: 'value' },
  series: [
    { name: 'SAGE', type: 'bar', stack: 'total', data: [120, 140] },
    { name: 'Other', type: 'bar', stack: 'total', data: [60, 70] },
  ],
});
```

### Attributes
- `title`: Heading shown above the chart.
- `description`: Short text shown below the chart (ignored if `slot="description"` is provided).
- `chart-type`: `stacked-bar`, `bar`, `line`, or `area` (used for defaults like tooltip + grid).
- `no-legend`: When present, hides the legend.

### Slots
- `description`: Optional rich description content below the chart.
- `info`: Optional multi-paragraph content shown in the info popover.

### Data Contract
Pass ECharts options directly via `setOption(...)` or the `data` property. No intermediate data format is introduced.

## Project Structure
```
atlasdash-site/
├── index.html              # Landing page
├── src/
│   ├── main.ts             # Shared initialization (WIP)
│   ├── style.css           # Global styles
│   ├── types/              # TypeScript types
│   ├── components/         # Web Components (planned)
│   ├── charts/             # Chart configs (planned)
│   └── data/               # Data fetching modules (planned)
├── memory-bank/            # Project docs and context
└── vite.config.ts          # MPA build config
```

## Getting Started
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Preview Production Build
```bash
npm run preview
```

## Deployment
The site is hosted on **Cloudflare Pages**. Build output is static and compatible with standard Pages deployment pipelines.

## Notes
- The landing page is in `index.html` and introduces the three dashboard categories.
- Charts use Apache ECharts; tables use TanStack Table (vanilla).
- Data fetching and Web Components are being formalized as the project scales.
