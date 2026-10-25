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
