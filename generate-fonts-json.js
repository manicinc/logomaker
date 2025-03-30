/**
 * generate-fonts-json.js
 *
 * Scans the ./fonts/ directory for subfolders containing font files.
 * Extracts weight/style from filenames and supports multiple font formats.
 * Creates comprehensive metadata for better font loading performance.
 * 
 * Features:
 * - Optional Base64 encoding for fully portable single-file HTML
 * - Enhanced weight/style detection
 * - Support for multiple font formats
 * - License file inclusion
 *
 * Usage:
 *    node generate-fonts-json.js            # Standard JSON output
 *    node generate-fonts-json.js --base64   # With Base64 encoded font data
 */

const fs = require('fs');
const path = require('path');

// Process command line arguments
const args = process.argv.slice(2);
const includeBase64 = args.includes('--base64');

// Enhanced weight detection with numeric mapping
function guessWeight(filename) {
  const lower = filename.toLowerCase();
  
  // Map common weight names to their numeric values
  const weightMap = {
    'thin': 100,
    'hairline': 100,
    'extralight': 200,
    'ultralight': 200,
    'light': 300,
    'regular': 400,
    'normal': 400,
    'book': 400,
    'medium': 500,
    'semibold': 600,
    'demibold': 600,
    'bold': 700,
    'extrabold': 800,
    'ultrabold': 800,
    'black': 900,
    'heavy': 900,
    'extrablack': 950,
    'ultrablack': 950
  };

  // Check for numeric weight in filename (e.g., "OpenSans-600.otf")
  const numericWeight = lower.match(/[-_](\d{3})[-_.]/);
  if (numericWeight && numericWeight[1]) {
    const weight = parseInt(numericWeight[1], 10);
    if (weight >= 100 && weight <= 950) {
      return weight;
    }
  }

  // Check for named weights
  for (const [name, value] of Object.entries(weightMap)) {
    // Use word boundaries to avoid partial matching
    if (lower.includes(`-${name}`) || lower.includes(`_${name}`) || 
        lower.includes(`${name}-`) || lower.includes(`${name}_`) ||
        lower.includes(` ${name} `)) {
      return value;
    }
  }

  // Default weight for unrecognized patterns
  return 400;
}

// Enhanced style detection
function guessStyle(filename) {
  const lower = filename.toLowerCase();
  
  if (lower.includes('italic')) return 'italic';
  if (lower.includes('oblique')) return 'oblique';
  
  return 'normal';
}

// Function to capitalize words properly for display names
function formatDisplayName(name) {
  // Replace dashes and underscores with spaces
  const spacedName = name.replace(/[-_]/g, ' ');
  
  // Capitalize first letter of each word
  return spacedName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Function to get MIME type based on font extension
function getMimeType(extension) {
  const mimeTypes = {
    'otf': 'font/otf',
    'ttf': 'font/ttf',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'eot': 'application/vnd.ms-fontobject'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Convert file to Base64 with appropriate MIME type
function convertFileToBase64(filePath, format) {
  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  const mimeType = getMimeType(format);
  
  return `data:${mimeType};base64,${base64Data}`;
}

// Check if a path exists and is a directory
function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (error) {
    return false;
  }
}

function generateFontsJson() {
  const fontsDir = path.join(__dirname, 'fonts');
  if (!isDirectory(fontsDir)) {
    console.error(`Error: "fonts" folder not found at ${fontsDir}`);
    process.exit(1);
  }

  // Array to collect font families
  const fontFamilies = [];
  let totalFileSize = 0;
  let base64Size = 0;

  // Get all subdirectories
  const subdirs = fs.readdirSync(fontsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log(`Found ${subdirs.length} font directories to process...`);
  
  if (includeBase64) {
    console.log('Base64 encoding enabled - this may take a moment...');
  }

  subdirs.forEach((subdir, index) => {
    const folderName = subdir.name;
    const folderPath = path.join(fontsDir, folderName);
    
    console.log(`Processing [${index + 1}/${subdirs.length}]: ${folderName}`);

    // Arrays to store font variants and formats
    const variants = [];
    let licenseFile = null;
    let licenseText = null;
    const formats = new Set();

    // Read all files in the subdirectory
    const files = fs.readdirSync(folderPath);
    
    // First pass: identify font files and license
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const ext = path.extname(file).toLowerCase();
      const supportedFormats = ['.otf', '.ttf', '.woff', '.woff2', '.eot'];
      
      if (supportedFormats.includes(ext)) {
        // Record which formats this font family has
        const format = ext.substring(1); // Remove the dot
        formats.add(format);
        
        // Get file size statistics
        const stats = fs.statSync(filePath);
        totalFileSize += stats.size;
        
        // Get weight and style
        const weight = guessWeight(file);
        const style = guessStyle(file);
        
        // Get the basename without extension for display
        const baseName = path.basename(file, ext);
        
        // Create variant object
        const variant = {
          name: baseName,
          weight,
          style,
          format,
          fileSize: stats.size
        };
        
        // For Base64 encoding, read the file and encode it
        if (includeBase64) {
          variant.file = convertFileToBase64(filePath, format);
          base64Size += variant.file.length;
        } else {
          variant.file = path.posix.join('fonts', folderName, file);
        }
        
        variants.push(variant);
      } else if (file.toLowerCase().includes('license') || file.toLowerCase() === 'readme.md') {
        licenseFile = path.posix.join('fonts', folderName, file);
        
        // If Base64 is enabled, also include the license text directly
        if (includeBase64) {
          try {
            licenseText = fs.readFileSync(filePath, 'utf-8');
          } catch (err) {
            licenseText = `Unable to read license file: ${err.message}`;
          }
        }
      }
    });

    // Determine displayName and familyName
    const displayName = formatDisplayName(folderName);
    const familyName = folderName.replace(/\s+/g, ''); // CSS family name without spaces
    
    // Sort variants by weight and style
    variants.sort((a, b) => {
      if (a.weight !== b.weight) {
        return a.weight - b.weight;
      }
      return a.style === 'normal' ? -1 : 1;
    });

    // Create the font family object with enhanced metadata
    const familyObj = {
      displayName,
      familyName,
      variants,
      formats: Array.from(formats),
      hasDefaultFont: variants.some(v => v.weight === 400 && v.style === 'normal'),
      fontCount: variants.length,
      totalSize: variants.reduce((sum, v) => sum + v.fileSize, 0)
    };
    
    // Add license information
    if (licenseFile) {
      familyObj.licenseFile = licenseFile;
    }
    
    if (licenseText) {
      familyObj.licenseText = licenseText;
    }

    fontFamilies.push(familyObj);
  });

  // Sort font families alphabetically
  fontFamilies.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Create metadata object for the whole collection
  const fontData = {
    metadata: {
      generated: new Date().toISOString(),
      familyCount: fontFamilies.length,
      totalFonts: fontFamilies.reduce((sum, family) => sum + family.fontCount, 0),
      totalFileSize: totalFileSize,
      base64Encoded: includeBase64,
      formatSummary: {},
      weightSummary: {}
    },
    fonts: fontFamilies
  };
  
  // Build format and weight summaries
  const allFormats = new Set();
  const weightCounts = {};
  
  fontFamilies.forEach(family => {
    // Count formats
    family.formats.forEach(format => allFormats.add(format));
    
    // Count weights
    family.variants.forEach(variant => {
      const weight = variant.weight;
      weightCounts[weight] = (weightCounts[weight] || 0) + 1;
    });
  });
  
  // Format summary
  const formatSummary = {};
  allFormats.forEach(format => {
    formatSummary[format] = fontFamilies.filter(f => f.formats.includes(format)).length;
  });
  fontData.metadata.formatSummary = formatSummary;
  
  // Weight summary
  fontData.metadata.weightSummary = Object.fromEntries(
    Object.entries(weightCounts).sort(([a], [b]) => parseInt(a) - parseInt(b))
  );
  
  // Set output path and write file
  const outputPath = path.join(__dirname, 'fonts.json');
  fs.writeFileSync(outputPath, JSON.stringify(fontData, null, 2), 'utf-8');
  
  // Print summary information
  console.log('\nSummary:');
  console.log(`- Generated fonts.json with ${fontFamilies.length} font families`);
  console.log(`- Total font files: ${fontData.metadata.totalFonts}`);
  console.log(`- Total size: ${(totalFileSize / (1024 * 1024)).toFixed(2)} MB`);
  
  if (includeBase64) {
    console.log(`- Base64 encoded size: ${(base64Size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Encoding ratio: ${(base64Size / totalFileSize).toFixed(2)}x`);
  }
  
  console.log(`- Detected font formats: ${Array.from(allFormats).join(', ')}`);
  
  // Create a direct INLINE_FONTS_DATA variable for easy copying
  const inlineVariable = `let INLINE_FONTS_DATA = ${JSON.stringify(fontFamilies, null, 2)};`;
  const inlinePath = path.join(__dirname, 'inline-fonts-data.js');
  fs.writeFileSync(inlinePath, inlineVariable, 'utf-8');
  
  console.log(`\nCreated inline-fonts-data.js for easy copy-paste into index.html`);
  console.log(`Done!`);
}

// Run the generator
generateFontsJson();