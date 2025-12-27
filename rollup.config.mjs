import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
  // Browser UMD (for script tag)
  {
    input: 'src/browser/index.js',
    output: {
      file: 'dist/browser/zenux-oauth.umd.js',
      format: 'umd',
      name: 'ZenuxOAuth',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ 
        browser: true,
        exportConditions: ['browser']
      }),
      commonjs(),
      terser()
    ],
    onwarn: (warning, warn) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  },

  // Browser ESM (for modern bundlers)
  {
    input: 'src/browser/index.js',
    output: {
      file: 'dist/browser/zenux-oauth.esm.js',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ 
        browser: true,
        exportConditions: ['browser']
      }),
      commonjs()
    ],
    onwarn: (warning, warn) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  },

  // Server CommonJS
  {
    input: 'src/server/index.js',
    output: {
      file: 'dist/server/index.cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ 
        preferBuiltins: true,
        exportConditions: ['node']
      }),
      commonjs()
    ],
    external: ['node-fetch', 'undici', 'crypto']
  },

  // Server ESM
  {
    input: 'src/server/index.js',
    output: {
      file: 'dist/server/index.mjs',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve({ 
        preferBuiltins: true,
        exportConditions: ['node']
      }),
      commonjs()
    ],
    external: ['node-fetch', 'undici', 'crypto']
  },

  // Core CommonJS
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/core/index.cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },

  // Core ESM
  {
    input: 'src/core/index.js',
    output: {
      file: 'dist/core/index.mjs',
      format: 'es',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },

  // Main entry point - auto-detecting
{
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'es',
    exports: 'named',
    sourcemap: true,
    entryFileNames: 'index.js',
    chunkFileNames: 'chunks/[name]-[hash].js'
  },
  plugins: [
    resolve({
      exportConditions: ['browser', 'node', 'import', 'require']
    }),
    commonjs()
  ],
  onwarn: (warning, warn) => {
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    warn(warning);
  }
}

];
