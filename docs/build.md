# Building Logomaker

This document details the build process for the Logomaker application, explaining the different targets, scripts, outputs, and the use of HTML templates.

## Overview

The build system uses Node.js scripts to transform the source code and assets into deployable versions suitable for different environments (web hosting vs. offline/Electron use). It relies on HTML template files (`index.template.html`, `index-portable.template.html`) located in the project root, which are processed by the build script to generate the final `index.html` for each target.

The system prioritizes minimal runtime dependencies for the final application. While `package.json` is used to manage development tools (`devDependencies`) like the local test server (`http-server`) and file watcher (`chokidar`), these are **not** required for the build process itself or for running the built application.

## Build Commands (via npm)

The primary way to trigger builds is through npm scripts defined in `package.json`:

* **`npm run build` or `npm run build:deploy`**
    * Builds the **deploy** target.
    * Output: `./dist/github-pages/`
    * This is the optimized version intended for web hosting (like GitHub Pages). Uses `index.template.html` as the source.

* **`npm run build:portable`**
    * Builds the **portable** target.
    * Output: `./dist/portable/`
    * This is the self-contained version for offline use or Electron. Uses `index-portable.template.html` as the source. (Note: Output is a directory).

These scripts call the underlying `node scripts/build.js` script with appropriate arguments.

## Build Targets

### 1. `deploy` Target (Default / Web Optimized)

* **Purpose:** Optimized for deployment to static web hosts (e.g., GitHub Pages, Netlify, Vercel).
* **Command:** `npm run build:deploy`
* **Source HTML:** `index.template.html`
* **Output:** `dist/github-pages/` (includes `index.html` generated from the source template)
* **Characteristics:**
    * **Font Handling:** Uses **Font Chunking**.
        * Runs `scripts/generate-fonts-json.js` (without `--base64`) to create `fonts.json` (metadata) and `inline-fonts-data.js` (temporary file used as input for splitting).
        * Runs `scripts/split-fonts.js` to:
            * Clean the `font-chunks/` directory.
            * Create a small `font-chunks/index.json` (for initial dropdown population).
            * Create multiple `font-chunks/*.json` files containing Base64 font data, split alphabetically.
        * Copies the `font-chunks/` directory and `fonts.json` to the output directory. Source font files (e.g., `.woff2`) are **not** typically copied for this target as Base64 data is used in the chunks.
    * **HTML:** Copies `index.template.html` to `dist/github-pages/index.html`. This version **does not** include a `<script>` tag for `inline-fonts-data.js`.
    * **Loading:** `fontManager.js` loads `font-chunks/index.json` first, then dynamically fetches required chunk `.json` files as needed. Chunks are cached in IndexedDB.
    * **Result:** Faster initial page load, efficient bandwidth usage, requires a web server for full functionality.

### 2. `portable` Target (Offline / Electron)

* **Purpose:** Designed to run entirely offline from the local filesystem (`file:///`) or within Electron, prioritizing portability over initial load speed.
* **Command:** `npm run build:portable` (This script first runs `generate-fonts-json.js --base64`)
* **Source HTML:** `index-portable.template.html`
* **Output:** `dist/portable/` (A directory containing `index.html` and all assets)
* **Characteristics:**
    * **Font Handling:** Uses **Embedded Base64 Data**.
        * Runs `scripts/generate-fonts-json.js --base64` to generate `inline-fonts-data.js` containing *all* font data (including variants) encoded as Base64 data URLs. It also generates `fonts.json` (less critical for this build) and `css/generated-font-classes.css`.
        * `split-fonts.js` is **not** run for this target.
        * Copies the generated `inline-fonts-data.js` into the output directory.
    * **HTML:** Copies `index-portable.template.html` to `dist/portable/index.html`. This version **includes** `<script src="inline-fonts-data.js"></script>` right before `main.js` is loaded.
    * **Loading:** `fontManager.js` detects the `window._INLINE_FONTS_DATA` global variable (created by loading `inline-fonts-data.js`) and uses the embedded Base64 data directly. No external font files or chunks are fetched.
    * **Result:** Fully self-contained directory that works offline or in Electron. Significantly larger initial resource load (due to `inline-fonts-data.js`) leads to slower first load/parse time compared to the deploy target. The output is a directory of files, **not** a single bundled HTML file.

## Core Build Steps (`scripts/build.js`)

Regardless of the target, `scripts/build.js` generally performs these steps:

1.  **Clean Target Directory:** Removes the previous content of the specific output directory (e.g., `dist/github-pages` or `dist/portable`).
2.  **Generate Font Assets (Conditional):** Runs `scripts/generate-fonts-json.js` (with `--base64` for portable, without for deploy) unless the `--skip-font-regen` flag is passed.
3.  **Copy Core Assets:** Copies essential files like `LICENSE.md`, `README.md`, `assets/`, and the contents of the `css/` and `js/` directories (including `ui-init.js`) to the target output directory.
4.  **Copy HTML Template:** Copies the correct source HTML template (`index.template.html` or `index-portable.template.html`) to the target output directory, renaming it to `index.html`.
5.  **Target-Specific Steps:**
    * **Deploy:** Runs `split-fonts.js`, copies the resulting `font-chunks/` directory and `fonts.json`.
    * **Portable:** Copies the `inline-fonts-data.js` file.

## Utility Scripts

* `npm run generate-fonts`: Manually run font generation without Base64 (for `deploy`).
* `npm run generate-fonts:base64`: Manually run font generation with Base64 (for `portable`).