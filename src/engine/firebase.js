import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ---------------------------------------------------------------
// currentUid SELALU mengikuti sesi auth yang aktif saat ini (bukan
// cuma sesi pertama kali app dibuka). Ini penting karena setelah
// registerAccount()/loginAccount()/logoutAccount() dipanggil, uid
// yang aktif bisa berubah -- progress.cloud.js harus baca uid TERBARU
// tiap kali dipanggil, bukan uid dari waktu app pertama kali dibuka.
// ---------------------------------------------------------------
let currentUid = null;
let firstAuthResolve;
const firstAuthReady = new Promise((res) => (firstAuthResolve = res));

const listeners = [];
// UI (app.js) daftar di sini untuk tahu kapan status login berubah,
// misal supaya bisa update tulisan "Masuk sebagai ..." di header.
export function onAuthChange(cb) {
  listeners.push(cb);
  if (auth.currentUser) cb(auth.currentUser);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUid = user.uid;
    firstAuthResolve();
    listeners.forEach((cb) => cb(user));
  } else {
    currentUid = null;
    signInAnonymously(auth).catch((e) => console.error("Auth anonim gagal:", e));
  }
});

export async function getCurrentUid() {
  if (!currentUid) await firstAuthReady;
  return currentUid;
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ---------------------------------------------------------------
// Daftar akun baru: meng-upgrade sesi anonim yang sedang aktif jadi
// akun email/password permanen. UID TIDAK BERUBAH, jadi semua progres
// yang sudah tersimpan di sesi anonim ini otomatis ikut terbawa --
// tidak perlu proses "pindahkan data" terpisah.
// ---------------------------------------------------------------
export async function registerAccount(email, password) {
  if (!auth.currentUser) throw new Error("Belum ada sesi aktif.");
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(auth.currentUser, credential);
  return result.user;
}

// ---------------------------------------------------------------
// Masuk ke akun yang SUDAH PERNAH didaftarkan (misal buka di device
// baru). PENTING: ini mengganti sesi aktif ke uid akun tsb, jadi
// progres anonim yang mungkin baru dibuat di device ini SEBELUM login
// (dan belum sempat didaftarkan) tidak ikut pindah -- tetap ada di
// Firestore dengan uid anonim lama, hanya saja tidak lagi terhubung
// ke sesi yang sedang dipakai. Ini batasan yang wajar untuk MVP.
// ---------------------------------------------------------------
export async function loginAccount(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function logoutAccount() {
  await signOut(auth); // onAuthStateChanged otomatis bikin sesi anonim baru setelah ini
}
