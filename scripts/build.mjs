import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: ['safari17','chrome120'], outfile: 'dist/app.js' });
console.log('Built threadPod in dist/');

