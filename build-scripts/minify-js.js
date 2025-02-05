const esbuild = require('esbuild');

module.exports = {
  name: 'js',
  extension: 'js',
  compile: async function(content) {
    const result = await esbuild.transform(content, {
      loader: 'js',
      minify: true,
      sourcemap: false,
      target: ['chrome58', 'firefox57', 'safari11', 'edge16']
    });
    return result.code;
  }
}; 