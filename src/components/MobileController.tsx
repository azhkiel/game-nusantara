import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  LogIn,
  LogOut,
  Megaphone,
  Utensils,
  Zap,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Camera,
  Home,
  BedDouble,
  Armchair,
  DoorOpen,
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
  onHomeAction: (action: 'sleep' | 'eat' | 'sit' | 'stand' | 'exit' | 'enter') => void;
  onToggleHomeMenu: () => void;
  onOpenGarage: () => void;
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
  onHomeAction,
  onToggleHomeMenu,
  onOpenGarage,
  onChangeCamera,
}) => {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Keep latest callbacks in refs so unmount cleanup never fires on HUD re-renders
  const onVirtualControlRef = useRef(onVirtualControl);
  onVirtualControlRef.current = onVirtualControl;
  const inVehicleRef = useRef(hud.inVehicle);
  inVehicleRef.current = hud.inVehicle;

  // Stick visual offset in px
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const stickVecRef = useRef<{ forward: number; turn: number }>({
    forward: 0,
    turn: 0,
  });
  const steerTurnRef = useRef<number>(0); // +1 Left, -1 Right, 0 Straight (Vehicle mode)
  const pedalThrottleRef = useRef<number>(0); // +1 Gas, -1 Reverse, 0 Idle
  const handbrakeRef = useRef<boolean>(false);
  const sprintHeldRef = useRef<boolean>(false);
  const sprintLockedRef = useRef<boolean>(false);
  const [sprintLocked, setSprintLocked] = useState<boolean>(false);
  const [activeSteer, setActiveSteer] = useState<'left' | 'right' | null>(null);
  const [activePedal, setActivePedal] = useState<'gas' | 'reverse' | null>(null);
  const [isBraking, setIsBraking] = useState<boolean>(false);

  const syncControlToEngine = () => {
    let finalForward = stickVecRef.current.forward;
    if (Math.abs(pedalThrottleRef.current) > 0.05) {
      finalForward = pedalThrottleRef.current;
    } else if (!inVehicleRef.current && sprintHeldRef.current && Math.abs(finalForward) < 0.1) {
      // Holding LARI button on foot moves character forward even if analog stick isn't held
      finalForward = 1;
    }

    const finalTurn = inVehicleRef.current
      ? steerTurnRef.current
      : stickVecRef.current.turn;
    const finalBrake = handbrakeRef.current;
    const finalSprint =
      sprintHeldRef.current ||
      sprintLockedRef.current ||
      (!inVehicleRef.current && stickVecRef.current.forward > 0.85);

    onVirtualControlRef.current(finalForward, finalTurn, finalBrake, finalSprint);
  };

  // Reset stick/pedals cleanly when switching between on-foot and vehicle mode
  useEffect(() => {
    activePointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    stickVecRef.current = { forward: 0, turn: 0 };
    steerTurnRef.current = 0;
    pedalThrottleRef.current = 0;
    handbrakeRef.current = false;
    setActiveSteer(null);
    setActivePedal(null);
    setIsBraking(false);
    onVirtualControlRef.current(0, 0, false, false);
  }, [hud.inVehicle]);

  // Only reset virtual control when MobileController truly unmounts
  useEffect(() => {
    return () => {
      onVirtualControlRef.current(0, 0, false, false);
    };
  }, []);

  // Safe tap handler that works on both touch pointerdown and standard click without double-firing
  const triggerTap = (action: () => void) => {
    const now = performance.now();
    if (now - lastTapTimeRef.current < 220) return;
    lastTapTimeRef.current = now;
    action();
  };

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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on synthetic events
    }
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

  // Determine nearest indoor furniture action when inside house
  let indoorSpotAction: 'sleep' | 'eat' | 'sit' | 'exit' | null = null;
  if (hud.isInsideHome && hud.playerHomeState === 'standing') {
    const px = hud.playerCoords.x;
    const pz = hud.playerCoords.z;
    const dBed = Math.hypot(px - -20.5, pz - 27.4);
    const dEat = Math.hypot(px - -19.6, pz - 22.0);
    const dSofa = Math.hypot(px - -16.4, pz - 25.65);
    const dDoor = Math.hypot(px - -13.5, pz - 24.0);
    const minD = Math.min(dBed, dEat, dSofa, dDoor);
    if (minD === dDoor && dDoor < 2.6) indoorSpotAction = 'exit';
    else if (minD === dBed && dBed < 2.8) indoorSpotAction = 'sleep';
    else if (minD === dEat && dEat < 2.6) indoorSpotAction = 'eat';
    else if (minD === dSofa && dSofa < 2.6) indoorSpotAction = 'sit';
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex items-end justify-between px-3 sm:px-6 select-none touch-none"
    >
      {/* LEFT THUMB ZONE: Left/Right Steering Arrows in Vehicle, or Analog Stick On-Foot */}
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        {/* Tiny Floating Camera Mode Switch */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            triggerTap(cycleCamera);
          }}
          onClick={(e) => {
            e.stopPropagation();
            triggerTap(cycleCamera);
          }}
          aria-label="Ganti Sudut Kamera"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 active:bg-white/30 border border-white/25 text-white shadow-md backdrop-blur-[2px] touch-none cursor-pointer"
        >
          <Camera className="h-4 w-4" />
        </button>

        {hud.inVehicle ? (
          /* VEHICLE STEERING ARROWS: Left & Right Turn Buttons */
          <div className="flex items-center gap-2.5">
            {/* Turn Left Arrow Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                steerTurnRef.current = 1;
                setActiveSteer('left');
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (steerTurnRef.current > 0) {
                  steerTurnRef.current = 0;
                  setActiveSteer(null);
                  syncControlToEngine();
                }
              }}
              onPointerCancel={() => {
                if (steerTurnRef.current > 0) {
                  steerTurnRef.current = 0;
                  setActiveSteer(null);
                  syncControlToEngine();
                }
              }}
              aria-label="Belok Kiri"
              className={`flex h-17 w-17 sm:h-19 sm:w-19 flex-col items-center justify-center rounded-2xl border-2 shadow-xl backdrop-blur-[2px] touch-none cursor-pointer transition-transform ${
                activeSteer === 'left'
                  ? 'bg-sky-400/85 border-white text-slate-950 scale-95'
                  : 'bg-black/40 border-white/30 text-white'
              }`}
            >
              <ArrowLeft className="h-7 w-7 stroke-[2.5]" />
              <span className="text-[9px] font-black tracking-wider mt-0.5">
                KIRI
              </span>
            </button>

            {/* Turn Right Arrow Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                steerTurnRef.current = -1;
                setActiveSteer('right');
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (steerTurnRef.current < 0) {
                  steerTurnRef.current = 0;
                  setActiveSteer(null);
                  syncControlToEngine();
                }
              }}
              onPointerCancel={() => {
                if (steerTurnRef.current < 0) {
                  steerTurnRef.current = 0;
                  setActiveSteer(null);
                  syncControlToEngine();
                }
              }}
              aria-label="Belok Kanan"
              className={`flex h-17 w-17 sm:h-19 sm:w-19 flex-col items-center justify-center rounded-2xl border-2 shadow-xl backdrop-blur-[2px] touch-none cursor-pointer transition-transform ${
                activeSteer === 'right'
                  ? 'bg-sky-400/85 border-white text-slate-950 scale-95'
                  : 'bg-black/40 border-white/30 text-white'
              }`}
            >
              <ArrowRight className="h-7 w-7 stroke-[2.5]" />
              <span className="text-[9px] font-black tracking-wider mt-0.5">
                KANAN
              </span>
            </button>
          </div>
        ) : (
          /* ON-FOOT ANALOG STICK */
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
        )}
      </div>

      {/* RIGHT THUMB ZONE: Clean Translucent GTA Action Controls */}
      {hud.inVehicle ? (
        /* GTA DRIVING CONTROLS: Gas Pedal, Brake/Reverse Pedal, Drift/Brake, Horn, Exit */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top Mini Buttons: Telolet Horn & Exit Car */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerTap(onHonkHorn);
              }}
              onClick={(e) => {
                e.stopPropagation();
                triggerTap(onHonkHorn);
              }}
              title="Klakson Telolet"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/35 active:bg-amber-400/70 border border-amber-300/50 text-amber-200 shadow-md backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <Megaphone className="h-4 w-4" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerTap(onToggleEnterExit);
              }}
              onClick={(e) => {
                e.stopPropagation();
                triggerTap(onToggleEnterExit);
              }}
              title="Turun dari Kendaraan"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/35 active:bg-rose-500/70 border border-rose-300/50 text-rose-200 shadow-md backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom Pedal Cluster: Handbrake, Reverse, Gas */}
          <div className="flex items-end gap-2">
            {/* Handbrake / Drift Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
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
              onPointerCancel={() => {
                handbrakeRef.current = false;
                setIsBraking(false);
                syncControlToEngine();
              }}
              className={`flex h-13 w-13 flex-col items-center justify-center rounded-full border text-[10px] font-black shadow-lg backdrop-blur-[2px] touch-none cursor-pointer ${
                isBraking
                  ? 'bg-rose-500/75 border-white text-white scale-95'
                  : 'bg-rose-500/25 border-rose-400/40 text-rose-200'
              }`}
            >
              <span>REM</span>
            </button>

            {/* Reverse / Footbrake Pedal */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
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
              onPointerCancel={() => {
                pedalThrottleRef.current = 0;
                setActivePedal(null);
                syncControlToEngine();
              }}
              className={`flex h-16 w-14 flex-col items-center justify-center rounded-2xl border text-xs font-black shadow-lg backdrop-blur-[2px] touch-none cursor-pointer ${
                activePedal === 'reverse'
                  ? 'bg-amber-400/75 border-white text-slate-950 scale-95'
                  : 'bg-amber-500/25 border-amber-400/40 text-amber-200'
              }`}
            >
              <span className="text-base leading-none">▼</span>
              <span className="text-[9px] mt-0.5">MDR</span>
            </button>

            {/* Accelerator / Gas Pedal (Tall & responsive) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
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
              onPointerCancel={() => {
                pedalThrottleRef.current = 0;
                setActivePedal(null);
                syncControlToEngine();
              }}
              className={`flex h-22 w-16 flex-col items-center justify-center rounded-2xl border-2 text-sm font-black shadow-xl backdrop-blur-[2px] touch-none cursor-pointer ${
                activePedal === 'gas'
                  ? 'bg-emerald-400/85 border-white text-slate-950 scale-95'
                  : 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
              }`}
            >
              <span className="text-2xl leading-none">▲</span>
              <span className="text-[11px] font-black mt-0.5">GAS</span>
            </button>
          </div>
        </div>
      ) : (
        /* GTA ON-FOOT CONTROLS: Sprint, Jump, Action/Punch/Buy/Home, Vehicle/Exit */
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Top Context Pill Row: Inside Home shows Aksi Rumah & Keluar; Outside shows Naik / Garasi */}
          {hud.isInsideHome ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerTap(onToggleHomeMenu);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerTap(onToggleHomeMenu);
                }}
                className="flex h-9 items-center gap-1 rounded-full bg-slate-950/75 active:bg-sky-500/60 border border-sky-400/70 px-3 text-[11px] font-bold text-sky-200 shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
              >
                <Home className="h-3.5 w-3.5 text-sky-400" />
                <span>RUMAH</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  triggerTap(() => onHomeAction('exit'));
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerTap(() => onHomeAction('exit'));
                }}
                className="flex h-9 items-center gap-1 rounded-full bg-rose-600/85 active:bg-rose-500 border border-rose-300/60 px-3 text-[11px] font-bold text-white shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                <span>KELUAR</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerTap(
                  hud.nearbyVehiclePrompt ? onToggleEnterExit : onOpenGarage
                );
              }}
              onClick={(e) => {
                e.stopPropagation();
                triggerTap(
                  hud.nearbyVehiclePrompt ? onToggleEnterExit : onOpenGarage
                );
              }}
              className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer border ${
                hud.nearbyVehiclePrompt
                  ? 'bg-amber-500/70 border-amber-300 text-white animate-pulse'
                  : 'bg-black/45 border-white/25 text-white/90'
              }`}
            >
              {hud.nearbyVehiclePrompt ? (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>NAIK</span>
                </>
              ) : (
                <>
                  <Car className="h-4 w-4 text-amber-300" />
                  <span>GARASI</span>
                </>
              )}
            </button>
          )}

          {/* Bottom Action Cluster: Sprint, Jump, Context Action */}
          <div className="flex items-end gap-2">
            {/* Sprint Button (Hold to run forward, or tap to lock sprint) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                const nextLock = !sprintLockedRef.current;
                sprintLockedRef.current = nextLock;
                setSprintLocked(nextLock);
                sprintHeldRef.current = true;
                syncControlToEngine();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                sprintHeldRef.current = false;
                syncControlToEngine();
              }}
              onPointerCancel={() => {
                sprintHeldRef.current = false;
                syncControlToEngine();
              }}
              className={`flex h-13 w-13 flex-col items-center justify-center rounded-full border text-[10px] font-bold shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer ${
                sprintLocked
                  ? 'bg-sky-400/75 border-white text-slate-950'
                  : 'bg-sky-500/25 border-sky-400/40 text-sky-200'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="text-[9px] mt-0.5">LARI</span>
            </button>

            {/* Jump Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerTap(onJump);
              }}
              onClick={(e) => {
                e.stopPropagation();
                triggerTap(onJump);
              }}
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white/20 active:bg-white/40 border border-white/30 text-white shadow-lg backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer"
            >
              <ArrowUp className="h-5 w-5 text-amber-300" />
              <span className="text-[8px] font-bold text-white/80">LOMPAT</span>
            </button>

            {/* Smart Context Action / Punch / Buy Food / Home Furniture Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerTap(() => {
                  if (hud.playerHomeState !== 'standing') {
                    onHomeAction('stand');
                  } else if (indoorSpotAction) {
                    onHomeAction(indoorSpotAction);
                  } else if (hud.isNearHomeDoor && !hud.isInsideHome) {
                    onHomeAction('enter');
                  } else {
                    onContextAction();
                  }
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                triggerTap(() => {
                  if (hud.playerHomeState !== 'standing') {
                    onHomeAction('stand');
                  } else if (indoorSpotAction) {
                    onHomeAction(indoorSpotAction);
                  } else if (hud.isNearHomeDoor && !hud.isInsideHome) {
                    onHomeAction('enter');
                  } else {
                    onContextAction();
                  }
                });
              }}
              className={`flex h-17 w-17 flex-col items-center justify-center rounded-full border-2 text-xs font-black shadow-xl backdrop-blur-[2px] active:scale-95 touch-none cursor-pointer ${
                hud.playerHomeState !== 'standing'
                  ? 'bg-amber-500/75 border-amber-200 text-slate-950'
                  : indoorSpotAction || hud.isNearHomeDoor
                  ? 'bg-sky-500/70 border-sky-200 text-white'
                  : hud.nearbySpot
                  ? 'bg-emerald-500/70 border-emerald-300 text-white'
                  : 'bg-white/20 active:bg-white/40 border-white/40 text-white'
              }`}
            >
              {hud.playerHomeState !== 'standing' ? (
                <>
                  <ArrowUp className="h-5 w-5" />
                  <span className="text-[9px] font-black mt-0.5">BERDIRI</span>
                </>
              ) : indoorSpotAction === 'sleep' ? (
                <>
                  <BedDouble className="h-5 w-5 text-sky-200" />
                  <span className="text-[9px] font-bold mt-0.5">TIDUR</span>
                </>
              ) : indoorSpotAction === 'eat' ? (
                <>
                  <Utensils className="h-5 w-5 text-emerald-200" />
                  <span className="text-[9px] font-bold mt-0.5">MAKAN</span>
                </>
              ) : indoorSpotAction === 'sit' ? (
                <>
                  <Armchair className="h-5 w-5 text-amber-200" />
                  <span className="text-[9px] font-bold mt-0.5">DUDUK</span>
                </>
              ) : indoorSpotAction === 'exit' ? (
                <>
                  <DoorOpen className="h-5 w-5 text-rose-200" />
                  <span className="text-[9px] font-bold mt-0.5">KELUAR</span>
                </>
              ) : hud.isNearHomeDoor && !hud.isInsideHome ? (
                <>
                  <Home className="h-5 w-5 text-sky-200" />
                  <span className="text-[9px] font-bold mt-0.5">MASUK</span>
                </>
              ) : hud.nearbySpot ? (
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
