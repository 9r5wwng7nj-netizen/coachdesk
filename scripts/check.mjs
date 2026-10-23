#!/usr/bin/env node
// Static safety check — no browser needed.
//  1. Every app script parses, alone and together (classic scripts share one global scope,
//     so a let/const name used in two files breaks the whole app).
//  2. No top-level function is declared twice (the later one silently wins).
//  3. No action name is defined in two action tables (A, A_*) unless it is an intentional override.
//  4. Runtime scripts and styles are local, not loaded from a CDN.
//  5. index.html loads every file in js/, and sw.js caches every file the app needs.
//  6. Every Lucide icon name used exists in the pinned bundle.
// Usage: node scripts/check.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
let failed = false;
const fail = msg => { failed = true; console.error(`✗ ${msg}`); };
const ok = msg => console.log(`✓ ${msg}`);

const html = read('index.html');
const loaded = [...html.matchAll(/<script src="\.\/(js\/[\w-]+\.js)"><\/script>/g)].map(m => m[1]);
const sources = loaded.map(p => [p, read(p)]);

// 1. Syntax
for (const [p, src] of sources) { try { new Function(src); } catch (e) { fail(`${p}: ${e.message}`); } }
try { new Function(sources.map(([, s]) => s.replace(/^'use strict';/, '')).join('\n;\n')); } catch (e) { fail(`scripts together: ${e.message}`); }
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
inline.forEach((src, i) => { try { new Function(src); } catch (e) { fail(`inline script #${i + 1}: ${e.message}`); } });
if (!failed) ok(`${sources.length} app scripts and ${inline.length} inline script parse, alone and together`);

// 2. Duplicate top-level function declarations
const fnCount = {};
for (const [, src] of sources) for (const m of src.matchAll(/^(?:async )?function ([A-Za-z0-9_$]+)\s*\(/gm)) fnCount[m[1]] = (fnCount[m[1]] || 0) + 1;
const dupFns = Object.entries(fnCount).filter(([, n]) => n > 1).map(([k]) => k);
if (dupFns.length) fail(`functions declared more than once: ${dupFns.join(', ')}`); else ok(`${Object.keys(fnCount).length} top-level functions, no duplicates`);

// 3. Action-name collisions across action tables, merged in app.js with Object.assign(A, A_LIB, …).
const INTENTIONAL = new Set([]);
const owner = {};
for (const [p, src] of sources) {
  let cur = null;
  src.split('\n').forEach((l, i) => {
    const m = l.match(/^const (A_[A-Z_]+|A) = \{/); if (m) { cur = m[1]; return; }
    if (cur && l.startsWith('};')) { cur = null; return; }
    if (!cur) return;
    const k = l.match(/^ {2}(?:async )?([A-Za-z_$][\w$]*)\s*[:(]/); if (!k) return;
    (owner[k[1]] = owner[k[1]] || []).push(`${cur} (${p}:${i + 1})`);
  });
}
const clashes = Object.entries(owner).filter(([, v]) => new Set(v.map(x => x.split(' ')[0])).size > 1);
const bad = clashes.filter(([k]) => !INTENTIONAL.has(k));
bad.forEach(([k, v]) => fail(`action "${k}" is defined in more than one table: ${v.join(', ')}`));
if (!bad.length) ok(`${Object.keys(owner).length} actions, no accidental collisions`);
// Every data-action / data-change / data-input / data-submit name used has a handler.
const used = new Set();
for (const [, src] of [['index.html', html], ...sources]) for (const m of src.matchAll(/data-(?:action|change|input|submit)="([A-Za-z_$][\w$]*)"/g)) used.add(m[1]);
for (const [, src] of sources) for (const m of src.matchAll(/`, '([a-z][A-Za-z]+)'\)/g)) used.add(m[1]); // modalShell(…, footer, 'submitAction')
const missing = [...used].filter(n => !owner[n]);
if (missing.length) fail(`actions used but not defined: ${missing.join(', ')}`); else ok(`${used.size} action names in use, all defined`);

// 4. No executable dependencies from other sites.
const remote = [...html.matchAll(/<script\b[^>]*\bsrc=["']https?:\/\/[^"']+/gi), ...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']https?:\/\/[^"']+/gi)].map(m => m[0]);
if (remote.length) fail(`remote scripts or styles: ${remote.join(', ')}`); else ok('runtime scripts and styles are local');

// 5. Every js file is loaded, and the offline shell lists every file the app needs.
const jsFiles = readdirSync(new URL('js/', root)).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const notLoaded = jsFiles.filter(f => !loaded.includes(f));
if (notLoaded.length) fail(`not loaded by index.html: ${notLoaded.join(', ')}`);
const shell = [...read('sw.js').matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
const needed = [...loaded, ...[...html.matchAll(/(?:src|href)="\.\/((?:vendor|assets)\/[^"]+)"/g)].map(m => m[1]).filter(p => !p.endsWith('.svg')), 'index.html', 'manifest.webmanifest'];
const notCached = needed.filter(p => !shell.includes(p)), absent = shell.filter(p => !existsSync(new URL(p, root)));
if (notCached.length) fail(`missing from SHELL in sw.js: ${notCached.join(', ')}`);
if (absent.length) fail(`listed in sw.js but not found: ${absent.join(', ')}`);
if (!notLoaded.length && !notCached.length && !absent.length) ok(`${jsFiles.length} app scripts loaded; offline shell lists all ${shell.length} files`);

// 6. Icon names exist in the pinned Lucide bundle.
const bundle = read('vendor/lucide/lucide-1.55.0.min.js');
const names = new Set();
for (const [, src] of [['index.html', html], ...sources]) {
  for (const m of src.matchAll(/data-lucide="([a-z0-9-]+)"/g)) names.add(m[1]);
  for (const m of src.matchAll(/icon\('([a-z0-9-]+)'/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bicon: '([a-z0-9-]+)'/g)) names.add(m[1]);
}
for (const [, src] of sources) for (const m of src.matchAll(/\[['"][\w-]+['"], ['"][A-Z][^'"]*['"], ['"]([a-z0-9-]+)['"]\]/g)) names.add(m[1]);
const pascal = n => n.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const unknown = [...names].filter(n => !new RegExp(`[,{.]${pascal(n)}[:=]`).test(bundle));
if (unknown.length) fail(`icons not in Lucide 1.55.0: ${unknown.join(', ')}`); else ok(`${names.size} icon names found in the pinned Lucide bundle`);

process.exit(failed ? 1 : 0);
