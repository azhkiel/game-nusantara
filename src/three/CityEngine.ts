import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  HudState,
  InteractableSpot,
  Mission,
  OutfitStyle,
  TimeOfDay,
  VehicleType,
} from '../types/game';
import { soundFX } from '../utils/sound';
import {
  createBengkelCat,
  createGapuraMerahPutih,
  createIndoalfaMinimarket,
  createMasjidNusantara,
  createMonasLandmark,
  createNPCPedestrian,
  createPlayerCharacter,
  createTuguSurabayaLandmark,
  createVehicleMesh,
  createWarungTenda,
} from './models';
import {
  createPavingTrotoarTexture,
  createRoadAsphaltTexture,
  createRukoFacadeTexture,
} from './textures';
import {
  getDistrictName,
  INTERACTABLE_SPOTS,
  MISSIONS,
  VEHICLE_SPECS,
} from './worldData';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3CamTarget = new THREE.Vector3();
const _vec3CamDesired = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _colorTmp = new THREE.Color();

export interface ActiveVehicleInstance {
  id: string;
  type: VehicleType;
  name: string;
  mesh: THREE.Group;
  speed: number;
  heading: number;
  steerAngle: number;
  isAI: boolean;
  aiRouteAxis: 'x' | 'z' | 'loop';
  aiDirection: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
}

export interface ActivePedestrian {
  mesh: THREE.Group;
  heading: number;
  speed: number;
  walkCycle: number;
  boundsMinX: number;
  boundsMaxX: number;
  boundsMinZ: number;
  boundsMaxZ: number;
}

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class CityEngine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public isSoftwareGl: boolean;
  public maxAnisotropy: number;

  private container: HTMLElement;
  private frameId: number = 0;
  private clock: THREE.Clock = new THREE.Clock();
  private isDisposed: boolean = false;

  // Lighting references for Time of Day transitions
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private streetLampBulbs: THREE.MeshStandardMaterial[] = [];

  // Actors & World state
  private playerMesh!: THREE.Group;
  private playerOutfit: OutfitStyle = 'ojol';
  private playerPos = new THREE.Vector3(0, 0, 26);
  private playerHeading = Math.PI; // facing North toward Monas
  private playerVelocityY = 0;
  private playerWalkCycle = 0;
  private playerPunchTimer = 0;

  private vehicles: ActiveVehicleInstance[] = [];
  private drivenVehicle: ActiveVehicleInstance | null = null;
  private pedestrians: ActivePedestrian[] = [];
  private colliders: BuildingCollider[] = [];

  // Mission Marker & GPS Arrow
  private missionBeaconGroup!: THREE.Group;
  private missionBeaconRing!: THREE.Mesh;
  private gpsArrowGroup!: THREE.Group;

  // Game State
  private money = 250000;
  private health = 100;
  private maxHealth = 100;
  private wantedStars = 0;
  private wantedDecayTimer = 0;
  private cameraMode: CameraMode = 'chase';
  private timeOfDay: TimeOfDay = 'siang';

  private activeMission: Mission | null = null;
  private missionStage: 'idle' | 'to_pickup' | 'to_dropoff' = 'idle';
  private missionTimeLeft = 0;
  private completedMissionIds: string[] = [];
  private notification: HudState['notification'] = {
    title: 'Selamat Datang di Kota Raya Nusantara!',
    subtitle: 'Gunakan WASD untuk jalan, tekan F untuk naik Bajaj/Motor Ojol di dekatmu.',
    tone: 'info',
  };
  private notificationTimer = 7.0;

  // Input state
  private keys: Record<string, boolean> = {};
  private virtualInput = { forward: 0, turn: 0, brake: false };
  private cameraOrbitOffset = 0;
  private isPointerDragging = false;
  private lastPointerX = 0;

  private onHudUpdate: (hud: HudState) => void;
  private lastHudBroadcast = 0;

  constructor(container: HTMLElement, onHudUpdate: (hud: HudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // 1. Software-WebGL detection from GPU renderer string
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Modern Renderer & Color Pipeline
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0042);

    this.camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.2,
      360
    );
    this.camera.position.set(0, 8, 36);

    // 4. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 5. Build Lighting, Indonesian City World, Vehicles, Pedestrians, and Player
    this.setupLighting();
    this.buildIndonesianCity();
    this.spawnPlayer();
    this.spawnVehicles();
    this.spawnPedestrians();
    this.setupMissionVisuals();
    this.bindEvents();

    // Pre-warm shaders on hardware GPUs
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.broadcastHud(true);
    this.startLoop();
  }

  private setupLighting() {
    // Warm Directional Key Light (Sun)
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    this.keyLight.position.set(65, 95, 55);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    const d = 95;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 240;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Cool Sky / Warm Ground Hemisphere Fill Light
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3f6212, 0.85);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    // Rim / Backlight
    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-60, 45, -60);
    this.scene.add(this.rimLight);
  }

  private buildIndonesianCity() {
    // 1. Extended Natural Island Ground & Surrounding Coastal Ocean (Zero indoor walls!)
    const oceanGeo = new THREE.PlaneGeometry(900, 900);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.18,
      metalness: 0.35,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.45;
    this.scene.add(ocean);

    const islandGeo = new THREE.CylinderGeometry(155, 165, 0.9, 48);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.88,
      metalness: 0.02,
    });
    const island = new THREE.Mesh(islandGeo, grassMat);
    island.position.y = -0.45;
    island.receiveShadow = true;
    this.scene.add(island);

    // 2. Road Network (Offset on Y >= 0.02 to prevent Z-fighting)
    const roadTex = createRoadAsphaltTexture(this.maxAnisotropy);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.82,
      metalness: 0.08,
    });

    const trotoarTex = createPavingTrotoarTexture(this.maxAnisotropy);
    const trotoarMat = new THREE.MeshStandardMaterial({
      map: trotoarTex,
      roughness: 0.78,
      metalness: 0.05,
    });

    // North-South & East-West Main Avenues (Jalan Protokol Sudirman - Thamrin)
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(14, 176), roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.02;
    nsRoad.receiveShadow = true;
    this.scene.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(176, 14), roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.025;
    ewRoad.receiveShadow = true;
    this.scene.add(ewRoad);

    // Outer Ring Road Loop (at ±48m)
    for (const offset of [-48, 48]) {
      const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(110, 12), roadMat);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.022, offset);
      hRoad.receiveShadow = true;
      this.scene.add(hRoad);

      const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 110), roadMat);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(offset, 0.024, 0);
      vRoad.receiveShadow = true;
      this.scene.add(vRoad);
    }

    // Central Alun-Alun Monas Roundabout Plaza
    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(15, 23, 36),
      new THREE.MeshStandardMaterial({
        color: 0x262930,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.03;
    plazaRing.receiveShadow = true;
    this.scene.add(plazaRing);

    const monasParkPlaza = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15.2, 0.14, 32),
      trotoarMat
    );
    monasParkPlaza.position.y = 0.07;
    monasParkPlaza.receiveShadow = true;
    this.scene.add(monasParkPlaza);

    // Sidewalks (Trotoar) along main roads
    for (const side of [-8.8, 8.8]) {
      const swNS = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 168), trotoarMat);
      swNS.position.set(side, 0.07, 0);
      swNS.receiveShadow = true;
      this.scene.add(swNS);

      const swEW = new THREE.Mesh(new THREE.BoxGeometry(168, 0.14, 3.2), trotoarMat);
      swEW.position.set(0, 0.07, side);
      swEW.receiveShadow = true;
      this.scene.add(swEW);
    }

    // 3. Tugu Monas Landmark in Center (0, 0)
    const monas = createMonasLandmark();
    monas.position.set(0, 0.12, 0);
    this.scene.add(monas);
    this.colliders.push({ minX: -12, maxX: 12, minZ: -12, maxZ: 12 });

    // 3b. Bundaran Tugu Surabaya (Patung Sura & Baya + Tugu Pahlawan) at (48, 0)
    const surabayaRing = new THREE.Mesh(
      new THREE.RingGeometry(10.5, 16.5, 32),
      new THREE.MeshStandardMaterial({
        color: 0x262930,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
    );
    surabayaRing.rotation.x = -Math.PI / 2;
    surabayaRing.position.set(48, 0.032, 0);
    surabayaRing.receiveShadow = true;
    this.scene.add(surabayaRing);

    const surabayaPlaza = new THREE.Mesh(
      new THREE.CylinderGeometry(10.5, 10.7, 0.14, 32),
      trotoarMat
    );
    surabayaPlaza.position.set(48, 0.07, 0);
    surabayaPlaza.receiveShadow = true;
    this.scene.add(surabayaPlaza);

    const tuguSurabaya = createTuguSurabayaLandmark(this.maxAnisotropy);
    tuguSurabaya.position.set(48, 0.12, 0);
    tuguSurabaya.rotation.y = -Math.PI / 2; // Facing West toward Monas & Center Avenue
    this.scene.add(tuguSurabaya);
    this.colliders.push({ minX: 39.5, maxX: 56.5, minZ: -8.5, maxZ: 8.5 });

    // 4. Four Gapura Merah Putih Archways on N/S/E/W Avenues
    const gapuraPositions: [number, number, number][] = [
      [0, 78, 0],
      [0, -78, 0],
      [78, 0, Math.PI / 2],
      [-78, 0, Math.PI / 2],
    ];
    gapuraPositions.forEach(([gx, gz, rotY]) => {
      const gapura = createGapuraMerahPutih();
      gapura.position.set(gx, 0, gz);
      gapura.rotation.y = rotY;
      this.scene.add(gapura);
    });

    // 5. Iconic Interactive Indonesian Locations + Glowing Ground Rings
    // Warung Pecel Lele Cak Har (-30, 26)
    const warungPecel = createWarungTenda(
      'PECEL LELE & SOTO CAK HAR',
      'SAMBAL KOREK PEDAS · ES TEH JUMBO',
      '#fef08a',
      '#15803d',
      this.maxAnisotropy
    );
    warungPecel.position.set(-30, 0, 26);
    warungPecel.rotation.y = Math.PI / 4;
    this.scene.add(warungPecel);
    this.colliders.push({ minX: -33.2, maxX: -26.8, minZ: 23.2, maxZ: 28.8 });

    // Warung Bakso Urat Solo (30, -26)
    const warungBakso = createWarungTenda(
      'BAKSO URAT GRANAT SOLO',
      'MIE AYAM SPESIAL · ES JERUK MURNI',
      '#fed7aa',
      '#b91c1c',
      this.maxAnisotropy
    );
    warungBakso.position.set(30, 0, -26);
    warungBakso.rotation.y = -Math.PI * 0.75;
    this.scene.add(warungBakso);
    this.colliders.push({ minX: 26.8, maxX: 33.2, minZ: -28.8, maxZ: -23.2 });

    // Minimarket Indoalfa (-32, -30)
    const indoalfa = createIndoalfaMinimarket(
      'INDOALFA',
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    indoalfa.position.set(-32, 0, -34);
    this.scene.add(indoalfa);
    this.colliders.push({ minX: -38, maxX: -26, minZ: -38.5, maxZ: -29.5 });

    // Minimarket Alfamaret (-62, 26)
    const alfamaret = createIndoalfaMinimarket(
      'ALFAMARET',
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    alfamaret.position.set(-62, 0, 26);
    alfamaret.rotation.y = Math.PI / 2;
    this.scene.add(alfamaret);
    this.colliders.push({ minX: -66.5, maxX: -57.5, minZ: 20, maxZ: 32 });

    // Bengkel Cat Kilat & Cuci Steam (34, 32)
    const bengkel = createBengkelCat(this.maxAnisotropy);
    bengkel.position.set(34, 0, 32);
    bengkel.rotation.y = -Math.PI / 2;
    this.scene.add(bengkel);

    // Masjid Agung Nusantara (36, -68)
    const masjid = createMasjidNusantara();
    masjid.position.set(36, 0, -68);
    this.scene.add(masjid);
    this.colliders.push({ minX: 29, maxX: 43, minZ: -75, maxZ: -61 });

    // Interactive Spot Floor Markers
    INTERACTABLE_SPOTS.forEach((spot) => {
      const markerColor =
        spot.category === 'bengkel'
          ? 0xf97316
          : spot.category === 'minimarket'
          ? 0x38bdf8
          : 0x22c55e;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.8, 2.3, 24),
        new THREE.MeshBasicMaterial({
          color: markerColor,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(spot.position.x, 0.05, spot.position.z);
      this.scene.add(ring);
    });

    // 6. Ruko Shophouses & Sudirman Glass Office Buildings
    const rukoColors = ['#f1f5f9', '#fef3c7', '#e0f2fe', '#ffedd5', '#f3e8ff'];
    const rukoPlacements: { x: number; z: number; w: number; h: number; d: number; colorIdx: number }[] = [
      { x: -64, z: -24, w: 12, h: 16, d: 12, colorIdx: 0 },
      { x: -64, z: -64, w: 16, h: 28, d: 16, colorIdx: 2 },
      { x: -28, z: -66, w: 18, h: 22, d: 12, colorIdx: 1 },
      { x: 64, z: -26, w: 14, h: 14, d: 14, colorIdx: 3 },
      { x: 64, z: 26, w: 14, h: 18, d: 14, colorIdx: 4 },
      { x: -28, z: 66, w: 20, h: 11, d: 11, colorIdx: 1 },
      { x: 28, z: 66, w: 20, h: 12, d: 11, colorIdx: 0 },
      { x: 64, z: 64, w: 15, h: 15, d: 15, colorIdx: 2 },
      { x: -64, z: 64, w: 15, h: 20, d: 15, colorIdx: 3 },
    ];

    rukoPlacements.forEach((b) => {
      const facadeTex = createRukoFacadeTexture(
        rukoColors[b.colorIdx % rukoColors.length],
        true,
        this.maxAnisotropy
      );
      const bMat = new THREE.MeshStandardMaterial({
        map: facadeTex,
        roughness: 0.45,
        metalness: 0.2,
      });
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.7,
      });

      const bGroup = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bMat);
      body.position.y = b.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      bGroup.add(body);

      const roofCap = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.6, 0.8, b.d + 0.6),
        roofMat
      );
      roofCap.position.y = b.h + 0.4;
      bGroup.add(roofCap);

      bGroup.position.set(b.x, 0, b.z);
      this.scene.add(bGroup);

      this.colliders.push({
        minX: b.x - b.w / 2 - 0.6,
        maxX: b.x + b.w / 2 + 0.6,
        minZ: b.z - b.d / 2 - 0.6,
        maxZ: b.z + b.d / 2 + 0.6,
      });
    });

    // 7. Streetlamps & Indonesian Merah-Putih Flagpoles
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3,
    });
    for (let dist = -68; dist <= 68; dist += 24) {
      if (Math.abs(dist) < 22) continue;
      for (const [lx, lz] of [
        [9.5, dist],
        [-9.5, dist],
        [dist, 9.5],
        [dist, -9.5],
      ]) {
        const lampGroup = new THREE.Group();
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8),
          poleMat
        );
        post.position.y = 2.7;
        lampGroup.add(post);

        const bulbMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfacc15,
          emissiveIntensity: 0.6,
        });
        this.streetLampBulbs.push(bulbMat);

        const lantern = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.22, 0.36),
          bulbMat
        );
        lantern.position.set(0, 5.4, 0);
        lampGroup.add(lantern);

        // Small Merah-Putih Pennant Banner on Lamp Post
        const redFlag = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.45, 0.85),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
        );
        redFlag.position.set(0, 4.1, 0.45);
        lampGroup.add(redFlag);

        const whiteFlag = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.45, 0.85),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
        );
        whiteFlag.position.set(0, 3.65, 0.45);
        lampGroup.add(whiteFlag);

        lampGroup.position.set(lx, 0, lz);
        this.scene.add(lampGroup);
      }
    }

    // 8. Instanced Tropical Trees & Natural Perimeter Hills (InstancedMesh > 120 trees)
    this.buildInstancedTropicalTrees();
  }

  private buildInstancedTropicalTrees() {
    const treeCoords: [number, number][] = [];

    // Park & avenue trees
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      treeCoords.push([Math.cos(angle) * 26, Math.sin(angle) * 26]);
    }

    // Natural perimeter tropical forest ring (bounding the island naturally)
    for (let i = 0; i < 110; i++) {
      const angle = (i / 110) * Math.PI * 2 + (i % 3) * 0.04;
      const radius = 92 + (i % 5) * 10;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      if (Math.abs(tx) < 12 || Math.abs(tz) < 12) continue;
      treeCoords.push([tx, tz]);
    }

    const count = treeCoords.length;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.8, 8);
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.88,
    });

    const crownGeo = new THREE.DodecahedronGeometry(1.95, 1);
    crownGeo.translate(0, 3.6, 0);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
    });

    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crownInstanced = new THREE.InstancedMesh(crownGeo, crownMat, count);
    trunkInstanced.castShadow = true;
    crownInstanced.castShadow = true;
    crownInstanced.receiveShadow = true;

    const palette = [0x15803d, 0x166534, 0x3f6212, 0x14532d];

    treeCoords.forEach(([tx, tz], idx) => {
      const scale = 0.85 + ((idx * 17) % 30) / 100; // ±15% scale variation
      _dummyObj.position.set(tx, 0, tz);
      _dummyObj.rotation.set(0, idx * 1.1, 0);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();

      trunkInstanced.setMatrixAt(idx, _dummyObj.matrix);
      crownInstanced.setMatrixAt(idx, _dummyObj.matrix);

      _colorTmp.setHex(palette[idx % palette.length]);
      crownInstanced.setColorAt(idx, _colorTmp);
    });

    trunkInstanced.instanceMatrix.needsUpdate = true;
    crownInstanced.instanceMatrix.needsUpdate = true;
    if (crownInstanced.instanceColor) crownInstanced.instanceColor.needsUpdate = true;

    trunkInstanced.computeBoundingSphere();
    crownInstanced.computeBoundingSphere();

    this.scene.add(trunkInstanced);
    this.scene.add(crownInstanced);
  }

  private spawnPlayer() {
    if (this.playerMesh) {
      this.scene.remove(this.playerMesh);
    }
    this.playerMesh = createPlayerCharacter(this.playerOutfit, this.maxAnisotropy);
    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = this.playerHeading;
    this.scene.add(this.playerMesh);
  }

  private spawnVehicles() {
    const initialSpawns: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
      isAI: boolean;
      axis: 'x' | 'z' | 'loop';
      dir: number;
    }[] = [
      // Parked right near the player at start so user can hop in immediately!
      { type: 'bajaj', x: -5, z: 22, heading: Math.PI, isAI: false, axis: 'z', dir: -1 },
      { type: 'ojol_motor', x: 5, z: 23, heading: Math.PI, isAI: false, axis: 'z', dir: -1 },
      { type: 'angkot', x: -16, z: 12, heading: Math.PI / 2, isAI: false, axis: 'x', dir: 1 },
      { type: 'bus_telolet', x: 18, z: -12, heading: -Math.PI / 2, isAI: false, axis: 'x', dir: -1 },
      // Active AI Traffic on streets
      { type: 'bajaj', x: 3.5, z: 58, heading: Math.PI, isAI: true, axis: 'z', dir: -1 },
      { type: 'angkot', x: -3.5, z: -55, heading: 0, isAI: true, axis: 'z', dir: 1 },
      { type: 'ojol_motor', x: -55, z: 3.5, heading: Math.PI / 2, isAI: true, axis: 'x', dir: 1 },
      { type: 'bus_telolet', x: 55, z: -3.5, heading: -Math.PI / 2, isAI: true, axis: 'x', dir: -1 },
      { type: 'polisi', x: -48, z: -35, heading: 0, isAI: true, axis: 'loop', dir: 1 },
      { type: 'polisi', x: 48, z: 35, heading: Math.PI, isAI: true, axis: 'loop', dir: -1 },
    ];

    initialSpawns.forEach((cfg, idx) => {
      const spec = VEHICLE_SPECS[cfg.type];
      const mesh = createVehicleMesh(
        cfg.type,
        spec.color,
        spec.plate,
        this.maxAnisotropy,
        this.isSoftwareGl
      );
      mesh.position.set(cfg.x, 0, cfg.z);
      mesh.rotation.y = cfg.heading;
      this.scene.add(mesh);

      this.vehicles.push({
        id: `veh_${idx}`,
        type: cfg.type,
        name: spec.name,
        mesh,
        speed: cfg.isAI ? 9 : 0,
        heading: cfg.heading,
        steerAngle: 0,
        isAI: cfg.isAI,
        aiRouteAxis: cfg.axis,
        aiDirection: cfg.dir,
        maxSpeed: spec.maxSpeed,
        acceleration: spec.acceleration,
        turnSpeed: spec.turnSpeed,
      });
    });
  }

  private spawnPedestrians() {
    const shirtPalette = [0x16a34a, 0xdc2626, 0x2563eb, 0xd97706, 0x9333ea, 0x0891b2];
    const pantsPalette = [0x1e293b, 0x334155, 0x0f172a, 0x422006];

    for (let i = 0; i < 18; i++) {
      const npc = createNPCPedestrian(
        shirtPalette[i % shirtPalette.length],
        pantsPalette[i % pantsPalette.length]
      );
      const alongX = i % 2 === 0;
      const sideOffset = i % 4 < 2 ? 8.8 : -8.8;
      const posAlong = -60 + (i * 13) % 120;

      const x = alongX ? posAlong : sideOffset;
      const z = alongX ? sideOffset : posAlong;
      const heading = alongX ? (i % 3 === 0 ? Math.PI / 2 : -Math.PI / 2) : i % 3 === 0 ? 0 : Math.PI;

      npc.position.set(x, 0, z);
      npc.rotation.y = heading;
      this.scene.add(npc);

      this.pedestrians.push({
        mesh: npc,
        heading,
        speed: 2.2 + (i % 3) * 0.4,
        walkCycle: i * 0.7,
        boundsMinX: alongX ? -70 : sideOffset - 1,
        boundsMaxX: alongX ? 70 : sideOffset + 1,
        boundsMinZ: alongX ? sideOffset - 1 : -70,
        boundsMaxZ: alongX ? sideOffset + 1 : 70,
      });
    }
  }

  private setupMissionVisuals() {
    this.missionBeaconGroup = new THREE.Group();
    this.missionBeaconGroup.visible = false;

    const beamGeo = new THREE.CylinderGeometry(2.1, 2.1, 14, 20, 1, true);
    beamGeo.translate(0, 7, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    this.missionBeaconGroup.add(beam);

    this.missionBeaconRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.14, 12, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    this.missionBeaconRing.rotation.x = Math.PI / 2;
    this.missionBeaconRing.position.y = 0.25;
    this.missionBeaconGroup.add(this.missionBeaconRing);
    this.scene.add(this.missionBeaconGroup);

    // Overhead 3D GPS Directional Arrow
    this.gpsArrowGroup = new THREE.Group();
    this.gpsArrowGroup.visible = false;
    const arrowCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      })
    );
    arrowCone.rotation.x = Math.PI / 2;
    arrowCone.position.z = 0.3;
    this.gpsArrowGroup.add(arrowCone);

    const arrowTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.22, 0.75),
      arrowCone.material
    );
    arrowTail.position.z = -0.35;
    this.gpsArrowGroup.add(arrowTail);
    this.scene.add(this.gpsArrowGroup);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;

    if (e.code === 'KeyF') {
      e.preventDefault();
      this.toggleVehicleEnterExit();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      this.triggerContextAction();
    } else if (e.code === 'KeyG') {
      e.preventDefault();
      this.honkVehicleHorn();
    } else if (e.code === 'KeyC') {
      e.preventDefault();
      const modes: CameraMode[] = ['chase', 'far', 'top'];
      const next = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
      this.setCameraMode(next);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.isPointerDragging = true;
    this.lastPointerX = e.clientX;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isPointerDragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.cameraOrbitOffset -= dx * 0.0065;
  };

  private handlePointerUp = () => {
    this.isPointerDragging = false;
  };

  private handleResize = () => {
    if (this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // Public Interactive APIs for HUD Dock
  public setVirtualInput(forward: number, turn: number, brake = false) {
    this.virtualInput.forward = forward;
    this.virtualInput.turn = turn;
    this.virtualInput.brake = brake;
  }

  public toggleVehicleEnterExit() {
    if (this.drivenVehicle) {
      // Exit current vehicle
      const v = this.drivenVehicle;
      this.drivenVehicle = null;
      v.speed = 0;

      // Place player safely to the left side of the vehicle
      this.playerPos.set(
        v.mesh.position.x + Math.cos(v.heading) * 2.2,
        0,
        v.mesh.position.z - Math.sin(v.heading) * 2.2
      );
      this.playerHeading = v.heading;
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.visible = true;
      soundFX.playInteractChime();
      this.showNotification(
        `Turun dari ${v.name}`,
        'Kamu sekarang berjalan kaki di trotoar.',
        'info'
      );
      this.broadcastHud(true);
      return;
    }

    // Find nearest vehicle within 6.5m
    let nearest: ActiveVehicleInstance | null = null;
    let bestDist = 6.5;
    for (const v of this.vehicles) {
      const dist = Math.hypot(
        v.mesh.position.x - this.playerPos.x,
        v.mesh.position.z - this.playerPos.z
      );
      if (dist < bestDist) {
        bestDist = dist;
        nearest = v;
      }
    }

    if (nearest) {
      const wasAI = nearest.isAI;
      nearest.isAI = false;
      this.drivenVehicle = nearest;
      this.playerMesh.visible = false;
      this.cameraOrbitOffset = 0;
      soundFX.playInteractChime();

      if (wasAI && nearest.type === 'polisi') {
        this.wantedStars = Math.min(5, Math.max(2, this.wantedStars + 2));
        this.wantedDecayTimer = 30;
        this.showNotification(
          'Mobil Patroli Dibajak!',
          'Status Buronan Polisi naik! Pergi ke Bengkel Cat untuk aman.',
          'warning'
        );
      } else {
        this.showNotification(
          `Mengendarai ${nearest.name}`,
          'Tekan G untuk Klakson Telolet, Spasi untuk Rem Tangan, F untuk Turun.',
          'info'
        );
      }
      this.broadcastHud(true);
    } else {
      this.showNotification(
        'Tidak Ada Kendaraan di Dekatmu',
        'Dekati Bajaj, Angkot, atau Motor Ojol atau panggil instan dari Dock Bawah!',
        'warning'
      );
    }
  }

  public spawnAndEnterVehicle(type: VehicleType) {
    const spec = VEHICLE_SPECS[type];
    const currentActorPos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;
    const currentHeading = this.drivenVehicle
      ? this.drivenVehicle.heading
      : this.playerHeading;

    if (this.drivenVehicle) {
      this.drivenVehicle.speed = 0;
      this.drivenVehicle = null;
    }

    const mesh = createVehicleMesh(
      type,
      spec.color,
      spec.plate,
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    mesh.position.set(currentActorPos.x, 0, currentActorPos.z);
    mesh.rotation.y = currentHeading;
    this.scene.add(mesh);

    const newVeh: ActiveVehicleInstance = {
      id: `spawn_${Date.now()}`,
      type,
      name: spec.name,
      mesh,
      speed: 0,
      heading: currentHeading,
      steerAngle: 0,
      isAI: false,
      aiRouteAxis: 'z',
      aiDirection: 1,
      maxSpeed: spec.maxSpeed,
      acceleration: spec.acceleration,
      turnSpeed: spec.turnSpeed,
    };

    this.vehicles.push(newVeh);
    this.drivenVehicle = newVeh;
    this.playerMesh.visible = false;
    this.cameraOrbitOffset = 0;

    soundFX.playTeloletHorn(type === 'bus_telolet' || type === 'angkot');
    this.showNotification(
      `${spec.name} Siap Jalan!`,
      spec.subtitle,
      'success'
    );
    this.broadcastHud(true);
  }

  public honkVehicleHorn() {
    if (this.drivenVehicle) {
      const isTelolet =
        this.drivenVehicle.type === 'bus_telolet' ||
        this.drivenVehicle.type === 'angkot';
      soundFX.playTeloletHorn(isTelolet);
      this.showNotification(
        isTelolet ? 'OM TELOLET OM!' : 'TIN! TIN! Minggir Bang!',
        `Klakson ${this.drivenVehicle.name} dibunyikan.`,
        'info'
      );
    } else {
      soundFX.playTeloletHorn(false);
    }
  }

  public triggerContextAction() {
    const pos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    // Check interactable spots
    for (const spot of INTERACTABLE_SPOTS) {
      const dist = Math.hypot(spot.position.x - pos.x, spot.position.z - pos.z);
      if (dist <= spot.radius) {
        if (this.money < spot.cost) {
          this.showNotification(
            'Saldo Rupiah Kurang!',
            `Butuh Rp ${spot.cost.toLocaleString('id-ID')}. Selesaikan Misi Kota dulu!`,
            'warning'
          );
          return;
        }

        this.money -= spot.cost;
        soundFX.playCashReward();

        if (spot.category === 'bengkel') {
          this.wantedStars = 0;
          this.health = this.maxHealth;
          if (this.drivenVehicle) {
            // Repaint vehicle with a fresh vibrant color
            const freshColors = [0xea580c, 0x0284c7, 0x16a34a, 0xd97706, 0x7c3aed, 0xe11d48];
            const newHex = freshColors[Math.floor(Math.random() * freshColors.length)];
            this.drivenVehicle.mesh.traverse((child) => {
              if (
                child instanceof THREE.Mesh &&
                child.material instanceof THREE.MeshPhysicalMaterial &&
                child.material.clearcoat > 0.5
              ) {
                child.material.color.setHex(newHex);
              }
            });
          }
          this.showNotification(
            'Kendaraan Dicat Ulang & Diservis!',
            'Status Buronan Polisi (Bintang) bersih 100%!',
            'success'
          );
        } else {
          const healAmount = spot.id === 'warung_bakso' ? 100 : 50;
          this.health = Math.min(this.maxHealth, this.health + healAmount);
          this.showNotification(
            `Menikmati Sajian di ${spot.name}`,
            `Darah & Stamina pulih (+${healAmount} HP). Segar kembali!`,
            'success'
          );
        }
        this.broadcastHud(true);
        return;
      }
    }

    // If on foot and not at a spot, perform street punch / action
    if (!this.drivenVehicle) {
      this.playerPunchTimer = 0.4;
      soundFX.playImpactThud();
    }
  }

  public startMission(missionId: string) {
    const found = MISSIONS.find((m) => m.id === missionId);
    if (!found) return;

    this.activeMission = found;
    this.missionStage = 'to_pickup';
    this.missionTimeLeft = found.timeLimitSec;
    soundFX.playInteractChime();

    this.showNotification(
      `Misi Dimulai: ${found.title}`,
      `Menuju titik jemput: ${found.pickupPos.label}`,
      'info'
    );
    this.broadcastHud(true);
  }

  public cancelMission() {
    this.activeMission = null;
    this.missionStage = 'idle';
    this.missionBeaconGroup.visible = false;
    this.gpsArrowGroup.visible = false;
    this.showNotification('Misi Dibatalkan', 'Kamu bebas menjelajahi Kota Raya.', 'info');
    this.broadcastHud(true);
  }

  public setTimeOfDay(time: TimeOfDay) {
    this.timeOfDay = time;
    if (time === 'siang') {
      this.scene.background = new THREE.Color(0x7dd3fc);
      this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0042);
      this.keyLight.color.setHex(0xfffbeb);
      this.keyLight.intensity = 2.2;
      this.keyLight.position.set(65, 95, 55);
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x3f6212);
      this.hemiLight.intensity = 0.85;
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = 0.2));
    } else if (time === 'senja') {
      this.scene.background = new THREE.Color(0xfb923c);
      this.scene.fog = new THREE.FogExp2(0xfb923c, 0.005);
      this.keyLight.color.setHex(0xf97316);
      this.keyLight.intensity = 1.85;
      this.keyLight.position.set(-85, 38, 45);
      this.hemiLight.color.setHex(0xfdba74);
      this.hemiLight.groundColor.setHex(0x431407);
      this.hemiLight.intensity = 0.7;
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = 1.2));
    } else {
      // Malam Pasar Malam
      this.scene.background = new THREE.Color(0x090d16);
      this.scene.fog = new THREE.FogExp2(0x090d16, 0.0055);
      this.keyLight.color.setHex(0x60a5fa);
      this.keyLight.intensity = 0.65;
      this.keyLight.position.set(30, 80, -40);
      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.5;
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = 2.4));
    }
  }

  public setOutfit(outfit: OutfitStyle) {
    this.playerOutfit = outfit;
    const wasHidden = this.playerMesh && !this.playerMesh.visible;
    this.spawnPlayer();
    if (wasHidden) this.playerMesh.visible = false;
    soundFX.playInteractChime();
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.cameraOrbitOffset = 0;
  }

  public clearWantedStars() {
    this.wantedStars = 0;
    this.showNotification(
      'Status Buronan Dihapus',
      'Polisi menghentikan pengejaran terhadapmu.',
      'success'
    );
    this.broadcastHud(true);
  }

  public teleportToLandmark(x: number, z: number, label: string) {
    const targetHeading = label.includes('Surabaya') ? Math.PI / 2 : Math.PI;
    if (this.drivenVehicle) {
      this.drivenVehicle.mesh.position.set(x, 0, z);
      this.drivenVehicle.heading = targetHeading;
      this.drivenVehicle.mesh.rotation.y = targetHeading;
      this.drivenVehicle.speed = 0;
    } else {
      this.playerPos.set(x, 0, z);
      this.playerHeading = targetHeading;
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.y = targetHeading;
    }
    this.cameraOrbitOffset = 0;
    this.showNotification(`Pindah ke ${label}`, 'Tiba di lokasi tujuan.', 'info');
    this.broadcastHud(true);
  }

  private showNotification(
    title: string,
    subtitle: string,
    tone: 'info' | 'success' | 'warning'
  ) {
    this.notification = { title, subtitle, tone };
    this.notificationTimer = 4.5;
  }

  private checkBuildingCollision(x: number, z: number, radius: number): boolean {
    // Keep within island perimeter
    if (Math.hypot(x, z) > 135) return true;
    for (const c of this.colliders) {
      if (
        x + radius > c.minX &&
        x - radius < c.maxX &&
        z + radius > c.minZ &&
        z - radius < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private updatePlayerOnFoot(dt: number) {
    const forwardInput =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) +
      this.virtualInput.forward;
    const turnInput =
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) -
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) +
      this.virtualInput.turn;

    const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const moveSpeed = isSprinting ? 11.5 : 7.2;

    if (Math.abs(turnInput) > 0.05) {
      this.playerHeading += turnInput * 3.0 * dt;
    }

    if (Math.abs(forwardInput) > 0.05) {
      const step = Math.sign(forwardInput) * moveSpeed * dt;
      const nextX = this.playerPos.x + Math.sin(this.playerHeading) * step;
      const nextZ = this.playerPos.z + Math.cos(this.playerHeading) * step;

      if (!this.checkBuildingCollision(nextX, this.playerPos.z, 0.55)) {
        this.playerPos.x = nextX;
      }
      if (!this.checkBuildingCollision(this.playerPos.x, nextZ, 0.55)) {
        this.playerPos.z = nextZ;
      }

      this.playerWalkCycle += dt * (isSprinting ? 14 : 9);
    } else {
      this.playerWalkCycle = 0;
    }

    // Jump physics
    if (this.keys['Space'] && this.playerPos.y <= 0.01) {
      this.playerVelocityY = 6.8;
    }
    if (this.playerPos.y > 0 || this.playerVelocityY !== 0) {
      this.playerPos.y += this.playerVelocityY * dt;
      this.playerVelocityY -= 18.0 * dt;
      if (this.playerPos.y <= 0) {
        this.playerPos.y = 0;
        this.playerVelocityY = 0;
      }
    }

    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.y = this.playerHeading;

    // Animate character limbs
    const limbs = this.playerMesh.userData.limbs;
    if (limbs) {
      const swing = Math.sin(this.playerWalkCycle) * 0.65;
      limbs.leftLeg.rotation.x = swing;
      limbs.rightLeg.rotation.x = -swing;
      limbs.leftArm.rotation.x = -swing * 0.8;

      if (this.playerPunchTimer > 0) {
        this.playerPunchTimer -= dt;
        limbs.rightArm.rotation.x = -Math.PI * 0.55;
      } else {
        limbs.rightArm.rotation.x = swing * 0.8;
      }
    }
  }

  private updateDrivenVehicle(dt: number) {
    const v = this.drivenVehicle;
    if (!v) return;

    const throttle =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) +
      this.virtualInput.forward;
    const steer =
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) -
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) +
      this.virtualInput.turn;
    const handbrake = this.keys['Space'] || this.virtualInput.brake;

    if (Math.abs(throttle) > 0.05) {
      v.speed += throttle * v.acceleration * dt;
    } else {
      // Natural rolling friction
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.2, dt);
    }

    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 7.5, dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, -v.maxSpeed * 0.45, v.maxSpeed);

    // Steering scales with movement
    if (Math.abs(v.speed) > 0.4) {
      const dirSign = v.speed >= 0 ? 1 : -1;
      v.heading += steer * v.turnSpeed * dirSign * dt;
    }

    const nextX = v.mesh.position.x + Math.sin(v.heading) * v.speed * dt;
    const nextZ = v.mesh.position.z + Math.cos(v.heading) * v.speed * dt;

    if (!this.checkBuildingCollision(nextX, nextZ, 1.5)) {
      v.mesh.position.x = nextX;
      v.mesh.position.z = nextZ;
    } else {
      if (Math.abs(v.speed) > 10) {
        soundFX.playImpactThud();
        this.health = Math.max(10, this.health - 4);
      }
      v.speed *= -0.35;
    }

    v.mesh.rotation.y = v.heading;
    // Subtle chassis body roll during cornering
    v.mesh.rotation.z = THREE.MathUtils.damp(
      v.mesh.rotation.z,
      -steer * (Math.abs(v.speed) / v.maxSpeed) * 0.09,
      8,
      dt
    );

    // Spin wheels
    const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
    if (wheels) {
      wheels.forEach((w) => {
        w.rotation.x += v.speed * dt * 1.8;
      });
    }

    // Keep player position synced to vehicle
    this.playerPos.copy(v.mesh.position);
    this.playerHeading = v.heading;

    // Engine audio pulse
    if (Math.abs(v.speed) > 1.2) {
      soundFX.playEnginePulse(v.speed / v.maxSpeed, v.type);
    }
  }

  private updateAITrafficAndPedestrians(dt: number, elapsed: number) {
    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    // Update AI vehicles
    for (const v of this.vehicles) {
      if (v === this.drivenVehicle) continue;

      // Police siren flash when Wanted > 0
      if (v.type === 'polisi' && v.mesh.userData.sirenLights) {
        const { redLight, blueLight } = v.mesh.userData.sirenLights;
        if (this.wantedStars > 0) {
          const flash = Math.sin(elapsed * 16) > 0;
          redLight.material.emissiveIntensity = flash ? 2.5 : 0.2;
          blueLight.material.emissiveIntensity = flash ? 0.2 : 2.5;
        } else {
          redLight.material.emissiveIntensity = 0.4;
          blueLight.material.emissiveIntensity = 0.4;
        }
      }

      if (!v.isAI) continue;

      // If police & player is wanted, steer toward player
      if (v.type === 'polisi' && this.wantedStars > 0) {
        const dx = activePos.x - v.mesh.position.x;
        const dz = activePos.z - v.mesh.position.z;
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - v.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.heading += Math.sign(diff) * Math.min(Math.abs(diff), 1.8 * dt);
        v.speed = 14;
      } else {
        v.speed = 9.5;
        if (v.aiRouteAxis === 'z') {
          if (v.mesh.position.z > 74) {
            v.aiDirection = -1;
            v.heading = Math.PI;
            v.mesh.position.x = 3.5;
          } else if (v.mesh.position.z < -74) {
            v.aiDirection = 1;
            v.heading = 0;
            v.mesh.position.x = -3.5;
          }
        } else if (v.aiRouteAxis === 'x') {
          if (v.mesh.position.x > 74) {
            v.aiDirection = -1;
            v.heading = -Math.PI / 2;
            v.mesh.position.z = -3.5;
          } else if (v.mesh.position.x < -74) {
            v.aiDirection = 1;
            v.heading = Math.PI / 2;
            v.mesh.position.z = 3.5;
          }
        } else {
          // Outer ring loop
          if (v.mesh.position.z > 48 && v.heading === 0) {
            v.heading = Math.PI / 2;
          } else if (v.mesh.position.x > 48 && Math.abs(v.heading - Math.PI / 2) < 0.2) {
            v.heading = Math.PI;
          } else if (v.mesh.position.z < -48 && Math.abs(v.heading - Math.PI) < 0.2) {
            v.heading = -Math.PI / 2;
          } else if (v.mesh.position.x < -48 && Math.abs(v.heading + Math.PI / 2) < 0.2) {
            v.heading = 0;
          }
        }
      }

      const nx = v.mesh.position.x + Math.sin(v.heading) * v.speed * dt;
      const nz = v.mesh.position.z + Math.cos(v.heading) * v.speed * dt;
      if (!this.checkBuildingCollision(nx, nz, 1.4)) {
        v.mesh.position.x = nx;
        v.mesh.position.z = nz;
      } else {
        v.heading += Math.PI * 0.5;
      }
      v.mesh.rotation.y = v.heading;

      // Check collision with driven vehicle
      if (this.drivenVehicle) {
        const distVeh = Math.hypot(
          v.mesh.position.x - this.drivenVehicle.mesh.position.x,
          v.mesh.position.z - this.drivenVehicle.mesh.position.z
        );
        if (distVeh < 2.8 && Math.abs(this.drivenVehicle.speed) > 8) {
          soundFX.playImpactThud();
          this.drivenVehicle.speed *= -0.4;
          if (v.type === 'polisi') {
            this.wantedStars = Math.min(5, Math.max(1, this.wantedStars + 1));
            this.wantedDecayTimer = 25;
            this.showNotification(
              'Menabrak Mobil Patroli!',
              'Polisi mengejarmu! Kunjungi Bengkel Cat untuk hapus bintang.',
              'warning'
            );
          }
        }
      }
    }

    // Update Pedestrians
    for (const p of this.pedestrians) {
      p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
      p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;

      if (
        p.mesh.position.x < p.boundsMinX ||
        p.mesh.position.x > p.boundsMaxX ||
        p.mesh.position.z < p.boundsMinZ ||
        p.mesh.position.z > p.boundsMaxZ
      ) {
        p.heading += Math.PI;
      }
      p.mesh.rotation.y = p.heading;

      p.walkCycle += dt * 7;
      const limbs = p.mesh.userData.limbs;
      if (limbs) {
        const swing = Math.sin(p.walkCycle) * 0.45;
        limbs.leftLeg.rotation.x = swing;
        limbs.rightLeg.rotation.x = -swing;
        limbs.leftArm.rotation.x = -swing * 0.6;
        limbs.rightArm.rotation.x = swing * 0.6;
      }

      // If player hits pedestrian at high speed
      if (this.drivenVehicle && Math.abs(this.drivenVehicle.speed) > 10) {
        const distP = Math.hypot(
          p.mesh.position.x - activePos.x,
          p.mesh.position.z - activePos.z
        );
        if (distP < 1.8) {
          soundFX.playImpactThud();
          p.mesh.position.x += Math.sin(this.drivenVehicle.heading) * 4.5;
          p.mesh.position.z += Math.cos(this.drivenVehicle.heading) * 4.5;
          if (this.wantedStars < 3) {
            this.wantedStars += 1;
            this.wantedDecayTimer = 25;
            this.showNotification(
              'Buronan Polisi! (★)',
              'Warga melapor ke Pos Polisi! Segera menghindar atau ke Bengkel Cat.',
              'warning'
            );
          }
        }
      }
    }
  }

  private updateMissionLogic(dt: number, elapsed: number) {
    if (!this.activeMission || this.missionStage === 'idle') {
      this.missionBeaconGroup.visible = false;
      this.gpsArrowGroup.visible = false;
      return;
    }

    this.missionTimeLeft -= dt;
    if (this.missionTimeLeft <= 0) {
      const failedTitle = this.activeMission.title;
      this.activeMission = null;
      this.missionStage = 'idle';
      this.missionBeaconGroup.visible = false;
      this.gpsArrowGroup.visible = false;
      this.showNotification(
        'Waktu Misi Habis!',
        `${failedTitle} gagal diselesaikan tepat waktu. Coba lagi!`,
        'warning'
      );
      this.broadcastHud(true);
      return;
    }

    const target =
      this.missionStage === 'to_pickup'
        ? this.activeMission.pickupPos
        : this.activeMission.dropoffPos;

    // Position & animate 3D Beacon
    this.missionBeaconGroup.visible = true;
    this.missionBeaconGroup.position.set(target.x, 0, target.z);
    this.missionBeaconRing.position.y = 0.35 + Math.sin(elapsed * 4) * 0.25;

    // Position overhead GPS arrow above player/vehicle
    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;
    this.gpsArrowGroup.visible = true;
    this.gpsArrowGroup.position.set(activePos.x, 3.6, activePos.z);
    const angleToTarget = Math.atan2(
      target.x - activePos.x,
      target.z - activePos.z
    );
    this.gpsArrowGroup.rotation.y = angleToTarget;

    // Check arrival
    const dist = Math.hypot(target.x - activePos.x, target.z - activePos.z);
    if (dist < 4.5) {
      if (this.missionStage === 'to_pickup') {
        this.missionStage = 'to_dropoff';
        soundFX.playInteractChime();
        this.showNotification(
          'Titik Jemput Tercapai!',
          `Sekarang tancap gas menuju: ${this.activeMission.dropoffPos.label}!`,
          'info'
        );
        this.broadcastHud(true);
      } else if (this.missionStage === 'to_dropoff') {
        const reward = this.activeMission.reward;
        const title = this.activeMission.title;
        if (!this.completedMissionIds.includes(this.activeMission.id)) {
          this.completedMissionIds.push(this.activeMission.id);
        }
        this.money += reward;
        this.activeMission = null;
        this.missionStage = 'idle';
        this.missionBeaconGroup.visible = false;
        this.gpsArrowGroup.visible = false;
        soundFX.playCashReward();
        this.showNotification(
          'MISI SUKSES! +Rp ' + reward.toLocaleString('id-ID'),
          `${title} berhasil dituntaskan dengan gemilang!`,
          'success'
        );
        this.broadcastHud(true);
      }
    }
  }

  private updateCamera(dt: number) {
    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;
    const activeHeading =
      (this.drivenVehicle ? this.drivenVehicle.heading : this.playerHeading) +
      this.cameraOrbitOffset;

    if (this.cameraMode === 'top') {
      // Classic GTA Top-Down Angle
      _vec3CamDesired.set(activePos.x, 34, activePos.z + 8);
      _vec3CamTarget.set(activePos.x, 0.8, activePos.z);
    } else {
      const distBack =
        this.cameraMode === 'far'
          ? this.drivenVehicle
            ? 14.5
            : 9.5
          : this.drivenVehicle
          ? 9.2
          : 6.2;
      const heightUp =
        this.cameraMode === 'far'
          ? this.drivenVehicle
            ? 6.2
            : 4.2
          : this.drivenVehicle
          ? 4.0
          : 2.8;

      _vec3CamDesired.set(
        activePos.x - Math.sin(activeHeading) * distBack,
        activePos.y + heightUp,
        activePos.z - Math.cos(activeHeading) * distBack
      );
      _vec3CamTarget.set(
        activePos.x + Math.sin(activeHeading) * 3.2,
        activePos.y + 1.5,
        activePos.z + Math.cos(activeHeading) * 3.2
      );
    }

    // Silky-smooth frame-rate independent exponential damping
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _vec3CamDesired.x,
      7.5,
      dt
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _vec3CamDesired.y,
      7.5,
      dt
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _vec3CamDesired.z,
      7.5,
      dt
    );

    // Dynamic FOV speed cue when accelerating in a vehicle
    const targetFov = this.drivenVehicle
      ? 60 + (Math.abs(this.drivenVehicle.speed) / this.drivenVehicle.maxSpeed) * 12
      : 60;
    const newFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    if (Math.abs(newFov - this.camera.fov) > 0.05) {
      this.camera.fov = newFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(_vec3CamTarget);
  }

  private broadcastHud(force = false) {
    const now = performance.now();
    if (!force && now - this.lastHudBroadcast < 120) return;
    this.lastHudBroadcast = now;

    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    // Check nearby vehicle prompt when on foot
    let nearbyVehiclePrompt: string | null = null;
    if (!this.drivenVehicle) {
      let bestDist = 6.2;
      for (const v of this.vehicles) {
        const d = Math.hypot(
          v.mesh.position.x - activePos.x,
          v.mesh.position.z - activePos.z
        );
        if (d < bestDist) {
          bestDist = d;
          nearbyVehiclePrompt = v.name;
        }
      }
    }

    // Check nearby interactable spot
    let nearbySpot: InteractableSpot | null = null;
    for (const spot of INTERACTABLE_SPOTS) {
      const d = Math.hypot(
        spot.position.x - activePos.x,
        spot.position.z - activePos.z
      );
      if (d <= spot.radius) {
        nearbySpot = spot;
        break;
      }
    }

    const targetCoords =
      this.activeMission && this.missionStage !== 'idle'
        ? this.missionStage === 'to_pickup'
          ? this.activeMission.pickupPos
          : this.activeMission.dropoffPos
        : null;

    this.onHudUpdate({
      money: this.money,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      wantedStars: this.wantedStars,
      districtName: getDistrictName(activePos.x, activePos.z),
      inVehicle: Boolean(this.drivenVehicle),
      currentVehicleName: this.drivenVehicle
        ? this.drivenVehicle.name
        : 'Jalan Kaki',
      currentVehicleType: this.drivenVehicle ? this.drivenVehicle.type : null,
      speedKmh: this.drivenVehicle
        ? Math.round(Math.abs(this.drivenVehicle.speed) * 3.2)
        : 0,
      nearbyVehiclePrompt,
      nearbySpot,
      activeMission: this.activeMission,
      missionStage: this.missionStage,
      missionTimeLeft: Math.ceil(this.missionTimeLeft),
      notification: this.notification,
      playerCoords: {
        x: Math.round(activePos.x),
        z: Math.round(activePos.z),
        heading: this.drivenVehicle
          ? this.drivenVehicle.heading
          : this.playerHeading,
      },
      targetCoords,
      completedMissionIds: this.completedMissionIds,
    });
  }

  private afterDraw = (cb: () => void) => {
    if (this.isDisposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  };

  private tick = () => {
    if (this.isDisposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    if (this.drivenVehicle) {
      this.updateDrivenVehicle(dt);
    } else {
      this.updatePlayerOnFoot(dt);
    }

    this.updateAITrafficAndPedestrians(dt, elapsed);
    this.updateMissionLogic(dt, elapsed);
    this.updateCamera(dt);

    if (this.wantedStars > 0) {
      soundFX.playSirenPulse(this.wantedStars);
      this.wantedDecayTimer -= dt;
      if (this.wantedDecayTimer <= 0) {
        this.wantedStars = Math.max(0, this.wantedStars - 1);
        this.wantedDecayTimer = 22;
      }
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) {
        this.notification = null;
      }
    }

    this.broadcastHud();
    this.renderer.render(this.scene, this.camera);

    // Pace loops properly on Software WebGL vs Hardware GPU
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private startLoop() {
    this.clock.start();
    this.tick();
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
