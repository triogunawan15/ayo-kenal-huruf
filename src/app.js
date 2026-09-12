import lettersData from "./data/letters.json";
import { speak } from "./engine/tts.js";
import { getAllProgress, recordAttempt, logEvent } from "./engine/progress.js";
import { buildGuideMask, scoreTrace, overallLevel, LEVEL_NAMES, LEVEL_LABELS } from "./engine/rubric.js";
import { isFirebaseConfigured } from "./engine/firebaseConfig.js";

// firebase.js (yang menginisialisasi koneksi & auth) HANYA di-import kalau
// firebaseConfig.js sudah diisi -- supaya app yang masih pakai fallback
// localStorage tidak ikut mencoba login ke project Firebase yang belum ada.
const authApi = isFirebaseConfigured ? await import("./engine/firebase.js") : null;

const STEP_LABELS = ["Kenalkan", "Dengar & Tunjuk", "Trace / Tulis", "Ucapkan", "Terapkan"];

let root;
let currentLetter = null;
let currentStepIdx = 0;
let attemptsWrong = 0;

export async function initApp(rootEl) {
  root = rootEl;
  root.innerHTML = `<p style="text-align:center; padding:40px 0; color:var(--ink-soft); font-weight:600;">Memuat...</p>`;
  await renderMenu();
}

// =================================================================
// MENU: daftar 26 huruf dikelompokkan per grup, warna sesuai status
// =================================================================
async function renderMenu() {
  const progress = await getAllProgress();
  const groups = [1, 2, 3, 4, 5];

  root.innerHTML = `
    <div class="menu-header">
      <button class="account-pill" id="accountBtn">${accountPillLabel()}</button>
      <h1>Ayo Kenal Huruf!</h1>
      <p>Pilih huruf yang mau dipelajari hari ini</p>
    </div>
    ${groups
      .map((g) => {
        const letters = lettersData.filter((l) => l.group === g).sort((a, b) => a.order - b.order);
        return `
          <div class="group-block">
            <p class="group-label">Grup ${g}</p>
            <div class="letter-grid">
              ${letters
                .map((l) => {
                  const p = progress[l.id];
                  const status = p ? p.status : "belum";
                  const dot = status === "dikuasai" ? "✓" : status === "dikenal" ? "•" : "";
                  return `<button class="letter-tile ${status}" data-id="${l.id}">${l.char.toUpperCase()}<span class="dot">${dot}</span></button>`;
                })
                .join("")}
            </div>
          </div>
        `;
      })
      .join("")}
  `;

  root.querySelector("#accountBtn").onclick = renderAccountScreen;

  root.querySelectorAll(".letter-tile").forEach((btn) => {
    btn.onclick = () => {
      currentLetter = lettersData.find((l) => l.id === btn.dataset.id);
      currentStepIdx = 0;
      attemptsWrong = 0;
      renderLoopScreen();
    };
  });
}

// =================================================================
// AKUN: daftar/masuk untuk orang tua & guru (Tahap 3)
// =================================================================
function accountPillLabel() {
  if (!isFirebaseConfigured) return "👤 Akun";
  const user = authApi.getCurrentUser();
  if (user && !user.isAnonymous) return `👤 ${user.email}`;
  return "👤 Simpan progres";
}

function translateAuthError(code) {
  const map = {
    "auth/email-already-in-use": "Email ini sudah terdaftar. Coba menu Masuk, bukan Daftar.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Akun dengan email ini belum terdaftar.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/credential-already-in-use": "Email ini sudah dipakai akun lain.",
  };
  return map[code] || "Terjadi kesalahan. Coba lagi.";
}

function renderAccountScreen() {
  // Firebase belum di-setup sama sekali -> tampilkan penjelasan, bukan form rusak
  if (!isFirebaseConfigured) {
    root.innerHTML = `
      <button class="back-link" id="backBtn">← Kembali</button>
      <div class="stage">
        <h1 class="step-title">Fitur Akun Belum Aktif</h1>
        <p class="step-sub">
          Progres saat ini tersimpan di device ini saja (localStorage).
          Untuk aktifkan akun orang tua/guru dan sinkronisasi progres lintas device,
          isi dulu <code>src/engine/firebaseConfig.js</code> sesuai panduan di README.
        </p>
        <div class="stage-footer"><button class="btn btn-primary" id="okBtn">Mengerti</button></div>
      </div>
    `;
    root.querySelector("#backBtn").onclick = renderMenu;
    root.querySelector("#okBtn").onclick = renderMenu;
    return;
  }

  const user = authApi.getCurrentUser();
  const isLoggedIn = user && !user.isAnonymous;

  if (isLoggedIn) {
    root.innerHTML = `
      <button class="back-link" id="backBtn">← Kembali</button>
      <div class="stage">
        <h1 class="step-title">Akun Kamu</h1>
        <p class="step-sub">Masuk sebagai <b>${user.email}</b>. Progres tersimpan otomatis ke akun ini.</p>
        <div class="stage-footer"><button class="btn btn-ghost" id="logoutBtn">Keluar</button></div>
      </div>
    `;
    root.querySelector("#backBtn").onclick = renderMenu;
    root.querySelector("#logoutBtn").onclick = async () => {
      await authApi.logoutAccount();
      renderMenu();
    };
    return;
  }

  // Belum login (masih sesi anonim) -> tampilkan form Daftar / Masuk
  let mode = "register"; // "register" | "login"

  function draw() {
    const title = mode === "register" ? "Simpan Progres — Buat Akun" : "Masuk ke Akun";
    const sub =
      mode === "register"
        ? "Progres yang sudah ada di device ini akan otomatis ikut tersimpan ke akun baru."
        : "Untuk lanjutkan progres dari akun yang sudah pernah dibuat di device lain.";
    const submitLabel = mode === "register" ? "Buat Akun" : "Masuk";
    const switchText =
      mode === "register" ? "Sudah punya akun? Masuk di sini" : "Belum punya akun? Daftar di sini";

    root.innerHTML = `
      <button class="back-link" id="backBtn">← Kembali</button>
      <div class="stage">
        <h1 class="step-title">${title}</h1>
        <p class="step-sub">${sub}</p>
        <form id="authForm" class="auth-form">
          <input class="auth-input" type="email" id="email" placeholder="Email orang tua/guru" required />
          <input class="auth-input" type="password" id="password" placeholder="Password (min. 6 karakter)" required minlength="6" />
          <p class="auth-error" id="authError"></p>
          <button type="submit" class="btn btn-primary" id="submitBtn">${submitLabel}</button>
        </form>
        <button class="switch-link" id="switchModeBtn">${switchText}</button>
      </div>
    `;
    root.querySelector("#backBtn").onclick = renderMenu;
    root.querySelector("#switchModeBtn").onclick = () => {
      mode = mode === "register" ? "login" : "register";
      draw();
    };
    root.querySelector("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      const email = root.querySelector("#email").value.trim();
      const password = root.querySelector("#password").value;
      const errorEl = root.querySelector("#authError");
      const submitBtn = root.querySelector("#submitBtn");
      errorEl.textContent = "";
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      try {
        if (mode === "register") {
          await authApi.registerAccount(email, password);
        } else {
          await authApi.loginAccount(email, password);
        }
        renderMenu();
      } catch (err) {
        errorEl.textContent = translateAuthError(err.code);
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    };
  }
  draw();
}

// =================================================================
// LOOP SCREEN: header (stones) + stage dinamis per langkah
// =================================================================
function renderLoopScreen() {
  root.innerHTML = `
    <button class="back-link" id="backBtn">← Kembali ke daftar huruf</button>
    <div class="path" id="path">
      ${STEP_LABELS.map((_, i) => `<div class="stone" data-i="${i}"></div>`).join("")}
    </div>
    <div class="stage" id="stage"></div>
  `;
  root.querySelector("#backBtn").onclick = renderMenu;
  updatePath();
  renderStep();
}

function updatePath() {
  const stones = Array.from(root.querySelectorAll(".stone"));
  stones.forEach((s, i) => {
    s.classList.toggle("done", i < currentStepIdx);
    s.classList.toggle("current", i === currentStepIdx);
    s.innerHTML = i < currentStepIdx ? '<span class="mark">✓</span>' : "";
  });
}

function goNext() {
  if (currentStepIdx < STEP_LABELS.length - 1) {
    currentStepIdx++;
    updatePath();
    renderStep();
  } else {
    renderCelebration();
  }
}

function renderStep() {
  const stage = root.querySelector("#stage");
  stage.innerHTML = "";
  const fns = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];
  fns[currentStepIdx](stage);
}

// pilih N huruf pengecoh, prioritaskan letter.similar dulu
function pickDistractors(letter, count) {
  const pool = [];
  letter.similar.forEach((ch) => {
    const found = lettersData.find((l) => l.char === ch);
    if (found) pool.push(found);
  });
  const others = lettersData.filter((l) => l.char !== letter.char && !pool.includes(l));
  while (pool.length < count && others.length) {
    const idx = Math.floor(Math.random() * others.length);
    pool.push(others.splice(idx, 1)[0]);
  }
  return pool.slice(0, count);
}

function shuffle(arr) {
  return arr
    .map((v) => [Math.random(), v])
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

// ---------- STEP 1: Kenalkan ----------
function renderStep1(stage) {
  const l = currentLetter;
  stage.innerHTML = `
    <h1 class="step-title">Ayo kenalan sama huruf ini!</h1>
    <p class="step-sub">Dengarkan dulu, ya.</p>
    <div class="letter-badge"><span>${l.char.toUpperCase()}${l.char}</span></div>
    <div class="sound-btns">
      <button class="btn btn-ghost" id="playName">🔊 Nama huruf</button>
      <button class="btn btn-ghost" id="playSound">🔊 Bunyi huruf</button>
    </div>
    <div class="word-card">
      <div class="emoji">${l.emoji}</div>
      <div class="word"><b>${l.char.toUpperCase()}</b>${l.word.slice(1)}</div>
    </div>
    <div class="stage-footer">
      <button class="btn btn-primary" id="next1">Lanjut</button>
    </div>
  `;
  stage.querySelector("#playName").onclick = () => speak(l.name);
  stage.querySelector("#playSound").onclick = () => speak(l.sound);
  stage.querySelector("#next1").onclick = goNext;
}

// ---------- STEP 2: Dengar & Tunjuk ----------
function renderStep2(stage) {
  const l = currentLetter;
  const options = shuffle([l, ...pickDistractors(l, 3)]);

  stage.innerHTML = `
    <h1 class="step-title">Dengar &amp; tunjuk hurufnya</h1>
    <p class="step-sub">Dengarkan bunyinya, lalu pilih huruf yang tepat.</p>
    <button class="btn btn-ghost" id="playSound2" style="margin-bottom:18px;">🔊 Putar bunyi</button>
    <div class="options-grid">
      ${options.map((o) => `<button class="opt-btn" data-char="${o.char}">${o.char.toUpperCase()}</button>`).join("")}
    </div>
    <div class="stage-footer" id="footer2"></div>
  `;
  const play = () => speak(l.sound);
  stage.querySelector("#playSound2").onclick = play;
  play();

  const btns = Array.from(stage.querySelectorAll(".opt-btn"));
  btns.forEach((b) => {
    b.onclick = () => {
      const correct = b.dataset.char === l.char;
      logEvent({ letterId: l.id, activity_type: "dengar_tunjuk", correct }).catch(console.error);
      if (correct) {
        btns.forEach((x) => (x.disabled = true));
        b.classList.add("correct");
        const footer = stage.querySelector("#footer2");
        footer.innerHTML = '<button class="btn btn-primary" id="next2">Lanjut</button>';
        footer.querySelector("#next2").onclick = goNext;
      } else {
        attemptsWrong++;
        b.classList.add("wrong");
        setTimeout(() => b.classList.remove("wrong"), 360);
      }
    };
  });
}

// ---------- STEP 3: Trace/Tulis (dengan rubrik BB/MB/BSH/BSB) ----------
function renderStep3(stage) {
  const l = currentLetter;
  stage.innerHTML = `
    <h1 class="step-title">Yuk, tulis hurufnya</h1>
    <p class="step-sub">Tarik jarimu mengikuti bentuk huruf ${l.char.toUpperCase()}.</p>
    <div class="trace-box">
      <div class="trace-guide">${l.char.toUpperCase()}</div>
      <canvas class="trace-canvas" id="traceCanvas"></canvas>
    </div>
    <div class="trace-actions"><button class="btn btn-ghost" id="clearTrace">Hapus</button></div>
    <div id="rubricSlot"></div>
    <div class="stage-footer" id="footer3">
      <button class="btn btn-primary" id="scoreBtn" disabled>Selesai menulis</button>
      <div id="afterScore" style="display:none; gap:10px;">
        <button class="btn btn-ghost" id="retryTrace">Coba lagi</button>
        <button class="btn btn-primary" id="next3">Lanjut</button>
      </div>
    </div>
  `;

  const canvas = stage.querySelector("#traceCanvas");
  const box = canvas.parentElement.getBoundingClientRect();
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent-deep").trim() || "#E96F1F";

  const guideMask = buildGuideMask(l.char, canvas.width, canvas.height);

  let drawing = false, pathLen = 0, lastX = 0, lastY = 0;
  let strokeCount = 0, startTime = null, endTime = null;
  const drawnPoints = [];

  const scoreBtn = stage.querySelector("#scoreBtn");
  const afterScore = stage.querySelector("#afterScore");
  const rubricSlot = stage.querySelector("#rubricSlot");

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  function start(e) {
    drawing = true;
    strokeCount++;
    if (startTime === null) startTime = performance.now();
    const p = pos(e);
    lastX = p.x; lastY = p.y;
    drawnPoints.push(p);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
    pathLen += Math.hypot(p.x - lastX, p.y - lastY);
    drawnPoints.push(p);
    lastX = p.x; lastY = p.y;
    if (pathLen > 260) scoreBtn.disabled = false;
    e.preventDefault();
  }
  function end() { drawing = false; endTime = performance.now(); }

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);

  function doClear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pathLen = 0; strokeCount = 0; startTime = null; endTime = null;
    drawnPoints.length = 0;
    rubricSlot.innerHTML = "";
    afterScore.style.display = "none";
    scoreBtn.style.display = "inline-block";
    scoreBtn.disabled = true;
  }
  stage.querySelector("#clearTrace").onclick = doClear;
  stage.querySelector("#retryTrace").onclick = doClear;

  function levelBadge(idx) {
    return `<span class="level-badge l${idx + 1}">${LEVEL_NAMES[idx]}</span>`;
  }

  scoreBtn.onclick = () => {
    const durationMs = (endTime || performance.now()) - (startTime || performance.now());
    const s = scoreTrace(drawnPoints, guideMask, strokeCount, durationMs);
    const overallIdx = overallLevel(s);

    logEvent({ letterId: l.id, activity_type: "trace", overall_level: LEVEL_NAMES[overallIdx], duration_ms: durationMs }).catch(console.error);

    rubricSlot.innerHTML = `
      <div class="rubric-card">
        <div class="rubric-row"><span>A. Bentuk Huruf</span>${levelBadge(s.levelA)}</div>
        <div class="rubric-row"><span>B. Arah &amp; Urutan Goresan</span>${levelBadge(s.levelB)}</div>
        <div class="rubric-row"><span>C. Proporsi &amp; Garis Dasar</span>${levelBadge(s.levelC)}</div>
        <div class="rubric-row"><span>D. Kelancaran &amp; Kontrol</span>${levelBadge(s.levelD)}</div>
        <div class="rubric-overall">Hasil: ${levelBadge(overallIdx)} <span style="color:var(--ink-soft); font-weight:600; font-size:12px;">(${LEVEL_LABELS[overallIdx]})</span></div>
      </div>
    `;
    scoreBtn.style.display = "none";
    afterScore.style.display = "flex";
    stage.querySelector("#next3").onclick = () => {
      if (overallIdx <= 1) attemptsWrong++;
      goNext();
    };
  };
}

// ---------- STEP 4: Ucapkan ----------
function renderStep4(stage) {
  const l = currentLetter;
  stage.innerHTML = `
    <h1 class="step-title">Sekarang, ucapkan!</h1>
    <p class="step-sub">Tekan tombol mikrofon lalu ucapkan bunyi "${l.sound}".</p>
    <div class="mic-wrap">
      <div class="mic-ring" id="ring"></div>
      <button class="mic-btn" id="micBtn">🎤</button>
    </div>
    <div id="afterMic"></div>
  `;
  const ring = stage.querySelector("#ring");
  const micBtn = stage.querySelector("#micBtn");
  const after = stage.querySelector("#afterMic");

  micBtn.onclick = () => {
    if (micBtn.disabled) return;
    micBtn.disabled = true;
    ring.classList.add("pulsing");
    speak(l.sound, 0.7);
    setTimeout(() => {
      ring.classList.remove("pulsing");
      after.innerHTML = `
        <p class="step-sub" style="margin-top:14px;">Sudah bilang "${l.sound}" dengan jelas?</p>
        <div class="selfcheck">
          <button class="btn btn-soft" id="yesSaid">Sudah, yakin! 👍</button>
          <button class="btn btn-ghost" id="retrySaid">Ulangi</button>
        </div>
        <div class="stage-footer" id="footer4"></div>
      `;
      after.querySelector("#yesSaid").onclick = () => {
        logEvent({ letterId: l.id, activity_type: "ucap", correct: true }).catch(console.error);
        after.querySelector("#footer4").innerHTML = '<button class="btn btn-primary" id="next4">Lanjut</button>';
        after.querySelector("#next4").onclick = goNext;
      };
      after.querySelector("#retrySaid").onclick = () => {
        micBtn.disabled = false;
        after.innerHTML = "";
      };
    }, 1200);
  };
}

// ---------- STEP 5: Terapkan dalam kata ----------
function renderStep5(stage) {
  const l = currentLetter;
  const restOfWord = l.word.slice(1); // huruf pertama kata SELALU = huruf target (lihat letters.json)
  const options = shuffle([l, ...pickDistractors(l, 2)]);

  stage.innerHTML = `
    <h1 class="step-title">Lengkapi kata ini</h1>
    <p class="step-sub">Huruf apa yang hilang?</p>
    <div class="apply-word">
      <div class="emoji">${l.emoji}</div>
      <div class="letters">
        <span class="blank-slot" id="blank">?</span>${restOfWord
          .split("")
          .map((c) => `<span>${c}</span>`)
          .join("")}
      </div>
    </div>
    <div class="options-grid" style="grid-template-columns:repeat(3,1fr);">
      ${options.map((o) => `<button class="opt-btn" data-char="${o.char}">${o.char.toUpperCase()}</button>`).join("")}
    </div>
    <div class="stage-footer" id="footer5"></div>
  `;

  const blank = stage.querySelector("#blank");
  const btns = Array.from(stage.querySelectorAll(".opt-btn"));
  btns.forEach((b) => {
    b.onclick = () => {
      const correct = b.dataset.char === l.char;
      logEvent({ letterId: l.id, activity_type: "terap_kata", correct }).catch(console.error);
      if (correct) {
        btns.forEach((x) => (x.disabled = true));
        b.classList.add("correct");
        blank.textContent = l.char.toUpperCase();
        blank.style.color = "var(--success)";
        blank.style.borderColor = "var(--success)";
        speak(l.word);
        const footer = stage.querySelector("#footer5");
        footer.innerHTML = '<button class="btn btn-primary" id="next5">Selesai!</button>';
        footer.querySelector("#next5").onclick = goNext;
      } else {
        attemptsWrong++;
        b.classList.add("wrong");
        setTimeout(() => b.classList.remove("wrong"), 360);
      }
    };
  });
}

// ---------- Celebration ----------
async function renderCelebration() {
  const l = currentLetter;
  const totalAttempts = 5 + attemptsWrong;
  const pct = Math.round((5 / totalAttempts) * 100);
  const wasCorrectOverall = pct >= 70; // ambang sederhana untuk MVP

  const stage = root.querySelector("#stage");
  stage.innerHTML = `<p style="text-align:center; color:var(--ink-soft); font-weight:600;">Menyimpan progres...</p>`;

  await recordAttempt(l.id, wasCorrectOverall);

  stage.innerHTML = `
    <div class="celebrate">
      <h1 class="step-title">Hebat! Huruf ${l.char.toUpperCase()} selesai 🎉</h1>
      <p class="step-sub">Kamu berhasil menyelesaikan semua langkah.</p>
      <div class="ring-score" style="--pct:${pct}%">
        <div class="inner"><b>${pct}%</b><span>akurasi sesi ini</span></div>
      </div>
      <div class="stage-footer">
        <button class="btn btn-ghost" id="menuBtn">Kembali ke daftar huruf</button>
      </div>
    </div>
  `;
  stage.querySelector("#menuBtn").onclick = renderMenu;
}
