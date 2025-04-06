# FontManager

## Overview

The Logomaker project implements a sophisticated, multi-strategy font loading and build system designed for portability, web performance, and offline functionality. This system allows Logomaker to handle a large font library efficiently across different deployment scenarios (web vs. offline/Electron) using conditional builds and HTML templates.

## Font Management Architecture (`fontManager.js`)

The system revolves around `fontManager.js`, which intelligently selects a loading strategy based on the build target and available data.

### Key Loading Strategies

1.  **Embedded Mode (Portable Target)**
    * **Mechanism:** Detects `window._INLINE_FONTS_DATA` global variable upon initialization. This variable is expected to be created by the `<script src="inline-fonts-data.js"></script>` tag present in the HTML output of the `portable` build.
    * All font data (including Base64 data URLs for variants) is pre-loaded.
    * **Use Case:** Perfect for offline/standalone/Electron use (`npm run build:portable`).
    * **Pros:**
        * Fully self-contained directory output.
        * Works completely offline.
    * **Cons:**
        * Very large `inline-fonts-data.js` file (~50-100MB+ depending on fonts), increasing storage footprint.
        * Slower initial HTML parse and script execution time due to the large inline script. Potentially higher initial memory usage.

2.  **Chunked Lazy Loading (Deploy Target)**
    * **Mechanism:** Used when Embedded Mode data is not found. Optimized for web performance.
    * **Process:**
        1.  Initial load of core HTML, CSS, JS (HTML generated from `index.template.html`, *without* `inline-fonts-data.js` script).
        2.  Fetch `/font-chunks/index.json` (small metadata file) to populate the font selector. Relies on `/fonts.json` for additional metadata if needed.
        3.  On user font selection:
            * Identify required data chunk (e.g., `a-f.json`) based on font name.
            * Check cache (in-memory then IndexedDB).
            * Fetch chunk `.json` file via network if not cached.
            * Extract Base64 font variant data from the chunk.
            * Dynamically inject `@font-face` CSS rule using the Base64 data URL.
            * Browser renders font using the injected rule. (No separate font file download needed if using Base64 chunks).
    * **Use Case:** Web hosting (`npm run build:deploy`).
    * **Pros:**
        * Fast initial page load.
        * Efficient bandwidth (only loads needed font data).
        * Persistent caching via IndexedDB improves subsequent loads.
    * **Cons:**
        * Requires a web server capable of serving static files.
        * Needs network access for uncached font chunks.

3.  **Traditional JSON (Dev/Fallback)**
    * Can load a single, potentially large, `fonts.json` containing relative URLs to font files (not Base64).
    * Used as a fallback or potentially in simpler development setups without chunking.
    * Requires separate font file requests (`.woff2`, etc.).

4.  **System Font Fallback**
    * Graceful degradation using common system fonts if all custom font loading methods fail.
    * Ensures basic application functionality.

## Font Directory Structure & Requirements

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
    * The build script embeds the license text in `inline-fonts-data.js` for the portable build.

## Build Process Workflow

### 1. Font Conversion (Optional): `convert-fonts.sh`
A utility script provided to convert source fonts (e.g., `.otf`) to the highly optimized `.woff2` format using `fontTools`. This is typically run manually *before* the build process if needed.

```bash
# Example: Convert all OTF fonts in ./fonts to WOFF2 in ./converted_fonts
./scripts/convert-fonts.sh
# (You would then replace the OTFs with WOFF2s in the ./fonts directory)
---

🚀 Crafted by Manic Agency