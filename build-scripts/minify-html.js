const minifyHtml = require('@minify-html/node');

module.exports = {
  name: 'html',
  transform: function(content, outputPath) {
    if (!outputPath?.endsWith('.html')) return content;

    const cfg = {
      keep_spaces_between_attributes: true,
      keep_comments: false,
      minify_css: true,
      minify_js: true
    };

    const minified = minifyHtml.minify(Buffer.from(content), cfg);
    return minified.toString();
  }
}; 