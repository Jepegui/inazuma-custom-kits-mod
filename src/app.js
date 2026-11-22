// ---- Custom Kits: the interface ----
const $ = s => document.querySelector(s);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms));
const pad = (n, w = 4) => String(n).padStart(w, '0');
const hex2 = v => v.toString(16).padStart(2, '0');
const toHex = c => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const fromHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const tomlStr = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\u0000-\u001f]/g, ' ') + '"';

const ARES = ['BetterQoL', 'modules', 'AresNoSponsors', 'assets', 'chr'];
// Several mods can be made with the app, each a folder of its own in mods: CustomKits (the first, its shared names kept
// as they were) and the ones the user adds. MOD is the one being worked on.
const FIRST_MOD = 'CustomKits';
let MOD = FIRST_MOD;
const legacyMod = () => MOD === FIRST_MOD;
const uidOf = () => store.uid;
// the kits' shop icons: an atlas of the mod's own
const iconSub = () => legacyMod() ? 'custom_kits_icons' : `ck_${uidOf()}_icons`;
const ICON_DIR_OF = () => [MOD, 'assets', 'images', 'menu', '200_icon', '02_icon_item', iconSub()];
const STATE_TAG = '# CUSTOMKITS ';
// The names the game knows a kit by. The item's name is what a save remembers as bought, so it never comes back: a kit
// made after another was deleted gets a new one (kit_<mod id>_<number>; the kits made before 2.1 keep kit_0001…). The
// texture slot (u<block><slot>01) can be reused: the game remembers nothing of it.
const kitItem = k => k.item || `kit_${pad(k.n)}`;
const kitIconKey = k => k.icon || `uni_ck${pad(k.n, 5)}`;
const kitSlot = k => k.slot ?? k.n;
const kitTag = k => k.item ? k.item.replace(/^kit_/, 'ck') : `customkits_${pad(k.n)}`;
const MAX_SLOT = 499;
const LANGS = ['ja', 'en', 'es', 'fr', 'de', 'it', 'pt', 'zh_hans', 'zh_hant'];
const PART = { '_20': 'Top (shirt)', '_30': 'Bottom (shorts and socks)' };
const ZONES = {
  '_20': [[1, 4, 3, 8, 'FRONT'], [5, 4, 7, 8, 'BACK'], [0, 4, 1, 8, 'side'], [3, 4, 5, 8, 'sides'], [7, 4, 8, 8, 'side'], [0, 0, 8, 4, 'sleeves, collar and details']],
  '_30': [[1, 0, 3, 4, 'SHORTS · FRONT'], [4, 0, 7, 4, 'SHORTS · BACK'], [0, 5, 8, 8, 'SOCKS']],
};

let root = null;                    // handle of the mods folder
// the series tabs of the game's kit picker: every Custom Kit is cloned from one kit of the chosen series, so they sit together
const SERIES = [
  [1, 'Inazuma Eleven', 'uni_u010101'], [2, 'Inazuma Eleven 2', 'uni_u020101'], [3, 'Inazuma Eleven 3', 'uni_u030101'],
  [4, 'Inazuma Eleven GO', 'uni_u040101'], [5, 'GO Chrono Stone', 'uni_u050101'], [6, 'GO Galaxy', 'uni_u060101'],
  [7, 'Ares', 'uni_u070101'], [8, 'Orion', 'uni_u080201'], [9, 'Victory Road', 'uni_u110101']];
const DEFAULT_TAB = 8;   // the series with the fewest kits of the game
const tabOf = () => SERIES.find(x => x[0] === (store.tab ?? DEFAULT_TAB));
let store = { rev: 0, next: 0, kits: [], emblems: [], nextEm: 0 };   // what was made with this tool (kept inside the mod)
let allMods = [];                   // every mod made with the app in the mods folder: { folder, store }
const FILES_REV = 3;   // raise when modFiles() writes something new
let mode = 'kit';                   // what the side list offers: 'kit' or 'emblem'
let cur = null;                     // the kit being edited
let busy = false;

// ---------- folder access (the mods folder is remembered between sessions)
let refRoot = null;                 // handle of the reference folder (game textures, read only)
async function dirAt(path, create = false, r = root) { let h = r; for (const p of path) h = await h.getDirectoryHandle(p, { create }); return h; }
async function fileAt(path, r = root) { const d = await dirAt(path.slice(0, -1), false, r); return (await d.getFileHandle(path[path.length - 1])).getFile(); }
async function writeAt(path, data) {
  const d = await dirAt(path.slice(0, -1), true), fh = await d.getFileHandle(path[path.length - 1], { create: true });
  const w = await fh.createWritable(); await w.write(data); await w.close();
}
async function removeAt(path, recursive = false) { try { const d = await dirAt(path.slice(0, -1)); await d.removeEntry(path[path.length - 1], { recursive }); } catch (e) { /* not there */ } }
async function readRange(file, start, len) { return new Uint8Array(await file.slice(start, start + len).arrayBuffer()); }
const aresPath = rel => [...ARES, ...rel.split('/')];
const ALL_BASES = [...REF_CATALOG, ...ARES_CATALOG];
const bases = () => refRoot ? ALL_BASES : ARES_CATALOG;
const findBase = k => ALL_BASES.find(b => b.id === k.base && b.src === (k.src || 'ares'));
function texFile(base, t) {
  const path = typeof t === 'string' ? t : t.path, src = (typeof t === 'object' && t.src) || base.src;
  if (src !== 'ref') return fileAt(aresPath(path));
  if (!refRoot) throw new Error(T('connect the reference folder first'));
  return fileAt(['data', 'dx11', 'chr', ...path.split('/')], refRoot);
}
function status(msg, kind = '') { const s = $('#status'); s.textContent = msg; s.className = kind; }

function idb(mode, fn) {
  return new Promise((res, rej) => {
    const o = indexedDB.open('customkits', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('h');
    o.onerror = () => rej(o.error);
    o.onsuccess = () => { const tx = o.result.transaction('h', mode), r = fn(tx.objectStore('h')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); };
  });
}
async function savedHandle(key = 'mods') { try { return await idb('readonly', s => s.get(key)); } catch (e) { return null; } }
async function checkRef(h) { // the reference folder, or the folder that holds it
  try { await dirAt(['data', 'dx11', 'chr', '_uniform'], false, h); return h; } catch (e) { /* maybe its parent */ }
  try { const r = await h.getDirectoryHandle('reference'); await dirAt(['data', 'dx11', 'chr', '_uniform'], false, r); return r; } catch (e) { return null; }
}
let refConnecting = null;   // the start's own connection (no asking); a click never waits for it
function connectRef(ask) {
  if (ask) return connectRef1(true);
  return refConnecting || (refConnecting = connectRef1(false).finally(() => { refConnecting = null; }));
}
let migrating = Promise.resolve();   // the kits' textures renamed at the start: the cards wait for it
// the folder window, opened in the click itself: nothing is awaited before it (a browser shows it only right after a click)
function pickRef() {
  const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
  let p;
  try { p = window.showDirectoryPicker({ mode: 'read', id: 'inazuma-ref' }); } catch (e) { p = Promise.reject(e); }
  return p.then(h => { console.info(`[reference] folder chosen: ${h.name} (${ms()} ms)`); return h; }, e => {
    console.warn(`[reference] the folder window answered ${e && e.name}: ${e && e.message} (${ms()} ms)`);
    // a person closing the window takes longer than a second: a faster «AbortError» is the browser refusing it
    if (e && (e.name !== 'AbortError' || ms() < 1000)) status(T('The browser did not open the folder window ({err}). Open the app by double-clicking custom-kits.html and try again.', { err: e.name }), 'err');
    return null;
  });
}
// the folder remembered, if the browser still lets the app read it (a folder that moved can leave the browser waiting: 4 s at most)
async function savedRef() {
  const h = await savedHandle('ref'); if (!h) return null;
  const wait = new Promise(res => setTimeout(() => { console.warn('[reference] the folder remembered did not answer'); res(null); }, 4000));
  return Promise.race([wait, (async () => {
    try { if (!h.queryPermission || await h.queryPermission({ mode: 'read' }) !== 'granted') return null; } catch (e) { return null; }
    return checkRef(h);
  })()]);
}
async function connectRef1(ask) {
  // a click always opens the folder window at once (2.1.3): before, the app first looked at the folder remembered, and in the
  // window the .bat opens that could take long enough (or never end) for the browser to refuse the folder window
  let h = ask ? await pickRef() : await savedRef();
  if (!h) { renderRefBox(); return; }
  const r = await checkRef(h);
  if (!r) { status(T('That folder does not have the game’s files. Choose the «reference» folder (the one with data\\dx11 inside it).'), 'err'); renderRefBox(); return; }
  refRoot = r;
  try { await idb('readwrite', s => s.put(r, 'ref')); } catch (e) { /* not remembered */ }
  status(''); renderRefBox(); await renderBases(); if (mode === 'emblem') await renderEmblemBases();
  await migrating;
  if (store.kits.some(kitPending)) await bustsForAll();   // the cards and icons of the kits made before
}
function renderRefBox() {
  const box = $('#refbox'); box.textContent = '';
  if (refRoot) { box.append(el('p', { class: 'hint ok', text: mode === 'emblem' ? T('Reference folder connected: the game’s crests are below.') : T('Reference folder connected: {n} bases.', { n: REF_CATALOG.length + ARES_CATALOG.length }) })); return; }
  box.append(el('p', { class: 'hint', text: mode === 'emblem' ? T('Without the reference folder you can only make crests from your own pictures. Connect it to start from the game’s crests.') : T('You only have the {n} kits without sponsors. Connect the reference folder to get {m} more.', { n: ARES_CATALOG.length, m: REF_CATALOG.length }) }),
    el('button', { class: 'primary small', text: T('Connect the reference folder…'), onclick: () => connectRef(true) }));
}
async function connect(saved) {
  if (!window.showDirectoryPicker) { status(T('This app needs Microsoft Edge or Google Chrome.'), 'err'); return; }
  let h = saved;
  try {
    if (h) { if (h.requestPermission && await h.requestPermission({ mode: 'readwrite' }) !== 'granted') return; }
    else h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'inazuma-mods' });
  } catch (e) { return; }
  root = h;
  try { await dirAt(['VRFW']); } catch (e) { status(T('That does not look like Fantasy’s «mods» folder (there is no VRFW folder in it). Choose …\\depot_2799861\\mods.'), 'err'); root = null; return; }
  try { await dirAt(ARES); } catch (e) { status(T('The kits without sponsors were not found (BetterQoL\\modules\\AresNoSponsors). Check that BetterQoL is installed.'), 'err'); root = null; return; }
  try { await idb('readwrite', s => s.put(h, 'mods')); } catch (e) { /* not remembered, that is all */ }
  await loadMods(); renderModPick();
  status('');
  $('#connect').hidden = true; $('#app').hidden = false;
  await setMode(mode); showStep();
  migrating = (async () => { try { if (await migrateNames()) renderMyKits(); } catch (e) { console.error(e); status(T('Could not update the names of the kits’ textures: ') + e.message, 'err'); } })();
  await migrating;
  // the mods' files as this version of the app writes them (the state in mod.toml, …): rewritten once
  await forEachMod(async () => {
    if ((store.kits.length || store.emblems.length) && store.filesRev !== FILES_REV) {
      try { store.filesRev = FILES_REV; await writeMod(); } catch (e) { console.error(e); }
    }
  });
  await connectRef(false);
  if (!refRoot) await renderBases();
}
// runs fn with each mod as the current one, then comes back to the one chosen
async function forEachMod(fn) {
  const was = MOD;
  try { for (const m of allMods) { MOD = m.folder; store = m.store; await fn(m); } }
  finally { const m = allMods.find(x => x.folder === was); MOD = m.folder; store = m.store; }
}
// ---------- the mods: which one is being worked on, a new one, its name
function renderModPick() {
  const sel = $('#modpick'); if (!sel) return; sel.textContent = '';
  for (const m of allMods) sel.append(el('option', { value: m.folder, text: modName(m) }));
  sel.value = MOD;
  $('#modfolder').textContent = `mods\\${MOD}`;
}
function switchMod(folder) {
  const m = allMods.find(x => x.folder === folder); if (!m || m.folder === MOD) return;
  if (busy) { renderModPick(); return; }
  if (anyEdit() && !confirm(T('You have changes not generated yet. Switch to another mod anyway?'))) { renderModPick(); return; }
  MOD = m.folder; store = m.store; cur = null;
  try { localStorage.setItem('customkits-mod', MOD); } catch (e) { /* not remembered */ }
  document.querySelectorAll('#bases .row, #ebases .ebase').forEach(r => r.classList.remove('on'));
  renderModPick(); renderMyKits(); showStep(); status(T('Working on «{mod}».', { mod: modName() }), 'ok');
}
const folderFor = name => {
  let f = name.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('').slice(0, 40);
  if (!/^[A-Za-z]/.test(f)) f = 'Kits' + f;
  return f;
};
async function newMod() {
  if (busy) return;
  const name = (prompt(T('Name of the new mod, as the launcher will show it (for example «Liga Portugal Kits»):')) || '').trim();
  if (!name) return;
  if (anyEdit() && !confirm(T('You have changes not generated yet. Switch to another mod anyway?'))) return;
  let folder = folderFor(name), i = 2;
  const taken = async f => { if (allMods.some(m => m.folder.toLowerCase() === f.toLowerCase())) return true; try { await dirAt([f]); return true; } catch (e) { return false; } };
  while (await taken(folder)) folder = folderFor(name) + i++;
  busy = true;
  try {
    const m = { folder, store: fixStore({ rev: 1, next: 0, kits: [], emblems: [], nextEm: 0, name, filesRev: FILES_REV }) };
    allMods.push(m); MOD = folder; store = m.store; cur = null;
    await writeMod();
    try { localStorage.setItem('customkits-mod', MOD); } catch (e) { /* not remembered */ }
    renderModPick(); renderMyKits(); showStep();
    status(T('Mod «{name}» created (folder mods\\{folder}). Switch it on in the launcher’s Mods page.', { name, folder }), 'ok');
  } catch (e) { console.error(e); status(T('Could not create the mod: ') + e.message, 'err'); }
  busy = false;
}
async function renameMod() {
  if (busy) return;
  const name = (prompt(T('New name of «{name}», as the launcher shows it:', { name: modName() }), modName()) || '').trim();
  if (!name || name === modName()) return;
  busy = true;
  try { store.name = name; store.rev++; await writeMod(); renderModPick(); status(T('Renamed. The folder stays mods\\{folder}.', { folder: MOD }), 'ok'); }
  catch (e) { status(T('Could not rename: ') + e.message, 'err'); }
  busy = false;
}
// texture slots in use by every mod of the app: two mods must not share a texture name
function freeSlot() {
  const used = new Set(allMods.flatMap(m => m.store.kits.map(kitSlot)));
  for (let s = 1; s <= MAX_SLOT; s++) if (!used.has(s)) return s;
  return null;
}
// The game names a kit's card busts from its texture: u<4 digits><2 digits>_<2 digits>, the last two digits of the
// number taken over by the body variant of each mesh (u110701_10 on the meshes u003301 / u003355 -> busts u110701_10_00,
// u110755_10_00). So the kit's own textures are u<block><kit>01_<texture>: 2 digits of block (94, 93, 96, 97, 98: no
// texture of the game or of the mods starts so), 2 of kit, 01; gloves, boots and armbands keep ck<kit>_<texture>.
const TEX_BLOCKS = ['94', '93', '96', '97', '98'];
const texName = (n, ti, t) => t && t.kind ? `ck${pad(n)}_${ti}` : `u${TEX_BLOCKS[Math.floor(n / 100)] || '99'}${String(n % 100).padStart(2, '0')}01_${String(ti).padStart(2, '0')}`;
// kits made before: their kit textures renamed to the game's form (the busts are made again)
async function migrateNames() {
  let moved = 0;
  for (const k of store.kits) {
    const base = findBase(k); if (!base) continue;
    for (let ti = 0; ti < k.files.length; ti++) {
      const f = k.files[ti], t = base.textures[ti]; if (!f || (t && t.kind)) continue;
      const parts = f.split('/'), want = texName(kitSlot(k), ti, t) + '.g4tx';
      if (parts[parts.length - 1] === want) continue;
      const bytes = new Uint8Array(await (await fileAt([MOD, 'assets', 'chr', ...parts])).arrayBuffer());
      await writeAt([MOD, 'assets', 'chr', ...parts.slice(0, -1), want], bytes);
      k.files[ti] = [...parts.slice(0, -1), want].join('/'); delete k.busts; moved++;
    }
  }
  if (moved) { store.rev++; await writeMod(); }
  return moved;
}
// the state of a mod: the line kept in its mod.toml (before 2.1: in content/items/kits.toml, which went away with the last kit)
async function readState(folder) {
  for (const p of [[folder, 'mod.toml'], [folder, 'content', 'items', 'kits.toml']]) {
    try {
      const text = await (await fileAt(p)).text(), line = text.split('\n').find(l => l.startsWith(STATE_TAG));
      if (line) return JSON.parse(line.slice(STATE_TAG.length));
    } catch (e) { /* not there */ }
  }
  return null;
}
const newUid = () => { for (;;) { const u = 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)] + Math.random().toString(36).slice(2, 5); if (u.length === 4 && /^[a-z0-9]+$/.test(u) && !allMods.some(m => m.store.uid === u)) return u; } };
function fixStore(s) {
  s.kits = s.kits || []; s.emblems = s.emblems || []; s.nextEm = s.nextEm || 0; s.next = s.next || 0; s.rev = s.rev || 0;
  if (!s.uid) s.uid = newUid();
  // the counters never go back, also if they were lost before 2.1
  s.next = Math.max(s.next, ...s.kits.map(k => k.n)); s.nextEm = Math.max(s.nextEm, ...s.emblems.map(e => e.n));
  return s;
}
async function loadMods() {
  allMods = [];
  const folders = [];
  for await (const [name, h] of root.entries()) if (h.kind === 'directory') folders.push(name);
  for (const f of folders.sort()) { const s = await readState(f); if (s) allMods.push({ folder: f, store: s }); }
  if (!allMods.some(m => m.folder === FIRST_MOD) && !allMods.length) allMods.push({ folder: FIRST_MOD, store: { rev: 0, next: 0, kits: [], emblems: [], nextEm: 0 } });
  for (const m of allMods) fixStore(m.store);
  let want = null; try { want = localStorage.getItem('customkits-mod'); } catch (e) { /* none */ }
  const m = allMods.find(x => x.folder === want) || allMods.find(x => x.folder === FIRST_MOD) || allMods[0];
  MOD = m.folder; store = m.store;
}
const modName = (m = { folder: MOD, store }) => m.store.name || (m.folder === FIRST_MOD ? 'Custom Kits' : m.folder);

// ---------- editing
function buildPalette(px, n, alpha = false) {
  // colours of a flat texture: 5-bit bins, merged when close (with alpha: the see-through pixels are left out, index 255)
  const cnt = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  const bin = new Uint16Array(n);
  let seen = n;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (alpha && px[p + 3] < 24) { bin[i] = 65535; seen--; continue; }
    const b = (px[p] >> 3) << 10 | (px[p + 1] >> 3) << 5 | (px[p + 2] >> 3);
    bin[i] = b; cnt[b]++; sr[b] += px[p]; sg[b] += px[p + 1]; sb[b] += px[p + 2];
  }
  const bins = []; for (let b = 0; b < 32768; b++) if (cnt[b]) bins.push(b);
  bins.sort((a, b) => cnt[b] - cnt[a]);
  const pal = [], lut = new Uint8Array(32768).fill(255), col = b => [sr[b] / cnt[b], sg[b] / cnt[b], sb[b] / cnt[b]];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (const b of bins) {
    const c = col(b); let best = -1, bd = 40 * 40;
    for (let i = 0; i < pal.length; i++) { const d = d2(c, pal[i].c); if (d < bd) { bd = d; best = i; } }
    if (best < 0 && pal.length < 12 && cnt[b] >= Math.max(1, seen) * 0.0004) { pal.push({ c: c.map(Math.round), count: 0, to: null }); best = pal.length - 1; }
    if (best < 0) { bd = 70 * 70; for (let i = 0; i < pal.length; i++) { const d = d2(c, pal[i].c); if (d < bd) { bd = d; best = i; } } }
    if (best >= 0) { lut[b] = best; pal[best].count += cnt[b]; }
  }
  const idx = new Uint8Array(n); for (let i = 0; i < n; i++) idx[i] = bin[i] === 65535 ? 255 : lut[bin[i]];
  if (!alpha) return { pal, idx };
  // a picture (an emblem) has shading and soft edges, not flat colours: a pixel between its two nearest colours gets their
  // changes blended as it lies between them (each weighed 1/d - 1/d3, d3 the distance to the third nearest: no jump when the
  // nearest ones swap), so a gradient that crosses from one colour to the next keeps no seam, and one colour given to both is even
  const acc = pal.map(() => [0, 0, 0, 0]);
  for (const b of bins) { const k = lut[b]; if (k === 255) continue; const a = acc[k]; a[0] += sr[b]; a[1] += sg[b]; a[2] += sb[b]; a[3] += cnt[b]; }
  pal.forEach((p, k) => { const a = acc[k]; if (a[3]) p.c = [a[0] / a[3], a[1] / a[3], a[2] / a[3]].map(Math.round); });
  // a small colour that is only a mix of two bigger ones (the soft edge between them) is no colour of its own: left out,
  // its pixels blend the two (else a recoloured edge keeps a thin line of the old mix)
  const tot = pal.reduce((t, p) => t + p.count, 0) || 1, segDist = (c, a, b) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t = L ? Math.max(0, Math.min(1, (ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / L)) : 0;
    return Math.sqrt((ac[0] - t * ab[0]) ** 2 + (ac[1] - t * ab[1]) ** 2 + (ac[2] - t * ab[2]) ** 2);
  };
  for (let k = pal.length - 1; k >= 0; k--) {
    const c = pal[k]; if (c.count / tot >= 0.03) continue;
    const big = pal.filter(q => q !== c && q.count > c.count * 2);
    if (big.some((a, i) => big.some((b, j) => j > i && segDist(c.c, a.c, b.c) < 20))) pal.splice(k, 1);
  }
  const m = pal.length, idx2 = new Uint8Array(n), wt = new Uint8Array(n);
  pal.forEach(p => { p.count = 0; });
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (bin[i] === 65535) continue;
    let i1 = 0, i2 = 0, d1 = 1e9, d2 = 1e9, d3 = 1e9;
    for (let k = 0; k < m; k++) {
      const c = pal[k].c, d = Math.sqrt((px[p] - c[0]) ** 2 + (px[p + 1] - c[1]) ** 2 + (px[p + 2] - c[2]) ** 2) + 0.5;
      if (d < d1) { d3 = d2; d2 = d1; i2 = i1; d1 = d; i1 = k; } else if (d < d2) { d3 = d2; d2 = d; i2 = k; } else if (d < d3) d3 = d;
    }
    idx[i] = i1; idx2[i] = i2; pal[i1].count++;
    const a1 = 1 / d1 - 1 / d3, a2 = 1 / d2 - 1 / d3;
    wt[i] = m > 1 ? Math.round(255 * a2 / (a1 + a2)) : 0;
  }
  pal.forEach(p => { p.count = p.count / Math.max(1, seen) * n; });   // the shares shown are of the visible pixels
  return { pal, idx, idx2, wt };
}
// a texture's starting file: the kit's own (editing or copying a kit made before) or the base's
const kitFileOf = ti => cur && cur.from && cur.from.files && cur.from.files[ti];
function srcFile(ti) {
  const f = kitFileOf(ti);
  return f ? fileAt([MOD, 'assets', 'chr', ...f.split('/')]) : texFile(cur.base, cur.base.textures[ti]);
}
async function loadTexture(ti) {
  const t = cur.tex[ti]; if (t.images) return;
  const bytes = new Uint8Array(await (await srcFile(ti)).arrayBuffer());
  const g = G4TX.parse(bytes); t.images = [];
  for (const e of g.ents) {
    // the images _20 (top), _30 (bottom) and the extra parts (_21, _22, _40 …, _10 a whole suit), with their occlusion maps
    if (/_\d\doc$/.test(e.name)) { const o = G4TX.decodeEntry(bytes, e); if (o) { t.oc = t.oc || {}; t.oc[e.name.slice(e.name.lastIndexOf('_'), -2)] = o; } continue; }
    // _msk: red where the game paints the player's skin (bare arms and legs)
    if (/_\d\dmsk$/.test(e.name)) { const o = G4TX.decodeEntry(bytes, e); if (o) { t.msk = t.msk || {}; t.msk[e.name.slice(e.name.lastIndexOf('_'), -3)] = o; } continue; }
    if (!/_\d\d$/.test(e.name)) continue;
    const im = G4TX.decodeEntry(bytes, e); if (!im) continue;
    const { pal, idx } = buildPalette(im.data, im.w * im.h);
    t.images.push({ entry: e.name, kind: cur.base.textures[ti].kind, part: e.name.slice(e.name.lastIndexOf('_')), w: im.w, h: im.h, base: im.data, pal, idx, override: null, stickers: [] });
    await sleep();
  }
}
const edited = im => !!(im.override || im.stickers.length || im.pal.some(p => p.to));
// the recoloured pixels (alpha 255, or the base's own alpha for a picture with see-through parts), in a buffer of its own
function recolour(im) {
  const n = im.w * im.h, out = new Uint8ClampedArray(n * 4), b = im.base, idx = im.idx;
  const dr = new Int16Array(256), dg = new Int16Array(256), db = new Int16Array(256);
  im.pal.forEach((p, i) => { if (p.to) { dr[i] = p.to[0] - p.c[0]; dg[i] = p.to[1] - p.c[1]; db[i] = p.to[2] - p.c[2]; } });
  if (im.wt) {   // a picture: the changes of the pixel's two nearest colours, blended
    const k2s = im.idx2, wt = im.wt;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const k = idx[i], k2 = k2s[i], w = wt[i] / 255, v = 1 - w;
      out[p] = b[p] + v * dr[k] + w * dr[k2]; out[p + 1] = b[p + 1] + v * dg[k] + w * dg[k2]; out[p + 2] = b[p + 2] + v * db[k] + w * db[k2]; out[p + 3] = im.alpha ? b[p + 3] : 255;
    }
    return out;
  }
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const k = idx[i];
    out[p] = b[p] + dr[k]; out[p + 1] = b[p + 1] + dg[k]; out[p + 2] = b[p + 2] + db[k]; out[p + 3] = im.alpha ? b[p + 3] : 255;
  }
  return out;
}
// draws the image as it will be in the game onto a canvas of the texture's size
// compose() draws on one shared canvas: a copy, when two must live together
const snapCanvas = c => { const x = document.createElement('canvas'); x.width = c.width; x.height = c.height; x.getContext('2d').drawImage(c, 0, 0); return x; };
function compose(im) {
  const cv = compose.cv || (compose.cv = document.createElement('canvas'));
  if (cv.width !== im.w || cv.height !== im.h) { cv.width = im.w; cv.height = im.h; }
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (im.override) { if (im.alpha) ctx.clearRect(0, 0, im.w, im.h); else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, im.w, im.h); } ctx.drawImage(im.override, 0, 0, im.w, im.h); }
  else ctx.putImageData(new ImageData(recolour(im), im.w, im.h), 0, 0);
  for (const s of im.stickers) { const h = s.size * s.img.height / s.img.width; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((s.rot || 0) * Math.PI / 180); ctx.drawImage(s.img, -s.size / 2, -h / 2, s.size, h); ctx.restore(); }
  return cv;
}
function finalPixels(im) {
  let px;
  if (!im.override && !im.stickers.length) px = recolour(im);
  else { const cv = compose(im); px = cv.getContext('2d').getImageData(0, 0, im.w, im.h).data; }
  if (!im.alpha) for (let i = 3; i < px.length; i += 4) px[i] = im.base[i];   // the base's own alpha
  return px;
}
// ---------- the mod's files
function mainColours(px, w, h) { // the two most common colours, coarse
  const cnt = new Map();
  for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const p = (y * w + x) * 4, k = (px[p] >> 3) << 10 | (px[p + 1] >> 3) << 5 | (px[p + 2] >> 3); const e = cnt.get(k) || [0, px[p], px[p + 1], px[p + 2]]; e[0]++; cnt.set(k, e); }
  const s = [...cnt.values()].sort((a, b) => b[0] - a[0]), a = s[0].slice(1);
  const b = (s.find(c => (c[1] - a[0]) ** 2 + (c[2] - a[1]) ** 2 + (c[3] - a[2]) ** 2 > 60 * 60) || s[0]).slice(1);
  return [a, b];
}
function drawIcon(cv, body, accent) {
  const ctx = cv.getContext('2d');
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } };
  const shape = [[78, 40], [108, 28], [148, 28], [178, 40], [232, 78], [206, 124], [184, 110], [186, 228], [70, 228], [72, 110], [50, 124], [24, 78]];
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], dark = lum(body) < 60 ? '#888' : '#222';
  poly(shape, toHex(body)); ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = dark; ctx.stroke();
  poly([[40, 70], [52, 62], [76, 104], [64, 112]], toHex(accent)); poly([[216, 70], [204, 62], [180, 104], [192, 112]], toHex(accent));
  poly([[108, 28], [128, 52], [148, 28], [140, 26], [128, 40], [116, 26]], toHex(accent));
}
function modFiles() {
  const out = {}, kits = store.kits;
  // the state line is a TOML comment: the launcher skips it, and mod.toml is never deleted
  out['mod.toml'] = `id = "${MOD}"
name = ${tomlStr(modName())}
version = "1.0.${store.rev}"
author = "local"
description = "Kits and crests made with the Custom Kits app, sold in the General Store. The game's own stay as they are."
priority = 0
type = "content"
tags = ["Teams"]
updated = "${new Date().toISOString().slice(0, 10)}"
prefix = "${MOD}"
folder = "${MOD}"
requires = ["VRFW>=0.3.0", "BetterQoL>=0.3.0"]
optional = ["InazumaFantasy"]
conflicts = []
# starts switched OFF: turned on in the Mods screen
default_enabled = false
${STATE_TAG}${JSON.stringify(store)}
`;
  out['changelog.toml'] = `schema = "VRFW.changelog/1"\n\n[[release]]\nicon = "general"\nnotes = [\n    "Kits made: ${kits.length}",\n    "Crests made: ${store.emblems.length}",\n]\n`;
  // the launcher's name and description: English in every language
  const desc = 'Kits and crests made with the Custom Kits app, sold in the General Store. The game\'s own stay as they are.';
  out['text/keys.toml'] = `schema = "VRFW.text_key/1"\ndefault_lang = "en"\n` + LANGS.map(l => `\n[${l}.new]\nmod_name = ${tomlStr(modName())}\nmod_description = ${tomlStr(desc)}\n`).join('');
  if (!kits.length && !store.emblems.length) return out;
  let looks = `# Custom Kits: clothes and kit rows (generated by the kit maker; do not edit)\n\nschema = "VRFW.look/2"\n`, kitRows = '';
  for (const k of kits) {
    const base = findBase(k); if (!base) continue;
    const done = new Set(), name = (m, ti) => `${kitTag(k)}_${ti}_${m}`, own = ti => ti != null && k.files[ti];
    const idOf = f => /^0x/.test(f) ? f : `"${f}"`;
    for (const m of base.models) {
      const sl = (m.extra && m.extra.sleeve) || {};
      for (const [from, ti] of Object.values(m.cells)) {
        if (done.has(from + '|' + ti)) continue; done.add(from + '|' + ti);
        const arm = own(sl[from]) ? `, sleeve_texture = "${k.files[sl[from]]}"` : '';
        looks += `\n[[clothes]]\nmodel = "${name(from, ti)}"\nfrom = "${from}"\ncells = { upper_texture = "${k.files[ti]}"${arm} }\n`;
      }
      // gloves and boots: a model of their own only when they were changed (the first row holds the texture, as the game's)
      for (const [kind, key] of [['gloves', 'glove'], ['shoes', 'shoesF'], ['shoes', 'shoesK']]) {
        const e = m.extra && m.extra[key]; if (!e || !own(e[1]) || done.has(kind + '|' + e.join('|'))) continue;
        done.add(kind + '|' + e.join('|'));
        const t = base.textures[e[1]], rows = ['{ texture = "' + k.files[e[1]] + '" }', ...Array(Math.max(0, (t.rows || 1) - 1)).fill('{}')];
        looks += `\n[[${kind}]]\nmodel = "${name(e[0].replace(/^0x/, 'id'), e[1])}"\nfrom = ${idOf(e[0])}\nrows = [${rows.join(', ')}]\n`;
      }
    }
    for (const m of base.models) for (const [r, col] of [['F', 'uniformFielderModelIdCrc'], ['K', 'uniformKeeperModelIdCrc']]) {
      const v = k.num && k.num[m.type + r], c = m.cells[col];
      if (v && c) looks += `\n[[number]]\nclothes = "${name(c[0], c[1])}"\nfill = "${v[0]}"\noutline = "${v[1]}"\n`;
    }
    kitRows += `\n[[kit]]\nid = "${MOD}.${kitItem(k)}"\nfrom = 0x${k.base.toString(16).toUpperCase().padStart(8, '0')}\n`;
    for (const m of base.models) {
      kitRows += `  [[kit.model]]\n  type = ${m.type}\n  [kit.model.cells]\n`;
      for (const [col, [from, ti]] of Object.entries(m.cells)) kitRows += `  ${col} = "${name(from, ti)}"\n`;
      const ex = m.extra || {}, part = e => `"${name(e[0].replace(/^0x/, 'id'), e[1])}"`;
      if (ex.glove && own(ex.glove[1])) kitRows += `  gloveModelIdCrc = ${part(ex.glove)}\n`;
      if (ex.shoesF && own(ex.shoesF[1])) kitRows += `  shoesFielderModelIdCrc = ${part(ex.shoesF)}\n`;
      if (ex.shoesK && own(ex.shoesK[1])) kitRows += `  shoesKeeperModelIdCrc = ${part(ex.shoesK)}\n`;
    }
  }
  if (kits.length) out['content/looks/custom_kits.toml'] = looks + kitRows;
  let items = `schema = "VRFW.item/2"\n# Custom Kits: the kits made with the app (generated; do not edit)\ndefault_lang = "en"\n`;
  let images = `schema = "VRFW.image/1"\n`, shop = `schema = "VRFW.shop/2"\n\n[[edit]]\ntarget = "InazumaFantasy.general_store"\n`;
  for (const k of kits) {
    const base = findBase(k); if (!base) continue;
    items += `\n[[item]]\nname = "${kitItem(k)}"\nbase = "${tabOf() ? tabOf()[2] : base.item}"\ncategory = "kit"\nmodel = { uniform = "${MOD}.${kitItem(k)}" }\nicon_key = "${kitIconKey(k)}"\n` + LANGS.map(l => `  [item.text.${l}]\n  name = ${tomlStr(k.name)}\n`).join('');
    images += `\n[[texture]]\natlas = "#/menu/200_icon/02_icon_item/${iconSub()}.g4tx"\nname = "${kitIconKey(k)}"\npng = "${iconSub()}/${kitIconKey(k)}.png"\n`;
    shop += `\n  [[edit.entry]]\n  item = "${kitItem(k)}"\n  price = ${Math.max(0, Math.min(9999, k.price ?? 1))}\n  currency = "tk_bb000001"\n  stock = 1\n`;
  }
  if (kits.length) out['content/items/kits.toml'] = items;
  if (kits.length) out['content/images/menu/200_icon/02_icon_item/custom_kits_icons.toml'] = images;
  if (kits.length) out['content/sprite_redirects/kit_icons.toml'] = `schema = "VRFW.sprite_redirect/1"\n\n[[VRFW.SpriteRedirect]]\nname = "${legacyMod() ? 'kit_icons' : `kit_icons_${uidOf()}`}"\natlas = "#/menu/200_icon/02_icon_item/icon_item07.g4tx"\nown_atlas = "#/menu/200_icon/02_icon_item/${iconSub()}.g4tx"\nsprites = [${kits.map(k => `"${kitIconKey(k)}"`).join(', ')}]\n`;
  emblemFiles(out);
  for (const e of store.emblems) shop += `\n  [[edit.entry]]\n  item = "${emblemItem(e)}"\n  price = ${Math.max(0, Math.min(9999, e.price ?? 1))}\n  currency = "tk_bb000001"\n  stock = 1\n`;
  out['addons/InazumaFantasy/content/shops/kits.toml'] = shop;
  return out;
}
async function writeMod() {
  const files = modFiles(), enc = new TextEncoder();
  // every file is checked before anything is written: one wrong line and VRFW refuses the whole file
  for (const [p, text] of Object.entries(files)) if (p.endsWith('.toml') && typeof text === 'string') {
    try { TOML.parse(text); } catch (e) {
      console.error(p, e);
      throw new Error(T('{file} came out wrong ({err}): the mod was left as it was. Please tell the app’s author.', { file: p, err: String(e.message).split('\n')[0] }));
    }
  }
  // leftovers of the first tests (X variants) and files of kits that are gone
  await removeAt(['MeusKits'], true);   // the test mod this tool replaces
  const optional = ['content/looks/custom_kits.toml', 'content/items/kits.toml', 'content/images/menu/200_icon/02_icon_item/custom_kits_icons.toml', 'content/sprite_redirects/kit_icons.toml', 'addons/InazumaFantasy/content/shops/kits.toml', ...EMBLEM_TOMLS];
  for (const p of optional) if (!(p in files)) await removeAt([MOD, ...p.split('/')]);
  try {
    const uni = await dirAt([MOD, 'assets', 'chr', '_uniform']);
    const keep = new Set(store.kits.flatMap(k => k.files.filter(Boolean).map(f => f.split('/').slice(1).join('/'))));
    for await (const [mesh, dh] of uni.entries()) if (dh.kind === 'directory') {
      const names = []; for await (const [n, fh] of dh.entries()) if (fh.kind === 'file') names.push(n);
      for (const n of names) if (/^(ck\d|u9[34678]\d{4}_)/.test(n) && !keep.has(mesh + '/' + n)) await dh.removeEntry(n);
    }
  } catch (e) { /* nothing there yet */ }
  try {
    const bd = await dirAt([MOD, ...BUST_DIR]), keep = new Set(store.kits.flatMap(k => (k.busts || []).map(b => b + '_l.g4tx'))), names = [];
    for await (const [n] of bd.entries()) names.push(n);
    for (const n of names) if (!keep.has(n)) await bd.removeEntry(n);
  } catch (e) { /* nothing there yet */ }
  try {
    const icons = await dirAt(ICON_DIR_OF()), keep = new Set(store.kits.map(k => `${kitIconKey(k)}.png`)), names = [];
    for await (const [n] of icons.entries()) names.push(n);
    for (const n of names) if (!keep.has(n)) await icons.removeEntry(n);
  } catch (e) { /* nothing there yet */ }
  await syncEmblemAssets();   // the emblem textures of emblems that are gone, the tab icons
  for (const [p, text] of Object.entries(files)) await writeAt([MOD, ...p.split('/')], typeof text === 'string' ? enc.encode(text) : text);
}

// ---------- lists
const shortName = b => b.name.replace(/ Kit\b/, '').replace(' (no sponsors)', T(' (no sponsors)'));
async function thumb(base) {
  const file = await texFile(base, base.textures.find(t => t.role.startsWith('Campo · principal')) || base.textures[0]);
  const head = await readRange(file, 0, 65536), g = G4TX.parse(head);
  const e = g.ents.find(x => x.name.endsWith('_20')) || g.ents.find(x => /_\d0$/.test(x.name));
  const dh = await readRange(file, e.off, 0x94), info = G4TX.dds(dh, { off: 0 });
  if (!info.bc7) return null;
  let level = 0; while (level < info.mips - 1 && (info.w >> level) > 128) level++;
  const w = Math.max(1, info.w >> level), h = Math.max(1, info.h >> level);
  let off = e.off + 0x94; for (let i = 0; i < level; i++) off += G4TX.mipSize(info.w, info.h, i);
  const px = BC7.decode(await readRange(file, off, G4TX.mipSize(info.w, info.h, level)), 0, w, h);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  return new ImageData(px, w, h);
}
let thumbObs = null;
async function renderBases() {
  const box = $('#bases'); box.textContent = '';
  if (thumbObs) thumbObs.disconnect();
  thumbObs = new IntersectionObserver(ents => ents.forEach(en => {
    if (!en.isIntersecting) return; const row = en.target; thumbObs.unobserve(row);
    thumb(row._base).then(async im => { if (im) row.querySelector('canvas').getContext('2d').drawImage(await createImageBitmap(im), 0, 0, 64, 64); })
      .catch(() => { row.disabled = true; row.title = T('Files of this base not found'); row.classList.add('missing'); });
  }), { root: box, rootMargin: '200px' });
  for (const base of bases().slice().sort((a, b) => shortName(a).localeCompare(shortName(b)))) {
    const row = el('button', { class: 'row', 'data-name': shortName(base).toLowerCase(), onclick: () => startKit(base, row) },
      el('canvas', { width: 64, height: 64, class: 'thumb' }), el('span', { text: shortName(base) }));
    row._base = base; box.append(row); thumbObs.observe(row);
  }
  filterBases();
}
function filterBases() {
  const q = $('#search').value.trim().toLowerCase(); let n = 0;
  document.querySelectorAll('#bases .row').forEach(r => { const ok = !q || r.dataset.name.includes(q); r.hidden = !ok; if (ok) n++; });
  $('#nobase').hidden = n > 0;
}
function renderTabPick() {
  const sel = $('#tabpick'); sel.textContent = '';
  sel.append(el('option', { value: '0', text: T('Spread out (each base’s own series)') }));
  for (const [n, name] of SERIES) sel.append(el('option', { value: String(n), text: name }));
  sel.value = String(store.tab ?? DEFAULT_TAB);
}
async function changeTab() {
  if (busy) return;
  const v = +$('#tabpick').value; busy = true;
  try { store.tab = v; store.rev++; if (store.kits.length) await writeMod(); status(store.kits.length ? T('Done. Close and reopen the game to see the kits in the new tab.') : '', 'ok'); }
  catch (e) { status(T('Could not change the tab: ') + e.message, 'err'); }
  busy = false;
}
const tokens = p => T((p ?? 1) === 1 ? '{n} token' : '{n} tokens', { n: p ?? 1 });
function renderMyKits() {
  renderTabPick();
  $('#oldbusts').hidden = mode !== 'kit' || !store.kits.some(kitPending);
  const box = $('#mine'); box.textContent = '';
  if (!store.kits.length && !store.emblems.length) { box.append(el('p', { class: 'hint', text: T('You have not made anything yet.') })); return; }
  if (store.kits.length) box.append(el('div', { class: 'mine-h', text: T('Kits') }));
  for (const k of store.kits) box.append(el('div', { class: 'row mine kit' },
    el('span', { class: 'dot', style: `background:${k.color || '#888'}` }),
    el('span', { class: 'grow' }, el('b', { text: k.name }), el('small', { text: ` · ${tokens(k.price)}` })),
    el('span', { class: 'acts' }, el('button', { text: T('Edit'), title: T('Change this kit (the game keeps it: whoever bought it gets the new version)'), onclick: () => openKit(k, false) }),
    el('button', { text: T('Copy'), title: T('A new kit that starts from this one'), onclick: () => openKit(k, true) }),
    el('button', { class: 'danger', text: T('Delete'), onclick: () => deleteKit(k) }))));
  if (store.emblems.length) box.append(el('div', { class: 'mine-h', text: T('Crests') }));
  for (const e of store.emblems) {
    const cv = el('canvas', { width: 64, height: 64, class: 'mthumb' });
    box.append(el('div', { class: 'row mine' }, cv,
      el('span', { class: 'grow' }, el('b', { text: e.name }), el('small', { text: ` · ${tokens(e.price)}` })),
      el('button', { class: 'danger', text: T('Delete'), onclick: () => deleteEmblem(e) })));
    myEmblemThumb(e, cv);
  }
}
// what the side list offers (kit bases or emblems) and the welcome page's choice
async function setMode(m) {
  mode = m === 'emblem' ? 'emblem' : 'kit';
  for (const b of document.querySelectorAll('#modetabs button, .choice')) b.classList.toggle('on', b.dataset.m === mode);
  $('#kitside').hidden = mode !== 'kit'; $('#bases').hidden = mode !== 'kit'; $('#ebases').hidden = mode !== 'emblem';
  $('#tabpickbox').hidden = mode !== 'kit'; $('#nobase').hidden = true;
  $('#baseshead').textContent = mode === 'kit' ? T('Bases') : T('Crests');
  renderRefBox(); renderMyKits(); renderWelcome();
  if (mode === 'emblem') await renderEmblemBases(); else filterBases();
}
function renderWelcome() {
  const p = $('#welcomenext'); p.textContent = '';
  if (mode === 'kit') p.append(T('Choose on the left the kit you want to start from.'));
  else p.append(refRoot ? T('Choose on the left the game crest you want to start from, or ') : T('Connect the reference folder (on the left) to start from one of the game’s crests, or '),
    el('button', { class: 'primary small', text: T('use a picture of yours…'), onclick: () => startEmblem(null) }));
}

// ---------- the five steps
const STEPS = ['Base', 'Home', 'Away', 'Preview', 'Icon and name'];   // English: T() at display
const E_STEPS = ['Base', 'Colours and pictures', 'Name and price'];
const stepsOf = () => cur && cur.type === 'emblem' ? E_STEPS : STEPS;
const isEmblem = () => !!(cur && cur.type === 'emblem');
const SIDE = { 1: 'principal', 2: 'alternativo' };
const KIND = { gloves: 'Gloves (GK)', shoes: 'Boots', shoesK: 'Boots (GK)', armband: 'Armband' };
const texLabel = t => T(t.kind ? KIND[t.kind] : t.role.startsWith('GR') ? 'Goalkeeper' : 'Player');
const partLabel = im => PART[im.part] ? T(PART[im.part]) : im.kind ? T(KIND[im.kind]) : T('Extra part') + ' ' + im.part.slice(1);
// the catalogue's roles (Portuguese: the code finds textures by them), in the interface's language
const ROLE_EN = { 'Botas GR': 'GK boots', Campo: 'Outfield', GR: 'Goalkeeper', Luvas: 'Gloves', Botas: 'Boots', 'Braçadeira': 'Armband', principal: 'home', alternativo: 'away' };
const ROLE_ES = { 'Botas GR': 'Botas de portero', Campo: 'Jugador', GR: 'Portero', Luvas: 'Guantes', Botas: 'Botas', 'Braçadeira': 'Brazalete', principal: 'local', alternativo: 'visitante' };
const roleLabel = r => UI_LANG === 'pt' ? r : r.replace(/Botas GR|Campo|GR|Luvas|Botas|Braçadeira|principal|alternativo/g, m => (UI_LANG === 'es' ? ROLE_ES : ROLE_EN)[m]);
// a base's name in the interface's language (the kits without sponsors, the game's crests)
const baseLabel = b => T(b.name, { key: b.key }).replace(' (no sponsors)', T(' (no sponsors)'));
const usable = t => !t.kind || !!refRoot;   // gloves, boots and armband come from the reference folder
const sideTextures = () => cur.base.textures.map((t, i) => [t, i]).filter(([t]) => t.role.includes(SIDE[cur.step]) && usable(t));
const curImg = () => cur && (isEmblem() ? cur.step === 1 : (cur.step === 1 || cur.step === 2)) && cur.tex[cur.t].images && cur.tex[cur.t].images[cur.i];
const anyEdit = () => cur && !cur.finished && (Object.keys(cur.num).length > 0 || cur.tex.some(t => t.images && t.images.some(edited)) || !!cur.imported);
let drawQueued = false;
function redraw() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); if (view3d) queue3d(); }
// ---------- the 3D preview (an approximate mannequin, viewer3d.js)
let view3d = false, captain = false;
const viewers = {};
function viewerOf(id) {
  if (!(id in viewers)) { try { viewers[id] = Viewer3D.create($('#' + id)); } catch (e) { viewers[id] = null; } }
  return viewers[id];
}
const loading = new Map();
function ensureLoaded(i) { // an accessory's texture, opened once even when asked twice
  if (cur.tex[i].images) return Promise.resolve();
  if (!loading.has(i)) loading.set(i, loadTexture(i).catch(() => { cur.tex[i].images = []; }).finally(() => loading.delete(i)));
  return loading.get(i);
}
// meshes and the reference textures the 3D needs (read once)
const meshCache = new Map(), refTexCache = new Map();
function loadMesh(path) {
  if (!meshCache.has(path)) meshCache.set(path, (async () => {
    const p = ['data', 'common', 'chr', ...path.split('/')];
    const md = await (await fileAt(p, refRoot)).arrayBuffer();
    const mg = await (await fileAt([...p.slice(0, -1), p[p.length - 1].replace(/\.g4md$/, '.g4mg')], refRoot)).arrayBuffer();
    return parseG4M(md, mg);
  })().catch(e => { meshCache.delete(path); throw e; }));
  return meshCache.get(path);
}
const toCanvas = im => { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data.buffer || im.data), im.w, im.h), 0, 0); return c; };
function refTexture(path) { // { main, oc } canvases of a game texture of the reference folder
  if (!refTexCache.has(path)) refTexCache.set(path, (async () => {
    const bytes = new Uint8Array(await (await fileAt(['data', 'dx11', 'chr', ...path.split('/')], refRoot)).arrayBuffer()), g = G4TX.parse(bytes), out = {};
    for (const e of g.ents) {
      if (/_\d0$/.test(e.name) && !out.main) { const im = G4TX.decodeEntry(bytes, e); if (im) out.main = toCanvas(im); }
      if (/_\d0oc$/.test(e.name) && !out.oc) { const im = G4TX.decodeEntry(bytes, e); if (im) out.oc = toCanvas(im); }
    }
    return out;
  })().catch(e => { refTexCache.delete(path); throw e; }));
  return refTexCache.get(path);
}
const mskOf = (ti, part) => { const t = cur.tex[ti]; if (!t.msk || !t.msk[part]) return null; t.mskCv = t.mskCv || {}; return t.mskCv[part] || (t.mskCv[part] = toCanvas(t.msk[part])); };
const ocOf = (ti, part) => { const t = cur.tex[ti]; if (!t.oc || !t.oc[part]) return null; t.ocCv = t.ocCv || {}; return t.ocCv[part] || (t.ocCv[part] = toCanvas(t.oc[part])); };
function numberCanvas(fill, outline) {
  const c = numberCanvas.cv || (numberCanvas.cv = document.createElement('canvas')); c.width = c.height = 256;
  const g = c.getContext('2d'); g.clearRect(0, 0, 256, 256);
  g.font = '900 150px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 16; g.strokeStyle = '#' + outline; g.strokeText('10', 128, 140); g.fillStyle = '#' + fill; g.fillText('10', 128, 140);
  return c;
}
// The back number's models map one cell of the game's number sheet: 0.1 wide on most kits, 0.05 on others (Orchid
// Academy, Platos…), with a few edge vertices wrapped round to ~1.0. The preview's '10' fills that cell.
const numMeshCache = new WeakMap();
function numMesh(m) {
  if (!numMeshCache.has(m)) {
    const uv = Float32Array.from(m.uv, x => x > 0.5 ? x - 1 : x);
    let span = 0;
    for (let k = 0; k < 2; k++) { let lo = 1, hi = -1; for (let i = k; i < uv.length; i += 2) { lo = Math.min(lo, uv[i]); hi = Math.max(hi, uv[i]); } span = Math.max(span, hi - lo); }
    numMeshCache.set(m, [{ ...m, uv }, span <= 0.06 ? 0.05 : 0.1]);
  }
  return numMeshCache.get(m);
}
let sceneToken = 0;
async function scene3d(v, type, role, msgEl) {
  if (!v || !cur) return;
  const token = ++sceneToken, say = t => { if (msgEl) { msgEl.textContent = t; msgEl.hidden = !t; } };
  if (!refRoot) { v.setParts([]); say(T('The 3D view uses the game’s models from the reference folder: connect it first (in the list of bases).')); return; }
  const side = type === 0 ? 'principal' : 'alternativo', all = cur.base.textures.map((t, i) => [t, i]);
  const main = all.find(([t]) => !t.kind && t.role.includes(side) && t.role.startsWith(role === 'K' ? 'GR' : 'Campo')) || all.find(([t]) => !t.kind && t.role.includes(side));
  if (!main || !main[0].mesh) { v.setParts([]); say(T('This base has no 3D model in the reference folder.')); return; }
  try {
    const [mt, mi] = main, parts = [];
    const imgs = cur.tex[mi].images || [], meshes = await loadMesh(mt.mesh);
    for (const p of new Set(meshes.map(m => m.part))) {   // each part with its own image (the top's or the bottom's when it has none)
      const im = imgs.find(x => x.part === p) || imgs.find(x => x.part === (p[1] === '3' ? '_30' : '_20'));
      v.setTexture('tex' + p, im && compose(im)); v.setTexture('oc' + p, im && ocOf(mi, im.part)); v.setTexture('msk' + p, im && mskOf(mi, im.part));
    }
    for (const m of meshes) parts.push({ mesh: m, tex: 'tex' + m.part, oc: 'oc' + m.part, msk: 'msk' + m.part });
    if (mt.skin) {
      const [ms, rt] = await Promise.all([loadMesh(mt.skin[0]), mt.skin[1] ? refTexture(mt.skin[1]) : null]);
      v.setTexture('skin', rt && rt.main); v.setTexture('skin_oc', rt && rt.oc);
      for (const m of ms) parts.push({ mesh: m, tex: 'skin', oc: 'skin_oc', color: '#e8c4a2' });
    }
    const nc = cur.num[type + role] || numDefault(type + role);
    if (mt.num && nc) {
      v.setTexture('num', numberCanvas(nc[0], nc[1]));
      for (const m of await loadMesh(mt.num)) { const [nm, cell] = numMesh(m); parts.push({ mesh: nm, tex: 'num', uvScale: [1 / cell, 1 / cell], alphaCut: 0.5 }); }
    }
    const shoeKind = role === 'K' && all.some(([t]) => t.kind === 'shoesK' && t.role.includes(side)) ? 'shoesK' : 'shoes';
    const acc = [[shoeKind, 'shoes', true], ['gloves', 'gloves', role === 'K'], ['armband', 'armband', captain]];
    for (const [kind, name, show] of acc) {
      const a = show && all.find(([t]) => t.kind === kind && t.role.includes(side) && t.mesh);
      if (!a) continue;
      await ensureLoaded(a[1]);
      const im = (cur.tex[a[1]].images || [])[0];
      v.setTexture(name, im && compose(im)); v.setTexture(name + '_oc', ocOf(a[1], im ? im.part : '_10'));
      // a few bases name boots/armband models the game files do not have (s000293, m000198…): the model of the texture's
      // own folder, else none, rather than no 3D at all
      const dir = a[0].path.split('/').slice(0, 2).join('/'), own = `${dir}/${dir.split('/')[1]}.g4md`;
      let ms = [];
      for (const p of [a[0].mesh, own]) { try { ms = await loadMesh(p); break; } catch (e) { /* the next one */ } }
      for (const m of ms) parts.push({ mesh: m, tex: name, oc: name + '_oc' });
    }
    if (token !== sceneToken) return;
    v.setParts(parts); say('');
  } catch (e) { say(T('Could not open the 3D model: ') + e.message); }
}
function editorRole() { const t = cur.base.textures[cur.t]; return t.kind === 'gloves' || t.kind === 'shoesK' || (!t.kind && t.role.startsWith('GR')) ? 'K' : 'F'; }
let q3 = null;
function queue3d() { clearTimeout(q3); q3 = setTimeout(() => { if (view3d && cur && (cur.step === 1 || cur.step === 2)) scene3d(viewerOf('v3d'), cur.step - 1, editorRole(), $('#v3dmsg')); }, 180); }
function setView3d(on) {
  view3d = on && !!viewerOf('v3d');
  $('#view').hidden = view3d; $('#v3dbox').hidden = !view3d;
  for (const b of document.querySelectorAll('#viewtabs .tab')) b.classList.toggle('on', (b.dataset.v === '3d') === view3d);
  if (view3d) { $('#zonebox').hidden = true; $('#nozones').hidden = true; queue3d(); } else renderEditor();
  if (on && !view3d) status(T('This computer cannot show 3D (WebGL is off).'), 'err');
}
let prev3 = { type: 0, role: 'F' };
function renderPreview3d() {
  const v = viewerOf('v3dp'); $('#v3dpbox').hidden = !v; if (!v) return;
  for (const b of document.querySelectorAll('#p3side .tab')) b.classList.toggle('on', +b.dataset.v === prev3.type);
  for (const b of document.querySelectorAll('#p3role .tab')) b.classList.toggle('on', b.dataset.v === prev3.role);
  scene3d(v, prev3.type, prev3.role, $('#v3dpmsg'));
}
function hasZones() { const im = curImg(); if (isEmblem()) return false; return !!(im && ZONES[im.part] && /^u00(01|02)01$/.test(cur.base.textures[cur.t].path.split('/')[1])); }
function draw() {
  const im = curImg(), view = $('#view'), ctx = view.getContext('2d');
  ctx.clearRect(0, 0, view.width, view.height);
  if (!im) return;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(compose(im), 0, 0, view.width, view.height);
  const k = view.width / im.w;
  for (const s of im.stickers) if (s === cur.sel) {
    const h = s.size * s.img.height / s.img.width;
    ctx.save(); ctx.translate(s.x * k, s.y * k); ctx.rotate((s.rot || 0) * Math.PI / 180);
    ctx.strokeStyle = '#00e0ff'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.strokeRect(-s.size / 2 * k, -h / 2 * k, s.size * k, h * k); ctx.setLineDash([]);
    ctx.fillStyle = '#00e0ff'; ctx.strokeStyle = '#04131f'; ctx.lineWidth = 2; ctx.fillRect(s.size / 2 * k - 11, h / 2 * k - 11, 22, 22); ctx.strokeRect(s.size / 2 * k - 11, h / 2 * k - 11, 22, 22);
    ctx.restore();
  }
  if ($('#zones').checked && hasZones()) {
    const c = view.width / 8; ctx.font = '600 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [x0, y0, x1, y1, name] of ZONES[im.part]) {
      ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4; ctx.strokeRect(x0 * c + 3, y0 * c + 3, (x1 - x0) * c - 6, (y1 - y0) * c - 6);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 * c + 3, y0 * c + 3, (x1 - x0) * c - 6, (y1 - y0) * c - 6);
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(T(name), (x0 + x1) * c / 2, (y0 + y1) * c / 2);
      ctx.fillStyle = '#fff'; ctx.fillText(T(name), (x0 + x1) * c / 2, (y0 + y1) * c / 2);
    }
  }
}
function small(im, size = 150) { // a small canvas of an image as it stands
  const cv = el('canvas', { width: size, height: size, class: 'mini' }); cv.getContext('2d').drawImage(compose(im), 0, 0, size, size); return cv;
}
function showStep() {
  const bar = $('#steps'); bar.textContent = '';
  stepsOf().forEach((name, i) => bar.append(el('button', { class: 'step' + (cur && i === cur.step ? ' on' : '') + (cur && i < cur.step ? ' done' : ''), disabled: !cur || busy, onclick: () => goStep(i) },
    el('span', { class: 'num', text: cur && i < cur.step ? '✓' : String(i + 1) }), el('span', { text: T(name) }))));
  for (const id of ['s-empty', 's-base', 's-edit', 's-preview', 's-icon', 's-efinal', 's-done']) $('#' + id).hidden = true;
  $('#nav').hidden = !cur || cur.finished;
  if (!cur) { $('#s-empty').hidden = false; renderWelcome(); return; }
  if (cur.finished) { $('#s-done').hidden = false; return; }
  const last = stepsOf().length - 1;
  $('#prev').disabled = cur.step === 0; $('#next').textContent = cur.step === last ? (isEmblem() ? T('Generate crest') : T('Generate kit')) : T('Next');
  $('#next').classList.toggle('primary', true);
  if (isEmblem()) { showEmblemStep(); return; }
  if (cur.step === 0) {
    $('#s-base').hidden = false; $('#basename').textContent = baseLabel(cur.base);
    $('#basehint').textContent = T('These are the base’s textures. In the next steps you change the colours of each one.');
    const box = $('#basetex'); box.textContent = '';
    cur.base.textures.map((t, i) => [t, i]).sort((a, b) => rank(a[0].role) - rank(b[0].role)).forEach(([t, i]) => (cur.tex[i].images || []).forEach(im =>
      box.append(el('figure', {}, small(im, 120), el('figcaption', {}, el('b', { text: roleLabel(t.role) }), el('small', { text: partLabel(im) }))))));
  } else if (cur.step === 1 || cur.step === 2) {
    $('#s-edit').hidden = false;
    $('#fromnote').hidden = !(cur.step === 2 && cur.base.from_main && cur.base.from_main.length);
    renderEditor();
  } else if (cur.step === 3) {
    $('#s-preview').hidden = false;
    renderPreview3d();
    const box = $('#previews'); box.textContent = '';
    cur.base.textures.map((t, i) => [t, i]).filter(([, i]) => (cur.tex[i].images || []).length).sort((a, b) => rank(a[0].role) - rank(b[0].role)).forEach(([t, i]) => {
      const fig = el('div', { class: 'pgroup' }, el('h3', { text: roleLabel(t.role) }));
      const rowp = el('div', { class: 'prow' }); (cur.tex[i].images || []).forEach(im => rowp.append(el('figure', {}, small(im, 190), el('figcaption', {}, el('small', { text: partLabel(im) + (edited(im) ? T(' · changed') : T(' · as the base')) })))));
      fig.append(rowp); box.append(fig);
    });
  } else {
    $('#s-icon').hidden = false; drawIconPreview(); refreshIcon3d();
    $('#summary').textContent = T('Base: {base}. Parts changed: {n}.', { base: baseLabel(cur.base), n: cur.tex.reduce((n, t) => n + (t.images || []).filter(edited).length, 0) });
  }
}
const ORDER = ['Campo', 'GR', 'Luvas', 'Botas ', 'Botas GR', 'Braçadeira'];   // the catalogue's roles
const rank = r => (r.includes('principal') ? 0 : 10) + Math.max(0, ORDER.findIndex(o => r.startsWith(o)));
function goStep(i) {
  if (!cur || busy) return;
  cur.step = Math.max(0, Math.min(stepsOf().length - 1, i)); cur.sel = null; cur.finished = false;
  if (!isEmblem() && (cur.step === 1 || cur.step === 2)) { const st = sideTextures(); if (!st.some(([, ti]) => ti === cur.t)) { cur.t = (st.find(([t]) => t.role.startsWith('Campo')) || st[0] || [null, 0])[1]; cur.i = 0; } }
  showStep();
}
// the back number: key '<type><F|K>' (0 = principal, 1 = alternativo), colours RRGGBB
function numKey() { const t = cur.base.textures[cur.t]; if (!t || t.kind || !(cur.step === 1 || cur.step === 2)) return null; return (cur.step - 1) + (t.role.startsWith('GR') ? 'K' : 'F'); }
function numDefault(key) { const m = cur.base.models.find(x => x.type === +key[0]); return m && m.num && m.num[key[1]]; }
function renderNumber() {
  const key = numKey(), def = key && numDefault(key), box = $('#numbox');
  box.hidden = !def; if (!def) return;
  const [fill, outline] = cur.num[key] || def;
  $('#numfill').value = '#' + fill.toLowerCase(); $('#numline').value = '#' + outline.toLowerCase();
  const pv = $('#numprev'); pv.style.color = '#' + fill; pv.style.webkitTextStroke = '3px #' + outline;
  const top = (cur.tex[cur.t].images || [])[0]; pv.style.background = top ? toHex(top.pal[0].to || top.pal[0].c) : '#888';
  $('#numreset').disabled = !cur.num[key];
}
function setNumber() {
  const key = numKey(); if (!key) return; if (view3d) queue3d();
  const v = [$('#numfill').value.slice(1).toUpperCase(), $('#numline').value.slice(1).toUpperCase()], def = numDefault(key);
  if (def && v[0] === def[0] && v[1] === def[1]) delete cur.num[key]; else cur.num[key] = v;
  renderNumber();
}
function renderEditor() {
  const em = isEmblem();
  $('#embox').hidden = !em; $('#viewtabs').hidden = em; $('#view').classList.toggle('alpha', em);
  $('#s-edit details').hidden = em; $('#textabs').hidden = em;
  $('#stickhead').textContent = em ? T('Pictures on top') : T('Crests and sponsors');
  if (em) { const im = curImg(); $('#embg').hidden = !(im && hasBackground(im)); }
  renderNumber();
  const tabs = $('#textabs'); tabs.textContent = '';
  sideTextures().sort((a, b) => rank(a[0].role) - rank(b[0].role)).forEach(([t, i]) => tabs.append(el('button', { class: 'tab' + (i === cur.t ? ' on' : ''), text: texLabel(t), onclick: () => openTex(i) })));
  const parts = $('#parttabs'); parts.textContent = '';
  const images = cur.tex[cur.t].images || [];
  parts.hidden = images.length < 2;
  images.forEach((im, i) => parts.append(el('button', { class: 'tab small' + (i === cur.i ? ' on' : ''), text: partLabel(im) + (edited(im) ? ' •' : ''), onclick: () => { cur.i = i; cur.sel = null; renderEditor(); } })));
  const im = curImg(), pal = $('#palette'); pal.textContent = '';
  $('#overridebox').hidden = !(im && im.override);
  $('#palbox').hidden = !!(im && im.override);
  $('#zonebox').hidden = view3d || !hasZones(); $('#nozones').hidden = view3d || hasZones() || !im || !!im.kind;
  if (view3d) queue3d();
  if (im && !im.override) im.pal.forEach(p => {
    const input = el('input', { type: 'color', value: toHex(p.to || p.c), title: T('Click to choose the new colour') });
    const sw = el('label', { class: 'swatch' + (p.to ? ' changed' : '') }, el('span', { class: 'orig', style: `background:${toHex(p.c)}`, title: T('Original colour') }), input,
      el('small', { text: Math.max(1, Math.round(p.count / (im.w * im.h) * 100)) + '%' }));
    input.addEventListener('input', () => { const v = fromHex(input.value); p.to = (v[0] === p.c[0] && v[1] === p.c[1] && v[2] === p.c[2]) ? null : v; sw.classList.toggle('changed', !!p.to); redraw(); markTabs(); renderNumber(); });
    pal.append(sw);
  });
  const sl = $('#stickers'); sl.textContent = '';
  if (im) im.stickers.forEach(s => {
    const size = el('input', { type: 'range', min: 20, max: im.w, value: Math.round(s.size), title: T('Size') });
    size.addEventListener('input', () => { s.size = +size.value; cur.sel = s; redraw(); });
    const rot = el('input', { type: 'range', min: -180, max: 180, step: 1, value: s.rot || 0, title: T('Rotate') });
    rot.addEventListener('input', () => { s.rot = +rot.value; cur.sel = s; redraw(); });
    sl.append(el('div', { class: 'sticker' + (s === cur.sel ? ' sel' : ''), onpointerdown: () => { if (cur.sel !== s) { cur.sel = s; redraw(); } } },
      el('div', { class: 'shead' }, el('b', { text: s.name }), el('button', { class: 'danger', text: T('Remove'), onclick: () => { im.stickers.splice(im.stickers.indexOf(s), 1); cur.sel = null; renderEditor(); } })),
      el('label', {}, el('span', { text: T('Size') }), size), el('label', {}, el('span', { text: T('Rotate') }), rot)));
  });
  draw();
}
async function openTex(i) {
  if (busy) return;
  cur.t = i; cur.i = 0; cur.sel = null;
  if (!cur.tex[i].images) {
    busy = true; renderEditor(); status(T('Opening {what}…', { what: texLabel(cur.base.textures[i]).toLowerCase() }));
    try { await loadTexture(i); status(''); } catch (e) { status(T('Could not open this part: ') + e.message, 'err'); cur.tex[i].images = []; }
    busy = false;
  }
  renderEditor();
}
function markTabs() {
  const images = cur.tex[cur.t].images || [];
  [...$('#parttabs').children].forEach((b, i) => { b.textContent = partLabel(images[i]) + (edited(images[i]) ? ' •' : ''); });
}
async function startKit(base, row) {
  if (busy) return;
  if (anyEdit() && !confirm(isEmblem() ? T('You have changes not generated yet in this crest. Switch anyway?') : T('You have changes not generated yet in this kit. Switch anyway?'))) return;
  if (view3d) setView3d(false);
  busy = true;
  document.querySelectorAll('#bases .row').forEach(r => r.classList.toggle('on', r === row));
  cur = { type: 'kit', base, tex: base.textures.map(() => ({ images: null })), t: 0, i: 0, sel: null, step: 0, icon: null, finished: false, num: {} };
  $('#kitname').value = ''; $('#kitprice').value = '1';
  try { const main = base.textures.map((t, i) => i).filter(i => !base.textures[i].kind); for (const [k, i] of main.entries()) { status(T('Opening the base: {n} of {t}…', { n: k + 1, t: main.length })); await sleep(20); await loadTexture(i); } status(''); }
  catch (e) { status(T('Could not open this base: ') + e.message, 'err'); cur = null; }
  busy = false; showStep();
}

// a kit made before, opened again: edited in place (same item, slot and files) or copied into a new kit. It starts from the
// kit's own textures (its colours, crests and pictures are in them; the crests can no longer be moved one by one)
async function openKit(k, copy) {
  if (busy) return;
  const base = findBase(k);
  if (!base) { status(k.src === 'ref' ? T('Connect the reference folder first: this kit was made from one of its bases.') : T('The base of this kit was not found.'), 'err'); return; }
  if (anyEdit() && !confirm(isEmblem() ? T('You have changes not generated yet in this crest. Switch anyway?') : T('You have changes not generated yet in this kit. Switch anyway?'))) return;
  if (mode !== 'kit') await setMode('kit');
  if (view3d) setView3d(false);
  busy = true;
  document.querySelectorAll('#bases .row').forEach(r => r.classList.remove('on'));
  cur = { type: 'kit', base, from: k, copy, tex: base.textures.map(() => ({ images: null })), t: 0, i: 0, sel: null, step: 0, icon: null, finished: false, num: { ...(k.num || {}) } };
  $('#kitname').value = copy ? T('{name} (copy)', { name: k.name }) : k.name; $('#kitprice').value = String(k.price ?? 1);
  try {
    if (k.customIcon) { try { cur.icon = await createImageBitmap(await fileAt([...ICON_DIR_OF(), `${kitIconKey(k)}.png`])); } catch (e) { /* made again */ } }
    const main = base.textures.map((t, i) => i).filter(i => !base.textures[i].kind);
    for (const [j, i] of main.entries()) { status(T('Opening «{name}»: {n} of {t}…', { name: k.name, n: j + 1, t: main.length })); await sleep(20); await loadTexture(i); }
    status(copy ? T('Copying «{name}»: change what you want and generate it as a new kit.', { name: k.name }) : T('Editing «{name}»: generate it again to save the changes.', { name: k.name }), 'ok');
  } catch (e) { status(T('Could not open this kit: ') + e.message, 'err'); cur = null; }
  busy = false; showStep();
}

// ---------- images from files
async function pickImage() {
  return new Promise(res => { const i = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }); i.onchange = () => res(i.files[0] || null); i.click(); });
}
async function importPng() {
  const im = curImg(); if (!im) return; const f = await pickImage(); if (!f) return;
  try { im.override = await createImageBitmap(f); } catch (e) { status(T('Could not read that picture.'), 'err'); return; }
  renderEditor();
}
function exportPng() {
  const im = curImg(); if (!im) return;
  compose(im).toBlob(b => { const a = el('a', { href: URL.createObjectURL(b), download: `${cur.base.textures[cur.t].role.replace(/[^\w]+/g, '_')}_${im.part.slice(1)}.png` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
}
async function addSticker() {
  const im = curImg(); if (!im) return; const f = await pickImage(); if (!f) return;
  let bmp; try { bmp = await createImageBitmap(f); } catch (e) { status(T('Could not read that picture.'), 'err'); return; }
  const chest = im.part === '_20' && hasZones();
  const s = { img: bmp, rot: 0, name: f.name.replace(/\.[^.]+$/, '').slice(0, 24), x: chest ? im.w * 0.31 : im.w / 2, y: chest ? im.h * 0.6 : im.h / 2, size: im.w * (im.alpha ? 0.4 : 0.12) };
  im.stickers.push(s); cur.sel = s; renderEditor();
}
function setupDrag() {
  const view = $('#view'); let drag = null;
  const pos = ev => { const r = view.getBoundingClientRect(), im = curImg(); return [(ev.clientX - r.left) / r.width * im.w, (ev.clientY - r.top) / r.height * im.h]; };
  const local = (s, x, y) => { const a = -(s.rot || 0) * Math.PI / 180, dx = x - s.x, dy = y - s.y; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; };
  view.addEventListener('pointerdown', ev => {
    const im = curImg(); if (!im) return; const [x, y] = pos(ev), grip = 14 * im.w / view.getBoundingClientRect().width;
    const s0 = cur.sel;
    if (s0 && im.stickers.includes(s0)) { // the corner of the selected image resizes it
      const h = s0.size * s0.img.height / s0.img.width, [lx, ly] = local(s0, x, y);
      if (Math.abs(lx - s0.size / 2) <= grip && Math.abs(ly - h / 2) <= grip) { drag = { s: s0, resize: true }; view.setPointerCapture(ev.pointerId); return; }
    }
    for (let i = im.stickers.length - 1; i >= 0; i--) {
      const s = im.stickers[i], h = s.size * s.img.height / s.img.width, [lx, ly] = local(s, x, y);
      if (Math.abs(lx) <= s.size / 2 && Math.abs(ly) <= h / 2) { drag = { s, dx: x - s.x, dy: y - s.y }; const changed = cur.sel !== s; cur.sel = s; view.setPointerCapture(ev.pointerId); if (changed) renderEditor(); else redraw(); return; }
    }
    if (cur.sel) { cur.sel = null; renderEditor(); }
  });
  view.addEventListener('pointermove', ev => {
    if (!drag) return; const [x, y] = pos(ev), s = drag.s;
    if (drag.resize) { const [lx, ly] = local(s, x, y), ar = s.img.width / s.img.height; s.size = Math.max(20, 2 * Math.max(lx, ly * ar)); }
    else { s.x = x - drag.dx; s.y = y - drag.dy; }
    redraw();
  });
  view.addEventListener('pointerup', () => { if (drag && drag.resize) renderEditor(); drag = null; });
  view.addEventListener('wheel', ev => { if (!cur || !cur.sel) return; ev.preventDefault(); cur.sel.size = Math.max(20, cur.sel.size * (ev.deltaY < 0 ? 1.06 : 0.94)); renderEditor(); }, { passive: false });
}

// ---------- icon
function kitColours() {
  const ti = Math.max(0, cur.base.textures.findIndex(t => t.role.startsWith('Campo · principal')));
  const im = (cur.tex[ti].images || []).find(x => x.part === '_20') || (cur.tex[ti].images || [])[0];
  return im ? mainColours(edited(im) ? finalPixels(im) : im.base, im.w, im.h) : [[200, 30, 30], [255, 255, 255]];
}
// the icon made from the game's shirt mesh with the kit as it is now (needs the reference folder)
async function refreshIcon3d() {
  if (!refRoot || !cur) return null;
  const mi = cur.base.textures.findIndex(t => !t.kind && t.role.startsWith('Campo · principal'));
  const imgs = mi >= 0 && cur.tex[mi].images || [];
  if (!imgs.some(im => im.part === '_20' || im.part === '_10')) return null;
  const parts = {}; for (const im of imgs) parts[im.part] = { img: snapCanvas(compose(im)), oc: ocOf(mi, im.part), msk: mskOf(mi, im.part) };
  try { cur.icon3d = await kitIcon(cur.base, kitParts(parts)); } catch (e) { console.warn('icon', e); cur.icon3d = null; }
  if (cur.step === 4) drawIconPreview();
  return cur.icon3d;
}
// the interface's language changed: everything the code drew, drawn again
function onLangChange() {
  if (!root) return;
  renderRefBox(); renderMyKits(); renderWelcome();
  $('#baseshead').textContent = mode === 'kit' ? T('Bases') : T('Crests');
  if (mode === 'emblem') renderEmblemBases(); else renderBases();
  showStep(); status('');
}
function doneSteps(name, steps) {
  $('#donename').textContent = name; const ol = $('#donesteps'); ol.textContent = '';
  for (const t of steps) ol.append(el('li', { text: t }));
}
function drawIconPreview() {
  const cv = $('#iconview'), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 256, 256);
  if (!cur.icon && cur.icon3d) ctx.drawImage(cur.icon3d, 0, 0, 256, 256);
  else if (cur.icon) { const k = Math.min(256 / cur.icon.width, 256 / cur.icon.height), w = cur.icon.width * k, h = cur.icon.height * k; ctx.drawImage(cur.icon, (256 - w) / 2, (256 - h) / 2, w, h); }
  else { const [a, b] = kitColours(); drawIcon(cv, a, b); }
  $('#iconreset').hidden = !cur.icon;
}

async function generate() {
  if (busy || !cur) return;
  const name = $('#kitname').value.trim(), price = Math.max(0, Math.min(9999, Math.round(+$('#kitprice').value || 0)));
  if (!name) { status(T('Give the kit a name before generating it.'), 'err'); $('#kitname').focus(); return; }
  busy = true; $('#next').disabled = true; $('#prev').disabled = true;
  try {
    // editing a kit: its number, item, icon and texture slot stay (the saves know it by its item); a copy is a new kit
    const old = cur.from && !cur.copy && store.kits.includes(cur.from) ? cur.from : null;
    const n = old ? old.n : Math.max(store.next || 0, store.kits.reduce((m, k) => Math.max(m, k.n), 0)) + 1, files = [], slot = old ? kitSlot(old) : freeSlot();
    if (slot == null) throw new Error(T('there are already {n} kits in your Custom Kits mods, the most the game’s texture names allow. Delete one first.', { n: MAX_SLOT }));
    const ids = old ? { item: old.item, icon: kitIconKey(old), slot } : { item: `kit_${uidOf()}_${n}`, icon: `uni_ck${uidOf()}${pad(n, 4)}`, slot };
    for (let ti = 0; ti < cur.base.textures.length; ti++) {
      const t = cur.base.textures[ti];
      if (t.kind && !(cur.tex[ti].images || []).some(edited) && !kitFileOf(ti)) { files.push(null); continue; }
      status(T('Generating {n} of {t}: {what}…', { n: ti + 1, t: cur.base.textures.length, what: roleLabel(t.role) })); await sleep(30);
      const bytes = new Uint8Array(await (await srcFile(ti)).arrayBuffer()), g = G4TX.parse(bytes);
      for (const im of cur.tex[ti].images || []) if (edited(im)) { G4TX.replaceEntry(bytes, g.ents.find(x => x.name === im.entry), finalPixels(im)); await sleep(); }
      const dir = t.path.split('/').slice(0, -1), fname = texName(slot, ti, t) + '.g4tx';
      await writeAt([MOD, 'assets', 'chr', ...dir, fname], bytes);
      files.push([...dir, fname].join('/'));
    }
    status(T('Saving the icon and the mod’s files…')); await sleep(30);
    if (!cur.icon) await refreshIcon3d();
    drawIconPreview();
    await writeAt([...ICON_DIR_OF(), `${ids.icon}.png`], await new Promise(r => $('#iconview').toBlob(r, 'image/png')));
    const kit = { ...(old || {}), n, ...ids, name, price, base: cur.base.id, src: cur.base.src, files, num: { ...cur.num }, color: toHex(kitColours()[0]), icon3d: !cur.icon && cur.icon3d ? ICON_REV : false, customIcon: !!cur.icon };
    delete kit.busts; delete kit.bustRev;
    if (refRoot) {
      try { kit.busts = await makeBusts(kit, cur.base, (i, t) => status(T('Generating the player cards: {n} of {t}…', { n: i, t }))); kit.bustRev = BUST_REV; }
      catch (e) { console.error(e); status(T('The player cards were not generated: ') + e.message, 'err'); await sleep(1500); }
    }
    if (old) store.kits[store.kits.indexOf(old)] = kit; else { store.next = n; store.kits.push(kit); }
    store.rev++;
    await writeMod();
    renderMyKits(); status('');
    cur.finished = true;
    if (old) doneSteps(name, [T('Close and reopen the game: whoever already bought it sees the new version (nothing to buy again).')]);
    else doneSteps(name, [T('On the launcher’s Mods page, check that «{mod}» is switched on.', { mod: modName() }), T('Open the game through Steam and choose Fantasy.'), T('Go to the General Store (General Store → Kits). The kit costs {price}.', { price: tokens(price) })]);
  } catch (e) { console.error(e); status(T('Something went wrong while generating: ') + e.message, 'err'); }
  busy = false; $('#next').disabled = false; showStep();
}
const ICON_REV = 5;   // the kits whose icons were made by an older version get new ones
const iconOld = k => !k.customIcon && k.icon3d !== ICON_REV;
const BUST_REV = 6;   // the cards made by an older version are made again (2: the extra parts, the cuts with the bottom listed first; 4: the special bodies; 5: the raised-collar files; 6: the cuts)
const bustOld = k => !k.busts || k.bustRev !== BUST_REV;
const kitPending = k => (bustOld(k) || iconOld(k)) && !!findBase(k);
async function bustsForAll() {
  if (busy) return;
  if (!refRoot) { status(T('Connect the reference folder first (the cards use the game’s models).'), 'err'); return; }
  const todo = store.kits.filter(kitPending); if (!todo.length) return;
  busy = true;
  try {
    for (const [i, k] of todo.entries()) {
      const base = findBase(k);
      if (bustOld(k)) { k.busts = await makeBusts(k, base, (a, t) => status(T('Cards of «{name}» ({i} of {n}): {a} of {t}…', { name: k.name, i: i + 1, n: todo.length, a, t }))); k.bustRev = BUST_REV; }
      if (iconOld(k)) {
        const mi = base.textures.findIndex(t => !t.kind && t.role.startsWith('Campo · principal'));
        if (mi >= 0 && k.files[mi]) {
          status(T('Icon of «{name}»…', { name: k.name }));
          const tx = await readKitTop(k.files[mi]), icon = await kitIcon(base, tx);
          if (icon) { await writeAt([...ICON_DIR_OF(), `${kitIconKey(k)}.png`], await new Promise(r => icon.toBlob(r, 'image/png'))); k.icon3d = ICON_REV; }
        }
      }
    }
    store.rev++; await writeMod(); renderMyKits(); status(T('Cards and icons generated. Close and reopen the game to see them.'), 'ok');
  } catch (e) { console.error(e); status(T('Could not generate the cards: ') + e.message, 'err'); }
  busy = false;
}
async function deleteKit(k) {
  if (busy) return;
  if (!confirm(T('Delete «{name}»?\n\nIf you already bought it in the game, take it off every team first: a save that still uses it may end up with a strange item.', { name: k.name }))) return;
  busy = true;
  try { store.kits = store.kits.filter(x => x !== k); store.rev++; await writeMod(); renderMyKits(); status(T('«{name}» deleted.', { name: k.name })); }
  catch (e) { status(T('Could not delete: ') + e.message, 'err'); }
  busy = false;
}

window.addEventListener('DOMContentLoaded', async () => {
  $('#pick').addEventListener('click', () => connect(null));
  $('#prev').addEventListener('click', () => goStep(cur.step - 1));
  $('#next').addEventListener('click', () => cur.step === stepsOf().length - 1 ? (isEmblem() ? generateEmblem() : generate()) : goStep(cur.step + 1));
  $('#again').addEventListener('click', () => { cur = null; document.querySelectorAll('#bases .row, #ebases .ebase').forEach(r => r.classList.remove('on')); showStep(); });
  for (const b of document.querySelectorAll('#modetabs button, .choice')) b.addEventListener('click', () => setMode(b.dataset.m));
  $('#search').addEventListener('input', filterBases);
  $('#oldbusts').addEventListener('click', () => refRoot ? bustsForAll() : connectRef(true));
  for (const b of document.querySelectorAll('#viewtabs .tab')) b.addEventListener('click', () => setView3d(b.dataset.v === '3d'));
  for (const b of document.querySelectorAll('.v3dviews button')) b.addEventListener('click', () => { const v = viewerOf(b.closest('.v3d').querySelector('canvas').id); if (v) v.view(b.dataset.v); });
  for (const c of document.querySelectorAll('.captain')) c.addEventListener('change', () => { captain = c.checked; document.querySelectorAll('.captain').forEach(x => { x.checked = captain; }); if (view3d) queue3d(); if (cur && cur.step === 3) renderPreview3d(); });
  for (const b of document.querySelectorAll('#p3side .tab')) b.addEventListener('click', () => { prev3.type = +b.dataset.v; renderPreview3d(); });
  for (const b of document.querySelectorAll('#p3role .tab')) b.addEventListener('click', () => { prev3.role = b.dataset.v; renderPreview3d(); });
  $('#numfill').addEventListener('input', setNumber); $('#numline').addEventListener('input', setNumber);
  $('#numreset').addEventListener('click', () => { const key = numKey(); if (key) { delete cur.num[key]; renderNumber(); } });
  $('#tabpick').addEventListener('change', changeTab);
  $('#modpick').addEventListener('change', () => switchMod($('#modpick').value));
  $('#modnew').addEventListener('click', newMod); $('#modren').addEventListener('click', renameMod);
  $('#kitname').addEventListener('input', () => status(''));
  $('#import').addEventListener('click', importPng);
  $('#export').addEventListener('click', exportPng);
  $('#addsticker').addEventListener('click', addSticker);
  $('#dropoverride').addEventListener('click', () => { const im = curImg(); if (im) { im.override = null; renderEditor(); } });
  $('#resetcolours').addEventListener('click', () => { const im = curImg(); if (im) { im.pal.forEach(p => p.to = null); renderEditor(); } });
  $('#zones').addEventListener('change', redraw);
  $('#iconpick').addEventListener('click', async () => { const f = await pickImage(); if (!f) return; try { cur.icon = await createImageBitmap(f); } catch (e) { status(T('Could not read that picture.'), 'err'); } drawIconPreview(); });
  $('#iconreset').addEventListener('click', () => { cur.icon = null; drawIconPreview(); });
  setupDrag();
  if (!window.showDirectoryPicker) { status(T('This app needs Microsoft Edge or Google Chrome.'), 'err'); return; }
  const h = await savedHandle();
  if (h) { $('#resume').hidden = false; $('#resumename').textContent = h.name; $('#resume').addEventListener('click', () => connect(h)); }
});
