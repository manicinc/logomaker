# Logomaker - Portable, Offline-First Logo Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen)](https://manicinc.github.io/logomaker/)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc)

Logomaker is a free, open-source logo generator packed with fonts and effects, designed with **extreme portability** and **offline-first** use at its core. Create dynamic logos anytime, anywhere – even without an internet connection!

Built by [Manic](https://manic.agency), a creative development shop. *(Logomaker also served as an experiment in Human+AI collaborative coding - see 'Development Insights' below).*

---

![Logomaker Preview](./preview.png)

---

## 🚀 Get Started

### Use Online (Quickest Preview)

➡️ **[Try the Live Demo: manicinc.github.io/logomaker/](https://manicinc.github.io/logomaker/)**

* **Important:** The online demo embeds all fonts for offline compatibility, causing a **very slow initial load (~90MB)**. Please be patient! See the note below ("A Note on Demo Performance") for details.*

### Run Locally (Recommended for Best Performance)

This method provides the optimal experience by loading fonts efficiently as needed.

1.  **Install Git LFS:** If you haven't already, install from [git-lfs.com](https://git-lfs.com).
2.  **Clone Repo & Pull LFS Files:**
    ```bash
    # Enable LFS for your user account (only need to do this once per system)
    git lfs install
    # Clone the repository
    git clone [https://github.com/manicinc/logomaker.git](https://github.com/manicinc/logomaker.git)
    cd logomaker
    # Download the large font files managed by LFS
    git lfs pull
    ```
3.  **(Optional) Generate `fonts.json`:** Only needed if you add/change fonts in the `/fonts` directory. Requires Node.js.
    ```bash
    node generate-fonts-json.js
    ```
4.  **Run a Local Web Server:** From within the `logomaker` directory:
    ```bash
    # Example using Python 3
    python -m http.server 8000
    # Or use VS Code Live Server, `npx serve`, or any other simple web server.
    ```
5.  **Open in Browser:** Navigate to `http://localhost:8000` (or your server's specific address).

### Run Locally (Single File, Offline Use)

This uses the embedded fonts for maximum portability (works without a server), but like the online demo, it will load slower initially than the local web server method.

1.  **Clone Repo & Pull LFS Files:** (Follow steps 1 & 2 from the 'Recommended' method above).
2.  **Generate Inline Font Data:** Requires Node.js. This command embeds the font data into `inline-fonts-data.js`.
    ```bash
    node generate-fonts-json.js --base64
    ```
3.  **Open HTML File:** Simply open the `index.html` file directly in your browser (e.g., using `File -> Open File`, or by double-clicking it). No server needed!
4.  **(Optional) Ultimate Single File:** For peak portability, you can copy the *entire generated content* of `inline-fonts-data.js` and paste it directly inside `index.html`, replacing the placeholder line `let _INLINE_FONTS_DATA = [];`. Now `index.html` truly contains everything.

---

## ✨ Features

Logomaker empowers you to create dynamic logos with:

* **🔤 Extensive Font Library:** Choose from ~400 fonts (available offline via embedding or loaded dynamically when run locally). Features adjustable size, weight, letter spacing, and case transforms. Includes font license display where available.
* **🌈 Vibrant Gradients:** Apply stunning gradients with up to 3 colors, select from diverse presets (like Cyberpunk, Sunset, Fire), or craft your own custom blend with full angle control.
* **✨ Dazzling Effects:** Elevate your text with glows (soft, neon), hard shadows, outlines, retro effects, emboss, and inset styles. Color is fully customizable.
* **🔲 Flexible Borders:** Frame your logo with various border styles including solid, dashed, dotted, double, pixelated, and even glowing borders.
* **🎬 Engaging Animations:** Bring your logo to life with subtle or dynamic animations like Pulse, Bounce, Float, Shake, Rotate, Glitch, and more, with adjustable speed.
* **🖼️ Versatile Backgrounds:** Choose from solid colors, custom/preset gradients (static or animated), or various patterns like grids, dots, stars, noise, synthwave, carbon fiber, and more. Control background opacity.
* **🎲 Randomize Style:** Spark creativity with a single click! Instantly apply random style combinations (effects, gradients, borders, animations, backgrounds) while keeping your text and font intact.
* **📦 Multiple Export Options:**
    * **SVG:** Get a clean, scalable vector file – the source of truth, including embedded fonts (if available) and CSS animations. Perfect for web and editing.
    * **PNG:** Export a high-quality, pixel-perfect raster image with optional transparency. Ideal for immediate use.
    * **Frames (ZIP):** Export your animation as a sequence of PNG frames, packaged with an HTML preview file and info text, ready for use in video editors or GIF creators.
* **⚙️ Advanced Control:** Fine-tune export dimensions, PNG quality, animation frame count, and preview display size. Access the generated CSS.
* **🔗 Shareable URLs:** Generate unique links that capture your exact logo configuration to easily share your designs. Includes QR code generation option (requires external library).
* **🚀 Ultra-Portable:** Designed to run entirely client-side. Works offline! Can be bundled into a single HTML file (see Getting Started).
* **🌓 Light/Dark Themes:** Adapts to your system preference or toggle manually.

---

## 🤔 A Note on Demo Performance & Embedded Fonts

The Logomaker online demo uses embedded Base64 fonts, resulting in a **very slow initial load time (~90MB)**. This approach was chosen based on these priorities:

1.  **Core Goal: Offline Single-File Portability:** Logomaker is designed to run as a **single HTML file directly from your computer** (`file:///...`), completely offline. Browser security restrictions block loading external font files in this mode, making **embedding the only way** to ensure all fonts are available for this primary use case.

2.  **Simplified Demo Maintenance:** To keep things manageable, the **GitHub Pages demo uses the *same* embedded-font version** that enables offline use. This ensures all fonts work reliably online and **avoids the overhead of creating and maintaining a separate, specially optimized build/deployment process** specifically for the demo (which would ideally load fonts differently).

**The Necessary Trade-Off:**

* Embedding ~400 fonts results in a **large application size (~90MB)**, causing the **significant initial loading delay** you'll experience on the GitHub Pages demo. We prioritize offline capability and simplified maintenance over the demo's startup speed. Please be patient when first loading it online.

**✅ Recommendation for Best Performance:**

* For actual day-to-day use and significantly faster loading, we **strongly recommend running Logomaker locally using a simple web server** (see "Getting Started - Run Locally (Recommended for Best Performance)"). This standard method loads fonts much more efficiently from the `/fonts` directory only when needed.

---

## 🛠️ Technical Insights

### Architecture

For a deeper dive into how Logomaker is structured internally, the components interact, and the rendering/export process works, please see the [**architecture.md**](./architecture.md) document.

### Font System

Fonts are managed via JSON data, either loaded from `fonts.json` (when using a local server) or from the embedded `_INLINE_FONTS_DATA` JavaScript variable (in offline/demo mode). This data structure defines display names, font families, variants (including weight, style, file path or Base64 data URL), available formats, and license file paths.

* **Font Format & Conversion:** WOFF2 is the preferred format for web compatibility due to its compression and wide support. If you add new fonts in other formats (like OTF/TTF), conversion is recommended. A utility script (`convert-fonts.sh`, requires `fonttools` and `brotli`) is provided to assist with batch conversion. For problematic fonts, online tools like the Font Squirrel Webfont Generator can also be helpful. Ensure converted fonts are placed in the `/fonts` directory relative to `index.html`.

### Development Process: An AI Collaboration Experiment

Logomaker also served as an internal experiment by Manic Agency to explore the capabilities and workflows of Human+AI collaborative coding (using models like GPT-4, Claude 3, Gemini Pro, circa early 2025).

* **AI Contribution:** LLMs were prompted to generate approximately 90% of the initial code structure, boilerplate logic, function implementations, and even provided debugging assistance throughout the process.
* **Human Direction:** Human developers provided the architectural vision, directed the AI through specific prompts, iteratively refined the output, performed rigorous testing and debugging, integrated disparate components, and ultimately ensured the final product was cohesive, functional, and met the design goals.

This project demonstrates the potential for AI to accelerate development while simultaneously underscoring the essential role of human expertise in design, architecture, critical testing, and integration needed to deliver a polished, reliable application.

---

## ⚠️ Known Limitations

* **CSS → SVG/PNG Fidelity:** Rendering complex CSS effects to raster (PNG) or vector (SVG) formats has limitations. Some features may be simplified or approximated:
    * **Effects:** Multi-layer `text-shadow` or advanced CSS `filter` functions are often approximated.
    * **Borders:** CSS styles like `double`, `groove`, `ridge`, `inset`, `outset`, and `border-image` (used for `border-pixel`) lack direct SVG equivalents and may render as solid or be omitted.
    * **Background Patterns:** CSS background patterns (`bg-grid`, `bg-noise`, etc.) are not currently exported as SVG `<pattern>` elements; only the underlying background color or gradient is rendered in SVG/PNG.
* **Animation Export Performance:** Generating a high number of frames (e.g., >30-50) for the ZIP export can be resource-intensive (CPU/memory) and may run slowly directly within the browser.
* **QR Code Generation:** Displaying the QR code image in the Share URL modal requires manually including an external QR code generation library (like `qrcode.min.js` from `davidshimjs.github.io/qrcodejs/`) in the HTML.

---

## ❤️ Support & Connect

If Logomaker sparks joy or helps your project, consider supporting its development!

[!["Sponsor"](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc) | [!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/manicinc) | [![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fmanicinc%2Flogomaker)](https://twitter.com/intent/tweet?text=Check%20out%20this%20awesome%20free,%20AI-enhanced%20logo%20maker%20tool!&url=https://manicinc.github.io/logomaker)

**Connect with Manic Agency:**

[![Website](https://img.shields.io/badge/Website-manic.agency-blue?style=flat-square&logo=firefox-browser)](https://manic.agency) | [![Email](https://img.shields.io/badge/Email-team%40manic.agency-red?style=flat-square&logo=gmail)](mailto:team@manic.agency) | [![GitHub](https://img.shields.io/badge/GitHub-manicinc-black?style=flat-square&logo=github)](https://github.com/manicinc) | [![Twitter](https://img.shields.io/badge/X%20(Twitter)-@manicagency-blue?style=flat-square&logo=x)](https://x.com/manicagency) | [![Twitter Follow](https://img.shields.io/twitter/follow/manicagency?style=social)](https://twitter.com/manicagency)

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.