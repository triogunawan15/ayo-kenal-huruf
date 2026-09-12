// ---------------------------------------------------------------
// Implementasi LOCAL dari progress store, pakai localStorage.
// Dipakai otomatis sebagai fallback kalau Firebase belum dikonfigurasi
// (lihat firebaseConfig.js) — misal saat masih develop tanpa internet,
// atau belum sempat setup project Firebase.
//
// Semua fungsi dibuat async (return Promise) supaya bentuknya SAMA
// PERSIS dengan progress.cloud.js — jadi progress.js (file router)
// bisa pilih salah satu tanpa app.js perlu tahu bedanya.
// ---------------------------------------------------------------

const STORAGE_KEY = "kenal_huruf_progress_v1";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Gagal membaca progres:", e);
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Gagal menyimpan progres:", e);
  }
}

// letterId -> { status, accuracy_streak, total_attempts, total_correct, last_seen_at }
export async function getLetterProgress(letterId) {
  const all = loadAll();
  return (
    all[letterId] || {
      status: "belum", // belum | dikenal | dikuasai
      accuracy_streak: 0,
      total_attempts: 0,
      total_correct: 0,
      last_seen_at: null,
    }
  );
}

export async function getAllProgress() {
  return loadAll();
}

export async function recordAttempt(letterId, wasCorrect) {
  const all = loadAll();
  const p = all[letterId] || {
    status: "belum",
    accuracy_streak: 0,
    total_attempts: 0,
    total_correct: 0,
    last_seen_at: null,
  };

  p.total_attempts += 1;
  if (wasCorrect) {
    p.total_correct += 1;
    p.accuracy_streak += 1;
  } else {
    p.accuracy_streak = 0;
  }
  p.last_seen_at = new Date().toISOString();

  const accuracy = p.total_attempts ? p.total_correct / p.total_attempts : 0;
  if (accuracy >= 0.9 && p.accuracy_streak >= 3) {
    p.status = "dikuasai";
  } else if (p.total_attempts > 0) {
    p.status = "dikenal";
  }

  all[letterId] = p;
  saveAll(all);
  return p;
}

// Simpan 1 baris log mentah, mirip tabel session_log.
// Untuk MVP disimpan ringkas di localStorage juga (dibatasi jumlahnya),
// nanti saat pindah ke Firebase/Supabase ini jadi 1 dokumen per event.
const LOG_KEY = "kenal_huruf_session_log_v1";
const MAX_LOG_ENTRIES = 500;

export async function logEvent(entry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({ ...entry, timestamp: new Date().toISOString() });
    while (log.length > MAX_LOG_ENTRIES) log.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error("Gagal menyimpan log sesi:", e);
  }
}

export async function getSessionLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
