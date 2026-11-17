// Custom Kits: 3D preview with the game's own kit meshes (reference\data\common\chr\_uniform\*.g4md + .g4mg),
// in their rest pose (T-pose), with the kit's textures as they are being edited.

// ---------- G4MD / G4MG: the mesh list (0x50 bytes per mesh from 0xa0) and the vertex / index data
// mesh entry: +0 vertex offset, +4 index offset (bytes), +8 vertex count, +0xc index count, +0x34 LOD mask, +0x43 material
// vertex: position float3 at 0, normal s16x4 at 0x0c, uv unorm16x2 at 0x40; indices u16, a triangle list
function parseG4M(mdBuf, mgBuf, allLods) {
  const md = new DataView(mdBuf), mg = new DataView(mgBuf);
  if (md.getUint32(0, true) !== 0x444d3447) throw new Error('not a G4MD file');
  const n = md.getUint16(0x20, true), nb = md.getUint16(0x24, true), vsize = md.getUint32(0x50, true), ibase = md.getUint32(0x5c, true);
  // section pointers at 0x60 (u16, in 4-byte units from 0xa0): [10] the bones (crc32 of their names), [17] the bone palettes
  const sec = k => md.getUint16(0x60 + k * 2, true) * 4 + 0xa0;
  const bones = []; for (let b = 0; b < nb; b++) bones.push(md.getUint32(sec(10) + b * 4, true));
  // [19] the material names (u070801_20M, …): a mesh's material byte is an index into them, and the name says which image
  // of the texture it wears (_20 the top, _30 the bottom, _21 / _22 / _40 … extra parts, _10 a whole suit). Not always in
  // that order: some cuts list _30M first.
  const mats = [], ms = sec(19), first = md.getUint16(ms, true);
  for (let k = 0; k < first / 2 && k < 16; k++) {
    const o = md.getUint16(ms + k * 2, true); if (!o) continue;
    let name = ''; for (let p = ms + o; p < md.byteLength && md.getUint8(p); p++) name += String.fromCharCode(md.getUint8(p));
    const m = /_(\d\d)M/.exec(name); mats.push(m ? '_' + m[1] : null);
  }
  const ents = [];
  for (let k = 0; k < n; k++) {
    const o = 0xa0 + k * 0x50;
    ents.push({ voff: md.getUint32(o, true), ioff: md.getUint32(o + 4, true), vcnt: md.getUint32(o + 8, true), icnt: md.getUint32(o + 12, true), lod: md.getUint32(o + 0x34, true), mat: md.getUint8(o + 0x43), pstart: md.getUint16(o + 0x3a, true), pcnt: md.getUint8(o + 0x3c), stride: md.getUint8(o + 0x3e) });
  }
  const avg = Math.round(vsize / ents.reduce((s, e) => s + e.vcnt, 0)) || 68;
  return ents.filter(e => allLods || (e.lod & 1)).map(e => {   // the most detailed level only (and the parts shown at every level)
    const pos = new Float32Array(e.vcnt * 3), nrm = new Float32Array(e.vcnt * 3), uv = new Float32Array(e.vcnt * 2), w = new Float32Array(e.vcnt * 4), bi = new Uint8Array(e.vcnt * 4);
    // each mesh's own vertex size (+0x3e): 68 with the uv as two unorm16, 72 with it as two floats (a few cuts mix both)
    const stride = e.stride === 68 || e.stride === 72 ? e.stride : avg, fuv = stride === 72;
    for (let v = 0; v < e.vcnt; v++) {
      const b = e.voff + v * stride;
      for (let c = 0; c < 3; c++) { pos[v * 3 + c] = mg.getFloat32(b + c * 4, true); nrm[v * 3 + c] = mg.getInt16(b + 0x0c + c * 2, true) / 32767; }
      if (fuv) { uv[v * 2] = mg.getFloat32(b + 0x40, true); uv[v * 2 + 1] = mg.getFloat32(b + 0x44, true); }
      else { uv[v * 2] = mg.getUint16(b + 0x40, true) / 65535; uv[v * 2 + 1] = mg.getUint16(b + 0x42, true) / 65535; }
      for (let c = 0; c < 4; c++) { w[v * 4 + c] = mg.getUint16(b + 0x24 + c * 2, true) / 65535; bi[v * 4 + c] = mg.getUint8(b + 0x34 + c); }
    }
    const idx = new Uint16Array(e.icnt);
    for (let i = 0; i < e.icnt; i++) idx[i] = mg.getUint16(ibase + e.ioff + i * 2, true);
    const palette = []; for (let i = 0; i < e.pcnt; i++) palette.push(bones[md.getUint16(sec(17) + (e.pstart + i) * 2, true)]);
    const part = mats[e.mat] || (e.mat === 1 ? '_30' : '_20');
    // mat: the kind of the part (0 the top or a whole suit, 1 the bottom, 2 an extra part such as a scarf); part: its image
    return { mat: /^_[12]/.test(part) ? 0 : part[1] === '3' ? 1 : 2, part, pos, nrm, uv, idx, w, bi, palette };
  });
}
// the mesh bent into a pose: skin matrices (4x4, row-major) by bone crc; bones without one stay put
function posed(m, pose) {
  const M = m.palette.map(c => pose[c] || null), out = new Float32Array(m.pos.length);
  for (let v = 0; v < m.pos.length / 3; v++) {
    const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0, tw = 0;
    for (let j = 0; j < 4; j++) {
      const w = m.w[v * 4 + j]; if (!w) continue; const a = M[m.bi[v * 4 + j]];
      if (!a) { ox += w * x; oy += w * y; oz += w * z; tw += w; continue; }
      ox += w * (a[0] * x + a[1] * y + a[2] * z + a[3]); oy += w * (a[4] * x + a[5] * y + a[6] * z + a[7]); oz += w * (a[8] * x + a[9] * y + a[10] * z + a[11]); tw += w;
    }
    if (!tw) { ox = x; oy = y; oz = z; }
    out[v * 3] = ox; out[v * 3 + 1] = oy; out[v * 3 + 2] = oz;
  }
  return { ...m, pos: out };
}

const Viewer3D = (() => {
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 t; uniform mat4 mvp; uniform vec2 uvScale; varying vec3 vn; varying vec2 vt;
    void main() { vn = n; vt = t * uvScale; gl_Position = mvp * vec4(p, 1.0); }`;
  const FS = `precision mediump float; varying vec3 vn; varying vec2 vt; uniform sampler2D tex; uniform sampler2D oc; uniform sampler2D msk; uniform vec4 col; uniform float useTex; uniform float useOc; uniform float useMsk; uniform float alphaCut;
    void main() {
      vec3 n = normalize(vn);
      float l = 0.62 + 0.38 * max(dot(n, normalize(vec3(0.3, 0.6, 0.8))), 0.0) + 0.12 * max(dot(n, normalize(vec3(-0.5, 0.3, -0.8))), 0.0);
      vec4 c = useTex > 0.5 ? texture2D(tex, vt) : col;
      if (c.a < alphaCut) discard;
      if (useMsk > 0.5 && texture2D(msk, vt).r > 0.5) c = vec4(vec3(0.91, 0.77, 0.635), 1.0);   // the skin the game paints over the texture (its _msk image)
      float o = useOc > 0.5 ? texture2D(oc, vt).r : 1.0;
      gl_FragColor = vec4(c.rgb * o * min(l, 1.1), 1.0);
    }`;
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function lookAt(e, c) {
    const f = norm(sub(c, e)), s = norm(cross(f, [0, 1, 0])), u = cross(s, f);
    return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1];
  }

  function create(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const L = n => gl.getUniformLocation(prog, n);
    const loc = { p: gl.getAttribLocation(prog, 'p'), n: gl.getAttribLocation(prog, 'n'), t: gl.getAttribLocation(prog, 't'), mvp: L('mvp'), col: L('col'), use: L('useTex'), useOc: L('useOc'), oc: L('oc'), msk: L('msk'), useMsk: L('useMsk'), tex: L('tex'), uvScale: L('uvScale'), cut: L('alphaCut') };
    const gpu = new Map(), textures = {};
    let parts = [], yaw = 0, pitch = 0.08, dist = 3.1, target = [0, 0.68, 0];
    // a mesh on the GPU, once per mesh object
    function bufs(m) {
      if (gpu.has(m)) return gpu.get(m);
      const mk = (type, data) => { const b = gl.createBuffer(); gl.bindBuffer(type, b); gl.bufferData(type, data, gl.STATIC_DRAW); return b; };
      const b = { p: mk(gl.ARRAY_BUFFER, m.pos), n: mk(gl.ARRAY_BUFFER, m.nrm), t: mk(gl.ARRAY_BUFFER, m.uv), i: mk(gl.ELEMENT_ARRAY_BUFFER, m.idx), count: m.idx.length };
      gpu.set(m, b); return b;
    }
    function setTexture(name, src) {
      if (!src) { textures[name] = null; return; }
      const t = textures[name] || gl.createTexture(); textures[name] = t;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const pot = x => (x & (x - 1)) === 0;
      if (pot(src.width) && pot(src.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];
    function draw() {
      const w = canvas.clientWidth || 400, h = canvas.clientHeight || 400, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
      if (!parts.length) return;
      const e = [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
      gl.useProgram(prog); gl.uniformMatrix4fv(loc.mvp, false, new Float32Array(mul(persp(0.55, canvas.width / canvas.height, 0.05, 20), lookAt(e, target))));
      gl.uniform1i(loc.tex, 0); gl.uniform1i(loc.oc, 1); gl.uniform1i(loc.msk, 2);
      for (const p of parts) {
        const b = bufs(p.mesh), t = p.tex && textures[p.tex], o = p.oc && textures[p.oc], k = p.msk && textures[p.msk];
        gl.uniform1f(loc.use, t ? 1 : 0); gl.uniform1f(loc.useOc, o ? 1 : 0); gl.uniform1f(loc.useMsk, k ? 1 : 0);
        if (k) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, k); } gl.uniform4fv(loc.col, hex(p.color || '#d8d8d8'));
        gl.uniform2fv(loc.uvScale, p.uvScale || [1, 1]); gl.uniform1f(loc.cut, p.alphaCut || 0);
        if (t) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); }
        if (o) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o); }
        gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.t); gl.enableVertexAttribArray(loc.t); gl.vertexAttribPointer(loc.t, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    let queued = false; const redraw = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; draw(); }); };
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; yaw = drag[2] - (e.clientX - drag[0]) * 0.01; pitch = Math.max(-0.5, Math.min(1.0, drag[3] + (e.clientY - drag[1]) * 0.006)); redraw(); });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(0.8, Math.min(6, dist * (e.deltaY > 0 ? 1.08 : 0.93))); redraw(); }, { passive: false });
    return {
      setTexture, redraw,
      setParts(list) { parts = list; redraw(); },
      view(which) { yaw = which === 'back' ? Math.PI : which === 'side' ? Math.PI / 2 : 0; pitch = 0.08; redraw(); },
    };
  }
  return { create };
})();
