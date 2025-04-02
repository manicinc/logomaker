// download.js
function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function setupDownloadButtons(previewElement) {
  const svgBtn = document.getElementById('download-svg');
  const pngBtn = document.getElementById('download-png');

  svgBtn.addEventListener('click', () => {
    const svgMarkup = generateSVGMarkup(previewElement);
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    triggerDownload(blob, 'logo.svg');
  });

  pngBtn.addEventListener('click', () => {
    saveAsPNG(previewElement, 'logo.png');
  });
}
