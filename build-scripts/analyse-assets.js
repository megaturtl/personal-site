const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  sourceDir: 'src',
  imageDir: 'src/assets/images',
  patterns: {
    images: ['**/*.{png,jpg,jpeg,gif,svg,webp}'],
    sources: [
      '**/*.{njk,html,css,js}',
      '!node_modules/**',
      '!_site/**'
    ]
  }
};

// Get all image files
function getAllImages() {
  return glob.sync(CONFIG.patterns.images, {
    cwd: CONFIG.imageDir,
    nodir: true
  });
}

// Find image references in file content
function findImageReferences(content) {
  const references = new Set();
  
  // Match various ways images might be referenced
  const patterns = [
    /url\(['"]?([^'")\s]+\.(?:png|jpg|jpeg|gif|svg|webp))['"]?\)/gi, // CSS url()
    /src=['"]([^'"]+\.(?:png|jpg|jpeg|gif|svg|webp))['"]/gi,         // HTML/Nunjucks src
    /['"](?:\.\.\/)*assets\/images\/([^'"]+\.(?:png|jpg|jpeg|gif|svg|webp))['"]/gi // Relative paths
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const imagePath = match[1];
      references.add(imagePath.replace(/^\/assets\/images\//, ''));
    }
  });

  return Array.from(references);
}

// Scan all source files for image references
function findUsedImages() {
  const usedImages = new Set();
  
  // Get all source files
  const sourceFiles = glob.sync(CONFIG.patterns.sources, {
    cwd: CONFIG.sourceDir,
    nodir: true
  });

  // Scan each file for image references
  sourceFiles.forEach(file => {
    const content = fs.readFileSync(path.join(CONFIG.sourceDir, file), 'utf8');
    const references = findImageReferences(content);
    references.forEach(ref => usedImages.add(ref));
  });

  return Array.from(usedImages);
}

// Generate the image manifest
function generateManifest() {
  const allImages = getAllImages();
  const usedImages = findUsedImages();
  
  return {
    used: usedImages,
    unused: allImages.filter(img => !usedImages.includes(img)),
    total: allImages.length,
    usedCount: usedImages.length
  };
}

module.exports = {
  analyseAssets: function() {
    const manifest = generateManifest();
    
    if (process.env.ELEVENTY_ENV === 'development') {
      console.log('\nImage Analysis Results:');
      console.log('----------------------');
      console.log(`Total images: ${manifest.total}`);
      console.log(`Used images: ${manifest.usedCount}`);
      console.log(`Unused images: ${manifest.unused.length}`);
    }
    
    return manifest;
  }
}; 