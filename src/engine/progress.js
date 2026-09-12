// ---------------------------------------------------------------
// Ini file yang di-import oleh app.js — app.js TIDAK PERNAH
// import progress.cloud.js atau progress.local.js secara langsung.
//
// Router ini otomatis pilih:
//  - progress.cloud.js  -> kalau firebaseConfig.js sudah diisi
//  - progress.local.js  -> fallback, misal saat develop tanpa setup Firebase dulu
//
// Kalau nanti mau pindah ke Supabase atau backend lain, cukup buat
// progress.supabase.js baru dengan 5 fungsi yang sama, lalu tambahkan
// satu cabang lagi di bawah ini -- app.js tidak perlu disentuh sama sekali.
// ---------------------------------------------------------------

import { isFirebaseConfigured } from "./firebaseConfig.js";

const impl = isFirebaseConfigured
  ? await import("./progress.cloud.js")
  : await import("./progress.local.js");

if (!isFirebaseConfigured) {
  console.warn(
    "[progress.js] firebaseConfig.js belum diisi -- pakai localStorage sementara. " +
      "Progres HANYA tersimpan di device ini. Isi src/engine/firebaseConfig.js untuk aktifkan sinkronisasi cloud."
  );
}

export const getLetterProgress = impl.getLetterProgress;
export const getAllProgress = impl.getAllProgress;
export const recordAttempt = impl.recordAttempt;
export const logEvent = impl.logEvent;
export const getSessionLog = impl.getSessionLog;
