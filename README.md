# Logomaker by Manic

![Logomaker Preview](./preview.png)

A free, open-source logo generator that allows you to create stunning logos directly in your browser. Designed for rapid development with extreme portability in mind.

**Live Demo**: https://manicinc.github.io/logomaker

## Portability Features

Logomaker is designed to be exceptionally portable:

- **Single-File Option**: The entire application can be bundled into one HTML file
- **No Server Required**: Use it offline, on any device with a modern browser
- **Self-Contained**: Bundle fonts directly into the HTML file with INLINE_FONTS_DATA
- **Easy Sharing**: Send just one file to clients or team members

For ultra-portability, use the self-contained version with inline fonts - perfect for designers on the go or quick client demos.

## Features

### Text Customization
- Font selection from thousands of royalty-free web fonts
- Adjustable size, spacing, weight, and case

### Gradient Effects
- 12 preset gradient options
- Custom gradient creation with up to 3 colors
- Adjustable direction

### Text Effects
- 10 different glow, outline, and texture effects including neon, retro, and emboss

### Border Styles
- 9 border styles including glowing, pixel, and more

### Animations
- 10 animation types including bounce, float, and glitch
- Customizable speed and direction

### Backgrounds
- 12 background styles
- Includes grids, starfields, synthwave, and animated patterns

### Export Options
- PNG (with transparency)
- SVG (vector-based snapshot)
- Animation Frames (multiple PNGs packaged in a ZIP)
- HTML and CSS code export

### Advanced Options
- Custom dimensions
- Quality settings
- Custom CSS

## Getting Started

### Use Online
Visit https://manicinc.github.io/logomaker to use the tool directly in your browser with all features enabled.

### Run Locally
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

#### Option 2: Self-Contained Version (Ultra-Portable)

1. Clone the repository with Git LFS:
```bash
git lfs install
git clone https://github.com/manicinc/logomaker.git
git lfs pull
```
2. Font files are already organized in the fonts directory
3. Run generate-fonts-json.js to create the fonts.json file:
```bash
# For standard JSON output
node generate-fonts-json.js

# For Base64-encoded fonts (recommended for portability)
node generate-fonts-json.js --base64
```
4. Copy the contents of fonts.json or use the generated inline-fonts-data.js file
5. Paste the font data into the INLINE_FONTS_DATA variable in index.html:
```javascript
const INLINE_FONTS_DATA = [
  {
    "displayName": "Font Name",
    "familyName": "FontName",
    "variants": [
      {
        "weight": 400,
        "style": "normal",
        "file": "fonts/FontName/FontName-Regular.woff2"
      }
    ],
    "licenseFile": "fonts/FontName/LICENSE.txt"
  }
];
```
6. For maximum portability, you can include font data as Base64:
```javascript
const INLINE_FONTS_DATA = [
  {
    "displayName": "Font Name",
    "familyName": "FontName",
    "variants": [
      {
        "weight": 400, 
        "style": "normal",
        "file": "data:font/woff2;base64,YOUR_BASE64_ENCODED_FONT_HERE"
      }
    ]
  }
];
```
7. Open the index.html file directly in your browser - no server needed!

## Creating a Single-File Portable Version

To make Logomaker even more portable, you can create a completely self-contained version that requires only a single HTML file:

1. Follow the steps in "Option 2: Self-Contained Version" above
2. Convert your font files to Base64 using the --base64 flag with generate-fonts-json.js
3. The CSS is already inline in the HTML file
4. For JS libraries, use CDN links or embed them directly in the HTML

This creates a "Manic Edition" - one massive HTML file (~2000 lines) that contains everything needed to run the application. Perfect for:
- Emailing to clients
- USB drives
- Offline usage
- Quick demos

The entire application in one file - no servers, no dependencies, no hassle!

## Font System

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

### Generating Font Data
The included generate-fonts-json.js script scans your font directories and creates a fonts.json file:
```bash
# Standard format with file paths
node generate-fonts-json.js

# Base64-encoded fonts for portability
node generate-fonts-json.js --base64
```

## Usage Guide

### Basic Logo Creation
1. Enter text in the "Logo Text" field
2. Choose a font from the dropdown
3. Adjust font size, spacing, and case
4. Select a gradient preset or create a custom gradient
5. Apply text effects, animations, and backgrounds
6. Export your logo

### Tab Navigation
The interface is organized into five tabs for easier navigation:
- **Text**: Configure logo text, font, size, and spacing
- **Style**: Apply gradient presets, text glow effects, and border styles
- **Animation**: Choose animation types and adjust their properties
- **Background**: Select background styles and opacity
- **Advanced**: Adjust export settings and view generated CSS

### Advanced Options
- Custom CSS generation for using your logo elsewhere
- Export with custom dimensions and quality settings
- Animation frame adjustment for exports
- Transparent background toggle

## Export Options

### PNG Export
- Download static PNG image
- Transparency options
- Custom width/height and quality settings
- 2x scale factor for crisp results

### SVG Export
- Download vector-based snapshot
- Ideal for scalable graphics
- Note: Some CSS effects may appear as raster filters

### Animation Frames Export
- Download multiple PNG frames packaged in a ZIP file
- Adjustable frame count for smoother animations
- Perfect for creating your own animated GIFs or videos
- Progress indicator during export

### Code Export
- Copy HTML snippet to use in your projects
- Copy CSS snippet for styling integration

## Troubleshooting

### Tab Navigation Issues
If tabs aren't working:
1. Make sure JavaScript is enabled in your browser
2. Check browser console for any errors
3. Try refreshing the page
4. Ensure no JavaScript conflicts with other extensions

### Font Loading Issues
If fonts aren't loading properly:
1. Check if fonts.json exists and is valid
2. When using Base64-encoded fonts, verify the data URLs are complete
3. Look for console errors related to font loading
4. Try using different formats (WOFF2 is recommended for best compression)

### Export Issues
- For large dimensions, give the export process time to complete
- If animation export fails, try reducing the number of frames or size
- Some browsers may have limitations on file sizes or memory usage

## Known Issues
- Animation frame export may be slow with many frames or large dimensions
- Some animation effects may not render correctly in SVG export
- Safari may have issues with certain CSS effects

## Technologies Used
- HTML, CSS, JavaScript (ES6)
- Google Fonts (as fallback)
- html-to-image for exports
- JSZip for packaging animation frames
- Git LFS for font file storage

## Font Storage
This project uses Git Large File Storage (LFS) to manage font files efficiently:

- All font files (*.woff2, *.ttf, *.otf) are stored using Git LFS
- This keeps the repository size manageable while providing access to high-quality fonts
- Font files are tracked in .gitattributes and stored on LFS servers
- When you clone with Git LFS support, font files are downloaded automatically

To view currently tracked file patterns:
```bash
git lfs track
```

If you're having issues with font files, make sure Git LFS is properly installed and try:
```bash
git lfs pull --include="fonts/*"
```

## Contributing
1. Fork the repository
2. Install Git LFS if you haven't already:
```bash
git lfs install
```
3. Clone your forked repository with LFS support:
```bash
git clone https://github.com/yourusername/logomaker.git
git lfs pull
```
4. Create a new branch
5. Commit changes
6. When adding new fonts, track them with Git LFS:
```bash
git lfs track "*.woff2"
git lfs track "*.ttf"
git lfs track "*.otf"
git add .gitattributes
```
7. Push to your branch
8. Open a Pull Request

## License
MIT License

## Contact
- Manic Agency: https://manic.agency
- Project Link: https://github.com/manicinc/logomaker