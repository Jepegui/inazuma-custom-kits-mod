// Custom Kits: the kit busts of the player cards (the shoulders and neck under each mini-face).
// The game asks for data/dx11/menu/200_icon/10_icon_chr/uniform/<name>_<a><b>_l.g4tx, <name> = the texture's name with
// the last two digits of its number replaced by the mesh's body variant (texture u110701_10 on mesh u003355 -> u110755_10);
// a = 1 for the second neck of a body (variants 06 / 07 have two), b = 0 / 1 (same picture).
// Each bust is drawn from the game's own meshes bent into the portrait pose (pose sets of the body types) and the kit's
// texture, framed as the game's busts (fitted on existing busts), unlit; the second image is the mask of the skin.
const BUST_DIR = ['assets', 'menu', '200_icon', '10_icon_chr', 'uniform'];
const BUST_SKIN = [228, 172, 138], BUST_MASK = [181, 247, 255];
// body variant -> [pose set, pixels per metre, centre x, centre y above the top of the neck]
let BUST_CAMS = {1: [0, 426, -0.008, 0.1045], 2: [0, 414, -0.004, 0.091], 3: [1, 382, 0.0, 0.1035], 4: [1, 384, -0.002, 0.104], 5: [2, 424, -0.006, 0.0675], 6: [1, 352, 0.006, 0.084], 7: [2, 342, 0.004, 0.06], 8: [1, 440, -0.006, 0.0775]};
const BUST_NECK = {1: 1.34, 2: 1.34, 3: 1.0031, 4: 1.0029, 5: 1.595, 6: 1.885, 7: 1.9147, 8: 1.6025};
const bustVariant = mesh => { const m = /(\d\d)\.g4md$/.exec(mesh); if (!m) return 0; const n = +m[1]; return n > 50 ? n - 50 : n; };
const neckTop = ms => { let t = -1e9; for (const m of ms) for (let v = 0; v < m.pos.length; v += 3) if (Math.abs(m.pos[v]) < 0.06) t = Math.max(t, m.pos[v + 1]); return t; };

const BustRenderer = (() => {
  let gl = null, prog, loc, cv;
  const N = 1024, OUT = 256;
  const VS = `attribute vec3 p; attribute vec2 t; uniform vec4 cam; varying vec2 vt;
    void main() { vt = t; gl_Position = vec4((p.x - cam.x) * cam.z, (p.y - cam.y) * cam.z, -p.z * 0.4, 1.0); }`;
  const FS = `precision mediump float; varying vec2 vt; uniform sampler2D tex; uniform sampler2D oc; uniform sampler2D msk; uniform vec4 col; uniform vec4 skin; uniform float mode; uniform float useMsk;
    void main() {
      if (useMsk > 0.5 && texture2D(msk, vt).r > 0.5) { gl_FragColor = skin; return; }   // bare skin painted by the game (_msk)
      if (mode < 0.5) { gl_FragColor = col; return; }                      // flat colour (skin, mask)
      vec4 c = texture2D(tex, vt); float o = mode > 1.5 ? texture2D(oc, vt).r : 1.0;
      gl_FragColor = vec4(c.rgb * mix(1.0, o, 0.6), 1.0);
    }`;
  function init() {
    if (gl) return gl;
    cv = document.createElement('canvas'); cv.width = cv.height = N;
    gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable');
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    loc = { p: gl.getAttribLocation(prog, 'p'), t: gl.getAttribLocation(prog, 't'), cam: gl.getUniformLocation(prog, 'cam'), col: gl.getUniformLocation(prog, 'col'), mode: gl.getUniformLocation(prog, 'mode'), tex: gl.getUniformLocation(prog, 'tex'), oc: gl.getUniformLocation(prog, 'oc'), msk: gl.getUniformLocation(prog, 'msk'), skin: gl.getUniformLocation(prog, 'skin'), useMsk: gl.getUniformLocation(prog, 'useMsk') };
    return gl;
  }
  function texture(unit, src) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function drawMesh(m, mode, col) {
    const b = (k, data, type = gl.ARRAY_BUFFER) => { const x = gl.createBuffer(); gl.bindBuffer(type, x); gl.bufferData(type, data, gl.STREAM_DRAW); return x; };
    const bp = b('p', m.pos), bt = b('t', m.uv), bi = b('i', m.idx, gl.ELEMENT_ARRAY_BUFFER);
    gl.uniform1f(loc.mode, mode); gl.uniform4fv(loc.col, col || [0, 0, 0, 0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bt); gl.enableVertexAttribArray(loc.t); gl.vertexAttribPointer(loc.t, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bi); gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_SHORT, 0);
    gl.deleteBuffer(bp); gl.deleteBuffer(bt); gl.deleteBuffer(bi);
  }
  // 4x4 box filter of the 1024 render into 256, colours weighted by coverage (rows flipped back to the top first)
  function shrink(px) {
    const out = new Uint8Array(OUT * OUT * 4), f = N / OUT;
    for (let y = 0; y < OUT; y++) for (let x = 0; x < OUT; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
        const o = ((N - 1 - (y * f + j)) * N + x * f + i) * 4, w = px[o + 3];
        r += px[o] * w; g += px[o + 1] * w; b += px[o + 2] * w; a += w;
      }
      const o = (y * OUT + x) * 4;
      if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = a / (f * f);
    }
    return out;
  }
  // shirt: the posed meshes of the top and its extra parts (each with .part); parts: { part: { img, oc } } of the kit;
  // skin: neck meshes; cam = [x, y, pixels per metre]
  function render(shirt, skin, parts, cam) {
    init();
    gl.viewport(0, 0, N, N); gl.useProgram(prog); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
    gl.uniform4fv(loc.cam, [cam[0], cam[1], cam[2] / (OUT / 2), 0]);
    const texs = {}, made = [];
    const texOf = p => { const src = partTex(parts, p); if (!src) return null; if (!texs[src.key]) { texs[src.key] = [texture(0, src.img), src.oc ? texture(1, src.oc) : null, src.msk ? texture(2, src.msk) : null]; made.push(...texs[src.key]); } return texs[src.key]; };
    gl.uniform1i(loc.tex, 0); gl.uniform1i(loc.oc, 1); gl.uniform1i(loc.msk, 2);
    const pass = mask => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const m of shirt) {
        const t = texOf(m.part); if (!t) continue;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t[0]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t[1]); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t[2]);
        gl.uniform1f(loc.useMsk, t[2] ? 1 : 0); const sc = mask ? BUST_MASK : BUST_SKIN; gl.uniform4fv(loc.skin, [sc[0] / 255, sc[1] / 255, sc[2] / 255, 1]);
        drawMesh(m, mask ? 0 : (t[1] ? 2 : 1), [0, 0, 0, 0]);
      }
      gl.uniform1f(loc.useMsk, 0);
      const c = mask ? BUST_MASK : BUST_SKIN;
      for (const m of skin) drawMesh(m, 0, [c[0] / 255, c[1] / 255, c[2] / 255, 1]);
      const px = new Uint8Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px); return shrink(px);
    };
    const colour = pass(false), mask = pass(true);
    for (const t of made) if (t) gl.deleteTexture(t);
    return { colour, mask };
  }
  return { render, OUT };
})();

// the images of a texture the kit wrote (the top _20, the bottom _30, the extra parts), with their occlusion maps, as canvases:
// { parts: { '_20': { img, oc }, … }, top, oc, bottom, boc }
async function readKitTop(file) {
  const bytes = new Uint8Array(await (await fileAt([MOD, 'assets', 'chr', ...file.split('/')])).arrayBuffer()), g = G4TX.parse(bytes);
  const cvs = im => { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data.buffer || im.data), im.w, im.h), 0, 0); return c; };
  const parts = {};
  for (const e of g.ents) {
    const m = /(_\d\d)(oc|msk)?$/.exec(e.name); if (!m) continue;
    const im = G4TX.decodeEntry(bytes, e); if (!im) continue;
    (parts[m[1]] = parts[m[1]] || {})[m[2] || 'img'] = cvs(im);
  }
  return kitParts(parts);
}
// the parts map, with the top / bottom shortcuts the renderers use (the top: _20, or _10 for a whole suit)
function kitParts(parts) {
  const t = parts['_20'] || parts['_10'] || {}, b = parts['_30'] || {};
  return { parts, top: t.img, oc: t.oc, bottom: b.img, boc: b.oc };
}
// the image a mesh part wears: its own, else the top's (or the bottom's for a bottom part)
function partTex(parts, p) {
  const own = parts[p] && parts[p].img ? p : null, alt = p && p[1] === '3' ? '_30' : parts['_20'] ? '_20' : '_10', k = own || (parts[alt] && parts[alt].img ? alt : null);
  return k ? { key: k, img: parts[k].img, oc: parts[k].oc, msk: parts[k].msk } : null;
}
// the busts of one kit (all its uniform textures), from the textures it wrote; returns the names written ("…_x0")
async function makeBusts(k, base, progress) {
  const names = [], jobs = [];
  for (let ti = 0; ti < base.textures.length; ti++) {
    const t = base.textures[ti], file = k.files[ti];
    if (t.kind || !file || !t.busts) continue;
    const seen = {};
    for (const [mesh, skin] of t.busts) {
      const mb = mesh.split('/').pop().replace(/\.g4md$/, ''), alt = (seen[mb] = seen[mb] || []);
      if (!alt.includes(skin)) alt.push(skin);
      const a = alt.indexOf(skin); if (a > 1) continue;
      const tex = file.split('/').pop().replace(/\.g4tx$/, ''), name = `${tex.slice(0, 5)}${mb.slice(-2)}${tex.slice(7)}_${a}`;
      if (jobs.some(j => j.name === name)) continue;   // two meshes of the same body variant: one bust
      jobs.push({ ti, file, mesh, skin, name });
    }
  }
  const texCache = {};
  for (const [j, job] of jobs.entries()) {
    if (progress) progress(j + 1, jobs.length);
    if (!texCache[job.file]) texCache[job.file] = await readKitTop(job.file);
    const tx = texCache[job.file]; if (!tx.top) continue;
    let shirtRaw, skinRaw;
    try { [shirtRaw, skinRaw] = await Promise.all([loadMesh(job.mesh), loadMesh(job.skin)]); } catch (e) { console.warn('bust skipped', job.name, e.message); continue; }
    const v = bustVariant(job.mesh);
    let cam = BUST_CAMS[v];
    if (!cam) {   // another body: the camera of the variant with the nearest neck
      const top = neckTop(skinRaw); let best = null;
      for (const [vv, c] of Object.entries(BUST_CAMS)) { const d = Math.abs((BUST_NECK[vv] || 1.4) - top); if (!best || d < best[0]) best = [d, c]; }
      cam = best[1];
    }
    const pose = BUST_POSES[cam[0]];
    // the top and its extra parts (a scarf, a collar …), each with its own image; not the bottom
    const shirt = shirtRaw.filter(m => m.mat !== 1).map(m => posed(m, pose)), skin = skinRaw.map(m => posed(m, pose));
    const img = BustRenderer.render(shirt, skin, tx.parts, [cam[2], neckTop(skin) + cam[3], cam[1]]);
    const enc = rgba => { const out = new Uint8Array(256 * 256); BC7.encode(rgba, 256, 256, out, 0); return out; };
    const g4 = G4TX.build(BUST_TPL, [job.name + '0_1', job.name + '0_2'], [enc(img.colour), enc(img.mask)]);
    await writeAt([MOD, ...BUST_DIR, job.name + '0_l.g4tx'], g4);
    names.push(job.name + '0');
    if (!(j % 3)) await sleep(0);
  }
  return names;
}

// ---------- the kit icon (kit picker, shop, team dock): the game's shirt mesh with the kit's texture, in the style of the
// game's shirt icons: sleeves half lowered, turned a little, two-tone shading, dark outline, the inside of the collar dark
const ICON_VIEW = { blend: 0.9, yaw: 0.25, pitch: 0.1, slim: 0.92, line: 0.008, longBlend: 0.95, widen: 1.3 };
const IconRenderer = (() => {
  let gl = null, prog, loc, cv;
  const N = 1024, OUT = 256;
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 t; uniform mat4 mvp; uniform float grow; varying vec3 vn; varying vec2 vt;
    void main() { vn = n; vt = t; gl_Position = mvp * vec4(p + n * grow, 1.0); }`;
  const FS = `precision mediump float; varying vec3 vn; varying vec2 vt; uniform sampler2D tex; uniform sampler2D oc; uniform sampler2D msk; uniform float useOc; uniform float useMsk; uniform float line;
    void main() {
      if (useMsk > 0.5 && texture2D(msk, vt).r > 0.5) discard;   // bare skin (_msk): the game's kit icons show no arms
      if (line > 0.5) { gl_FragColor = vec4(0.11, 0.11, 0.16, 1.0); return; }
      vec3 c = texture2D(tex, vt).rgb; if (useOc > 0.5) c *= mix(1.0, texture2D(oc, vt).r, 0.55);
      vec3 n = normalize(vn); if (!gl_FrontFacing) { gl_FragColor = vec4(c * 0.32, 1.0); return; }
      float d = dot(n, normalize(vec3(-0.45, 0.55, 0.7)));
      gl_FragColor = vec4(c * (d > 0.15 ? 1.0 : 0.8) * (d > 0.75 ? 1.06 : 1.0), 1.0);
    }`;
  function init() {
    if (gl) return;
    cv = document.createElement('canvas'); cv.width = cv.height = N;
    gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable');
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const U = n => gl.getUniformLocation(prog, n);
    loc = { p: gl.getAttribLocation(prog, 'p'), n: gl.getAttribLocation(prog, 'n'), t: gl.getAttribLocation(prog, 't'), mvp: U('mvp'), grow: U('grow'), line: U('line'), tex: U('tex'), oc: U('oc'), useOc: U('useOc'), msk: U('msk'), useMsk: U('useMsk') };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function normals(m) {   // smooth normals of the posed mesh (vertices at the same place share theirs)
    const n = new Float32Array(m.pos.length), key = new Map(), id = [];
    for (let v = 0; v < m.pos.length / 3; v++) { const k = Math.round(m.pos[v * 3] * 1e4) + ',' + Math.round(m.pos[v * 3 + 1] * 1e4) + ',' + Math.round(m.pos[v * 3 + 2] * 1e4); if (!key.has(k)) key.set(k, v); id.push(key.get(k)); }
    for (let i = 0; i < m.idx.length; i += 3) {
      const P = v => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]], a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2];
      const f = cross(sub(P(b), P(a)), sub(P(c), P(a)));
      for (const v of [a, b, c]) { const r = id[v]; n[r * 3] += f[0]; n[r * 3 + 1] += f[1]; n[r * 3 + 2] += f[2]; }
    }
    for (let v = 0; v < id.length; v++) { const r = id[v], q = norm([n[r * 3], n[r * 3 + 1], n[r * 3 + 2]]); n[v * 3] = q[0]; n[v * 3 + 1] = q[1]; n[v * 3 + 2] = q[2]; }
    return n;
  }
  // the pieces of the shirt that are part of it: the biggest piece and every piece touching it (directly or through another);
  // pieces away from it, worn on the forearms or the wrists (bands, cuffs), would float beside a shirt drawn without arms
  function keepAttached(pick) {
    const key = new Map(), par = [], find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const vid = pick.map(({ m }) => { const ids = new Int32Array(m.pos.length / 3); for (let v = 0; v < ids.length; v++) { const k = Math.round(m.pos[v * 3] * 1e3) + ',' + Math.round(m.pos[v * 3 + 1] * 1e3) + ',' + Math.round(m.pos[v * 3 + 2] * 1e3); if (!key.has(k)) { key.set(k, par.length); par.push(par.length); } ids[v] = key.get(k); } return ids; });
    pick.forEach(({ idx }, j) => { for (let i = 0; i < idx.length; i += 3) { const a = find(vid[j][idx[i]]), b = find(vid[j][idx[i + 1]]), c = find(vid[j][idx[i + 2]]); par[a] = b; par[find(b)] = find(c); } });
    const pts = new Map(), size = new Map();   // the points of each piece
    pick.forEach(({ m }, j) => { for (let v = 0; v < vid[j].length; v++) { const r = find(vid[j][v]); if (!pts.has(r)) pts.set(r, []); pts.get(r).push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); } });
    for (const [r, p] of pts) size.set(r, p.length);
    if (pts.size < 2) return pick;
    const C = 0.025, grid = new Set(), cell = (x, y, z) => Math.floor(x / C) + ',' + Math.floor(y / C) + ',' + Math.floor(z / C);
    const add = r => { const p = pts.get(r); for (let i = 0; i < p.length; i += 3) grid.add(cell(p[i], p[i + 1], p[i + 2])); };
    const near = r => { const p = pts.get(r); for (let i = 0; i < p.length; i += 3) { const gx = Math.floor(p[i] / C), gy = Math.floor(p[i + 1] / C), gz = Math.floor(p[i + 2] / C); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (grid.has((gx + a) + ',' + (gy + b) + ',' + (gz + c))) return true; } return false; };
    const main = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0], kept = new Set([main]); add(main);
    for (let grew = true; grew;) { grew = false; for (const r of pts.keys()) if (!kept.has(r) && near(r)) { kept.add(r); add(r); grew = true; } }
    if (kept.size === pts.size) return pick;
    return pick.map(({ m, idx, hang }, j) => {
      if (hang) return { m, idx };
      const out = []; for (let i = 0; i < idx.length; i += 3) if (kept.has(find(vid[j][idx[i]]))) out.push(idx[i], idx[i + 1], idx[i + 2]);
      return { m, idx: new Uint16Array(out) };
    }).filter(e => e.idx.length);
  }
  function blendPose(pose, f) { const out = {}; for (const [c, m] of Object.entries(pose)) out[c] = m.map((x, i) => x * f + ((i % 5 === 0) ? 1 - f : 0)); return out; }
  function view(meshes, yaw, pitch, slim = 1, widen = 1) {   // a camera that looks at the shirt; returns a function: point -> clip
    const R = [Math.cos(yaw), 0, -Math.sin(yaw), Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
    let lo = [1e9, 1e9], hi = [-1e9, -1e9], zc = 0, cnt = 0;
    for (const m of meshes) for (let v = 0; v < m.pos.length; v += 3) {
      if (m.skin && m.skin[v / 3]) continue;   // bare skin is not drawn: no part of the frame
      const x = m.pos[v] * R[0] + m.pos[v + 2] * R[2], y = m.pos[v] * R[3] + m.pos[v + 1] * R[4] + m.pos[v + 2] * R[5];
      lo = [Math.min(lo[0], x), Math.min(lo[1], y)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y)];
    }
    const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, s = 1.76 / Math.max((hi[0] - lo[0]) * slim, hi[1] - lo[1]), sx = Math.min(s * slim * widen, 1.76 / (hi[0] - lo[0]));
    // an orthographic camera (as the game's icons): x' = (Rx - cx) s, y' = (Ry - cy) s, z for depth
    const zx = -Math.sin(yaw) * Math.cos(pitch), zy = -Math.sin(pitch), zz = Math.cos(yaw) * Math.cos(pitch);
    return [R[0] * sx, R[3] * s, zx * -0.3, 0, 0, R[4] * s, zy * -0.3, 0, R[2] * sx, R[5] * s, zz * -0.3, 0, -cx * sx, -cy * s, 0, 1];
  }
  function shrink(px) {
    const out = new Uint8ClampedArray(OUT * OUT * 4), f = N / OUT;
    for (let y = 0; y < OUT; y++) for (let x = 0; x < OUT; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const o = ((N - 1 - (y * f + j)) * N + x * f + i) * 4, w = px[o + 3]; r += px[o] * w; g += px[o + 1] * w; b += px[o + 2] * w; a += w; }
      const o = (y * OUT + x) * 4; if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; } out[o + 3] = a / (f * f);
    }
    return out;
  }
  // shirtRaw: the parsed meshes of the shirt (all materials); tx: canvases {top, oc, bottom, boc} of the kit;
  // hang: for a coat or a dress, the triangles of the bottom meshes that hang from the shirt (else null); set: pose set
  function render(shirtRaw, tx, hang, set, o = {}) {
    init();
    const long = !!(hang && tx.bottom), pose = blendPose(BUST_POSES[set || 0], o.blend ?? (long ? ICON_VIEW.longBlend : ICON_VIEW.blend));
    // the top and its extra parts (a scarf, a collar …), and for a long coat what hangs from it
    const pick = shirtRaw.filter(m => m.mat !== 1).map(m => ({ m, idx: m.idx }));
    if (hang && tx.bottom) shirtRaw.forEach((m, i) => { if (m.mat === 1 && hang[i] && hang[i].length) pick.push({ m, idx: hang[i], hang: true }); });
    const mskPx = {}, skinOf = m => {   // the vertices on bare skin (red in the part's _msk image)
      const src = partTex(tx.parts || {}, m.part); if (!src || !src.msk) return null;
      const c = src.msk, d = mskPx[src.key] || (mskPx[src.key] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data), out = new Uint8Array(m.uv.length / 2);
      for (let v = 0; v < out.length; v++) { const x = Math.min(c.width - 1, Math.max(0, Math.floor(m.uv[v * 2] * c.width))), y = Math.min(c.height - 1, Math.max(0, Math.floor(m.uv[v * 2 + 1] * c.height))); out[v] = d[(y * c.width + x) * 4] > 128 ? 1 : 0; }
      return out;
    };
    const meshes = keepAttached(pick).map(({ m, idx }) => { const p = { ...posed(m, pose), idx }; return { ...p, nrm: normals(p), skin: skinOf(m) }; });
    const mvp = view(meshes, o.yaw ?? ICON_VIEW.yaw, o.pitch ?? ICON_VIEW.pitch, o.slim ?? ICON_VIEW.slim, long ? (o.widen ?? ICON_VIEW.widen) : 1);   // a long coat: wider, as the game draws them
    gl.viewport(0, 0, N, N); gl.useProgram(prog); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(loc.mvp, false, new Float32Array(mvp));
    const mk = src => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const parts = tx.parts || { '_20': { img: tx.top, oc: tx.oc }, '_30': { img: tx.bottom, oc: tx.boc } }, texs = {};
    const texOf = p => { const src = partTex(parts, p); if (!src) return null; return texs[src.key] || (texs[src.key] = [mk(src.img), src.oc ? mk(src.oc) : null, src.msk ? mk(src.msk) : null]); };
    gl.uniform1i(loc.tex, 0); gl.uniform1i(loc.oc, 1); gl.uniform1i(loc.msk, 2);
    const bufs = meshes.filter(m => texOf(m.part)).map(m => {
      const b = (data, type = gl.ARRAY_BUFFER) => { const x = gl.createBuffer(); gl.bindBuffer(type, x); gl.bufferData(type, data, gl.STATIC_DRAW); return x; };
      return { p: b(m.pos), n: b(m.nrm), t: b(m.uv), i: b(m.idx, gl.ELEMENT_ARRAY_BUFFER), count: m.idx.length, tex: texOf(m.part) };
    });
    const draw = () => { for (const b of bufs) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.tex[0]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex[1]); gl.uniform1f(loc.useOc, b.tex[1] ? 1 : 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, b.tex[2]); gl.uniform1f(loc.useMsk, b.tex[2] ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.t); gl.enableVertexAttribArray(loc.t); gl.vertexAttribPointer(loc.t, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
    } };
    // the outline: the back faces, pushed out along their normals, in the dark colour; then the shirt itself
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.uniform1f(loc.line, 1); gl.uniform1f(loc.grow, o.line ?? ICON_VIEW.line); draw();
    gl.disable(gl.CULL_FACE); gl.uniform1f(loc.line, 0); gl.uniform1f(loc.grow, 0); draw();
    const px = new Uint8Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (const b of bufs) { gl.deleteBuffer(b.p); gl.deleteBuffer(b.n); gl.deleteBuffer(b.t); gl.deleteBuffer(b.i); }
    for (const t of Object.values(texs)) for (const x of t) if (x) gl.deleteTexture(x);
    const out = document.createElement('canvas'); out.width = out.height = OUT;
    out.getContext('2d').putImageData(new ImageData(shrink(px), OUT, OUT), 0, 0);
    return out;
  }
  return { render };
})();
// the icon of a kit from its first texture (the main kit of the fielders); top / oc canvases
async function kitIcon(base, tx, o) {
  const t = base.textures.find(x => !x.kind && x.role.startsWith('Campo · principal')) || base.textures.find(x => !x.kind);
  if (!t || !t.mesh || !tx || !tx.top) return null;
  const v = bustVariant(t.mesh), cam = BUST_CAMS[v] || BUST_CAMS[1];
  let hang = null; try { hang = await hangingParts(t.mesh); } catch (e) { console.warn('hang', e); }
  return IconRenderer.render(await loadMesh(t.mesh), tx, hang, cam[0], o);
}
// a coat's tails or a skirt. The bottom meshes are the shorts and legs, plus what hangs away from them: measured against the
// plain shorts and legs of the same body, if enough of the bottom sits well away from them below the crotch, the icon also
// shows the bottom's triangles that are away from the legs or above the crotch (as the game's icons of the long coats).
const hangCache = new Map();
function hangingParts(mesh) {
  if (!hangCache.has(mesh)) hangCache.set(mesh, (async () => {
    const v = bustVariant(mesh) || 1, ms = await loadMesh(mesh);
    if (!ms.some(m => m.mat === 1)) return null;
    const std = (await loadMesh(`_uniform/u000101/u0001${String(v).padStart(2, '0')}.g4md`)).filter(m => m.mat === 1);
    const C = 0.04, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    let crotch = 1e9;
    for (const m of std) for (let i = 0; i < m.pos.length; i += 3) {
      const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
      if (Math.abs(x) < 0.015) crotch = Math.min(crotch, y);
      const k = key(Math.floor(x / C), Math.floor(y / C), Math.floor(z / C)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(x, y, z);
    }
    const dist = (x, y, z) => {   // to the nearest point of the plain bottom (up to 0.08)
      const gx = Math.floor(x / C), gy = Math.floor(y / C), gz = Math.floor(z / C); let best = 0.0064;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
        const p = grid.get(key(gx + a, gy + b, gz + c)); if (!p) continue;
        for (let i = 0; i < p.length; i += 3) { const d = (p[i] - x) ** 2 + (p[i + 1] - y) ** 2 + (p[i + 2] - z) ** 2; if (d < best) best = d; }
      }
      return Math.sqrt(best);
    };
    let far = 0;
    const keep = ms.map(m => {
      if (m.mat !== 1) return null;
      const ok = new Uint8Array(m.pos.length / 3);
      for (let i = 0; i < ok.length; i++) {
        const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2], d = dist(x, y, z);
        if (d >= 0.079 && y > crotch - 0.3 && y < crotch - 0.03) far++;
        ok[i] = d > 0.03 || y > crotch ? 1 : 0;
      }
      const idx = [];
      for (let i = 0; i < m.idx.length; i += 3) if (ok[m.idx[i]] && ok[m.idx[i + 1]] && ok[m.idx[i + 2]]) idx.push(m.idx[i], m.idx[i + 1], m.idx[i + 2]);
      return new Uint16Array(idx);
    });
    return far >= 40 ? keep : null;
  })().catch(e => { hangCache.delete(mesh); throw e; }));
  return hangCache.get(mesh);
}

