/* Kitobcha: eski Word (.doc, Word 97-2003) fayldan matnni o'qish. Faqat matn olinadi (rasm, jadval ko'rinishi, shrift saqlanmaydi). */
(function (root) {
  "use strict";

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function fail(msg) { var e = new Error(msg); e.userMessage = msg; throw e; }

  // ---------- OLE2 (Compound File) ----------
  function readOle(b) {
    var sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    for (var i = 0; i < 8; i++) if (b[i] !== sig[i]) fail("Bu Word (.doc) fayliga oʻxshamaydi.");
    var ss = 1 << u16(b, 30), mss = 1 << u16(b, 32);
    var nFat = u32(b, 44), dirStart = u32(b, 48), cutoff = u32(b, 56);
    var miniStart = u32(b, 60), nMini = u32(b, 64), difStart = u32(b, 68), nDif = u32(b, 72);
    var END = 0xFFFFFFFE, MAXREG = 0xFFFFFFFA;
    function sec(n) { var s = 512 + n * ss; return s + ss <= b.length ? b.subarray(s, s + ss) : null; }

    // FAT sektorlari ro'yxati (DIFAT)
    var fatSecs = [], k;
    for (k = 0; k < 109 && fatSecs.length < nFat; k++) { var v = u32(b, 76 + k * 4); if (v <= MAXREG) fatSecs.push(v); }
    var d = difStart;
    for (k = 0; k < nDif && d <= MAXREG; k++) {
      var ds = sec(d); if (!ds) break;
      for (var j = 0; j < ss / 4 - 1 && fatSecs.length < nFat; j++) { var w = u32(ds, j * 4); if (w <= MAXREG) fatSecs.push(w); }
      d = u32(ds, ss - 4);
    }
    var fat = [];
    fatSecs.forEach(function (s) { var x = sec(s); if (!x) return; for (var q = 0; q < ss; q += 4) fat.push(u32(x, q)); });

    function chain(start, table) {
      var out = [], seen = {}, n = start;
      while (n <= MAXREG && !seen[n] && out.length < 1 << 22) { seen[n] = 1; out.push(n); n = table[n]; if (n === undefined) break; }
      return out;
    }
    function readBig(start, size) {
      var cs = chain(start, fat), buf = new Uint8Array(cs.length * ss), p = 0;
      cs.forEach(function (n) { var x = sec(n); if (x) buf.set(x, p); p += ss; });
      return size === undefined ? buf : buf.subarray(0, Math.min(size, buf.length));
    }

    var dir = readBig(dirStart), ents = [];
    for (var e = 0; e + 128 <= dir.length; e += 128) {
      var nl = u16(dir, e + 64), name = "";
      for (var c = 0; c < nl / 2 - 1; c++) name += String.fromCharCode(u16(dir, e + c * 2));
      ents.push({ name: name, type: dir[e + 66], start: u32(dir, e + 116), size: u32(dir, e + 120) });
    }
    if (!ents.length) fail("Fayl tuzilishi buzilgan.");
    var root0 = ents[0];

    // mini oqim (4096 baytdan kichik oqimlar)
    var miniFat = [], miniStream = null;
    function ensureMini() {
      if (miniStream) return;
      var mf = readBig(miniStart); miniFat = [];
      for (var q = 0; q + 4 <= mf.length; q += 4) miniFat.push(u32(mf, q));
      miniStream = readBig(root0.start, root0.size);
    }
    function stream(ent) {
      if (ent.size < cutoff) {
        ensureMini();
        var cs = chain(ent.start, miniFat), buf = new Uint8Array(cs.length * mss), p = 0;
        cs.forEach(function (n) { buf.set(miniStream.subarray(n * mss, n * mss + mss), p); p += mss; });
        return buf.subarray(0, ent.size);
      }
      return readBig(ent.start, ent.size);
    }
    return {
      get: function (name) {
        for (var i = 0; i < ents.length; i++) if (ents[i].type === 2 && ents[i].name === name) return stream(ents[i]);
        return null;
      }
    };
  }

  // ---------- Word matni ----------
  var cp1252 = null;
  function dec1252(bytes) {
    try { if (!cp1252) cp1252 = new TextDecoder("windows-1252"); return cp1252.decode(bytes); }
    catch (e) { var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; }
  }
  function dec16(bytes) {
    var s = "", n = bytes.length - (bytes.length % 2);
    for (var i = 0; i < n; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    return s;
  }

  function wordText(ole) {
    var wd = ole.get("WordDocument");
    if (!wd || wd.length < 0x1A) fail("Word hujjati topilmadi: fayl .doc emas yoki buzilgan.");
    var ident = u16(wd, 0), nFib = u16(wd, 2), flags = u16(wd, 0x0A);
    if (ident !== 0xA5EC && ident !== 0xA5DC) fail("Bu Word (.doc) fayliga oʻxshamaydi.");
    if (flags & 0x0100) fail("Fayl parol bilan himoyalangan. Word da parolni olib tashlab, qayta saqlang.");
    var text = "";

    if (nFib < 0x6C) {
      // Word 6/95: matn WordDocument ichida ketma-ket (8-bit)
      var fcMin = u32(wd, 0x18), fcMac = u32(wd, 0x1C);
      if (fcMac > fcMin && fcMac <= wd.length) text = dec1252(wd.subarray(fcMin, fcMac));
      else fail("Word 6/95 hujjatini oʻqib boʻlmadi.");
      return text;
    }

    // Word 97+: FIB -> CLX (piece table)
    var csw = u16(wd, 32), p = 34 + csw * 2;
    var cslw = u16(wd, p); p += 2;
    var ccpText = u32(wd, p + 3 * 4); p += cslw * 4;
    p += 2;                                         // cbRgFcLcb
    var fcClx = u32(wd, p + 33 * 8), lcbClx = u32(wd, p + 33 * 8 + 4);
    var tbl = ole.get((flags & 0x0200) ? "1Table" : "0Table");
    if (!tbl) fail("Hujjat jadvali topilmadi: fayl buzilgan.");
    if (!lcbClx || fcClx + lcbClx > tbl.length) fail("Hujjat tuzilishi oʻqilmadi (fayl buzilgan yoki juda eski).");

    var clx = tbl.subarray(fcClx, fcClx + lcbClx), o = 0;
    while (o < clx.length && clx[o] === 1) o += 3 + u16(clx, o + 1);   // Prc: o'tkazib yuboramiz
    if (clx[o] !== 2) fail("Hujjat matn jadvali topilmadi.");
    var lcb = u32(clx, o + 1), plc = clx.subarray(o + 5, o + 5 + lcb);
    var n = Math.floor((lcb - 4) / 12);
    if (n < 1) fail("Hujjatda matn topilmadi.");

    var parts = [];
    for (var i = 0; i < n; i++) {
      var cpS = u32(plc, i * 4), cpE = u32(plc, (i + 1) * 4);
      if (cpS >= ccpText) break;
      if (cpE > ccpText) cpE = ccpText;
      var len = cpE - cpS; if (len <= 0) continue;
      var fc = u32(plc, (n + 1) * 4 + i * 8 + 2), comp = (fc & 0x40000000) !== 0;
      if (comp) {
        var st = (fc & 0x3FFFFFFF) >>> 1;
        parts.push(dec1252(wd.subarray(st, st + len)));
      } else {
        parts.push(dec16(wd.subarray(fc, fc + len * 2)));
      }
    }
    return parts.join("");
  }

  // Maxsus belgilarni tozalash: maydon kodlari, rasmlar, qatorlar
  function clean(raw) {
    var out = "", stack = [], i, ch, skip = false;
    for (i = 0; i < raw.length; i++) {
      ch = raw.charCodeAt(i);
      if (ch === 0x13) { stack.push({ show: false }); skip = true; continue; }          // maydon boshi: kod
      if (ch === 0x14) { if (stack.length) { stack[stack.length - 1].show = true; } skip = stack.some(function (f) { return !f.show; }); continue; }
      if (ch === 0x15) { stack.pop(); skip = stack.some(function (f) { return !f.show; }); continue; }
      if (skip) continue;
      if (ch === 13 || ch === 7) { out += "\n"; continue; }     // abzats / katak oxiri
      if (ch === 11) { out += "\n"; continue; }                 // qator uzish
      if (ch === 12) { out += "\n\n"; continue; }               // bet uzish
      if (ch === 0x1E) { out += "-"; continue; }
      if (ch === 0x09) { out += "\t"; continue; }
      if (ch < 32 || ch === 0xFFFE || ch === 0xFFFF) continue;  // rasm (1), boshqa boshqaruv belgilari
      out += raw.charAt(i);
    }
    // katak oxirlari 2 ta \n beradi (7 + 7): ortiqcha bo'sh qatorlarni qisqartiramiz
    return out.replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]+\n/g, "\n").replace(/^\n+|\s+$/g, "");
  }

  // RTF (ba'zi ".doc" fayllar aslida RTF)
  function rtfText(s) {
    var out = "", depth = 0, skipDepth = -1, uc = 1, i = 0, ch;
    var dest = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|\*|object|themedata|colorschememapping|latentstyles|datastore|xmlnstbl|listtable|listoverridetable|rsidtbl)/;
    while (i < s.length) {
      ch = s[i];
      if (ch === "{") { depth++; i++; if (skipDepth < 0 && dest.test(s.slice(i + (s[i] === "\\" ? 1 : 0), i + 20))) skipDepth = depth; continue; }
      if (ch === "}") { if (depth === skipDepth) skipDepth = -1; depth--; i++; continue; }
      if (ch === "\\") {
        var m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40));
        if (m) {
          i += m[0].length;
          if (skipDepth >= 0) continue;
          var w = m[1], v = m[2] !== undefined ? parseInt(m[2], 10) : null;
          if (w === "par" || w === "line" || w === "row") out += "\n";
          else if (w === "tab") out += "\t";
          else if (w === "cell") out += " ";
          else if (w === "uc" && v !== null) uc = v;
          else if (w === "u" && v !== null) {
            out += String.fromCharCode(v < 0 ? v + 65536 : v);
            for (var q = 0; q < uc; q++) { if (s[i] === "\\" && s[i + 1] === "'") i += 4; else if (s[i] !== "\\" && s[i] !== "{" && s[i] !== "}") i++; }
          }
          continue;
        }
        var nx = s[i + 1];
        if (nx === "'") { var hx = parseInt(s.substr(i + 2, 2), 16); if (skipDepth < 0 && !isNaN(hx)) out += dec1252(new Uint8Array([hx])); i += 4; continue; }
        if (nx === "\\" || nx === "{" || nx === "}") { if (skipDepth < 0) out += nx; i += 2; continue; }
        i += 2; continue;
      }
      if (skipDepth < 0 && ch !== "\r" && ch !== "\n") out += ch;
      i++;
    }
    return out.replace(/\n{3,}/g, "\n\n").trim();
  }

  // bytes -> { kind: "docx" | "html" | "text", text?: string, bytes? }
  function read(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 8) fail("Fayl boʻsh yoki buzilgan.");
    if (b[0] === 0x50 && b[1] === 0x4B) return { kind: "docx" };                       // aslida .docx
    var head = dec1252(b.subarray(0, 64)).replace(/^\s+/, "");
    if (head.indexOf("{\\rtf") === 0) return { kind: "text", text: rtfText(dec1252(b)), note: "RTF" };
    if (/^<(!doctype|html|\?xml)/i.test(head)) return { kind: "html" };
    var text = clean(wordText(readOle(b)));
    if (!text) fail("Hujjatda matn topilmadi.");
    return { kind: "text", text: text, note: "doc" };
  }

  root.KBOldDoc = { read: read, _clean: clean, _rtf: rtfText };
})(typeof window !== "undefined" ? window : globalThis);
