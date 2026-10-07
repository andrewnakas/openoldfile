#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) that every URL
// in the built sitemap may have changed. Run after a deploy; the key file
// /<key>.txt must already be live.
//
//   node scripts/indexnow.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const host = new URL(SITE.origin).host;

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: SITE.indexNowKey, keyLocation: `${SITE.origin}/${SITE.indexNowKey}.txt`, urlList })
});
// 200 = accepted, 202 = accepted while the key is being checked.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (res.status >= 400) {
  console.warn(await res.text());
  process.exitCode = 1;
}
