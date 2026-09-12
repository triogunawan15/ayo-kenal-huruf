// Pembungkus tipis untuk Web Speech API.
// Gratis & tanpa kuota, tapi kualitas suara tergantung browser/OS.
// Bisa diganti dengan file audio rekaman asli nanti tanpa mengubah
// kode yang memanggil speak() — tinggal ganti isi fungsi ini.

export function speak(text, rate = 0.85) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.rate = rate;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.error("TTS gagal:", e);
  }
}
