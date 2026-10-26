import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  LogIn,
  LogOut,
  Megaphone,
  Utensils,
  Zap,
  ArrowUp,
  Camera,
} from 'lucide-react';
import { CameraMode, HudState, VehicleType } from '../types/game';

interface MobileControllerProps {
  hud: HudState;
  cameraMode: CameraMode;
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
  onChangeCamera: (mode: CameraMode) => void;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  hud,
  cameraMode,
  onVirtualControl,
  onJump,
  onToggleEnterExit,
  onHonkHorn,
  onContextAction,
  onChangeCamera,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Stick visual offset in px
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

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
      (!hud.inVehicle && stickVecRef.current.forward > 0.85);

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
    const maxRadius = rect.width * 0.38;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: kx, y: ky });

    const normX = kx / maxRadius;
    const normY = ky / maxRadius;

    stickVecRef.current = {
      forward: Math.abs(normY) > 0.1 ? -normY : 0,
      turn: Math.abs(normX) > 0.1 ? -normX : 0,
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

  const cycleCamera = () => {
    const order: CameraMode[] = ['chase', 'far', 'top'];
    const next = order[(order.indexOf(cameraMode) + 1) % order.length];
    onChangeCamera(next);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex items-end justify-between px-3 sm:px-6 select-none touch-none">
      {/* LEFT THUMB ZONE: Minimalist Translucent GTA Analog Stick */}
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        {/* Tiny Floating Camera Mode Switch */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            cycleCamera();
          }}
          aria-label="Ganti Sudut Kamera"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 active:bg-white/30 border border-white/20 text-white shadow-md backdrop-blur-[2px] touch-none cursor-pointer"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* Clean Translucent Analog Stick (No text labels blocking screen) */}
        <div
          ref={stickBaseRef}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
          className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-black/25 active:bg-black/35 border-2 border-white/25 shadow-xl backdrop-blur-[2px] touch-none cursor-pointer"
        >
          {/* Subtle Inner Crosshair Ring */}
          <div className="pointer-events-none h-14 w-14 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute h-2 w-2 rounded-full bg-white/30" />

          {/* Draggable Analog Thumb Knob */}
          <div
            className="pointer-events-none absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/35 border-2 border-white/60 shadow-md backdrop-blur-xs transition-transform duration-75"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          >
            <div className="h-4 w-4 rounded-full bg-amber-400/80 shadow-xs" />
          </div>
        </div>
      </div>

      {/* RIGHT THUMB ZONE: Clean Translucent GTA Action Controls */}
      {hud.inVehicle ? (
        /* GTA DRIVING CONTROLS: Gas Pedal, Brake/Reverse Pedal, Drift/Brake, Horn, Exit */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top Mini Buttons: Telolet Horn & Exit Car */}
          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onHonkHorn();
              }}
              title="Klakson Telolet"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/30 active:bg-amber-400/60 border border-amber-300/40 text-amber-200 shadow-md backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <Megaphone className="h-4 w-4" />
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleEnterExit();
              }}
              title="Turun dari Kendaraan"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/30 active:bg-rose-500/60 border border-rose-300/40 text-rose-200 shadow-md backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom Pedal Cluster: Handbrake, Reverse, Gas */}
          <div className="flex items-end gap-2">
            {/* Handbrake / Drift Button */}
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
              className={`flex h-13 w-13 flex-col items-center justify-center rounded-full border text-[10px] font-black shadow-lg backdrop-blur-[2px] touch-none cursor-pointer ${
                isBraking
                  ? 'bg-rose-500/70 border-white text-white scale-95'
                  : 'bg-rose-500/25 border-rose-400/40 text-rose-200'
              }`}
            >
              <span>REM</span>
            </button>

            {/* Reverse / Footbrake Pedal */}
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
              className={`flex h-16 w-14 flex-col items-center justify-center rounded-2xl border text-xs font-black shadow-lg backdrop-blur-[2px] touch-none cursor-pointer ${
                activePedal === 'reverse'
                  ? 'bg-amber-400/70 border-white text-slate-950 scale-95'
                  : 'bg-amber-500/25 border-amber-400/40 text-amber-200'
              }`}
            >
              <span className="text-base leading-none">▼</span>
              <span className="text-[9px] mt-0.5">MDR</span>
            </button>

            {/* Accelerator / Gas Pedal (Tall & responsive) */}
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
              className={`flex h-22 w-16 flex-col items-center justify-center rounded-2xl border-2 text-sm font-black shadow-xl backdrop-blur-[2px] touch-none cursor-pointer ${
                activePedal === 'gas'
                  ? 'bg-emerald-400/80 border-white text-slate-950 scale-95'
                  : 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
              }`}
            >
              <span className="text-2xl leading-none">▲</span>
              <span className="text-[11px] font-black mt-0.5">GAS</span>
            </button>
          </div>
        </div>
      ) : (
        /* GTA ON-FOOT CONTROLS: Sprint, Jump, Action/Punch/Buy, Enter Vehicle */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Enter Nearby Vehicle Button (Only renders or highlights when near vehicle) */}
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleEnterExit();
            }}
            className={`flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer border ${
              hud.nearbyVehiclePrompt
                ? 'bg-amber-500/60 border-amber-300 text-white animate-pulse'
                : 'bg-black/30 border-white/20 text-white/80'
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>{hud.nearbyVehiclePrompt ? 'NAIK' : 'KENDARAAN'}</span>
          </button>

          {/* Bottom Action Cluster: Sprint, Jump, Punch/Action */}
          <div className="flex items-end gap-2">
            {/* Sprint Button */}
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
              className={`flex h-13 w-13 flex-col items-center justify-center rounded-full border text-[10px] font-bold shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer ${
                sprintLocked
                  ? 'bg-sky-400/70 border-white text-slate-950'
                  : 'bg-sky-500/20 border-sky-400/30 text-sky-200'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="text-[9px] mt-0.5">LARI</span>
            </button>

            {/* Jump Button */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onJump();
              }}
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white/15 active:bg-white/35 border border-white/25 text-white shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <ArrowUp className="h-5 w-5 text-amber-300" />
            </button>

            {/* Context Action / Punch / Buy Food Button */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                onContextAction();
              }}
              className={`flex h-17 w-17 flex-col items-center justify-center rounded-full border-2 text-xs font-black shadow-xl backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer ${
                hud.nearbySpot
                  ? 'bg-emerald-500/60 border-emerald-300 text-white'
                  : 'bg-white/20 active:bg-white/40 border-white/40 text-white'
              }`}
            >
              {hud.nearbySpot ? (
                <>
                  <Utensils className="h-5 w-5 text-emerald-300" />
                  <span className="text-[9px] font-bold mt-0.5">BELI</span>
                </>
              ) : (
                <span className="text-xl">👊</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
