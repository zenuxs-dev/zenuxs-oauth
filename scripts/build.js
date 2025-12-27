const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Building zenuxs-oauth...');

// Clean dist directory
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy callback.html if it exists
const callbackSrc = path.join(__dirname, '..', 'callback.html');
const callbackDest = path.join(distDir, 'callback.html');
if (fs.existsSync(callbackSrc)) {
  fs.copyFileSync(callbackSrc, callbackDest);
  console.log('✓ Copied callback.html');
}

// Create minimal package.json for dist
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const distPkg = {
  name: pkg.name,
  version: pkg.version,
  main: './index.js',
  types: './index.d.ts',
  exports: {
    ".": {
      "import": "./index.js",
      "require": "./index.js"
    },
    "./server": {
      "import": "./server/index.js",
      "require": "./server/index.js"
    }
  }
};

fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(distPkg, null, 2));

console.log('✅ Build setup complete!');
console.log('\nNote: For full build with rollup, run: npx rollup -c rollup.config.mjs');