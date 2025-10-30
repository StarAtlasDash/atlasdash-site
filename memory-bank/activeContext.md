# Active Context: AtlasDash

## Current Work Focus

### Project Initialization Phase
The project is in its early stages with a working landing page prototype. The foundation is established with Vite, TypeScript, and basic ECharts integration. Current focus is on:

1. **Memory Bank Setup**: Establishing comprehensive documentation for project continuity
2. **Architecture Planning**: Defining patterns and structure for scalable development
3. **Prototype Refinement**: The landing page (index.html) serves as a proof of concept

## Recent Changes

### Completed
- ✅ Initial Vite + TypeScript setup with MPA configuration
- ✅ Landing page HTML structure with navigation, hero, and content sections
- ✅ ECharts integration via CDN with two sample charts (Daily Active Users, ATLAS Volume)
- ✅ CSS theming system with purple accent colors (#7c3aed)
- ✅ Type definitions for data structures (QueriedData, DAURow, DAUResponseData)
- ✅ Responsive chart resize handling
- ✅ Memory Bank core files created (projectbrief, productContext, techContext, systemPatterns)

### In Progress
- 🔄 Memory Bank documentation (activeContext.md, progress.md remaining)
- 🔄 Project structure planning for Web Components
- 🔄 Data fetching architecture design

## Next Steps

### Immediate (Next Session)
1. **Complete Memory Bank**: Finish activeContext.md and progress.md
2. **Create .clinerules**: Document project-specific patterns and preferences
3. **Plan Web Components Architecture**: 
   - Research/select Web Component helper library
   - Design component API patterns
   - Plan component directory structure

### Short Term (1-2 Sessions)
1. **Refactor Chart Code**:
   - Move inline chart scripts to TypeScript modules
   - Create reusable chart configuration functions
   - Implement proper data fetching with loading states

2. **Build Component Library**:
   - Create `<atlas-navbar>` component
   - Create `<atlas-chart>` base component
   - Create `<atlas-section>` layout component

3. **Create Additional Pages**:
   - about.html
   - ecosystem.html
   - economy.html
   - tokenomics.html

### Medium Term (3-5 Sessions)
1. **Data Integration**:
   - Research Star Atlas data APIs
   - Implement data fetching modules
   - Add error handling and loading states
   - Implement client-side caching

2. **Dashboard Development**:
   - Populate ecosystem.html with relevant charts
   - Populate economy.html with game economy metrics
   - Populate tokenomics.html with token flow data

3. **Polish & Optimization**:
   - Responsive design refinement
   - Performance optimization
   - Accessibility improvements
   - SEO optimization

## Active Decisions & Considerations

### Web Component Helper Library
**Decision Needed**: Select a lightweight helper library for Web Components
- **Options**: lit-html, haunted, or custom utility functions
- **Criteria**: Minimal bundle size, TypeScript support, simple API
- **Timeline**: Decide in next session

### Chart Code Organization
**Current State**: Charts initialized with inline scripts in HTML
- **Issue**: Not maintainable, violates separation of concerns
- **Solution**: Move to TypeScript modules with proper imports
- **Priority**: High - should be addressed soon

### Data Source Integration
**Current State**: Using mock data generated in JavaScript
- **Next Step**: Research Star Atlas data availability
- **Questions**: 
  - What APIs are available?
  - What authentication is required?
  - What rate limits exist?
  - What data formats are used?

### Navigation Structure
**Current State**: Hash-based navigation on landing page (#ecosystem, #mining, etc.)
- **Issue**: Links point to sections that don't exist yet
- **Solution**: Update to proper page links once pages are created
- **Priority**: Medium - can wait until pages are built

## Current Challenges

### 1. Web Components Learning Curve
- **Challenge**: Team may need to learn Web Components API
- **Mitigation**: Start with simple components, use helper library
- **Resources**: MDN Web Components guide, web.dev tutorials

### 2. ECharts TypeScript Integration
- **Challenge**: ECharts types can be complex
- **Current Approach**: Using `any` types in some places
- **Future**: Add proper ECharts TypeScript definitions

### 3. Static Site Data Fetching
- **Challenge**: No server-side rendering, all data fetched client-side
- **Consideration**: Loading states, error handling, performance
- **Solution**: Implement robust client-side data layer

## Technical Debt

### Current Technical Debt
1. **Inline Scripts**: Chart initialization code in HTML files
2. **Mock Data**: Hardcoded sample data instead of real API calls
3. **No Error Handling**: Charts fail silently if initialization fails
4. **No Loading States**: No indication when data is being fetched
5. **Duplicate Code**: Chart configuration repeated across charts
6. **Test Files**: test.html and test2.html should be removed or organized

### Planned Refactoring
1. Extract chart code to TypeScript modules
2. Create chart configuration factory functions
3. Implement data fetching layer with proper error handling
4. Add loading spinners/skeletons for charts
5. Create shared chart theme configuration

## Environment Notes

### Development Setup
- **IDE**: Visual Studio Code
- **Node Version**: (to be documented)
- **NPM Version**: (to be documented)
- **OS**: macOS (based on file paths)

### Current File Structure
```
atlasdash-site/
├── index.html          # Landing page (working)
├── test.html           # Test file (purpose unclear)
├── test2.html          # Test file (purpose unclear)
├── package.json        # Dependencies configured
├── vite.config.ts      # MPA setup with 2 entry points
├── tsconfig.json       # Strict TypeScript config
├── src/
│   ├── main.ts         # Empty (not yet used)
│   ├── style.css       # Global styles
│   ├── tstyle.css      # Purpose unclear
│   └── types/
│       └── queried_data.ts  # Data type definitions
├── public/
│   └── vite.svg        # Default Vite icon
└── memory-bank/        # Documentation (being created)
```

## Questions for User

### Clarifications Needed
1. What is the purpose of test.html and test2.html?
2. What is tstyle.css used for?
3. Are there existing Star Atlas API endpoints to integrate with?
4. What is the preferred Web Component helper library?
5. What is the deployment target (hosting platform)?

## Session Continuity Notes

### For Next Session
- Review and update this activeContext.md
- Check progress.md for completed items
- Review .clinerules for project-specific patterns
- Continue from "Next Steps" section above

### Important Context
- This is a new project in early stages
- Landing page prototype is functional but needs refactoring
- Focus is on establishing solid architecture before scaling
- Web Components are a core requirement, not optional
- Static site deployment is a hard constraint
