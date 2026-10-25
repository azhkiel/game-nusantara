import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  LogIn,
  LogOut,
  Megaphone,
  Utensils,
  Zap,
  ArrowUp,
} from 'lucide-react';
import { HudState, VehicleType } from '../types/game';

interface MobileControllerProps {
  hud: HudState;
  onVirtualControl: (
    forward: number,
    turn: number,
    brake?: boolean,
    sprint?: boolean
  ) => void;
  onJump: () => void;
  onToggleEnterExit: () => void;
  onHonkHorn: () => void;
  onContextAction: () => void;
  onSpawnVehicle: (type: VehicleType) => void;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  hud,
  onVirtualControl,
  onJump,
  onToggleEnterExit,
  onHonkHorn,
  onContextAction,
  onSpawnVehicle,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Stick visual offset in px (-42..42)
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Combined input state from Left Stick + Right Pedals/Buttons
  const stickVecRef = useRef<{ forward: number; turn: number }>({
    forward: 0,
    turn: 0,
  });
  const pedalThrottleRef = useRef<number>(0); // +1 Gas, -1 Reverse, 0 Idle
  const handbrakeRef = useRef<boolean>(false);
  const sprintHeldRef = useRef<boolean>(false);
  const [sprintLocked, setSprintLocked] = useState<boolean>(false);
  const [activePedal, setActivePedal] = useState<'gas' | 'reverse' | null>(null);
  const [isBraking, setIsBraking] = useState<boolean>(false);

  const syncControlToEngine = (nextSprintLock = sprintLocked) => {
    const finalForward =
      Math.abs(pedalThrottleRef.current) > 0.05
        ? pedalThrottleRef.current
        : stickVecRef.current.forward;
    const finalTurn = stickVecRef.current.turn;
    const finalBrake = handbrakeRef.current;
    const finalSprint =
      sprintHeldRef.current ||
      nextSprintLock ||
      (!hud.inVehicle && stickVecRef.current.forward > 0.88);

    onVirtualControl(finalForward, finalTurn, finalBrake, finalSprint);
  };

  useEffect(() => {
    return () => {
      onVirtualControl(0, 0, false, false);
    };
  }, [onVirtualControl]);

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36; // ~44px

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: kx, y: ky });

    // Normalize to -1..1
    const normX = kx / maxRadius; // left is negative, right is positive
    const normY = ky / maxRadius; // up is negative, down is positive

    // In CityEngine: forward > 0 moves forward, turn > 0 turns Left (+A), turn < 0 turns Right (-D)
    stickVecRef.current = {
      forward: Math.abs(normY) > 0.12 ? -normY : 0,
      turn: Math.abs(normX) > 0.12 ? -normX : 0,
    };
    syncControlToEngine();
  };

  const resetStick = () => {
    activePointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    stickVecRef.current = { forward: 0, turn: 0 };
    syncControlToEngine();
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    resetStick();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-12 z-30 flex items-end justify-between px-4 sm:px-7 select-none touch-none">
      {/* LEFT THUMB ZONE: Virtual Analog Joystick (Maju / Mundur / Belok Kiri-Kanan) */}
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <div
          ref={stickBaseRef}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
          className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-950/90 border-2 border-slate-700/90 shadow-2xl active:border-amber-400 touch-none"
        >
          {/* Crosshair & Directional Labels */}
          <span className="pointer-events-none absolute top-2 text-[9px] font-bold tracking-wider text-slate-400">
            MAJU
          </span>
          <span className="pointer-events-none absolute bottom-2 text-[9px] font-bold tracking-wider text-slate-400">
            MUNDUR
          </span>
          <span className="pointer-events-none absolute left-2 text-[9px] font-bold tracking-wider text-slate-400">
            KIRI
          </span>
          <span className="pointer-events-none absolute right-2 text-[9px] font-bold tracking-wider text-slate-400">
            KANAN
          </span>

          {/* Inner Guide Circle */}
          <div className="pointer-events-none h-16 w-16 rounded-full border border-slate-800/90" />

          {/* Draggable Analog Thumb Knob */}
          <div
            className="pointer-events-none flex h-13 w-13 items-center justify-center rounded-full bg-amber-500 border-2 border-amber-200 shadow-lg transition-transform duration-75"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          >
            <div className="h-4 w-4 rounded-full bg-slate-950/40" />
          </div>
        </div>
        <span className="rounded bg-slate-950/85 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-800">
          {hud.inVehicle ? 'Setir & Arah' : 'Analog Jalan / Lari'}
        </span>
      </div>

      {/* RIGHT THUMB ZONE: Context-Sensitive GTA Action Buttons (On Foot vs Driving) */}
      {hud.inVehicle ? (
        /* MODE BERKENDARA: Pedal Gas, Rem/Mundur, Rem Tangan, Klakson Telolet, Turun */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top Action Row: Turun Kendaraan & Klakson Telolet */}
          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onHonkHorn();
              }}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-amber-500/95 active:bg-amber-400 border border-amber-300 px-3 text-xs font-bold text-slate-950 shadow-lg touch-none cursor-pointer"
            >
              <Megaphone className="h-4 w-4" />
              <span>TELOLET</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleEnterExit();
              }}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-rose-600/95 active:bg-rose-500 border border-rose-400 px-3 text-xs font-bold text-white shadow-lg touch-none cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>TURUN</span>
            </button>
          </div>

          {/* Bottom Pedal Row: Rem Tangan, Pedal Mundur, Pedal Gas Besar */}
          <div className="flex items-end gap-2">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                handbrakeRef.current = true;
                setIsBraking(true);
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                handbrakeRef.current = false;
                setIsBraking(false);
                syncControlToEngine();
              }}
              onPointerLeave={() => {
                if (handbrakeRef.current) {
                  handbrakeRef.current = false;
                  setIsBraking(false);
                  syncControlToEngine();
                }
              }}
              className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl border text-[10px] font-bold shadow-xl touch-none cursor-pointer ${
                isBraking
                  ? 'bg-rose-500 border-rose-200 text-white'
                  : 'bg-slate-900/95 border-slate-700 text-rose-300'
              }`}
            >
              <span>REM</span>
              <span>DRIFT</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                pedalThrottleRef.current = -1;
                setActivePedal('reverse');
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                pedalThrottleRef.current = 0;
                setActivePedal(null);
                syncControlToEngine();
              }}
              onPointerLeave={() => {
                if (pedalThrottleRef.current < 0) {
                  pedalThrottleRef.current = 0;
                  setActivePedal(null);
                  syncControlToEngine();
                }
              }}
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border text-xs font-bold shadow-xl touch-none cursor-pointer ${
                activePedal === 'reverse'
                  ? 'bg-amber-500 border-amber-200 text-slate-950'
                  : 'bg-slate-900/95 border-slate-700 text-slate-200'
              }`}
            >
              <span className="text-base leading-none">▼</span>
              <span className="mt-1 text-[10px]">MUNDUR</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                pedalThrottleRef.current = 1;
                setActivePedal('gas');
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                pedalThrottleRef.current = 0;
                setActivePedal(null);
                syncControlToEngine();
              }}
              onPointerLeave={() => {
                if (pedalThrottleRef.current > 0) {
                  pedalThrottleRef.current = 0;
                  setActivePedal(null);
                  syncControlToEngine();
                }
              }}
              className={`flex h-22 w-20 flex-col items-center justify-center rounded-2xl border-2 text-sm font-extrabold shadow-2xl touch-none cursor-pointer ${
                activePedal === 'gas'
                  ? 'bg-emerald-400 border-white text-slate-950 scale-95'
                  : 'bg-emerald-600/95 border-emerald-300 text-white'
              }`}
            >
              <span className="text-xl leading-none">▲</span>
              <span className="mt-1">GAS</span>
            </button>
          </div>
        </div>
      ) : (
        /* MODE JALAN KAKI: Naik Kendaraan, Panggil Ojol, Lompat, Lari Cepat, Aksi / Beli Makanan */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top Row: Quick Spawn Ojol & Enter Nearby Vehicle */}
          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onSpawnVehicle('ojol_motor');
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-900/95 active:bg-slate-800 border border-slate-700 px-2.5 text-[11px] font-bold text-emerald-300 shadow-lg touch-none cursor-pointer"
            >
              <Car className="h-3.5 w-3.5" />
              <span>PANGGIL OJOL</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleEnterExit();
              }}
              className={`flex h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold shadow-lg touch-none cursor-pointer ${
                hud.nearbyVehiclePrompt
                  ? 'bg-amber-500 border-amber-200 text-slate-950 animate-pulse'
                  : 'bg-slate-900/95 border-slate-700 text-slate-200'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>{hud.nearbyVehiclePrompt ? 'NAIK!' : 'NAIK [F]'}</span>
            </button>
          </div>

          {/* Bottom Action Cluster: Sprint, Jump, Action / Buy Food */}
          <div className="flex items-end gap-2">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                const nextLock = !sprintLocked;
                setSprintLocked(nextLock);
                sprintHeldRef.current = true;
                syncControlToEngine(nextLock);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                sprintHeldRef.current = false;
                syncControlToEngine();
              }}
              className={`flex h-14 w-15 flex-col items-center justify-center rounded-2xl border text-[10px] font-bold shadow-xl touch-none cursor-pointer ${
                sprintLocked
                  ? 'bg-sky-500 border-sky-200 text-slate-950'
                  : 'bg-slate-900/95 border-slate-700 text-sky-300'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="mt-0.5">{sprintLocked ? 'LARI ON' : 'LARI'}</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="flex h-15 w-15 flex-col items-center justify-center rounded-2xl bg-slate-900/95 active:bg-slate-700 border border-slate-600 text-[10px] font-bold text-white shadow-xl touch-none cursor-pointer"
            >
              <ArrowUp className="h-4 w-4 text-amber-400" />
              <span className="mt-0.5">LOMPAT</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onContextAction();
              }}
              className={`flex h-18 w-18 flex-col items-center justify-center rounded-full border-2 text-xs font-extrabold shadow-2xl touch-none cursor-pointer ${
                hud.nearbySpot
                  ? 'bg-emerald-500 border-emerald-200 text-slate-950'
                  : 'bg-rose-600/95 border-rose-300 text-white active:scale-95'
              }`}
            >
              {hud.nearbySpot ? (
                <>
                  <Utensils className="h-5 w-5" />
                  <span className="mt-0.5 text-[10px]">BELI</span>
                </>
              ) : (
                <>
                  <span className="text-base leading-none">👊</span>
                  <span className="mt-1 text-[10px]">AKSI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
