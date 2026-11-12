/* Kitobcha — fayllarni PDF ga aylantirish: PDF, Word (.docx), rasm, matn */
(function (root) {
  "use strict";
  var PW = 595.28, PH = 841.89;          // A4, pt
  var PX_W = 794, PX_H = 1123, PAD = 76;  // A4, 96 dpi; 76px ≈ 2 sm chekka
  var LIMIT = PX_H - 2 * PAD;

  function ext(name) { var m = /\.([^.]+)$/.exec(name || ""); return m ? m[1].toLowerCase() : ""; }

  function kindOf(file) {
    var e = ext(file.name), t = file.type || "";
    if (e === "pdf" || t === "application/pdf") return "pdf";
    if (e === "docx") return "docx";
    if (e === "doc") return "olddoc";
    if (["txt", "md", "csv", "log"].indexOf(e) >= 0 || t === "text/plain") return "txt";
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].indexOf(e) >= 0 || /^image\//.test(t)) return "img";
    return "unknown";
  }

  var CSS =
    ".kb-host{font-family:'Times New Roman','Liberation Serif',Times,serif;font-size:16px;line-height:1.35;color:#000;}" +
    ".kb-host.kb-mono{font-family:'Courier New','Liberation Mono',monospace;font-size:14px;line-height:1.3;}" +
    ".kb-page{width:" + PX_W + "px;height:" + PX_H + "px;padding:" + PAD + "px;box-sizing:border-box;overflow:hidden;background:#fff;margin:0 0 20px 0;}" +
    ".kb-body{width:100%;}" +
    ".kb-host p{margin:0 0 8px 0;} .kb-host h1{font-size:26px;margin:0 0 10px;} .kb-host h2{font-size:22px;margin:0 0 9px;}" +
    ".kb-host h3{font-size:19px;margin:0 0 8px;} .kb-host h4,.kb-host h5,.kb-host h6{font-size:16px;margin:0 0 8px;}" +
    ".kb-host ul,.kb-host ol{margin:0 0 8px 0;padding-left:28px;}" +
    ".kb-host table{border-collapse:collapse;width:100%;margin:0 0 10px;} .kb-host td,.kb-host th{border:1px solid #000;padding:3px 5px;vertical-align:top;}" +
    ".kb-host img{max-width:100%;max-height:900px;} .kb-host pre,.kb-host .kb-txt{white-space:pre-wrap;word-wrap:break-word;margin:0 0 10px;}";

  function ensureStyle() {
    if (document.getElementById("kb-style")) return;
    var s = document.createElement("style"); s.id = "kb-style"; s.textContent = CSS; document.head.appendChild(s);
  }

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function canvasToJpegBytes(canvas, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) {
        if (!b) return rej(new Error("Rasm yasab boʻlmadi"));
        b.arrayBuffer().then(function (ab) { res(new Uint8Array(ab)); }, rej);
      }, "image/jpeg", q);
    });
  }

  // ---------- PDF (burilgan betlarni toʻgʻrilab) ----------
  async function fromPdfLib(bytes) {
    var PL = root.PDFLib;
    var src = await PL.PDFDocument.load(bytes, { ignoreEncryption: true });
    var n = src.getPageCount(), rot = false, i, idx = [];
    for (i = 0; i < n; i++) { idx.push(i); if (src.getPage(i).getRotation().angle % 360 !== 0) rot = true; }
    // keyingi bosqichlarda xato chiqmasligi uchun hamma betni sinab koʻramiz
    var out = await PL.PDFDocument.create();
    var emb = await out.embedPdf(src, idx);
    if (!rot) return { bytes: bytes, pages: n };
    idx.forEach(function (k) {
      var a = ((src.getPage(k).getRotation().angle % 360) + 360) % 360, e = emb[k], w = e.width, h = e.height;
      var pg = out.addPage(a === 90 || a === 270 ? [h, w] : [w, h]);
      if (a === 0) pg.drawPage(e, { x: 0, y: 0 });
      else if (a === 90) pg.drawPage(e, { x: 0, y: w, rotate: PL.degrees(-90) });
      else if (a === 180) pg.drawPage(e, { x: w, y: h, rotate: PL.degrees(-180) });
      else pg.drawPage(e, { x: h, y: 0, rotate: PL.degrees(90) });
    });
    return { bytes: await out.save(), pages: n };
  }

  // Zaxira usul: nostandart PDF ni har betini rasmga aylantirib qayta yigʻish (pdf.js bilan)
  async function rasterPdf(bytes, onProgress) {
    var lib = root.pdfjsLib, PL = root.PDFLib;
    if (!lib) throw new Error("PDF nostandart, uni tiklash kutubxonasi yuklanmadi");
    var pdf;
    try { pdf = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
    catch (e) {
      if (e && e.name === "PasswordException") throw new Error("Fayl parol bilan himoyalangan.");
      throw new Error("PDF faylni oʻqib boʻlmadi (shikastlangan).");
    }
    var out = await PL.PDFDocument.create(), sc = 170 / 72;
    for (var k = 1; k <= pdf.numPages; k++) {
      if (onProgress) onProgress("Nostandart PDF qayta yigʻilmoqda: " + k + " / " + pdf.numPages);
      var pg = await pdf.getPage(k), v1 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: sc });
      var cv = document.createElement("canvas");
      cv.width = Math.round(v.width); cv.height = Math.round(v.height);
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: v }).promise;
      var jpg = await canvasToJpegBytes(cv, 0.88);
      var img = await out.embedJpg(jpg);
      out.addPage([v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
      cv.width = cv.height = 1;
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return { bytes: await out.save(), pages: pdf.numPages, rebuilt: true };
  }

  async function fromPdf(file, onProgress) {
    var bytes = new Uint8Array(await file.arrayBuffer());
    try { return await fromPdfLib(bytes); }
    catch (e) { return rasterPdf(bytes, onProgress); }
  }

  // ---------- Rasm ----------
  async function fromImage(file) {
    var PL = root.PDFLib;
    var bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { bmp = await createImageBitmap(file); }
    var k = Math.min(1, 3200 / Math.max(bmp.width, bmp.height));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    var jpg = await canvasToJpegBytes(c, 0.9);
    var out = await PL.PDFDocument.create(), img = await out.embedJpg(jpg);
    var land = c.width > c.height, pw = land ? PH : PW, ph = land ? PW : PH, m = 18;
    var s = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
    var w = img.width * s, h = img.height * s;
    var page = out.addPage([pw, ph]);
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    return { bytes: await out.save(), pages: 1 };
  }

  // ---------- HTML -> A4 betlar -> PDF ----------
  function waitImages(el) {
    var imgs = Array.prototype.slice.call(el.querySelectorAll("img"));
    return Promise.all(imgs.map(function (im) {
      return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
    }));
  }

  async function htmlToPdf(html, mono, onProgress) {
    ensureStyle();
    var PL = root.PDFLib;
    var host = document.createElement("div");
    host.className = "kb-host" + (mono ? " kb-mono" : "");
    host.style.cssText = "position:absolute;left:-12000px;top:0;width:" + PX_W + "px;";
    document.body.appendChild(host);
    try {
      var src = document.createElement("div");
      src.innerHTML = html;
      await waitImages(src);
      var blocks = Array.prototype.slice.call(src.children);
      var pages = [], cur = null;

      function newPage() {
        var p = document.createElement("div"); p.className = "kb-page";
        var b = document.createElement("div"); b.className = "kb-body"; p.appendChild(b);
        host.appendChild(p); pages.push(p); cur = b; return b;
      }
      function over() { return cur.offsetHeight > LIMIT; }
      function shell(block) {
        var s = block.cloneNode(false);
        if (block.tagName === "TABLE") { var tb = document.createElement("tbody"); s.appendChild(tb); return { el: s, tgt: tb }; }
        return { el: s, tgt: s };
      }
      function splitBlock(block) {
        var isTable = block.tagName === "TABLE";
        var items = isTable ? Array.prototype.slice.call(block.rows) : Array.prototype.slice.call(block.children);
        var start0 = parseInt(block.getAttribute("start") || "1", 10);
        var sh = shell(block);
        cur.appendChild(sh.el);
        for (var j = 0; j < items.length; j++) {
          var it = items[j];
          sh.tgt.appendChild(it);
          if (!over()) continue;
          if (sh.tgt.children.length > 1) sh.tgt.removeChild(it);       // bu element keyingi betga
          else if (cur.children.length > 1) cur.removeChild(sh.el);     // hech biri sigʻmadi: butun blokni koʻchiramiz
          else continue;                                                 // betdan baland, shunday qoldiramiz
          newPage();
          sh = shell(block);
          if (block.tagName === "OL") sh.el.setAttribute("start", String(start0 + j));
          cur.appendChild(sh.el);
          sh.tgt.appendChild(it);
        }
      }
      function place(block) {
        cur.appendChild(block);
        if (!over()) return;
        cur.removeChild(block);
        var splittable = /^(TABLE|UL|OL)$/.test(block.tagName);
        if (splittable) { splitBlock(block); return; }
        if (cur.children.length) newPage();
        cur.appendChild(block);
      }

      newPage();
      blocks.forEach(function (b) { src.removeChild(b); });
      blocks.forEach(place);

      var out = await PL.PDFDocument.create();
      for (var i = 0; i < pages.length; i++) {
        if (onProgress) onProgress("Betlar yasalmoqda: " + (i + 1) + " / " + pages.length);
        var canvas = await root.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", logging: false });
        var jpg = await canvasToJpegBytes(canvas, 0.85);
        var img = await out.embedJpg(jpg);
        out.addPage([PW, PH]).drawImage(img, { x: 0, y: 0, width: PW, height: PH });
        canvas.width = canvas.height = 1;
        await new Promise(function (r) { setTimeout(r, 0); });
      }
      return { bytes: await out.save(), pages: pages.length };
    } finally {
      document.body.removeChild(host);
    }
  }

  async function fromDocx(file, onProgress) {
    if (!root.mammoth) throw new Error("Word kutubxonasi yuklanmadi");
    if (onProgress) onProgress("Word fayl oʻqilmoqda…");
    var res = await root.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToPdf(res.value, false, onProgress);
  }

  async function fromText(file, onProgress) {
    var text = (await file.text()).replace(/\r\n?/g, "\n");
    var paras = text.split(/\n{2,}/).map(function (p) { return '<div class="kb-txt">' + esc(p) + "</div>"; });
    return htmlToPdf(paras.join(""), true, onProgress);
  }

  async function toPdf(file, onProgress) {
    var k = kindOf(file);
    if (k === "pdf") return fromPdf(file, onProgress);
    if (k === "img") return fromImage(file);
    if (k === "docx") return fromDocx(file, onProgress);
    if (k === "txt") return fromText(file, onProgress);
    if (k === "olddoc") throw new Error("Eski .doc formati oʻqilmaydi. Word da “Saqlash” → .docx yoki PDF qilib saqlang.");
    throw new Error("Bu format qoʻllab-quvvatlanmaydi (PDF, Word .docx, rasm, .txt mumkin).");
  }

  // Bir nechta PDF ni birlashtirish
  async function merge(list) {
    if (list.length === 1) return list[0];
    var PL = root.PDFLib, out = await PL.PDFDocument.create();
    for (var i = 0; i < list.length; i++) {
      var d = await PL.PDFDocument.load(list[i], { ignoreEncryption: true });
      var idx = d.getPageIndices();
      var cp = await out.copyPages(d, idx);
      cp.forEach(function (p) { out.addPage(p); });
    }
    return out.save();
  }

  root.KBConvert = { kindOf: kindOf, toPdf: toPdf, merge: merge, _raster: rasterPdf };
})(window);
