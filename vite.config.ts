import { defineConfig, build, type Plugin } from 'vite'
import { resolve } from 'node:path'

const target = process.env.TARGET ?? 'chrome'
const outDir = `dist/${target}`
const define = { __TARGET__: JSON.stringify(target) }

// Content scripts and Safari service workers cannot be ES modules, so each gets its
// own IIFE build after the main one; configFile:false stops it recursing into this file.
function iifeEntry(name: string, entry: string): Plugin {
  return {
    name: `vimplug-${name}`,
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        define,
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: resolve(entry),
            formats: ['iife'],
            name: 'vimplug',
            fileName: () => `${name}.js`,
          },
        },
      })
    },
  }
}

export default defineConfig({
  define,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: { options: resolve('options.html') },
      output: { entryFileNames: '[name].js', assetFileNames: '[name].[ext]' },
    },
  },
  plugins: [
    iifeEntry('content', 'src/content/runtime.ts'),
    iifeEntry('background', 'src/background/index.ts'),
    ...(target === 'safari' ? [iifeEntry('bootstrap', 'src/content/bootstrap.ts')] : []),
  ],
})
