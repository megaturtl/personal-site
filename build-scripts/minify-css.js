const esbuild = require('esbuild');

module.exports = {
  name: 'css',
  extension: 'css',
  compile: async function(content) {
    const result = await esbuild.transform(content, {
      loader: 'css',
      minify: true,
      sourcemap: false,
      target: ['chrome58', 'firefox57', 'safari11', 'edge16']
    });
    return result.code;
  }
}; 