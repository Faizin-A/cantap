const KEY = "antrian_state_v1",
  TKEY = "antrian_my_ticket_v1",
  CFG = "antrian_cfg_v1";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) => "A-" + String(n).padStart(3, "0");
const today = () => new Date().toLocaleDateString("sv-SE");
const app = $("#app");

/* ===== Suara & notifikasi giliran ===== */
const SKEY = "antrian_sound_v1";
let actx = null,
  alarmTimer = null,
  wakeLock = null;
const soundOn = () => localStorage.getItem(SKEY) !== "0";

function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) {}
}
["click", "touchstart", "keydown"].forEach((ev) =>
  document.addEventListener(ev, unlockAudio, { passive: true }),
);

function chime() {
  if (!actx) return;
  const t = actx.currentTime;
  [
    [880, 0],
    [1175, 0.25],
    [880, 0.5],
    [1175, 0.75],
  ].forEach(([f, d]) => {
    const o = actx.createOscillator(),
      g = actx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + d);
    g.gain.linearRampToValueAtTime(0.45, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t + d);
    o.stop(t + d + 0.25);
  });
}
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function startAlarm(no) {
  stopAlarm();
  if (!soundOn()) return;
  let n = 0;
  const ring = () => {
    chime();
    setTimeout(
      () =>
        speak(
          "Nomor antrian A " + no + ". Giliran Anda. Silakan menuju penjual.",
        ),
      1100,
    );
    try {
      navigator.vibrate && navigator.vibrate([300, 150, 300]);
    } catch (e) {}
    if (++n >= 8) stopAlarm();
  };
  ring();
  alarmTimer = setInterval(ring, 7000);
}
function stopAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  try {
    speechSynthesis && speechSynthesis.cancel();
  } catch (e) {}
  try {
    navigator.vibrate && navigator.vibrate(0);
  } catch (e) {}
}
async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && alarmWanted) keepAwake();
});
let alarmWanted = false;

function cfg() {
  let c = {};
  try {
    c = JSON.parse(localStorage.getItem(CFG)) || {};
  } catch (e) {}
  return Object.assign({ store: "Toko Saya", pin: "1234" }, c);
}
function load() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(KEY));
  } catch (e) {}
  if (!s || s.date !== today()) s = { date: today(), last: 0, list: [] };
  return s;
}
function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
function myTicket(s) {
  const id = localStorage.getItem(TKEY);
  return id ? s.list.find((x) => x.id === id) : null;
}
function stats(s) {
  const waiting = s.list
    .filter((x) => x.status === "waiting")
    .sort((a, b) => a.no - b.no);
  const serving = s.list.find((x) => x.status === "serving") || null;
  const done = s.list.filter((x) => x.status === "done");
  const t = done.filter((x) => x.t1 && x.t2).map((x) => (x.t2 - x.t1) / 60000);
  const avg = t.length
    ? Math.max(1, t.reduce((a, b) => a + b, 0) / t.length)
    : 3;
  return { waiting, serving, done, avg };
}

function act(a, id) {
  const s = load(),
    now = Date.now();
  const cur = s.list.find((x) => x.status === "serving");
  if (a === "take") {
    const name = ($("#name") || {}).value || "";
    s.last++;
    const it = {
      id: "t" + now + Math.random().toString(36).slice(2, 6),
      no: s.last,
      name: name.trim(),
      status: "waiting",
      t0: now,
    };
    s.list.push(it);
    save(s);
    localStorage.setItem(TKEY, it.id);
  } else if (a === "cancel") {
    const m = myTicket(s);
    if (m && confirm("Batalkan nomor antrian Anda?")) {
      m.status = "cancelled";
      save(s);
    }
  } else if (a === "newticket") {
    localStorage.removeItem(TKEY);
  } else if (a === "mute") {
    stopAlarm();
  } else if (a === "togglesound") {
    const on = !soundOn();
    localStorage.setItem(SKEY, on ? "1" : "0");
    if (on) {
      unlockAudio();
      chime();
    } else stopAlarm();
  } else if (a === "testsound") {
    unlockAudio();
    chime();
    setTimeout(() => speak("Tes suara. Notifikasi antrian aktif."), 1100);
  } else if (a === "login") {
    if (($("#pin") || {}).value === cfg().pin)
      sessionStorage.setItem("adm", "1");
    else {
      alert("PIN salah");
      return;
    }
  } else if (a === "logout") {
    sessionStorage.removeItem("adm");
    location.hash = "";
  } else if (a === "next" || a === "call") {
    if (cur) {
      cur.status = "done";
      cur.t2 = now;
    }
    const nx =
      a === "call" ? s.list.find((x) => x.id === id) : stats(s).waiting[0];
    if (nx && nx.status === "waiting") {
      nx.status = "serving";
      nx.t1 = now;
    }
    save(s);
  } else if (a === "finish") {
    if (cur) {
      cur.status = "done";
      cur.t2 = now;
      save(s);
    }
  } else if (a === "skip") {
    if (cur) {
      cur.status = "skipped";
      cur.t2 = now;
      save(s);
    }
  } else if (a === "remove") {
    const x = s.list.find((x) => x.id === id);
    if (x) {
      x.status = "cancelled";
      save(s);
    }
  } else if (a === "reset") {
    if (confirm("Reset semua antrian hari ini? Nomor kembali ke 001.")) {
      save({ date: today(), last: 0, list: [] });
    }
  } else if (a === "savecfg") {
    const c = cfg();
    const n = $("#cfgStore").value.trim(),
      p = $("#cfgPin").value.trim();
    if (n) c.store = n;
    if (p) {
      if (p.length < 4) {
        alert("PIN minimal 4 karakter");
        return;
      }
      c.pin = p;
    }
    localStorage.setItem(CFG, JSON.stringify(c));
    alert("Pengaturan disimpan");
  } else if (a === "copy") {
    const u = custUrl();
    (navigator.clipboard
      ? navigator.clipboard.writeText(u)
      : Promise.reject()
    ).then(
      () => alert("Link disalin"),
      () => prompt("Salin link ini:", u),
    );
    return;
  }
  render(true);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (b && !b.disabled) act(b.dataset.act, b.dataset.id);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (e.target.id === "pin") act("login");
    if (e.target.id === "name") act("take");
  }
});

function custUrl() {
  return location.origin === "null" || location.protocol === "file:"
    ? location.href.split("#")[0]
    : location.origin + location.pathname;
}
function head(c, right) {
  return `<div class="hero"><div class="wrap ${right ? "wide" : ""}"><div class="top"><div class="logo">${esc(c.store.charAt(0).toUpperCase())}</div><div><h1>${esc(c.store)}</h1><small>${right ? "Dashboard penjual" : "Antrian digital"}</small></div><div class="sp"></div>${right || ""}</div></div></div>`;
}

function viewCustomer() {
  const s = load(),
    c = cfg(),
    st = stats(s),
    my = myTicket(s);
  const live = `<div class="card live"><div class="lbl">Sedang dilayani</div><div class="big">${st.serving ? fmt(st.serving.no) : "—"}</div><div class="sub">${st.waiting.length} orang sedang menunggu</div></div>`;
  let body = "";
  if (!my) {
    body = `<div class="card"><h2>Ambil nomor antrian</h2><p class="muted">Isi nama agar mudah dipanggil (boleh dikosongkan).</p><input id="name" class="inp" maxlength="30" placeholder="Nama (opsional)" autocomplete="off"><button class="btn primary lg" data-act="take">Ambil nomor</button></div>`;
  } else if (my.status === "waiting") {
    const ahead = st.waiting.filter((x) => x.no < my.no).length;
    const est = Math.round(ahead * st.avg + (st.serving ? st.avg / 2 : 0));
    body = `<div class="card ticket"><div class="lbl">Nomor antrian Anda</div><div class="big">${fmt(my.no)}</div><span class="pill">Menunggu giliran</span>
    <div class="info"><div><b>${ahead}</b><span>orang di depan</span></div><div><b>${ahead === 0 ? "Segera" : "±" + Math.max(1, est)}</b><span>${ahead === 0 ? "Anda berikutnya" : "menit"}</span></div></div>
    <p class="muted" style="margin-top:12px">Tidak perlu antre berdiri. Halaman ini diperbarui otomatis.</p>
    <div class="snd"><button class="btn sm" data-act="togglesound">Suara: ${soundOn() ? "Aktif" : "Mati"}</button><button class="btn sm" data-act="testsound">Tes suara</button></div>
    <p class="muted" style="margin-top:8px;font-size:12.5px">Biarkan halaman ini terbuka dan volume HP menyala agar Anda dipanggil dengan bunyi.</p>
    <button class="btn danger sm" style="margin-top:14px" data-act="cancel">Batalkan antrian</button></div>`;
  } else if (my.status === "serving") {
    body = `<div class="card turn"><div class="lbl" style="color:#d1fae5">Nomor Anda</div><div class="big">${fmt(my.no)}</div><h2>Giliran Anda!</h2><p style="margin-top:6px;opacity:.9">Silakan menuju penjual untuk menyebutkan pesanan.</p><button class="btn sm" style="margin-top:14px" data-act="mute">Matikan bunyi</button></div>`;
  } else {
    const m = {
      done: [
        "ok",
        "Pesanan selesai",
        "Terima kasih sudah menunggu. Sampai jumpa lagi!",
      ],
      skipped: [
        "bad",
        "Nomor dilewati",
        "Anda tidak hadir saat dipanggil. Silakan ambil nomor baru.",
      ],
      cancelled: [
        "bad",
        "Antrian dibatalkan",
        "Silakan ambil nomor baru jika ingin mengantre lagi.",
      ],
    }[my.status];
    body = `<div class="card ticket"><div class="lbl">Nomor ${fmt(my.no)}</div><div style="margin:14px 0"><span class="pill ${m[0]}">${m[1]}</span></div><p class="muted">${m[2]}</p><button class="btn primary lg" style="margin-top:16px" data-act="newticket">Ambil nomor baru</button></div>`;
  }
  return (
    head(c) +
    `<div class="main"><div class="wrap">${live}${body}<div class="foot">Diperbarui otomatis · ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div><div class="foot"><a class="lnk" href="#admin">Masuk sebagai penjual</a></div></div></div>`
  );
}

function viewAdmin() {
  const c = cfg();
  if (!sessionStorage.getItem("adm")) {
    return (
      head(c) +
      `<div class="main"><div class="wrap"><div class="card"><h2>Masuk penjual</h2><p class="muted">Masukkan PIN untuk membuka dashboard. PIN awal: 1234 (segera ganti di Pengaturan).</p><input id="pin" type="password" inputmode="numeric" class="inp" placeholder="PIN" autocomplete="off"><button class="btn primary lg" data-act="login">Masuk</button></div><div class="foot"><a class="lnk" href="#">← Kembali ke halaman pelanggan</a></div></div></div>`
    );
  }
  const s = load(),
    st = stats(s);
  const hist = s.list
    .filter((x) => ["done", "skipped"].includes(x.status))
    .slice(-5)
    .reverse();
  const now = `<div class="card now"><div class="lbl">Sedang dilayani</div><div class="big">${st.serving ? fmt(st.serving.no) : "—"}</div><div class="sub">${st.serving ? esc(st.serving.name || "Tanpa nama") : "Belum ada yang dipanggil"}</div>
  <div class="acts"><button class="btn primary lg" data-act="next" ${st.waiting.length ? "" : "disabled"}>${st.serving ? "Selesai & panggil berikutnya" : "Panggil berikutnya"}</button>
  <div class="row"><button class="btn" data-act="finish" ${st.serving ? "" : "disabled"}>Selesai</button><button class="btn danger" data-act="skip" ${st.serving ? "" : "disabled"}>Lewati (tidak hadir)</button></div></div></div>`;
  const stat = `<div class="stats"><div class="stat"><b>${st.waiting.length}</b><span>Menunggu</span></div><div class="stat"><b>${st.done.length}</b><span>Selesai hari ini</span></div><div class="stat"><b>${Math.round(st.avg * 10) / 10}</b><span>Menit / pelanggan</span></div></div>`;
  const rows = st.waiting
    .map(
      (x) =>
        `<li><span class="chip">${fmt(x.no)}</span><span class="nm">${esc(x.name || "Tanpa nama")}<small>menunggu ${Math.max(0, Math.round((Date.now() - x.t0) / 60000))} menit</small></span><button class="btn sm" data-act="call" data-id="${x.id}">Panggil</button><button class="btn danger sm" data-act="remove" data-id="${x.id}">Hapus</button></li>`,
    )
    .join("");
  const list = `<div class="card"><h2>Daftar tunggu</h2>${rows ? `<ul class="list">${rows}</ul>` : '<div class="empty">Belum ada pelanggan yang mengantre</div>'}${hist.length ? `<div class="hist">Terakhir: ${hist.map((x) => fmt(x.no) + (x.status === "skipped" ? " (lewat)" : "")).join(" · ")}</div>` : ""}</div>`;
  const side = `<div class="card" style="text-align:center"><h2>QR & link pelanggan</h2><p class="muted">Cetak QR ini atau tulis link-nya ke kartu NFC.</p><div id="qr"></div><div class="url">${esc(custUrl())}</div><button class="btn sm" style="margin-top:12px" data-act="copy">Salin link</button></div>
  <div class="card set"><h2>Pengaturan</h2><label>Nama toko</label><input id="cfgStore" class="inp" value="${esc(c.store)}" maxlength="30"><label>PIN baru (kosongkan jika tidak diganti)</label><input id="cfgPin" class="inp" type="password" inputmode="numeric" placeholder="••••"><button class="btn primary" style="margin-top:14px" data-act="savecfg">Simpan</button><button class="btn danger" style="margin-top:14px;margin-left:8px" data-act="reset">Reset antrian</button></div>`;
  return (
    head(c, '<button class="btn ghost" data-act="logout">Keluar</button>') +
    `<div class="main"><div class="wrap wide"><div class="grid"><div>${now}${stat}${list}</div><div>${side}</div></div></div></div>`
  );
}

let lastSig = "",
  prevStatus = null;
function route() {
  return location.hash.replace("#", "") === "admin" ? "admin" : "cust";
}
function render(force) {
  const r = route();
  const sig = [
    r,
    localStorage.getItem(KEY),
    localStorage.getItem(CFG),
    localStorage.getItem(TKEY),
    sessionStorage.getItem("adm"),
    Math.floor(Date.now() / 30000),
  ].join("|");
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const nm = $("#name"),
    keep = nm ? nm.value : "",
    focus = document.activeElement && document.activeElement.id;
  app.innerHTML = r === "admin" ? viewAdmin() : viewCustomer();
  document.title =
    (r === "admin" ? "Dashboard · " : "") + cfg().store + " – Antrian";
  if (keep && $("#name")) $("#name").value = keep;
  if (focus && $("#" + focus) && ["name", "pin"].includes(focus))
    $("#" + focus).focus();
  if (r === "admin" && $("#qr") && window.QRCode) {
    try {
      new QRCode($("#qr"), { text: custUrl(), width: 168, height: 168 });
    } catch (e) {}
  }
  if (r === "cust") {
    const m = myTicket(load()),
      st = m ? m.status : null;
    alarmWanted = st === "waiting" || st === "serving";
    if (alarmWanted) keepAwake();
    if (prevStatus === "waiting" && st === "serving") {
      startAlarm(m.no);
      document.title = "Giliran Anda! – " + cfg().store;
    }
    if (st !== "serving" && alarmTimer) stopAlarm();
    prevStatus = st;
  }
}
window.addEventListener("storage", () => render());
window.addEventListener("hashchange", () => render(true));
setInterval(() => render(), 1500);
render(true);
