# Logomaker: AI-Enhanced Logo Generator (An Experiment in Vibe Coding ✨)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen)](https://manicinc.github.io/logomaker/) [![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc)

Logomaker is a free, open-source, client-side text logo generator featuring ~400 fonts, dynamic effects, and versatile export options. Designed for **extreme portability** and **offline-first use**, it leverages an optimized build process with intelligent font loading.

This project is more than just a tool; it's a **Human+AI collaborative coding experiment** developed by [Manic Agency](https://manic.agency). Roughly 90% of the codebase originated from AI (LLMs like GPT-4, Claude 3, Gemini families) guided by **technical prompt engineering** and refined through an **iterative collaborative development and testing process**. We call this exploration **"Vibe Coding"** – an attempt to harness AI for rapid development while maintaining robust engineering practices and a distinct creative workflow. It's a practical look at the potential and challenges of this emerging development paradigm, built by an agency focused on experimental tech (AR/VR, AI/ML, GenAI, Crypto, Game Design).

See the [Technical Deep Dive](#%EF%B8%8F-technical-deep-dive) and [architecture.md](./architecture.md) for more insights into the process and structure.

---

![Logomaker Preview](./preview.png)
---

## 🚀 Using Logomaker

Choose the version that best suits your needs:

**1. Live Demo (Online - Optimized Build)** ⚡

The fastest way to get started. Experience the web-optimized version with dynamic font loading.

➡️ **[Try Logomaker Online Now!](https://manicinc.github.io/logomaker/)**
* Uses the optimized build (`dist/github-pages`).
* Loads a small font index (~100KB) initially, then fetches font data chunks (`*.json`) on demand.
* Utilizes **IndexedDB** for persistent caching of downloaded font chunks, improving performance on subsequent visits.
* Requires an internet connection for the initial index and subsequent chunk downloads (unless cached or fully preloaded).
* **"Load All Fonts" option:** (Advanced tab) Fetches and caches the entire font library (~100MB+) into IndexedDB for complete offline use within the browser session.

**2. Portable Version (Offline - Single File or Folder)** 📦

Ideal for offline environments, workshops, or easy sharing.

* **Build it first:** Run `node scripts/build.js` or `node scripts/build.js --target=portable` locally (see instructions below).
* **Single File:** If `dist/portable/logomaker-portable.html` exists (requires the `portapack` dev dependency: `npm install -D portapack`), open this single file in any modern browser. All assets, including fonts (Base64 encoded), are embedded.
* **Folder:** If the single file wasn't generated, open `dist/portable/index.html` in your browser. It includes the necessary JS (`inline-fonts-data.js`) and works completely offline from `file:///`.
* *Note:* Expect a **significantly slower initial load** compared to the optimized version due to the large (~90-100MB) embedded font data.

**3. Building & Testing Locally (Dev Environment)** 🛠️

For developers modifying code, contributing, or generating specific builds.

* **Prerequisites:**
    * [Git](https://git-scm.com/downloads) installed.
    * [Git LFS](https://git-lfs.com) installed (`git lfs install --system`). *Crucial for pulling font files.*
    * [Node.js](https://nodejs.org/) (v18+ recommended) installed.
* **One-Time Setup:**
    ```bash
    # 1. Clone Repo
    git clone [https://github.com/manicinc/logomaker.git](https://github.com/manicinc/logomaker.git)
    cd logomaker

    # 2. Pull LFS Fonts (Essential!)
    git lfs pull

    # 3. Install Dev Dependencies (for build scripts, server, etc.)
    npm install
    # Or: npm ci (for deterministic builds based on package-lock.json)
    ```
* **The Build Script (`scripts/build.js` v2.3+):**
    * Run from the project root (`logomaker/`).
    * **Automatically cleans previous font artifacts** (`font-chunks/`, `inline-fonts-data.js`, `fonts.json`) on *every run* to ensure generated assets are fresh.
    * Uses flags to control output:
        ```bash
        # Build BOTH optimized & portable versions (Default)
        # Generates dist/github-pages/ and dist/portable/
        node scripts/build.js

        # Build ONLY the OPTIMIZED version (for GitHub Pages deployment)
        node scripts/build.js --target=deploy

        # Build ONLY the PORTABLE version (for offline use)
        node scripts/build.js --target=portable
        ```
* **Testing Locally with Auto-Serve:**
    * Requires `http-server` (`npx` will use it temporarily, or `npm install -g http-server`).
    * The `--serve` flag automatically runs the appropriate build target *first*.
    ```bash
    # Test the OPTIMIZED (Chunked) version locally
    # Builds & serves dist/github-pages/ on http://localhost:3000 (No Caching)
    node scripts/build.js --serve

    # Test the PORTABLE (Embedded) version locally
    # Builds & serves dist/portable/ on http://localhost:3000 (No Caching)
    node scripts/build.js --serve --portable
    ```
    *(Use Ctrl+C in the terminal to stop the local server)*.

**4. Desktop App (Future Goal)** 🖥️
* Potential future direction: Wrap Logomaker using **Electron** for a native desktop experience.

---

## ✨ Features Overview

* **🔤 Massive Font Library:** ~400 fonts available. Dynamically loaded online (chunked w/ IndexedDB caching) or fully embedded offline. Control size, weight, spacing, case. View font licenses.
* **"Load All Fonts" option:** (Advanced tab) Download and cache the entire font library (~100MB+) into IndexedDB for full offline access in the browser.
* **🌈 Vibrant Gradients:** Apply multi-color gradients with presets or full customization.
* **✨ Dazzling Effects:** Enhance text with glows, shadows, outlines, retro styles, emboss, inset effects – all color-customizable.
* **🔲 Flexible Borders:** Frame logos with various styles (solid, dashed, pixelated, glowing). *Note: Complex borders simplified in SVG exports.*
* **🎬 Engaging Animations:** Apply subtle animations (Pulse, Bounce, Glitch, etc.). Control speed. Included directly in SVG exports via CSS!
* **🖼️ Versatile Backgrounds:** Solids, gradients (static/animated), patterns (grids, noise, synthwave). Control opacity.
* **🎲 Randomize Style:** Spark creativity by instantly applying random styles while preserving your text.
* **↔️ Text Alignment:** Standard Left, Center, Right controls.
* **📦 Pro Export Options:**
    * **SVG:** Clean, scalable vectors. Embeds fonts (via `@font-face` data URLs) & CSS animations. Ideal for web/editing.
    * **PNG:** High-quality raster images with optional transparency. Control resolution and quality.
    * **Frames (ZIP):** Animation sequence as individual PNG frames + HTML preview.
* **⚙️ Fine-Tuned Control:** Adjust export dimensions, PNG quality, animation frames, preview scaling. Access generated CSS.
* **🔗 Shareable URLs:** Generate unique links capturing your exact design state.
* **🚀 Optimized & Portable:** Runs entirely client-side. Dual build modes tailor loading for speed (online) or offline self-sufficiency.
* **🌓 Light/Dark Themes:** Adapts to system preference or toggle manually.
* **♿ Accessibility:** Basic focus indicators & keyboard navigation support.

---

## 🤔 Performance & Loading: Optimized vs. Portable

Logomaker employs distinct loading strategies tailored for different use cases:

* **Optimized Version (`dist/github-pages` / Live Demo):**
    * **Mechanism:** Uses **Font Chunking**. `fontManager.js` loads a small `index.json` (~100KB) containing font metadata. When a font is needed, its specific data chunk (`a-f.json`, `g-m.json`, etc.) is fetched from the `./font-chunks/` directory. Downloaded chunks are cached in **IndexedDB** for persistence. `@font-face` rules are injected dynamically.
    * **Pros:** ✅ **Fast initial load** online. ✅ Efficient bandwidth usage (only load needed fonts). ✅ Persistent caching via IndexedDB.
    * **Cons:** Requires a web server. Needs an internet connection for uncached fonts.
* **Portable Version (`dist/portable`):**
    * **Mechanism:** **Embeds all font data** (Base64 encoded, ~90-100MB+) directly into `inline-fonts-data.js` or bundles everything into a single HTML file using `portapack`. `fontManager.js` detects this embedded data (`window._INLINE_FONTS_DATA`) and uses it directly.
    * **Pros:** ✅ Works **completely offline** from anywhere (web server, `file:///`). ✅ Single file option for ultimate portability.
    * **Cons:** ⚠️ **Very slow initial load** and high memory usage due to the large embedded data blob.

**The build script (`node scripts/build.js`) handles the complexities of generating both modes.**

---

## 🛠️ Technical Deep Dive: The "Vibe Coding" Experiment

Logomaker's development was a deliberate exploration of **Human+AI Collaborative Coding**, termed "Vibe Coding".

* **Process:** Involved defining requirements and architecture, then using **technically-guided prompt engineering** with LLMs to generate initial code structures, functions, and UI elements. This was followed by rigorous **human testing, debugging, refactoring, and integration**. No significant function was purely hand-written; AI provided the initial drafts or suggestions, which were then iteratively refined.
* **Goal:** To investigate if this collaborative "vibe" could accelerate development while producing a reasonably complex, functional application. It highlights the strengths of AI in boilerplate generation and exploring implementation options, alongside the indispensable role of human expertise in architecture, validation, and ensuring robustness.
* **Architecture:** See [**architecture.md**](./architecture.md) for a breakdown of components, the rendering flow, and more on the Human+AI model.
* **Font System (`fontManager.js`):** The core of the loading logic.
    * Handles adaptive loading (chunked/embedded/fallback).
    * Manages **IndexedDB** caching (primary cache, TTL based) with graceful fallbacks and cleanup logic. Uses localStorage as a secondary, simpler cache if needed or during specific error conditions (though IndexedDB is preferred).
    * Performs Just-in-Time `@font-face` injection into `<style id="dynamic-font-style">`.
    * Includes network fetch retries and progress event dispatching (`LOADING_STARTED`, `LOADING_PROGRESS`, `LOADING_COMPLETE`).
    * See [**fontmanager.md**](./fontmanager.md) for the detailed API.
* **Build & Font Preparation (`scripts/`):**
    * `build.js`: Orchestrates the build process, generating deploy (chunked) and portable (embedded) targets. Enforces cleaning of font artifacts.
    * `generate-fonts-json.js`: Scans `./fonts` (requires Git LFS pull), extracts metadata, generates `fonts.json` (metadata only), `inline-fonts-data.js` (with optional Base64 data URLs for portable build), and crucially, `css/generated-font-classes.css` which provides utility classes (e.g., `.font-family-orbitron`) for applying fonts.
    * `split-fonts.js`: Takes the `inline-fonts-data.js` (with full font data) and splits it into the alphabetical chunks (`a-f.json`, etc.) and the `index.json` required for the optimized build's `fontManager.js`.
    * Font Conversion: WOFF2 is the preferred format for web use. `scripts/convert-fonts.sh` (requires `fonttools`) can be used for batch conversion if adding new font source files (TTF/OTF).

---

## ⚠️ Known Limitations & Future Ideas

* **CSS ➡️ Export Fidelity:** Complex CSS effects (especially advanced filters, masks, intricate backgrounds/borders) may render differently or be simplified in SVG/PNG exports compared to the live browser preview.
* **Animation Export:** Generating many PNG frames (>50-100) for the ZIP export can be slow and memory-intensive in the browser.
* **Future Polish:** More robust font weight/style validation, better text overflow handling, additional effects/animations/patterns, improved theming capabilities.
* **Electron App:** Wrapping the application for native desktop use remains a potential future enhancement.
* **QR Codes:** Requires manually uncommenting and including an external library (`davidshimjs-qrcodejs`) in `index.html` for the Share URL modal QR code functionality.

---

## ❤️ Support & Connect

Find Logomaker useful or intriguing? Consider supporting its development and future experiments!

[!["Sponsor"](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc) | [!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/manicinc) | [![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fmanicinc%2Flogomaker)](https://twitter.com/intent/tweet?text=Exploring%20Logomaker%20-%20a%20free,%20offline-first%20logo%20tool%20built%20via%20Human%2BAI%20'Vibe%20Coding'!&url=https%3A%2F%2Fmanicinc.github.io%2Flogomaker)

**Connect with Manic Agency:** (Experimental Design & Development: AR/VR, AI/ML/GenAI, Crypto, Game Design)

[![Website](https://img.shields.io/badge/Website-manic.agency-blue?style=flat-square&logo=firefox-browser)](https://manic.agency) | [![Email](https://img.shields.io/badge/Email-team%40manic.agency-red?style=flat-square&logo=gmail)](mailto:team@manic.agency) | [![GitHub](https://img.shields.io/badge/GitHub-manicinc-black?style=flat-square&logo=github)](https://github.com/manicinc) | [![Twitter](https://img.shields.io/badge/X%20(Twitter)-@manicagency-blue?style=flat-square&logo=x)](https://x.com/manicagency) | [![Twitter Follow](https://img.shields.io/twitter/follow/manicagency?style=social)](https://twitter.com/manicagency)

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

🚀 Crafted by [Manic Agency](https://manic.agency)
