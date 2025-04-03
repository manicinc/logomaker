# Logomaker by Manic.agency 🎨✨

Forge your brand's unique text-based identity instantly, right in your browser! Logomaker is a free, open-source logo generator packed with fonts, effects, and export options, designed with **extreme portability** and **offline-first** use in mind.

![Logomaker Preview](./preview.png)

**Live Demo**: <https://manicinc.github.io/logomaker/> (Free & Always Available!)

*(**Note on Demo Performance:** The GitHub Pages demo might load slowly initially. See "Why the Base64 Fonts?" below.)*

---

## ✨ Features at a Glance

Logomaker empowers you to create dynamic logos with:

* **🔤 Extensive Font Library:** Choose from ~400 embedded fonts (ensuring offline use) or load dynamically when run locally. Features adjustable size, weight, letter spacing, and case transforms. Includes font license display where available.
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
* **🔗 Shareable URLs:** Generate unique links that capture your exact logo configuration to easily share your designs. Includes QR code generation (requires external library).
* **🚀 Ultra-Portable:** Designed to run entirely client-side. Works offline! Can be bundled into a single HTML file (see Getting Started).
* **🌓 Light/Dark Themes:** Adapts to your system preference or toggle manually.

---

## 🤖 Human+AI Collaboration: An Experiment

Logomaker stands as a fascinating artifact of modern development workflows. It's an **experimental project** born from Manic Agency's exploration into **Human+AI collaborative coding**.

* Approximately **80%** of the code structure, boilerplate logic, initial function implementations, and even debugging assistance was provided by Large Language Models (LLMs).
* Key AI collaborators included models from the **GPT-4, Claude 3 (Opus/Sonnet), and Gemini Pro** families (versions as of early 2025; models evolve rapidly!).
* Crucially, the project was **directed, architected, refined, and rigorously debugged by human developers** at Manic Agency. The AI served as an incredibly powerful pair-programmer and accelerator, but human oversight was essential for coherence, bug fixing, feature integration, and achieving the final vision.

This project demonstrates the potential for rapid development while also underscoring the current need for human expertise in design, testing, and integration when working with AI code generation.

---

## 🤔 Why the Base64 Fonts & Performance Note?

The online demo embeds ~400 fonts directly into the application using Base64 encoding within `inline-fonts-data.js`.

**Why?**

1.  **Ultimate Portability:** This allows Logomaker to run as a single HTML file, completely offline, with zero external dependencies or need for a web server. Share the HTML file, and it just works. This aligns with Manic Agency's [PortaPack](https://github.com/manicinc/portapack) philosophy.
2.  **GitHub Pages Limitation:** GitHub Pages sometimes struggles with serving font files correctly, especially when stored using Git LFS. Embedding bypasses this.

**The Trade-off:**

* **Initial Load Time:** Loading hundreds of embedded fonts makes the *first* page load (especially on the GitHub Pages demo) significantly slower than loading standard font files from a server.
* **File Size:** The `inline-fonts-data.js` file or a fully bundled HTML file becomes large (~90MB).

**Recommendation:** For the best performance, run Logomaker locally using the "Web Server with External Font Data" method described below. For maximum portability and offline use, use the self-contained version with `inline-fonts-data.js` or the fully bundled HTML.

---

## 🚀 Getting Started

### Use Online (Easiest)

➡️ **Visit <https://manicinc.github.io/logomaker/>**

*(Be patient on the first load due to embedded fonts!)*

### Run Locally (Recommended for Performance)

**Option 1: Web Server (Fastest Load, Needs Server)**

1.  **Clone Repo & LFS:**
    ```bash
    # Install Git LFS: [https://git-lfs.com](https://git-lfs.com)
    git lfs install
    git clone [https://github.com/manicinc/logomaker.git](https://github.com/manicinc/logomaker.git)
    cd logomaker
    git lfs pull
    ```
2.  **Generate `fonts.json`:** (Lists fonts found in the `fonts/` directory)
    ```bash
    node generate-fonts-json.js
    ```
    *(Requires Node.js installed)*
3.  **Run Local Server:**
    ```bash
    # Example using Python 3
    python -m http.server 8000
    # Or use VS Code Live Server, etc.
    ```
4.  **Open:** <http://localhost:8000> (or your server's address) in your browser.

**Option 2: Self-Contained (Offline Use, Slower Load)**

1.  **Clone Repo & LFS:** (As above)
    ```bash
    git lfs install
    git clone [https://github.com/manicinc/logomaker.git](https://github.com/manicinc/logomaker.git)
    cd logomaker
    git lfs pull
    ```
2.  **Generate Inline Font Data:**
    ```bash
    # Creates fonts.json AND embeds fonts into inline-fonts-data.js
    node generate-fonts-json.js --base64
    ```
3.  **Run:** Simply open the `index.html` file directly in your browser (File -> Open File). It will automatically detect and use `inline-fonts-data.js`. No server needed!

**(Optional) Ultimate Single File:** Copy the entire content of the generated `inline-fonts-data.js` and paste it inside `index.html` where `let _INLINE_FONTS_DATA = [...]` is defined (currently empty array). Now `index.html` contains *everything*.

---

## ⚠️ Known Limitations

* **CSS → SVG Fidelity:** While we strive for accuracy, some complex CSS features may render differently or be simplified in SVG/PNG exports:
    * **Effects:** Multi-layer `text-shadow` or advanced CSS `filter` functions are approximated.
    * **Borders:** Styles like `double`, `groove`, `ridge`, `inset`, `outset`, and `border-image` (`border-pixel`) do not have direct SVG equivalents and may render as solid or be omitted.
    * **Backgrounds:** CSS background patterns (`bg-grid`, `bg-noise`, etc.) are not exported as SVG `<pattern>` elements; only the base background color/gradient is rendered.
* **Animation Export Performance:** Generating a high number of frames (e.g., >30) for the ZIP export can be resource-intensive (CPU/memory) and slow directly within the browser.
* **QR Code:** The Share URL modal requires an external QR code generation library (like `qrcode.min.js` from `davidshimjs.github.io/qrcodejs/`) to be included separately if you want the QR code image to appear.

---

## 🔤 Font System Details

*(Keep the Font Structure and Converting OTF sections as they were in the original README)*

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## ❤️ Support & Connect

If Logomaker sparks joy or helps your project, consider supporting its development!

[!["Sponsor"](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc) | [!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/manicinc) | [![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fmanicinc%2Flogomaker)](https://twitter.com/intent/tweet?text=Check%20out%20this%20awesome%20free,%20AI-enhanced%20logo%20maker%20tool!&url=https://manicinc.github.io/logomaker)

**Connect with Manic Agency:**

[![Website](https://img.shields.io/badge/Website-manic.agency-blue?style=flat-square&logo=firefox-browser)](https://manic.agency) | [![Email](https://img.shields.io/badge/Email-team%40manic.agency-red?style=flat-square&logo=gmail)](mailto:team@manic.agency) | [![GitHub](https://img.shields.io/badge/GitHub-manicinc-black?style=flat-square&logo=github)](https://github.com/manicinc) | [![Twitter](https://img.shields.io/badge/X%20(Twitter)-@manicagency-blue?style=flat-square&logo=x)](https://x.com/manicagency) | [![Twitter Follow](https://img.shields.io/twitter/follow/manicagency?style=social)](https://twitter.com/manicagency)