import React, { useEffect, useState } from 'react';
import {
  Car,
  Compass,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
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
  Megaphone,
  LogIn,
  LogOut,
  CheckCircle2,
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
  onStartMission: (id: string) => void;
  onCancelMission: () => void;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  onChangeWeather: (weather: WeatherType) => void;
  onChangeOutfit: (outfit: OutfitStyle) => void;
  onChangeCamera: (mode: CameraMode) => void;
  onClearWanted: () => void;
  onTeleport: (x: number, z: number, label: string) => void;
  onToggleMute: () => void;
  onVirtualControl: (forward: number, turn: number, brake?: boolean) => void;
}

type DockTab = 'kendaraan' | 'misi' | 'teleport' | 'suasana';

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
  onStartMission,
  onCancelMission,
  onChangeTimeOfDay,
  onChangeWeather,
  onChangeOutfit,
  onChangeCamera,
  onClearWanted,
  onTeleport,
  onToggleMute,
  onVirtualControl,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('kendaraan');

  // Keyboard shortcut 'H' to collapse/expand bottom dock
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Calculate Minimap Radar dot positions (mapped from [-140..140] to [0..100])
  const mapCoord = (val: number) => Math.max(6, Math.min(94, ((val + 140) / 280) * 100));
  const playerMapX = mapCoord(hud.playerCoords.x);
  const playerMapY = mapCoord(hud.playerCoords.z);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 select-none">
      {/* TOP BAR HUD: Minimal Left/Center Status & Radar without backdrop-filter */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Top-Left: Mini Radar + Brand & Player Status */}
        <div className="pointer-events-auto flex items-center gap-3.5 rounded-xl bg-slate-950/90 border border-slate-800 p-3 shadow-xl">
          {/* Interactive SVG Minimap Radar */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-700">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              {/* Expanded 5x5 Road Grid ([-120, -60, 0, 60, 120]) */}
              <rect x="0" y="0" width="100" height="100" fill="#0f172a" />
              {[-120, -60, 60, 120].map((r) => (
                <React.Fragment key={r}>
                  <line
                    x1={mapCoord(r)}
                    y1={mapCoord(-120)}
                    x2={mapCoord(r)}
                    y2={mapCoord(120)}
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <line
                    x1={mapCoord(-120)}
                    y1={mapCoord(r)}
                    x2={mapCoord(120)}
                    y2={mapCoord(r)}
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                </React.Fragment>
              ))}
              {/* Dedicated Park & Campus Blocks: Monas (-90,-30), Surabaya (90,30), Taman Kota (-30,90), Sekolah (30,90) */}
              <rect
                x={mapCoord(-111)}
                y={mapCoord(-51)}
                width={mapCoord(-69) - mapCoord(-111)}
                height={mapCoord(-9) - mapCoord(-51)}
                fill="#14532d"
                stroke="#22c55e"
                strokeWidth="0.8"
                rx="1.5"
              />
              <rect
                x={mapCoord(69)}
                y={mapCoord(9)}
                width={mapCoord(111) - mapCoord(69)}
                height={mapCoord(51) - mapCoord(9)}
                fill="#14532d"
                stroke="#22c55e"
                strokeWidth="0.8"
                rx="1.5"
              />
              <rect
                x={mapCoord(-51)}
                y={mapCoord(69)}
                width={mapCoord(-9) - mapCoord(-51)}
                height={mapCoord(111) - mapCoord(69)}
                fill="#14532d"
                stroke="#4ade80"
                strokeWidth="0.8"
                rx="1.5"
              />
              <rect
                x={mapCoord(9)}
                y={mapCoord(69)}
                width={mapCoord(51) - mapCoord(9)}
                height={mapCoord(111) - mapCoord(69)}
                fill="#1e3a8a"
                stroke="#60a5fa"
                strokeWidth="0.8"
                rx="1.5"
              />
              {/* Main Boulevard Axes (X=0, Z=0) */}
              <line x1="50" y1={mapCoord(-120)} x2="50" y2={mapCoord(120)} stroke="#475569" strokeWidth="3.5" />
              <line x1={mapCoord(-120)} y1="50" x2={mapCoord(120)} y2="50" stroke="#475569" strokeWidth="3.5" />
              {/* Taman Tugu Monas West Landmark (-90, -30) */}
              <circle cx={mapCoord(-90)} cy={mapCoord(-30)} r="4.5" fill="#f59e0b" stroke="#fef08a" strokeWidth="1" />
              {/* Taman Tugu Surabaya East Landmark (90, 30) */}
              <circle cx={mapCoord(90)} cy={mapCoord(30)} r="4.5" fill="#10b981" stroke="#facc15" strokeWidth="1" />
              {/* Taman Kota Nusantara (-30, 90) & SMA Negeri 1 Nusantara (30, 90) */}
              <circle cx={mapCoord(-30)} cy={mapCoord(90)} r="3.8" fill="#4ade80" stroke="#ffffff" strokeWidth="0.8" />
              <circle cx={mapCoord(30)} cy={mapCoord(90)} r="3.8" fill="#38bdf8" stroke="#fef08a" strokeWidth="0.8" />
              {/* Interactable Spots */}
              <circle cx={mapCoord(-32)} cy={mapCoord(9.2)} r="2.8" fill="#22c55e" />
              <circle cx={mapCoord(32)} cy={mapCoord(-9.2)} r="2.8" fill="#22c55e" />
              <circle cx={mapCoord(-9.5)} cy={mapCoord(-34)} r="2.8" fill="#38bdf8" />
              <circle cx={mapCoord(9.5)} cy={mapCoord(36)} r="2.8" fill="#f97316" />
              {/* Live Moving AI Traffic Blips */}
              {hud.trafficCoords?.map((tv, idx) => (
                <circle
                  key={idx}
                  cx={mapCoord(tv.x)}
                  cy={mapCoord(tv.z)}
                  r="1.7"
                  fill={tv.type === 'polisi' ? '#ef4444' : '#cbd5e1'}
                />
              ))}
              {/* Active Mission Objective */}
              {hud.targetCoords && (
                <circle
                  cx={mapCoord(hud.targetCoords.x)}
                  cy={mapCoord(hud.targetCoords.z)}
                  r="4.5"
                  fill="#facc15"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
              {/* Player Arrow */}
              <g
                transform={`translate(${playerMapX}, ${playerMapY}) rotate(${
                  (-hud.playerCoords.heading * 180) / Math.PI + 180
                })`}
              >
                <polygon points="0,-5 4,4 0,2 -4,4" fill="#ffffff" />
              </g>
            </svg>
            <span className="absolute bottom-0.5 right-1 font-mono text-[9px] text-slate-400 tabular-nums">
              {hud.playerCoords.x},{hud.playerCoords.z}
            </span>
          </div>

          {/* Player Stats: Brand, District, Money, Health, Wanted Stars */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1
                className="text-base font-bold tracking-tight text-white whitespace-nowrap"
                style={{ fontFamily: '"Chakra Petch", sans-serif' }}
              >
                NUSANTARA STREET 3D
              </h1>
              <span className="text-slate-600">·</span>
              <span className="text-xs font-medium text-amber-400 whitespace-nowrap">
                {hud.districtName}
              </span>
            </div>

            {/* Rupiah Balance + Speedometer */}
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                Rp {hud.money.toLocaleString('id-ID')}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 whitespace-nowrap">
                {hud.currentVehicleName}
              </span>
              {hud.inVehicle && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono font-bold text-sky-400 tabular-nums whitespace-nowrap">
                    {hud.speedKmh} KM/J
                  </span>
                </>
              )}
            </div>

            {/* Health Bar & Wanted Stars */}
            <div className="mt-0.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400">DARAH</span>
                <div className="h-2 w-24 overflow-hidden rounded-sm bg-slate-800">
                  <div
                    className="h-full bg-rose-500 transition-transform duration-150 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(0, hud.health / hud.maxHealth)})`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                  {hud.health}%
                </span>
              </div>

              <span className="text-slate-700">|</span>

              {/* 5-Star Wanted Level */}
              <div className="flex items-center gap-0.5" title="Level Buronan Polisi">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-sm leading-none ${
                      star <= hud.wantedStars ? 'text-amber-400' : 'text-slate-700'
                    }`}
                  >
                    ★
                  </span>
                ))}
                {hud.wantedStars > 0 && (
                  <button
                    onClick={onClearWanted}
                    className="ml-1.5 rounded bg-rose-950/90 border border-rose-700 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-900 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Hapus Bintang
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Active Mission Banner OR Context Prompt / Notification */}
        <div className="flex flex-col items-center gap-2 max-w-md">
          {hud.activeMission && (
            <div className="pointer-events-auto flex items-center justify-between gap-4 rounded-xl bg-slate-950/95 border border-amber-500/60 px-4 py-2.5 shadow-xl">
              <div>
                <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
                  <span>MISI AKTIF</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    Sisa Waktu: {hud.missionTimeLeft}d
                  </span>
                </div>
                <p className="text-sm font-bold text-white">
                  {hud.missionStage === 'to_pickup'
                    ? `Jemput di: ${hud.activeMission.pickupPos.label}`
                    : `Antar ke: ${hud.activeMission.dropoffPos.label}`}
                </p>
              </div>
              <button
                onClick={onCancelMission}
                className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Batalkan
              </button>
            </div>
          )}

          {/* Contextual Street Action Prompt (Enter Vehicle / Buy Food at Warung) */}
          {(hud.nearbyVehiclePrompt || hud.nearbySpot) && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-950/95 border border-emerald-500/60 px-4 py-2 shadow-xl">
              {hud.nearbyVehiclePrompt && !hud.inVehicle && (
                <button
                  onClick={onToggleEnterExit}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Tekan [F] Naik {hud.nearbyVehiclePrompt}</span>
                </button>
              )}

              {hud.nearbySpot && (
                <button
                  onClick={onContextAction}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Utensils className="h-3.5 w-3.5" />
                  <span>
                    [E] {hud.nearbySpot.actionLabel} (Rp{' '}
                    {hud.nearbySpot.cost.toLocaleString('id-ID')})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Toast Notification */}
          {hud.notification && (
            <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3.5 py-2 text-center shadow-lg">
              <p className="text-xs font-bold text-amber-400">
                {hud.notification.title}
              </p>
              <p className="text-[11px] text-slate-300">
                {hud.notification.subtitle}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (100% Unobstructed Center Viewport) */}
      <div
        className="pointer-events-auto fixed left-1/2 z-20 w-full transition-transform duration-200 ease-out"
        style={{
          bottom: '16px',
          maxWidth: 'min(940px, 94vw)',
          transform: isDockCollapsed
            ? 'translate(-50%, calc(100% - 34px))'
            : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse / Expand Handle Bar */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsDockCollapsed((prev) => !prev)}
            className="flex items-center gap-2 rounded-t-xl bg-slate-950/95 border border-b-0 border-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
                <span>Tampilkan Kontrol & Garasi (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
                <span>Sembunyikan Kontrol · Mode Layar Penuh (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Body */}
        <div className="rounded-2xl bg-slate-950/95 border border-slate-800 p-3.5 shadow-2xl">
          {/* Top Row of Dock: Segmented Navigation Tabs + Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            {/* Segmented Mode Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
              <button
                onClick={() => setActiveTab('kendaraan')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'kendaraan'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                <span>Garasi & Kemudi</span>
              </button>

              <button
                onClick={() => setActiveTab('misi')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'misi'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Misi Kota ({hud.completedMissionIds.length}/{MISSIONS.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('teleport')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'teleport'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Pindah Lokasi</span>
              </button>

              <button
                onClick={() => setActiveTab('suasana')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'suasana'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Suasana & Kostum</span>
              </button>
            </div>

            {/* Instant Gameplay Actions: Tugu Surabaya Quick Teleport, Rain Toggle, Enter/Exit Vehicle, Klakson Telolet, Audio */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onChangeWeather(weather === 'hujan' ? 'cerah' : 'hujan')
                }
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  weather === 'hujan'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-300'
                }`}
              >
                {weather === 'hujan' ? (
                  <>
                    <CloudRain className="h-3.5 w-3.5" />
                    <span>Hujan Aktif</span>
                  </>
                ) : (
                  <>
                    <CloudSun className="h-3.5 w-3.5" />
                    <span>Turunkan Hujan</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onTeleport(-90, -3.5, 'Taman Tugu Monas (Lahan Barat)')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 px-2.5 py-1.5 text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Ke Tugu Monas</span>
              </button>

              <button
                onClick={() => onTeleport(90, 3.5, 'Taman Tugu Surabaya (Lahan Timur)')}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Ke Tugu Surabaya</span>
              </button>

              <button
                onClick={onToggleEnterExit}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.inVehicle ? (
                  <>
                    <LogOut className="h-3.5 w-3.5 text-rose-400" />
                    <span>Turun Kendaraan [F]</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Naik Kendaraan [F]</span>
                  </>
                )}
              </button>

              <button
                onClick={onHonkHorn}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Megaphone className="h-3.5 w-3.5" />
                <span>Klakson Telolet [G]</span>
              </button>

              <button
                onClick={onToggleMute}
                aria-label="Toggle Suara"
                className="flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="pt-3">
            {activeTab === 'kendaraan' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Instant Indonesian Vehicle Spawner */}
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(VEHICLE_SPECS) as VehicleType[]).map((vType) => {
                    const spec = VEHICLE_SPECS[vType];
                    const isCurrent = hud.currentVehicleType === vType && hud.inVehicle;
                    return (
                      <button
                        key={vType}
                        onClick={() => onSpawnVehicle(vType)}
                        className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-500 text-white'
                            : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold whitespace-nowrap">
                          {spec.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                          Maks {Math.round(spec.maxSpeed * 3.2)} km/j · Panggil Instan
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Touch / Mouse Driving Controls + Keyboard Hint */}
                <div className="flex items-center gap-1.5">
                  <button
                    onPointerDown={() => onVirtualControl(0, 1)}
                    onPointerUp={() => onVirtualControl(0, 0)}
                    onPointerLeave={() => onVirtualControl(0, 0)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ◀ Kiri [A]
                  </button>
                  <button
                    onPointerDown={() => onVirtualControl(1, 0)}
                    onPointerUp={() => onVirtualControl(0, 0)}
                    onPointerLeave={() => onVirtualControl(0, 0)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ▲ Gas / Maju [W]
                  </button>
                  <button
                    onPointerDown={() => onVirtualControl(-1, 0)}
                    onPointerUp={() => onVirtualControl(0, 0)}
                    onPointerLeave={() => onVirtualControl(0, 0)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ▼ Mundur [S]
                  </button>
                  <button
                    onPointerDown={() => onVirtualControl(0, -1)}
                    onPointerUp={() => onVirtualControl(0, 0)}
                    onPointerLeave={() => onVirtualControl(0, 0)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-2 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Kanan [D] ▶
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'misi' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {MISSIONS.map((m) => {
                  const isDone = hud.completedMissionIds.includes(m.id);
                  const isActive = hud.activeMission?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col justify-between rounded-xl border p-2.5 ${
                        isActive
                          ? 'bg-amber-500/10 border-amber-500'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                          <span className="truncate">{m.giver}</span>
                          {isDone && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-white line-clamp-1">
                          {m.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                          {m.description}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                          +Rp {m.reward.toLocaleString('id-ID')}
                        </span>
                        <button
                          onClick={() => onStartMission(m.id)}
                          className="rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isActive ? 'Ulangi Misi' : 'Mulai Misi'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'teleport' && (
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: 'Taman Kota Nusantara', x: -30, z: 63.5, desc: 'Gazebo Joglo, Kolam Koi & Playground' },
                  { label: 'SMA Negeri 1 Nusantara (Sekolah)', x: 30, z: 63.5, desc: 'Gedung Sekolah, Lapangan Basket & Upacara' },
                  { label: 'Taman Tugu Surabaya (Sura & Baya)', x: 90, z: 3.5, desc: 'Lahan Taman Khusus di Timur Kota' },
                  { label: 'Lapangan Taman Tugu Monas', x: -90, z: -3.5, desc: 'Lahan Taman Khusus di Barat Kota' },
                  { label: 'Warung Pecel Lele Cak Har', x: -32, z: 3.5, desc: 'Isi Darah & Stamina' },
                  { label: 'Minimarket Indoalfa 24 Jam', x: -3.5, z: -34, desc: 'Kopi & Tarik ATM' },
                  { label: 'Bengkel Cat & Cuci Steam', x: 3.5, z: 36, desc: 'Hapus Bintang Polisi' },
                  { label: 'Warung Bakso Urat Solo', x: 32, z: -3.5, desc: 'Kuliner Malam' },
                  { label: 'Masjid Agung Nusantara', x: 32, z: -63.5, desc: 'Kubah Hijau Ikonik' },
                  { label: 'Gapura Merah Putih Selatan', x: -3.5, z: 112, desc: 'Gerbang Kampung Merdeka' },
                ].map((loc) => (
                  <button
                    key={loc.label}
                    onClick={() => onTeleport(loc.x, loc.z, loc.label)}
                    className="flex flex-col items-start rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-2 text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      {loc.label}
                    </span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {loc.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'suasana' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Time of Day Selector (Matahari & Bulan) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                    Langit:
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
                    <button
                      onClick={() => onChangeTimeOfDay('siang')}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        timeOfDay === 'siang'
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span>Siang (Matahari)</span>
                    </button>
                    <button
                      onClick={() => onChangeTimeOfDay('senja')}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        timeOfDay === 'senja'
                          ? 'bg-orange-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sunset className="h-3.5 w-3.5" />
                      <span>Senja Sore</span>
                    </button>
                    <button
                      onClick={() => onChangeTimeOfDay('malam')}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        timeOfDay === 'malam'
                          ? 'bg-indigo-500 text-white font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span>Malam (Bulan)</span>
                    </button>
                  </div>
                </div>

                {/* Weather Selector (Cerah Berawan vs Hujan Deras) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                    Cuaca:
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
                    <button
                      onClick={() => onChangeWeather('cerah')}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        weather === 'cerah'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <CloudSun className="h-3.5 w-3.5" />
                      <span>Cerah Berawan</span>
                    </button>
                    <button
                      onClick={() => onChangeWeather('hujan')}
                      className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        weather === 'hujan'
                          ? 'bg-sky-400 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <CloudRain className="h-3.5 w-3.5" />
                      <span>Hujan Deras</span>
                    </button>
                  </div>
                </div>

                {/* Outfit Selector */}
                <div className="flex items-center gap-2">
                  <Shirt className="h-3.5 w-3.5 text-slate-400" />
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
                    {(
                      [
                        { id: 'ojol', label: 'Jaket Ojol Hijau' },
                        { id: 'batik', label: 'Batik Sogan' },
                        { id: 'jaket_kulit', label: 'Jaket Malam' },
                      ] as { id: OutfitStyle; label: string }[]
                    ).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onChangeOutfit(item.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                          outfit === item.id
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Camera Preset Selector */}
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-slate-400" />
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
                    {(
                      [
                        { id: 'chase', label: 'Dekat' },
                        { id: 'far', label: 'Sinematik' },
                        { id: 'top', label: 'GTA Klasik Atas' },
                      ] as { id: CameraMode; label: string }[]
                    ).map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() => onChangeCamera(cam.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                          cameraMode === cam.id
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {cam.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
