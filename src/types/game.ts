export type TimeOfDay = 'siang' | 'senja' | 'malam';
export type WeatherType = 'cerah' | 'hujan';
export type CameraMode = 'chase' | 'far' | 'top';
export type OutfitStyle = 'ojol' | 'batik' | 'jaket_kulit';
export type VehicleType = 'bajaj' | 'angkot' | 'ojol_motor' | 'polisi' | 'bus_telolet';

export interface VehicleSpec {
  type: VehicleType;
  name: string;
  subtitle: string;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  color: number;
  plate: string;
}

export interface Mission {
  id: string;
  title: string;
  giver: string;
  description: string;
  reward: number;
  pickupPos: { x: number; z: number; label: string };
  dropoffPos: { x: number; z: number; label: string };
  timeLimitSec: number;
  requiredVehicle?: VehicleType;
}

export interface InteractableSpot {
  id: string;
  name: string;
  category: 'kuliner' | 'bengkel' | 'minimarket' | 'landmark';
  actionLabel: string;
  cost: number;
  position: { x: number; z: number };
  radius: number;
  description: string;
}

export type PedestrianArchetype =
  | 'warga'
  | 'pelajar_sma'
  | 'ojol'
  | 'pekerja_batik'
  | 'santri';

export interface HudState {
  money: number;
  health: number;
  maxHealth: number;
  wantedStars: number;
  districtName: string;
  inVehicle: boolean;
  currentVehicleName: string;
  currentVehicleType: VehicleType | null;
  speedKmh: number;
  nearbyVehiclePrompt: string | null;
  nearbySpot: InteractableSpot | null;
  activeMission: Mission | null;
  missionStage: 'idle' | 'to_pickup' | 'to_dropoff';
  missionTimeLeft: number;
  notification: { title: string; subtitle: string; tone: 'info' | 'success' | 'warning' } | null;
  playerCoords: { x: number; z: number; heading: number };
  targetCoords: { x: number; z: number; label: string } | null;
  trafficCoords: { x: number; z: number; type: VehicleType }[];
  completedMissionIds: string[];
}

