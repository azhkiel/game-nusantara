import { InteractableSpot, Mission, VehicleSpec } from '../types/game';

export const VEHICLE_SPECS: Record<string, VehicleSpec> = {
  bajaj: {
    type: 'bajaj',
    name: 'Bajaj Oranye BBG',
    subtitle: 'Raja Jalanan Roda Tiga · Lincah di Gang Sempit',
    maxSpeed: 28,
    acceleration: 19,
    turnSpeed: 2.7,
    color: 0xea580c,
    plate: 'B 4741 BAJ',
  },
  ojol_motor: {
    type: 'ojol_motor',
    name: 'Motor Matic Ojol Kilat',
    subtitle: 'Spesialis Selap-Selip Kemacetan · Akselerasi Cepat',
    maxSpeed: 36,
    acceleration: 28,
    turnSpeed: 3.1,
    color: 0x16a34a,
    plate: 'B 6012 OJL',
  },
  angkot: {
    type: 'angkot',
    name: 'Angkot 08 Blok M - Kota',
    subtitle: 'Mikrolet Biru Langit · Ngetem Sembarangan',
    maxSpeed: 30,
    acceleration: 16,
    turnSpeed: 2.1,
    color: 0x0284c7,
    plate: 'B 1908 WT',
  },
  polisi: {
    type: 'polisi',
    name: 'Sedan Patroli Sabhara',
    subtitle: 'Sirine Taktis · Kecepatan Tinggi Jalan Protokol',
    maxSpeed: 40,
    acceleration: 25,
    turnSpeed: 2.3,
    color: 0x1e3a8a,
    plate: 'VIII 110-00',
  },
  bus_telolet: {
    type: 'bus_telolet',
    name: 'Bus AKAP TransNusantara',
    subtitle: 'Klakson Om Telolet Om! · Bodi Baja Tahan Tabrak',
    maxSpeed: 33,
    acceleration: 14,
    turnSpeed: 1.65,
    color: 0x1d4ed8,
    plate: 'B 7788 TGA',
  },
};

export const INTERACTABLE_SPOTS: InteractableSpot[] = [
  {
    id: 'warung_pecel',
    name: 'Warung Pecel Lele Lamongan Cak Har',
    category: 'kuliner',
    actionLabel: 'Makan Pecel Lele + Es Teh (+50 Darah)',
    cost: 25000,
    position: { x: -30, z: 26 },
    radius: 6.5,
    description: 'Sambal korek pedas nampol memulihkan stamina & darah karakter.',
  },
  {
    id: 'warung_bakso',
    name: 'Warung Bakso Urat & Mie Ayam Solo',
    category: 'kuliner',
    actionLabel: 'Makan Bakso Urat Komplit (+100 Darah Penuh)',
    cost: 35000,
    position: { x: 30, z: -26 },
    radius: 6.5,
    description: 'Kuah kaldu sapi panas langsung memulihkan darah hingga penuh.',
  },
  {
    id: 'indoalfa_pusat',
    name: 'Minimarket Indoalfa 24 Jam',
    category: 'minimarket',
    actionLabel: 'Beli Kopi Susu Gula Aren (+35 Darah)',
    cost: 18000,
    position: { x: -32, z: -30 },
    radius: 7.5,
    description: 'Tempat nongkrong favorit sambil ngadem AC dan tarik tunai ATM.',
  },
  {
    id: 'bengkel_cat',
    name: 'Bengkel Cat Kilat & Cuci Steam',
    category: 'bengkel',
    actionLabel: 'Cat Ulang & Hapus Bintang Polisi',
    cost: 75000,
    position: { x: 34, z: 32 },
    radius: 7.5,
    description: 'Ganti warna cat kendaraan & hilangkan seluruh status buronan polisi!',
  },
  {
    id: 'tugu_surabaya_spot',
    name: 'Kawasan Tugu Surabaya (Sura & Baya)',
    category: 'landmark',
    actionLabel: 'Kuliner Rawon & Lontong Balap (+75 Darah)',
    cost: 20000,
    position: { x: 36, z: 0 },
    radius: 7.5,
    description: 'Monumen kebanggaan Kota Pahlawan lengkap dengan Patung Sura & Baya serta Tugu Pahlawan.',
  },
];

export const MISSIONS: Mission[] = [
  {
    id: 'misi_tugu_surabaya',
    title: '01. Tur Wisata Tugu Surabaya (Sura & Baya)',
    giver: 'Dinas Pariwisata Nusantara',
    description: 'Jemput rombongan wisatawan di Bundaran Monas lalu antarkan menuju Bundaran Tugu Surabaya di Timur Kota!',
    reward: 275000,
    pickupPos: { x: 0, z: 19, label: 'Bundaran Tugu Monas' },
    dropoffPos: { x: 35, z: 0, label: 'Bundaran Tugu Surabaya' },
    timeLimitSec: 65,
  },
  {
    id: 'misi_ojol_paket',
    title: '02. Orderan Ojol Kilat: Dokumen Penting',
    giver: 'Aplikasi Ojol Nusantara',
    description: 'Ambil paket ekspres di Minimarket Indoalfa lalu antarkan ke pelanggan di dekat Warung Pecel Lele sebelum waktu habis!',
    reward: 150000,
    pickupPos: { x: -24, z: -24, label: 'Minimarket Indoalfa' },
    dropoffPos: { x: -22, z: 22, label: 'Warung Pecel Lele Cak Har' },
    timeLimitSec: 65,
  },
  {
    id: 'misi_bajaj_wisata',
    title: '03. Tarik Turis Kampung Merdeka ke Tugu Surabaya',
    giver: 'Pak RT Kampung Merdeka',
    description: 'Jemput wisatawan di dekat Gapura Merah Putih Selatan dan antar mereka ke Monumen Tugu Surabaya!',
    reward: 325000,
    pickupPos: { x: 0, z: 72, label: 'Gapura Merah Putih Selatan' },
    dropoffPos: { x: 35, z: 0, label: 'Bundaran Tugu Surabaya' },
    timeLimitSec: 75,
  },
  {
    id: 'misi_angkot_setoran',
    title: '04. Kejar Setoran Trayek Blok M - Masjid',
    giver: 'Bos Juragan Angkot 08',
    description: 'Jemput rombongan warga di dekat Bengkel Cat Timur lalu antarkan tepat waktu menuju halaman Masjid Kubah Hijau!',
    reward: 300000,
    pickupPos: { x: 24, z: 24, label: 'Halte Bengkel Timur' },
    dropoffPos: { x: 24, z: -64, label: 'Masjid Agung Nusantara' },
    timeLimitSec: 75,
  },
];

export function getDistrictName(x: number, z: number): string {
  const distCenter = Math.hypot(x, z);
  if (distCenter < 26) return 'Alun-Alun Tugu Monas';
  if (Math.hypot(x - 48, z) < 22) return 'Bundaran Tugu Surabaya (Kota Pahlawan)';
  if (z < -35 && x > 10) return 'Kawasan Masjid Agung';
  if (x < -20 && z < -10) return 'Distrik Niaga Sudirman';
  if (x < -15 && z >= -10) return 'Pasar Kuliner Blok M';
  if (x > 15 && z > 10) return 'Kawasan Bengkel & Industri';
  if (z > 45) return 'Kampung Merdeka Selatan';
  return 'Jalan Protokol Nusantara';
}
