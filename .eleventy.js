const minifyHtml = require('./build-scripts/minify-html');
const minifyJs = require('./build-scripts/minify-js');
const minifyCss = require('./build-scripts/minify-css');
const analyseAssets = require('./build-scripts/analyse-assets').analyseAssets;

module.exports = function(eleventyConfig) {
  // Environment variables
  const isProd = process.env.ELEVENTY_ENV === 'production';

  // Asset handling
  if (isProd) {
    // In production, minify CSS and JS before copying
    eleventyConfig.addPassthroughCopy({
      "src/assets/favicons": "assets/favicons"
    });

    // Process CSS
    eleventyConfig.addTemplateFormats(minifyCss.extension);
    eleventyConfig.addExtension(minifyCss.extension, {
      outputFileExtension: minifyCss.extension,
      compile: async function(content) {
        return async () => minifyCss.compile(content);
      }
    });

    // Process JS
    eleventyConfig.addTemplateFormats(minifyJs.extension);
    eleventyConfig.addExtension(minifyJs.extension, {
      outputFileExtension: minifyJs.extension,
      compile: async function(content) {
        return async () => minifyJs.compile(content);
      }
    });

    // HTML Minification
    eleventyConfig.addTransform("htmlmin", minifyHtml.transform);

    // Analyse and copy only used images in production
    const imageManifest = analyseAssets();
    imageManifest.used.forEach(image => {
      eleventyConfig.addPassthroughCopy({
        [`src/assets/images/${image}`]: `assets/images/${image}`
      });
    });
  } else {
    // In development, just copy assets and add source maps
    eleventyConfig.addPassthroughCopy({
      "src/assets": "assets"
    });
  }

  // Watch target for all assets
  eleventyConfig.addWatchTarget("./src/assets/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk"
  };
}; 