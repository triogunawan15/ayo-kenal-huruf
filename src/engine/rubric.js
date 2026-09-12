// ---------------------------------------------------------------
// Rubrik penilaian trace tulisan huruf (lihat dokumen
// "rubrik-penilaian-trace-huruf.md" untuk penjelasan lengkapnya).
//
// Modul ini menghitung 4 kriteria dari data titik-titik coretan
// (drawnPoints) dibandingkan dengan bentuk huruf asli (guidePoints),
// lalu memetakannya ke level BB(0) / MB(1) / BSH(2) / BSB(3).
// ---------------------------------------------------------------

export const LEVEL_NAMES = ["BB", "MB", "BSH", "BSB"];
export const LEVEL_LABELS = [
  "Belum Berkembang",
  "Mulai Berkembang",
  "Berkembang Sesuai Harapan",
  "Berkembang Sangat Baik",
];

// Bangun "peta" pixel huruf target dari sebuah canvas offscreen.
// Dipanggil sekali tiap kali huruf baru dibuka.
export function buildGuideMask(char, width, height, step = 6) {
  const guideCanvas = document.createElement("canvas");
  guideCanvas.width = width;
  guideCanvas.height = height;
  const gctx = guideCanvas.getContext("2d");
  gctx.fillStyle = "#000";
  gctx.textAlign = "center";
  gctx.textBaseline = "middle";
  gctx.font = `800 ${Math.round(height * 0.68)}px 'Baloo 2', sans-serif`;
  gctx.fillText(char.toUpperCase(), width / 2, height / 2 + height * 0.02);

  const data = gctx.getImageData(0, 0, width, height).data;
  const guidePoints = [];
  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 128) {
        guidePoints.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const aspect = (maxY - minY) / Math.max(1, maxX - minX);
  const idealStart = {
    x: minX + (maxX - minX) * 0.18,
    y: minY + (maxY - minY) * 0.06,
  };

  return { guidePoints, aspect, bbox: { minX, maxX, minY, maxY }, idealStart };
}

function nearestDist(point, arr) {
  let best = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.hypot(point.x - arr[i].x, point.y - arr[i].y);
    if (d < best) best = d;
  }
  return best;
}

// drawnPoints: array {x,y} berurutan sesuai waktu digambar
// strokeCount: jumlah kali pointerdown ("angkat pena")
// durationMs: waktu total pengerjaan
export function scoreTrace(drawnPoints, guideMask, strokeCount, durationMs) {
  const { guidePoints, aspect: guideAspect, idealStart } = guideMask;

  if (drawnPoints.length < 4) {
    return { levelA: 0, levelB: 0, levelC: 0, levelD: 0 };
  }

  const sampleEvery = Math.max(1, Math.floor(drawnPoints.length / 180));
  const drawnSample = drawnPoints.filter((_, i) => i % sampleEvery === 0);

  // A. Bentuk Huruf — coverage + deviasi
  let covered = 0;
  guidePoints.forEach((gp) => {
    if (nearestDist(gp, drawnSample) < 16) covered++;
  });
  const coveragePct = guidePoints.length ? (covered / guidePoints.length) * 100 : 0;
  let devSum = 0;
  drawnSample.forEach((dp) => (devSum += nearestDist(dp, guidePoints)));
  const avgDeviation = drawnSample.length ? devSum / drawnSample.length : 999;

  let levelA;
  if (coveragePct < 40) levelA = 0;
  else if (coveragePct < 65) levelA = 1;
  else if (coveragePct < 85) levelA = 2;
  else levelA = avgDeviation < 14 ? 3 : 2;

  // B. Arah & Urutan Goresan
  const first = drawnPoints[0];
  const startDist = Math.hypot(first.x - idealStart.x, first.y - idealStart.y);
  const early = drawnPoints[Math.min(drawnPoints.length - 1, Math.floor(drawnPoints.length * 0.3))] || first;
  const movesDown = early.y - first.y > 0;

  let levelB;
  if (startDist > 60) levelB = 0;
  else if (startDist > 35 || !movesDown) levelB = 1;
  else levelB = startDist <= 20 ? 3 : 2;

  // C. Proporsi & Garis Dasar
  const dMinX = Math.min(...drawnPoints.map((p) => p.x));
  const dMaxX = Math.max(...drawnPoints.map((p) => p.x));
  const dMinY = Math.min(...drawnPoints.map((p) => p.y));
  const dMaxY = Math.max(...drawnPoints.map((p) => p.y));
  const drawnAspect = (dMaxY - dMinY) / Math.max(1, dMaxX - dMinX);
  const ratioDiffPct = (Math.abs(drawnAspect - guideAspect) / guideAspect) * 100;

  let levelC;
  if (ratioDiffPct > 40) levelC = 0;
  else if (ratioDiffPct > 20) levelC = 1;
  else if (ratioDiffPct > 10) levelC = 2;
  else levelC = 3;

  // D. Kelancaran & Kontrol
  let angleChangeSum = 0, count = 0;
  for (let i = 2; i < drawnSample.length; i++) {
    const a1 = Math.atan2(drawnSample[i - 1].y - drawnSample[i - 2].y, drawnSample[i - 1].x - drawnSample[i - 2].x);
    const a2 = Math.atan2(drawnSample[i].y - drawnSample[i - 1].y, drawnSample[i].x - drawnSample[i - 1].x);
    let diff = Math.abs(a2 - a1) * (180 / Math.PI);
    if (diff > 180) diff = 360 - diff;
    angleChangeSum += diff;
    count++;
  }
  const avgAngleChange = count ? angleChangeSum / count : 0;

  let levelD;
  if (avgAngleChange > 45) levelD = 0;
  else if (avgAngleChange > 30) levelD = 1;
  else if (avgAngleChange > 18) levelD = 2;
  else levelD = 3;
  if (strokeCount > 5) levelD = Math.min(levelD, 1);
  if (levelD === 3 && durationMs > 9000) levelD = 2;

  return { levelA, levelB, levelC, levelD };
}

export function overallLevel({ levelA, levelB, levelC, levelD }) {
  return Math.round((levelA + levelB + levelC + levelD) / 4);
}
