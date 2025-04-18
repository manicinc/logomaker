
# FontManager

## Overview

The Logomaker project implements a sophisticated, multi-strategy font loading and build system designed for portability, web performance, and offline functionality. This system allows Logomaker to handle a large font library efficiently across different deployment scenarios (web vs. offline/Electron) using conditional builds and HTML templates, ensuring reliable font display and SVG embedding.

## Font Management Architecture (`js/fontManager.js`)

The system revolves around `js/fontManager.js`, which intelligently selects a loading strategy based on the build target (`deploy` or `portable`) and available data detected at runtime.

### Key Loading Strategies

1.  **Embedded Mode (`portable` Target)**
    * **Mechanism:** Detects `window._INLINE_FONTS_DATA` global variable upon initialization. This variable is created by the `<script src="inline-fonts-data.js"></script>` tag included in the HTML output of the `portable` build (`npm run build:portable`).
    * All font data, including **Base64 `dataUrl`s** for variants, is loaded directly from this embedded object.
    * `@font-face` rules are injected using these Base64 `dataUrl`s.
    * SVG export reads Base64 data from the loaded cache for embedding.
    * **Use Case:** Offline/standalone/Electron use. Requires building the `portable` target.
    * **Pros:**
        * ✅ Fully self-contained directory output.
        * ✅ Works completely offline (no network requests for fonts).
        * ✅ Reliable SVG font embedding.
    * **Cons:**
        * ⚠️ Very large `inline-fonts-data.js` file (~50-100MB+), increasing storage footprint.
        * ⚠️ **Significantly slower initial load time** due to parsing the large inline script. Higher initial memory usage.

2.  **Hybrid Chunked Lazy Loading (`deploy` Target)**
    * **Mechanism:** Default mode when Embedded Mode data is not found. Used for the live demo and `npm run dev`. Optimized for a balance between initial load speed and SVG embedding support.
    * **Process:**
        1.  Initial load of core HTML, CSS, JS (from `deploy` build output in `dist/github-pages/`).
        2.  Fetch `/font-chunks/index.json` (small metadata file, ~100KB) to populate the font selector dropdown.
        3.  On user font selection (or other trigger needing font data like SVG export):
            * Identify required data chunk file (e.g., `a-f.json`) based on font name using the index.
            * Check cache (in-memory `Map`, then IndexedDB `logomakerFontDB`).
            * Fetch chunk `.json` file (e.g., `/font-chunks/g-m.json`) via network if not cached.
            * Chunk files contain **both `url`s** (pointing to actual font files like `.woff2`) **and Base64 `dataUrl`s** for each variant.
            * Store the loaded chunk data (with both URL & Base64) in memory and IndexedDB cache.
            * Inject dynamic `@font-face` CSS rules, **preferring the `url` property** in the `src`. The browser uses this URL to efficiently fetch the `.woff2` file needed for display.
            * **SVG Export:** When exporting SVG, the rendering logic requests the font data from `fontManager` (accessing the cached chunk data), finds the required variant, extracts its **`dataUrl` property (Base64)**, and uses *that* to embed the font directly within the SVG file's `<style>` tag.
    * **Use Case:** Web hosting (GitHub Pages), local development (`npm run dev`). Requires building the `deploy` target (`npm run build:deploy` or `npm run build`).
    * **Pros:**
        * ✅ **Fast initial page load** (only small index loaded initially).
        * ✅ **Reliable SVG font embedding** using the included Base64 data.
        * ✅ Browser display uses efficient URL-based font file loading via `@font-face`.
        * ✅ Persistent caching of chunks via IndexedDB improves subsequent loads.
    * **Cons:**
        * ⚠️ Requires a web server capable of serving static files (`.html`, `.css`, `.js`, `.json`, `.woff2`, etc.).
        * ⚠️ Needs network access for the initial `index.json`, uncached font chunks (`*.json`), and the actual font files (`*.woff2`).
        * ⚠️ Chunk files (`*.json`) are significantly larger than if they contained only URLs, impacting download time *when a chunk is first loaded*.

3.  **Traditional JSON (Fallback/Alternative)**
    * `fontManager.js` *could* be adapted to load a single, potentially large, `fonts.json` containing relative URLs to font files (not Base64).
    * This is not the primary mode but could serve as a fallback if chunking fails or for simpler setups.
    * Requires separate browser requests for each font file (`.woff2`, etc.). SVG embedding would not work without Base64 data.

4.  **System Font Fallback**
    * If all custom font loading methods fail during initialization (e.g., cannot load index, cannot access inline data), `fontManager.js` attempts to populate the dropdown with common system fonts (Arial, Verdana, etc.) as a last resort.
    * Ensures basic application functionality even in heavily restricted environments.

## Font Directory Structure & Requirements

*(This section remains the same as your provided version - structure looks correct)*

### Font Storage Guidelines

1.  **Directory Location**:
    * Source fonts **must** be stored in a `./fonts/` directory at the project root.
    * Each font family **must** have its own subdirectory within `./fonts/`. The subdirectory name becomes the technical `familyName`.

2.  **Recommended Structure**:
    ```
    fonts/
    ├── Orbitron/
    │   ├── Orbitron-Regular.otf
    │   ├── Orbitron-Bold.otf
    │   └── license.txt
    ├── OpenSans/
    │   ├── OpenSans-Regular.woff2
    │   ├── OpenSans-SemiBold.woff2
    │   └── license.md
    └── ... other font families ...
    ```

3.  **Supported Font Formats** (by `generate-fonts-json.js`):
    * `.otf` (OpenType Font)
    * `.ttf` (TrueType Font)
    * `.woff` (Web Open Font Format)
    * `.woff2` (Web Open Font Format 2)
    * `.eot` (Embedded OpenType) - *Note: EOT is legacy and generally not needed.*

4.  **Naming Conventions**:
    * Use clear, descriptive filenames for font variants.
    * **Recommended:** Include weight and style information (e.g., `Roboto-Bold.otf`, `OpenSans-Italic.woff2`) to help the script guess `fontWeight` and `fontStyle`.

5.  **License Handling**:
    * Optionally include a license file in each font family directory.
    * Supported filenames (case-insensitive): `license.txt`, `license.md`, `license`, `readme.md`, `readme.txt`, `ofl.txt`.
    * The build script can embed the license text (check `generate-fonts-json.js` logic for details on which builds include it where).

## Build Process Workflow Overview

*(This section remains mostly the same - workflow description looks correct)*

### 1. Font Conversion (Optional): `convert-fonts.sh`

A utility script provided to convert source fonts (e.g., `.otf`) to the highly optimized `.woff2` format using `fontTools`. This is typically run manually *before* the build process if needed to optimize font file sizes.

### 2. Font Data Generation: `generate-fonts-json.js`

* Scans the `./fonts/` directory.
* Extracts metadata (family name, variants, formats, guessed weight/style).
* Generates **both** relative `url` paths **and** Base64 `dataUrl`s for each font variant internally.
* Writes `fonts.json` containing **only URLs** and metadata.
* Writes `inline-fonts-data.js`, whose content depends on the `--base64` flag:
    * If `--base64` (for `portable` build): Contains **only Base64 `dataUrl`s** and metadata.
    * If **no** `--base64` (for `deploy` build): Contains **both URLs and Base64 `dataUrl`s** and metadata (this file serves as input for the next step).
* Writes `css/generated-font-classes.css` for basic font family application via classes (though inline styles are often preferred).

### 3. Font Chunking (Deploy Target Only): `split-fonts.js`

* **Only runs during the `deploy` build.**
* Reads the `inline-fonts-data.js` file generated *without* the `--base64` flag (which contains both URLs and dataUrls).
* Creates `font-chunks/index.json` containing only minimal metadata needed to populate the font dropdown.
* Creates chunk files (`font-chunks/a-f.json`, etc.) containing the full font family objects, including variants with **both `url` and `dataUrl`**.

### 4. Build Assembly: `build.js`

* Orchestrates the entire process based on the `--target` flag (`deploy` or `portable`).
* Calls `generate-fonts-json.js` with appropriate flags.
* Calls `split-fonts.js` **only** for the `deploy` target.
* Copies necessary assets (HTML template, CSS, JS, generated font files/chunks) to the correct `./dist/` subdirectory (`github-pages` or `portable`).

---

🚀 Crafted by Manic Agency

