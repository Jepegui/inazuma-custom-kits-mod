// ---- Emblems: a game emblem (reference folder) with new colours, or a picture of the user's, as a new emblem item
const EMBLEM_DIR = ['data', 'dx11', 'menu', '200_icon', '01_icon_emblem'];
const MOD_EMBLEM_DIR = [MOD, 'assets', 'menu', '200_icon', '01_icon_emblem'];
// em984001…em984999: no emblem of the game or of the mods uses these keys (item id = crc32 of the key)
const emblemKey = e => `em984${String(e.n).padStart(3, '0')}`;
const emblemItem = e => `emblem_${pad(e.n, 3)}`;
const EMBLEM_BASE_ITEM = 'em900012';   // the game emblem whose item row the new ones copy (as the community crests do)
const TAB_ICON = 'icon_list_tab_customkits', TAB_ATLAS = '#/menu/200_icon/custom_kits_own/custom_kits_icon_list_tab.g4tx';
const TAB_TOML_DIR = 'content/images/menu/200_icon/16_icon_list_tab';
const EMBLEM_TOMLS = ['content/items/emblems.toml', 'content/emblem_tabs/custom_emblems.toml', 'content/emblem_colours/custom_emblems.toml',
  `${TAB_TOML_DIR}/custom_emblems_tab.toml`, 'content/sprite_redirects/emblem_tab.toml'];
const EMBLEM_GROUPS = [['em01', 'Inazuma Eleven'], ['em02', 'Inazuma Eleven 2'], ['em03', 'Inazuma Eleven 3'], ['em04', 'Inazuma Eleven GO'],
  ['em05', 'GO Chrono Stone'], ['em06', 'GO Galaxy'], ['em07', 'Ares'], ['em08', 'Orion'], ['em11', 'Victory Road'], ['em9', 'Special']];   // English: T() at display
const ESIZE = 512, EFIT = 452;   // the emblem pictures are 512 x 512; the game's crests fill about 88 % of them

// ---------- the mod's files
function emblemFiles(out) {
  const ems = store.emblems; if (!ems.length) return;
  let items = `schema = "VRFW.item/2"\n# Custom Kits: the emblems made with the app (generated; do not edit)\ndefault_lang = "en"\n`;
  for (const e of ems) items += `\n[[item]]\nname = "${emblemItem(e)}"\nbase = "${EMBLEM_BASE_ITEM}"\ncategory = "emblem"\nicon_key = "${emblemKey(e)}"\nkey_id = true\n` + LANGS.map(l => `  [item.text.${l}]\n  name = ${tomlStr(e.name)}\n`).join('');
  out['content/items/emblems.toml'] = items;
  out['content/emblem_tabs/custom_emblems.toml'] = `schema = "VRFW.emblem_tab/1"\n# the emblem picker's tab of the emblems made with the app\n\n[[VRFW.EmblemTab]]\nname = "custom"\norder = 300\nicon = "${TAB_ICON}"\nicon_off = "${TAB_ICON}_off"\nemblems = [${ems.map(e => `"${emblemKey(e)}"`).join(', ')}]\n`;
  const rows = ems.filter(e => e.measure).map(e => { const m = e.measure; return `  { emblem = "${emblemKey(e)}"${m.hue == null ? '' : `, hue = ${m.hue}`}, strength = ${m.strength.toFixed(3)}, share = ${m.share.toFixed(3)}, value = ${m.value.toFixed(3)} },`; });
  if (rows.length) out['content/emblem_colours/custom_emblems.toml'] = `schema = "VRFW.emblem_colour/1"\n\n[VRFW]\nEmblemColour = [\n${rows.join('\n')}\n]\n`;
  out[`${TAB_TOML_DIR}/custom_emblems_tab.toml`] = `schema = "VRFW.image/1"\n\n[[texture]]\natlas = "${TAB_ATLAS}"\nname = "custom_kits_icon_list_tab"\nsize = [292, 96]\n` +
    [['', 0], ['_off', 148]].map(([sfx, x]) => `\n[[sprite]]\natlas = "${TAB_ATLAS}"\nname = "${TAB_ICON}${sfx}"\ntexture = "custom_kits_icon_list_tab"\nx = ${x}\ny = 0\npng = "custom_emblems_tab/${TAB_ICON}${sfx}.png"\n`).join('');
  out['content/sprite_redirects/emblem_tab.toml'] = `schema = "VRFW.sprite_redirect/1"\n# the tab icon lives in the mod's own atlas\n` +
    ['#/menu/200_icon/16_icon_list_tab/icon_list_tab.g4tx', '#/menu/200_icon/16_icon_list_tab/<LG>/icon_list_tab.g4tx'].map((a, i) =>
      `\n[[VRFW.SpriteRedirect]]\nname = "custom_kits_icon_list_tab${i ? '_lg' : ''}"\natlas = "${a}"\nown_atlas = "${TAB_ATLAS}"\nsprites = ["${TAB_ICON}", "${TAB_ICON}_off"]\n`).join('');
}
// the tab icon (a crest with a star, slanted as the game's tab icons): white when focused, a dark see-through one when not
function tabIcon(on) {
  const c = document.createElement('canvas'); c.width = 144; c.height = 96; const g = c.getContext('2d');
  g.setTransform(1, 0, -0.18, 1, 9, 0);
  const shield = new Path2D('M72 8 L104 18 L104 46 Q104 74 72 88 Q40 74 40 46 L40 18 Z');
  const star = new Path2D('M72 28 L77.5 40.5 L91 41.5 L80.5 50.5 L84 64 L72 56.5 L60 64 L63.5 50.5 L53 41.5 L66.5 40.5 Z');
  g.fillStyle = on ? '#ffffff' : 'rgba(0,0,0,0.4)'; g.fill(shield);
  g.globalCompositeOperation = 'destination-out'; g.fill(star);
  return c;
}
const canvasPng = c => new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), 'image/png'));
async function syncEmblemAssets() {
  const keep = new Set(store.emblems.flatMap(e => [emblemKey(e) + '.g4tx', emblemKey(e) + '_s.g4tx']));
  try {
    const d = await dirAt(MOD_EMBLEM_DIR), names = [];
    for await (const [n] of d.entries()) names.push(n);
    for (const n of names) if (/^em984\d{3}/.test(n) && !keep.has(n)) await d.removeEntry(n);
  } catch (e) { /* nothing there yet */ }
  const iconDir = [MOD, ...TAB_TOML_DIR.split('/'), 'custom_emblems_tab'];
  if (!store.emblems.length) { await removeAt(iconDir, true); return; }
  for (const on of [true, false]) await writeAt([...iconDir, `${TAB_ICON}${on ? '' : '_off'}.png`], await canvasPng(tabIcon(on)));
}

// ---------- pictures
// an emblem picture of the game (or of the mod): the RGBA of its first entry, and its size
async function readEmblem(path, r) {
  const bytes = new Uint8Array(await (await fileAt(path, r)).arrayBuffer()), g = G4TX.parse(bytes);
  const im = G4TX.decodeEntry(bytes, g.ents[0]); if (!im) throw new Error('unknown texture format');
  return { data: new Uint8ClampedArray(im.data.buffer || im.data), w: im.w, h: im.h };
}
const toImageCanvas = im => { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d').putImageData(new ImageData(im.data, im.w, im.h), 0, 0); return c; };
function emblemImage(px, entry) {
  const { pal, idx, idx2, wt } = buildPalette(px, ESIZE * ESIZE, true);
  return { entry, kind: 'emblem', part: 'emblem', w: ESIZE, h: ESIZE, base: px, pal, idx, idx2, wt, override: null, stickers: [], alpha: true };
}
// a picture of the user's, cut to what is visible in it and centred in the emblem's square as the game's crests are
async function fitPicture(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const box = alphaBox(px, c.width, c.height); if (!box) throw new Error(T('the picture is all transparent'));
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, k = EFIT / Math.max(w, h);
  const out = document.createElement('canvas'); out.width = out.height = ESIZE;
  const o = out.getContext('2d', { willReadFrequently: true }); o.imageSmoothingQuality = 'high';
  o.drawImage(c, x0, y0, w, h, (ESIZE - w * k) / 2, (ESIZE - h * k) / 2, w * k, h * k);
  return o.getImageData(0, 0, ESIZE, ESIZE).data;
}
// the box of the visible pixels of a picture
function alphaBox(px, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}
const boxEdge = ([x0, y0, x1, y1], W) => { const out = []; for (let x = x0; x <= x1; x++) out.push(y0 * W + x, y1 * W + x); for (let y = y0; y <= y1; y++) out.push(y * W + x0, y * W + x1); return out; };
// a picture with a plain background (a photo or a logo saved without transparency): the edges of its visible box are opaque
function hasBackground(im) {
  const box = alphaBox(im.base, im.w, im.h); if (!box) return false;
  const edge = boxEdge(box, im.w); return edge.filter(i => im.base[i * 4 + 3] > 200).length > edge.length * 0.85;
}
// the picture moved back to the middle of the square at the game's size (after its background went away)
function refit(px, W, H) {
  const box = alphaBox(px, W, H); if (!box) return px;
  const [x0, y0, x1, y1] = box, w = x1 - x0 + 1, h = y1 - y0 + 1, k = EFIT / Math.max(w, h);
  const src = toImageCanvas({ data: px, w: W, h: H }), out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d', { willReadFrequently: true }); o.imageSmoothingQuality = 'high';
  o.drawImage(src, x0, y0, w, h, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k);
  return o.getImageData(0, 0, W, H).data;
}
// the background made see-through: the colour along the edges of the picture's box, flooded inwards (soft at its rim)
function removeBackground(im) {
  const b = im.base, W = im.w, H = im.h, box = alphaBox(b, W, H); if (!box) return false;
  const edge = boxEdge(box, W), cnt = new Map();
  for (const i of edge) { const p = i * 4; if (b[p + 3] < 200) continue; const k = (b[p] >> 4) << 8 | (b[p + 1] >> 4) << 4 | (b[p + 2] >> 4); cnt.set(k, (cnt.get(k) || 0) + 1); }
  if (!cnt.size) return false;
  const top = [...cnt.entries()].sort((a, c) => c[1] - a[1])[0][0], ref = [((top >> 8) & 15) * 16 + 8, ((top >> 4) & 15) * 16 + 8, (top & 15) * 16 + 8];
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (const i of edge) { const p = i * 4; if (b[p + 3] > 200 && Math.abs(b[p] - ref[0]) < 24 && Math.abs(b[p + 1] - ref[1]) < 24 && Math.abs(b[p + 2] - ref[2]) < 24) { sr += b[p]; sg += b[p + 1]; sb += b[p + 2]; sn++; } }
  const bg = [sr / sn, sg / sn, sb / sn], dist = p => Math.sqrt((b[p] - bg[0]) ** 2 + (b[p + 1] - bg[1]) ** 2 + (b[p + 2] - bg[2]) ** 2);
  const T0 = 40, T1 = 110, seen = new Uint8Array(W * H), stack = [], open = p => b[p + 3] < 24 || dist(p) < T0;
  for (const i of edge) if (!seen[i] && open(i * 4)) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W;
    b[i * 4 + 3] = 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || seen[j]) continue; seen[j] = 1;
      if (open(j * 4)) stack.push(j);
      else { const d = dist(j * 4); if (d < T1) b[j * 4 + 3] = Math.min(b[j * 4 + 3], Math.round(255 * (d - T0) / (T1 - T0))); }   // the rim: partly see-through
    }
  }
  Object.assign(im, emblemImage(refit(b, W, H), im.entry), { stickers: im.stickers });
  return true;
}
// half size, weighted by alpha (the see-through pixels lend no colour to the edges)
function halveAlpha(px, w, h) {
  const nw = w >> 1, nh = h >> 1, out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    let r = 0, g = 0, bl = 0, a = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p = ((y * 2 + dy) * w + x * 2 + dx) * 4, al = px[p + 3]; r += px[p] * al; g += px[p + 1] * al; bl += px[p + 2] * al; a += al; }
    const o = (y * nw + x) * 4;
    if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; } out[o + 3] = (a + 2) >> 2;
  }
  return out;
}
// the colour measure VRFW keeps for every emblem picture (content\emblem_colours)
function measureEmblem(px) {
  const hist = new Float64Array(360); let opaque = 0, coloured = 0, vsum = 0;
  for (let p = 0; p < px.length; p += 16) {
    if (px[p + 3] < 128) continue; opaque++;
    const r = px[p] / 255, g = px[p + 1] / 255, b = px[p + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0;
    vsum += v; if (s < 0.25 || v < 0.2) continue; coloured++;
    let h = mx === mn ? 0 : mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
    hist[(Math.round(h) + 360) % 360] += s * v;
  }
  if (!opaque) return { hue: null, strength: 0, share: 0, value: 0 };
  let best = -1, bw = 0;
  for (let h = 0; h < 360; h++) { let w = 0; for (let d = -15; d <= 15; d++) w += hist[(h + d + 360) % 360]; if (w > bw) { bw = w; best = h; } }
  return { hue: coloured ? best : null, strength: Math.min(1, bw / opaque), share: coloured / opaque, value: vsum / opaque };
}

// ---------- the side list: the game's emblems
let emblemList = null, eThumbObs = null;
async function listEmblems() {
  if (emblemList) return emblemList;
  const d = await dirAt(EMBLEM_DIR, false, refRoot), names = new Set();
  for await (const [n, h] of d.entries()) { const m = h.kind === 'file' && /^(em\d{4,6})\.g4tx$/.exec(n); if (m) names.add(m[1]); }
  return emblemList = [...names].sort();
}
async function emblemThumb(key) {
  let im;
  try { im = await readEmblem([...EMBLEM_DIR, key + '_s.g4tx'], refRoot); } catch (e) { im = await readEmblem([...EMBLEM_DIR, key + '.g4tx'], refRoot); }
  return toImageCanvas(im);
}
async function renderEmblemBases() {
  const box = $('#ebases'); box.textContent = '';
  box.append(el('button', { class: 'ebase own', title: T('Start with a picture of yours (PNG)'), onclick: () => startEmblem(null) }, el('span', {}, el('b', { text: '+' }), T('Your picture'))));
  if (!refRoot) return;
  let keys;
  try { keys = await listEmblems(); } catch (e) { box.append(el('p', { class: 'hint', style: 'grid-column:1/-1', text: T('The game’s crests were not found in the reference folder (data\\dx11\\menu\\200_icon\\01_icon_emblem).') })); return; }
  if (eThumbObs) eThumbObs.disconnect();
  eThumbObs = new IntersectionObserver(ents => ents.forEach(en => {
    if (!en.isIntersecting) return; const b = en.target; eThumbObs.unobserve(b);
    emblemThumb(b.dataset.key).then(c => b.querySelector('canvas').getContext('2d').drawImage(c, 0, 0, 96, 96)).catch(() => { b.disabled = true; b.classList.add('missing'); });
  }), { root: box, rootMargin: '300px' });
  const group = k => T((EMBLEM_GROUPS.find(([p]) => k.startsWith(p)) || [null, 'Others'])[1]);
  let last = null;
  for (const key of keys.slice().sort((a, b) => { const ga = EMBLEM_GROUPS.findIndex(([p]) => a.startsWith(p)), gb = EMBLEM_GROUPS.findIndex(([p]) => b.startsWith(p)); return ((ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb)) || a.localeCompare(b); })) {
    const g = group(key); if (g !== last) { box.append(el('h4', { text: g })); last = g; }
    const b = el('button', { class: 'ebase' + (cur && isEmblem() && cur.key === key ? ' on' : ''), title: key, 'data-key': key, onclick: () => startEmblem(key, b) }, el('canvas', { width: 96, height: 96 }));
    box.append(b); eThumbObs.observe(b);
  }
}
async function myEmblemThumb(e, cv) {
  try { const im = await readEmblem([...MOD_EMBLEM_DIR, emblemKey(e) + '_s.g4tx']); cv.getContext('2d').drawImage(toImageCanvas(im), 0, 0, 64, 64); } catch (err) { /* no picture */ }
}

// ---------- making one
async function startEmblem(key, btn) {
  if (busy) return;
  if (anyEdit() && !confirm(isEmblem() ? T('You have changes not generated yet in this crest. Switch anyway?') : T('You have changes not generated yet in this kit. Switch anyway?'))) return;
  let px;
  if (key) {
    busy = true; status(T('Opening the crest…'));
    try { const im = await readEmblem([...EMBLEM_DIR, key + '.g4tx'], refRoot); if (im.w !== ESIZE || im.h !== ESIZE) throw new Error('unexpected size'); px = im.data; status(''); }
    catch (e) { status(T('Could not open this crest: ') + e.message, 'err'); busy = false; return; }
    busy = false;
  } else {
    const f = await pickImage(); if (!f) return;
    try { px = await fitPicture(f); } catch (e) { status(T('Could not use that picture: ') + e.message, 'err'); return; }
  }
  if (view3d) setView3d(false);
  if (mode !== 'emblem') await setMode('emblem');
  const im = emblemImage(px, key || 'picture');
  cur = { type: 'emblem', key: key || null, imported: !key, base: { name: key ? 'Game crest {key}' : 'Your picture', key, textures: [{ role: 'Emblema', kind: 'emblem' }], models: [] },
    tex: [{ images: [im] }], t: 0, i: 0, sel: null, step: key ? 0 : 1, finished: false, num: {}, icon: null };
  $('#emname').value = ''; $('#emprice').value = '1';
  document.querySelectorAll('#bases .row, #ebases .ebase').forEach(r => r.classList.toggle('on', r === btn));
  if (!key && hasBackground(im)) status(T('This picture has a background. If you like, use «Make the background transparent».'));
  showStep();
}
// the editor's button: the whole picture replaced by one of the user's
async function importEmblemPicture() {
  if (!isEmblem()) return; const f = await pickImage(); if (!f) return;
  let px; try { px = await fitPicture(f); } catch (e) { status(T('Could not use that picture: ') + e.message, 'err'); return; }
  const old = cur.tex[0].images[0];
  cur.tex[0].images[0] = Object.assign(emblemImage(px, 'picture'), { stickers: old.stickers });
  cur.imported = true; cur.base.name = 'Your picture';
  status(hasBackground(cur.tex[0].images[0]) ? T('This picture has a background. If you like, use «Make the background transparent».') : '');
  renderEditor();
}
function showEmblemStep() {
  const im = cur.tex[0].images[0];
  if (cur.step === 0) {
    $('#s-base').hidden = false; $('#basename').textContent = baseLabel(cur.base);
    $('#basehint').textContent = T('This is the crest you start from. In the next step you change its colours, put pictures on top of it or swap it for a picture of yours.');
    const box = $('#basetex'); box.textContent = '';
    const c = small(im, 256); c.classList.add('checker'); box.append(el('figure', {}, c));
  } else if (cur.step === 1) {
    $('#s-edit').hidden = false; $('#fromnote').hidden = true; renderEditor();
  } else {
    $('#s-efinal').hidden = false; renderEmblemPreviews();
  }
}
function renderEmblemPreviews() {
  const box = $('#eprev'); box.textContent = '';
  const src = snapCanvas(compose(cur.tex[0].images[0]));
  for (const [size, bg, label] of [[220, 'dark', 'Large'], [220, 'light', 'Large'], [72, 'dark', 'Small'], [44, 'light', 'Small']]) {
    const c = el('canvas', { width: size, height: size, class: bg }), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, size, size);
    box.append(el('figure', {}, c, el('figcaption', {}, el('small', { text: T(label) }))));
  }
}
async function generateEmblem() {
  if (busy || !isEmblem()) return;
  const name = $('#emname').value.trim(), price = Math.max(0, Math.min(9999, Math.round(+$('#emprice').value || 0)));
  if (!name) { status(T('Give the crest a name before generating it.'), 'err'); $('#emname').focus(); return; }
  const n = Math.max(store.nextEm || 0, store.emblems.reduce((m, e) => Math.max(m, e.n), 0)) + 1;
  if (n > 999) { status(T('You have reached the limit of 999 crests.'), 'err'); return; }
  busy = true; $('#next').disabled = true; $('#prev').disabled = true;
  try {
    const e = { n, name, price, from: cur.key || null }, key = emblemKey(e);
    status(T('Generating the crest…')); await sleep(30);
    const px = finalPixels(cur.tex[0].images[0]);
    const l = new Uint8Array(ESIZE * ESIZE); BC7.encode(px, ESIZE, ESIZE, l, 0); await sleep();
    const s = new Uint8Array(ESIZE * ESIZE / 4); BC7.encode(halveAlpha(px, ESIZE, ESIZE), ESIZE / 2, ESIZE / 2, s, 0);
    await writeAt([...MOD_EMBLEM_DIR, key + '.g4tx'], G4TX.build(EMBLEM_TPL.l, [key], [l]));
    await writeAt([...MOD_EMBLEM_DIR, key + '_s.g4tx'], G4TX.build(EMBLEM_TPL.s, [key + '_s01'], [s]));
    e.measure = measureEmblem(px);
    const p0 = cur.tex[0].images[0].pal[0]; e.color = p0 ? toHex(p0.to || p0.c) : '#888888';
    store.rev++; store.nextEm = n; store.emblems.push(e);
    await writeMod();
    renderMyKits(); status('');
    cur.finished = true;
    doneSteps(name, [T('On the launcher’s Mods page, check that «Custom Kits» is switched on.'), T('Open the game through Steam and choose Fantasy.'),
      T('Go to the General Store and buy the crest (it costs {price}).', { price: tokens(price) }), T('In your team, choose the crest: the ones you make sit together in a tab of their own in the crest picker (after the series tabs).')]);
  } catch (err) { console.error(err); status(T('Something went wrong while generating: ') + err.message, 'err'); }
  busy = false; $('#next').disabled = false; showStep();
}
async function deleteEmblem(e) {
  if (busy) return;
  if (!confirm(T('Delete the crest «{name}»?\n\nIf you already bought it in the game, take it off every team first: a save that still uses it may end up with a strange item.', { name: e.name }))) return;
  busy = true;
  try { store.emblems = store.emblems.filter(x => x !== e); store.rev++; await writeMod(); renderMyKits(); status(T('«{name}» deleted.', { name: e.name })); }
  catch (err) { status(T('Could not delete: ') + err.message, 'err'); }
  busy = false;
}
window.addEventListener('DOMContentLoaded', () => {
  $('#emimport').addEventListener('click', importEmblemPicture);
  $('#embg').addEventListener('click', () => { const im = curImg(); if (im && removeBackground(im)) { status(''); renderEditor(); } });
  $('#emname').addEventListener('input', () => status(''));
});
