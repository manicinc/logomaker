# Logomaker Architecture Overview 🏗️

This document outlines the technical architecture of the Logomaker application developed by Manic Agency. Logomaker is designed as a client-side Single Page Application (SPA) built entirely with standard web technologies (HTML, CSS, JavaScript), prioritizing **extreme portability** and **offline functionality**.

## Core Philosophy

* **Client-Side Power:** All logo generation, styling, previewing, and exporting happens directly in the user's browser. No server-side processing is required after the initial load.
* **Portability First:** The application can run from a single `index.html` file, optionally embedding all necessary fonts and scripts, making it easily shareable and usable offline.
* **SVG as Source of Truth:** The Scalable Vector Graphics (SVG) format is treated as the primary representation of the logo. Other formats (PNG, animation frames) are derived directly from this SVG representation to ensure visual consistency.

## Key Components & Modules

Logomaker's functionality is organized into several key JavaScript modules and CSS files:

1.  **`index.html`**: The main entry point containing the UI structure (controls, tabs, preview area, modals), initial script/style loading, and some inline setup scripts.
2.  **CSS (`/css/`):**
    * `variables.css`: Defines color palettes (light/dark), spacing, typography, and base gradient presets.
    * `base.css`, `layout.css`, `components.css`: Basic styling, layout structure, and UI component styles.
    * `effects.css`: Contains CSS class definitions for text effects (glows, shadows), border styles, background patterns, and `@keyframes` for animations.
    * `responsive.css`: Handles layout adjustments for different screen sizes.
3.  **JavaScript (`/js/`):**
    * **`main.js`**: Orchestrates the application initialization sequence, ensuring modules load and initialize in the correct order. Binds primary UI event listeners (export, copy, etc.).
    * **`settingsManager.js`**: The central hub for managing the application's state. It listens to UI control changes, updates the live preview styles, stores settings (using `localStorage`), handles resets, and generates CSS code snippets.
    * **`fontManager.js`**: Responsible for loading font data (either from embedded data or external JSON), populating the font selection dropdown, and providing font details for embedding.
    * **`captureTextStyles.js` (`captureAdvancedStyles`)**: Captures the current computed styles *and* relevant settings from the live preview elements. This captured data is crucial input for the rendering pipeline.
    * **`RendererCore.js`**: Contains the core logic for generating the final export artifacts. It takes captured styles and export options to produce an SVG blob (the source of truth). It also includes utilities for converting SVG to PNG canvas data and generating animation frames based on the SVG.
    * **Renderers (`SVGRenderer.js`, `PNGRenderer.js`, `GIFRenderer.js`)**: Each manages the specific UI modal (preview, options) and export process for its format, utilizing `RendererCore.js` for the actual generation. `GIFRenderer.js` orchestrates frame generation and packaging into a ZIP.
    * **Utilities (`misc.js`, `utils.js`, `cssUtils.js`, `svgAnimationInfo.js`, `zipUtils.js`, etc.)**: Provide helper functions for various tasks like DOM manipulation, theme switching, animation detail extraction, CSS variable handling, ZIP creation, downloads, etc.
    * **UI Scripts (`tabs.js`, `resetConfirmation.js`, etc.)**: Handle specific UI interactions like tab navigation and modal confirmations.

## Data Flow Overview

The general flow of creating and exporting a logo is:

```mermaid
graph LR
    A[User Interaction (e.g., change color)] --> B(SettingsManager);
    B --> C{Update Internal State};
    C --> D[Apply Styles to Live Preview DOM];
    D --> E(Live Preview Updated);

    F[User Clicks Export Button] --> G(Export Handler in main.js);
    G --> H{Renderer Export*WithUI Function};
    H --> I[Show Export Modal];
    I --> J(Capture Styles via captureAdvancedStyles);
    J --> K(RendererCore generates SVG/PNG/Frames);
    K --> L[Show Preview in Modal];

    M[User Confirms Export in Modal] --> N(RendererCore generates Final Blob);
    N --> O[Download Triggered];

    subgraph Live Update Cycle
        direction LR
        A ~~~ D;
    end

    subgraph Export Process
        direction LR
        F ~~~ O;
    end

    style Live Update Cycle fill:#f9f,stroke:#333,stroke-width:1px,opacity:0.5
    style Export Process fill:#ccf,stroke:#333,stroke-width:1px,opacity:0.5