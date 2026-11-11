/* Kitobcha — yadro: betlarni joylashtirish va PDF yasash (DOM kerak emas) */
(function (root) {
  "use strict";

  var MM = 72 / 25.4;
  var PAPER = { A4: [595.28, 841.89], A3: [841.89, 1190.55], Letter: [612, 792] };

  // "1-10, 15, 20-30" -> [0..9, 14, 19..29]
  function parseRange(str, n) {
    var out = [], parts = String(str).split(",");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(p);
      if (!m) return { error: "“" + p + "” notoʻgʻri yozilgan. Masalan: 1-169" };
      var a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || b < 1 || a > n || b > n) return { error: "Betlar 1 dan " + n + " gacha boʻlishi kerak." };
      if (a <= b) { for (var k = a; k <= b; k++) out.push(k - 1); }
      else { for (var k2 = a; k2 >= b; k2--) out.push(k2 - 1); }
    }
    if (!out.length) return { error: "Birorta bet tanlanmadi." };
    return { pages: out };
  }

  // Kitobcha: har varaq = old [chap, oʻng] + orqa [chap, oʻng]
  function bookletSheets(pages, per, rtl) {
    var sections = [];
    if (per > 0) {
      for (var i = 0; i < pages.length; i += per * 4) sections.push(pages.slice(i, i + per * 4));
    } else {
      sections.push(pages);
    }
    var sheets = [], blanks = 0;
    sections.forEach(function (sec) {
      var t = Math.ceil(sec.length / 4) * 4;
      blanks += t - sec.length;
      var P = sec.slice();
      while (P.length < t) P.push(null);
      for (var k = 0; k < t / 4; k++) {
        var front = [P[t - 1 - 2 * k], P[2 * k]];
        var back = [P[2 * k + 1], P[t - 2 - 2 * k]];
        if (rtl) { front.reverse(); back.reverse(); }
        sheets.push({ front: front, back: back });
      }
    });
    return { sheets: sheets, blanks: blanks, sections: sections.length };
  }

  // Har varaqda size ta bet (ketma-ket), cols ustunli setka
  function gridGroups(pages, size, cols, rtl) {
    var out = [];
    for (var i = 0; i < pages.length; i += size) {
      var g = pages.slice(i, i + size);
      while (g.length < size) g.push(null);
      if (rtl) {
        var rows = [];
        for (var r = 0; r < size / cols; r++) rows.push(g.slice(r * cols, (r + 1) * cols).reverse());
        g = [].concat.apply([], rows);
      }
      out.push(g);
    }
    return out;
  }

  var MODES = {
    booklet2: { cols: 2, rows: 1, landscape: true },
    bookletDuplex: { cols: 2, rows: 1, landscape: true },
    nup2: { cols: 2, rows: 1, landscape: true },
    nup4: { cols: 2, rows: 2, landscape: false },
    oddeven: { cols: 1, rows: 1, landscape: false },
    extract: { cols: 1, rows: 1, landscape: false }
  };

  function num(i) { return i === null ? "boʻsh" : String(i + 1); }

  // opts: {mode, n, range, per, rtl, test, paper}
  function planFor(o) {
    var r = parseRange(o.range, o.n);
    if (r.error) return { error: r.error };
    if (o.rotate && String(o.rotate).trim()) {
      var rr = parseRange(o.rotate, o.n);
      if (rr.error) return { error: "Burish: " + rr.error };
    }
    var pages = r.pages, mode = o.mode, plan = { mode: mode, pages: pages, preview: [], blanks: 0, sections: 1 };
    if (mode === "booklet2" || mode === "bookletDuplex") {
      var b = bookletSheets(pages, o.per > 0 ? o.per : 0, !!o.rtl);
      plan.totalSheets = b.sheets.length;
      plan.sheets = o.test ? b.sheets.slice(0, 2) : b.sheets;
      plan.blanks = b.blanks; plan.sections = b.sections;
      plan.preview = plan.sheets.slice(0, 3).map(function (s, k) {
        return { title: (k + 1) + "-varaq", front: num(s.front[0]) + " | " + num(s.front[1]), back: num(s.back[0]) + " | " + num(s.back[1]) };
      });
      plan.outputs = mode === "booklet2"
        ? [{ key: "front", label: "1. Old tomon", hint: "Avval shuni chiqaring", suffix: "_kitobcha_1_oldi" },
           { key: "back", label: "2. Orqa tomon", hint: "Varaqlarni aylantirib solib, keyin shuni chiqaring", suffix: "_kitobcha_2_orqa" }]
        : [{ key: "duplex", label: "Kitobcha (bitta fayl)", hint: "Avtomatik ikki tomonlama printer uchun", suffix: "_kitobcha_duplex" }];
    } else if (mode === "nup2" || mode === "nup4") {
      var size = mode === "nup2" ? 2 : 4, cols = 2;
      var g = gridGroups(pages, size, cols, !!o.rtl);
      plan.totalSheets = g.length;
      plan.groups = o.test ? g.slice(0, 2) : g;
      plan.outputs = [{ key: "nup", label: "Har varaqda " + size + " bet", hint: "Bitta PDF", suffix: "_" + size + "ta_varaqda" }];
    } else if (mode === "oddeven") {
      var cnt = Math.ceil(pages.length / 2), sh = [];
      for (var k = 0; k < cnt; k++) sh.push({ front: pages[2 * k], back: 2 * k + 1 < pages.length ? pages[2 * k + 1] : null });
      plan.totalSheets = cnt;
      plan.blanks = cnt * 2 - pages.length;
      plan.sheets = o.test ? sh.slice(0, 2) : sh;
      plan.outputs = [{ key: "front", label: "1. Toq betlar (1, 3, 5…)", hint: "Avval shuni chiqaring", suffix: "_1_toq_betlar" },
                      { key: "back", label: "2. Juft betlar (2, 4, 6…)", hint: "Qogʻozni aylantirib solib, keyin shuni chiqaring", suffix: "_2_juft_betlar" }];
    } else {
      plan.totalSheets = pages.length;
      plan.outputs = [{ key: "extract", label: "Tanlangan betlar (PDF)", hint: pages.length + " bet", suffix: "_tanlangan" }];
    }
    return plan;
  }

  function dims(o) {
    var p = PAPER[o.paper] || PAPER.A4, m = MODES[o.mode];
    var w = Math.min(p[0], p[1]), h = Math.max(p[0], p[1]);
    return m.landscape ? [h, w] : [w, h];
  }

  function used(plan) {
    var u = {};
    function add(i) { if (i !== null && i !== undefined) u[i] = true; }
    if (plan.sheets) plan.sheets.forEach(function (sh) { [].concat(sh.front, sh.back).forEach(add); });
    if (plan.groups) plan.groups.forEach(function (g) { g.forEach(add); });
    if (plan.mode === "extract") plan.pages.forEach(add);
    return u;
  }

  // Burish va sahifa raqami: betlar indeksi oʻzgarmaydi
  async function prepare(masterBytes, o, plan) {
    var rotTxt = String(o.rotate || "").trim();
    if (!rotTxt && !o.pageNum) return masterBytes;
    var PL = root.PDFLib;
    var src = await PL.PDFDocument.load(masterBytes, { ignoreEncryption: true });
    var n = src.getPageCount(), i;
    var rot = {};
    if (rotTxt) parseRange(rotTxt, n).pages.forEach(function (x) { rot[x] = true; });
    var ang = parseInt(o.angle, 10) || 90;
    var numMap = {};
    if (o.pageNum) {
      var st = parseInt(o.numStart, 10); if (isNaN(st)) st = 1;
      plan.pages.forEach(function (x, k) { numMap[x] = st + k; });
    }
    var u = used(plan), mod = [], keep = [];
    for (i = 0; i < n; i++) if (u[i]) ((rot[i] || numMap[i] !== undefined) ? mod : keep).push(i);
    var out = await PL.PDFDocument.create();
    var font = o.pageNum ? await out.embedFont(PL.StandardFonts.Helvetica) : null;
    var embMod = mod.length ? await out.embedPdf(src, mod) : [];
    var copied = keep.length ? await out.copyPages(src, keep) : [];
    var mi = {}, ki = {};
    mod.forEach(function (x, j) { mi[x] = embMod[j]; });
    keep.forEach(function (x, j) { ki[x] = copied[j]; });
    var crop = (parseFloat(o.crop) || 0) * MM;
    for (i = 0; i < n; i++) {
      if (mi[i]) {
        var e = mi[i], w = e.width, h = e.height, a = rot[i] ? ang : 0;
        var swap = (a === 90 || a === 270), pw = swap ? h : w, ph = swap ? w : h;
        var pg = out.addPage([pw, ph]);
        if (a === 0) pg.drawPage(e, { x: 0, y: 0 });
        else if (a === 90) pg.drawPage(e, { x: 0, y: w, rotate: PL.degrees(-90) });
        else if (a === 180) pg.drawPage(e, { x: w, y: h, rotate: PL.degrees(-180) });
        else pg.drawPage(e, { x: h, y: 0, rotate: PL.degrees(90) });
        if (numMap[i] !== undefined) {
          var t = String(numMap[i]), tw = font.widthOfTextAtSize(t, 10);
          pg.drawText(t, { x: (pw - tw) / 2, y: Math.max(14, crop + 10), size: 10, font: font, color: PL.rgb(0, 0, 0) });
        }
      } else if (ki[i]) out.addPage(ki[i]);
      else out.addPage([10, 10]);
    }
    return out.save();
  }

  async function drawSheets(masterBytes, groups, o) {
    var PL = root.PDFLib, m = MODES[o.mode], wh = dims(o), W = wh[0], H = wh[1];
    var src = await PL.PDFDocument.load(masterBytes, { ignoreEncryption: true });
    var out = await PL.PDFDocument.create();
    var usedIdx = {}, list = [];
    groups.forEach(function (g) { g.forEach(function (i) { if (i !== null && !usedIdx[i]) { usedIdx[i] = true; list.push(i); } }); });
    var crop = (parseFloat(o.crop) || 0) * MM;
    var pgs = list.map(function (i) { return src.getPage(i); });
    var boxes = pgs.map(function (pg) {
      var z = pg.getSize(), c = Math.max(0, Math.min(crop, z.width / 2 - 1, z.height / 2 - 1));
      return { left: c, bottom: c, right: z.width - c, top: z.height - c };
    });
    var emb = await out.embedPages(pgs, boxes), map = {};
    list.forEach(function (idx, j) { map[idx] = emb[j]; });
    var fit = Math.min(100, Math.max(60, parseFloat(o.scale) || 95)) / 100;
    var gut = (o.mode === "booklet2" || o.mode === "bookletDuplex") ? Math.max(0, parseFloat(o.margin) || 0) * MM : 0;
    var sw = W / m.cols, sh = H / m.rows, aw = sw - gut;
    groups.forEach(function (g) {
      var page = out.addPage([W, H]);
      g.forEach(function (idx, k) {
        if (idx === null) return;
        var c = k % m.cols, r = Math.floor(k / m.cols), e = map[idx];
        var ax = c * sw + (c === 1 ? gut : 0);
        var s = fit * Math.min(aw / e.width, sh / e.height);
        var w = e.width * s, h = e.height * s;
        var x = ax + (aw - w) / 2, y = H - (r + 1) * sh + (sh - h) / 2;
        page.drawPage(e, { x: x, y: y, width: w, height: h });
        if (o.frame) page.drawRectangle({ x: x, y: y, width: w, height: h, borderWidth: 0.5, borderColor: PL.rgb(0.55, 0.55, 0.55) });
      });
    });
    return out;
  }

  // Asl oʻlchamda koʻchirish (null = boʻsh bet)
  async function copyPagesOut(masterBytes, idxs, o) {
    var PL = root.PDFLib;
    var src = await PL.PDFDocument.load(masterBytes, { ignoreEncryption: true });
    var out = await PL.PDFDocument.create();
    var real = idxs.filter(function (i) { return i !== null; });
    var first = real.length ? real[0] : 0;
    var size = src.getPage(first).getSize();
    var crop = (parseFloat(o && o.crop) || 0) * MM, copied = [], j = 0;
    if (crop > 0) {
      var pgs = real.map(function (i) { return src.getPage(i); });
      var boxes = pgs.map(function (pg) {
        var z = pg.getSize(), c = Math.max(0, Math.min(crop, z.width / 2 - 1, z.height / 2 - 1));
        return { left: c, bottom: c, right: z.width - c, top: z.height - c };
      });
      var emb = await out.embedPages(pgs, boxes);
      idxs.forEach(function (i) {
        if (i === null) { out.addPage([size.width, size.height]); return; }
        var e = emb[j++], pg = out.addPage([e.width, e.height]);
        pg.drawPage(e, { x: 0, y: 0 });
      });
      return out;
    }
    copied = await out.copyPages(src, real);
    idxs.forEach(function (i) {
      if (i === null) out.addPage([size.width, size.height]);
      else out.addPage(copied[j++]);
    });
    return out;
  }

  // Rangsiz: har bir sahifa rasmga aylantirilib, kulrang qilinadi (hamma printerda bir xil ishlaydi)
  async function grayRaster(bytes, onProgress) {
    var lib = root.pdfjsLib, PL = root.PDFLib;
    if (!lib) throw new Error("Rangsiz rejim uchun kutubxona yuklanmadi");
    var pdf = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    var out = await PL.PDFDocument.create(), sc = 200 / 72;
    for (var k = 1; k <= pdf.numPages; k++) {
      if (onProgress) onProgress("Rangsiz qilinmoqda: " + k + " / " + pdf.numPages);
      var pg = await pdf.getPage(k), v1 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: sc });
      var cv = document.createElement("canvas");
      cv.width = Math.round(v.width); cv.height = Math.round(v.height);
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: v }).promise;
      var im = ctx.getImageData(0, 0, cv.width, cv.height), d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        var y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      ctx.putImageData(im, 0, 0);
      var blob = await new Promise(function (r) { cv.toBlob(r, "image/jpeg", 0.9); });
      var jpg = new Uint8Array(await blob.arrayBuffer());
      var img = await out.embedJpg(jpg);
      out.addPage([v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
      cv.width = cv.height = 1;
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return out.save();
  }

  async function buildDoc(masterBytes, o, plan, key) {
    var mode = plan.mode;
    if (mode === "booklet2") {
      var sheets = plan.sheets.slice();
      if (key === "back" && o.rev) sheets.reverse();
      return drawSheets(masterBytes, sheets.map(function (s) { return s[key]; }), o);
    }
    if (mode === "bookletDuplex") {
      var g = [];
      plan.sheets.forEach(function (s) { g.push(s.front, s.back); });
      return drawSheets(masterBytes, g, o);
    }
    if (mode === "nup2" || mode === "nup4") return drawSheets(masterBytes, plan.groups, o);
    if (mode === "oddeven") {
      var sh = plan.sheets.slice();
      if (key === "back" && o.rev) sh.reverse();
      return copyPagesOut(masterBytes, sh.map(function (s) { return s[key]; }), o);
    }
    return copyPagesOut(masterBytes, plan.pages, o);
  }

  async function make(masterBytes, o, plan, key, onProgress) {
    var prepared = await prepare(masterBytes, o, plan);
    var doc = await buildDoc(prepared, o, plan, key);
    var bytes = await doc.save();
    return o.gray ? grayRaster(bytes, onProgress) : bytes;
  }

  root.KB = { PAPER: PAPER, MODES: MODES, parseRange: parseRange, planFor: planFor, make: make };
})(typeof window !== "undefined" ? window : globalThis);
