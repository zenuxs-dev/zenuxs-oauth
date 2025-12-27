import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple build that copies source files
async function buildSimple() {
  console.log('📦 Building simple distribution...');
  
  const distDir = path.join(__dirname, 'dist-simple');
  
  // Clean and create dist
  try {
    await fs.rm(distDir, { recursive: true, force: true });
  } catch {}
  await fs.mkdir(distDir, { recursive: true });
  
  // Copy source files
  const filesToCopy = [
    'src/index.js',
    'src/core/index.js',
    'src/core/client.js',
    'src/core/errors.js',
    'src/core/pkce.js',
    'src/core/urls.js',
    'src/core/tokens.js',
    'src/browser/index.js',
    'src/browser/client.js',
    'src/browser/storage.js',
    'src/browser/flows.js',
    'src/browser/utils.js',
    'src/server/index.js',
    'src/server/client.js',
    'src/server/flows.js',
    'src/server/utils.js'
  ];
  
  for (const file of filesToCopy) {
    try {
      const dest = path.join(distDir, file);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(path.join(__dirname, file), dest);
      console.log(`✓ Copied ${file}`);
    } catch (error) {
      console.log(`⚠️  Could not copy ${file}: ${error.message}`);
    }
  }
  
  // Create package.json
  const pkg = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    type: 'module',
    main: './src/index.js',
    exports: {
      ".": {
        "import": "./src/index.js",
        "require": "./src/index.js"
      },
      "./server": {
        "import": "./src/server/index.js",
        "require": "./src/server/index.js"
      },
      "./browser": {
        "import": "./src/browser/index.js",
        "require": "./src/browser/index.js"
      },
      "./core": {
        "import": "./src/core/index.js",
        "require": "./src/core/index.js"
      }
    }
  };
  
  await fs.writeFile(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );
  
  console.log('\n✅ Simple build complete!');
  console.log(`Output: ${distDir}`);
}

buildSimple().catch(console.error);