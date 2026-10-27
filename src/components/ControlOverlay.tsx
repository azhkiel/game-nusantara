import React, { useEffect, useState } from 'react';
import {
  Car,
  Compass,
  Volume2,
  VolumeX,
  Sun,
  Sunset,
  Moon,
  CloudRain,
  CloudSun,
  Utensils,
  Navigation,
  Sparkles,
  Shirt,
  Camera,
  CheckCircle2,
  Gamepad2,
  X,
  Menu,
  Home,
  BedDouble,
  Armchair,
  DoorOpen,
} from 'lucide-react';
import {
  CameraMode,
  HudState,
  OutfitStyle,
  TimeOfDay,
  VehicleType,
  WeatherType,
} from '../types/game';
import { MISSIONS, VEHICLE_SPECS } from '../three/worldData';
import { MobileController } from './MobileController';

interface ControlOverlayProps {
  hud: HudState;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  cameraMode: CameraMode;
  outfit: OutfitStyle;
  isMuted: boolean;
  onToggleEnterExit: () => void;
  onSpawnVehicle: (type: VehicleType) => void;
  onHonkHorn: () => void;
  onContextAction: () => void;
  onHomeAction: (action: 'sleep' | 'eat' | 'sit' | 'stand' | 'exit' | 'enter') => void;
  onBuyShopItem: (spotId: string, itemId: string) => void;
  onStartMission: (id: string) => void;
  onCancelMission: () => void;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  onToggleAutoTime: (enabled: boolean) => void;
  onChangeWeather: (weather: WeatherType) => void;
  onChangeOutfit: (outfit: OutfitStyle) => void;
  onChangeCamera: (mode: CameraMode) => void;
  onClearWanted: () => void;
  onTeleport: (x: number, z: number, label: string) => void;
  onToggleMute: () => void;
  onVirtualControl: (
    forward: number,
    turn: number,
    brake?: boolean,
    sprint?: boolean
  ) => void;
  onJump: () => void;
}

type MenuTab = 'garasi' | 'teleport' | 'misi' | 'suasana';

const detectMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const coarsePointer =
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const uaMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const narrowScreen = window.innerWidth < 860;
  return Boolean(coarsePointer || uaMobile || narrowScreen);
};

export const ControlOverlay: React.FC<ControlOverlayProps> = ({
  hud,
  timeOfDay,
  weather,
  cameraMode,
  outfit,
  isMuted,
  onToggleEnterExit,
  onSpawnVehicle,
  onHonkHorn,
  onContextAction,
  onHomeAction,
  onBuyShopItem,
  onStartMission,
  onCancelMission,
  onChangeTimeOfDay,
  onToggleAutoTime,
  onChangeWeather,
  onChangeOutfit,
  onChangeCamera,
  onClearWanted,
  onTeleport,
  onToggleMute,
  onVirtualControl,
  onJump,
}) => {
  const [isMobileMode, setIsMobileMode] = useState<boolean>(() =>
    detectMobileDevice()
  );
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MenuTab>('garasi');
  const [copyToast, setCopyToast] = useState<boolean>(false);
  const [coordCopied, setCoordCopied] = useState<boolean>(false);

  // Auto-close shop modal if player moves away from spot
  useEffect(() => {
    if (!hud.nearbySpot) {
      setIsShopModalOpen(false);
    }
  }, [hud.nearbySpot]);

  // Auto-close home mini menu when exiting the house
  useEffect(() => {
    if (!hud.isInsideHome) {
      setIsHomeMenuOpen(false);
    }
  }, [hud.isInsideHome]);

  // Keyboard shortcut: 'M', 'H', or 'Escape' opens/closes pause menu; 'E' opens shop/home menu when nearby
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.code === 'KeyM' || e.code === 'KeyH' || e.code === 'Escape') && !e.repeat) {
        if (isShopModalOpen) {
          setIsShopModalOpen(false);
        } else if (isHomeMenuOpen) {
          setIsHomeMenuOpen(false);
        } else {
          setIsMenuOpen((prev) => !prev);
        }
      } else if (e.code === 'KeyE' && !e.repeat) {
        if (hud.isInsideHome) {
          setIsHomeMenuOpen((prev) => !prev);
        } else if (hud.isNearHomeDoor) {
          onHomeAction('enter');
        } else if (hud.nearbySpot) {
          setIsShopModalOpen((prev) => !prev);
        }
      }
    };

    const handleTouchDetect = () => {
      setIsMobileMode(true);
    };

    const handleResize = () => {
      if (detectMobileDevice()) {
        setIsMobileMode(true);
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('touchstart', handleTouchDetect, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('touchstart', handleTouchDetect);
      window.removeEventListener('resize', handleResize);
    };
  }, [isShopModalOpen, isHomeMenuOpen, hud.isInsideHome, hud.isNearHomeDoor, hud.nearbySpot, onHomeAction]);

  // Minimap Radar Coordinate Mapping (Expanded bounds ±195m)
  const mapCoord = (val: number) =>
    Math.max(4, Math.min(96, ((val + 195) / 390) * 100));
  const playerMapX = mapCoord(hud.playerCoords.x);
  const playerMapY = mapCoord(hud.playerCoords.z);

  return (
    <>
      {/* ========================================================= */}
      {/* 1. MINIMALIST GTA IN-GAME HUD (Zero dark boxes, Pure 3D) */}
      {/* ========================================================= */}
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
        {/* TOP ROW: Top-Left Radar & Top-Right Classic GTA Stats */}
        <div className="flex items-start justify-between gap-2">
          {/* TOP-LEFT: Authentic GTA Circular Radar & District Street Label */}
          <div className="pointer-events-auto flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              {/* Circular Minimap Radar (Tap to open Pause Menu / Map) */}
              <button
                onClick={() => {
                  setActiveTab('teleport');
                  setIsMenuOpen(true);
                }}
                title="Buka Peta / Menu"
                className="relative h-15 w-15 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-full bg-black/40 border-2 border-white/30 shadow-2xl backdrop-blur-xs cursor-pointer active:scale-95 transition-transform"
              >
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  {/* Outer Map River Lines */}
                  <rect x="0" y="0" width="100" height="100" fill="#090d16" fillOpacity="0.8" />
                  <line
                    x1={mapCoord(188)}
                    y1={mapCoord(-190)}
                    x2={mapCoord(188)}
                    y2={mapCoord(190)}
                    stroke="#0284c7"
                    strokeWidth="3.5"
                  />
                  <line
                    x1={mapCoord(-190)}
                    y1={mapCoord(188)}
                    x2={mapCoord(190)}
                    y2={mapCoord(188)}
                    stroke="#0284c7"
                    strokeWidth="3.5"
                  />
                  {/* Main Road Grid */}
                  {[-120, -60, 0, 60, 120].map((r) => (
                    <React.Fragment key={r}>
                      <line
                        x1={mapCoord(r)}
                        y1={mapCoord(-120)}
                        x2={mapCoord(r)}
                        y2={mapCoord(120)}
                        stroke="#475569"
                        strokeWidth="1.8"
                      />
                      <line
                        x1={mapCoord(-120)}
                        y1={mapCoord(r)}
                        x2={mapCoord(120)}
                        y2={mapCoord(r)}
                        stroke="#475569"
                        strokeWidth="1.8"
                      />
                    </React.Fragment>
                  ))}
                  {/* Narrow Alleys (Jalan Kecil / Gang Kampung) in distinct Conblock Amber/Tan */}
                  {/* West Gang Network */}
                  <line
                    x1={mapCoord(-142)}
                    y1={mapCoord(-90)}
                    x2={mapCoord(-142)}
                    y2={mapCoord(70)}
                    stroke="#d97706"
                    strokeWidth="1.3"
                    strokeDasharray="2,1"
                  />
                  {[-75, -30, 24, 65].map((gz) => (
                    <line
                      key={`wg_${gz}`}
                      x1={mapCoord(-168)}
                      y1={mapCoord(gz)}
                      x2={mapCoord(-120)}
                      y2={mapCoord(gz)}
                      stroke="#d97706"
                      strokeWidth="1.2"
                    />
                  ))}
                  {/* East Gang & Pasar Network */}
                  <line
                    x1={mapCoord(142)}
                    y1={mapCoord(-80)}
                    x2={mapCoord(142)}
                    y2={mapCoord(75)}
                    stroke="#d97706"
                    strokeWidth="1.3"
                    strokeDasharray="2,1"
                  />
                  {[-25, 30, 65].map((gz) => (
                    <line
                      key={`eg_${gz}`}
                      x1={mapCoord(120)}
                      y1={mapCoord(gz)}
                      x2={mapCoord(168)}
                      y2={mapCoord(gz)}
                      stroke="#d97706"
                      strokeWidth="1.2"
                    />
                  ))}
                  {/* Green Park Areas */}
                  <rect
                    x={mapCoord(-111)}
                    y={mapCoord(-51)}
                    width={mapCoord(-69) - mapCoord(-111)}
                    height={mapCoord(-9) - mapCoord(-51)}
                    fill="#15803d"
                    rx="1"
                  />
                  <rect
                    x={mapCoord(69)}
                    y={mapCoord(9)}
                    width={mapCoord(111) - mapCoord(69)}
                    height={mapCoord(51) - mapCoord(9)}
                    fill="#15803d"
                    rx="1"
                  />
                  <rect
                    x={mapCoord(-111)}
                    y={mapCoord(69)}
                    width={mapCoord(-69) - mapCoord(-111)}
                    height={mapCoord(111) - mapCoord(69)}
                    fill="#065f46"
                    rx="1"
                  />
                  {/* Main Protocol Avenues */}
                  <line x1={mapCoord(0)} y1={mapCoord(-188)} x2={mapCoord(0)} y2={mapCoord(188)} stroke="#64748b" strokeWidth="2.5" />
                  <line x1={mapCoord(-188)} y1={mapCoord(0)} x2={mapCoord(188)} y2={mapCoord(0)} stroke="#64748b" strokeWidth="2.5" />
                  {/* Landmark Dots */}
                  <circle cx={mapCoord(-90)} cy={mapCoord(-30)} r="2.8" fill="#f59e0b" />
                  <circle cx={mapCoord(90)} cy={mapCoord(30)} r="2.8" fill="#10b981" />
                  <circle cx={mapCoord(-90)} cy={mapCoord(90)} r="2.8" fill="#06b6d4" />
                  {/* Indonesian Cultural Markers (Joglo, Pos Kamling, Pasar Tradisional) */}
                  <circle cx={mapCoord(-156)} cy={mapCoord(-75)} r="2.4" fill="#c2410c" />
                  <circle cx={mapCoord(-142)} cy={mapCoord(-30)} r="2.4" fill="#3b82f6" />
                  <circle cx={mapCoord(142)} cy={mapCoord(-50)} r="2.6" fill="#16a34a" />
                  <circle cx={mapCoord(-142)} cy={mapCoord(28)} r="2.2" fill="#ef4444" />
                  {/* Traffic NPC dots */}
                  {hud.trafficCoords?.map((tv, idx) => (
                    <circle
                      key={idx}
                      cx={mapCoord(tv.x)}
                      cy={mapCoord(tv.z)}
                      r="1.4"
                      fill={tv.type === 'polisi' ? '#ef4444' : '#e2e8f0'}
                    />
                  ))}
                  {/* Mission Target */}
                  {hud.targetCoords && (
                    <circle
                      cx={mapCoord(hud.targetCoords.x)}
                      cy={mapCoord(hud.targetCoords.z)}
                      r="4"
                      fill="#facc15"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                  )}
                  {/* Player Arrow */}
                  <g
                    transform={`translate(${playerMapX}, ${playerMapY}) rotate(${
                      (-hud.playerCoords.heading * 180) / Math.PI + 180
                    })`}
                  >
                    <polygon points="0,-4 3,3 0,1.5 -3,3" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
                  </g>
                </svg>
              </button>

              {/* Minimalist MENU Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsMenuOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-black/40 hover:bg-black/60 active:bg-white/20 border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-xs active:scale-95 touch-manipulation cursor-pointer"
              >
                <Menu className="h-3.5 w-3.5 text-amber-300" />
                <span>MENU</span>
              </button>
            </div>

            {/* Street / District Name in Classic GTA Typography */}
            <span
              className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ fontFamily: '"Chakra Petch", sans-serif' }}
            >
              {hud.districtName}
            </span>

            {/* Live GPS Coordinates Badge on Main Screen HUD (Tap to copy) */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const text = `Area Bermasalah: X: ${Math.round(hud.playerCoords.x)}, Z: ${Math.round(hud.playerCoords.z)} (${hud.districtName})`;
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
                setCoordCopied(true);
                setTimeout(() => setCoordCopied(false), 2000);
              }}
              className="flex items-center gap-1 rounded-md bg-black/60 hover:bg-black/80 active:bg-amber-500/30 border border-white/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 drop-shadow backdrop-blur-xs cursor-pointer active:scale-95 touch-manipulation transition-transform"
              title="Ketuk untuk salin koordinat bug posisi ini"
            >
              <span className="text-slate-400 font-sans font-semibold text-[9px]">GPS:</span>
              <span>X: {Math.round(hud.playerCoords.x)}, Z: {Math.round(hud.playerCoords.z)}</span>
              <span className="text-[9px] text-amber-400 ml-0.5">
                {coordCopied ? '✓ Tersalin!' : '📋 Salin'}
              </span>
            </button>
          </div>

          {/* TOP-RIGHT: Authentic Floating GTA Stats (Money, Clock, Health, Speed, Stars) */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            {/* Row 1: Green Money + Digital Clock + Audio Mute */}
            <div className="flex items-center gap-2">
              {/* Audio Mute Icon Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onToggleMute}
                aria-label="Toggle Suara"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 border border-white/20 text-white shadow-md backdrop-blur-xs active:scale-95 touch-manipulation cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </button>

              {/* Clock (e.g. 08:00) */}
              <div className="flex items-center gap-1 rounded bg-black/35 px-2 py-0.5 border border-white/15 backdrop-blur-xs">
                {timeOfDay === 'malam' ? (
                  <Moon className="h-3 w-3 text-indigo-300" />
                ) : timeOfDay === 'sore' ? (
                  <Sunset className="h-3 w-3 text-orange-300" />
                ) : (
                  <Sun className="h-3 w-3 text-amber-300" />
                )}
                <span className="font-mono text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {hud.clockTimeText.split(' ')[0]}
                </span>
              </div>

              {/* Bold Green GTA Money */}
              <span
                className="font-mono text-base sm:text-2xl font-black text-emerald-400 tracking-tight drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]"
                style={{ textShadow: '0 0 10px rgba(16,185,129,0.4), 0 2px 4px rgba(0,0,0,0.9)' }}
              >
                Rp {hud.money.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Row 2: Slim Health Bar */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-black text-rose-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                HP
              </span>
              <div className="h-2 w-20 sm:w-28 overflow-hidden rounded-xs bg-black/60 border border-white/30 shadow-inner">
                <div
                  className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] transition-transform duration-150 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0, hud.health / hud.maxHealth)})`,
                  }}
                />
              </div>
            </div>

            {/* Row 3: Vehicle Speedometer (Only shown when driving) */}
            {hud.inVehicle && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-semibold text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {hud.currentVehicleName}
                </span>
                <span className="font-mono text-xs font-black text-sky-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {hud.speedKmh} KM/H
                </span>
              </div>
            )}

            {/* Row 4: Wanted Stars (ONLY rendered when hud.wantedStars > 0!) */}
            {hud.wantedStars > 0 && (
              <div className="flex items-center gap-1 mt-1 bg-black/40 px-2 py-0.5 rounded border border-rose-500/40 backdrop-blur-xs">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-sm leading-none drop-shadow ${
                      star <= hud.wantedStars
                        ? 'text-amber-400 animate-pulse'
                        : 'text-slate-700'
                    }`}
                  >
                    ★
                  </span>
                ))}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClearWanted}
                  className="ml-1 rounded bg-rose-600/90 hover:bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white active:scale-95 touch-manipulation cursor-pointer"
                >
                  HAPUS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TOP-CENTER COMPACT PROMPTS: Active Mission, Small Rumah Button, Warung Prompt, Toast */}
        <div className="flex flex-col items-center gap-1.5 w-full max-w-md mx-auto mt-1 mb-auto pointer-events-none">
          {/* Active Mission Banner */}
          {hud.activeMission && (
            <div className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-xl bg-black/60 border border-amber-400/60 px-3.5 py-2 shadow-2xl backdrop-blur-md">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                  <span>MISI: {hud.activeMission.title}</span>
                  <span>·</span>
                  <span className="font-mono">{hud.missionTimeLeft}s</span>
                </div>
                <p className="text-xs font-bold text-white truncate">
                  {hud.missionStage === 'to_pickup'
                    ? `Jemput: ${hud.activeMission.pickupPos.label}`
                    : `Antar: ${hud.activeMission.dropoffPos.label}`}
                </p>
              </div>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onCancelMission}
                className="rounded-lg bg-rose-600/80 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white active:scale-95 shrink-0 touch-manipulation cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}

          {/* Minimalist Floating Shop Prompt Button (Small non-intrusive badge) */}
          {hud.nearbySpot && !isShopModalOpen && !isMenuOpen && !hud.isInsideHome && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setIsShopModalOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-emerald-400/80 px-2.5 py-1 text-white shadow-lg backdrop-blur-md active:scale-95 transition-all touch-manipulation cursor-pointer"
            >
              <Utensils className="h-3 w-3 text-emerald-400" />
              <span className="text-[11px] font-bold text-white">
                {hud.nearbySpot.name}
              </span>
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black text-slate-950 uppercase">
                Beli
              </span>
            </button>
          )}

          {/* SMALL RUMAH PRIBADI BUTTON (Indoor Toggle Pill) */}
          {hud.isInsideHome && !isMenuOpen && (
            <div className="pointer-events-auto flex items-center gap-1">
              {!isHomeMenuOpen ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setIsHomeMenuOpen(true)}
                    className="flex items-center gap-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-sky-400/75 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md active:scale-95 transition-transform touch-manipulation cursor-pointer"
                  >
                    <Home className="h-3 w-3 text-sky-400" />
                    <span>Rumah</span>
                    <span className="rounded-full bg-sky-400/20 border border-sky-400/40 px-1.5 text-[9px] font-black text-sky-300">
                      Aksi
                    </span>
                  </button>

                  {hud.playerHomeState !== 'standing' && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onHomeAction('stand')}
                      className="flex items-center gap-1 rounded-full bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-[10px] font-black text-slate-950 shadow-md active:scale-95 touch-manipulation cursor-pointer"
                    >
                      <span>Berdiri</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onHomeAction('exit')}
                    title="Keluar Rumah"
                    className="flex items-center gap-1 rounded-full bg-rose-600/90 hover:bg-rose-500 border border-rose-400/50 px-2.5 py-1 text-[10px] font-bold text-white shadow-md active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <DoorOpen className="h-3 w-3" />
                    <span>Keluar</span>
                  </button>
                </>
              ) : (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex flex-wrap items-center justify-center gap-1 rounded-full bg-slate-950/90 border border-sky-400/70 px-2 py-1 shadow-xl backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onHomeAction('sleep');
                      setIsHomeMenuOpen(false);
                    }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold active:scale-95 touch-manipulation cursor-pointer ${
                      hud.playerHomeState === 'sleeping'
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-sky-200'
                    }`}
                  >
                    <BedDouble className="h-3 w-3 text-sky-400" />
                    <span>Tidur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onHomeAction('eat');
                      setIsHomeMenuOpen(false);
                    }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold active:scale-95 touch-manipulation cursor-pointer ${
                      hud.playerHomeState === 'eating'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-200'
                    }`}
                  >
                    <Utensils className="h-3 w-3 text-emerald-400" />
                    <span>Makan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onHomeAction(hud.playerHomeState === 'sitting' ? 'stand' : 'sit');
                      setIsHomeMenuOpen(false);
                    }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold active:scale-95 touch-manipulation cursor-pointer ${
                      hud.playerHomeState === 'sitting'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-200'
                    }`}
                  >
                    <Armchair className="h-3 w-3 text-amber-400" />
                    <span>{hud.playerHomeState === 'sitting' ? 'Berdiri' : 'Duduk'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onHomeAction('exit');
                      setIsHomeMenuOpen(false);
                    }}
                    className="flex items-center gap-1 rounded-full bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <DoorOpen className="h-3 w-3" />
                    <span>Keluar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsHomeMenuOpen(false)}
                    aria-label="Tutup Menu Rumah"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] touch-manipulation cursor-pointer active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SMALL OUTDOOR BUTTON: Masuk Rumah */}
          {hud.isNearHomeDoor && !hud.isInsideHome && !isMenuOpen && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onHomeAction('enter')}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-sky-400/80 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md active:scale-95 transition-all touch-manipulation cursor-pointer"
            >
              <Home className="h-3 w-3 text-sky-400" />
              <span>Masuk Rumah</span>
            </button>
          )}

          {/* Toast Notification (Small & Elegant) */}
          {hud.notification && (
            <div className="rounded-full bg-black/60 border border-white/20 px-3 py-1 text-center shadow-lg backdrop-blur-md">
              <p className="text-[10px] font-bold text-amber-300 truncate">
                {hud.notification.title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1B. SUBTLE DOOR EXIT / ENTER / SLEEP TRANSITION EFFECT    */}
      {/* ========================================================= */}
      {hud.homeTransition && (
        <div
          className={`pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-start pt-14 transition-opacity duration-500 ${
            hud.homeTransition.direction === 'sleep'
              ? 'bg-slate-950/60 backdrop-blur-xs'
              : 'bg-gradient-to-b from-black/45 via-transparent to-black/35'
          }`}
        >
          <div className="flex items-center gap-2 rounded-full bg-slate-950/90 border border-amber-400/70 px-3.5 py-1.5 text-center shadow-xl backdrop-blur-md">
            {hud.homeTransition.direction === 'out' ? (
              <DoorOpen className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            ) : hud.homeTransition.direction === 'sleep' ? (
              <BedDouble className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            ) : (
              <Home className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wide">
              {hud.homeTransition.title}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ON-SCREEN TRANSLUCENT GTA MOBILE CONTROLLER            */}
      {/* ========================================================= */}
      {isMobileMode && !isMenuOpen && !isShopModalOpen && (
        <MobileController
          hud={hud}
          cameraMode={cameraMode}
          onVirtualControl={onVirtualControl}
          onJump={onJump}
          onToggleEnterExit={onToggleEnterExit}
          onHonkHorn={onHonkHorn}
          onContextAction={
            hud.nearbySpot ? () => setIsShopModalOpen(true) : onContextAction
          }
          onHomeAction={onHomeAction}
          onToggleHomeMenu={() => setIsHomeMenuOpen((prev) => !prev)}
          onOpenGarage={() => {
            setActiveTab('garasi');
            setIsMenuOpen(true);
          }}
          onSpawnVehicle={onSpawnVehicle}
          onChangeCamera={onChangeCamera}
        />
      )}

      {/* ========================================================= */}
      {/* 3. GTA PAUSE MENU MODAL (Full featured, on-demand only)  */}
      {/* ========================================================= */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 select-none font-sans">
          <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-950/95 border-2 border-amber-500/60 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <h2
                  className="text-base sm:text-lg font-black tracking-wider text-amber-400"
                  style={{ fontFamily: '"Chakra Petch", sans-serif' }}
                >
                  NUSANTARA 3D
                </h2>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-300">Menu Permainan</span>
              </div>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer active:scale-95"
              >
                <X className="h-4 w-4" />
                <span>KEMBALI</span>
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 sm:px-6 py-2.5 border-b border-slate-800 overflow-x-auto bg-slate-950">
              <button
                onClick={() => setActiveTab('garasi')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'garasi'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white bg-slate-900/60'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                <span>Garasi</span>
              </button>

              <button
                onClick={() => setActiveTab('teleport')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'teleport'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white bg-slate-900/60'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Peta & Lokasi</span>
              </button>

              <button
                onClick={() => setActiveTab('misi')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'misi'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white bg-slate-900/60'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Misi ({hud.completedMissionIds.length}/{MISSIONS.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('suasana')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'suasana'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white bg-slate-900/60'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Suasana & Setting</span>
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* TAB 1: GARASI KENDARAAN */}
              {activeTab === 'garasi' && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    Pilih kendaraan untuk langsung dipanggil dan dinaiki:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(Object.keys(VEHICLE_SPECS) as VehicleType[]).map((vType) => {
                      const spec = VEHICLE_SPECS[vType];
                      const isCurrent =
                        hud.currentVehicleType === vType && hud.inVehicle;
                      return (
                        <button
                          key={vType}
                          onClick={() => {
                            onSpawnVehicle(vType);
                            setIsMenuOpen(false);
                          }}
                          className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-transform active:scale-95 cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500/20 border-amber-400 text-white'
                              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black">{spec.name}</span>
                            <Car className="h-4 w-4 text-amber-400" />
                          </div>
                          <span className="mt-2 text-[10px] font-mono text-amber-300">
                            Kecepatan: {Math.round(spec.maxSpeed * 3.2)} km/j
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: PETA & TELEPORT LOKASI */}
              {activeTab === 'teleport' && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    Pindah cepat ke lokasi ikonik di Kota Raya:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                    {[
                      { label: '🏠 Rumah Pribadi (Safehouse)', x: -17.8, z: 24, desc: 'Masuk Rumah: Tidur, Makan & Duduk Sofa' },
                      { label: 'Kuburan TPU Kamboja Nusantara', x: -146, z: 76, desc: 'Makam Warga, Pohon Kamboja & Bunga Ziarah' },
                      { label: 'TPS 04 Kampung & Bank Sampah', x: -140, z: -62, desc: 'Tenda Pemilu KPPS, Bilik Suara & Gerobak TPS' },
                      { label: 'Kampung Adat Joglo & Gadang', x: -150, z: -62, desc: 'Rumah Joglo Jawa & Gadang Minang' },
                      { label: 'Pos Kamling & Gardu Ronda', x: -140, z: -28, desc: 'Kentongan Bambu & Kopi Ronda (+HP)' },
                      { label: 'Pasar Tradisional Rakyat', x: 140, z: -35, desc: 'Los Pasar, Buah & Jajan Pasar (+HP)' },
                      { label: 'Toko Madura 24 Jam', x: -140, z: 22, desc: 'Pertamini Bensin & Sembako (+HP)' },
                      { label: 'Hutan Wisata & Sungai', x: -90, z: 63.5, desc: 'Air Terjun, Jembatan & Pepohonan Pinus' },
                      { label: 'Jembatan Sungai Selatan', x: -3.5, z: 175, desc: 'Sungai Kalimas & Perahu Kayu' },
                      { label: 'Warung Pecel Lele Cak Har', x: -32, z: 3.5, desc: 'Beli Es Teh & Nasi Pecel (+HP)' },
                      { label: 'Warung Bakso Urat Solo', x: 32, z: -3.5, desc: 'Beli Es Jeruk & Bakso Urat' },
                      { label: 'Taman Kota Nusantara', x: -30, z: 63.5, desc: 'Gazebo Joglo & Kolam Ikan' },
                      { label: 'SMA Negeri 1 (Sekolah)', x: 30, z: 63.5, desc: 'Kantin & Lapangan Basket' },
                      { label: 'Taman Tugu Surabaya', x: 90, z: 3.5, desc: 'Lahan Taman Timur Kota' },
                      { label: 'Lapangan Tugu Monas', x: -90, z: -3.5, desc: 'Lahan Taman Barat Kota' },
                      { label: 'Minimarket Indoalfa', x: -3.5, z: -34, desc: 'Kopi Dingin & Tarik ATM' },
                      { label: 'Bengkel Cat & Steam', x: 3.5, z: 36, desc: 'Hapus Bintang Buronan Polisi' },
                    ].map((loc) => (
                      <button
                        key={loc.label}
                        onClick={() => {
                          onTeleport(loc.x, loc.z, loc.label);
                          setIsMenuOpen(false);
                        }}
                        className="flex flex-col items-start rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-3 text-left transition-transform active:scale-95 cursor-pointer"
                      >
                        <span className="text-xs font-black text-white">
                          {loc.label}
                        </span>
                        <span className="mt-0.5 text-[10px] text-slate-400">
                          {loc.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: MISI JALANAN */}
              {activeTab === 'misi' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MISSIONS.map((m) => {
                    const isDone = hud.completedMissionIds.includes(m.id);
                    const isActive = hud.activeMission?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col justify-between rounded-2xl border p-3 ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-500'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                            <span>{m.giver}</span>
                            {isDone && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <p className="mt-1 text-xs font-bold text-white">
                            {m.title}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                            {m.description}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            +Rp {m.reward.toLocaleString('id-ID')}
                          </span>
                          <button
                            onClick={() => {
                              onStartMission(m.id);
                              setIsMenuOpen(false);
                            }}
                            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-black text-slate-950 active:scale-95 cursor-pointer"
                          >
                            {isActive ? 'Sedang Aktif' : 'Mulai Misi'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: SUASANA & SETTING */}
              {activeTab === 'suasana' && (
                <div className="flex flex-col gap-4">
                  {/* Waktu Hari */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-2">
                      Waktu ({hud.clockTimeText}):
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['pagi', 'siang', 'sore', 'malam'] as TimeOfDay[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => onChangeTimeOfDay(t)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize cursor-pointer ${
                            timeOfDay === t
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-slate-300 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        onClick={() => onToggleAutoTime(!hud.autoTime)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border ${
                          hud.autoTime
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {hud.autoTime ? 'Siklus Otomatis: ON' : 'Siklus Otomatis: OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Cuaca Hujan / Cerah */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-2">
                      Cuaca:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onChangeWeather('cerah')}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                          weather === 'cerah'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        <CloudSun className="h-4 w-4" />
                        <span>Cerah</span>
                      </button>
                      <button
                        onClick={() => onChangeWeather('hujan')}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                          weather === 'hujan'
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        <CloudRain className="h-4 w-4" />
                        <span>Hujan Deras + Suara Rintik</span>
                      </button>
                    </div>
                  </div>

                  {/* Baju / Outfit */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-2">
                      Pakaian Karakter:
                    </span>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'ojol', label: 'Jaket Ojol Hijau' },
                        { id: 'batik', label: 'Batik Sogan' },
                        { id: 'jaket_kulit', label: 'Jaket Malam' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onChangeOutfit(item.id as OutfitStyle)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                            outfit === item.id
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-900 text-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kamera */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-2">
                      Sudut Kamera:
                    </span>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'chase', label: 'Dekat' },
                        { id: 'far', label: 'Sinematik' },
                        { id: 'top', label: 'GTA Klasik (Atas)' },
                      ].map((cam) => (
                        <button
                          key={cam.id}
                          onClick={() => onChangeCamera(cam.id as CameraMode)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                            cameraMode === cam.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900 text-slate-300'
                          }`}
                        >
                          {cam.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kontrol Mobile & Audio */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 block mb-2">
                      Pengaturan Layar & Suara:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsMobileMode(!isMobileMode)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          isMobileMode
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        <Gamepad2 className="h-4 w-4" />
                        <span>{isMobileMode ? 'Kontrol Layar HP: ON' : 'Kontrol Layar HP: OFF'}</span>
                      </button>

                      <button
                        onClick={onToggleMute}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          isMuted
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        <span>{isMuted ? 'Suara Senyap (Muted)' : 'Suara Aktif'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-900/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-slate-300">
                  Posisi: X: {Math.round(hud.playerCoords.x)}, Z: {Math.round(hud.playerCoords.z)} ({hud.districtName})
                </span>
                <button
                  onClick={() => {
                    const text = `Area bermasalah di koordinat X: ${Math.round(hud.playerCoords.x)}, Z: ${Math.round(hud.playerCoords.z)} (${hud.districtName})`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(text);
                    }
                    setCopyToast(true);
                    setTimeout(() => setCopyToast(false), 2500);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors cursor-pointer active:scale-95 ${
                    copyToast
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
                  }`}
                  title="Salin koordinat posisi saat ini untuk dilaporkan di chat"
                >
                  {copyToast ? '✓ Koordinat Tersalin!' : '📋 Salin Koordinat Bug'}
                </button>
              </div>

              <button
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 active:scale-95 cursor-pointer shadow-lg w-full sm:w-auto"
              >
                KEMBALI KE GAME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. COMPACT SHOP / FOOD MENU MODAL (On-Demand Only)        */}
      {/* ========================================================= */}
      {isShopModalOpen && hud.nearbySpot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 select-none font-sans">
          <div className="flex flex-col w-full max-w-md max-h-[85vh] rounded-3xl bg-slate-950/95 border-2 border-emerald-500/70 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Shop Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-emerald-500/30 bg-emerald-950/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shrink-0">
                  <Utensils className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    {hud.nearbySpot.name}
                  </h3>
                  <p className="text-[10px] text-emerald-300 font-semibold">
                    Kios Kuliner & Pemulih Stamina
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsShopModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white cursor-pointer active:scale-95 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Player Status Summary in Shop */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-slate-900/60 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-rose-400">DARAH (HP):</span>
                <span className="font-mono font-bold text-white">
                  {hud.health} / {hud.maxHealth}
                </span>
                <div className="h-2 w-16 overflow-hidden rounded-full bg-black/50 border border-white/20">
                  <div
                    className="h-full bg-rose-500"
                    style={{
                      width: `${Math.min(100, (hud.health / hud.maxHealth) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 font-mono font-black text-emerald-400">
                <span>Rp {hud.money.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Item List */}
            <div className="flex flex-col gap-2 p-3 sm:p-4 overflow-y-auto max-h-[55vh]">
              {hud.nearbySpot.items && hud.nearbySpot.items.length > 0 ? (
                hud.nearbySpot.items.map((item) => {
                  const canAfford = hud.money >= item.price;
                  const isHpFull = hud.health >= hud.maxHealth;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-2.5 sm:p-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {item.name}
                          </p>
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300 shrink-0">
                            +{item.healAmount} HP
                          </span>
                        </div>
                        <p className="font-mono text-xs font-black text-emerald-400 mt-0.5">
                          Rp {item.price.toLocaleString('id-ID')}
                        </p>
                      </div>

                      <button
                        disabled={!canAfford}
                        onClick={() => onBuyShopItem(hud.nearbySpot!.id, item.id)}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all active:scale-95 shrink-0 cursor-pointer ${
                          canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? (isHpFull ? 'Beli (+Segar)' : 'Beli') : 'Kurang'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-xs text-slate-300">
                    Biaya layanan: Rp {hud.nearbySpot.cost.toLocaleString('id-ID')}
                  </p>
                  <button
                    onClick={() => {
                      onContextAction();
                      setIsShopModalOpen(false);
                    }}
                    className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-slate-950 active:scale-95 cursor-pointer"
                  >
                    {hud.nearbySpot.actionLabel}
                  </button>
                </div>
              )}
            </div>

            {/* Footer / Close action */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-800 bg-slate-900/40">
              <span className="text-[10px] text-slate-400">
                Kesehatan pulih seketika setelah menikmati hidangan!
              </span>
              <button
                onClick={() => setIsShopModalOpen(false)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-[11px] font-bold text-white cursor-pointer active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
