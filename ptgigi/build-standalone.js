const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'styles.css');
const jsPath = path.join(root, 'js', 'app.js');
const outPath = path.join(root, 'ptgigi-standalone.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const jsRaw = fs.readFileSync(jsPath, 'utf8');

// Escape closing tags inside payloads to prevent early termination
const cssSafe = css.replace(/<\/style>/g, '<\\/style>');
const jsSafe = jsRaw.replace(/<\/script>/g, '<\\/script>');

let out = html;
out = out.replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${cssSafe}\n</style>`);
out = out.replace('<script type="module" src="js/app.js"></script>', `<script>\n${jsSafe}\n</script>`);

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath, 'bytes=', out.length);