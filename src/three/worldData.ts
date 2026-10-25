import { InteractableSpot, Mission, VehicleSpec } from '../types/game';

export const ROAD_GRID_LINES = [-120, -60, 0, 60, 120];
export const ROAD_WIDTH = 14;

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
    maxSpeed: 34,
    acceleration: 15,
    turnSpeed: 1.75,
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
    position: { x: -32, z: 9.2 },
    radius: 6.5,
    description: 'Sambal korek pedas nampol memulihkan stamina & darah karakter.',
  },
  {
    id: 'warung_bakso',
    name: 'Warung Bakso Urat & Mie Ayam Solo',
    category: 'kuliner',
    actionLabel: 'Makan Bakso Urat Komplit (+100 Darah Penuh)',
    cost: 35000,
    position: { x: 32, z: -9.2 },
    radius: 6.5,
    description: 'Kuah kaldu sapi panas langsung memulihkan darah hingga penuh.',
  },
  {
    id: 'indoalfa_pusat',
    name: 'Minimarket Indoalfa 24 Jam',
    category: 'minimarket',
    actionLabel: 'Beli Kopi Susu Gula Aren (+35 Darah)',
    cost: 18000,
    position: { x: -9.5, z: -34 },
    radius: 7.0,
    description: 'Tempat nongkrong favorit sambil ngadem AC dan tarik tunai ATM.',
  },
  {
    id: 'bengkel_cat',
    name: 'Bengkel Cat Kilat & Cuci Steam',
    category: 'bengkel',
    actionLabel: 'Cat Ulang & Hapus Bintang Polisi',
    cost: 75000,
    position: { x: 9.5, z: 36 },
    radius: 7.5,
    description: 'Ganti warna cat kendaraan & hilangkan seluruh status buronan polisi!',
  },
  {
    id: 'monas_spot',
    name: 'Lapangan Taman Tugu Monas',
    category: 'landmark',
    actionLabel: 'Kerak Telor & Es Selendang Mayang (+75 Darah)',
    cost: 20000,
    position: { x: -90, z: -11 },
    radius: 7.5,
    description: 'Taman luas khusus Monumen Nasional dengan kuliner khas Betawi di pelataran selatan.',
  },
  {
    id: 'tugu_surabaya_spot',
    name: 'Taman Tugu Surabaya (Sura & Baya)',
    category: 'landmark',
    actionLabel: 'Kuliner Rawon & Lontong Balap (+75 Darah)',
    cost: 20000,
    position: { x: 90, z: 11 },
    radius: 7.5,
    description: 'Lahan taman khusus Monumen Kota Pahlawan lengkap dengan Patung Sura & Baya serta Tugu Pahlawan.',
  },
  {
    id: 'taman_kota_spot',
    name: 'Taman Kota Nusantara (Ruang Terbuka Hijau)',
    category: 'landmark',
    actionLabel: 'Santai & Jajan Es Doger Taman (+65 Darah)',
    cost: 12000,
    position: { x: -30, z: 69 },
    radius: 7.5,
    description: 'Taman kota asri dengan Gazebo Joglo, Kolam Air Mancur Ikan Koi, Jogging Track, dan Playground Anak.',
  },
  {
    id: 'sekolah_spot',
    name: 'SMA Negeri 1 Nusantara',
    category: 'kuliner',
    actionLabel: 'Jajan Batagor & Es Cincau Kantin Sekolah (+60 Darah)',
    cost: 15000,
    position: { x: 30, z: 69 },
    radius: 7.5,
    description: 'Sekolah unggulan Kota Raya lengkap dengan Lapangan Upacara Bendera Merah Putih, Lapangan Basket, dan Kantin.',
  },
];

export const MISSIONS: Mission[] = [
  {
    id: 'misi_tugu_surabaya',
    title: '01. Tur Lintas Kota: Monas ke Tugu Surabaya',
    giver: 'Dinas Pariwisata Nusantara',
    description: 'Jemput wisatawan di pelataran Taman Tugu Monas (Barat) lalu antarkan lintas kota menuju Taman Tugu Surabaya (Timur)!',
    reward: 325000,
    pickupPos: { x: -90, z: -11, label: 'Taman Tugu Monas (Barat)' },
    dropoffPos: { x: 90, z: 11, label: 'Taman Tugu Surabaya (Timur)' },
    timeLimitSec: 95,
  },
  {
    id: 'misi_antar_sekolah',
    title: '02. Antar Pelajar & Buku ke SMA Negeri 1',
    giver: 'Kepala Sekolah SMAN 1 Nusantara',
    description: 'Jemput siswa dan paket buku pelajaran di Taman Kota Nusantara lalu antarkan tepat waktu ke gerbang SMA Negeri 1 Nusantara!',
    reward: 225000,
    pickupPos: { x: -30, z: 69, label: 'Gerbang Taman Kota Nusantara' },
    dropoffPos: { x: 30, z: 69, label: 'Gerbang SMA Negeri 1 Nusantara' },
    timeLimitSec: 75,
  },
  {
    id: 'misi_ojol_paket',
    title: '03. Orderan Ojol Kilat: Dokumen Penting',
    giver: 'Aplikasi Ojol Nusantara',
    description: 'Ambil paket ekspres di Minimarket Indoalfa lalu antarkan ke pelanggan di dekat Warung Pecel Lele sebelum waktu habis!',
    reward: 175000,
    pickupPos: { x: -9.5, z: -34, label: 'Minimarket Indoalfa' },
    dropoffPos: { x: -32, z: 9.2, label: 'Warung Pecel Lele Cak Har' },
    timeLimitSec: 75,
  },
  {
    id: 'misi_angkot_setoran',
    title: '04. Kejar Setoran Trayek Sekolah - Masjid Agung',
    giver: 'Bos Juragan Angkot 08',
    description: 'Jemput rombongan pelajar pulang sekolah di depan SMA Negeri 1 lalu antarkan menuju halaman Masjid Agung Nusantara!',
    reward: 325000,
    pickupPos: { x: 30, z: 69, label: 'Gerbang SMA Negeri 1 Nusantara' },
    dropoffPos: { x: 32, z: -68, label: 'Masjid Agung Nusantara' },
    timeLimitSec: 90,
  },
];

export function getDistrictName(x: number, z: number): string {
  if (Math.hypot(x - -90, z - -30) < 28) return 'Taman Medan Merdeka (Tugu Monas)';
  if (Math.hypot(x - 90, z - 30) < 28) return 'Taman Tugu Surabaya (Kota Pahlawan)';
  if (Math.hypot(x - -30, z - 90) < 26) return 'Taman Kota Nusantara';
  if (Math.hypot(x - 30, z - 90) < 26) return 'Kawasan Pendidikan SMAN 1 Nusantara';
  if (z < -50 && x > 0) return 'Kawasan Masjid Agung';
  if (x < -40 && z < -60) return 'Distrik Niaga Sudirman';
  if (x < -15 && Math.abs(z) <= 40) return 'Pasar Kuliner Blok M';
  if (x > 10 && z > 20 && x < 65 && z < 60) return 'Kawasan Bengkel & Industri';
  if (z > 80) return 'Kampung Merdeka Selatan';
  if (Math.abs(x) > 95 || Math.abs(z) > 95) return 'Jalan Lingkar Luar Pesisir';
  return 'Simpang Raya Protokol Nusantara';
}


