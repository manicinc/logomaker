# Logomaker Architecture Specification

## System Overview

### Core Architectural Principles
- Client-side rendering
- Modular component design
- Performance optimization
- Offline capability
- Extensible export mechanisms

## Component Architecture

### 1. Application Core (`main.js`)

#### Responsibilities
- Application initialization
- Module coordination
- Global event management
- Error handling
- Button event binding

#### Key Initialization Sequence
1. Font system initialization
2. Settings manager setup
3. UI component binding
4. Global event listeners

### 2. Font Management System (`fontManager.js`)

#### Loading Strategies
1. **Embedded Mode**
   - Entire font library pre-loaded
   - Ideal for offline/portable builds
   - Embedded in `window._INLINE_FONTS_DATA`

2. **Chunked Loading**
   - On-demand font retrieval
   - Minimal initial payload
   - Chunk-based loading (`font-chunks/*.json`)

3. **Fallback Mechanisms**
   - Traditional JSON loading
   - System font fallback
   - Graceful degradation

#### Caching Mechanisms
- IndexedDB for persistent storage
- In-memory chunk caching
- Frequency-based font tracking
- Intelligent chunk selection

### 3. Rendering Pipeline

#### SVG Rendering
- Direct DOM cloning
- Style preservation
- Font embedding
- Vector-based generation

#### PNG Export
- Multiple rendering techniques:
  1. html2canvas
  2. SVG to canvas conversion
  3. Direct DOM snapshot

#### Animation Rendering
- Keyframe interpolation
- Frame-by-frame generation
- ZIP package export

### 4. Settings Management

#### State Persistence
- Local Storage
- URL Parameter Synchronization
- Change tracking
- Default value management

### 5. Export Handlers

#### Supported Formats
| Format     | Rendering Strategy         | Key Features                  |
|------------|----------------------------|-------------------------------|
| SVG        | Direct DOM Cloning         | Scalable, Portable            |
| PNG        | Multiple Rendering Methods | Raster Image, Transparency    |
| Animation  | Keyframe Interpolation     | Frame Sequence, Preview       |

## Build Process

### Build Targets
1. **Portable Build**
   - Single HTML file
   - Embedded fonts
   - Complete offline functionality

2. **Web Deployment**
   - Chunked font loading
   - Optimized initial payload
   - Network-assisted features

### Font Processing Workflow
1. **Conversion** (`convert-fonts.sh`)
   - Transform source fonts to `.woff2`
   - Web optimization
   - Error-resilient processing

2. **Metadata Generation** (`generate-fonts-json.js`)
   - Font directory scanning
   - Metadata extraction
   - Generates:
     * `fonts.json`
     * `inline-fonts-data.js`
     * `generated-font-classes.css`

3. **Chunk Splitting** (`split-fonts.js`)
   - Divide monolithic font data
   - Create optimized loading chunks

## Performance Considerations

### Optimization Strategies
- Lazy loading
- Efficient caching mechanisms
- Minimal DOM manipulation
- Progressive enhancement
- Potential Web Worker integration

## Error Handling

### Resilience Mechanisms
- Centralized error management
- Graceful feature degradation
- User-friendly notifications
- Fallback rendering strategies

## Development Workflow

### Contribution Guidelines
1. Maintain existing code structure
2. Implement comprehensive error handling
3. Update documentation
4. Write unit and integration tests

## Licensing & Attributions

### Font Handling
- Respect individual font licenses
- Embedded license metadata
- Clear attribution mechanisms

---

🚀 Crafted by [Manic Agency](https://manic.agency)