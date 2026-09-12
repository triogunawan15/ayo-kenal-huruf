# Ayo Kenal Huruf — Starter Project

Starter project aplikasi belajar mengenal huruf untuk anak TK. Ini adalah hasil generalisasi dari prototipe (yang tadinya cuma 1 huruf "B") jadi engine yang membaca 26 huruf dari data, sesuai **Tahap 1** di `roadmap-siap-jual.md`.

Dibangun pakai [Vite](https://vitejs.dev/) + JavaScript biasa (tanpa framework berat), supaya ringan dan gampang dikembangkan tanpa perlu install banyak hal.

---

## Cara Membuka Proyek Ini (tanpa install apa pun, cukup dari browser/tablet)

### Opsi A — StackBlitz (paling cepat)
1. Buka [stackblitz.com](https://stackblitz.com)
2. Klik "Create new project" → pilih import dari folder/ZIP, atau upload isi folder ini
3. StackBlitz otomatis `npm install` dan menjalankan `npm run dev` — langsung ada preview live

### Opsi B — GitHub Codespaces
1. Push folder ini ke repo GitHub baru
2. Di halaman repo, klik tombol hijau **Code → Codespaces → Create codespace on main**
3. Setelah codespace terbuka, jalankan di terminal:
   ```
   npm install
   npm run dev
   ```
4. Codespaces akan menawarkan buka preview di tab browser baru — bisa langsung dites di MatePad

### Opsi C — Lokal (kalau nanti pakai laptop/PC)
```
npm install
npm run dev
```
Lalu buka `http://localhost:5173` di browser.

---

## Struktur Folder

```
letter-app-starter/
├── index.html              ← entry point HTML
├── package.json
├── vite.config.js          ← target esnext (dibutuhkan progress.js)
├── firestore.rules         ← security rules Firestore, wajib dipasang
├── public/
│   ├── icon.svg             ← ikon app (ganti dengan desain final nanti)
│   └── manifest.webmanifest ← supaya app bisa di-"Add to Home Screen" (PWA)
└── src/
    ├── main.js              ← titik masuk, import CSS + jalankan app
    ├── app.js                ← SEMUA logika UI & alur (menu huruf + loop 5 langkah)
    ├── style.css             ← semua styling, token warna sama dengan prototipe
    ├── data/
    │   └── letters.json      ← "single source of truth" 26 huruf (turunan dari sheet Daftar_Huruf)
    └── engine/
        ├── progress.js        ← ROUTER: pilih otomatis cloud atau local, ini yang di-import app.js
        ├── progress.cloud.js  ← implementasi Firestore (aktif kalau firebaseConfig.js sudah diisi)
        ├── progress.local.js  ← implementasi localStorage (fallback)
        ├── firebase.js         ← init Firebase app + auth anonim + daftar/masuk/keluar (email-password)
        ├── firebaseConfig.js   ← ISI INI dengan config dari Firebase Console-mu
        ├── tts.js              ← pembungkus Web Speech API (audio nama & bunyi huruf)
        └── rubric.js           ← algoritma skor trace BB/MB/BSH/BSB (dari rubrik yang sudah kita susun)
```

### Kenapa dipisah begini?
- **`data/letters.json`** terpisah dari kode supaya nanti kamu (atau siapa pun, bahkan non-programmer) bisa mengedit kata contoh/urutan huruf tanpa menyentuh kode sama sekali.
- **`engine/progress.js`** adalah lapisan router. Kode di `app.js` HANYA import dari file ini, tidak pernah tahu apakah datanya sebenarnya disimpan di Firestore atau localStorage. Ini yang bikin migrasi Tahap 2 tidak perlu mengubah `app.js` sama sekali — cukup isi `firebaseConfig.js`.
- **`engine/rubric.js`** adalah port langsung dari algoritma skor trace di prototipe, tapi sekarang bisa dipakai untuk huruf apa pun (bukan cuma "B").

---

## Menambah/Mengedit Huruf

Cukup edit `src/data/letters.json`. Tiap huruf punya field:

| Field | Arti |
|---|---|
| `id` | ID unik, dipakai untuk nyimpen progres |
| `char` | huruf kecilnya, misal `"b"` |
| `group` | grup pengenalan (1-5), menentukan pengelompokan di menu |
| `order` | urutan perkenalan dalam grup |
| `name` | cara mengucapkan nama huruf, misal `"be"` |
| `sound` | bunyi fonik huruf, misal `"buh"` |
| `word` | kata contoh, HARUS diawali huruf yang sama (misal "Bola" untuk huruf "b") |
| `emoji` | ikon sederhana buat kata contoh (bisa diganti ilustrasi asli nanti) |
| `similar` | daftar huruf yang bentuknya mirip, dipakai sebagai "pengecoh" di soal pilihan ganda |

---

## Setup Firebase (Tahap 2 — Sinkronisasi Progres ke Cloud)

Secara default, project ini jalan pakai `localStorage` (progres cuma tersimpan di 1 device). Untuk aktifkan sinkronisasi cloud gratis via Firebase:

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (gratis, paket Spark)
2. Di dashboard project, klik ikon web `</>` untuk daftarkan app web baru → Firebase akan menampilkan objek `firebaseConfig`
3. Copy-paste objek itu ke `src/engine/firebaseConfig.js` (gantikan nilai `"GANTI_..."`)
4. Di menu kiri Firebase Console:
   - **Build → Firestore Database → Create database** (mode production, pilih region terdekat, misal `asia-southeast2`)
   - **Build → Authentication → Get started** → aktifkan provider **Anonymous**
5. Di tab **Rules** pada Firestore Database, paste isi `firestore.rules` (ada di root proyek ini) → **Publish**
6. Jalankan ulang `npm run dev` — progres sekarang otomatis tersimpan ke Firestore, terikat ke 1 UID anonim per device

> Kenapa "Anonymous" dulu, bukan email/password? Supaya anak bisa langsung mulai belajar tanpa orang tua harus daftar akun dulu (mengurangi friksi di MVP). Nanti di **Tahap 3** (login orang tua/guru), akun anonim ini di-"upgrade" jadi akun sungguhan pakai `linkWithCredential` dari Firebase — progres yang sudah ada TIDAK hilang.

Kalau `firebaseConfig.js` belum diisi, app otomatis fallback ke `localStorage` (ada warning di console browser) — jadi kamu tetap bisa develop/coba app-nya duluan sebelum sempat setup Firebase.

---

## Akun Orang Tua/Guru (Tahap 3 — Login)

Ada tombol **"👤 Akun"** di menu utama. Alurnya:

- **Sebelum ada akun**: anak bisa langsung main (sesi anonim, dari Tahap 2). Tombol akun menampilkan pilihan **Daftar** (email + password) — begitu didaftarkan, sesi anonim yang sedang aktif langsung "naik level" jadi akun permanen, **semua progres yang sudah ada ikut terbawa otomatis** (uid tidak berubah, cuma ditambahkan cara login).
- **Sudah punya akun** (misal buka di HP lain): pilih **Masuk**, isi email/password yang sama. Device itu akan memuat progres dari akun tersebut.
- **Sudah login**: tombol akun menampilkan email yang aktif + tombol **Keluar**.

⚠️ **Batasan yang perlu kamu tahu**: kalau di sebuah device sempat ada progres anonim (anak main dulu tanpa akun), LALU orang tua memilih **Masuk** ke akun lain (bukan **Daftar**) di device yang sama, progres anonim yang tadi ada tidak otomatis digabung ke akun tersebut — supaya tergabung, harus pakai **Daftar** (yang meng-upgrade sesi aktif), bukan **Masuk**. Ini batasan yang wajar untuk versi MVP; kalau nanti butuh alur "gabungkan 2 akun", itu pengembangan lanjutan yang lebih kompleks.

Kalau `firebaseConfig.js` belum diisi, tombol akun akan menampilkan penjelasan bahwa fitur ini perlu setup Firebase dulu, bukan form yang rusak/error.

---



- [x] ~~**Tahap 2**: ganti `engine/progress.js` dari localStorage ke Firebase/Supabase~~ — sudah, tinggal isi `firebaseConfig.js` (lihat panduan di atas)
- [x] ~~**Tahap 3**: tambahkan login sederhana untuk orang tua/guru~~ — sudah, tombol "👤 Akun" di menu utama
- [ ] **Tahap 4**: hubungkan halaman laporan mingguan (`laporan-mingguan-orang-tua.html`) ke data sungguhan dari `progress.js`
- [ ] Ganti ikon SVG placeholder di `public/icon.svg` dengan desain final
- [ ] Ganti audio Web Speech API dengan rekaman suara asli kalau kualitasnya kurang natural

## Deploy (Gratis)

1. Push repo ini ke GitHub
2. Buka [vercel.com](https://vercel.com) atau [netlify.com](https://netlify.com), hubungkan akun GitHub
3. Import repo ini — build command `npm run build`, output folder `dist`
4. Dapat URL publik gratis, bisa langsung dibuka & di-"Add to Home Screen" dari MatePad
