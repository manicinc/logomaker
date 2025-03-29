#!/bin/bash

# Create output directory
mkdir -p converted_fonts

# Use find to locate all .otf files
find ./fonts -type f -name "*.otf" | while read -r font_file; do
    # Extract the relative path and filename
    rel_path="${font_file#./fonts/}"
    dir_name=$(dirname "$rel_path")
    base_name=$(basename "$rel_path" .otf)
    
    # Create target directory
    mkdir -p "converted_fonts/$dir_name"
    
    # Define output file path
    output_file="converted_fonts/$dir_name/$base_name.woff2"
    
    echo "Converting: $font_file"
    echo "      To: $output_file"
    
    # Run conversion (with error handling)
    if python -m fontTools.ttLib.woff2 compress "$font_file" -o "$output_file" 2>/dev/null; then
        echo "✓ Success"
    else
        echo "✗ Failed to convert $font_file - trying alternative method"
        # Alternative conversion method (some fonts need different handling)
        if python -c "
from fontTools.ttLib import TTFont
try:
    font = TTFont('$font_file')
    font.flavor = 'woff2'
    font.save('$output_file')
    print('✓ Converted with alternative method')
except Exception as e:
    print(f'✗ Error: {e}')
    exit(1)
"; then
            echo "✓ Alternative conversion successful"
        else
            echo "✗ Both conversion methods failed for $font_file"
        fi
    fi
    echo "-----------------------"
done

echo "Conversion process complete. Check the 'converted_fonts' directory."