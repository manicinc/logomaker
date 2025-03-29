# Logomaker by Manic 🎨✨

![Logomaker Preview](./preview.png)

A sleek logo generator that allows you to create stunning logos directly in your browser. Designed for rapid development with extreme portability in mind.

**Live Demo**: https://manicinc.github.io/logomaker

Free forever hosted on GitHub pages

## Portability Features 🚀

Logomaker is designed to be exceptionally portable, maniacally even:

- **Single-File Option**: The entire application can be bundled into one HTML file. The entire UI and styles IS one HTML file! 

- **No Server Required**: Use it offline, on any device with a modern browser

## Features 💫

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

### Use Online 🌐

Visit https://manicinc.github.io/logomaker to use the tool directly in your browser with all features enabled.

### Run Locally 💻

Two options are available for local usage:

#### Option 1: Web Server with External Font Data

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

#### Option 2: Self-Contained Version (Ultra-Portable) 🔥

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

5. **🌠 Ultimate single-file method:** For a truly portable solution, copy the contents from `inline-fonts-data.js` and paste it directly inside index.html where the `INLINE_FONTS_DATA` variable is defined:

```javascript
const INLINE_FONTS_DATA = [
  // Paste the entire array from inline-fonts-data.js here!
  // This replaces the placeholder content
];
```

Now you have a single, self-contained HTML file with everything included! 🎉 Just open index.html in any browser, even offline.

## Creating a Single-File Portable Version 📱

To make Logomaker even more portable, follow these steps for the "Manic Edition" (everything in one file!):

1. Generate Base64-encoded fonts:
```bash
node generate-fonts-json.js --base64
```

2. Copy the entire array from `inline-fonts-data.js` into index.html's `INLINE_FONTS_DATA` variable

3. That's it! You now have one HTML file (~2000 lines) containing:
   - All the UI
   - All the CSS
   - All the JavaScript
   - All the fonts (embedded as Base64)

Perfect for:
- 📧 Emailing to clients
- 💾 USB drives
- ✈️ Offline usage
- 🚀 Quick demos

The entire application in one file - no servers, no dependencies, no hassle!

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

## Technologies Used 💻

- HTML, CSS, JavaScript (ES6)
- Google Fonts (as fallback)
- JSZip for packaging animation frames
- Git LFS for font file storage

## License 📄

MIT License

## Contact 📬

- Manic Agency: https://manic.agency
- Project Link: https://github.com/manicinc/logomaker