import { context } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
const builder = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['obsidian'],
  outfile: 'dist/main.js',
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
  logLevel: 'info',
});
await Promise.all(['manifest.json', 'styles.css'].map(name => copyFile(name, `dist/${name}`)));
if (process.argv.includes('--watch')) {
  await builder.watch();
} else {
  await builder.rebuild();
  await builder.dispose();
}
