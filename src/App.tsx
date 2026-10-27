/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlOverlay } from './components/ControlOverlay';
import { CityEngine } from './three/CityEngine';
import {
  CameraMode,
  HudState,
  OutfitStyle,
  TimeOfDay,
  VehicleType,
  WeatherType,
} from './types/game';
import { soundFX } from './utils/sound';

const INITIAL_HUD: HudState = {
  money: 250000,
  health: 75,
  maxHealth: 100,
  wantedStars: 0,
  districtName: 'Rumah Pribadi Karakter Utama (Blok M)',
  inVehicle: false,
  currentVehicleName: 'Jalan Kaki',
  currentVehicleType: null,
  speedKmh: 0,
  nearbyVehiclePrompt: null,
  nearbySpot: null,
  activeMission: null,
  missionStage: 'idle',
  missionTimeLeft: 0,
  notification: {
    title: 'Selamat Pagi di Rumah Pribadi!',
    subtitle: 'Kamu berada di dalam rumahmu. Silakan Tidur, Makan, Duduk di Sofa, atau melangkah Keluar Rumah menuju jalan raya!',
    tone: 'info',
  },
  playerCoords: { x: -18, z: 24, heading: Math.PI / 2 },
  targetCoords: null,
  trafficCoords: [],
  completedMissionIds: [],
  timeOfDay: 'pagi',
  clockTimeText: '08:00 WIB',
  autoTime: true,
  weather: 'cerah',
  isInsideHome: true,
  isNearHomeDoor: false,
  playerHomeState: 'standing',
  homeTransition: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityEngine | null>(null);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [outfit, setOutfit] = useState<OutfitStyle>('ojol');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new CityEngine(container, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleEnterExit = useCallback(() => {
    engineRef.current?.toggleVehicleEnterExit();
  }, []);

  const handleSpawnVehicle = useCallback((type: VehicleType) => {
    engineRef.current?.spawnAndEnterVehicle(type);
  }, []);

  const handleHonkHorn = useCallback(() => {
    engineRef.current?.honkVehicleHorn();
  }, []);

  const handleContextAction = useCallback(() => {
    engineRef.current?.triggerContextAction();
  }, []);

  const handleHomeAction = useCallback(
    (action: 'sleep' | 'eat' | 'sit' | 'stand' | 'exit' | 'enter') => {
      engineRef.current?.performHomeAction(action);
    },
    []
  );

  const handleBuyShopItem = useCallback((spotId: string, itemId: string) => {
    engineRef.current?.buyShopItem(spotId, itemId);
  }, []);

  const handleStartMission = useCallback((id: string) => {
    engineRef.current?.startMission(id);
  }, []);

  const handleCancelMission = useCallback(() => {
    engineRef.current?.cancelMission();
  }, []);

  const handleChangeTimeOfDay = useCallback((nextTime: TimeOfDay) => {
    engineRef.current?.setTimeOfDay(nextTime);
  }, []);

  const handleToggleAutoTime = useCallback((enabled: boolean) => {
    engineRef.current?.setAutoTime(enabled);
  }, []);

  const handleChangeWeather = useCallback((nextWeather: WeatherType) => {
    engineRef.current?.setWeather(nextWeather);
  }, []);

  const handleChangeOutfit = useCallback((nextOutfit: OutfitStyle) => {
    setOutfit(nextOutfit);
    engineRef.current?.setOutfit(nextOutfit);
  }, []);

  const handleChangeCamera = useCallback((nextCam: CameraMode) => {
    setCameraMode(nextCam);
    engineRef.current?.setCameraMode(nextCam);
  }, []);

  const handleClearWanted = useCallback(() => {
    engineRef.current?.clearWantedStars();
  }, []);

  const handleTeleport = useCallback((x: number, z: number, label: string) => {
    engineRef.current?.teleportToLandmark(x, z, label);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      soundFX.setMuted(nextMuted);
      return nextMuted;
    });
  }, []);

  const handleVirtualControl = useCallback(
    (forward: number, turn: number, brake = false, sprint = false) => {
      engineRef.current?.setVirtualInput(forward, turn, brake, sprint);
    },
    []
  );

  const handleJump = useCallback(() => {
    engineRef.current?.triggerJump();
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Semantic DOM HUD Overlay, Mobile Touch Controller & Collapsible Bottom Dock */}
      <ControlOverlay
        hud={hud}
        timeOfDay={hud.timeOfDay}
        weather={hud.weather}
        cameraMode={cameraMode}
        outfit={outfit}
        isMuted={isMuted}
        onToggleEnterExit={handleToggleEnterExit}
        onSpawnVehicle={handleSpawnVehicle}
        onHonkHorn={handleHonkHorn}
        onContextAction={handleContextAction}
        onHomeAction={handleHomeAction}
        onBuyShopItem={handleBuyShopItem}
        onStartMission={handleStartMission}
        onCancelMission={handleCancelMission}
        onChangeTimeOfDay={handleChangeTimeOfDay}
        onToggleAutoTime={handleToggleAutoTime}
        onChangeWeather={handleChangeWeather}
        onChangeOutfit={handleChangeOutfit}
        onChangeCamera={handleChangeCamera}
        onClearWanted={handleClearWanted}
        onTeleport={handleTeleport}
        onToggleMute={handleToggleMute}
        onVirtualControl={handleVirtualControl}
        onJump={handleJump}
      />
    </main>
  );
}

