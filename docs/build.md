# Building Logomaker

This document details the build process for the Logomaker application, explaining the different targets, scripts, outputs, and the use of HTML templates.

## Overview

The build system uses Node.js scripts (`scripts/build.js`, `scripts/generate-fonts-json.js`, `scripts/split-fonts.js`) to process the source code, fonts, and assets into deployable versions suitable for different environments (web hosting vs. offline/Electron use). It relies on HTML template files (`index.template.html`, `index-portable.template.html`) located in the project root, which are processed by the build script to generate the final `index.html` for each target.

The system aims for optimized loading while ensuring offline/portable functionality works correctly. Development dependencies are managed via `package.json` but are not required for running the built application.

## Build Commands (via npm)

The primary way to trigger builds is through npm scripts defined in `package.json`:

* **`npm run build` or `npm run build:deploy`**
    * Builds the **deploy** target.
    * Output: `./dist/github-pages/`
    * Optimized version intended for web hosting (like GitHub Pages). Uses `index.template.html`.

* **`npm run build:portable`**
    * Builds the **portable** target.
    * Output: `./dist/portable/`
    * Self-contained version designed for offline use or packaging with Electron. Uses `index-portable.template.html`.

* **`npm run build:electron`**
    * Runs `npm run clear-cache` (attempts to clear Electron's runtime cache).
    * Runs `npm run build:portable` to generate the necessary web assets.
    * Runs `electron-builder` to package the contents of `dist/portable/` into an Electron application for the current platform (output in `release/`). Does **not** publish to GitHub.

* **`npm run release:electron`**
    * Runs `npm run clear-cache`.
    * Runs `npm run build:portable`.
    * Runs `electron-builder --publish always` to package the Electron application and **publish** it as a release to GitHub (requires `GH_TOKEN` environment variable or appropriate GitHub Actions token).

These scripts orchestrate calls to the underlying Node.js scripts (`scripts/clear-cache.js`, `scripts/build.js`) with appropriate arguments.

## Build Targets

### 1. `deploy` Target (Default / Web Optimized)

* **Purpose:** Optimized for deployment to static web hosts (e.g., GitHub Pages, Netlify, Vercel).
* **Command:** `npm run build:deploy`
* **Source HTML:** `index.template.html`
* **Output:** `dist/github-pages/` (includes `index.html` generated from the source template)
* **Characteristics:**
    * **Font Handling:** Uses **Font Chunking**.
        * Runs `scripts/build.js` which internally calls:
            * `scripts/generate-fonts-json.js` (without `--base64`) to create temporary font metadata (`inline-fonts-data.js`) used as input for splitting, and `fonts.json` (URL-based metadata).
            * `scripts/split-fonts.js` which creates:
                * A small `font-chunks/index.json` (list of fonts for initial dropdown).
                * Multiple `font-chunks/*.json` files containing font metadata, split alphabetically. These chunks include **both** relative URLs (e.g., `../fonts/FontFile.woff2`) and Base64 data URLs.
        * Copies the generated `font-chunks/` directory to the output directory.
        * Copies the source `fonts/` directory (containing `.woff2` etc.) to the output directory (needed for the relative URLs in the chunks).
        * Copies `fonts.json` (URL metadata) to the output directory.
    * **HTML:** Copies `index.template.html` to `dist/github-pages/index.html`.
    * **Loading:** `fontManager.js` loads `font-chunks/index.json` first, then dynamically fetches required chunk `.json` files as needed. It will likely prioritize loading fonts via the relative `url` from the chunk data, falling back to Base64 (`dataUrl`) if needed or configured. Chunks and successfully loaded fonts are cached in IndexedDB for subsequent visits.
    * **Result:** Optimized initial page load and bandwidth usage (fonts loaded on demand). Requires a web server.

### 2. `portable` Target (Offline / Electron)

* **Purpose:** Designed to run entirely offline from the local filesystem (`file:///`) or when packaged within an Electron application.
* **Command:** `npm run build:portable`
* **Source HTML:** `index-portable.template.html`
* **Output:** `dist/portable/` (A directory containing `index.html` and all required assets)
* **Characteristics:**
    * **Font Handling:** Uses **Font Chunking (Locally)**.
        * Runs `scripts/build.js` which performs the **same font generation and splitting process as the `deploy` target**:
            * Calls `scripts/generate-fonts-json.js` (without `--base64`).
            * Calls `scripts/split-fonts.js` to create the `font-chunks/` directory (containing `index.json` and `*.json` chunk files with URL+Base64 data) in the project root.
        * Copies the generated `font-chunks/` directory into the output directory (`dist/portable/font-chunks/`).
        * Copies the source `fonts/` directory into the output directory (`dist/portable/fonts/`).
        * Optionally copies `inline-fonts-data.js` (generated without base64) as a potential fallback, though it's not the primary loading mechanism.
    * **HTML:** Copies `index-portable.template.html` to `dist/portable/index.html`. This template might include `<script src="inline-fonts-data.js"></script>` for fallback purposes, but the app primarily relies on the chunks.
    * **Loading:** `fontManager.js` uses the **same chunked loading mechanism** as the deploy target. It loads `font-chunks/index.json` first, then dynamically fetches required chunk `.json` files from the local `font-chunks/` directory as needed. It uses the relative `url`s within the chunks (pointing to the local `fonts/` directory) which work via the `file://` protocol in Electron, or potentially falls back to the `dataUrl`s. Fonts are cached in IndexedDB.
    * **Result:** Fully self-contained directory that works offline. All necessary font files and chunk metadata are included locally. This is the required input for `electron-builder`.

## Electron Builds

* The Electron application is built using `electron-builder`.
* The configuration for `electron-builder` is located in the `build` section of `package.json`.
* The `files` array within the `build` configuration specifies what gets included in the final Electron package. Critically, it includes `"dist/portable/**/*"`, ensuring all assets generated by the `npm run build:portable` command (including `index.html`, `js/`, `css/`, `assets/`, `fonts/`, and `font-chunks/`) are bundled into the app.
* The `npm run build:electron` script builds the application locally without publishing.
* The `npm run release:electron` script builds the application and publishes it to GitHub Releases.
* Both Electron build scripts now run `npm run clear-cache` first to attempt removing old Electron runtime cache directories, helping to prevent issues caused by stale cached application code.

## Core Build Steps (`scripts/build.js`)

Regardless of the target, `scripts/build.js` (v3.11+) performs these steps:

1.  **Clean Target Directory:** Removes the previous content of the specific output directory (`dist/github-pages` or `dist/portable`).
2.  **Generate Font Assets (Conditional):** Runs `scripts/generate-fonts-json.js` (always *without* `--base64`) unless `--skip-font-regen` is passed. Creates `inline-fonts-data.js` (input for splitter) and `fonts.json`.
3.  **Split Font Chunks (Conditional):** Runs `scripts/split-fonts.js` using `inline-fonts-data.js` as input, creating the `font-chunks/` directory (with `index.json` and `*.json` data chunks) in the project root, unless `--skip-font-regen` is passed (in which case it expects the chunks to exist).
4.  **Copy HTML Template:** Copies the correct source HTML template (`index.template.html` or `index-portable.template.html`) to the target output directory, renaming it to `index.html`.
5.  **Copy Core Assets:** Copies essential files like `LICENSE.md`, `assets/`, and the contents of the `css/` and `js/` directories to the target output directory.
6.  **Target-Specific Asset Copying:**
    * **Deploy:** Copies `font-chunks/`, `fonts/`, and `fonts.json` to `dist/github-pages/`.
    * **Portable:** Copies `font-chunks/`, `fonts/`, and optionally `inline-fonts-data.js` to `dist/portable/`.

## Utility Scripts

* `npm run generate-fonts`: Manually run font generation (creates `inline-fonts-data.js` without base64, `fonts.json`, `generated-font-classes.css`). Useful if you only want to update these without splitting or copying.
* `npm run clear-cache`: Manually attempts to clear the Electron runtime cache for the application.