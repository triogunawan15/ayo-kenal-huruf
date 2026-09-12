// ---------------------------------------------------------------
// Isi objek di bawah ini dengan config dari proyek Firebase-mu.
//
// Cara dapatnya (gratis, ± 5 menit):
// 1. Buka https://console.firebase.google.com → "Add project"
// 2. Setelah project jadi, klik ikon web "</>" untuk daftarkan app web
// 3. Firebase akan menampilkan objek `firebaseConfig` persis seperti di bawah ini — copy-paste ke sini
// 4. Di menu kiri, aktifkan:
//    - Build → Firestore Database → Create database (mode production, pilih region terdekat misal asia-southeast2)
//    - Build → Authentication → Get started → aktifkan provider "Anonymous"
// 5. Upload firestore.rules (ada di root proyek ini) lewat tab "Rules" di Firestore Console
//
// CATATAN: config di bawah ini BUKAN rahasia (aman ditaruh di kode frontend) —
// keamanan data sebenarnya dijaga oleh Firestore Security Rules (firestore.rules),
// bukan dengan menyembunyikan config ini.
// ---------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_KAMU",
  authDomain: "GANTI.firebaseapp.com",
  projectId: "GANTI_PROJECT_ID",
  storageBucket: "GANTI.appspot.com",
  messagingSenderId: "GANTI_SENDER_ID",
  appId: "GANTI_APP_ID",
};

// Dipakai progress.js untuk memutuskan pakai Firestore atau fallback localStorage
export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith("GANTI") &&
  !firebaseConfig.projectId.startsWith("GANTI");
