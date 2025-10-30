# System Patterns: AtlasDash

## Architecture Overview

### Multi-Page Application (MPA) Structure
```
atlasdash-site/
├── index.html              # Landing page
├── about.html              # About page (to be created)
├── ecosystem.html          # Ecosystem dashboards (to be created)
├── economy.html            # Game Economy dashboards (to be created)
├── tokenomics.html         # Tokenomics dashboards (to be created)
├── src/
│   ├── main.ts            # Shared initialization code
│   ├── style.css          # Global styles
│   ├── types/             # TypeScript type definitions
│   ├── components/        # Web Components (to be created)
│   ├── charts/            # Chart configurations (to be created)
│   └── data/              # Data fetching modules (to be created)
├── public/                # Static assets
└── vite.config.ts         # Build configuration
```

### Page Structure Pattern
Each HTML page follows a consistent structure:
1. **Navigation Bar**: Consistent across all pages
2. **Hero/Header Section**: Page-specific introduction
3. **Content Sections**: Charts, tables, and explanatory text
4. **Script Imports**: Shared TypeScript module + page-specific scripts

## Component Architecture

### Web Components Strategy
- **Custom Elements**: Native browser Web Components API
- **Shadow DOM**: Encapsulated styles and markup
- **Lifecycle Hooks**: connectedCallback, disconnectedCallback, attributeChangedCallback
- **Helper Library**: Lightweight utility for reducing boilerplate

### Component Categories

#### 1. Chart Components (Planned)
```typescript
// Example: <atlas-chart-dau>
class AtlasChartDAU extends HTMLElement {
  private chart: echarts.ECharts;
  
  connectedCallback() {
    this.initChart();
    this.fetchData();
  }
  
  disconnectedCallback() {
    this.chart?.dispose();
  }
}
```

#### 2. Layout Components (Planned)
- `<atlas-navbar>`: Navigation bar
- `<atlas-section>`: Content section wrapper
- `<atlas-card>`: Card container for dashboard categories

#### 3. Data Components (Planned)
- `<atlas-data-table>`: Sortable, filterable data tables
- `<atlas-metric-card>`: Single metric display with trend indicator

## Data Management Patterns

### Type-Safe Data Flow
```typescript
// 1. Define data structure
interface DAURow {
  DATE: string;
  DAU: string;
}

// 2. Define API response
interface DAUResponseData extends QueriedData<DAURow> {
  rows: DAURow[];
}

// 3. Fetch and validate
async function fetchDAU(): Promise<DAUResponseData> {
  const response = await fetch('/api/dau');
  const data = await response.json();
  // Validation logic here
  return data as DAUResponseData;
}

// 4. Transform for charts
function transformDAUForChart(data: DAUResponseData) {
  return {
    dates: data.rows.map(r => r.DATE),
    values: data.rows.map(r => parseInt(r.DAU))
  };
}
```

### Data Fetching Pattern
- **Async/Await**: All data fetching uses async/await
- **Error Handling**: Try-catch blocks with user-friendly error messages
- **Loading States**: Show loading indicators during data fetch
- **Caching**: Client-side caching to reduce API calls

## Chart Configuration Patterns

### ECharts Initialization Pattern
```typescript
// 1. Get CSS variables for theming
const rootStyles = getComputedStyle(document.documentElement);
const accent = rootStyles.getPropertyValue('--accent').trim();

// 2. Initialize chart
const chart = echarts.init(document.getElementById('chartId'));

// 3. Configure with consistent options
chart.setOption({
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#fff',
    borderColor: accent,
    borderWidth: 1,
    textStyle: { color: '#111' }
  },
  grid: { left: 50, right: 20, top: 30, bottom: 40 },
  // ... chart-specific configuration
});

// 4. Handle responsive resize
window.addEventListener('resize', () => chart.resize());
```

### Chart Theming Pattern
- **CSS Variables**: All colors sourced from CSS variables
- **Consistent Tooltips**: Same tooltip style across all charts
- **Gradient Fills**: Linear gradients using accent colors
- **Transparent Backgrounds**: Charts blend with page background

## Styling Patterns

### CSS Variable System
```css
:root {
  /* Colors */
  --accent: #7c3aed;
  --accent-light: #a78bfa;
  --bg-primary: #ffffff;
  --text-primary: #111111;
  
  /* Spacing */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 2rem;
  --spacing-lg: 4rem;
  
  /* Typography */
  --font-family: system-ui, sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.6;
}
```

### Layout Patterns
- **Container**: Max-width wrapper for content
- **Grid System**: CSS Grid for dashboard layouts
- **Flexbox**: Navigation and card layouts
- **Responsive**: Mobile-first approach with breakpoints

## Build & Deployment Patterns

### Vite MPA Configuration
```typescript
// vite.config.ts
export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        ecosystem: 'ecosystem.html',
        economy: 'economy.html',
        tokenomics: 'tokenomics.html'
      }
    }
  }
});
```

### Build Output Structure
```
dist/
├── index.html
├── about.html
├── ecosystem.html
├── economy.html
├── tokenomics.html
├── assets/
│   ├── main-[hash].js
│   ├── about-[hash].js
│   ├── ecosystem-[hash].js
│   ├── economy-[hash].js
│   ├── tokenomics-[hash].js
│   └── style-[hash].css
└── public/
    └── vite.svg
```

## Code Organization Patterns

### Module Structure
```typescript
// src/charts/dau-chart.ts
export function createDAUChart(containerId: string, data: DAUData) {
  // Chart creation logic
}

// src/data/dau-data.ts
export async function fetchDAUData(): Promise<DAUData> {
  // Data fetching logic
}

// Page-specific script
import { createDAUChart } from './charts/dau-chart';
import { fetchDAUData } from './data/dau-data';

async function init() {
  const data = await fetchDAUData();
  createDAUChart('dailyUsersChart', data);
}

init();
```

### File Naming Conventions
- **Components**: `kebab-case.ts` (e.g., `atlas-chart-dau.ts`)
- **Types**: `snake_case.ts` (e.g., `queried_data.ts`)
- **Utilities**: `camelCase.ts` (e.g., `chartHelpers.ts`)
- **Pages**: `lowercase.html` (e.g., `ecosystem.html`)

## Error Handling Patterns

### Chart Error Handling
```typescript
try {
  const data = await fetchData();
  createChart(data);
} catch (error) {
  console.error('Chart initialization failed:', error);
  showErrorMessage('Unable to load chart data. Please try again later.');
}
```

### Graceful Degradation
- Show error messages in place of failed charts
- Provide fallback content when JavaScript fails
- Maintain page structure even with missing data

## Performance Patterns

### Lazy Loading
- Charts initialized only when visible
- Images loaded with lazy loading attribute
- Code split by page via Vite MPA

### Resource Optimization
- ECharts loaded from CDN (cached by browser)
- Minimal JavaScript on initial page load
- CSS inlined for critical styles

## Testing Patterns (Future)

### Component Testing
- Unit tests for data transformation functions
- Integration tests for chart rendering
- Visual regression tests for UI consistency

### Data Validation Testing
- Schema validation for API responses
- Type checking via TypeScript
- Runtime validation for critical data
