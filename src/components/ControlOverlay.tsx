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
  const [activeTab, setActiveTab] = useState<MenuTab>('garasi');

  // Keyboard shortcut: 'M', 'H', or 'Escape' opens/closes GTA pause menu
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.code === 'KeyM' || e.code === 'KeyH' || e.code === 'Escape') && !e.repeat) {
        setIsMenuOpen((prev) => !prev);
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
  }, []);

  // Minimap Radar Coordinate Mapping
  const mapCoord = (val: number) =>
    Math.max(4, Math.min(96, ((val + 155) / 310) * 100));
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
                    x1={mapCoord(148)}
                    y1={mapCoord(-150)}
                    x2={mapCoord(148)}
                    y2={mapCoord(150)}
                    stroke="#0284c7"
                    strokeWidth="4"
                  />
                  <line
                    x1={mapCoord(-150)}
                    y1={mapCoord(148)}
                    x2={mapCoord(150)}
                    y2={mapCoord(148)}
                    stroke="#0284c7"
                    strokeWidth="4"
                  />
                  {/* Road Grid */}
                  {[-120, -60, 60, 120].map((r) => (
                    <React.Fragment key={r}>
                      <line
                        x1={mapCoord(r)}
                        y1={mapCoord(-120)}
                        x2={mapCoord(r)}
                        y2={mapCoord(120)}
                        stroke="#475569"
                        strokeWidth="2"
                      />
                      <line
                        x1={mapCoord(-120)}
                        y1={mapCoord(r)}
                        x2={mapCoord(120)}
                        y2={mapCoord(r)}
                        stroke="#475569"
                        strokeWidth="2"
                      />
                    </React.Fragment>
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
                  {/* Main Avenues */}
                  <line x1="50" y1={mapCoord(-120)} x2="50" y2={mapCoord(150)} stroke="#64748b" strokeWidth="3" />
                  <line x1={mapCoord(-120)} y1="50" x2={mapCoord(150)} y2="50" stroke="#64748b" strokeWidth="3" />
                  {/* Landmark Dots */}
                  <circle cx={mapCoord(-90)} cy={mapCoord(-30)} r="3" fill="#f59e0b" />
                  <circle cx={mapCoord(90)} cy={mapCoord(30)} r="3" fill="#10b981" />
                  <circle cx={mapCoord(-90)} cy={mapCoord(90)} r="3" fill="#06b6d4" />
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
                onClick={() => setIsMenuOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-black/40 hover:bg-black/60 active:bg-white/20 border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-xs active:scale-95 cursor-pointer"
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
          </div>

          {/* TOP-RIGHT: Authentic Floating GTA Stats (Money, Clock, Health, Speed, Stars) */}
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            {/* Row 1: Green Money + Digital Clock + Audio Mute */}
            <div className="flex items-center gap-2">
              {/* Audio Mute Icon Button */}
              <button
                onClick={onToggleMute}
                aria-label="Toggle Suara"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 border border-white/20 text-white shadow-md backdrop-blur-xs active:scale-95 cursor-pointer"
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
                  onClick={onClearWanted}
                  className="ml-1 rounded bg-rose-600/90 hover:bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white active:scale-95 cursor-pointer"
                >
                  HAPUS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENTER FLOATING ELEMENTS: Active Mission, Warung Pecel Menu, Notifications */}
        <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto my-auto pointer-events-none">
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
                onClick={onCancelMission}
                className="rounded-lg bg-rose-600/80 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white active:scale-95 shrink-0 cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}

          {/* Contextual Warung Pecel Lele / Kios Menu Card */}
          {hud.nearbySpot && (
            <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-2xl bg-black/75 border border-emerald-400/60 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Utensils className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {hud.nearbySpot.name}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300 font-bold">
                  Beli Makanan (+HP)
                </span>
              </div>

              {hud.nearbySpot.items && hud.nearbySpot.items.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {hud.nearbySpot.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onBuyShopItem(hud.nearbySpot!.id, item.id)}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/10 hover:bg-emerald-500/30 active:bg-emerald-500/50 border border-white/15 p-2 text-left transition-colors active:scale-95 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">
                          {item.name}
                        </p>
                        <span className="text-[9px] text-emerald-300 font-semibold">
                          +{item.healAmount} HP
                        </span>
                      </div>
                      <span className="rounded bg-emerald-500/80 px-2 py-0.5 font-mono text-[10px] font-black text-slate-950 shrink-0">
                        Rp {item.price.toLocaleString('id-ID')}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={onContextAction}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-xs font-black text-slate-950 active:scale-95 cursor-pointer"
                >
                  <Utensils className="h-4 w-4" />
                  <span>
                    Beli {hud.nearbySpot.actionLabel} (Rp{' '}
                    {hud.nearbySpot.cost.toLocaleString('id-ID')})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Toast Notification (Small & Elegant) */}
          {hud.notification && (
            <div className="rounded-full bg-black/60 border border-white/20 px-4 py-1.5 text-center shadow-lg backdrop-blur-md">
              <p className="text-[11px] font-bold text-amber-300 truncate">
                {hud.notification.title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ON-SCREEN TRANSLUCENT GTA MOBILE CONTROLLER            */}
      {/* ========================================================= */}
      {isMobileMode && !isMenuOpen && (
        <MobileController
          hud={hud}
          cameraMode={cameraMode}
          onVirtualControl={onVirtualControl}
          onJump={onJump}
          onToggleEnterExit={onToggleEnterExit}
          onHonkHorn={onHonkHorn}
          onContextAction={onContextAction}
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
                      { label: 'Hutan Wisata & Sungai', x: -90, z: 63.5, desc: 'Air Terjun, Jembatan & Pepohonan Pinus' },
                      { label: 'Jembatan Sungai Selatan', x: -3.5, z: 135, desc: 'Sungai Kalimas & Perahu Kayu' },
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
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-900/30">
              <span className="text-[11px] text-slate-500">
                Tekan [ESC] atau [M] di keyboard untuk buka/tutup menu ini.
              </span>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 active:scale-95 cursor-pointer shadow-lg"
              >
                KEMBALI KE GAME
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
