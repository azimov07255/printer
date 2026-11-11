(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KB = window.KB, CV = window.KBConvert;

  var el = {
    drop: $("drop"), file: $("file"), status: $("status"), msg: $("msg"),
    listCard: $("listCard"), list: $("fileList"), total: $("total"),
    settings: $("settings"), mode: $("mode"), modeHint: $("modeHint"), range: $("range"),
    paper: $("paper"), scale: $("scale"), section: $("section"),
    rtl: $("rtl"), frame: $("frame"), rev: $("rev"), test: $("test"),
    summary: $("summary"), preview: $("preview"), outputs: $("outputs"), steps: $("steps")
  };

  var entries = [], nextId = 1, masterBytes = null, masterN = 0, plan = null, busy = false, lastN = 0;

  // ---------- sozlamalarni eslab qolish ----------
  function load(k, d) { try { var v = localStorage.getItem("kb_" + k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("kb_" + k, String(v)); } catch (e) {} }
  el.mode.value = load("mode", "booklet2");
  el.paper.value = load("paper", "A4");
  el.scale.value = load("scale", "95");
  el.section.value = load("section", "0");
  el.rtl.checked = load("rtl", "0") === "1";
  el.frame.checked = load("frame", "0") === "1";
  el.rev.checked = load("rev", "0") === "1";
  if (!el.mode.value) el.mode.value = "booklet2";

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
        e.bytes = r.bytes; e.pages = r.pages; e.state = "ok";
      } catch (err) {
        e.state = "err"; e.error = (err && err.message) || "Oʻqib boʻlmadi";
      }
      renderList();
    }
    status("");
    var bad = fresh.filter(function (e) { return e.state === "err"; });
    if (bad.length) msg("err", bad.map(function (e) { return e.name + ": " + e.error; }).join("\n"));
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
    el.total.textContent = pages ? "· jami " + pages + " bet" : "";
  }

  // ---------- rejalash ----------
  var HINTS = {
    booklet2: "Betlar kitobcha tartibida joylashtiriladi. Ikki fayl chiqadi: avval old tomon, keyin qogʻozni aylantirib orqa tomon.",
    bookletDuplex: "Printeringiz avtomatik ikki tomonlama (duplex) boʻlsa: kitobcha bitta faylda chiqadi.",
    oddeven: "Oddiy hujjatni qogʻozning ikki tomoniga chiqarish: avval toq betlar, keyin juft betlar.",
    nup2: "Har varaqqa 2 ta bet sigʻadi (albom). Qogʻoz 2 marta kam ketadi.",
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
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring, keyin hammasini chiqaring va varaqlarni oʻrtasidan buking."
    ],
    oddeven: [
      "Avval <b>toq betlar</b> faylini chiqaring (masshtab 100%).",
      "Chiqqan qogʻozlarni tartibini buzmasdan <b>uzun qirra atrofida</b> (kitob varagʻini ag‘dargandek) aylantirib qayta soling.",
      "<b>Juft betlar</b> faylini chiqaring.",
      "Avval <b>sinov</b> (2 varaq) bilan tekshiring. Varaqlar tartibi teskari chiqsa, “orqa tomon teskari tartibda” ni yoqing."
    ],
    nup2: ["Faylni oddiy chiqaring: masshtab <b>100%</b>, yoʻnalish <b>Albom (Landscape)</b>.", "Ikki tomonlama kerak boʻlsa, printer sozlamasidan yoqing (qisqa qirra boʻyicha)."],
    nup4: ["Faylni oddiy chiqaring: masshtab <b>100%</b>, yoʻnalish <b>Kitob (Portrait)</b>.", "Ikki tomonlama kerak boʻlsa, printer sozlamasidan yoqing (uzun qirra boʻyicha)."],
    extract: ["Faylni saqlang va istalgan PDF dasturida oching yoki chiqaring."]
  };

  function opts() {
    return {
      mode: el.mode.value, n: masterN, range: el.range.value, per: parseInt(el.section.value, 10) || 0,
      rtl: el.rtl.checked, frame: el.frame.checked, rev: el.rev.checked, test: el.test.checked,
      paper: el.paper.value, scale: el.scale.value
    };
  }

  function refresh() {
    if (!masterBytes) return;
    var m = el.mode.value;
    document.querySelectorAll("[data-modes]").forEach(function (n) {
      n.classList.toggle("hidden", n.getAttribute("data-modes").split(" ").indexOf(m) < 0);
    });
    el.modeHint.textContent = HINTS[m] || "";
    el.steps.innerHTML = (STEPS[m] || []).map(function (s) { return "<li>" + s + "</li>"; }).join("");

    var o = opts();
    plan = KB.planFor(o);
    el.preview.innerHTML = ""; el.outputs.innerHTML = "";
    if (plan.error) {
      el.summary.textContent = ""; msg("err", plan.error); return;
    }
    if (el.msg.textContent && /xato|notoʻgʻri|boʻlishi kerak|tanlanmadi|boshlanish/.test(el.msg.textContent)) msg("", "");

    var s = "<b>" + plan.pages.length + " bet</b>";
    if (m === "extract") s += " tanlandi.";
    else s += " → <b>" + plan.totalSheets + " varaq</b> (" + o.paper + (m === "nup4" ? ", kitob" : m === "oddeven" ? "" : ", albom") + ")";
    if (plan.blanks) s += ". Oxirida " + plan.blanks + " ta boʻsh bet qoʻshiladi";
    if (plan.sections > 1) s += ". <b>" + plan.sections + " qism</b>: har qism alohida kitobcha";
    if (o.test) s += "<br>Sinov rejimi: faqat 2 varaq chiqadi.";
    if ((m === "booklet2" || m === "bookletDuplex") && plan.sections === 1 && plan.totalSheets > 20 && !o.test)
      s += "<br>Varaqlar koʻp, kitobcha qalin boʻlib ketadi. “Qismga boʻlish” ga 10 yoki 11 yozishni tavsiya qilamiz.";
    el.summary.innerHTML = s;

    if (plan.preview && plan.preview.length) {
      var t = '<table class="preview"><caption>Varaqlar tartibi (chap | oʻng)</caption><tr><th></th><th>Old tomon</th><th>Orqa tomon</th></tr>';
      plan.preview.forEach(function (p) { t += "<tr><td>" + p.title + "</td><td>" + p.front + "</td><td>" + p.back + "</td></tr>"; });
      el.preview.innerHTML = t + "</table>";
    }

    plan.outputs.forEach(function (out) {
      var b = document.createElement("button"); b.className = "main";
      b.appendChild(document.createTextNode(out.label));
      var sm = document.createElement("small"); sm.textContent = out.hint; b.appendChild(sm);
      b.addEventListener("click", function () { run(out, b); });
      el.outputs.appendChild(b);
    });
  }

  async function run(out, btn) {
    if (!plan || plan.error || !masterBytes) return;
    var old = btn.firstChild.textContent, o = opts();
    Array.prototype.forEach.call(el.outputs.children, function (b) { b.disabled = true; });
    btn.firstChild.textContent = "Tayyorlanmoqda…";
    try {
      var bytes = await KB.build(masterBytes, o, plan, out.key);
      saveFile(bytes, baseName() + (o.test ? "_sinov" : "") + out.suffix + ".pdf");
      msg("ok", "Tayyor: fayl yuklab olindi (" + mb(bytes.length) + ").");
    } catch (err) {
      msg("err", "Fayl yasab boʻlmadi: " + ((err && err.message) || err));
    }
    btn.firstChild.textContent = old;
    Array.prototype.forEach.call(el.outputs.children, function (b) { b.disabled = false; });
  }

  ["mode", "paper", "scale", "section"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].value); });
  });
  ["rtl", "frame", "rev"].forEach(function (k) {
    el[k].addEventListener("change", function () { save(k, el[k].checked ? "1" : "0"); });
  });
  ["mode", "paper", "test", "rtl", "frame", "rev"].forEach(function (k) { el[k].addEventListener("change", refresh); });
  ["range", "scale", "section"].forEach(function (k) { el[k].addEventListener("input", refresh); });

  // ---------- oflayn rejim va oʻrnatish ----------
  var off = $("offline"), inst = $("install"), deferred = null;
  if (location.protocol === "file:") {
    off.textContent = "Ilova qurilmangizda ishlayapti: internet shart emas ✓";
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function () { return navigator.serviceWorker.ready; })
      .then(function () { off.textContent = "Oflayn ishlashga tayyor ✓ (internet shart emas)"; })
      .catch(function () { off.textContent = "Oflayn rejim yoqilmadi. Faylni yuklab olib, index.html ni oching."; });
  } else {
    off.textContent = "Bu brauzerda oflayn rejim yoʻq. Faylni yuklab olib, index.html ni oching.";
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; inst.classList.remove("hidden"); });
  inst.addEventListener("click", function () { if (deferred) { deferred.prompt(); deferred = null; inst.classList.add("hidden"); } });
})();
