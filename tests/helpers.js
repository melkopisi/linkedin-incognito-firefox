import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
export const rules = () => JSON.parse(readFileSync(new URL('../rules/view-signal.json', import.meta.url), 'utf8'));
export const gz = (text) => new Uint8Array(gzipSync(Buffer.from(text)));
export const split = (bytes, at) => [bytes.slice(0, at), bytes.slice(at)];
