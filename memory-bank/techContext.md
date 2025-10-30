# Technical Context: AtlasDash

## Technology Stack

### Build System
- **Vite**: Using `rolldown-vite@7.1.14` (custom Rolldown-based Vite fork)
- **Configuration**: Multi-page application (MPA) mode with multiple entry points
- **Build Target**: ES2022 for modern browser support
- **Module System**: ESNext with bundler module resolution

### Language & Type System
- **TypeScript**: Version ~5.9.3
- **Target**: ES2022
- **Strict Mode**: Enabled with comprehensive linting rules
- **Module Detection**: Force mode for consistent module handling
- **Decorators**: Experimental decorators disabled (using standard class features)

### Frontend Framework
- **Web Components**: Native browser implementation
- **Helper Library**: Small utility library for Web Component creation (to be added)
- **No Framework**: No React, Vue, or Angular - pure Web Components

### Data Visualization
- **Apache ECharts**: Version 5.x loaded via CDN
- **Integration**: Direct DOM manipulation, no wrapper library
- **Chart Types**: Bar charts, line charts, area charts with gradients
- **Theming**: Custom colors using CSS variables

### Styling
- **CSS**: Custom CSS with CSS variables for theming
- **No Preprocessor**: Plain CSS, no SASS/LESS
- **Design System**: CSS variables for colors, spacing, typography
- **Responsive**: Media queries for different screen sizes

## Development Environment

### Package Management
- **NPM**: Standard package manager
- **Scripts**:
  - `npm start` / `npm run dev`: Development server
  - `npm run build`: TypeScript compilation + Vite build
  - `npm run preview`: Preview production build

### TypeScript Configuration
```json
{
  "target": "ES2022",
  "module": "ESNext",
  "lib": ["ES2022", "ESNext", "DOM", "DOM.Iterable"],
  "moduleResolution": "bundler",
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedSideEffectImports": true
}
```

### Vite Configuration
```typescript
{
  appType: 'mpa',
  esbuild: { target: 'es2022' },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        test: 'test.html'
        // Additional pages to be added
      }
    }
  }
}
```

## Data Architecture

### Type Definitions
Located in `src/types/queried_data.ts`:

```typescript
interface QueriedData<T> {
  columns: { name: string; type: string; }[];
  rows: T[];
  rowCount: number;
}

interface DAURow {
  DATE: string;    // ISO date format
  DAU: string;     // Numeric value as string
}

interface DAUResponseData extends QueriedData<DAURow> {
  rows: DAURow[];
}
```

### Data Flow
1. **Data Source**: Star Atlas blockchain/APIs (to be integrated)
2. **Data Fetching**: TypeScript modules fetch and parse data
3. **Type Safety**: Strongly typed interfaces for all data structures
4. **Chart Integration**: Typed data passed to ECharts configurations
5. **Error Handling**: Type-safe error boundaries and fallbacks

## Browser Compatibility

### Target Browsers
- Modern browsers supporting ES2022
- Native Web Components support required
- ECharts 5.x compatibility

### Required Features
- ES2022 syntax (class fields, private methods, etc.)
- Web Components v1 (Custom Elements, Shadow DOM)
- CSS Variables
- Fetch API
- Promises/Async-Await

## Performance Considerations

### Bundle Optimization
- **Code Splitting**: Separate bundles per page via Vite MPA
- **Tree Shaking**: Automatic via Rolldown
- **Minification**: Production builds minified
- **Asset Optimization**: Images and static assets optimized

### Runtime Performance
- **Chart Initialization**: Lazy initialization on page load
- **Responsive Resize**: Debounced window resize handlers
- **Memory Management**: Proper chart disposal on navigation
- **Data Caching**: Client-side caching for frequently accessed data

## Development Constraints

### No Server-Side Rendering
- Pure static site generation
- All data fetching happens client-side
- No Node.js runtime in production

### No Build-Time Data Fetching
- Data must be fetched at runtime
- Cannot pre-render charts with real data
- Loading states required for all data-dependent UI

### CDN Dependencies
- ECharts loaded from CDN (not bundled)
- Reduces bundle size but adds external dependency
- Fallback strategy needed for CDN failures

## Security Considerations

### Content Security Policy
- Inline scripts currently used (to be migrated to external files)
- CDN resources from trusted sources only
- No eval() or unsafe dynamic code execution

### Data Validation
- All API responses validated against TypeScript interfaces
- Input sanitization for user-provided data (if any)
- XSS prevention through proper DOM manipulation

## Deployment

### Build Output
- Static HTML, CSS, and JavaScript files
- No server-side processing required
- Can be deployed to any static hosting service

### Hosting Options
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static file server

## Future Technical Considerations

### Planned Additions
- Web Component helper library integration
- Additional dashboard pages (ecosystem.html, economy.html, tokenomics.html)
- Data fetching modules for Star Atlas APIs
- Shared component library for charts and UI elements
- Error boundary components
- Loading state components

### Potential Optimizations
- Service Worker for offline support
- Progressive Web App (PWA) features
- Advanced caching strategies
- Chart data streaming for real-time updates
