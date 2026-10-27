import * as THREE from 'three';

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createStarSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(224, 242, 254, 0.95)');
  gradient.addColorStop(0.42, 'rgba(186, 230, 253, 0.45)');
  gradient.addColorStop(0.75, 'rgba(56, 189, 248, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  // Subtle 4-point sparkle flare
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(31, 8, 2, 48);
  ctx.fillRect(8, 31, 48, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createRoadAsphaltTexture(
  maxAnisotropy: number,
  repeatLength = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#262930';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt aggregate grain
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 30 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Yellow curb edge lines
  ctx.fillStyle = '#eab308';
  ctx.fillRect(16, 0, 8, 512);
  ctx.fillRect(488, 0, 8, 512);

  // Center white dashed lane divider
  ctx.fillStyle = '#f8fafc';
  for (let y = 32; y < 512; y += 128) {
    ctx.fillRect(251, y, 10, 64);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, repeatLength);
}

export function createRoadIntersectionTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#262930';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 30 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Zebra cross stripes on all 4 approaches
  ctx.fillStyle = '#e2e8f0';
  for (let s = 64; s <= 424; s += 36) {
    // Top & Bottom crosswalks
    ctx.fillRect(s, 18, 20, 54);
    ctx.fillRect(s, 440, 20, 54);
    // Left & Right crosswalks
    ctx.fillRect(18, s, 54, 20);
    ctx.fillRect(440, s, 54, 20);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, 1);
}

export function createPavingTrotoarTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 256, 256);

  // Conblock herringbone / brick grid
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  for (let y = 0; y < 256; y += 32) {
    const offset = (y / 32) % 2 === 0 ? 0 : 32;
    for (let x = -32; x < 256; x += 64) {
      ctx.strokeRect(x + offset, y, 64, 32);
    }
  }

  // Yellow guiding block (tactile strip for Indonesian trotoar)
  ctx.fillStyle = '#facc15';
  ctx.fillRect(112, 0, 32, 256);
  ctx.fillStyle = '#ca8a04';
  for (let y = 8; y < 256; y += 24) {
    ctx.fillRect(118, y, 6, 14);
    ctx.fillRect(132, y, 6, 14);
  }

  // Black-and-white painted kansteen (curb border)
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = (y / 64) % 2 === 0 ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, y, 18, 64);
    ctx.fillRect(238, y, 18, 64);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 2, 24);
}

export function createWarungSpandukTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  borderColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  // Characteristic bright Lamongan yellow/green warung banner
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 192);

  // Decorative border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, 496, 176);

  // Header badge
  ctx.fillStyle = borderColor;
  ctx.fillRect(20, 20, 472, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KULINER MALAM NUSANTARA ASLI', 256, 45, 440);

  // Main title (smaller font + maxWidth 440px so long text never overflows border)
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 28px "Chakra Petch", sans-serif';
  ctx.fillText(title, 256, 106, 440);

  // Subtitle
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle, 256, 150, 440);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createMinimarketSignTexture(
  brand: 'INDOALFA' | 'ALFAMARET',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 160);

  // Iconic tri-color stripes (Red, Blue, Yellow)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 34);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 34, 512, 20);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 126, 512, 34);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 54px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(brand, 256, 106);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createLicensePlateTexture(
  plateNumber: string,
  isPublicYellow: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isPublicYellow ? '#facc15' : '#0f172a';
  ctx.fillRect(0, 0, 256, 96);

  ctx.strokeStyle = isPublicYellow ? '#0f172a' : '#f8fafc';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = isPublicYellow ? '#0f172a' : '#f8fafc';
  ctx.font = 'bold 40px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(plateNumber, 128, 54);

  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('10 · 30', 128, 80);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createBatikFabricTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Rich sogan brown & gold batik pattern
  ctx.fillStyle = '#451a03';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 4;
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 2, 2);
}

export function createRukoFacadeTexture(
  wallColor: string,
  windowLit: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, 256, 512);

  // Horizontal floor bands
  ctx.fillStyle = '#334155';
  for (let y = 120; y < 512; y += 120) {
    ctx.fillRect(0, y, 256, 10);
  }

  // Windows on upper floors
  for (let y = 30; y < 360; y += 120) {
    for (let x = 28; x < 220; x += 72) {
      ctx.fillStyle = windowLit ? '#fef08a' : '#1e293b';
      ctx.fillRect(x, y, 48, 68);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, 48, 68);
    }
  }

  // Ground floor rolling shutter / folding iron ruko door
  ctx.fillStyle = '#475569';
  ctx.fillRect(24, 390, 208, 122);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  for (let x = 24; x <= 232; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 390);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createGangPavingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Weathered gray paving / aspal kampung
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 256, 512);

  // Conblock interlocking grid pattern
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 24) {
    const offset = (y / 24) % 2 === 0 ? 0 : 20;
    for (let x = -20; x < 256; x += 40) {
      ctx.strokeRect(x + offset, y, 40, 24);
    }
  }

  // Stone alley curbs along left and right edges (gang senggol border)
  for (let y = 0; y < 512; y += 48) {
    ctx.fillStyle = (y / 48) % 2 === 0 ? '#1e293b' : '#94a3b8';
    ctx.fillRect(0, y, 14, 48);
    ctx.fillRect(242, y, 14, 48);
  }

  // Polisi Tidur (Speed Bump) with bold yellow & black hazard stripes at intervals
  for (const py of [110, 360]) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, py - 10, 228, 20);
    // Yellow diagonal hazard stripes
    ctx.fillStyle = '#facc15';
    for (let sx = 20; sx < 240; sx += 26) {
      ctx.beginPath();
      ctx.moveTo(sx, py - 10);
      ctx.lineTo(sx + 14, py - 10);
      ctx.lineTo(sx + 6, py + 10);
      ctx.lineTo(sx - 8, py + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, 4);
}

export function createGentengClayTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm terracotta clay roof tiles (genteng tanah liat)
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 20) {
    const shift = (y / 20) % 2 === 0 ? 0 : 16;
    for (let x = -16; x < 256; x += 32) {
      // Tile body highlight
      const grad = ctx.createLinearGradient(x + shift, y, x + shift + 32, y + 20);
      grad.addColorStop(0, '#c2410c');
      grad.addColorStop(0.7, '#9a3412');
      grad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = grad;
      ctx.fillRect(x + shift, y, 32, 19);

      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + shift, y, 32, 20);
    }
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 2, 2);
}

export function createMaduraSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 140);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 128);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOKO MADURA 24 JAM', 256, 48);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PERTAMINI BENSIN · GAS ELPIJI 3KG · SEMBAKO LENGKAP', 256, 82);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText('BUKA 24 JAM SETIAP HARI · SIAP MELAYANI WARGA', 256, 114);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createPasarBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(20, 20, 472, 34);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PEMERINTAH KOTA · DINAS PERDAGANGAN & PASAR', 256, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px "Chakra Petch", sans-serif';
  ctx.fillText('PASAR RAKYAT TRADISIONAL', 256, 98);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ANEKA SAYUR MAYUR · BUAH SEGAR · KULINER JAJAN PASAR', 256, 134);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createPosKamlingSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 384, 120);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 376, 112);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POS KAMLING RT 03 / RW 05', 192, 42);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SISKAMLING 24 JAM · AMAN & TERTIB', 192, 74);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('DARURAT / RONDA MALAM: KETUK KENTONGAN', 192, 102);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createTokoSembakoSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 30px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOKO SEMBAKO BU TEJO', 256, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BERAS · TELUR · MINYAK · GAS ELPIJI 3KG · KERUPUK BLEK', 256, 82);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText('GANG MERPATI RT 04 · HARGA WARGA · ECERAN & GROSIR', 256, 110);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createWarkopSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 448;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#451a03';
  ctx.fillRect(0, 0, 448, 112);

  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 438, 102);

  ctx.fillStyle = '#fed7aa';
  ctx.font = '900 26px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WARKOP MBAH DARMO', 224, 42);

  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KOPI TUBRUK JOSS · GORENGAN ANGET · ES TEH', 224, 74);

  ctx.fillStyle = '#fdba74';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('NONGKRONG SANTAI · WI-FI GRATIS KAMPUNG', 224, 98);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createTPUSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, 512, 140);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 128);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PEMERINTAH KOTA · DINAS PERTAMANAN & PEMAKAMAN', 256, 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px "Chakra Petch", sans-serif';
  ctx.fillText('TPU KAMBOJA NUSANTARA', 256, 76);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TEMPAT PEMAKAMAN UMUM WARGA · BLOK A & B · ZIARah TERTIB', 256, 112);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createTPSSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  // Red top band & white bottom band (Merah Putih KPPS)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 74);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 74, 512, 66);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 132);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KOMISI PEMILIHAN UMUM · KPPS RT 04 / RW 05', 256, 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 30px "Chakra Petch", sans-serif';
  ctx.fillText('TPS 04 KAMPUNG NUSANTARA', 256, 62);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TEMPAT PEMUNGUTAN SUARA WARGA', 256, 100);

  ctx.fillStyle = '#7e22ce';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText('LANGSUNG · UMUM · BEBAS · RAHASIA · JUJUR & ADIL', 256, 124);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createBankSampahSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 448;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 448, 120);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 438, 110);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 23px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TPS LINGKUNGAN & BANK SAMPAH', 224, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PILAH SAMPAH: ORGANIK · ANORGANIK · B3', 224, 74);

  ctx.fillStyle = '#bbf7d0';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText('DINAS LINGKUNGAN HIDUP · KAMPUNG BERSIH & ASRI', 224, 100);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createRumahKarakterSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 448;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 448, 120);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 438, 110);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SAFEHOUSE NUSANTARA · RT 01 / RW 01 BLOK M', 224, 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 25px "Chakra Petch", sans-serif';
  ctx.fillText('RUMAH PRIBADI KARAKTER', 224, 68);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TEMPAT ISTIRAHAT · TIDUR · MAKAN · BERSANTAI', 224, 100);

  return finalizeColorTexture(canvas, maxAnisotropy);
}


