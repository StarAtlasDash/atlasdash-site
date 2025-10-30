# Project Brief: AtlasDash

## Overview
AtlasDash is a data analytics and visualization platform for the Star Atlas metaverse game ecosystem. It provides insights into the game's economy, player activity, and tokenomics through interactive charts, graphs, and tables.

## Core Requirements

### Architecture
- **Static Multi-Page Application (MPA)**: Traditional HTML pages, no SPA framework or client-side routing
- **Multiple themed pages**: Landing page, About page, and category-specific dashboard pages (Ecosystem, Game Economy, Tokenomics)
- **Build system**: Vite configured for MPA with multiple entry points

### Technology Stack
- **Build Tool**: ViteJS (using rolldown-vite@7.1.14)
- **Language**: TypeScript (ES2022 target)
- **Package Manager**: NPM
- **UI Components**: Native Web Components with helper library
- **Charts**: Apache ECharts (loaded via CDN)
- **Styling**: Custom CSS with CSS variables for theming

### Key Features
1. **Landing Page**
   - Project introduction and value proposition
   - Featured charts showcasing key metrics
   - Navigation to specialized dashboard pages
   - Sections: Hero, Daily Active Users, Galaxy at a Glance, What Is AtlasDash, Dashboard Overview, Economic Pulse

2. **Dashboard Categories**
   - **Ecosystem**: External view - Galactic Marketplace, DAC activity, Daily Active Users, Fleet Rentals
   - **Game Economy**: Internal gameplay - Local Marketplaces, Faction stats, Mining, Scanning, Crafting
   - **Tokenomics**: Token flows - ATLAS & POLIS supply, inflow/outflow, Locker data

3. **About Page**
   - Project background and mission
   - Team/organization information (Aephia Industries)

### Data Visualization
- Interactive charts using Apache ECharts
- Real-time data from Star Atlas blockchain/APIs
- Responsive chart sizing
- Consistent theming with CSS variables (purple accent: #7c3aed)

## Project Goals
1. Make Star Atlas data accessible and transparent
2. Provide actionable insights for players, strategists, and builders
3. Transform complex blockchain data into clear visualizations
4. Support informed decision-making in the Star Atlas ecosystem

## Constraints
- Static site deployment (no server-side rendering)
- Browser compatibility: Modern browsers supporting ES2022
- Performance: Fast load times, efficient chart rendering
- Maintainability: Clean separation of concerns, reusable components

## Success Criteria
- Clear, intuitive navigation between dashboard pages
- Fast-loading, responsive charts
- Accurate data representation
- Professional, cohesive visual design
- Easy to extend with new dashboards and metrics
