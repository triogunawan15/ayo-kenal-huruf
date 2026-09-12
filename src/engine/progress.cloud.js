// ---------------------------------------------------------------
// Implementasi CLOUD dari progress store, pakai Firestore.
//
// Struktur data:
//   users/{uid}                         → 1 dokumen per anak/device
//     .letters: { [letterId]: {...} }   → sama persis dengan kolom di sheet Progres_Anak
//   users/{uid}/sessionLog/{autoId}     → 1 dokumen per event, sama persis dengan sheet Log_Sesi
//
// Semua fungsi di sini async (return Promise) — dipanggil lewat
// progress.js (file router), bukan dipanggil langsung dari app.js.
// ---------------------------------------------------------------

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, getCurrentUid } from "./firebase.js";

function emptyLetterProgress() {
  return {
    status: "belum", // belum | dikenal | dikuasai
    accuracy_streak: 0,
    total_attempts: 0,
    total_correct: 0,
    last_seen_at: null,
  };
}

async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return { ref, data: snap.exists() ? snap.data() : { letters: {} } };
}

export async function getLetterProgress(letterId) {
  const uid = await getCurrentUid();
  const { data } = await getUserDoc(uid);
  return (data.letters && data.letters[letterId]) || emptyLetterProgress();
}

export async function getAllProgress() {
  const uid = await getCurrentUid();
  const { data } = await getUserDoc(uid);
  return data.letters || {};
}

export async function recordAttempt(letterId, wasCorrect) {
  const uid = await getCurrentUid();
  const { ref, data } = await getUserDoc(uid);
  const letters = data.letters || {};
  const p = letters[letterId] || emptyLetterProgress();

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

  letters[letterId] = p;
  await setDoc(ref, { letters }, { merge: true });
  return p;
}

export async function logEvent(entry) {
  const uid = await getCurrentUid();
  const logRef = collection(db, "users", uid, "sessionLog");
  await addDoc(logRef, { ...entry, timestamp: serverTimestamp() });
}

export async function getSessionLog() {
  // Untuk MVP, dashboard laporan mingguan (Tahap 4) yang akan query ini
  // pakai orderBy + limit di sisi kode dashboard, bukan di sini,
  // supaya progress.js tetap jadi lapisan generik & ringan.
  const uid = await getCurrentUid();
  return uid; // dashboard bisa pakai uid ini untuk query collection sessionLog sendiri
}
