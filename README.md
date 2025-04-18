# Logomaker: Portable, Offline Logos with Self-Managed Fonts Library (An Experiment in ✨ Vibe Coding ✨ and Human-Computer Interaction)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen)](https://manicinc.github.io/logomaker/) [![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc)

Logomaker is a free, open-source, zero-dependency client-side logo generator featuring ~400 fonts, dynamic effects, and versatile export options. Designed for **portability** and offering an **offline-first option**, it leverages an optimized build process with intelligent font loading, allowing users to easily manage a large font library.

This project is more than just a tool; it's a **Human+AI collaborative coding experiment** developed by [Manic Agency](https://manic.agency). Over 90% of the codebase originated from AI (LLMs like GPT-4, Claude 3, Gemini families) guided by **technical prompt engineering** and refined through an **iterative collaborative development and testing process**, or **✨ Vibe Coding ✨** – an attempt to harness AI for rapid development while maintaining robust engineering practices and a distinct creative workflow. **Every single function** was written by a LLM using their respective web UIs (no CLI or API), testing how each organization implements conversational memory and meta-analysis to give appropriate responses, and what their limitations were.

It's a practical look at the potential and challenges of this emerging development paradigm, built by an agency focused on experimental tech (AR/VR, AI/ML, GenAI, Crypto, Game Design). See the [Technical Deep Dive](https://manic.agency/blog/logomaker-an-experiment-in-human-computer-interaction-vibe-coding) for more insights into the process and structure.

---

![Logomaker Preview](./docs/preview.png)

---

## ✨ Features Overview

* **🔤 Extensive Font Library:** ~400 fonts available by default. Dynamically loaded online (chunked w/ IndexedDB caching) or fully embedded for offline use, with font licensing support. See [fontmanager.md](./docs/fontmanager.md).
* **🎬 Full Vector Animation Support:** Apply subtle animations (Pulse, Bounce, Glitch, etc.). Control speed. Included directly in SVG exports via embedded CSS!
* **📦 Pro Export Options:**
    * **SVG:** Clean, scalable vectors. Reliably embeds fonts (via Base64 `@font-face` data URLs extracted from loaded data) & CSS animations. Ideal for web/editing.
    * **PNG:** High-quality raster images with optional transparency. Control resolution.
    * **Frames (ZIP):** Animation sequence as individual PNG frames + HTML preview (Note: Captures static render, not CSS animation over time).
* **🔗 Shareable URLs:** Generate unique links capturing your exact design state (feature may depend on deployment environment).

## 🚀 Getting Started

Choose the version that best suits your needs:

**1. Live Demo (Online - Optimized Build)** ⚡

The fastest way to get started online. Experience the web-optimized version with dynamic font loading and reliable SVG export.

➡️ **[Try Logomaker Online Now!](https://manicinc.github.io/logomaker/)**
* Uses the optimized `deploy` build (`dist/github-pages`).
* Loads a small `index.json` (~100KB) initially.
* Fetches font data chunks (`*.json`, now containing both URL and Base64 data) on demand as you select fonts. Chunks are cached in IndexedDB.
* Supports SVG font embedding.

**2. Portable Version (Offline - Folder)** 📦

Ideal for offline environments, workshops, or easy sharing as a self-contained folder.

* **Build it first:** Run `npm run build:portable` locally (see instructions below). This creates the `dist/portable/` directory.
* **Run:** Open the `index.html` file inside the `dist/portable/` directory in any modern browser (can be opened directly from the filesystem via `file:///`). All assets, including fonts (Base64 encoded in `inline-fonts-data.js`), are self-contained.
* *Note:* Expect a **significantly slower initial load time** compared to the optimized online version due to the large (~50-100MB+) embedded font data script that needs to be parsed. Supports SVG font embedding.

## Background

From conception, this was designed as a lightweight client-side application. While it requires Node.js and npm for the development environment and build process, the final built outputs (`deploy` and `portable` targets) aim for minimal runtime dependencies. The goal is a tool that can be easily deployed online or used offline (via the portable build), embedding a full extendable font library with flexible loading options. We use a standard `package.json` for managing dev dependencies like `chokidar` and `http-server`, keeping the build process streamlined. The core application logic resides in `index.html` and static assets in `css/` and `js/`. Fonts are stored in `fonts/` (managed via Git LFS), with various build options dictating how these assets are processed and served.

## 🛠️ Local Development

### Prerequisites

* [Git](https://git-scm.com/downloads)
* [Git LFS](https://git-lfs.com) (Initialize **before** cloning or pull **after** cloning)
* [Node.js](https://nodejs.org/) (v18+ recommended)

### Usage

```bash
# 1. Clone the repository
git clone [https://github.com/manicinc/logomaker.git](https://github.com/manicinc/logomaker.git)
cd logomaker

# 2. Pull Git LFS files (the fonts) - CRITICAL STEP
git lfs pull

# 3. Install development dependencies (http-server, chokidar)
npm install

# 4. Run Development Server (Builds 'deploy' target, Watches, Serves @ http://localhost:3000)
#    Supports SVG Embedding via Hybrid Chunks
npm run dev
# (After initial build, edit code, save, then manually refresh browser)
# (Press Ctrl+C to stop)

# 5. Run Production Preview (Builds 'deploy' target, Serves @ http://localhost:3001 - No Watch)
npm run preview
# (Press Ctrl+C to stop)

# 6. Manual Builds (Output to ./dist/ folder)
npm run build          # Build deploy target (default) -> ./dist/github-pages/
npm run build:deploy   # Build deploy target -> ./dist/github-pages/
npm run build:portable # Build portable target -> ./dist/portable/ (directory)
```

See development.md for more info on development mode.

See release.md for more info on the release process for potential Electron app packaging.

The repository is set up to automatically build and deploy the deploy target to GitHub Pages via the .github/workflows/deploy-gh-pages.yml. The live GitHub Pages files reside in the gh-pages branch: https://github.com/manicinc/logomaker/tree/gh-pages.

## 🛠️ Building the Project

Logomaker offers two primary build targets managed by node scripts/build.js:

1. **deploy (Default)**: Creates a web-optimized build in ./dist/github-pages/. Uses font chunking (with hybrid URL+Base64 data) for balanced performance and full SVG embedding support. Ideal for web hosting. Run with npm run build:deploy or npm run build.
2. **portable**: Creates a self-contained build in ./dist/portable/. Embeds all font data using Base64 in inline-fonts-data.js for complete offline use. Ideal for local file usage or packaging (e.g., Electron). Run with npm run build:portable.

The project uses a lightweight Node.js build process with no external bundling dependencies like Webpack or Rollup. See build.md for details.

## 🤔 Performance & Loading: Optimized vs. Portable

Logomaker employs distinct loading strategies tailored for different use cases:

**Optimized (deploy) Version (dist/github-pages / Live Demo):**
- **Mechanism**: Uses Hybrid Font Chunking. fontManager.js loads a small index.json (~100KB) containing font metadata. When a font is needed, its specific data chunk (a-f.json, g-m.json, etc., containing both URLs and Base64 data) is fetched from the ./font-chunks/ directory. Downloaded chunks are cached in IndexedDB. @font-face rules are injected dynamically, preferring the URL for efficient browser rendering. SVG export uses the Base64 data from the loaded chunk for reliable embedding.
- **Pros**: ✅ Fast initial page load. ✅ Reliable SVG font embedding. ✅ Browser display uses efficient URL-based loading. ✅ Persistent chunk caching via IndexedDB.
- **Cons**: ⚠️ Requires a web server. ⚠️ Needs network access for uncached chunks/font files. ⚠️ Chunk files (*.json) are significantly larger than URL-only versions due to included Base64 data.

**Portable Version (dist/portable):**
- **Mechanism**: Embeds all font data (Base64 encoded) directly into inline-fonts-data.js. fontManager.js detects this embedded data (window._INLINE_FONTS_DATA) and uses it directly for both browser display and SVG embedding.
- **Pros**: ✅ Works completely offline. ✅ Self-contained directory. ✅ Reliable SVG font embedding.
- **Cons**: ⚠️ Very slow initial load and high memory usage due to the large (~50-100MB+) embedded data script.

The build script (node scripts/build.js) handles generating the correct assets for each mode.

## Random Styles

The Randomize Style feature intelligently generates combinations for rapid exploration and inspiration (press the R key to use it). Core text is preserved while other settings are guided by weighted probabilities favoring common styles. It incorporates coherence rules to prevent visual clashes and employs intelligent value generation (HSL color theming, proportional sizing) for usable starting points.

## 🛠️ Technical Deep Dive: The "Vibe Coding" Experiment

Logomaker's development was a deliberate exploration of Human+AI Collaborative Coding, termed "Vibe Coding".

- **Process**: Involved defining requirements, then using technically-guided prompt engineering with LLMs (GPT-4, Claude 3, Gemini) to generate initial code structures, functions, and UI elements. This was followed by rigorous human testing, debugging, refactoring, and integration. AI provided drafts; human expertise provided architecture, validation, and robustness.
- **Goal**: To investigate accelerating development via AI collaboration while producing a complex, functional application. It highlights AI's strength in generation and exploration, alongside the essential human role in ensuring quality and coherence.
- **Architecture**: See architecture.md for a component breakdown and more on the Human+AI model.

## ⚠️ Known Limitations & Future Ideas

- **CSS ➡️ Export Fidelity**: Complex CSS effects may render differently or be simplified in SVG/PNG exports compared to the live browser preview.
- **Animation Frame Export**: Generating many PNG frames for the ZIP export remains slow and memory-intensive. Currently captures static render, not animation over time.
- **Future Polish**: More font validation, better text overflow handling, additional effects/animations, improved theming.
- **Electron App**: Packaging for native desktop use is a potential future enhancement.

## ❤️ Support & Connect

Find Logomaker useful or intriguing? Consider supporting its development and future experiments!

Connect with Manic Agency: (Experimental Design & Development: AR/VR, AI/ML/GenAI, Crypto, Game Design)
[https://manic.agency](https://manic.agency)

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.
