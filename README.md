# Logomaker by Manic.agency 🎨✨

![Logomaker Preview](./preview.png)

A sleek logo generator that allows you to create stunning logos directly in your browser. Designed for rapid development with extreme portability in mind.

**Live Demo**: https://manicinc.github.io/logomaker (Will load slowly at first, see below). Free forever hosted on GitHub pages (with limitations below)

## Note ⚠️

The online version hosted on GitHub Pages has much longer initial loading times compared to running Logomaker locally or on a different host. This is because all font data (over 400 fonts in this repo) is loaded client-side as Base64-encoded strings rather than standard font files (GitHub pages has issues rendering fonts from typical font files from LFS).

But the approach isn't just a workaround for GitHub Pages / LFS limitations - it's a deliberate design choice aligned with our core philosophy of **extreme portability** and **mania-driven development**. Logomaker directly supports embedding fonts into the application.

This allows for:

- **One-file wonder**: The entire application can run from a single HTML file
- **No server required**: Use it offline, on any device, anywhere
- **Zero dependencies**: No need for external font servers or CDNs
- **Ultimate shareability**: Email the file to clients or colleagues - it just works. Anybody can own the software fully-functional offline forever with no technical experience.

## Technologies Used 💻

- HTML, CSS, JavaScript (ES6)
- Google Fonts (as fallback)
- JSZip for packaging animation frames
- Git LFS for font file storage

## Project Status

[![Stars](https://img.shields.io/github/stars/manicinc/logomaker?style=social)](https://github.com/manicinc/logomaker/stargazers)
[![Forks](https://img.shields.io/github/forks/manicinc/logomaker?style=social)](https://github.com/manicinc/logomaker/network/members)
[![GitHub license](https://img.shields.io/github/license/manicinc/logomaker)](https://github.com/manicinc/logomaker/blob/main/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/manicinc/logomaker/graphs/commit-activity)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/manicinc/logomaker/pulls)

## Support This Project

If you find Logomaker useful, please consider supporting its development. Your support helps us maintain and improve this free tool!

[!["Sponsor"](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff69b4)](https://github.com/sponsors/manicinc)
[!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/manicinc)
[![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fmanicinc%2Flogomaker)](https://twitter.com/intent/tweet?text=Check%20out%20this%20awesome%20free%20logo%20maker%20tool!&url=https://manicinc.github.io/logomaker)

## Connect With Us

[![Website](https://img.shields.io/badge/Website-manic.agency-blue?style=flat-square&logo=firefox-browser)](https://manic.agency)
[![Email](https://img.shields.io/badge/Email-team%40manic.agency-red?style=flat-square&logo=gmail)](mailto:team@manic.agency)
[![GitHub](https://img.shields.io/badge/GitHub-manicinc-black?style=flat-square&logo=github)](https://github.com/manicinc)
[![Twitter](https://img.shields.io/badge/Twitter-@manicinc-blue?style=flat-square&logo=twitter)](https://twitter.com/manicinc)
<!-- [![LinkedIn](https://img.shields.io/badge/LinkedIn-Manic_Agency-blue?style=flat-square&logo=linkedin)](https://linkedin.com/company/manicinc) -->
<!-- [![Instagram](https://img.shields.io/badge/Instagram-@manicinc-purple?style=flat-square&logo=instagram)](https://instagram.com/manicinc) -->
<!-- [![YouTube](https://img.shields.io/badge/YouTube-Manic_Agency-red?style=flat-square&logo=youtube)](https://youtube.com/@manicinc) -->
<!-- [![Discord](https://img.shields.io/badge/Discord-Manic_Community-7289DA?style=flat-square&logo=discord)](https://discord.gg/your-invite-link) -->
<!-- [![Facebook](https://img.shields.io/badge/Facebook-Manic_Agency-blue?style=flat-square&logo=facebook)](https://facebook.com/manicinc) -->
<!-- [![Dev.to](https://img.shields.io/badge/Dev.to-manicinc-black?style=flat-square&logo=dev.to)](https://dev.to/manicinc) -->
<!-- [![Medium](https://img.shields.io/badge/Medium-Manic_Agency-black?style=flat-square&logo=medium)](https://medium.com/@manicinc) -->
<!-- 
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_ID?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/YOUR_INVITE_LINK) -->
[![Twitter Follow](https://img.shields.io/twitter/follow/manicinc?style=social)](https://twitter.com/manicinc)

Join our community to get help, share ideas, or contribute to the project!

## Features 💫

### Flexible Usage / Dependency Options 🤔

- Can load fonts dynamically fron `fonts/` folder, when running `index.html` from a web server (smallest size, fastest loadtime)

- Can load fonts from `inlines-fonts-data.js` file, generated from `generate-fonts-json.js`, so no web server is required (small size, slow loadtime)

- Ability to compile all data and assets in a single HTML file for portable usage (largest size, slow loadtime)

- Logomaker automatically adjusts how it optimizes / loads font files based on how you run it, so all you need to worry about is running the `index.html` file somewhere

### Text Customization 🔤

- Font selection from thousands of royalty-free web fonts
- Adjustable size, spacing, weight, and case

### Gradient Effects 🌈

- 12 preset gradient options
- Custom gradient creation with up to 3 colors
- Adjustable direction

### Text Effects ✨

- 10 different glow, outline, and texture effects including neon, retro, and emboss

### Border Styles 🔲

- 9 border styles including glowing, pixel, and more

### Animations 🎬

- 10 animation types including bounce, float, and glitch
- Customizable speed and direction

### Backgrounds 🖼️

- 12 background styles
- Includes grids, starfields, synthwave, and animated patterns

### Export Options 📦

- PNG (with transparency)
- SVG (vector-based snapshot)
- Animation Frames (multiple PNGs packaged in a ZIP)
- HTML and CSS code export

### Advanced Options ⚙️

- Custom dimensions
- Quality settings
- Custom CSS

## Getting Started 🚀

Want to get started immediately?

Just open `single_file_app.html` on any computer. Literally. That's it.

It may be a struggle to process the 60mb HTML file, but when it's finished loading, it should run like a breeze with **no** online connections / dependencies needed. 

### Use Online 🌐

Visit https://manicinc.github.io/logomaker to use the tool directly in your browser with all features enabled.

### Run Locally 💻

Two options are available for local usage:

#### Web Server with External Font Data

1. Clone the repository with Git LFS to fetch font files:

```bash
# Install Git LFS if you haven't already
git lfs install

# Clone the repository with LFS support
git clone https://github.com/manicinc/logomaker.git
```

2. Navigate to the project directory:

```bash
cd logomaker
```

3. Pull font files using Git LFS:

```bash
git lfs pull
```

4. Font files are organized in subfolders within the fonts directory:

```
fonts/
├── FontName1/
│   ├── FontName1-Regular.woff2
│   ├── FontName1-Bold.woff2
│   └── LICENSE.txt (optional)
├── FontName2/
│   ├── FontName2-Regular.woff2
│   └── ...
```

5. Generate the fonts.json file:

```bash
node generate-fonts-json.js
```

6. Start a local web server (e.g., using Python):

```bash
python -m http.server 8000
```

7. Open http://localhost:8000 in your browser

#### Self-Contained Version (Ultra-Portable) 🔥

1. Clone the repository with Git LFS:

```bash
git lfs install
git clone https://github.com/manicinc/logomaker.git
git lfs pull
```

2. Font files are already organized in the fonts directory

3. Run generate-fonts-json.js to create the fonts.json file and auto-generate the inline-fonts-data.js file with Base64-encoded fonts:

```bash
# One-step command to create both standard JSON and inline-fonts-data.js
node generate-fonts-json.js --base64
```

4. **🌟 Super-simple method:** Just place `inline-fonts-data.js` in the same directory as `index.html` - it will be automatically detected and loaded! You can now run `index.html` directly without a server.

5. **🌠 Ultimate single-file method:** For a truly portable solution, copy the contents from `inline-fonts-data.js` and paste it directly inside index.html where the `_INLINE_FONTS_DATA` variable is defined:

```javascript
// PASTE YOUR FONTS DATA HERE TO HAVE EVERYTHING CONTAINED IN ONE FILE WITH
// NO EXTERNAL DEPENDENCIES

let _INLINE_FONTS_DATA = [

];
```

Now you have a single, self-contained HTML file with everything included! 🎉 Just open index.html in any browser, even offline.

That's it! You now have one HTML file (~2000 lines) containing:
   - All the UI
   - All the CSS
   - All the JavaScript
   - All the fonts (embedded as Base64)

Perfect for:
- 📧 Emailing to clients
- 💾 USB drives
- ✈️ Offline usage
- 🚀 Quick demos

## Font System 🔤

### Font Structure
Fonts are defined in either fonts.json or the INLINE_FONTS_DATA variable with the following structure:
```json
{
  "displayName": "Univers LT Std",
  "familyName": "UniversLTStd",
  "variants": [
    {
      "name": "UniversLTStd-Regular",
      "weight": 400,
      "style": "normal",
      "file": "fonts/UniversLTStd/UniversLTStd-Regular.woff2",
      "format": "woff2",
      "fileSize": 25720
    },
    {
      "name": "UniversLTStd-Bold",
      "weight": 700,
      "style": "normal",
      "file": "fonts/UniversLTStd/UniversLTStd-Bold.woff2",
      "format": "woff2",
      "fileSize": 28456
    }
  ],
  "formats": ["woff2"],
  "licenseFile": "fonts/UniversLTStd/LICENSE.txt",
  "hasDefaultFont": true,
  "fontCount": 2,
  "totalSize": 54176
}
```

For Base64-encoded fonts, the `file` value will be a data URL instead of a file path:
```json
"file": "data:font/woff2;base64,d09GMgABAAAAAAm..."
```

### Converting OTF fonts to WOFF2 🔄

Web browsers have better support for WOFF2 font format. If you encounter font decoding errors (like "OTS parsing error: invalid sfntVersion"), convert your OTF fonts to WOFF2:

1. Install the required tools:
```bash
pip install fonttools brotli
```

2. Run this script to convert all OTF fonts in your directory:
```bash
./convert-fonts.sh
```

3. For problematic fonts, try the Font Squirrel Webfont Generator: https://www.fontsquirrel.com/tools/webfont-generator

4. Move / name your new fonts folder to `/fonts` where the `index.html` file is or where the scripts are if you're bundling it to one file.

## License 📄

MIT License
