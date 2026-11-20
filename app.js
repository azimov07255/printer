(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KB = window.KB, CV = window.KBConvert;

  var el = {
    drop: $("drop"), file: $("file"), status: $("status"), msg: $("msg"),
    listCard: $("listCard"), list: $("fileList"), total: $("total"),
    settings: $("settings"), mode: $("mode"), modeHint: $("modeHint"), range: $("range"),
    paper: $("paper"), scale: $("scale"), section: $("section"),
    sides: $("sides"), rtl: $("rtl"), frame: $("frame"), rev: $("rev"), test: $("test"),
    margin: $("margin"), crop: $("crop"), rotate: $("rotate"), angle: $("angle"),
    pageNum: $("pageNum"), numStart: $("numStart"), gray: $("gray"), previewBtn: $("previewBtn"), previewOut: $("previewOut"),
    summary: $("summary"), preview: $("preview"), outputs: $("outputs"), steps: $("steps"),
    modeGrid: $("modeGrid"), viz: $("viz"), sampleBtn: $("sampleBtn"), previewLbl: $("previewLbl"), update: $("update")
  };
  var UI = window.KBUI;
  if (UI) { UI.initTheme(); }

  var planErr = false, entries = [], nextId = 1, masterBytes = null, masterN = 0, plan = null, busy = false, lastN = 0;

  // ---------- sozlamalarni eslab qolish ----------
  function load(k, d) { try { var v = localStorage.getItem("kb_" + k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("kb_" + k, String(v)); } catch (e) {} }
  el.mode.value = load("mode", "booklet2");
  el.paper.value = load("paper", "A4");
  el.scale.value = load("scale", "95");
  el.section.value = load("section", "0");
  el.sides.value = load("sides", "2");
  el.rtl.checked = load("rtl", "0") === "1";
  el.frame.checked = load("frame", "0") === "1";
  el.rev.checked = load("rev", "0") === "1";
  el.margin.value = load("margin", "");
  el.crop.value = load("crop", "");
  el.angle.value = load("angle", "90");
  el.numStart.value = load("numStart", "1");
  el.pageNum.checked = load("pageNum", "0") === "1";
  el.gray.checked = load("gray", "0") === "1";
  if (!el.mode.value) el.mode.value = "booklet2";

  // ---------- rejim kartochkalari ----------
  var MODE_INFO = [
    { key: "booklet2", title: "Kitobcha", sub: "oddiy printer · 2 fayl" },
    { key: "bookletDuplex", title: "Kitobcha", sub: "avto-duplex · 1 fayl" },
    { key: "oddeven", title: "Ikki tomonlama", sub: "qoʻlda: toq va juft betlar" },
    { key: "nup2", title: "Varaqda 2 bet", sub: "qogʻoz 2 barobar kam" },
    { key: "nup4", title: "Varaqda 4 bet", sub: "qogʻoz 4 barobar kam" },
    { key: "cards4", title: "Kartochka ×4", sub: "qirqib olish, old + orqa", tag: "Yangi" },
    { key: "cards8", title: "Kartochka ×8", sub: "kichik kartochkalar", tag: "Yangi" },
    { key: "labels", title: "Qutiga stiker", sub: "rasm qutining oʻlchamida", tag: "Yangi" },
    { key: "extract", title: "Kerakli betlar", sub: "yangi PDF qilib olish" }
  ];
  function isCards(m) { return m === "cards4" || m === "cards8"; }
  function buildModes() {
    el.modeGrid.innerHTML = "";
    MODE_INFO.forEach(function (mi) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "mode"; b.setAttribute("role", "radio"); b.setAttribute("data-key", mi.key);
      b.innerHTML = (mi.tag ? '<span class="tag">' + mi.tag + "</span>" : "") + (UI ? UI.icon(mi.key) : "") + "<b>" + mi.title + "</b><small>" + mi.sub + "</small>";
      b.addEventListener("click", function () {
        if (el.mode.value === mi.key) return;
        el.mode.value = mi.key; save("mode", mi.key); refresh();
      });
      el.modeGrid.appendChild(b);
    });
  }
  function markModes() {
    Array.prototype.forEach.call(el.modeGrid.children, function (b) {
      b.setAttribute("aria-checked", b.getAttribute("data-key") === el.mode.value ? "true" : "false");
    });
  }
  buildModes();

  // ---------- yordamchilar ----------
  function msg(kind, text) {
    el.msg.innerHTML = "";
    if (!text) return;
    var d = document.createElement("div"); d.className = "msg " + kind; d.textContent = text; el.msg.appendChild(d);
  }
  function status(text) {
    if (!text) { el.status.classList.add("hidden"); el.status.textContent = ""; return; }
    el.status.classList.remove("hidden"); el.status.textContent = text;
  }
  function mb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function baseName() {
    var ok = entries.filter(function (e) { return e.state === "ok"; });
    if (!ok.length) return "kitob";
    var b = ok[0].name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_");
    return ok.length > 1 ? b + "_birlashgan" : b;
  }
  function saveFile(bytes, filename) {
    var url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    var a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  // ---------- fayllarni qoʻshish ----------
  el.drop.addEventListener("click", function () { el.file.click(); });
  el.drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.file.click(); } });
  ["dragenter", "dragover"].forEach(function (ev) { el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.remove("over"); }); });
  el.drop.addEventListener("drop", function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });
  el.file.addEventListener("change", function () { addFiles(el.file.files); el.file.value = ""; });

  async function addFiles(fl) {
    if (!fl || !fl.length || busy) return;
    busy = true; msg("", "");
    var fresh = Array.prototype.map.call(fl, function (f) {
      var e = { id: nextId++, file: f, name: f.name, kind: CV.kindOf(f), state: "wait", bytes: null, pages: 0, error: "" };
      entries.push(e); return e;
    });
    renderList();
    for (var i = 0; i < fresh.length; i++) {
      var e = fresh[i];
      e.state = "busy"; renderList();
      try {
        status(e.name + " oʻqilmoqda…");
        var r = await CV.toPdf(e.file, function (t) { status(e.name + ": " + t); });
        e.bytes = r.bytes; e.pages = r.pages; e.note = r.note || ""; e.box = r.box || null; e.state = "ok";
      } catch (err) {
        e.state = "err"; e.error = (err && err.message) || "Oʻqib boʻlmadi";
      }
      renderList();
    }
    status("");
    var bad = fresh.filter(function (e) { return e.state === "err"; });
    var notes = fresh.filter(function (e) { return e.state === "ok" && e.note; });
    if (bad.length) msg("err", bad.map(function (e) { return e.name + ": " + e.error; }).join("\n"));
    else if (notes.length) msg("warn", notes.map(function (e) { return e.name + ": " + e.note; }).join("\n"));
    entries = entries.filter(function (e) { return e.state === "ok"; });
    busy = false;
    await rebuildMaster();
  }

  async function rebuildMaster() {
    renderList();
    if (!entries.length) {
      masterBytes = null; masterN = 0; el.settings.classList.add("hidden"); plan = null; return;
    }
    try {
      status("Birlashtirilmoqda…");
      masterBytes = await CV.merge(entries.map(function (e) { return e.bytes; }));
      masterN = entries.reduce(function (s, e) { return s + e.pages; }, 0);
      lab.boxes = {}; var bi = 0;
      entries.forEach(function (e) { for (var q = 0; q < e.pages; q++, bi++) if (e.box && e.pages === 1) lab.boxes[bi] = e.box; });
      lab.doc = null; lab.cache = {}; lab.crops = {}; lab.shown = -1; lab.cur = 0;
    } catch (err) {
      status(""); msg("err", "Fayllarni birlashtirib boʻlmadi: " + ((err && err.message) || ""));
      return;
    }
    status("");
    if (masterN !== lastN || !el.range.value) { el.range.value = "1-" + masterN; lastN = masterN; }
    el.settings.classList.remove("hidden");
    refresh();
  }

  function renderList() {
    el.list.innerHTML = "";
    el.listCard.classList.toggle("hidden", !entries.length);
    var pages = 0;
    entries.forEach(function (e, i) {
      var li = document.createElement("li");
      var bd = document.createElement("span"); bd.className = "badge";
      bd.textContent = { pdf: "PDF", docx: "DOCX", olddoc: "DOC", img: "RASM", txt: "TXT" }[e.kind] || "FAYL"; li.appendChild(bd);
      var n = document.createElement("span"); n.className = "name"; n.textContent = e.name; li.appendChild(n);
      var m = document.createElement("span"); m.className = "meta";
      m.textContent = e.state === "busy" ? "oʻqilmoqda…" : e.state === "wait" ? "kutmoqda" : e.state === "err" ? "xato" : e.pages + " bet";
      li.appendChild(m);
      if (e.state === "ok") {
        pages += e.pages;
        [["↑", -1], ["↓", 1], ["✕", 0]].forEach(function (b) {
          var btn = document.createElement("button");
          btn.textContent = b[0]; btn.setAttribute("aria-label", b[1] < 0 ? "Yuqoriga" : b[1] > 0 ? "Pastga" : "Olib tashlash");
          btn.disabled = busy || (b[1] < 0 && i === 0) || (b[1] > 0 && i === entries.length - 1);
          btn.addEventListener("click", function () {
            if (busy) return;
            if (b[1] === 0) entries.splice(i, 1);
            else { var t = entries[i]; entries[i] = entries[i + b[1]]; entries[i + b[1]] = t; }
            rebuildMaster();
          });
          li.appendChild(btn);
        });
      }
      el.list.appendChild(li);
    });
    el.total.textContent = pages ? "jami " + pages + " bet" : "";
  }

  // ---------- rejalash ----------
  var HINTS = {
    booklet2: "Betlar kitobcha tartibida joylashtiriladi. Ikki fayl chiqadi: avval old tomon, keyin qogʻozni aylantirib orqa tomon.",
    bookletDuplex: "Printeringiz avtomatik ikki tomonlama (duplex) boʻlsa: kitobcha bitta faylda chiqadi.",
    oddeven: "Oddiy hujjatni qogʻozning ikki tomoniga chiqarish: avval toq betlar, keyin juft betlar.",
    nup2: "Har varaqqa 2 ta bet sigʻadi (albom). Qogʻoz 2 marta kam ketadi.",
    cards4: "Har varaqqa 4 ta kartochka (2×2) chiqadi. Qaychi bilan qirqib olasiz, orqasida davomi boʻladi. Hujjatning har 2 beti = 1 kartochka (old va orqa).",
    cards8: "Har varaqqa 8 ta kichik kartochka (4×2, albom) chiqadi. Qaychi bilan qirqib olasiz, orqasida davomi boʻladi. Hujjatning har 2 beti = 1 kartochka. Yozuv kichik chiqadi, kartochka oʻlchamida (A7) tayyorlangan hujjat eng yaxshi.",
    labels: "Rasm qutining old tomoni oʻlchamida chiqadi. Varaqqa imkon qadar koʻp stiker joylanadi, qolganini qaychi bilan qirqib, qutiga yopishtirasiz. Avval “Sinov: faqat kontur” ni chiqarib, oʻlchamni qutida tekshiring.",
    nup4: "Har varaqqa 4 ta bet sigʻadi. Qogʻoz 4 marta kam ketadi. Kichik yozuv uchun juda mayda boʻlishi mumkin.",
    extract: "Faqat tanlangan betlar bilan yangi PDF yasaydi."
  };
  var STEPS = {
    booklet2: [
      "Fayllarni PDF dasturida (masalan, Foxit) oching. Chop etishda <b>Масштаб / Scale</b> tanlang (Booklet emas), masshtab <b>100%</b>, qogʻoz tanlagan oʻlchamingiz, yoʻnalish <b>Albom (Landscape)</b>.",
      "Avval <b>old tomon</b> faylini hammasini chiqaring.",
      "Chiqqan qogʻozlarni tartibini buzmasdan <b>qisqa qirra atrofida</b> (kitob varagʻini ag‘dargandek) aylantirib printerga qayta soling.",
      "<b>Orqa tomon</b> faylini chiqaring.",
      "Birinchi marta <b>sinov</b> bilan tekshiring: 1-varaqning orqasida 2-bet toʻgʻri turishi kerak. Teskari chiqsa, qogʻozni boshqa tomonga solib koʻring yoki “orqa tomon teskari tartibda” ni yoqing.",
      "Chiqqan varaqlarni oʻrtasidan buking."
    ],
    bookletDuplex: [
      "Faylni PDF dasturida oching. Chop etishda <b>Масштаб / Scale</b> tanlang (Booklet emas), masshtab <b>100%</b>, yoʻnalish <b>Albom (Landscape)</b>.",
      "Printer sozlamasida <b>ikki tomonlama</b> chop etishni yoqing va <b>qisqa qirra boʻyicha aylantirish (Flip on short edge)</b> ni tanlang.",
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring. Orqa tomon teskari chiqsa, aylantirish sozlamasini boshqasiga (Short edge ↔ Long edge) almashtiring. Keyin hammasini chiqaring va varaqlarni oʻrtasidan buking."
    ],
    oddeven: [
      "Avval <b>toq betlar</b> faylini chiqaring (masshtab 100%).",
      "Chiqqan qogʻozlarni tartibini buzmasdan <b>uzun qirra atrofida</b> (kitob varagʻini ag‘dargandek) aylantirib qayta soling.",
      "<b>Juft betlar</b> faylini chiqaring.",
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring. Varaqlar tartibi teskari chiqsa, “orqa tomon teskari tartibda” ni yoqing."
    ],
    cards4: [
      "Faylni PDF dasturida oching. Chop etishda masshtab <b>100%</b> (Fit/Shrink emas), yoʻnalish <b>Kitob (Portrait)</b>.",
      "Avtomatik ikki tomonlama printer: <b>ikki tomonlama</b> chop etishni yoqing va <b>uzun qirra boʻyicha aylantirish (Flip on long edge)</b> ni tanlang. Bitta fayl yetarli.",
      "Oddiy printer: avval <b>old tomon</b> faylini chiqaring, qogʻozni tartibini buzmasdan <b>uzun qirra atrofida</b> aylantirib solib, <b>orqa tomon</b> faylini chiqaring.",
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring: old va orqa tomon bir-biriga toʻgʻri tushishi kerak. Teskari chiqsa, aylantirish sozlamasini boshqasiga (Short edge ↔ Long edge) almashtiring.",
      "Punktir chiziqlar boʻyicha qaychi bilan 4 ta kartochkaga qirqing."
    ],
    labels: [
      "Avval <b>“Sinov: faqat kontur”</b> faylini oddiy qogʻozga chiqaring va qutiga qoʻyib koʻring: kontur qutining old tomoniga mos tushishi kerak. Mos kelmasa, oʻlchamni tuzatib qayta urinib koʻring.",
      "Stikerlar faylini PDF dasturida oching. Chop etishda masshtab <b>100%</b> (Fit/Shrink emas) boʻlsin, oʻlchamini bilmasangiz “Actual size” ni tanlang.",
      "Qogʻoz: oddiy, yaltiroq fotoqogʻoz yoki oʻz-oʻzidan yopishuvchi (stiker) qogʻoz. Printer sifati <b>“Yuqori / Photo”</b> boʻlsin.",
      "Chiqqan varaqda har stikerning burchaklarida <b>qora chiziqchalar</b> bor. Qaychi bilan shu chiziqchalar orasidan qirqing.",
      "Qirqilgan stikerni qutining old tomoniga yopishtiring."
    ],
    cards8: [
      "Faylni PDF dasturida oching. Chop etishda masshtab <b>100%</b> (Fit/Shrink emas), yoʻnalish <b>Albom (Landscape)</b>.",
      "Avtomatik ikki tomonlama printer: <b>ikki tomonlama</b> chop etishni yoqing va <b>qisqa qirra boʻyicha aylantirish (Flip on short edge)</b> ni tanlang. Bitta fayl yetarli.",
      "Oddiy printer: avval <b>old tomon</b> faylini chiqaring, qogʻozni tartibini buzmasdan <b>qisqa qirra atrofida</b> aylantirib solib, <b>orqa tomon</b> faylini chiqaring.",
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring: old va orqa tomon bir-biriga toʻgʻri tushishi kerak. Teskari chiqsa, aylantirish sozlamasini boshqasiga (Short edge ↔ Long edge) almashtiring.",
      "Punktir chiziqlar boʻyicha qaychi bilan 8 ta kartochkaga qirqing."
    ],
    nup2: ["Faylni oddiy chiqaring: masshtab <b>100%</b>, yoʻnalish <b>Albom (Landscape)</b>.", "Ikki tomonlama kerak boʻlsa, printer sozlamasidan yoqing (qisqa qirra boʻyicha)."],
    nup4: ["Faylni oddiy chiqaring: masshtab <b>100%</b>, yoʻnalish <b>Kitob (Portrait)</b>.", "Ikki tomonlama kerak boʻlsa, printer sozlamasidan yoqing (uzun qirra boʻyicha)."],
    extract: ["Faylni saqlang va istalgan PDF dasturida oching yoki chiqaring."]
  };

  function opts() {
    return {
      mode: el.mode.value, n: masterN, range: el.range.value, per: parseInt(el.section.value, 10) || 0,
      sides: el.sides.value, rtl: el.rtl.checked, frame: el.frame.checked, rev: el.rev.checked, test: el.test.checked,
      paper: el.paper.value, scale: el.scale.value,
      margin: el.margin.value, crop: el.crop.value, rotate: el.rotate.value, angle: el.angle.value,
      pageNum: el.pageNum.checked, numStart: el.numStart.value, gray: el.gray.checked,
      lab: labGet()
    };
  }

  function refresh() {
    if (!masterBytes) return;
    var m = el.mode.value;
    document.querySelectorAll("[data-modes]").forEach(function (n) {
      n.classList.toggle("hidden", n.getAttribute("data-modes").split(" ").indexOf(m) < 0);
    });
    el.modeHint.textContent = HINTS[m] || "";
    markModes();
    el.steps.innerHTML = (STEPS[m] || []).map(function (s) { return "<li>" + s + "</li>"; }).join("");

    var o = opts();
    plan = KB.planFor(o);
    el.preview.innerHTML = ""; el.outputs.innerHTML = ""; el.previewOut.innerHTML = ""; el.viz.innerHTML = "";
    if (plan.error) {
      el.summary.textContent = ""; msg("err", plan.error); planErr = true; return;
    }
    if (planErr) { msg("", ""); planErr = false; }

    function stat(n, label) { return '<div class="stat"><b>' + n + "</b><span>" + label + "</span></div>"; }
    var arrow = '<div class="stat arrow">→</div>', s = stat(plan.pages.length, m === "extract" ? "bet tanlandi" : "bet");
    var orient = m === "nup4" || m === "cards4" ? "kitob" : m === "oddeven" ? "" : "albom";
    if (m === "labels") {
      s = stat(plan.pages.length, "rasm") + arrow + stat(plan.items, "stiker") + arrow + stat(plan.totalSheets, "varaq · " + o.paper + ", " + (plan.label.landscape ? "albom" : "kitob"));
    } else if (isCards(m)) s += arrow + stat(plan.cards, "kartochka") + arrow + stat(plan.totalSheets, "varaq · " + o.paper + ", " + orient);
    else if (m !== "extract") s += arrow + stat(plan.totalSheets, "varaq · " + o.paper + (orient ? ", " + orient : ""));
    var notes = [];
    if (m === "labels") notes.push([false, "Bitta varaqqa " + plan.label.per + " ta stiker sigʻadi (" + plan.label.cols + "×" + plan.label.rows + (plan.label.rot ? ", rasm 90° burilgan" : "") + ")."]);
    if (m === "labels" && plan.emptySlots) notes.push([false, "Oxirgi varaqda " + plan.emptySlots + " ta boʻsh joy qoladi."]);
    if (isCards(m) && plan.emptySlots) notes.push([false, "Oxirgi varaqda " + plan.emptySlots + " ta boʻsh joy qoladi."]);
    if (plan.blanks) notes.push([false, "Oxirida " + plan.blanks + " ta boʻsh bet qoʻshiladi."]);
    if (plan.sections > 1) notes.push([false, plan.sections + " qism: har qism alohida kitobcha."]);
    if (o.test) notes.push([false, "Sinov rejimi: faqat 2 varaq chiqadi."]);
    if ((m === "booklet2" || m === "bookletDuplex") && plan.sections === 1 && plan.totalSheets > 20 && !o.test)
      notes.push([true, "Varaqlar koʻp, kitobcha qalin boʻlib ketadi. “Qismga boʻlish” ga 10 yoki 11 yozishni tavsiya qilamiz."]);
    notes.forEach(function (n) { s += '<div class="note' + (n[0] ? " warn" : "") + '">' + n[1] + "</div>"; });
    el.summary.innerHTML = s;
    renderViz(plan, o);
    labSync();

    if (plan.preview && plan.preview.length) {
      var t = '<details class="numlist"><summary>Betlar raqamlari roʻyxati</summary><table class="preview"><caption>' + (plan.previewCaption || "Varaqlar tartibi (chap | oʻng)") + '</caption><tr><th></th><th>Old tomon</th><th>Orqa tomon</th></tr>';
      plan.preview.forEach(function (p) { t += "<tr><td>" + p.title + "</td><td>" + p.front + "</td><td>" + p.back + "</td></tr>"; });
      el.preview.innerHTML = t + "</table></details>";
    }

    var DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M6.5 10.5 12 16l5.5-5.5M4 19.5h16"/></svg>';
    plan.outputs.forEach(function (out, idx) {
      var b = document.createElement("button"); b.className = "main" + (plan.outputs.length > 1 && idx > 0 && /duplex$/.test(plan.outputs[0].key) ? " alt" : "");
      b.innerHTML = '<span class="dl">' + DL + '</span><span class="t"><b></b><small></small></span>';
      b.querySelector("b").textContent = out.label; b.querySelector("small").textContent = out.hint;
      b.addEventListener("click", function () { run(out, b); });
      el.outputs.appendChild(b);
    });
  }

  // ---------- stiker / qoplama ----------
  var LB_BUILTIN = [
    { id: "b:t8", n: "Kinder Chocolate T8 (8 ta), taxminiy", w: 160, h: 85 },
    { id: "b:t4", n: "Kinder Chocolate T4 (4 ta), taxminiy", w: 85, h: 85 }
  ];
  var lab = { crops: {}, boxes: {}, cur: 0, doc: null, cache: {}, shown: -1, token: 0, dims: { w: 1, h: 1 } };
  var LB = {
    preset: $("labPreset"), w: $("labW"), h: $("labH"), bleed: $("labBleed"), gap: $("labGap"), margin: $("labMargin"),
    marks: $("labMarks"), copies: $("labCopies"), fill: $("labFill"), rot: $("labRot"), save: $("labSave"), del: $("labDel"),
    stage: $("labStage"), canvas: $("labCanvas"), frame: $("labFrame"), txt: $("labFrameTxt"), grip: $("labGrip"),
    prev: $("labPrev"), next: $("labNext"), count: $("labCount"), zoom: $("labZoom"), center: $("labCenter"), all: $("labAll")
  };

  function lbUser() { try { return JSON.parse(localStorage.getItem("kb_presets") || "[]"); } catch (e) { return []; } }
  function lbSaveUser(arr) { try { localStorage.setItem("kb_presets", JSON.stringify(arr)); } catch (e) {} }
  function lbPresets() {
    var list = LB_BUILTIN.map(function (p) { return p; });
    lbUser().forEach(function (p, i) { list.push({ id: "u:" + i, n: p.n, w: p.w, h: p.h, user: true }); });
    return list;
  }
  function lbFillPresets(sel) {
    var all = lbPresets(), html = '<optgroup label="Kinder (taxminiy oʻlchamlar)">';
    all.filter(function (p) { return !p.user; }).forEach(function (p) { html += '<option value="' + p.id + '">' + p.n + " · " + p.w + "×" + p.h + " mm</option>"; });
    html += "</optgroup>";
    var us = all.filter(function (p) { return p.user; });
    if (us.length) {
      html += '<optgroup label="Mening oʻlchamlarim">';
      us.forEach(function (p) { html += '<option value="' + p.id + '">' + p.n.replace(/</g, "&lt;") + " · " + p.w + "×" + p.h + " mm</option>"; });
      html += "</optgroup>";
    }
    html += '<option value="custom">Boshqa oʻlcham (qoʻlda kiriting)</option>';
    LB.preset.innerHTML = html;
    LB.preset.value = sel || "custom";
    if (LB.preset.value !== (sel || "custom")) LB.preset.value = "custom";
    LB.del.classList.toggle("hidden", LB.preset.value.charAt(0) !== "u");
  }
  function lbMatch() {
    var w = parseFloat(LB.w.value), h = parseFloat(LB.h.value), cur = LB.preset.value, all = lbPresets(), hit = "custom";
    all.forEach(function (p) { if (p.w === w && p.h === h && (hit === "custom" || p.id === cur)) hit = p.id; });
    return hit;
  }

  LB.w.value = load("lab_w", "85"); LB.h.value = load("lab_h", "85");
  LB.bleed.value = load("lab_bleed", "1.5"); LB.gap.value = load("lab_gap", "6"); LB.margin.value = load("lab_margin", "6");
  LB.marks.value = load("lab_marks", "ticks"); LB.copies.value = load("lab_copies", "1"); LB.rot.value = load("lab_rot", "auto");
  lbFillPresets(lbMatch());

  function labGet() {
    return {
      w: parseFloat(LB.w.value), h: parseFloat(LB.h.value), bleed: parseFloat(LB.bleed.value) || 0, gap: parseFloat(LB.gap.value) || 0,
      margin: parseFloat(LB.margin.value) || 0, marks: LB.marks.value, copies: parseInt(LB.copies.value, 10) || 1, rot: LB.rot.value,
      crops: lab.crops, boxes: lab.boxes
    };
  }

  LB.preset.addEventListener("change", function () {
    var v = LB.preset.value;
    if (v !== "custom") {
      var p = lbPresets().filter(function (x) { return x.id === v; })[0];
      if (p) { LB.w.value = p.w; LB.h.value = p.h; save("lab_w", p.w); save("lab_h", p.h); }
    }
    LB.del.classList.toggle("hidden", v.charAt(0) !== "u");
    refresh();
  });
  ["w", "h"].forEach(function (k) {
    LB[k].addEventListener("input", function () {
      save("lab_" + k, LB[k].value);
      lbFillPresets(lbMatch());
      refresh();
    });
  });
  ["bleed", "gap", "margin", "marks", "copies", "rot"].forEach(function (k) {
    LB[k].addEventListener("input", function () { save("lab_" + k, LB[k].value); refresh(); });
    LB[k].addEventListener("change", function () { save("lab_" + k, LB[k].value); refresh(); });
  });
  LB.save.addEventListener("click", function () {
    var w = parseFloat(LB.w.value), h = parseFloat(LB.h.value);
    if (!(w > 0 && h > 0)) { msg("err", "Avval eni va boʻyini kiriting."); return; }
    var n = window.prompt("Bu oʻlcham uchun nom yozing (masalan: Kinder T16):", "");
    if (!n || !n.trim()) return;
    var arr = lbUser(); arr.push({ n: n.trim().slice(0, 40), w: w, h: h }); lbSaveUser(arr);
    lbFillPresets("u:" + (arr.length - 1));
    msg("ok", "Saqlandi: “" + n.trim() + "”. Keyingi safar roʻyxatdan tanlaysiz.");
  });
  LB.del.addEventListener("click", function () {
    var v = LB.preset.value; if (v.charAt(0) !== "u") return;
    var arr = lbUser(); arr.splice(parseInt(v.slice(2), 10), 1); lbSaveUser(arr);
    lbFillPresets(lbMatch());
  });
  LB.fill.addEventListener("click", function () {
    var lay = KB.labelLayout(labGet(), el.paper.value);
    if (lay) { LB.copies.value = lay.per; save("lab_copies", lay.per); refresh(); }
  });

  // --- kadr muharriri
  function labPages() { return plan && plan.pages ? plan.pages : []; }
  function labAspect() { var w = parseFloat(LB.w.value), h = parseFloat(LB.h.value); return w > 0 && h > 0 ? w / h : 1; }
  function labK() { return lab.dims.w / (labAspect() * lab.dims.h); }      // kadr balandligi = eni * K (quti nisbatida)
  function labMaxW() { return Math.min(1, 1 / labK()); }
  function labCrop(idx) {
    var c = lab.crops[idx], maxW = labMaxW(), K = labK();
    var w = c ? Math.max(0.08, Math.min(c.w, maxW)) : maxW;
    var x = c ? c.x : (1 - w) / 2, y = c ? c.y : (1 - w * K) / 2;
    return { x: Math.max(0, Math.min(1 - w, x)), y: Math.max(0, Math.min(1 - w * K, y)), w: w };
  }
  function labIdx() { var p = labPages(); return p.length ? p[Math.min(lab.cur, p.length - 1)] : -1; }
  function labFrameUpdate() {
    var idx = labIdx(); if (idx < 0) return;
    var c = labCrop(idx), K = labK(), f = LB.frame.style;
    f.left = c.x * 100 + "%"; f.top = c.y * 100 + "%"; f.width = c.w * 100 + "%"; f.height = c.w * K * 100 + "%";
    LB.zoom.value = Math.round(c.w / labMaxW() * 100);
    LB.txt.textContent = (parseFloat(LB.w.value) || 0) + " × " + (parseFloat(LB.h.value) || 0) + " mm";
    LB.count.textContent = "Rasm " + (lab.cur + 1) + " / " + labPages().length;
    LB.prev.disabled = lab.cur === 0; LB.next.disabled = lab.cur >= labPages().length - 1;
  }
  async function labRender(idx) {
    var tok = ++lab.token;
    if (!window.pdfjsLib || !masterBytes) return;
    try {
      if (!lab.doc) lab.doc = await window.pdfjsLib.getDocument({ data: masterBytes.slice(), isEvalSupported: false }).promise;
      var c = lab.cache[idx];
      if (!c) {
        var pg = await lab.doc.getPage(idx + 1), v1 = pg.getViewport({ scale: 1 });
        var bx = lab.boxes[idx] || { x: 0, y: 0, w: v1.width, h: v1.height };
        var s = Math.min(900 / bx.w, 2600 / Math.max(v1.width, v1.height)), vp = pg.getViewport({ scale: s });
        var tmp = document.createElement("canvas"); tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
        var tc = tmp.getContext("2d"); tc.fillStyle = "#fff"; tc.fillRect(0, 0, tmp.width, tmp.height);
        await pg.render({ canvasContext: tc, viewport: vp }).promise;
        c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bx.w * s)); c.height = Math.max(1, Math.round(bx.h * s));
        c.getContext("2d").drawImage(tmp, bx.x * s, (v1.height - bx.y - bx.h) * s, bx.w * s, bx.h * s, 0, 0, c.width, c.height);
        tmp.width = tmp.height = 1;
        var keys = Object.keys(lab.cache); if (keys.length > 8) delete lab.cache[keys[0]];
        lab.cache[idx] = c;
      }
      if (tok !== lab.token) return;
      LB.canvas.width = c.width; LB.canvas.height = c.height;
      LB.canvas.getContext("2d").drawImage(c, 0, 0);
      LB.stage.style.aspectRatio = c.width + " / " + c.height;
      lab.dims = { w: c.width, h: c.height }; lab.shown = idx;
      labFrameUpdate();
    } catch (err) { msg("err", "Rasmni koʻrsatib boʻlmadi: " + ((err && err.message) || err)); }
  }
  function labSync() {
    if (el.mode.value !== "labels") return;
    var pages = labPages(); if (!pages.length) return;
    if (lab.cur >= pages.length) lab.cur = 0;
    if (lab.shown !== pages[lab.cur]) labRender(pages[lab.cur]); else labFrameUpdate();
  }
  function labSet(c) { var idx = labIdx(); if (idx >= 0) { lab.crops[idx] = c; labFrameUpdate(); } }

  var drag = null;
  function rect() { return LB.stage.getBoundingClientRect(); }
  LB.frame.addEventListener("pointerdown", function (e) {
    if (e.target === LB.grip) return;
    var idx = labIdx(); if (idx < 0) return;
    drag = { mode: "move", x: e.clientX, y: e.clientY, c: labCrop(idx) };
    LB.frame.setPointerCapture(e.pointerId); e.preventDefault();
  });
  LB.grip.addEventListener("pointerdown", function (e) {
    var idx = labIdx(); if (idx < 0) return;
    drag = { mode: "size", x: e.clientX, y: e.clientY, c: labCrop(idx) };
    LB.grip.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  });
  function onMove(e) {
    if (!drag) return;
    var r = rect(), dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height, K = labK(), c = drag.c;
    if (drag.mode === "move") {
      labSet({ x: Math.max(0, Math.min(1 - c.w, c.x + dx)), y: Math.max(0, Math.min(1 - c.w * K, c.y + dy)), w: c.w });
    } else {
      var w = c.w + Math.max(dx, dy / K) / 1;       // burchak boʻylab (nisbat saqlanadi)
      w = Math.max(0.08, Math.min(w, labMaxW(), 1 - c.x, (1 - c.y) / K));
      labSet({ x: c.x, y: c.y, w: w });
    }
  }
  function onUp() { drag = null; }
  [LB.frame, LB.grip].forEach(function (n) {
    n.addEventListener("pointermove", onMove); n.addEventListener("pointerup", onUp); n.addEventListener("pointercancel", onUp);
  });
  LB.zoom.addEventListener("input", function () {
    var idx = labIdx(); if (idx < 0) return;
    var c = labCrop(idx), K = labK(), w = Math.max(0.08, labMaxW() * (parseInt(LB.zoom.value, 10) / 100));
    var cx = c.x + c.w / 2, cy = c.y + c.w * K / 2;
    labSet({ x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - w * K, cy - w * K / 2)), w: w });
  });
  LB.stage.addEventListener("wheel", function (e) {
    var idx = labIdx(); if (idx < 0) return;
    e.preventDefault();
    var c = labCrop(idx), K = labK(), w = Math.max(0.08, Math.min(labMaxW(), c.w * (e.deltaY < 0 ? 0.93 : 1.07)));
    var cx = c.x + c.w / 2, cy = c.y + c.w * K / 2;
    labSet({ x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - w * K, cy - w * K / 2)), w: w });
  }, { passive: false });
  LB.prev.addEventListener("click", function () { if (lab.cur > 0) { lab.cur--; labSync(); } });
  LB.next.addEventListener("click", function () { if (lab.cur < labPages().length - 1) { lab.cur++; labSync(); } });
  LB.center.addEventListener("click", function () { var idx = labIdx(); if (idx >= 0) { delete lab.crops[idx]; labFrameUpdate(); } });
  LB.all.addEventListener("click", function () {
    var idx = labIdx(); if (idx < 0) return;
    var c = labCrop(idx);
    labPages().forEach(function (p) { lab.crops[p] = { x: c.x, y: c.y, w: c.w }; });
    msg("ok", "Shu kadr barcha rasmlarga qoʻllandi.");
  });

  // ---------- varaq ko'rsatkichi ----------
  function renderViz(p, o) {
    el.viz.innerHTML = "";
    if (!UI || !p || p.error) return;
    var m = o.mode, M = KB.MODES[m], spec = null;
    if (m === "booklet2" || m === "bookletDuplex") {
      spec = { landscape: true, cols: 2, rows: 1, fold: true, sheets: p.sheets.slice(0, 40).map(function (s) { return { front: s.front, back: s.back }; }),
        caption: "Varaqning old tomoni. Oʻrtadagi chiziq boʻylab buklaysiz.",
        flipHint: "Qogʻozni qisqa qirra atrofida aylantirganda orqa tomon shunday koʻrinadi. Bir xil rangdagi kataklar bir-birining orqasida." };
    } else if (isCards(m)) {
      spec = { landscape: M.landscape, cols: M.cols, rows: M.rows, sheets: p.sheets.slice(0, 40).map(function (s) { return { front: s.front, back: p.sides === 2 ? s.back : null }; }),
        caption: "Har bir rang bitta kartochka. Punktir chiziq boʻylab qirqasiz.",
        flipHint: "Qogʻozni aylantirganda orqa tomon shunday koʻrinadi: har kartochkaning orqasi aynan oʻz oldining orqasiga tushadi." };
    } else if (m === "labels") {
      var ly = p.label;
      spec = { landscape: ly.landscape, cols: ly.cols, rows: ly.rows, sheets: p.sheets.slice(0, 40).map(function (s) { return { front: s.front, back: null }; }),
        caption: "Har bir katak bitta stiker (raqam: rasm tartibi). Burchak chiziqchalari boʻylab qirqasiz." };
    } else if (m === "oddeven") {
      spec = { landscape: false, cols: 1, rows: 1, sheets: p.sheets.slice(0, 40).map(function (s) { return { front: [s.front], back: [s.back] }; }),
        caption: "Toq bet qogʻozning old tomoniga, juft bet orqasiga chiqadi.", flipHint: "Orqa tomonda juft bet chiqadi." };
    } else if (m === "nup2" || m === "nup4") {
      spec = { landscape: M.landscape, cols: M.cols, rows: M.rows, sheets: p.groups.slice(0, 40).map(function (g) { return { front: g, back: null }; }),
        caption: "Bir varaqqa shuncha bet sigʻadi. Qogʻoz tejaladi." };
    }
    if (spec) UI.sheetViewer(el.viz, spec);
  }

  async function run(out, btn) {
    if (!plan || plan.error || !masterBytes) return;
    var tb = btn.querySelector(".t b"), old = tb.textContent, o = opts();
    Array.prototype.forEach.call(el.outputs.children, function (b) { b.disabled = true; });
    tb.textContent = "Tayyorlanmoqda…";
    try {
      var bytes = await KB.make(masterBytes, o, plan, out.key, function (t) { tb.textContent = t; });
      saveFile(bytes, baseName() + (o.test ? "_sinov" : "") + out.suffix + ".pdf");
      msg("ok", "Tayyor! Fayl yuklab olindi (" + mb(bytes.length) + "). Endi printerdan chiqaring.");
      if (UI) UI.confetti(btn);
    } catch (err) {
      msg("err", "Fayl yasab boʻlmadi: " + ((err && err.message) || err));
    }
    tb.textContent = old;
    Array.prototype.forEach.call(el.outputs.children, function (b) { b.disabled = false; });
  }

  ["mode", "paper", "scale", "section", "sides"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].value); });
  });
  ["rtl", "frame", "rev"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].checked ? "1" : "0"); });
  });
  ["margin", "crop", "angle", "numStart"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].value); });
  });
  ["pageNum", "gray"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].checked ? "1" : "0"); });
  });
  ["mode", "paper", "sides", "test", "rtl", "frame", "rev", "angle", "pageNum", "gray"].forEach(function (k) { el[k].addEventListener("change", refresh); });
  ["range", "scale", "section", "margin", "crop", "rotate", "numStart"].forEach(function (k) { el[k].addEventListener("input", refresh); });

  // ---------- namuna hujjat ----------
  async function makeSample() {
    var PL = window.PDFLib, d = await PL.PDFDocument.create();
    var bold = await d.embedFont(PL.StandardFonts.HelveticaBold), reg = await d.embedFont(PL.StandardFonts.Helvetica);
    var cols = [[0.06, 0.48, 0.34], [0.12, 0.45, 0.72], [0.85, 0.52, 0.06], [0.55, 0.28, 0.72], [0.8, 0.25, 0.4], [0.35, 0.58, 0.15]];
    for (var i = 1; i <= 12; i++) {
      var p = d.addPage([595.28, 841.89]), c = cols[(i - 1) % cols.length], rgb = PL.rgb(c[0], c[1], c[2]);
      p.drawRectangle({ x: 0, y: 700, width: 595.28, height: 141.89, color: rgb });
      p.drawText("Namuna hujjat", { x: 48, y: 770, size: 30, font: bold, color: PL.rgb(1, 1, 1) });
      p.drawText(i + "-bet", { x: 48, y: 733, size: 18, font: reg, color: PL.rgb(1, 1, 1) });
      p.drawText(String(i), { x: i > 9 ? 150 : 205, y: 360, size: 260, font: bold, color: PL.rgb(c[0] * 0.25 + 0.75, c[1] * 0.25 + 0.75, c[2] * 0.25 + 0.75) });
      for (var l = 0; l < 7; l++) p.drawRectangle({ x: 48, y: 640 - l * 26, width: l % 3 === 2 ? 330 : 499, height: 9, color: PL.rgb(0.86, 0.89, 0.87), borderWidth: 0 });
      p.drawText("Kitobcha ilovasining sinov sahifasi", { x: 48, y: 40, size: 11, font: reg, color: PL.rgb(0.4, 0.45, 0.42) });
    }
    return new File([await d.save()], "Namuna.pdf", { type: "application/pdf" });
  }
  el.sampleBtn.addEventListener("click", async function () {
    if (busy) return;
    try { addFiles([await makeSample()]); } catch (err) { msg("err", "Namunani yasab boʻlmadi: " + ((err && err.message) || err)); }
  });

  // ---------- oldindan koʻrish ----------
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";
  el.previewBtn.addEventListener("click", async function () {
    if (!masterBytes || !plan || plan.error) return;
    if (!window.pdfjsLib) { msg("err", "Koʻrish kutubxonasi yuklanmadi."); return; }
    var o = opts(); o.test = true;
    var p2 = KB.planFor(o);
    if (p2.error) { msg("err", p2.error); return; }
    var label = el.previewLbl;
    el.previewBtn.disabled = true; label.textContent = "Tayyorlanmoqda…"; el.previewOut.innerHTML = "";
    try {
      var outsToShow = (isCards(o.mode) || o.mode === "labels") ? p2.outputs.slice(0, 1) : p2.outputs;
      for (var q = 0; q < outsToShow.length; q++) {
        var out = outsToShow[q];
        var bytes = await KB.make(masterBytes, o, p2, out.key, function (t) { label.textContent = t; });
        var pdf = await window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
        var cnt = Math.min(pdf.numPages, o.mode === "bookletDuplex" || isCards(o.mode) ? 4 : 2);
        for (var k = 1; k <= cnt; k++) {
          var pg = await pdf.getPage(k), vp0 = pg.getViewport({ scale: 1 });
          var vp = pg.getViewport({ scale: 900 / vp0.width });
          var cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
          var fig = document.createElement("figure"), cap = document.createElement("figcaption");
          cap.textContent = out.label + " · " + k + "-bet";
          fig.appendChild(cv); fig.appendChild(cap); el.previewOut.appendChild(fig);
        }
      }
    } catch (err) {
      msg("err", "Koʻrib boʻlmadi: " + ((err && err.message) || err));
    }
    label.textContent = "Haqiqiy sahifalarni koʻrish"; el.previewBtn.disabled = false;
  });

  // ---------- oflayn rejim va oʻrnatish ----------
  var off = $("offline"), inst = $("install"), deferred = null;
  if (location.protocol === "file:") {
    off.textContent = "Ilova qurilmangizda ishlayapti: internet shart emas ✓";
  } else if ("serviceWorker" in navigator) {
    var hadCtl = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadCtl || reloaded) return;
      $("toast").classList.remove("hidden");      // "Yangi versiya tayyor" xabari
    });
    el.update.addEventListener("click", function () { reloaded = true; location.reload(); });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(function (reg) { try { reg.update(); } catch (e) {} return navigator.serviceWorker.ready; })
      .then(function () { off.textContent = "Oflayn ishlashga tayyor ✓ (internet shart emas)"; })
      .catch(function () { off.textContent = "Oflayn rejim yoqilmadi. Faylni yuklab olib, index.html ni oching."; });
  } else {
    off.textContent = "Bu brauzerda oflayn rejim yoʻq. Faylni yuklab olib, index.html ni oching.";
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; inst.classList.remove("hidden"); });
  inst.addEventListener("click", function () { if (deferred) { deferred.prompt(); deferred = null; inst.classList.add("hidden"); } });
})();
