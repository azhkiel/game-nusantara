/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
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
  health: 100,
  maxHealth: 100,
  wantedStars: 0,
  districtName: 'Alun-Alun Tugu Monas',
  inVehicle: false,
  currentVehicleName: 'Jalan Kaki',
  currentVehicleType: null,
  speedKmh: 0,
  nearbyVehiclePrompt: 'Bajaj Oranye BBG',
  nearbySpot: null,
  activeMission: null,
  missionStage: 'idle',
  missionTimeLeft: 0,
  notification: {
    title: 'Selamat Datang di Kota Raya Nusantara!',
    subtitle: 'Gunakan WASD untuk bergerak, tekan F untuk naik Bajaj atau Motor Ojol.',
    tone: 'info',
  },
  playerCoords: { x: 0, z: 26, heading: Math.PI },
  targetCoords: null,
  trafficCoords: [],
  completedMissionIds: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityEngine | null>(null);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('siang');
  const [weather, setWeather] = useState<WeatherType>('cerah');
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

  const handleToggleEnterExit = () => {
    engineRef.current?.toggleVehicleEnterExit();
  };

  const handleSpawnVehicle = (type: VehicleType) => {
    engineRef.current?.spawnAndEnterVehicle(type);
  };

  const handleHonkHorn = () => {
    engineRef.current?.honkVehicleHorn();
  };

  const handleContextAction = () => {
    engineRef.current?.triggerContextAction();
  };

  const handleStartMission = (id: string) => {
    engineRef.current?.startMission(id);
  };

  const handleCancelMission = () => {
    engineRef.current?.cancelMission();
  };

  const handleChangeTimeOfDay = (nextTime: TimeOfDay) => {
    setTimeOfDay(nextTime);
    engineRef.current?.setTimeOfDay(nextTime);
  };

  const handleChangeWeather = (nextWeather: WeatherType) => {
    setWeather(nextWeather);
    engineRef.current?.setWeather(nextWeather);
  };

  const handleChangeOutfit = (nextOutfit: OutfitStyle) => {
    setOutfit(nextOutfit);
    engineRef.current?.setOutfit(nextOutfit);
  };

  const handleChangeCamera = (nextCam: CameraMode) => {
    setCameraMode(nextCam);
    engineRef.current?.setCameraMode(nextCam);
  };

  const handleClearWanted = () => {
    engineRef.current?.clearWantedStars();
  };

  const handleTeleport = (x: number, z: number, label: string) => {
    engineRef.current?.teleportToLandmark(x, z, label);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    soundFX.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVirtualControl = (forward: number, turn: number, brake = false) => {
    engineRef.current?.setVirtualInput(forward, turn, brake);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Semantic DOM HUD Overlay & Collapsible Bottom Dock */}
      <ControlOverlay
        hud={hud}
        timeOfDay={timeOfDay}
        weather={weather}
        cameraMode={cameraMode}
        outfit={outfit}
        isMuted={isMuted}
        onToggleEnterExit={handleToggleEnterExit}
        onSpawnVehicle={handleSpawnVehicle}
        onHonkHorn={handleHonkHorn}
        onContextAction={handleContextAction}
        onStartMission={handleStartMission}
        onCancelMission={handleCancelMission}
        onChangeTimeOfDay={handleChangeTimeOfDay}
        onChangeWeather={handleChangeWeather}
        onChangeOutfit={handleChangeOutfit}
        onChangeCamera={handleChangeCamera}
        onClearWanted={handleClearWanted}
        onTeleport={handleTeleport}
        onToggleMute={handleToggleMute}
        onVirtualControl={handleVirtualControl}
      />
    </main>
  );
}
