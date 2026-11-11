/* Kitobcha — yadro: betlarni joylashtirish va PDF yasash (DOM kerak emas) */
(function (root) {
  "use strict";

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
      if (a > b) return { error: "“" + p + "” da boshlanish oxiridan katta." };
      for (var k = a; k <= b; k++) out.push(k - 1);
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

  async function drawSheets(masterBytes, groups, o) {
    var PL = root.PDFLib, m = MODES[o.mode], wh = dims(o), W = wh[0], H = wh[1];
    var src = await PL.PDFDocument.load(masterBytes, { ignoreEncryption: true });
    var out = await PL.PDFDocument.create();
    var used = {}, list = [];
    groups.forEach(function (g) { g.forEach(function (i) { if (i !== null && !used[i]) { used[i] = true; list.push(i); } }); });
    var emb = await out.embedPdf(src, list), map = {};
    list.forEach(function (idx, j) { map[idx] = emb[j]; });
    var fit = Math.min(100, Math.max(60, parseFloat(o.scale) || 95)) / 100;
    var sw = W / m.cols, sh = H / m.rows;
    groups.forEach(function (g) {
      var page = out.addPage([W, H]);
      g.forEach(function (idx, k) {
        if (idx === null) return;
        var c = k % m.cols, r = Math.floor(k / m.cols), e = map[idx];
        var s = fit * Math.min(sw / e.width, sh / e.height);
        var w = e.width * s, h = e.height * s;
        var x = c * sw + (sw - w) / 2, y = H - (r + 1) * sh + (sh - h) / 2;
        page.drawPage(e, { x: x, y: y, width: w, height: h });
        if (o.frame) page.drawRectangle({ x: x, y: y, width: w, height: h, borderWidth: 0.5, borderColor: PL.rgb(0.55, 0.55, 0.55) });
      });
    });
    return out.save();
  }

  // Asl oʻlchamda koʻchirish (null = boʻsh bet)
  async function copyPagesOut(masterBytes, idxs) {
    var PL = root.PDFLib;
    var src = await PL.PDFDocument.load(masterBytes, { ignoreEncryption: true });
    var out = await PL.PDFDocument.create();
    var first = idxs.filter(function (i) { return i !== null; })[0];
    var size = src.getPage(first === undefined ? 0 : first).getSize();
    var real = idxs.filter(function (i) { return i !== null; });
    var copied = await out.copyPages(src, real), j = 0;
    idxs.forEach(function (i) {
      if (i === null) out.addPage([size.width, size.height]);
      else out.addPage(copied[j++]);
    });
    return out.save();
  }

  async function build(masterBytes, o, plan, key) {
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
      return copyPagesOut(masterBytes, sh.map(function (s) { return s[key]; }));
    }
    return copyPagesOut(masterBytes, plan.pages);
  }

  root.KB = { PAPER: PAPER, MODES: MODES, parseRange: parseRange, planFor: planFor, build: build };
})(typeof window !== "undefined" ? window : globalThis);
