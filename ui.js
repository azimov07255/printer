/* Kitobcha: umumiy interfeys qismlari (ilova va yo'riqnoma uchun) */
(function (root) {
  "use strict";
  var KBUI = {};
  var doc = document;

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------- mavzu (yorugʻ / qorongʻi) ----------
  function applyTheme(t) {
    var r = doc.documentElement;
    if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
    var dark = t === "dark" || (!t && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", dark ? "#0b1512" : "#0f5a43");
  }
  KBUI.initTheme = function () {
    applyTheme(lsGet("kb_theme"));
    var btn = doc.getElementById("themeBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = doc.documentElement.getAttribute("data-theme");
      var isDark = cur === "dark" || (!cur && root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = isDark ? "light" : "dark";
      lsSet("kb_theme", next); applyTheme(next);
    });
  };
  applyTheme(lsGet("kb_theme"));

  // ---------- rejim ikonkalari (SVG) ----------
  var HUES = [158, 205, 28, 280, 340, 92, 240, 12];
  function hue(i) { return HUES[i % HUES.length]; }

  function grid(x, y, w, h, cols, rows, labels, o) {
    o = o || {};
    var s = "", cw = w / cols, ch = h / rows, i = 0, r, c;
    s += '<rect class="i-sheet" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"/>';
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++, i++) {
      var cx = x + c * cw + 2, cy = y + r * ch + 2, cwid = cw - 4, chei = ch - 4;
      var st = o.colors ? ' style="--h:' + hue(i) + '"' : "";
      s += '<rect class="i-cell' + (o.colors ? " i-col" : "") + '"' + st + ' x="' + cx + '" y="' + cy + '" width="' + cwid + '" height="' + chei + '" rx="1.6"/>';
      if (labels && labels[i] !== undefined) {
        s += '<text class="i-num" x="' + (cx + cwid / 2) + '" y="' + (cy + chei / 2 + 3) + '" text-anchor="middle">' + labels[i] + "</text>";
      }
    }
    if (o.fold) s += '<line class="i-fold" x1="' + (x + w / 2) + '" y1="' + (y + 1) + '" x2="' + (x + w / 2) + '" y2="' + (y + h - 1) + '"/>';
    if (o.cut) {
      for (c = 1; c < cols; c++) s += '<line class="i-cut" x1="' + (x + c * cw) + '" y1="' + (y - 1) + '" x2="' + (x + c * cw) + '" y2="' + (y + h + 1) + '"/>';
      for (r = 1; r < rows; r++) s += '<line class="i-cut" x1="' + (x - 1) + '" y1="' + (y + r * ch) + '" x2="' + (x + w + 1) + '" y2="' + (y + r * ch) + '"/>';
    }
    return s;
  }

  KBUI.icon = function (mode) {
    var s = "";
    switch (mode) {
      case "booklet2":
        s += '<rect class="i-sheet i-ghost" x="14" y="12" width="52" height="36" rx="3"/>';
        s += grid(8, 6, 52, 36, 2, 1, ["4", "1"], { fold: true });
        s += '<circle class="i-badge" cx="62" cy="46" r="8"/><text class="i-badge-t" x="62" y="49.5" text-anchor="middle">2</text>';
        break;
      case "bookletDuplex":
        s += grid(10, 8, 52, 36, 2, 1, ["4", "1"], { fold: true });
        s += '<circle class="i-badge" cx="62" cy="46" r="8"/><text class="i-badge-t" x="62" y="49.5" text-anchor="middle">1</text>';
        break;
      case "oddeven":
        s += '<rect class="i-sheet i-ghost" x="26" y="4" width="34" height="46" rx="3"/>';
        s += grid(14, 8, 34, 46, 1, 1, ["1"], {});
        s += '<path class="i-arrow" d="M54 12 q8 8 0 18 m0 0 l-1 -5 m1 5 l5 -1"/>';
        break;
      case "nup2":
        s += grid(8, 8, 56, 40, 2, 1, ["1", "2"], {});
        break;
      case "nup4":
        s += grid(16, 2, 40, 52, 2, 2, ["1", "2", "3", "4"], {});
        break;
      case "cards4":
        s += grid(16, 2, 40, 52, 2, 2, ["1", "2", "3", "4"], { colors: true, cut: true });
        break;
      case "cards8":
        s += grid(6, 8, 60, 40, 4, 2, ["1", "2", "3", "4", "5", "6", "7", "8"], { colors: true, cut: true });
        break;
      case "extract":
        s += '<rect class="i-sheet i-ghost" x="30" y="4" width="30" height="42" rx="3"/>';
        s += '<rect class="i-sheet i-ghost" x="22" y="8" width="30" height="42" rx="3"/>';
        s += grid(14, 12, 30, 40, 1, 1, [""], {});
        s += '<path class="i-check" d="M22 32 l5 5 l11 -13"/>';
        break;
      default:
        s += grid(10, 8, 52, 40, 1, 1, [""], {});
    }
    return '<svg class="ico" viewBox="0 0 72 56" aria-hidden="true" focusable="false">' + s + "</svg>";
  };

  // data-ico="mode" boʻlgan elementlarga ikonka qoʻyish
  KBUI.fillIcons = function (scope) {
    Array.prototype.forEach.call((scope || doc).querySelectorAll("[data-ico]"), function (n) {
      n.innerHTML = KBUI.icon(n.getAttribute("data-ico"));
    });
  };

  // ---------- aylanadigan varaq ko'rsatkichi ----------
  // spec: { landscape, cols, rows, sheets: [{front:[idx|null], back:[idx|null]|null}], cardMode, label(i)->text, caption }
  KBUI.sheetViewer = function (host, spec) {
    var k = 0, back = false, n = spec.sheets.length;
    host.innerHTML = "";
    var wrap = doc.createElement("div"); wrap.className = "viz";
    var stage = doc.createElement("div"); stage.className = "viz-stage " + (spec.landscape ? "land" : "port");
    var flip = doc.createElement("div"); flip.className = "flip";
    var inner = doc.createElement("div"); inner.className = "flip-inner";
    var fF = doc.createElement("div"); fF.className = "face front";
    var fB = doc.createElement("div"); fB.className = "face back";
    inner.appendChild(fF); inner.appendChild(fB); flip.appendChild(inner); stage.appendChild(flip);
    var ctl = doc.createElement("div"); ctl.className = "viz-ctl";
    var prev = doc.createElement("button"); prev.type = "button"; prev.className = "vbtn"; prev.setAttribute("aria-label", "Oldingi varaq"); prev.textContent = "‹";
    var cnt = doc.createElement("span"); cnt.className = "viz-count";
    var next = doc.createElement("button"); next.type = "button"; next.className = "vbtn"; next.setAttribute("aria-label", "Keyingi varaq"); next.textContent = "›";
    var fl = doc.createElement("button"); fl.type = "button"; fl.className = "vflip";
    ctl.appendChild(prev); ctl.appendChild(cnt); ctl.appendChild(next); ctl.appendChild(fl);
    var cap = doc.createElement("p"); cap.className = "viz-cap";
    wrap.appendChild(stage); wrap.appendChild(ctl); wrap.appendChild(cap); host.appendChild(wrap);

    function cells(arr, side) {
      var h = "", r, c, i;
      for (r = 0; r < spec.rows; r++) for (c = 0; c < spec.cols; c++) {
        i = r * spec.cols + c;
        var v = arr[i], partner = side === "front" ? i : r * spec.cols + (spec.cols - 1 - c);
        var st = ' style="--h:' + hue(partner) + '"';
        if (v === null || v === undefined) h += '<div class="vcell empty"' + st + "><small>boʻsh</small></div>";
        else h += '<div class="vcell"' + st + "><b>" + esc(spec.label ? spec.label(v) : v + 1) + "</b></div>";
      }
      return '<div class="vgrid' + (spec.fold ? " fold" : "") + '" style="grid-template-columns:repeat(' + spec.cols + ',1fr);grid-template-rows:repeat(' + spec.rows + ',1fr)">' + h + "</div>";
    }
    function draw() {
      var s = spec.sheets[k];
      fF.innerHTML = cells(s.front, "front") + '<span class="vtag">Old tomon</span>';
      if (s.back) fB.innerHTML = cells(s.back, "back") + '<span class="vtag">Orqa tomon</span>';
      cnt.textContent = (spec.unit || "Varaq") + " " + (k + 1) + " / " + n;
      prev.disabled = k === 0; next.disabled = k === n - 1;
      ctl.classList.toggle("single", n < 2);
      var hasBack = !!s.back;
      fl.classList.toggle("hidden", !hasBack);
      flip.classList.toggle("noback", !hasBack);
      if (!hasBack) { back = false; }
      flip.classList.toggle("is-back", back);
      fl.textContent = back ? "↻ Old tomonga qaytarish" : "↻ Aylantirib koʻrish";
      cap.textContent = back
        ? (spec.flipHint || "Qogʻozni aylantirgandan keyin shunday koʻrinadi. Bir xil rangdagi kataklar bir-birining orqasida.")
        : (spec.caption || "");
    }
    prev.addEventListener("click", function () { if (k > 0) { k--; draw(); } });
    next.addEventListener("click", function () { if (k < n - 1) { k++; draw(); } });
    function toggle() { if (!spec.sheets[k].back) return; back = !back; draw(); }
    fl.addEventListener("click", toggle);
    stage.addEventListener("click", toggle);
    draw();
    return { setSheet: function (i) { k = Math.max(0, Math.min(n - 1, i)); draw(); } };
  };

  // ---------- konfetti ----------
  KBUI.confetti = function (anchor) {
    if (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var box = doc.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden", "true");
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: root.innerWidth / 2, top: root.innerHeight / 2, width: 0, height: 0 };
    box.style.left = (r.left + r.width / 2) + "px"; box.style.top = (r.top + r.height / 2) + "px";
    for (var i = 0; i < 26; i++) {
      var p = doc.createElement("i"), a = (Math.PI * 2 * i) / 26 + Math.random() * 0.4, d = 70 + Math.random() * 110;
      p.style.setProperty("--dx", Math.cos(a) * d + "px"); p.style.setProperty("--dy", Math.sin(a) * d - 40 + "px");
      p.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.background = "hsl(" + hue(i) * 1.0 + ",80%,58%)";
      p.style.animationDelay = Math.random() * 0.08 + "s";
      box.appendChild(p);
    }
    doc.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1600);
  };

  root.KBUI = KBUI;
})(window);
