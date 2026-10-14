import { mkdir, readdir, copyFile, access, rm } from 'node:fs/promises';
import { extname } from 'node:path';

const source = new URL('./outputs/study-room-mvp/', import.meta.url);
const output = new URL('./dist/', import.meta.url);
const assets = [
  'snow-study-window-v2.png', 'sea-sharp-v2.png', 'sea-study.png',
  'rain-library.png', 'forest-natural-v3.png', 'wild-clean-v3.png',
  'avatar-crayon-atlas.png', 'study-companion.png',
  'study-companion-adult.png', 'sheep-walk.png', 'qiye-ocean-brand.png'
];
// Fail on missing media instead of publishing a visually broken demo.
for (const name of assets) await access(new URL(`assets/${name}`, source));
await rm(output, { recursive: true, force: true });
await mkdir(new URL('assets/', output), { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isFile() && ['.html', '.css', '.js'].includes(extname(entry.name))) {
    await copyFile(new URL(entry.name, source), new URL(entry.name, output));
  }
}
for (const entry of await readdir(new URL('assets/', source), { withFileTypes: true })) {
  if (entry.isFile() && (assets.includes(entry.name) || entry.name.endsWith('.svg') || entry.name.toLowerCase().includes('license'))) {
    await copyFile(new URL(`assets/${entry.name}`, source), new URL(`assets/${entry.name}`, output));
  }
}
console.log('Static build complete. Only frontend files and runtime images included; no audio, credentials or database files.');
