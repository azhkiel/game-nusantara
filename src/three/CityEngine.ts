import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  HudState,
  InteractableSpot,
  Mission,
  OutfitStyle,
  PedestrianArchetype,
  TimeOfDay,
  VehicleType,
  WeatherType,
} from '../types/game';
import { soundFX } from '../utils/sound';
import {
  createBengkelCat,
  createGapuraMerahPutih,
  createHutanSungaiBlock,
  createIndoalfaMinimarket,
  createIndonesianRumahKampung,
  createKuburanTPU,
  createMasjidNusantara,
  createMonasLandmark,
  createNPCPedestrian,
  createOuterRiverSystem,
  createPasarTradisional,
  createPlayerCharacter,
  createPohonManggaKampung,
  createPohonPisang,
  createPortalGang,
  createPosKamling,
  createPotBungaKampung,
  createRumahGadang,
  createRumahJoglo,
  createRumahKarakterUtama,
  createSekolahNusantara,
  createSittingNPC,
  createTamanKota,
  createTiangListrikKampung,
  createTPSPemilu,
  createTPSSampahKampung,
  createTrafficLightMesh,
  createTuguSurabayaLandmark,
  createVehicleMesh,
  createVendorNPC,
  createWarungKelontongKampung,
  createWarungKopiKampung,
  createWarungMadura,
  createWarungTenda,
  TrafficLightRef,
  VendorType,
} from './models';
import {
  createGangPavingTexture,
  createGentengClayTexture,
  createPavingTrotoarTexture,
  createRoadAsphaltTexture,
  createRoadIntersectionTexture,
  createRukoFacadeTexture,
  createStarSpriteTexture,
} from './textures';
import {
  getDistrictName,
  INTERACTABLE_SPOTS,
  MISSIONS,
  ROAD_GRID_LINES,
  ROAD_WIDTH,
  VEHICLE_SPECS,
} from './worldData';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
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
  waypoints: { x: number; z: number }[];
  waypointIdx: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  stuckTimer?: number;
}

export interface IntersectionTrafficLightSystem {
  id: string;
  center: { x: number; z: number };
  nsLights: TrafficLightRef[];
  ewLights: TrafficLightRef[];
  timer: number;
  cycleDuration: number;
  nsState: 'red' | 'yellow' | 'green';
  ewState: 'red' | 'yellow' | 'green';
}

export interface ActivePedestrian {
  mesh: THREE.Group;
  heading: number;
  speed: number;
  walkCycle: number;
  waypoints: { x: number; z: number }[];
  waypointIdx: number;
  state: 'walking' | 'idle_waving' | 'idle_calling' | 'idle_looking';
  idleTimer: number;
  idleDuration: number;
  walkTimer: number;
  walkDuration: number;
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

  // Lighting & Sky/Weather references
  private keyLight!: THREE.DirectionalLight;
  private keyLightTargetObj: THREE.Object3D = new THREE.Object3D();
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private streetLampBulbs: THREE.MeshStandardMaterial[] = [];
  private streetLampBulbMat!: THREE.MeshStandardMaterial;
  private trafficLightSystems: IntersectionTrafficLightSystem[] = [];
  private roadMaterials: THREE.MeshStandardMaterial[] = [];

  private sunGroup!: THREE.Group;
  private sunCoreMat!: THREE.MeshBasicMaterial;
  private sunHaloMat!: THREE.MeshBasicMaterial;
  private moonGroup!: THREE.Group;
  private starsGroup!: THREE.Group;
  private starsPoints!: THREE.Points;
  private brightStarsPoints!: THREE.Points;
  private milkyWayPoints!: THREE.Points;
  private cloudMat!: THREE.MeshStandardMaterial;
  private cloudGroups: { group: THREE.Group; speed: number }[] = [];
  private rainGroup!: THREE.Group;
  private rainLines!: THREE.LineSegments;
  private rainDropsCount = 1150;
  private rainParticles!: THREE.Points;
  private rainParticleCount = 540;
  private rainSplashes!: THREE.InstancedMesh;
  private rainSplashCount = 96;
  private rainSplashPhases!: Float32Array;
  private rainSplashPositions!: Float32Array;
  private lightningTimer = 14.0;
  private lightningFlash = 0;

  // Actors & World state (Initial spawn inside Player's Personal Safehouse at X: -17.8, Z: 24.0!)
  private playerMesh!: THREE.Group;
  private playerOutfit: OutfitStyle = 'ojol';
  private playerPos = new THREE.Vector3(-17.8, 0.14, 24.0);
  private playerHeading = Math.PI / 2; // facing East (+X) toward the front door & street
  private playerVelocityY = 0;
  private playerWalkCycle = 0;
  private playerPunchTimer = 0;

  // Player Safehouse (Rumah Pribadi Karakter Utama) references & state
  private playerHouseGroup!: THREE.Group;
  private playerHouseRoof!: THREE.Group;
  private playerHouseDoorPivot!: THREE.Group;
  private wasInsideHome = true;
  private playerHomeState: 'standing' | 'sitting' | 'sleeping' | 'eating' = 'standing';
  private homeActionTimer = 0;
  private homeTransition: HudState['homeTransition'] = null;
  private homeTransitionTimer = 0;

  private vehicles: ActiveVehicleInstance[] = [];
  private drivenVehicle: ActiveVehicleInstance | null = null;
  private pedestrians: ActivePedestrian[] = [];
  private vendors: {
    mesh: THREE.Group;
    type: VendorType;
    baseHeading: number;
    armPhase: number;
    greetTimer: number;
  }[] = [];
  private sittingNPCs: THREE.Group[] = [];
  private colliders: BuildingCollider[] = [];

  // Mission Marker & GPS Arrow
  private missionBeaconGroup!: THREE.Group;
  private missionBeaconRing!: THREE.Mesh;
  private gpsArrowGroup!: THREE.Group;

  // Game State (start at 75% health inside Rumah Pribadi so player can test Makan / Tidur / Duduk / Keluar Rumah!)
  private money = 250000;
  private health = 75;
  private maxHealth = 100;
  private wantedStars = 0;
  private wantedDecayTimer = 0;
  private cameraMode: CameraMode = 'chase';
  private timeOfDay: TimeOfDay = 'pagi';
  private clockHour = 8.0; // Starts at 08:00 WIB (Pagi Cerah) and progresses automatically
  private autoTime = true;
  private weather: WeatherType = 'cerah';

  private activeMission: Mission | null = null;
  private missionStage: 'idle' | 'to_pickup' | 'to_dropoff' = 'idle';
  private missionTimeLeft = 0;
  private completedMissionIds: string[] = [];
  private notification: HudState['notification'] = {
    title: 'Selamat Pagi di Rumah Pribadi!',
    subtitle: 'Kamu berada di dalam rumahmu. Silakan Tidur, Makan, Duduk di Sofa, atau melangkah Keluar Rumah menuju jalan raya!',
    tone: 'info',
  };
  private notificationTimer = 8.0;

  // Input state
  private keys: Record<string, boolean> = {};
  private virtualInput = { forward: 0, turn: 0, brake: false, sprint: false };
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
    const isMobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth < 800;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobileDevice ? 1.15 : 1.35)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0028);

    this.camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.2,
      520
    );
    this.camera.position.set(-22.5, 4.8, 24.0);

    // 4. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 5. Build Lighting, Expanded City Grid, Traffic Lights, Sky/Weather, and Actors
    this.setupLighting();
    this.buildIndonesianCity();
    this.buildTrafficLights();
    this.setupSkyAndWeather();
    this.spawnPlayer();
    this.spawnVehicles();
    this.spawnPedestrians();
    this.spawnVendors();
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
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    this.keyLight.position.set(85, 125, 75);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    const d = 65;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 240;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLightTargetObj.position.set(-8.5, 0, 28);
    this.scene.add(this.keyLightTargetObj);
    this.keyLight.target = this.keyLightTargetObj;
    this.scene.add(this.keyLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3f6212, 0.85);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-80, 55, -80);
    this.scene.add(this.rimLight);
  }

  private buildExpandedRoadGrid(trotoarMat: THREE.MeshStandardMaterial) {
    const roadSegTex = createRoadAsphaltTexture(this.maxAnisotropy, 3);
    const roadSegMat = new THREE.MeshStandardMaterial({
      map: roadSegTex,
      roughness: 0.82,
      metalness: 0.08,
    });

    const intersectionTex = createRoadIntersectionTexture(this.maxAnisotropy);
    const intersectionMat = new THREE.MeshStandardMaterial({
      map: intersectionTex,
      roughness: 0.82,
      metalness: 0.08,
    });

    this.roadMaterials.push(roadSegMat, intersectionMat);

    // 1. Place Clean 4-Way Zebra Cross Intersections at ALL 25 Nodes in the 5x5 Road Grid
    for (const gx of ROAD_GRID_LINES) {
      for (const gz of ROAD_GRID_LINES) {
        const interMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH),
          intersectionMat
        );
        interMesh.rotation.x = -Math.PI / 2;
        interMesh.position.set(gx, 0.025, gz);
        interMesh.receiveShadow = true;
        this.scene.add(interMesh);
      }
    }

    // Helper to add a straight road segment between two coordinates with properly oriented lane markings
    const addRoadSegment = (
      axis: 'ns' | 'ew',
      fixedCoord: number,
      startC: number,
      endC: number
    ) => {
      const length = Math.abs(endC - startC);
      if (length <= 1) return;
      const mid = (startC + endC) / 2;
      const geo = new THREE.PlaneGeometry(ROAD_WIDTH, length);
      const mesh = new THREE.Mesh(geo, roadSegMat);
      mesh.rotation.x = -Math.PI / 2;
      if (axis === 'ew') {
        mesh.rotation.z = Math.PI / 2; // Align dashed lane markings East-West
        mesh.position.set(mid, 0.022, fixedCoord);
      } else {
        mesh.position.set(fixedCoord, 0.022, mid);
      }
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    // 2. Connect all North-South Road Segments along x = -120, -60, 0, 60, 120
    for (const gx of ROAD_GRID_LINES) {
      for (let i = 0; i < ROAD_GRID_LINES.length - 1; i++) {
        const z1 = ROAD_GRID_LINES[i];
        const z2 = ROAD_GRID_LINES[i + 1];
        addRoadSegment('ns', gx, z1 + ROAD_WIDTH / 2, z2 - ROAD_WIDTH / 2);
      }
    }

    // 3. Connect all East-West Road Segments along z = -120, -60, 0, 60, 120
    for (const gz of ROAD_GRID_LINES) {
      for (let i = 0; i < ROAD_GRID_LINES.length - 1; i++) {
        const x1 = ROAD_GRID_LINES[i];
        const x2 = ROAD_GRID_LINES[i + 1];
        addRoadSegment('ew', gz, x1 + ROAD_WIDTH / 2, x2 - ROAD_WIDTH / 2);
      }
    }

    // 4. Add 4 Gateway Avenue Spurs extending across the River Bridges (±205m)
    addRoadSegment('ns', 0, 127, 205);
    addRoadSegment('ns', 0, -205, -127);
    addRoadSegment('ew', 0, 127, 205);
    addRoadSegment('ew', 0, -205, -127);

    // 5. Neatly Framed City Block Sidewalks (Trotoar) inside every 46m x 46m block (Optimized InstancedMesh)
    const blockSpan = 46; // 60 - 14 = 46m between road edges
    const swHInstanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(blockSpan, 0.14, 2.2),
      trotoarMat,
      32
    );
    const swVInstanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.2, 0.14, blockSpan - 4.4),
      trotoarMat,
      32
    );
    swHInstanced.receiveShadow = true;
    swVInstanced.receiveShadow = true;

    let hIdx = 0;
    let vIdx = 0;
    for (let xi = 0; xi < ROAD_GRID_LINES.length - 1; xi++) {
      for (let zi = 0; zi < ROAD_GRID_LINES.length - 1; zi++) {
        const cx = (ROAD_GRID_LINES[xi] + ROAD_GRID_LINES[xi + 1]) / 2; // -90, -30, 30, 90
        const cz = (ROAD_GRID_LINES[zi] + ROAD_GRID_LINES[zi + 1]) / 2;

        // North & South sidewalk strips of the block
        for (const sz of [-blockSpan / 2 + 1.1, blockSpan / 2 - 1.1]) {
          _dummyObj.position.set(cx, 0.07, cz + sz);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          swHInstanced.setMatrixAt(hIdx++, _dummyObj.matrix);
        }

        // West & East sidewalk strips of the block
        for (const sx of [-blockSpan / 2 + 1.1, blockSpan / 2 - 1.1]) {
          _dummyObj.position.set(cx + sx, 0.07, cz);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          swVInstanced.setMatrixAt(vIdx++, _dummyObj.matrix);
        }
      }
    }
    swHInstanced.instanceMatrix.needsUpdate = true;
    swVInstanced.instanceMatrix.needsUpdate = true;
    swHInstanced.computeBoundingSphere();
    swVInstanced.computeBoundingSphere();
    this.scene.add(swHInstanced);
    this.scene.add(swVInstanced);
  }

  private buildDedicatedLandmarkPark(
    cx: number,
    cz: number,
    trotoarMat: THREE.MeshStandardMaterial
  ) {
    // Dedicated 41.6m x 41.6m manicured green park lawn inside the 46m x 46m city block
    const parkLawn = new THREE.Mesh(
      new THREE.BoxGeometry(41.6, 0.08, 41.6),
      new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.85,
        metalness: 0.02,
      })
    );
    parkLawn.position.set(cx, 0.04, cz);
    parkLawn.receiveShadow = true;
    this.scene.add(parkLawn);

    // Central Ceremonial Stone Plaza (27m x 27m)
    const centerPlaza = new THREE.Mesh(
      new THREE.BoxGeometry(27, 0.16, 27),
      trotoarMat
    );
    centerPlaza.position.set(cx, 0.08, cz);
    centerPlaza.receiveShadow = true;
    this.scene.add(centerPlaza);

    // 4 Wide Promenade Walkways connecting the central plaza to all 4 block sidewalks
    const walkwayNS = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.15, 41.6),
      trotoarMat
    );
    walkwayNS.position.set(cx, 0.075, cz);
    walkwayNS.receiveShadow = true;
    this.scene.add(walkwayNS);

    const walkwayEW = new THREE.Mesh(
      new THREE.BoxGeometry(41.6, 0.15, 6.4),
      trotoarMat
    );
    walkwayEW.position.set(cx, 0.075, cz);
    walkwayEW.receiveShadow = true;
    this.scene.add(walkwayEW);

    // Ornamental Red-and-Gold Perimeter Park Bollards along the lawn edges (InstancedMesh)
    const bollardBodyMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.5,
      metalness: 0.2,
    });
    const bollardCapMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
      metalness: 0.7,
    });
    const postInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.75, 8),
      bollardBodyMat,
      16
    );
    const capInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      bollardCapMat,
      16
    );

    let bIdx = 0;
    const bollardOffsets = [-17, -11, 11, 17];
    for (const off of bollardOffsets) {
      for (const [bx, bz] of [
        [cx + off, cz - 20.2],
        [cx + off, cz + 20.2],
        [cx - 20.2, cz + off],
        [cx + 20.2, cz + off],
      ]) {
        _dummyObj.position.set(bx, 0.42, bz);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        postInst.setMatrixAt(bIdx, _dummyObj.matrix);

        _dummyObj.position.set(bx, 0.85, bz);
        _dummyObj.updateMatrix();
        capInst.setMatrixAt(bIdx, _dummyObj.matrix);
        bIdx++;
      }
    }
    postInst.instanceMatrix.needsUpdate = true;
    capInst.instanceMatrix.needsUpdate = true;
    postInst.computeBoundingSphere();
    capInst.computeBoundingSphere();
    this.scene.add(postInst);
    this.scene.add(capInst);
  }

  private buildIndonesianCity() {
    // 1. Expanded Natural Island Ground (Radius 295m) & Coastal Ocean
    const oceanGeo = new THREE.PlaneGeometry(2400, 2400);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.18,
      metalness: 0.35,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.45;
    this.scene.add(ocean);

    const islandGeo = new THREE.CylinderGeometry(295, 310, 0.9, 64);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.88,
      metalness: 0.02,
    });
    const island = new THREE.Mesh(islandGeo, grassMat);
    island.position.y = -0.45;
    island.receiveShadow = true;
    this.scene.add(island);

    const trotoarTex = createPavingTrotoarTexture(this.maxAnisotropy);
    const trotoarMat = new THREE.MeshStandardMaterial({
      map: trotoarTex,
      roughness: 0.78,
      metalness: 0.05,
    });

    // 2. Build Expanded & Neatly Aligned 5x5 Boulevard Road Network
    this.buildExpandedRoadGrid(trotoarMat);

    // 3. Dedicated Park Block for Tugu Monas at West District (-90, -30) — Completely Off the Road!
    this.buildDedicatedLandmarkPark(-90, -30, trotoarMat);
    const monas = createMonasLandmark();
    monas.position.set(-90, 0.16, -30);
    this.scene.add(monas);
    this.colliders.push({ minX: -102, maxX: -78, minZ: -42, maxZ: -18 });

    // 4. Dedicated Park Block for Tugu Surabaya at East District (90, 30) — 190m Far Apart & Off the Road!
    this.buildDedicatedLandmarkPark(90, 30, trotoarMat);
    const tuguSurabaya = createTuguSurabayaLandmark(this.maxAnisotropy);
    tuguSurabaya.position.set(90, 0.16, 30);
    tuguSurabaya.rotation.y = Math.PI; // Facing North (-Z) toward the main z = 0 Boulevard entrance at (90, 11)
    this.scene.add(tuguSurabaya);
    this.colliders.push({ minX: 80.5, maxX: 99.5, minZ: 20.5, maxZ: 39.5 });

    // 5. Four Gapura Merah Putih Archways on Outer N/S/E/W Gateways (±132m)
    const gapuraPositions: [number, number, number][] = [
      [0, 132, 0],
      [0, -132, 0],
      [132, 0, Math.PI / 2],
      [-132, 0, Math.PI / 2],
    ];
    gapuraPositions.forEach(([gx, gz, rotY]) => {
      const gapura = createGapuraMerahPutih();
      gapura.position.set(gx, 0, gz);
      gapura.rotation.y = rotY;
      this.scene.add(gapura);
    });

    // 6. Iconic Interactive Indonesian Locations Neatly Aligned to Sidewalks
    // 6A. Rumah Pribadi Karakter Utama (Walk-in 3D Safehouse at X: -18.0, Z: 24.0 facing East toward x=0 Boulevard)
    this.playerHouseGroup = createRumahKarakterUtama(this.maxAnisotropy);
    this.playerHouseGroup.position.set(-18.0, 0, 24.0);
    this.playerHouseGroup.rotation.y = Math.PI / 2; // Front door faces East (+X) toward main street
    this.scene.add(this.playerHouseGroup);
    this.playerHouseRoof = this.playerHouseGroup.userData.roofGroup as THREE.Group;
    this.playerHouseDoorPivot = this.playerHouseGroup.userData.doorPivot as THREE.Group;
    // Start with roof hidden since player spawns inside their house!
    if (this.playerHouseRoof) {
      this.playerHouseRoof.visible = false;
    }
    // Perimeter wall colliders for Rumah Pribadi (leaving a 3.4m wide doorway gap at X = -13.3, Z = 22.3..25.7!)
    this.colliders.push({ minX: -23.2, maxX: -22.3, minZ: 18.4, maxZ: 29.6 }); // West (Back) Wall
    this.colliders.push({ minX: -23.2, maxX: -13.0, minZ: 18.2, maxZ: 19.0 }); // North Wall
    this.colliders.push({ minX: -23.2, maxX: -13.0, minZ: 29.0, maxZ: 29.8 }); // South Wall
    this.colliders.push({ minX: -13.7, maxX: -12.9, minZ: 18.4, maxZ: 22.3 }); // East Front Wall (North Wing)
    this.colliders.push({ minX: -13.7, maxX: -12.9, minZ: 25.7, maxZ: 29.6 }); // East Front Wall (South Wing)

    // Warung Pecel Lele Cak Har (-32, 13.5) facing North toward z = 0 Boulevard
    const warungPecel = createWarungTenda(
      'PECEL LELE & SOTO CAK HAR',
      'SAMBAL KOREK PEDAS · ES TEH JUMBO',
      '#fef08a',
      '#15803d',
      this.maxAnisotropy
    );
    warungPecel.position.set(-32, 0, 13.8);
    warungPecel.rotation.y = Math.PI;
    this.scene.add(warungPecel);
    this.colliders.push({ minX: -35.4, maxX: -28.6, minZ: 11.4, maxZ: 16.2 });

    // Warung Bakso Urat Solo (32, -13.8) facing South toward z = 0 Boulevard
    const warungBakso = createWarungTenda(
      'BAKSO URAT GRANAT SOLO',
      'MIE AYAM SPESIAL · ES JERUK MURNI',
      '#fed7aa',
      '#b91c1c',
      this.maxAnisotropy
    );
    warungBakso.position.set(32, 0, -13.8);
    warungBakso.rotation.y = 0;
    this.scene.add(warungBakso);
    this.colliders.push({ minX: 28.6, maxX: 35.4, minZ: -16.2, maxZ: -11.4 });

    // Minimarket Indoalfa (-16, -34) facing East toward x = 0 Boulevard
    const indoalfa = createIndoalfaMinimarket(
      'INDOALFA',
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    indoalfa.position.set(-16, 0, -34);
    indoalfa.rotation.y = Math.PI / 2;
    this.scene.add(indoalfa);
    this.colliders.push({ minX: -20.5, maxX: -11.5, minZ: -39.8, maxZ: -28.2 });

    // Minimarket Alfamaret (-76, 30) facing East toward x = -60 Avenue
    const alfamaret = createIndoalfaMinimarket(
      'ALFAMARET',
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    alfamaret.position.set(-76, 0, 30);
    alfamaret.rotation.y = Math.PI / 2;
    this.scene.add(alfamaret);
    this.colliders.push({ minX: -80.5, maxX: -71.5, minZ: 24.2, maxZ: 35.8 });

    // Bengkel Cat Kilat & Cuci Steam (16, 36) facing West toward x = 0 Boulevard
    const bengkel = createBengkelCat(this.maxAnisotropy);
    bengkel.position.set(16, 0, 36);
    bengkel.rotation.y = -Math.PI / 2;
    this.scene.add(bengkel);

    // Masjid Agung Nusantara (32, -78) facing South toward z = -60 Avenue
    const masjid = createMasjidNusantara();
    masjid.position.set(32, 0, -78);
    masjid.rotation.y = 0;
    this.scene.add(masjid);
    this.colliders.push({ minX: 25, maxX: 39, minZ: -85, maxZ: -71 });

    // Taman Kota Nusantara (-30, 90) — Full 41.6m x 41.6m Public Park Block with Gazebo, Koi Pond & Playground
    const tamanKota = createTamanKota(this.maxAnisotropy);
    tamanKota.position.set(-30, 0, 90);
    this.scene.add(tamanKota);
    // Colliders for central Gazebo & Koi Pond inside Taman Kota
    this.colliders.push({ minX: -35, maxX: -25, minZ: 85, maxZ: 95 });
    this.colliders.push({ minX: -45.5, maxX: -35.5, minZ: 75.5, maxZ: 85.5 });

    // SMA Negeri 1 Nusantara (30, 90) — Full 41.6m x 41.6m School Campus Block with Flagpole Court & U-Shaped Building
    const sekolah = createSekolahNusantara(this.maxAnisotropy);
    sekolah.position.set(30, 0, 90);
    this.scene.add(sekolah);
    // Colliders for U-shaped school building wings & rear main hall (leaving courtyard & gate open!)
    this.colliders.push({ minX: 13.5, maxX: 46.5, minZ: 95.5, maxZ: 105.5 });
    this.colliders.push({ minX: 12.0, maxX: 19.5, minZ: 79.5, maxZ: 97.0 });
    this.colliders.push({ minX: 40.5, maxX: 48.0, minZ: 79.5, maxZ: 97.0 });

    // Hutan Wisata & Sungai Alami (-90, 90) — Full 41.6m x 41.6m Pine Forest, Winding River, Waterfall Cliff & Wooden Bridge
    const hutanSungai = createHutanSungaiBlock(this.maxAnisotropy);
    hutanSungai.position.set(-90, 0, 90);
    this.scene.add(hutanSungai);
    // Collider for SW Waterfall Cliff & Riverside Warung inside (-90, 90)
    this.colliders.push({ minX: -108.5, maxX: -100.5, minZ: 100.5, maxZ: 108.5 });
    this.colliders.push({ minX: -99.0, maxX: -92.0, minZ: 72.8, maxZ: 77.5 });

    // Outer River Channels (Sungai Kalimas Nusantara along East x=148 & South z=148) + Merah-Putih Highway Bridges & Boats
    const outerRiver = createOuterRiverSystem();
    this.scene.add(outerRiver);

    // Interactive Spot Floor Rings (placed on the sidewalk in front of each venue)
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
      ring.position.set(spot.position.x, 0.1, spot.position.z);
      this.scene.add(ring);
    });

    // 7. Neatly Aligned Ruko Shophouses & Sudirman Office Towers inside City Blocks
    const rukoColors = ['#f1f5f9', '#fef3c7', '#e0f2fe', '#ffedd5', '#f3e8ff'];
    const rukoPlacements: {
      x: number;
      z: number;
      w: number;
      h: number;
      d: number;
      colorIdx: number;
    }[] = [
      // Inner NW Block (-30, -30)
      { x: -36, z: -42, w: 14, h: 20, d: 12, colorIdx: 0 },
      { x: -42, z: -20, w: 12, h: 16, d: 14, colorIdx: 2 },
      // Inner SW Block (-30, 30)
      { x: -42, z: 38, w: 14, h: 15, d: 14, colorIdx: 1 },
      { x: -20, z: 42, w: 14, h: 12, d: 12, colorIdx: 3 },
      // Inner NE Block (30, -30)
      { x: 32, z: -40, w: 16, h: 22, d: 12, colorIdx: 2 },
      // Inner SE Block (30, 30)
      { x: 36, z: 38, w: 15, h: 16, d: 14, colorIdx: 4 },
      // Outer Sudirman Skyscraper District (-90, -90 & -30, -90)
      { x: -90, z: -90, w: 20, h: 34, d: 20, colorIdx: 2 },
      { x: -32, z: -90, w: 20, h: 28, d: 16, colorIdx: 0 },
      { x: -96, z: 42, w: 14, h: 22, d: 14, colorIdx: 1 },
      // East District (90, -30 & 90, -90 & 90, 90) — keeping (90, 30) 100% dedicated to Taman Tugu Surabaya!
      { x: 90, z: -32, w: 16, h: 20, d: 16, colorIdx: 3 },
      { x: 90, z: -90, w: 18, h: 24, d: 18, colorIdx: 2 },
      { x: 90, z: 90, w: 16, h: 16, d: 16, colorIdx: 4 },
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

    // 8. Streetlamps & Merah-Putih Pennants Along Sidewalk Curbs (Optimized InstancedMesh)
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3,
    });
    this.streetLampBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
    });
    this.streetLampBulbs = [this.streetLampBulbMat];

    const redFlagMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const whiteFlagMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

    const lampPositions: [number, number][] = [];
    const lampOffsetsAlongBlock = [-96, -84, -36, -24, 24, 36, 84, 96];
    for (const dist of lampOffsetsAlongBlock) {
      for (const [lx, lz] of [
        [8.4, dist],
        [-8.4, dist],
        [dist, 8.4],
        [dist, -8.4],
        [68.4, dist],
        [-51.6, dist],
      ]) {
        if (Math.hypot(lx - 60, lz) < 20) continue; // Keep clear of Tugu Surabaya roundabout
        lampPositions.push([lx, lz]);
      }
    }

    const lampCount = lampPositions.length;
    const postInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8),
      poleMat,
      lampCount
    );
    const lanternInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.36),
      this.streetLampBulbMat,
      lampCount
    );
    const redFlagInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.45, 0.85),
      redFlagMat,
      lampCount
    );
    const whiteFlagInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.45, 0.85),
      whiteFlagMat,
      lampCount
    );

    lampPositions.forEach(([lx, lz], i) => {
      _dummyObj.position.set(lx, 2.7, lz);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      postInst.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(lx, 5.4, lz);
      _dummyObj.updateMatrix();
      lanternInst.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(lx, 4.1, lz + 0.45);
      _dummyObj.updateMatrix();
      redFlagInst.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(lx, 3.65, lz + 0.45);
      _dummyObj.updateMatrix();
      whiteFlagInst.setMatrixAt(i, _dummyObj.matrix);
    });

    postInst.instanceMatrix.needsUpdate = true;
    lanternInst.instanceMatrix.needsUpdate = true;
    redFlagInst.instanceMatrix.needsUpdate = true;
    whiteFlagInst.instanceMatrix.needsUpdate = true;

    postInst.computeBoundingSphere();
    lanternInst.computeBoundingSphere();
    redFlagInst.computeBoundingSphere();
    whiteFlagInst.computeBoundingSphere();

    this.scene.add(postInst);
    this.scene.add(lanternInst);
    this.scene.add(redFlagInst);
    this.scene.add(whiteFlagInst);

    // 8B. Indonesian Traditional Architectural Kampung & Narrow Alleys (Jalan Kecil / Gang Senggol)
    this.buildIndonesianKampungAndAlleys();

    // 9. Neatly Organized Boulevard & Park Tropical Trees (100% Clear of Roads & Buildings)
    this.buildInstancedTropicalTrees();
  }

  private buildIndonesianKampungAndAlleys() {
    const gangTex = createGangPavingTexture(this.maxAnisotropy);
    const gangMat = new THREE.MeshStandardMaterial({
      map: gangTex,
      roughness: 0.8,
      metalness: 0.05,
    });
    this.roadMaterials.push(gangMat);

    const addGangSegment = (
      axis: 'ns' | 'ew',
      fixedCoord: number,
      startC: number,
      endC: number,
      width = 5.2
    ) => {
      const length = Math.abs(endC - startC);
      if (length <= 1) return;
      const mid = (startC + endC) / 2;
      const geo = new THREE.PlaneGeometry(width, length);
      const mesh = new THREE.Mesh(geo, gangMat);
      mesh.rotation.x = -Math.PI / 2;
      if (axis === 'ew') {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(mid, 0.024, fixedCoord);
      } else {
        mesh.position.set(fixedCoord, 0.024, mid);
      }
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    // =========================================================================
    // 1. WEST DISTRICT: KAMPUNG ADAT BUDAYA & GANG PERMUKIMAN (x: -120 to -175)
    // =========================================================================
    // North-South Main Gang Jalan Kampung (x = -142, from z = -90 to z = 85)
    addGangSegment('ns', -142, -90, 85, 5.2);
    // Entrance paving apron leading from Gang Utama into TPU Kamboja Nusantara gate at z = 77.5
    addGangSegment('ew', 77.5, -149.0, -144.6, 4.2);

    // Connecting East-West Gang Alleys branching cleanly without z-fighting / overlap:
    // West branches: x: -168 to -144.6; East branches: x: -139.4 to -127.0
    const westCrossAlleys = [
      { z: -75, name: 'Gang Joglo RT 05' },
      { z: -30, name: 'Gang Merpati RT 04' },
      { z: 24, name: 'Gang Mawar RT 02' },
      { z: 65, name: 'Gang Melati Barat' },
    ];
    westCrossAlleys.forEach((alley) => {
      addGangSegment('ew', alley.z, -168, -144.6, 5.2);
      addGangSegment('ew', alley.z, -139.4, -127.0, 5.2);
    });

    // Portal Gang Arches at entrances along x = -126.5
    const westPortals = [
      { name: 'Gang Joglo RT 05', z: -75 },
      { name: 'Gang Merpati RT 04', z: -30 },
      { name: 'Gang Mawar RT 02', z: 24 },
      { name: 'Gang Melati Barat', z: 65 },
    ];
    westPortals.forEach((p) => {
      const portal = createPortalGang(p.name);
      portal.position.set(-126.5, 0, p.z);
      portal.rotation.y = Math.PI / 2;
      this.scene.add(portal);
    });

    // a) Rumah Joglo Tradisional (-158, -75) — Nuansa Khas Jawa dengan Pendopo, Soko Guru, & Atap Tajug
    const joglo = createRumahJoglo(this.maxAnisotropy);
    joglo.position.set(-158, 0, -75);
    joglo.rotation.y = Math.PI / 2; // Facing East toward Gang
    this.scene.add(joglo);
    this.colliders.push({ minX: -166, maxX: -150, minZ: -82, maxZ: -68 });

    // b) Rumah Gadang Minangkabau (-158, -50) — Nuansa Khas Sumatera Barat dengan Atap Bagonjong
    const gadang = createRumahGadang();
    gadang.position.set(-158, 0, -50);
    gadang.rotation.y = Math.PI / 2; // Facing East toward Gang
    this.scene.add(gadang);
    this.colliders.push({ minX: -166, maxX: -150, minZ: -58, maxZ: -42 });

    // c) Pos Kamling & Gardu Ronda RT 03 (-149, -36.5) — Located cleanly on the corner hook of Gang Merpati
    const posKamling = createPosKamling(this.maxAnisotropy);
    posKamling.position.set(-149.0, 0, -36.5);
    posKamling.rotation.y = 0; // Facing North toward Gang Merpati & Gang Utama
    this.scene.add(posKamling);
    this.colliders.push({ minX: -153.5, maxX: -145.0, minZ: -40.5, maxZ: -32.5 });

    // d) Toko Kelontong Sembako Bu Tejo (-135, -28.5) — Toko Sembako, Beras, Gas Melon 3kg & Kerupuk Blek
    const tokoSembako = createWarungKelontongKampung(this.maxAnisotropy);
    tokoSembako.position.set(-135.0, 0, -28.5);
    tokoSembako.rotation.y = -Math.PI / 2; // Facing West toward Gang Utama & Gang Merpati
    this.scene.add(tokoSembako);
    this.colliders.push({ minX: -139.0, maxX: -131.0, minZ: -32.5, maxZ: -24.5 });

    // e) Warkop Mbah Darmo (-135, -14.0) — Warung Kopi Tubruk Joss & Gorengan Mendoan Hangat
    const warkopMbahDarmo = createWarungKopiKampung(this.maxAnisotropy);
    warkopMbahDarmo.position.set(-135.0, 0, -14.0);
    warkopMbahDarmo.rotation.y = -Math.PI / 2; // Facing West toward Gang Utama
    this.scene.add(warkopMbahDarmo);
    this.colliders.push({ minX: -138.8, maxX: -131.2, minZ: -17.5, maxZ: -10.5 });

    // f) Toko Kelontong Madura 24 Jam (-150, 28.5) — Buka 24 Jam dengan Pertamini & Gas 3kg
    const warungMadura = createWarungMadura(this.maxAnisotropy, this.isSoftwareGl);
    warungMadura.position.set(-150.0, 0, 28.5);
    warungMadura.rotation.y = Math.PI / 2; // Facing East toward Gang Utama
    this.scene.add(warungMadura);
    this.colliders.push({ minX: -155.5, maxX: -145.0, minZ: 25.0, maxZ: 32.5 });

    // f2) Kuburan / TPU Kamboja Nusantara (-156.5, 77.5) — Tempat Pemakaman Umum Warga, Batu Nisan Kembar, Pohon Kamboja & Kios Bunga Tabur
    const kuburanTPU = createKuburanTPU(this.maxAnisotropy);
    kuburanTPU.position.set(-156.5, 0, 77.5);
    kuburanTPU.rotation.y = Math.PI / 2; // Front gate faces East (+X) toward Gang Utama
    this.scene.add(kuburanTPU);
    // Perimeter fence colliders (leaving the East front gate open so player can walk inside!)
    this.colliders.push({ minX: -164.5, maxX: -163.2, minZ: 68.5, maxZ: 86.5 }); // West back wall
    this.colliders.push({ minX: -164.5, maxX: -149.0, minZ: 68.2, maxZ: 69.2 }); // North wall
    this.colliders.push({ minX: -164.5, maxX: -149.0, minZ: 85.8, maxZ: 86.8 }); // South wall

    // f3) TPS 04 Kampung Nusantara (-134.5, -62.0) — Tempat Pemungutan Suara (Tenda KPPS, Bilik Suara, Kotak Suara Transparan & Tinta Ungu)
    const tpsPemilu = createTPSPemilu(this.maxAnisotropy);
    tpsPemilu.position.set(-134.5, 0, -62.0);
    tpsPemilu.rotation.y = -Math.PI / 2; // Facing West (-X) toward Gang Utama
    this.scene.add(tpsPemilu);
    this.colliders.push({ minX: -138.2, maxX: -130.8, minZ: -66.0, maxZ: -58.0 });

    // f4) TPS Lingkungan & Bank Sampah Warga RT 04 (-149.0, 15.5) — Bak Sampah Beton, Gerobak Sampah RT/RW & Tong Pilah 3 Warna
    const tpsSampahWest = createTPSSampahKampung(this.maxAnisotropy);
    tpsSampahWest.position.set(-149.0, 0, 15.5);
    tpsSampahWest.rotation.y = Math.PI / 2; // Facing East (+X) toward Gang Utama
    this.scene.add(tpsSampahWest);
    this.colliders.push({ minX: -151.6, maxX: -146.5, minZ: 12.2, maxZ: 18.8 });

    // g) Expanded Indonesian Kampung Residential Houses (West Neighborhood)
    const westHouses: { x: number; z: number; color: number; rotY: number }[] = [
      // Along Gang Merpati (z = -30) & West side
      { x: -160, z: -20, color: 0xf97316, rotY: 0 },            // Terracotta orange
      { x: -160, z: -44, color: 0x06b6d4, rotY: Math.PI },      // Cyan blue
      { x: -135, z: -44, color: 0xa855f7, rotY: Math.PI },      // Pastel purple
      // Along Gang Utama (x = -142) East & West sides
      { x: -158, z: -12, color: 0x84cc16, rotY: Math.PI / 2 },  // Lime green
      { x: -158, z: 6, color: 0xfef08a, rotY: Math.PI / 2 },    // Soft cream
      { x: -158, z: 42, color: 0x38bdf8, rotY: Math.PI / 2 },   // Sky blue
      { x: -158, z: 54, color: 0x8b5cf6, rotY: Math.PI / 2 },   // Violet
      { x: -128, z: 42, color: 0xf43f5e, rotY: -Math.PI / 2 },  // Coral red
      { x: -128, z: -12, color: 0x10b981, rotY: -Math.PI / 2 }, // Mint green
      { x: -135, z: 6, color: 0xeab308, rotY: -Math.PI / 2 },   // Mustard yellow
      { x: -135, z: 24, color: 0x14b8a6, rotY: -Math.PI / 2 },  // Teal
      { x: -135, z: 54, color: 0xf43f5e, rotY: -Math.PI / 2 },  // Rose
    ];
    westHouses.forEach((h) => {
      const house = createIndonesianRumahKampung(h.color, this.maxAnisotropy);
      house.position.set(h.x, 0, h.z);
      house.rotation.y = h.rotY;
      this.scene.add(house);
      this.colliders.push({
        minX: h.x - 5.2,
        maxX: h.x + 5.2,
        minZ: h.z - 4.5,
        maxZ: h.z + 4.5,
      });
    });

    // h) Tropical Kampung Plants & Trees (Pohon Pisang, Pohon Mangga Rindang, & Pot Bunga)
    // 1. Pohon Pisang (Banana trees with drooping broad leaves and banana bunch)
    const bananaPlacements: [number, number, number][] = [
      [-153.5, -34.5, 0.2],   // Beside Pos Kamling
      [-130.5, -24.0, -0.4],  // Beside Toko Sembako Bu Tejo
      [-164.0, -14.0, 0.8],   // Backyard of house
      [-154.0, 33.5, 1.2],    // Beside Toko Madura
      [-146.5, -22.5, -0.6],  // Corner of Gang Merpati
      [-164.0, -70.0, 0.0],   // Near Rumah Joglo
      [-131.0, 14.0, 0.5],    // East neighborhood yard
    ];
    bananaPlacements.forEach(([bx, bz, rot]) => {
      const pisang = createPohonPisang();
      pisang.position.set(bx, 0, bz);
      pisang.rotation.y = rot;
      this.scene.add(pisang);
    });

    // 2. Pohon Mangga Kampung (Shady mango trees with deep green canopy)
    const manggaPlacements: [number, number, number][] = [
      [-154.5, -42.0, 0.5],   // Shading Pos Kamling courtyard
      [-149.0, -66.0, 1.1],   // In front of Rumah Joglo
      [-130.5, -8.5, -0.8],   // Shading Warkop Mbah Darmo
      [-153.5, 60.0, 0.2],    // Corner of Gang Melati Barat
    ];
    manggaPlacements.forEach(([mx, mz, rot]) => {
      const mangga = createPohonManggaKampung();
      mangga.position.set(mx, 0, mz);
      mangga.rotation.y = rot;
      this.scene.add(mangga);
      this.colliders.push({ minX: mx - 1.8, maxX: mx + 1.8, minZ: mz - 1.8, maxZ: mz + 1.8 });
    });

    // 3. Potted Plants along gang sidewalks & storefronts (Bougainvillea ember cat, Lidah Mertua gerabah, Caladium)
    const potConfigs: { x: number; z: number; variant: 'ember_cat' | 'gerabah' | 'caladium' }[] = [
      // Pos Kamling courtyard & steps
      { x: -145.8, z: -35.0, variant: 'ember_cat' },
      { x: -145.8, z: -38.0, variant: 'gerabah' },
      { x: -152.0, z: -35.0, variant: 'caladium' },
      // Toko Sembako Bu Tejo storefront
      { x: -138.8, z: -26.5, variant: 'ember_cat' },
      { x: -138.8, z: -30.5, variant: 'gerabah' },
      // Warkop Mbah Darmo
      { x: -138.8, z: -12.0, variant: 'caladium' },
      { x: -138.8, z: -16.0, variant: 'ember_cat' },
      // Gang Merpati roadside
      { x: -152.0, z: -32.8, variant: 'gerabah' },
      { x: -162.0, z: -32.8, variant: 'ember_cat' },
      { x: -135.0, z: -32.8, variant: 'caladium' },
      // Toko Madura front
      { x: -145.8, z: 25.5, variant: 'ember_cat' },
      { x: -145.8, z: 31.5, variant: 'gerabah' },
    ];
    potConfigs.forEach((pc) => {
      const pot = createPotBungaKampung(pc.variant);
      pot.position.set(pc.x, 0, pc.z);
      this.scene.add(pot);
    });

    // Concrete Utility Poles with Transformers & Convex Mirror along West Alley
    for (const pz of [-65, -18, 12, 48]) {
      const pole = createTiangListrikKampung();
      pole.position.set(-145.2, 0, pz);
      this.scene.add(pole);
    }

    // =========================================================================
    // 2. EAST DISTRICT: KAWASAN PASAR TRADISIONAL & PERMUKIMAN WARGA (x: 120 to 175)
    // =========================================================================
    // North-South Main Gang Jalan Pasar & Kampung (x = 142, from z = -80 to z = 75)
    addGangSegment('ns', 142, -80, 75, 5.4);

    // Connecting East-West Gang Alleys branching cleanly without z-fighting:
    const eastCrossAlleys = [
      { z: -25, name: 'Gang Pasar Rakyat' },
      { z: 30, name: 'Gang Melati RT 01' },
      { z: 65, name: 'Gang Kenanga' },
    ];
    eastCrossAlleys.forEach((alley) => {
      addGangSegment('ew', alley.z, 127.0, 139.3, 5.4);
      addGangSegment('ew', alley.z, 144.7, 168.0, 5.4);
    });

    // Portals for East District
    const eastPortals = [
      { name: 'Gang Pasar Rakyat', z: -25 },
      { name: 'Gang Melati RT 01', z: 30 },
      { name: 'Gang Kenanga', z: 65 },
    ];
    eastPortals.forEach((p) => {
      const portal = createPortalGang(p.name);
      portal.position.set(126.5, 0, p.z);
      portal.rotation.y = -Math.PI / 2;
      this.scene.add(portal);
    });

    // a) Pasar Tradisional Rakyat (142, -50) — Los Pasar Khas Indonesia dengan Terpal Warna-Warni & Gerobak Buah
    const pasar = createPasarTradisional(this.maxAnisotropy);
    pasar.position.set(142, 0, -50);
    pasar.rotation.y = 0; // Facing South toward Gang Pasar
    this.scene.add(pasar);
    this.colliders.push({ minX: 127.5, maxX: 156.5, minZ: -60, maxZ: -38 });

    // b) Warung Kopi Joss & Es Kelapa Muda (130, -18)
    const warungKopi = createWarungTenda(
      'WARUNG KOPI & ES KELAPA MUDA',
      'KOPI JOSS ARANG · GORENGAN HANGAT',
      '#fef08a',
      '#ea580c',
      this.maxAnisotropy
    );
    warungKopi.position.set(130, 0, -18);
    warungKopi.rotation.y = 0;
    this.scene.add(warungKopi);
    this.colliders.push({ minX: 126, maxX: 134, minZ: -21, maxZ: -15 });

    // b2) TPS Lingkungan & Bank Sampah Pasar Rakyat (149.5, -14.0)
    const tpsSampahEast = createTPSSampahKampung(this.maxAnisotropy);
    tpsSampahEast.position.set(149.5, 0, -14.0);
    tpsSampahEast.rotation.y = -Math.PI / 2; // Facing West toward Gang Pasar
    this.scene.add(tpsSampahEast);
    this.colliders.push({ minX: 147.0, maxX: 152.2, minZ: -17.3, maxZ: -10.7 });

    // c) Indonesian Kampung Residential Houses (East)
    const eastHouses: { x: number; z: number; color: number; rotY: number }[] = [
      { x: 156, z: 10, color: 0xf59e0b, rotY: -Math.PI / 2 }, // Warm ochre
      { x: 156, z: 30, color: 0xa855f7, rotY: -Math.PI / 2 }, // Pastel purple
      { x: 156, z: 52, color: 0x06b6d4, rotY: -Math.PI / 2 }, // Turquoise
      { x: 128, z: 52, color: 0xfed7aa, rotY: Math.PI / 2 },  // Cream peach
    ];
    eastHouses.forEach((h) => {
      const house = createIndonesianRumahKampung(h.color, this.maxAnisotropy);
      house.position.set(h.x, 0, h.z);
      house.rotation.y = h.rotY;
      this.scene.add(house);
      this.colliders.push({
        minX: h.x - 5.2,
        maxX: h.x + 5.2,
        minZ: h.z - 4.5,
        maxZ: h.z + 4.5,
      });
    });

    // Utility Poles along East Alley
    for (const pz of [-15, 15, 48]) {
      const pole = createTiangListrikKampung();
      pole.position.set(145.2, 0, pz);
      this.scene.add(pole);
    }
  }

  private buildTrafficLights() {
    const intersections = [
      { id: 'center', x: 0, z: 0, offsetTimer: 0 },
      { id: 'west', x: -60, z: 0, offsetTimer: 5.5 },
      { id: 'east', x: 60, z: 0, offsetTimer: 5.5 },
      { id: 'south', x: 0, z: 60, offsetTimer: 11.0 },
      { id: 'north', x: 0, z: -60, offsetTimer: 11.0 },
    ];

    intersections.forEach((inter) => {
      const cx = inter.x;
      const cz = inter.z;
      const offset = 7.8;

      // South-West corner: arm points East across Northbound lane, facing South toward approaching Northbound traffic
      const swLight = createTrafficLightMesh();
      swLight.group.position.set(cx - offset, 0, cz + offset);
      swLight.group.rotation.y = 0;
      this.scene.add(swLight.group);

      // North-East corner: arm points West across Southbound lane, facing North toward approaching Southbound traffic
      const neLight = createTrafficLightMesh();
      neLight.group.position.set(cx + offset, 0, cz - offset);
      neLight.group.rotation.y = Math.PI;
      this.scene.add(neLight.group);

      // South-East corner: arm points North across Westbound lane, facing East toward approaching Westbound traffic
      const seLight = createTrafficLightMesh();
      seLight.group.position.set(cx + offset, 0, cz + offset);
      seLight.group.rotation.y = Math.PI / 2;
      this.scene.add(seLight.group);

      // North-West corner: arm points South across Eastbound lane, facing West toward approaching Eastbound traffic
      const nwLight = createTrafficLightMesh();
      nwLight.group.position.set(cx - offset, 0, cz - offset);
      nwLight.group.rotation.y = -Math.PI / 2;
      this.scene.add(nwLight.group);

      this.trafficLightSystems.push({
        id: inter.id,
        center: { x: cx, z: cz },
        nsLights: [swLight, neLight],
        ewLights: [seLight, nwLight],
        timer: inter.offsetTimer,
        cycleDuration: 26.0,
        nsState: 'green',
        ewState: 'red',
      });
    });
  }

  private updateTrafficLights(dt: number) {
    for (const inter of this.trafficLightSystems) {
      inter.timer = (inter.timer + dt) % inter.cycleDuration;
      let nsState: 'red' | 'yellow' | 'green';
      let ewState: 'red' | 'yellow' | 'green';

      if (inter.timer < 9.5) {
        nsState = 'green';
        ewState = 'red';
      } else if (inter.timer < 12.0) {
        nsState = 'yellow';
        ewState = 'red';
      } else if (inter.timer < 13.0) {
        nsState = 'red';
        ewState = 'red';
      } else if (inter.timer < 22.5) {
        nsState = 'red';
        ewState = 'green';
      } else if (inter.timer < 25.0) {
        nsState = 'red';
        ewState = 'yellow';
      } else {
        nsState = 'red';
        ewState = 'red';
      }

      if (inter.nsState !== nsState) {
        inter.nsState = nsState;
        for (const l of inter.nsLights) {
          l.setState(nsState);
        }
      }
      if (inter.ewState !== ewState) {
        inter.ewState = ewState;
        for (const l of inter.ewLights) {
          l.setState(ewState);
        }
      }
    }
  }

  private isPositionClearForTree(x: number, z: number): boolean {
    // 1. Never place a tree on or near any road in ROAD_GRID_LINES
    for (const r of ROAD_GRID_LINES) {
      if (Math.abs(x - r) < 8.8 || Math.abs(z - r) < 8.8) return false;
    }
    // 2. Keep clear of the central plazas and walkways of Taman Monas (-90, -30), Taman Tugu Surabaya (90, 30), Taman Kota (-30, 90), Sekolah (30, 90), & Hutan Sungai (-90, 90)
    if (Math.abs(x - -90) < 15.5 && Math.abs(z - -30) < 15.5) return false;
    if (Math.abs(x - 90) < 15.5 && Math.abs(z - 30) < 15.5) return false;
    if (Math.abs(x - -30) < 16.5 && Math.abs(z - 90) < 16.5) return false;
    if (Math.abs(x - 30) < 19.5 && Math.abs(z - 90) < 19.5) return false;
    if (Math.abs(x - -90) < 20.5 && Math.abs(z - 90) < 20.5) return false;
    if (Math.abs(x - -90) < 5.2 && Math.abs(z - -30) < 22) return false;
    if (Math.abs(z - -30) < 5.2 && Math.abs(x - -90) < 22) return false;
    if (Math.abs(x - 90) < 5.2 && Math.abs(z - 30) < 22) return false;
    if (Math.abs(z - 30) < 5.2 && Math.abs(x - 90) < 22) return false;
    if (Math.abs(x - -30) < 4.5 && Math.abs(z - 90) < 22) return false;

    // 3. Keep clear of the narrow gang alleys
    if (Math.abs(x - -142) < 4.5 && z > -95 && z < 75) return false;
    if (Math.abs(x - 142) < 4.5 && z > -85 && z < 80) return false;
    if (Math.abs(z - -75) < 4.5 && x < -118 && x > -170) return false;
    if (Math.abs(z - -30) < 4.5 && x < -118 && x > -170) return false;
    if (Math.abs(z - 24) < 4.5 && x < -118 && x > -170) return false;
    if (Math.abs(z - 65) < 4.5 && x < -118 && x > -170) return false;
    if (Math.abs(z - -25) < 4.5 && x > 118 && x < 170) return false;
    if (Math.abs(z - 30) < 4.5 && x > 118 && x < 170) return false;
    if (Math.abs(z - 65) < 4.5 && x > 118 && x < 170) return false;

    // 4. Keep clear of all building colliders & interactive spots
    for (const c of this.colliders) {
      if (
        x > c.minX - 2.5 &&
        x < c.maxX + 2.5 &&
        z > c.minZ - 2.5 &&
        z < c.maxZ + 2.5
      ) {
        return false;
      }
    }
    for (const spot of INTERACTABLE_SPOTS) {
      if (Math.hypot(x - spot.position.x, z - spot.position.z) < 6.5) {
        return false;
      }
    }
    return true;
  }

  private buildInstancedTropicalTrees() {
    const treeCoords: [number, number][] = [];

    // 0. Symmetrical Corner Park Trees inside Lahan Taman Tugu Monas (-90, -30), Taman Tugu Surabaya (90, 30), & Taman Kota (-30, 90)
    for (const [px, pz] of [
      [-90, -30],
      [90, 30],
      [-30, 90],
    ]) {
      for (const dx of [-17.5, 17.5]) {
        for (const dz of [-17.5, 17.5]) {
          treeCoords.push([px + dx, pz + dz]);
        }
      }
    }

    // 1. Neat Boulevard Rows along the outer sidewalk edges (±9.6m from road centers)
    const boulevardOffsets = [-102, -90, -78, -42, -30, 30, 42, 78, 90, 102];
    for (const r of [-60, 0, 60]) {
      for (const along of boulevardOffsets) {
        for (const side of [-9.6, 9.6]) {
          const tx1 = r + side;
          const tz1 = along;
          if (this.isPositionClearForTree(tx1, tz1)) {
            treeCoords.push([tx1, tz1]);
          }

          const tx2 = along;
          const tz2 = r + side;
          if (this.isPositionClearForTree(tx2, tz2)) {
            treeCoords.push([tx2, tz2]);
          }
        }
      }
    }

    // 2. Dense Outer Riverbank & Coastal Forest Belt (Hutan Lindung Lembah Sungai, Radius 232m..282m)
    for (let i = 0; i < 210; i++) {
      const angle = (i / 210) * Math.PI * 2;
      const radius = 232 + (i % 5) * 10;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      // Leave avenue gateway corridors & river channels open
      if (Math.abs(tx) < 14 || Math.abs(tz) < 14) continue;
      if (Math.abs(tx - 188) < 14 || Math.abs(tz - 188) < 14) continue;
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
      const scale = 0.88 + ((idx * 13) % 24) / 100;
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

  private setupSkyAndWeather() {
    // 1. 3D MATAHARI (Sun with glowing core & corona halo)
    this.sunGroup = new THREE.Group();
    this.sunCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      fog: false,
    });
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 24, 24),
      this.sunCoreMat
    );
    this.sunGroup.add(sunCore);

    this.sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      fog: false,
    });
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(13.5, 24, 24),
      this.sunHaloMat
    );
    this.sunGroup.add(sunHalo);

    const sunOuterGlow = new THREE.Mesh(
      new THREE.SphereGeometry(18.5, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        fog: false,
      })
    );
    this.sunGroup.add(sunOuterGlow);
    this.sunGroup.position.set(48, 68, -155);
    this.scene.add(this.sunGroup);

    // 2. 3D BULAN (Cratered Moon with pale nocturnal halo) & BINTANG (Starfield)
    this.moonGroup = new THREE.Group();
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 256;
    moonCanvas.height = 256;
    const mCtx = moonCanvas.getContext('2d')!;
    mCtx.fillStyle = '#f1f5f9';
    mCtx.fillRect(0, 0, 256, 256);
    const craters = [
      [70, 80, 26],
      [160, 65, 18],
      [120, 150, 32],
      [195, 175, 22],
      [55, 185, 16],
    ];
    craters.forEach(([cx, cy, cr]) => {
      mCtx.fillStyle = '#cbd5e1';
      mCtx.beginPath();
      mCtx.arc(cx, cy, cr, 0, Math.PI * 2);
      mCtx.fill();
    });
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.colorSpace = THREE.SRGBColorSpace;

    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 24, 24),
      new THREE.MeshBasicMaterial({
        map: moonTex,
        color: 0xf8fafc,
        fog: false,
      })
    );
    this.moonGroup.add(moonCore);

    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(11.8, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        fog: false,
      })
    );
    this.moonGroup.add(moonHalo);
    this.moonGroup.position.set(-48, 64, -150);
    this.moonGroup.visible = false;
    this.scene.add(this.moonGroup);

    // 2B. LANGIT MALAM BERBINTANG (Multi-Layer Celestial Starfield, Constellations & Milky Way)
    this.starsGroup = new THREE.Group();
    this.starsGroup.visible = false;

    const starSpriteTex = createStarSpriteTexture();

    // Layer 1: Distant Twinkling Starfield (1,450 multi-colored stars across dome)
    const starCount = 1450;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starPalette = [
      new THREE.Color(0xffffff), // Bright white
      new THREE.Color(0xdbeafe), // Diamond blue
      new THREE.Color(0xfef08a), // Warm golden
      new THREE.Color(0xe0e7ff), // Soft indigo
      new THREE.Color(0xfbcfe8), // Soft nebula pink
    ];

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44; // Hemispherical canopy
      const r = 245 + Math.random() * 25;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.max(20, r * Math.cos(phi));
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const col = starPalette[Math.floor(Math.random() * starPalette.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    this.starsPoints = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        map: starSpriteTex,
        vertexColors: true,
        size: 3.2,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.starsGroup.add(this.starsPoints);

    // Layer 2: Major Bright Constellation & Navigational Stars (Bintang Kejora / Pari)
    const brightCount = 125;
    const brightPositions = new Float32Array(brightCount * 3);
    for (let i = 0; i < brightCount; i++) {
      const theta = (i / brightCount) * Math.PI * 2 + Math.sin(i * 2.8) * 0.4;
      const phi = 0.08 + Math.random() * Math.PI * 0.36;
      const r = 240;
      brightPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      brightPositions[i * 3 + 1] = Math.max(28, r * Math.cos(phi));
      brightPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const brightGeo = new THREE.BufferGeometry();
    brightGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(brightPositions, 3)
    );
    this.brightStarsPoints = new THREE.Points(
      brightGeo,
      new THREE.PointsMaterial({
        map: starSpriteTex,
        color: 0xfffbeb,
        size: 6.2,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.starsGroup.add(this.brightStarsPoints);

    // Layer 3: Galactic Milky Way Arch (Kabut Bima Sakti)
    const mwCount = 280;
    const mwPositions = new Float32Array(mwCount * 3);
    for (let i = 0; i < mwCount; i++) {
      const t = (i / mwCount) * Math.PI - Math.PI / 2;
      const spread = (Math.random() - 0.5) * 36;
      const r = 236;
      mwPositions[i * 3] = Math.sin(t) * r + spread;
      mwPositions[i * 3 + 1] = Math.max(24, Math.cos(t) * r * 0.88 + (Math.random() - 0.5) * 16);
      mwPositions[i * 3 + 2] = t * 65 + (Math.random() - 0.5) * 28;
    }
    const mwGeo = new THREE.BufferGeometry();
    mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPositions, 3));
    this.milkyWayPoints = new THREE.Points(
      mwGeo,
      new THREE.PointsMaterial({
        map: starSpriteTex,
        color: 0x38bdf8,
        size: 9.5,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    this.starsGroup.add(this.milkyWayPoints);

    this.scene.add(this.starsGroup);

    // 3. 3D AWAN (26 Volumetric Multi-Part Drifting Clouds across Expanded Sky)
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
    });
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);

    for (let i = 0; i < 26; i++) {
      const cGroup = new THREE.Group();
      const puffLayouts: [number, number, number, number][] = [
        [0, 0, 0, 3.8],
        [-3.2, -0.4, 0.5, 2.8],
        [3.3, -0.3, -0.4, 3.0],
        [-1.5, 1.1, -1.1, 2.6],
        [1.8, 0.9, 1.2, 2.5],
      ];
      puffLayouts.forEach(([px, py, pz, pScale]) => {
        const puff = new THREE.Mesh(puffGeo, this.cloudMat);
        puff.position.set(px, py, pz);
        puff.scale.set(pScale * 1.35, pScale * 0.72, pScale);
        cGroup.add(puff);
      });

      const cx = -180 + ((i * 43) % 360);
      const cy = 32 + (i % 5) * 4.5;
      const cz = -170 + ((i * 61) % 340);
      const overallScale = 0.9 + (i % 4) * 0.28;
      cGroup.position.set(cx, cy, cz);
      cGroup.scale.setScalar(overallScale);
      cGroup.rotation.y = (i % 6) * 0.5;
      this.scene.add(cGroup);

      this.cloudGroups.push({
        group: cGroup,
        speed: 1.8 + (i % 4) * 0.65,
      });
    }

    // 4. 3D CUACA HUJAN (Multi-Layer Three.js Particle System: Falling Rain Streaks + Volumetric Mist Droplets + Ground Splash Ripples)
    this.rainGroup = new THREE.Group();
    this.rainGroup.visible = false;

    // Layer 4A: High-velocity wind-slanted rain streaks (THREE.LineSegments)
    const rainVerts = new Float32Array(this.rainDropsCount * 6);
    for (let i = 0; i < this.rainDropsCount; i++) {
      const rx = (Math.random() - 0.5) * 76;
      const ry = Math.random() * 36;
      const rz = (Math.random() - 0.5) * 76;
      rainVerts[i * 6] = rx;
      rainVerts[i * 6 + 1] = ry;
      rainVerts[i * 6 + 2] = rz;
      rainVerts[i * 6 + 3] = rx - 0.34;
      rainVerts[i * 6 + 4] = ry - 1.85;
      rainVerts[i * 6 + 5] = rz - 0.18;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainVerts, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.68,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.frustumCulled = false;
    this.rainGroup.add(this.rainLines);

    // Layer 4B: Volumetric Three.js Rain Droplet & Mist Particles (THREE.Points with soft radial CanvasTexture)
    const dropCanvas = document.createElement('canvas');
    dropCanvas.width = 64;
    dropCanvas.height = 64;
    const dCtx = dropCanvas.getContext('2d')!;
    const grad = dCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
    grad.addColorStop(0.45, 'rgba(186, 230, 253, 0.55)');
    grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, 64, 64);
    const dropTex = new THREE.CanvasTexture(dropCanvas);
    dropTex.colorSpace = THREE.SRGBColorSpace;

    const particlePositions = new Float32Array(this.rainParticleCount * 3);
    for (let i = 0; i < this.rainParticleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 68;
      particlePositions[i * 3 + 1] = Math.random() * 28;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 68;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    const particleMat = new THREE.PointsMaterial({
      map: dropTex,
      color: 0xe0f2fe,
      size: 0.65,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rainParticles = new THREE.Points(particleGeo, particleMat);
    this.rainParticles.frustumCulled = false;
    this.rainGroup.add(this.rainParticles);

    // Layer 4C: Ground Rain Splash Ripples (THREE.InstancedMesh on wet asphalt y = 0.05)
    const splashGeo = new THREE.RingGeometry(0.08, 0.24, 12);
    splashGeo.rotateX(-Math.PI / 2);
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rainSplashes = new THREE.InstancedMesh(
      splashGeo,
      splashMat,
      this.rainSplashCount
    );
    this.rainSplashes.frustumCulled = false;
    this.rainSplashPhases = new Float32Array(this.rainSplashCount);
    this.rainSplashPositions = new Float32Array(this.rainSplashCount * 2);

    for (let i = 0; i < this.rainSplashCount; i++) {
      this.rainSplashPhases[i] = Math.random();
      const sx = (Math.random() - 0.5) * 48;
      const sz = (Math.random() - 0.5) * 48;
      this.rainSplashPositions[i * 2] = sx;
      this.rainSplashPositions[i * 2 + 1] = sz;
      _dummyObj.position.set(sx, 0.05, sz);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.setScalar(0.5);
      _dummyObj.updateMatrix();
      this.rainSplashes.setMatrixAt(i, _dummyObj.matrix);
    }
    this.rainSplashes.instanceMatrix.needsUpdate = true;
    this.rainGroup.add(this.rainSplashes);

    this.scene.add(this.rainGroup);
    this.applyAtmosphere();
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
    // Indonesian Left-Hand Traffic (Lajur Kiri: ±3.5m from road centerline)
    // Parked vehicles sit neatly parallel to the curb at ±4.6m from road centerline
    const parkedConfigs: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      // Parked along x = 0 South Boulevard near Player start (-8.5, 28)
      { type: 'bajaj', x: -4.6, z: 24, heading: Math.PI },
      { type: 'ojol_motor', x: -4.6, z: 30, heading: Math.PI },
      // Parked along z = 0 West Boulevard near Warung Pecel Lele
      { type: 'angkot', x: -28, z: 4.6, heading: -Math.PI / 2 },
      // Parked along z = 0 East Boulevard near Warung Bakso
      { type: 'bus_telolet', x: 35, z: -4.6, heading: Math.PI / 2 },
      // Parked in front of Taman Tugu Monas (-90, -4.6)
      { type: 'bajaj', x: -84, z: -4.6, heading: Math.PI / 2 },
      // Parked in front of SMA Negeri 1 Nusantara & Taman Kota (z = 60)
      { type: 'angkot', x: 24, z: 64.6, heading: -Math.PI / 2 },
      // Parked in West Kampung near Pos Kamling & Warung Madura
      { type: 'bajaj', x: -140, z: -27, heading: 0 },
      { type: 'ojol_motor', x: -140, z: 22, heading: Math.PI },
      // Parked in East District near Pasar Tradisional
      { type: 'angkot', x: 139, z: -20, heading: Math.PI },
    ];

    parkedConfigs.forEach((cfg, idx) => {
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
        id: `parked_${idx}`,
        type: cfg.type,
        name: spec.name,
        mesh,
        speed: 0,
        heading: cfg.heading,
        steerAngle: 0,
        isAI: false,
        waypoints: [],
        waypointIdx: 0,
        maxSpeed: spec.maxSpeed,
        acceleration: spec.acceleration,
        turnSpeed: spec.turnSpeed,
      });
    });

    // 18 Active Moving AI Vehicles across all City Corridors (Strictly Left-Hand Lanes ±3.5m!)
    // spawnProgress (0..1) distributes vehicles along the road segments so traffic is immediately visible everywhere
    const aiRoutes: {
      type: VehicleType;
      startIdx: number;
      spawnProgress: number;
      waypoints: { x: number; z: number }[];
    }[] = [
      // 1 & 2. Central North-South Protocol Boulevard (x = ±3.5, passing right past the player at spawn!)
      {
        type: 'bajaj',
        startIdx: 0,
        spawnProgress: 0.35,
        waypoints: [
          { x: -3.5, z: 56.5 },
          { x: -3.5, z: -56.5 },
          { x: 56.5, z: -56.5 },
          { x: 56.5, z: 56.5 },
        ],
      },
      {
        type: 'ojol_motor',
        startIdx: 2,
        spawnProgress: 0.55,
        waypoints: [
          { x: -3.5, z: 56.5 },
          { x: -3.5, z: -56.5 },
          { x: -56.5, z: -56.5 },
          { x: -56.5, z: 56.5 },
        ],
      },
      // 3 & 4. Central Southbound Protocol Loop (x = +3.5, passing Bengkel Cat & Indoalfa)
      {
        type: 'angkot',
        startIdx: 0,
        spawnProgress: 0.25,
        waypoints: [
          { x: 3.5, z: -56.5 },
          { x: 3.5, z: 56.5 },
          { x: -56.5, z: 56.5 },
          { x: -56.5, z: -56.5 },
        ],
      },
      {
        type: 'bus_telolet',
        startIdx: 2,
        spawnProgress: 0.45,
        waypoints: [
          { x: 3.5, z: -56.5 },
          { x: 3.5, z: 56.5 },
          { x: 56.5, z: 56.5 },
          { x: 56.5, z: -56.5 },
        ],
      },
      // 5 & 6. Central West-East Boulevard (z = ±3.5, connecting Monas & Tugu Surabaya through Center)
      {
        type: 'polisi',
        startIdx: 0,
        spawnProgress: 0.42,
        waypoints: [
          { x: -116.5, z: -3.5 },
          { x: 116.5, z: -3.5 },
          { x: 116.5, z: 3.5 },
          { x: -116.5, z: 3.5 },
        ],
      },
      {
        type: 'ojol_motor',
        startIdx: 2,
        spawnProgress: 0.38,
        waypoints: [
          { x: -116.5, z: -3.5 },
          { x: 116.5, z: -3.5 },
          { x: 116.5, z: 3.5 },
          { x: -116.5, z: 3.5 },
        ],
      },
      // 7, 8 & 8B. Inner Ring Clockwise (Left lane at ±56.5) + Inner Ring Police Patrol
      {
        type: 'angkot',
        startIdx: 0,
        spawnProgress: 0.2,
        waypoints: [
          { x: -56.5, z: 56.5 },
          { x: -56.5, z: -56.5 },
          { x: 56.5, z: -56.5 },
          { x: 56.5, z: 56.5 },
        ],
      },
      {
        type: 'polisi',
        startIdx: 1,
        spawnProgress: 0.35,
        waypoints: [
          { x: -56.5, z: 56.5 },
          { x: -56.5, z: -56.5 },
          { x: 56.5, z: -56.5 },
          { x: 56.5, z: 56.5 },
        ],
      },
      {
        type: 'bajaj',
        startIdx: 2,
        spawnProgress: 0.6,
        waypoints: [
          { x: -56.5, z: 56.5 },
          { x: -56.5, z: -56.5 },
          { x: 56.5, z: -56.5 },
          { x: 56.5, z: 56.5 },
        ],
      },
      // 9 & 10. Inner Ring Counter-Clockwise (Outer Left lane at ±63.5)
      {
        type: 'bus_telolet',
        startIdx: 1,
        spawnProgress: 0.3,
        waypoints: [
          { x: -63.5, z: -63.5 },
          { x: -63.5, z: 63.5 },
          { x: 63.5, z: 63.5 },
          { x: 63.5, z: -63.5 },
        ],
      },
      {
        type: 'ojol_motor',
        startIdx: 3,
        spawnProgress: 0.5,
        waypoints: [
          { x: -63.5, z: -63.5 },
          { x: -63.5, z: 63.5 },
          { x: 63.5, z: 63.5 },
          { x: 63.5, z: -63.5 },
        ],
      },
      // 11 & 12. School (SMAN 1) & Taman Kota Nusantara South Corridor (z = 56.5 / 63.5)
      {
        type: 'angkot',
        startIdx: 1,
        spawnProgress: 0.4,
        waypoints: [
          { x: -56.5, z: 116.5 },
          { x: -56.5, z: 56.5 },
          { x: 56.5, z: 56.5 },
          { x: 56.5, z: 116.5 },
        ],
      },
      {
        type: 'bus_telolet',
        startIdx: 2,
        spawnProgress: 0.5,
        waypoints: [
          { x: -56.5, z: 116.5 },
          { x: 56.5, z: 116.5 },
          { x: 56.5, z: 63.5 },
          { x: -56.5, z: 63.5 },
        ],
      },
      // 13 & 14. West Taman Monas Loop (passing right in front of Lapangan Monas at x = -90)
      {
        type: 'bajaj',
        startIdx: 0,
        spawnProgress: 0.5,
        waypoints: [
          { x: -3.5, z: -3.5 },
          { x: -3.5, z: -56.5 },
          { x: -116.5, z: -56.5 },
          { x: -116.5, z: -3.5 },
        ],
      },
      {
        type: 'angkot',
        startIdx: 2,
        spawnProgress: 0.45,
        waypoints: [
          { x: -3.5, z: -3.5 },
          { x: -3.5, z: -56.5 },
          { x: -116.5, z: -56.5 },
          { x: -116.5, z: -3.5 },
        ],
      },
      // 15 & 16. East Taman Tugu Surabaya Loop (passing right in front of Taman Tugu Surabaya at x = 90)
      {
        type: 'ojol_motor',
        startIdx: 0,
        spawnProgress: 0.45,
        waypoints: [
          { x: 3.5, z: 3.5 },
          { x: 3.5, z: 56.5 },
          { x: 116.5, z: 56.5 },
          { x: 116.5, z: 3.5 },
        ],
      },
      {
        type: 'bajaj',
        startIdx: 2,
        spawnProgress: 0.5,
        waypoints: [
          { x: 3.5, z: 3.5 },
          { x: 3.5, z: 56.5 },
          { x: 116.5, z: 56.5 },
          { x: 116.5, z: 3.5 },
        ],
      },
      // 17. North Masjid Agung Loop
      {
        type: 'bajaj',
        startIdx: 0,
        spawnProgress: 0.4,
        waypoints: [
          { x: -3.5, z: -63.5 },
          { x: -3.5, z: -116.5 },
          { x: 56.5, z: -116.5 },
          { x: 56.5, z: -63.5 },
        ],
      },
      // 18. Outer Ring Police Patrol
      {
        type: 'polisi',
        startIdx: 1,
        spawnProgress: 0.5,
        waypoints: [
          { x: -116.5, z: 116.5 },
          { x: -116.5, z: -116.5 },
          { x: 116.5, z: -116.5 },
          { x: 116.5, z: 116.5 },
        ],
      },
      // 19. West Gang Kampung Patrol (Ojol motor lincah di gang sempit)
      {
        type: 'ojol_motor',
        startIdx: 0,
        spawnProgress: 0.35,
        waypoints: [
          { x: -142, z: -75 },
          { x: -142, z: 65 },
          { x: -120, z: 65 },
          { x: -120, z: -75 },
        ],
      },
      // 20. East Pasar Tradisional Loop (Bajaj selap-selip di Pasar & Gang Melati)
      {
        type: 'bajaj',
        startIdx: 1,
        spawnProgress: 0.45,
        waypoints: [
          { x: 142, z: -25 },
          { x: 142, z: 65 },
          { x: 120, z: 65 },
          { x: 120, z: -25 },
        ],
      },
    ];

    aiRoutes.forEach((route, idx) => {
      const spec = VEHICLE_SPECS[route.type];
      const wp0 = route.waypoints[route.startIdx % route.waypoints.length];
      const wp1 = route.waypoints[(route.startIdx + 1) % route.waypoints.length];
      const initialHeading = Math.atan2(wp1.x - wp0.x, wp1.z - wp0.z);

      // Interpolate initial position along the segment so vehicles start spread out in mid-drive
      const startX = THREE.MathUtils.lerp(wp0.x, wp1.x, route.spawnProgress);
      const startZ = THREE.MathUtils.lerp(wp0.z, wp1.z, route.spawnProgress);

      const mesh = createVehicleMesh(
        route.type,
        spec.color,
        spec.plate,
        this.maxAnisotropy,
        this.isSoftwareGl
      );
      mesh.position.set(startX, 0, startZ);
      mesh.rotation.y = initialHeading;
      this.scene.add(mesh);

      this.vehicles.push({
        id: `ai_${idx}`,
        type: route.type,
        name: spec.name,
        mesh,
        speed: 12,
        heading: initialHeading,
        steerAngle: 0,
        isAI: true,
        waypoints: route.waypoints,
        waypointIdx: (route.startIdx + 1) % route.waypoints.length,
        maxSpeed: spec.maxSpeed,
        acceleration: spec.acceleration,
        turnSpeed: spec.turnSpeed,
      });
    });
  }

  private spawnPedestrians() {
    const shirtPalette = [0x16a34a, 0xdc2626, 0x2563eb, 0xd97706, 0x9333ea, 0x0891b2, 0xe11d48, 0x0d9488];
    const pantsPalette = [0x1e293b, 0x334155, 0x0f172a, 0x422006];

    // Helper to spawn a pedestrian along a closed loop of waypoints with staggered position & direction
    const addLoopPedestrian = (
      waypoints: { x: number; z: number }[],
      edgeIdx: number,
      edgeProgress: number,
      archetype: PedestrianArchetype,
      colorSeed: number,
      reverse = false
    ) => {
      const ordered = reverse ? [...waypoints].reverse() : waypoints;
      const wp0 = ordered[edgeIdx % ordered.length];
      const wp1 = ordered[(edgeIdx + 1) % ordered.length];
      const startX = THREE.MathUtils.lerp(wp0.x, wp1.x, edgeProgress);
      const startZ = THREE.MathUtils.lerp(wp0.z, wp1.z, edgeProgress);
      const heading = Math.atan2(wp1.x - wp0.x, wp1.z - wp0.z);

      const npc = createNPCPedestrian(
        shirtPalette[colorSeed % shirtPalette.length],
        pantsPalette[colorSeed % pantsPalette.length],
        archetype
      );
      npc.position.set(startX, 0, startZ);
      npc.rotation.y = heading;
      this.scene.add(npc);

      this.pedestrians.push({
        mesh: npc,
        heading,
        speed: 2.1 + (colorSeed % 4) * 0.32,
        walkCycle: colorSeed * 0.85,
        waypoints: ordered,
        waypointIdx: (edgeIdx + 1) % ordered.length,
        state: 'walking',
        idleTimer: 0,
        idleDuration: 0,
        walkTimer: (colorSeed * 3.7) % 12,
        walkDuration: 14 + (colorSeed % 6) * 3,
      });
    };

    // 1. Sidewalk Pedestrians around 12 City Blocks (3 pedestrians per block = 36 sidewalk NPCs)
    // Archetypes are matched to each district (School, Masjid, Culinary, Sudirman, Parks)
    const blockConfigs: {
      bx: number;
      bz: number;
      archetypes: [PedestrianArchetype, PedestrianArchetype, PedestrianArchetype];
    }[] = [
      // Inner Central Blocks (Warung Pecel, Bakso, Indoalfa, Bengkel)
      { bx: -30, bz: 30, archetypes: ['ojol', 'warga', 'pekerja_batik'] },
      { bx: 30, bz: -30, archetypes: ['warga', 'ojol', 'pekerja_batik'] },
      { bx: -30, bz: -30, archetypes: ['pekerja_batik', 'ojol', 'warga'] },
      { bx: 30, bz: 30, archetypes: ['warga', 'ojol', 'warga'] },
      // Education & Public Park Blocks (SMA Negeri 1 & Taman Kota Nusantara)
      { bx: 30, bz: 90, archetypes: ['pelajar_sma', 'pelajar_sma', 'pekerja_batik'] },
      { bx: -30, bz: 90, archetypes: ['pelajar_sma', 'warga', 'warga'] },
      // Landmark Park Blocks (Taman Tugu Monas & Taman Tugu Surabaya)
      { bx: -90, bz: -30, archetypes: ['pekerja_batik', 'warga', 'ojol'] },
      { bx: 90, bz: 30, archetypes: ['warga', 'pekerja_batik', 'ojol'] },
      // Religious & Business Blocks (Masjid Agung, Alfamaret, Sudirman)
      { bx: 30, bz: -90, archetypes: ['santri', 'santri', 'warga'] },
      { bx: -90, bz: 30, archetypes: ['ojol', 'warga', 'pelajar_sma'] },
      { bx: -30, bz: -90, archetypes: ['pekerja_batik', 'santri', 'warga'] },
      { bx: 90, bz: -30, archetypes: ['pekerja_batik', 'warga', 'ojol'] },
    ];

    blockConfigs.forEach((cfg, idx) => {
      const half = 21.8; // Strictly on the 2.2m block sidewalk frame!
      const sidewalkLoop = [
        { x: cfg.bx - half, z: cfg.bz - half },
        { x: cfg.bx + half, z: cfg.bz - half },
        { x: cfg.bx + half, z: cfg.bz + half },
        { x: cfg.bx - half, z: cfg.bz + half },
      ];

      for (let k = 0; k < 3; k++) {
        const seed = idx * 3 + k;
        addLoopPedestrian(
          sidewalkLoop,
          (idx + k) % 4,
          0.22 + k * 0.28,
          cfg.archetypes[k],
          seed,
          k === 1 // Middle walker goes counter-clockwise so pedestrians pass each other!
        );
      }
    });

    // 2. Interior Park & School Courtyard Strollers (12 additional NPCs inside landmarks!)
    // a) Jogging & Strolling around Taman Kota Nusantara (-30, 90)
    const tamanJoggingLoop = [
      { x: -41, z: 79 },
      { x: -19, z: 79 },
      { x: -19, z: 101 },
      { x: -41, z: 101 },
    ];
    addLoopPedestrian(tamanJoggingLoop, 0, 0.3, 'warga', 40, false);
    addLoopPedestrian(tamanJoggingLoop, 2, 0.6, 'pelajar_sma', 41, false);
    addLoopPedestrian(tamanJoggingLoop, 1, 0.4, 'warga', 42, true);

    // b) Students in SMA Negeri 1 Nusantara Courtyard (30, 90)
    const schoolCourtLoop = [
      { x: 22, z: 76 },
      { x: 38, z: 76 },
      { x: 38, z: 87 },
      { x: 22, z: 87 },
    ];
    addLoopPedestrian(schoolCourtLoop, 0, 0.25, 'pelajar_sma', 43, false);
    addLoopPedestrian(schoolCourtLoop, 2, 0.55, 'pelajar_sma', 44, false);
    addLoopPedestrian(schoolCourtLoop, 1, 0.45, 'pelajar_sma', 45, true);

    // c) Tourists strolling on Taman Tugu Monas Plaza (-90, -30)
    const monasPlazaLoop = [
      { x: -102, z: -42 },
      { x: -78, z: -42 },
      { x: -78, z: -18 },
      { x: -102, z: -18 },
    ];
    addLoopPedestrian(monasPlazaLoop, 0, 0.35, 'pekerja_batik', 46, false);
    addLoopPedestrian(monasPlazaLoop, 2, 0.65, 'warga', 47, true);
    addLoopPedestrian(monasPlazaLoop, 3, 0.5, 'warga', 48, false);

    // d) Tourists strolling on Taman Tugu Surabaya Plaza (90, 30)
    const surabayaPlazaLoop = [
      { x: 78, z: 18 },
      { x: 102, z: 18 },
      { x: 102, z: 42 },
      { x: 78, z: 42 },
    ];
    addLoopPedestrian(surabayaPlazaLoop, 0, 0.4, 'warga', 49, false);
    addLoopPedestrian(surabayaPlazaLoop, 2, 0.5, 'pekerja_batik', 50, true);
    addLoopPedestrian(surabayaPlazaLoop, 1, 0.3, 'pelajar_sma', 51, false);

    // e) Warga & Santri walking along West Gang Kampung (Pos Kamling, TPS 04, Joglo, Warung Madura & TPU Kamboja)
    const westKampungLoop = [
      { x: -144, z: -75 },
      { x: -140, z: -75 },
      { x: -140, z: 76 },
      { x: -144, z: 76 },
    ];
    addLoopPedestrian(westKampungLoop, 0, 0.25, 'santri', 52, false);
    addLoopPedestrian(westKampungLoop, 2, 0.65, 'warga', 53, true);
    addLoopPedestrian(westKampungLoop, 1, 0.8, 'pekerja_batik', 56, false);

    // f) Shoppers & Vendors at East Pasar Tradisional
    const pasarLoop = [
      { x: 136, z: -48 },
      { x: 148, z: -48 },
      { x: 148, z: -24 },
      { x: 136, z: -24 },
    ];
    addLoopPedestrian(pasarLoop, 0, 0.25, 'warga', 54, false);
    addLoopPedestrian(pasarLoop, 2, 0.65, 'pekerja_batik', 55, true);

    // 3. Sitting NPCs at Park Benches, Warungs, Pos Kamling, TPS 04, School Courtyard & River Deck
    const sittingConfigs: {
      shirt: number;
      pants: number;
      archetype: PedestrianArchetype;
      x: number;
      y: number;
      z: number;
      heading: number;
    }[] = [
      // Taman Kota Nusantara Gazebo Benches & Garden
      { shirt: 0x2563eb, pants: 0x1e293b, archetype: 'warga', x: -28.2, y: 0.45, z: 88.6, heading: 0 },
      { shirt: 0xd97706, pants: 0x334155, archetype: 'pekerja_batik', x: -31.8, y: 0.45, z: 88.6, heading: 0 },
      { shirt: 0x16a34a, pants: 0x0f172a, archetype: 'santri', x: -30.0, y: 0.45, z: 91.8, heading: Math.PI },
      // Warung Pecel Lele Dining Bench
      { shirt: 0x0891b2, pants: 0x1e293b, archetype: 'ojol', x: -30.8, y: 0.45, z: 15.0, heading: -Math.PI / 2 },
      { shirt: 0xdc2626, pants: 0x334155, archetype: 'warga', x: -33.2, y: 0.45, z: 15.0, heading: Math.PI / 2 },
      // Warung Bakso Solo Dining Bench
      { shirt: 0x9333ea, pants: 0x1e293b, archetype: 'warga', x: 30.8, y: 0.45, z: -15.0, heading: -Math.PI / 2 },
      { shirt: 0x16a34a, pants: 0x0f172a, archetype: 'santri', x: 33.2, y: 0.45, z: -15.0, heading: Math.PI / 2 },
      // Pos Kamling Bale-Bale (Warga Ronda Santai di Gardu)
      { shirt: 0x0d9488, pants: 0x422006, archetype: 'warga', x: -147.5, y: 0.45, z: -36.5, heading: 0 },
      // Warkop Mbah Darmo (Warga Ngopi di Bangku Kayu)
      { shirt: 0xdc2626, pants: 0x1e293b, archetype: 'warga', x: -136.2, y: 0.45, z: -14.0, heading: Math.PI / 2 },
      // TPS 04 Kampung Nusantara (Warga duduk antre memilih di kursi plastik TPS)
      { shirt: 0x2563eb, pants: 0x1e293b, archetype: 'warga', x: -136.2, y: 0.38, z: -60.8, heading: -Math.PI / 2 },
      { shirt: 0xd97706, pants: 0x334155, archetype: 'pekerja_batik', x: -136.2, y: 0.38, z: -59.85, heading: -Math.PI / 2 },
      // SMA Negeri 1 Kantin Courtyard Bench
      { shirt: 0xf1f5f9, pants: 0x64748b, archetype: 'pelajar_sma', x: 28.5, y: 0.45, z: 72.8, heading: Math.PI / 2 },
      { shirt: 0xf1f5f9, pants: 0x64748b, archetype: 'pelajar_sma', x: 31.5, y: 0.45, z: 72.8, heading: -Math.PI / 2 },
      // Warung Hutan Pinus Tepi Sungai
      { shirt: 0xd97706, pants: 0x334155, archetype: 'warga', x: -88.5, y: 0.45, z: 71.8, heading: 0 },
    ];

    for (const sc of sittingConfigs) {
      const sitter = createSittingNPC(sc.shirt, sc.pants, sc.archetype);
      sitter.position.set(sc.x, sc.y, sc.z);
      sitter.rotation.y = sc.heading;
      this.scene.add(sitter);
      this.sittingNPCs.push(sitter);
    }
  }

  private spawnVendors() {
    const vendorConfigs: {
      type: VendorType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      // 1. Warung Pecel Lele Cak Har (Pecel lele cook with apron & kipas sate)
      { type: 'pecel_lele', x: -32.0, z: 12.2, heading: 0 },
      // 2. Warung Bakso Solo Mas Joko (Bakso chef with apron & ladle)
      { type: 'bakso', x: 32.0, z: -12.2, heading: Math.PI },
      // 3. Minimarket Indoalfa 24 Jam (Kasir seragam merah biru)
      { type: 'indoalfa', x: -9.5, z: -32.8, heading: Math.PI },
      // 4. Bengkel Cat Kilat & Cuci Steam Pak Slamet (Montir baju werpak & kunci inggris)
      { type: 'bengkel', x: 9.5, z: 34.5, heading: 0 },
      // 5. Kios Kuliner Betawi Monas (Abang Betawi berpeci & cukin batik)
      { type: 'monas_betawi', x: -90.0, z: -12.5, heading: 0 },
      // 6. Kios Kuliner Rawon Surabaya (Cak Suroboyo ikat kepala udeng)
      { type: 'surabaya', x: 90.0, z: 12.5, heading: Math.PI },
      // 7. Kios Jajanan Taman Kota Nusantara (Penjual Es Doger & Cilok)
      { type: 'taman_jajanan', x: -30.0, z: 70.5, heading: Math.PI },
      // 8. Kantin SMA Negeri 1 Nusantara (Ibu Kantin Ramah)
      { type: 'kantin', x: 30.0, z: 70.5, heading: Math.PI },
      // 9. Warung Tepi Sungai & Hutan Pinus (Barista Kopi Tubruk Hutan)
      { type: 'hutan', x: -90.0, z: 70.5, heading: Math.PI },
      // 10. Pos Kamling & Gardu Ronda RT 03 (Petugas Ronda Sarung & Senter)
      { type: 'pos_kamling', x: -148.0, z: -35.0, heading: 0 },
      // 11. Kios Pasar Tradisional Rakyat (Pedagang bertopi caping anyaman bambu)
      { type: 'pasar', x: 140.0, z: -26.5, heading: 0 },
      // 12. Toko Kelontong Madura 24 Jam (Penjaga toko sarung & peci hitam)
      { type: 'madura', x: -148.5, z: 28.5, heading: Math.PI / 2 },
      // 13. Minimarket Alfamaret Point (Kasir seragam Alfamaret merah kuning)
      { type: 'alfamaret', x: 32.5, z: -32.8, heading: Math.PI },
      // 14. Toko Sembako Bu Tejo (Penjaga toko kelontong sembako)
      { type: 'toko_sembako', x: -137.2, z: -28.5, heading: -Math.PI / 2 },
      // 15. Warkop Mbah Darmo (Peracik kopi tubruk & gorengan)
      { type: 'warkop', x: -137.0, z: -14.0, heading: -Math.PI / 2 },
      // 16. Kios Bunga Ziarah & Penjaga TPU Kamboja Nusantara
      { type: 'penjaga_makam', x: -148.5, z: 74.8, heading: Math.PI / 2 },
      // 17. Petugas KPPS TPS 04 Kampung Nusantara (Meja Tinta Ungu & Surat Suara)
      { type: 'petugas_tps', x: -136.8, z: -63.8, heading: -Math.PI / 2 },
    ];

    for (const cfg of vendorConfigs) {
      const vendorMesh = createVendorNPC(cfg.type);
      vendorMesh.position.set(cfg.x, 0, cfg.z);
      vendorMesh.rotation.y = cfg.heading;
      this.scene.add(vendorMesh);
      this.vendors.push({
        mesh: vendorMesh,
        type: cfg.type,
        baseHeading: cfg.heading,
        armPhase: Math.random() * Math.PI * 2,
        greetTimer: 0,
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
    } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : 2;
      const spot = this.findNearbySpot();
      if (spot && spot.items[idx]) {
        e.preventDefault();
        this.buyShopItem(spot.id, spot.items[idx].id);
      }
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

  private dragPointerId: number | null = null;

  private handlePointerDown = (e: PointerEvent) => {
    this.isPointerDragging = true;
    this.dragPointerId = e.pointerId;
    this.lastPointerX = e.clientX;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isPointerDragging || this.dragPointerId !== e.pointerId) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.cameraOrbitOffset -= dx * 0.0065;
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.dragPointerId !== null && e.pointerId !== this.dragPointerId) return;
    this.isPointerDragging = false;
    this.dragPointerId = null;
  };

  private handleResize = () => {
    if (this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // Public Interactive APIs for HUD Dock & Mobile Touch Controller
  public setVirtualInput(
    forward: number,
    turn: number,
    brake = false,
    sprint = false
  ) {
    this.virtualInput.forward = forward;
    this.virtualInput.turn = turn;
    this.virtualInput.brake = brake;
    this.virtualInput.sprint = sprint;
  }

  public triggerJump() {
    if (this.drivenVehicle) return;
    if (this.playerHomeState !== 'standing') {
      this.performHomeAction('stand');
      return;
    }
    const insideNow = this.isPlayerInsideHome(this.playerPos.x, this.playerPos.z);
    const floorY = insideNow ? 0.14 : 0;
    if (this.playerPos.y <= floorY + 0.05) {
      this.playerVelocityY = 6.8;
      soundFX.playInteractChime();
    }
  }

  public toggleVehicleEnterExit() {
    if (this.drivenVehicle) {
      const v = this.drivenVehicle;
      this.drivenVehicle = null;
      v.speed = 0;

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

    let nearest: ActiveVehicleInstance | null = null;
    let bestDist = 7.0;
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
        this.wantedDecayTimer = 35;
        this.showNotification(
          'Mobil Patroli Dibajak! (★★)',
          'Unit Patroli Polisi lainnya sedang mengejarmu! Pergi ke Bengkel Cat atau Rumah Pribadi.',
          'warning'
        );
      } else if (wasAI && nearest.waypoints.length > 0) {
        this.wantedStars = Math.min(5, Math.max(1, this.wantedStars + 1));
        this.wantedDecayTimer = 35;
        this.showNotification(
          `Membajak ${nearest.name}! (★)`,
          'Mobil Patroli Polisi dikerahkan mengejarmu lintas jalur!',
          'warning'
        );
      } else {
        this.showNotification(
          `Mengendarai ${nearest.name}`,
          'Ikuti lajur kiri jalan raya! Tekan G untuk Klakson Telolet, F untuk Turun.',
          'info'
        );
      }
      this.broadcastHud(true);
    } else {
      this.showNotification(
        'Tidak Ada Kendaraan di Dekatmu',
        'Dekati kendaraan di jalan atau panggil instan dari Garasi di bawah!',
        'warning'
      );
    }
  }

  private snapPositionToNearestRoadLane(
    rawX: number,
    rawZ: number,
    fallbackHeading: number
  ): { x: number; z: number; heading: number } {
    // Find nearest NS or EW road line in ROAD_GRID_LINES so spawned vehicles sit cleanly in a road lane!
    let bestDist = Infinity;
    let bestX = rawX;
    let bestZ = rawZ;
    let bestHeading = fallbackHeading;

    for (const r of ROAD_GRID_LINES) {
      const dNS = Math.abs(rawX - r);
      if (dNS < bestDist) {
        bestDist = dNS;
        // Snap to Northbound left lane (r - 3.5)
        bestX = r - 3.5;
        bestZ = THREE.MathUtils.clamp(rawZ, -115, 115);
        bestHeading = Math.PI;
      }
      const dEW = Math.abs(rawZ - r);
      if (dEW < bestDist) {
        bestDist = dEW;
        // Snap to Eastbound left lane (r - 3.5)
        bestX = THREE.MathUtils.clamp(rawX, -115, 115);
        bestZ = r - 3.5;
        bestHeading = Math.PI / 2;
      }
    }

    return { x: bestX, z: bestZ, heading: bestHeading };
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

    // Snap spawned vehicle cleanly onto the nearest road lane!
    const snapped = this.snapPositionToNearestRoadLane(
      currentActorPos.x,
      currentActorPos.z,
      currentHeading
    );

    const mesh = createVehicleMesh(
      type,
      spec.color,
      spec.plate,
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    mesh.position.set(snapped.x, 0, snapped.z);
    mesh.rotation.y = snapped.heading;
    this.scene.add(mesh);

    const newVeh: ActiveVehicleInstance = {
      id: `spawn_${Date.now()}`,
      type,
      name: spec.name,
      mesh,
      speed: 0,
      heading: snapped.heading,
      steerAngle: 0,
      isAI: false,
      waypoints: [],
      waypointIdx: 0,
      maxSpeed: spec.maxSpeed,
      acceleration: spec.acceleration,
      turnSpeed: spec.turnSpeed,
    };

    this.vehicles.push(newVeh);
    this.drivenVehicle = newVeh;
    this.playerPos.set(snapped.x, 0, snapped.z);
    this.playerHeading = snapped.heading;
    this.playerMesh.visible = false;
    this.cameraOrbitOffset = 0;

    soundFX.playTeloletHorn(type === 'bus_telolet' || type === 'angkot');
    this.showNotification(
      `${spec.name} Siap di Lajur Jalan!`,
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

  private findNearbySpot(): InteractableSpot | null {
    const pos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;
    for (const spot of INTERACTABLE_SPOTS) {
      const dist = Math.hypot(spot.position.x - pos.x, spot.position.z - pos.z);
      if (dist <= spot.radius) {
        return spot;
      }
    }
    return null;
  }

  public buyShopItem(spotId: string, itemId: string) {
    const spot = INTERACTABLE_SPOTS.find((s) => s.id === spotId);
    if (!spot) return;
    const item = spot.items.find((i) => i.id === itemId) || spot.items[0];
    if (!item) return;

    if (this.money < item.price) {
      this.showNotification(
        'Saldo Rupiah Kurang!',
        `Harga ${item.name} Rp ${item.price.toLocaleString('id-ID')}. Selesaikan Misi Kota dulu!`,
        'warning'
      );
      return;
    }

    this.money -= item.price;
    soundFX.playCashReward();

    if (spot.category === 'bengkel' && item.id === 'cat_ulang_polisi') {
      this.wantedStars = 0;
      this.health = this.maxHealth;
      if (this.drivenVehicle) {
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
        `${item.name} Selesai!`,
        'Warna kendaraan baru, Bintang Polisi bersih 100%, & Darah Penuh!',
        'success'
      );
    } else {
      const prevHealth = this.health;
      this.health = Math.min(this.maxHealth, this.health + item.healAmount);
      const actualGain = Math.max(item.healAmount, this.health - prevHealth);
      this.showNotification(
        `Membeli ${item.name} (-Rp ${item.price.toLocaleString('id-ID')})`,
        `Nikmat! Bar Kesehatan bertambah +${actualGain} Darah (Sekarang: ${this.health}/${this.maxHealth} HP).`,
        'success'
      );
    }

    this.broadcastHud(true);
  }

  public triggerContextAction() {
    if (!this.drivenVehicle && this.playerHomeState !== 'standing') {
      this.performHomeAction('stand');
      return;
    }

    if (!this.drivenVehicle && this.wasInsideHome) {
      // Check nearest indoor activity spot (Bed, Dining Table, Sofa, or Front Door)
      const dBed = Math.hypot(this.playerPos.x - -20.5, this.playerPos.z - 27.4);
      const dEat = Math.hypot(this.playerPos.x - -19.6, this.playerPos.z - 22.0);
      const dSofa = Math.hypot(this.playerPos.x - -16.4, this.playerPos.z - 25.65);
      const dDoor = Math.hypot(this.playerPos.x - -13.5, this.playerPos.z - 24.0);
      const minD = Math.min(dBed, dEat, dSofa, dDoor);
      if (minD === dDoor && dDoor < 2.2) {
        this.performHomeAction('exit');
        return;
      }
      if (minD === dBed && dBed < 2.3) {
        this.performHomeAction('sleep');
        return;
      }
      if (minD === dEat && dEat < 2.2) {
        this.performHomeAction('eat');
        return;
      }
      if (minD === dSofa && dSofa < 2.2) {
        this.performHomeAction('sit');
        return;
      }
      // Otherwise perform a regular punch inside the house without kicking player out
      this.playerPunchTimer = 0.4;
      soundFX.playImpactThud();
      return;
    }

    if (!this.drivenVehicle && this.isPlayerNearHomeDoor()) {
      this.performHomeAction('enter');
      return;
    }

    const spot = this.findNearbySpot();
    if (spot && spot.items.length > 0) {
      // If health is only slightly down, buy item 0 (e.g. Es Teh Manis), else buy main meal (item 1)
      const defaultItem =
        this.health >= 80 || spot.items.length === 1
          ? spot.items[0]
          : spot.items[1];
      this.buyShopItem(spot.id, defaultItem.id);
      return;
    }

    if (!this.drivenVehicle) {
      this.playerPunchTimer = 0.4;
      soundFX.playImpactThud();

      // Check if player punched a nearby pedestrian or AI vehicle outside -> triggers Wanted Police Chase!
      let hitTarget = false;
      for (const p of this.pedestrians) {
        const d = Math.hypot(
          p.mesh.position.x - this.playerPos.x,
          p.mesh.position.z - this.playerPos.z
        );
        if (d < 2.6) {
          hitTarget = true;
          // Push pedestrian back slightly
          const pushAngle = Math.atan2(
            p.mesh.position.x - this.playerPos.x,
            p.mesh.position.z - this.playerPos.z
          );
          p.mesh.position.x += Math.sin(pushAngle) * 1.2;
          p.mesh.position.z += Math.cos(pushAngle) * 1.2;
          p.state = 'walking';
          break;
        }
      }
      if (!hitTarget) {
        for (const v of this.vehicles) {
          if (!v.isAI) continue;
          const d = Math.hypot(
            v.mesh.position.x - this.playerPos.x,
            v.mesh.position.z - this.playerPos.z
          );
          if (d < 3.0) {
            hitTarget = true;
            break;
          }
        }
      }

      if (hitTarget) {
        this.wantedStars = Math.min(5, this.wantedStars + 1);
        this.wantedDecayTimer = 35;
        this.showNotification(
          `Keributan di Jalanan! (${'★'.repeat(this.wantedStars)})`,
          'Warga melapor! Mobil Patroli Polisi sedang mengejarmu!',
          'warning'
        );
        this.broadcastHud(true);
      }
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

  private getPhaseFromHour(h: number): TimeOfDay {
    if (h >= 5.5 && h < 10.5) return 'pagi';
    if (h >= 10.5 && h < 15.5) return 'siang';
    if (h >= 15.5 && h < 18.5) return 'sore';
    return 'malam';
  }

  private formatClockHour(h: number): string {
    const wrapped = ((h % 24) + 24) % 24;
    const hrs = Math.floor(wrapped);
    const mins = Math.floor((wrapped - hrs) * 60);
    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `${hh}:${mm} WIB`;
  }

  public setTimeOfDay(time: TimeOfDay) {
    this.timeOfDay = time;
    if (time === 'pagi') {
      this.clockHour = 7.5; // 07:30 WIB Pagi
    } else if (time === 'siang') {
      this.clockHour = 12.5; // 12:30 WIB Siang
    } else if (time === 'sore') {
      this.clockHour = 16.75; // 16:45 WIB Sore / Senja
    } else {
      this.clockHour = 21.0; // 21:00 WIB Malam
    }
    this.applyAtmosphere();
    this.broadcastHud(true);
  }

  public setAutoTime(enabled: boolean) {
    this.autoTime = enabled;
    soundFX.playInteractChime();
    this.showNotification(
      enabled ? 'Siklus Waktu Otomatis Aktif' : 'Waktu Dikunci Manual',
      enabled
        ? 'Waktu berjalan otomatis dari Pagi → Siang → Sore → Malam.'
        : `Waktu dikunci pada ${this.formatClockHour(this.clockHour)} (${this.timeOfDay.toUpperCase()}).`,
      'info'
    );
    this.broadcastHud(true);
  }

  public setWeather(weather: WeatherType) {
    this.weather = weather;
    soundFX.setRainAmbience(weather === 'hujan');

    if (weather === 'hujan') {
      soundFX.playThunderRumble();
      this.lightningTimer = 9.0;
      this.showNotification(
        'Cuaca Hujan Deras & Suara Rintik Hujan Aktif!',
        'Partikel hujan Three.js, cipratan air di aspal basah, dan suara latar rintik hujan menyala.',
        'info'
      );
    } else {
      soundFX.playInteractChime();
      this.showNotification(
        'Cuaca Cerah Kembali',
        'Hujan reda, partikel hujan berhenti, dan langit Kota Raya kembali cerah.',
        'info'
      );
    }
    this.applyAtmosphere();
    this.broadcastHud(true);
  }

  private applyAtmosphere() {
    const isRain = this.weather === 'hujan';
    this.rainGroup.visible = isRain;

    for (const mat of this.roadMaterials) {
      mat.roughness = isRain ? 0.14 : 0.82;
      mat.metalness = isRain ? 0.52 : 0.08;
      mat.needsUpdate = true;
    }

    if (this.timeOfDay === 'pagi') {
      const skyHex = isRain ? 0x64748b : 0x93c5fd;
      this.scene.background = new THREE.Color(skyHex);
      this.scene.fog = new THREE.FogExp2(skyHex, isRain ? 0.0056 : 0.003);

      this.keyLight.color.setHex(isRain ? 0xcbd5e1 : 0xffedd5);
      this.keyLight.intensity = isRain ? 1.05 : 1.95;

      this.hemiLight.color.setHex(isRain ? 0x64748b : 0xfde68a);
      this.hemiLight.groundColor.setHex(0x365314);
      this.hemiLight.intensity = isRain ? 0.65 : 0.82;

      this.sunGroup.visible = !isRain;
      this.sunCoreMat.color.setHex(0xfef08a);
      this.sunHaloMat.color.setHex(0xfb923c);

      this.moonGroup.visible = false;
      this.starsGroup.visible = false;
      this.cloudMat.color.setHex(isRain ? 0x475569 : 0xfff7ed);
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = isRain ? 1.0 : 0.35));
    } else if (this.timeOfDay === 'siang') {
      const skyHex = isRain ? 0x475569 : 0x7dd3fc;
      this.scene.background = new THREE.Color(skyHex);
      this.scene.fog = new THREE.FogExp2(skyHex, isRain ? 0.0055 : 0.0026);

      this.keyLight.color.setHex(isRain ? 0xcbd5e1 : 0xfffbeb);
      this.keyLight.intensity = isRain ? 1.15 : 2.25;

      this.hemiLight.color.setHex(isRain ? 0x64748b : 0xbae6fd);
      this.hemiLight.groundColor.setHex(0x3f6212);
      this.hemiLight.intensity = isRain ? 0.65 : 0.88;

      this.sunGroup.visible = !isRain;
      this.sunCoreMat.color.setHex(0xfef08a);
      this.sunHaloMat.color.setHex(0xfacc15);

      this.moonGroup.visible = false;
      this.starsGroup.visible = false;
      this.cloudMat.color.setHex(isRain ? 0x475569 : 0xffffff);
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = isRain ? 1.1 : 0.15));
    } else if (this.timeOfDay === 'sore') {
      const skyHex = isRain ? 0x334155 : 0xfb923c;
      this.scene.background = new THREE.Color(skyHex);
      this.scene.fog = new THREE.FogExp2(skyHex, isRain ? 0.006 : 0.0032);

      this.keyLight.color.setHex(isRain ? 0x94a3b8 : 0xf97316);
      this.keyLight.intensity = isRain ? 0.95 : 1.85;

      this.hemiLight.color.setHex(isRain ? 0x475569 : 0xfdba74);
      this.hemiLight.groundColor.setHex(0x431407);
      this.hemiLight.intensity = 0.72;

      this.sunGroup.visible = !isRain;
      this.sunCoreMat.color.setHex(0xfed7aa);
      this.sunHaloMat.color.setHex(0xea580c);

      this.moonGroup.visible = false;
      this.starsGroup.visible = false;
      this.cloudMat.color.setHex(isRain ? 0x334155 : 0xfed7aa);
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = 1.5));
    } else {
      const skyHex = isRain ? 0x060911 : 0x090d16;
      this.scene.background = new THREE.Color(skyHex);
      this.scene.fog = new THREE.FogExp2(skyHex, isRain ? 0.0065 : 0.0035);

      this.keyLight.color.setHex(0x60a5fa);
      this.keyLight.intensity = isRain ? 0.45 : 0.68;

      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.52;

      this.sunGroup.visible = false;
      this.moonGroup.visible = !isRain;
      this.starsGroup.visible = !isRain;
      this.cloudMat.color.setHex(isRain ? 0x1e293b : 0x475569);
      this.streetLampBulbs.forEach((m) => (m.emissiveIntensity = 2.4));
    }

    this.updateCelestialOrbit();
  }

  private updateCelestialOrbit() {
    const h = ((this.clockHour % 24) + 24) % 24;
    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    if (h >= 5.5 && h < 18.5) {
      // Sun arcs smoothly from East (+145) at 05:30 to High Noon (0) at 12:00 to West (-145) at 18:30
      const dayT = (h - 5.5) / 13.0; // 0..1
      const angle = dayT * Math.PI; // 0..PI
      const sunX = Math.cos(angle) * 145;
      const sunY = Math.max(18, Math.sin(angle) * 98);
      const sunZ = -148;
      this.sunGroup.position.set(sunX, sunY, sunZ);
      this.keyLight.position.set(
        activePos.x + Math.cos(angle) * 75,
        Math.max(35, Math.sin(angle) * 85),
        activePos.z + 55
      );
    } else {
      // Moon arcs across the nocturnal sky from 18:30 to 05:30
      const nightElapsed = h >= 18.5 ? h - 18.5 : h + 5.5;
      const nightT = nightElapsed / 11.0; // 0..1
      const angle = nightT * Math.PI;
      const moonX = Math.cos(angle) * 135;
      const moonY = Math.max(24, Math.sin(angle) * 86);
      this.moonGroup.position.set(moonX, moonY, -145);
      this.keyLight.position.set(
        activePos.x + moonX * 0.5,
        Math.max(45, moonY),
        activePos.z - 45
      );
    }
  }

  private updateSkyAndWeather(dt: number) {
    // 1. Atmospheric Day-Night Progression (Pagi -> Siang -> Sore -> Malam)
    // Relaxed progression: ~0.045 game hours per second (~22 real seconds per game hour, ~9 mins full 24h cycle)
    if (this.autoTime) {
      this.clockHour = (this.clockHour + dt * 0.045) % 24;
      const nextPhase = this.getPhaseFromHour(this.clockHour);
      if (nextPhase !== this.timeOfDay) {
        this.timeOfDay = nextPhase;
        this.applyAtmosphere();
      } else {
        this.updateCelestialOrbit();
      }
    }

    // Rotate starry celestial canopy subtly and twinkle major stars at night
    if (this.starsGroup && this.starsGroup.visible) {
      this.starsGroup.rotation.y += dt * 0.0035;
      if (this.brightStarsPoints) {
        const twinkle = Math.sin(performance.now() * 0.0035) * 0.16 + 0.84;
        (this.brightStarsPoints.material as THREE.PointsMaterial).opacity = twinkle;
      }
    }

    // 2. Drift Volumetric 3D Clouds (faster during rainstorms)
    const windMultiplier = this.weather === 'hujan' ? 2.4 : 1.0;
    for (const c of this.cloudGroups) {
      c.group.position.x += c.speed * windMultiplier * dt;
      if (c.group.position.x > 185) {
        c.group.position.x = -185;
      }
    }

    // 3. Dynamic Three.js Rain Particle System + Lightning & Thunder
    if (this.weather === 'hujan' && this.rainGroup.visible) {
      const activePos = this.drivenVehicle
        ? this.drivenVehicle.mesh.position
        : this.playerPos;
      this.rainGroup.position.set(activePos.x, 0, activePos.z);

      // 3A. Animate slanted falling rain streaks (LineSegments)
      const posAttr = this.rainLines.geometry.attributes
        .position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const fallStep = 38 * dt;
      const windStepX = -6.5 * dt;

      for (let i = 0; i < this.rainDropsCount; i++) {
        let rx = arr[i * 6] + windStepX;
        let yTop = arr[i * 6 + 1] - fallStep;
        if (yTop < 0.2) {
          yTop = 32 + Math.random() * 5;
          rx = (Math.random() - 0.5) * 76;
        }
        if (rx < -38) rx += 76;
        arr[i * 6] = rx;
        arr[i * 6 + 1] = yTop;
        arr[i * 6 + 3] = rx - 0.34;
        arr[i * 6 + 4] = yTop - 1.85;
      }
      posAttr.needsUpdate = true;

      // 3B. Animate Three.js Rain Droplet & Mist Particles (Points)
      const partAttr = this.rainParticles.geometry.attributes
        .position as THREE.BufferAttribute;
      const pArr = partAttr.array as Float32Array;
      const pFallStep = 24 * dt;
      const pWindX = -4.8 * dt;

      for (let i = 0; i < this.rainParticleCount; i++) {
        let px = pArr[i * 3] + pWindX;
        let py = pArr[i * 3 + 1] - pFallStep;
        if (py < 0.15) {
          py = 25 + Math.random() * 4;
          px = (Math.random() - 0.5) * 68;
        }
        if (px < -34) px += 68;
        pArr[i * 3] = px;
        pArr[i * 3 + 1] = py;
      }
      partAttr.needsUpdate = true;

      // 3C. Animate Ground Rain Splash Ripples on wet asphalt (InstancedMesh)
      for (let i = 0; i < this.rainSplashCount; i++) {
        let phase = this.rainSplashPhases[i] + dt * 3.4;
        if (phase >= 1.0) {
          phase -= 1.0;
          this.rainSplashPositions[i * 2] = (Math.random() - 0.5) * 48;
          this.rainSplashPositions[i * 2 + 1] = (Math.random() - 0.5) * 48;
        }
        this.rainSplashPhases[i] = phase;
        const sx = this.rainSplashPositions[i * 2];
        const sz = this.rainSplashPositions[i * 2 + 1];
        const rippleScale = 0.25 + phase * 1.45;
        _dummyObj.position.set(sx, 0.05, sz);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.setScalar(rippleScale);
        _dummyObj.updateMatrix();
        this.rainSplashes.setMatrixAt(i, _dummyObj.matrix);
      }
      this.rainSplashes.instanceMatrix.needsUpdate = true;

      // 3D. Periodic Storm Lightning Flash & Thunder Rumble
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 14 + Math.random() * 12;
        this.lightningFlash = 1.0;
        soundFX.playThunderRumble();
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);
        this.keyLight.intensity = 1.15 + this.lightningFlash * 2.2;
      }
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
    if (label.includes('Rumah Pribadi')) {
      this.performHomeAction('enter');
      return;
    }
    // Orient player/vehicle toward the landmark they teleported to
    let targetHeading = Math.PI;
    if (
      label.includes('Surabaya') ||
      label.includes('Taman Kota') ||
      label.includes('SMA Negeri') ||
      label.includes('Sekolah')
    ) {
      targetHeading = 0; // Face +Z (South) toward the entrance of Taman Surabaya (90,30), Taman Kota (-30,90), or Sekolah (30,90)
    } else if (label.includes('Monas')) {
      targetHeading = Math.PI; // Face -Z (North) toward Taman Tugu Monas at (-90, -30)
    }
    this.playerHomeState = 'standing';
    this.resetPlayerLimbPosture();
    this.wasInsideHome = this.isPlayerInsideHome(x, z);
    if (this.playerHouseRoof) {
      this.playerHouseRoof.visible = !this.wasInsideHome;
    }
    if (this.drivenVehicle) {
      this.drivenVehicle.mesh.position.set(x, 0, z);
      this.drivenVehicle.heading = targetHeading;
      this.drivenVehicle.mesh.rotation.y = targetHeading;
      this.drivenVehicle.speed = 0;
    } else {
      this.playerPos.set(x, this.wasInsideHome ? 0.14 : 0, z);
      this.playerHeading = targetHeading;
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, targetHeading, 0);
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
    if (Math.hypot(x, z) > 195) return true;
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

  private isPlayerInsideHome(x = this.playerPos.x, z = this.playerPos.z): boolean {
    return x >= -22.6 && x <= -13.1 && z >= 18.7 && z <= 29.3;
  }

  private isPlayerNearHomeDoor(x = this.playerPos.x, z = this.playerPos.z): boolean {
    return Math.hypot(x - -12.5, z - 24.0) <= 4.5;
  }

  private triggerHomeTransition(
    direction: 'out' | 'in' | 'sleep',
    title: string,
    subtitle: string
  ) {
    this.homeTransition = { direction, title, subtitle };
    this.homeTransitionTimer = direction === 'sleep' ? 1.8 : 1.35;
    soundFX.playInteractChime();
    this.showNotification(title, subtitle, 'info');
    this.broadcastHud(true);
  }

  public performHomeAction(
    action: 'sleep' | 'eat' | 'sit' | 'stand' | 'exit' | 'enter'
  ) {
    if (this.drivenVehicle && action !== 'enter') return;

    if (action === 'enter') {
      if (this.drivenVehicle) {
        this.drivenVehicle.speed = 0;
        this.drivenVehicle = null;
        this.playerMesh.visible = true;
      }
      this.playerHomeState = 'standing';
      this.playerPos.set(-17.6, 0.14, 24.0);
      this.playerHeading = -Math.PI / 2; // Facing West toward living room interior
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, this.playerHeading, 0);
      this.wasInsideHome = true;
      if (this.playerHouseRoof) this.playerHouseRoof.visible = false;
      this.triggerHomeTransition(
        'in',
        'Masuk ke Rumah Pribadi',
        'Selamat datang di rumah! Kamu bisa Tidur di Kasur, Makan di Meja Makan, atau Duduk di Sofa.'
      );
      return;
    }

    if (action === 'exit') {
      this.playerHomeState = 'standing';
      this.resetPlayerLimbPosture();
      this.playerPos.set(-10.2, 0, 24.0);
      this.playerHeading = Math.PI / 2; // Facing East toward street & parked Bajaj
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, this.playerHeading, 0);
      this.wasInsideHome = false;
      if (this.playerHouseRoof) this.playerHouseRoof.visible = true;
      this.triggerHomeTransition(
        'out',
        'Keluar dari Rumah Pribadi',
        'Melangkah keluar menuju jalan raya Kota Nusantara! Kendaraanmu siap di tepi jalan.'
      );
      return;
    }

    if (action === 'stand') {
      this.playerHomeState = 'standing';
      this.resetPlayerLimbPosture();
      this.playerPos.set(-17.8, 0.14, 24.0);
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, this.playerHeading, 0);
      soundFX.playInteractChime();
      this.broadcastHud(true);
      return;
    }

    if (action === 'sit') {
      if (this.playerHomeState === 'sitting') {
        this.performHomeAction('stand');
        return;
      }
      // Sit on the plush living room sofa (-16.4, 0.25, 25.65) facing North (+Z -> heading 0) toward LED TV
      this.playerHomeState = 'sitting';
      this.playerPos.set(-16.4, 0.25, 25.65);
      this.playerHeading = 0;
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, this.playerHeading, 0);
      this.wasInsideHome = true;
      if (this.playerHouseRoof) this.playerHouseRoof.visible = false;
      soundFX.playInteractChime();
      this.showNotification(
        'Duduk Bersantai di Sofa Ruang Tamu',
        'Menonton TV LED sambil menikmati suasana rumah. Gerakkan analog / WASD untuk berdiri.',
        'info'
      );
      this.broadcastHud(true);
      return;
    }

    if (action === 'eat') {
      // Sit at Dining Table chair (-19.6, 0.25, 22.0) facing the Nasi Goreng & Tudung Saji (-Z -> Math.PI)
      this.playerHomeState = 'eating';
      this.homeActionTimer = 3.5;
      this.playerPos.set(-19.6, 0.25, 22.0);
      this.playerHeading = Math.PI;
      this.playerMesh.position.copy(this.playerPos);
      this.playerMesh.rotation.set(0, this.playerHeading, 0);
      this.wasInsideHome = true;
      if (this.playerHouseRoof) this.playerHouseRoof.visible = false;
      this.health = this.maxHealth;
      soundFX.playCashReward();
      this.showNotification(
        'Makan Masakan Rumah (Gratis!)',
        'Nasi Goreng Spesial & Es Teh Manis buatan rumah memulihkan Darah hingga 100% Penuh!',
        'success'
      );
      this.broadcastHud(true);
      return;
    }

    if (action === 'sleep') {
      // Lie down on the Bedroom Bed (-20.5, 0.62, 27.4) with Guling & Pillow
      this.playerHomeState = 'sleeping';
      this.homeActionTimer = 2.6;
      this.playerPos.set(-20.5, 0.62, 27.4);
      this.playerHeading = Math.PI / 2;
      this.playerMesh.position.copy(this.playerPos);
      this.wasInsideHome = true;
      if (this.playerHouseRoof) this.playerHouseRoof.visible = false;

      // Full heal, clear wanted stars, and advance clock by 6 hours
      this.health = this.maxHealth;
      this.wantedStars = 0;
      this.clockHour = (this.clockHour + 6.0) % 24;
      this.timeOfDay = this.getPhaseFromHour(this.clockHour);
      this.applyAtmosphere();

      this.triggerHomeTransition(
        'sleep',
        'Tidur Nyenyak di Kasur Rumah',
        `Bangun segar bugar pukul ${this.formatClockHour(this.clockHour)}! Darah 100% Penuh & Bintang Polisi bersih.`
      );
      return;
    }
  }

  private resetPlayerLimbPosture() {
    if (!this.playerMesh) return;
    this.playerMesh.rotation.x = 0;
    this.playerMesh.rotation.z = 0;
    const limbs = this.playerMesh.userData.limbs;
    if (limbs) {
      limbs.leftLeg.rotation.set(0, 0, 0);
      limbs.rightLeg.rotation.set(0, 0, 0);
      limbs.leftArm.rotation.set(0, 0, 0);
      limbs.rightArm.rotation.set(0, 0, 0);
    }
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

    // If player is sleeping, eating, or sitting in their house:
    if (this.playerHomeState !== 'standing') {
      if (this.homeActionTimer > 0) {
        this.homeActionTimer -= dt;
        if (this.homeActionTimer <= 0 && this.playerHomeState === 'sleeping') {
          // Wake up and stand neatly beside the bed!
          this.playerHomeState = 'standing';
          this.resetPlayerLimbPosture();
          this.playerPos.set(-19.0, 0.14, 26.2);
          this.playerMesh.position.copy(this.playerPos);
          this.broadcastHud(true);
        }
      }

      // Moving joystick or pressing W/S/Space stands the player up immediately (after sleep fade finishes)
      if (
        this.homeTransitionTimer <= 0.2 &&
        (Math.abs(forwardInput) > 0.15 || Math.abs(turnInput) > 0.2 || this.keys['Space'])
      ) {
        this.playerHomeState = 'standing';
        this.resetPlayerLimbPosture();
        this.playerPos.y = 0.14;
      } else {
        // Pose character limbs for Sitting, Eating, or Sleeping!
        this.playerMesh.position.copy(this.playerPos);
        const limbs = this.playerMesh.userData.limbs;
        if (this.playerHomeState === 'sleeping') {
          this.playerMesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
          if (limbs) {
            limbs.leftLeg.rotation.x = 0;
            limbs.rightLeg.rotation.x = 0;
            limbs.leftArm.rotation.x = -0.2;
            limbs.rightArm.rotation.x = -0.2;
          }
        } else if (this.playerHomeState === 'sitting') {
          this.playerMesh.rotation.set(0, this.playerHeading, 0);
          if (limbs) {
            limbs.leftLeg.rotation.x = -Math.PI / 2.2;
            limbs.rightLeg.rotation.x = -Math.PI / 2.2;
            limbs.leftArm.rotation.x = -0.45;
            limbs.rightArm.rotation.x = -0.45;
          }
        } else if (this.playerHomeState === 'eating') {
          this.playerMesh.rotation.set(0, this.playerHeading, 0);
          if (limbs) {
            limbs.leftLeg.rotation.x = -Math.PI / 2.2;
            limbs.rightLeg.rotation.x = -Math.PI / 2.2;
            limbs.leftArm.rotation.x = -0.6;
            limbs.rightArm.rotation.x =
              -0.95 + Math.sin(performance.now() * 0.008) * 0.35;
          }
        }
        return;
      }
    }

    const isSprinting =
      this.keys['ShiftLeft'] ||
      this.keys['ShiftRight'] ||
      this.virtualInput.sprint;
    const moveSpeed = isSprinting ? 11.5 : 7.2;

    if (Math.abs(turnInput) > 0.05) {
      this.playerHeading += THREE.MathUtils.clamp(turnInput, -1, 1) * 3.0 * dt;
    }

    if (Math.abs(forwardInput) > 0.05) {
      const clampedFwd = THREE.MathUtils.clamp(forwardInput, -1, 1);
      const step = clampedFwd * moveSpeed * dt;
      const nextX = this.playerPos.x + Math.sin(this.playerHeading) * step;
      const nextZ = this.playerPos.z + Math.cos(this.playerHeading) * step;

      if (!this.checkBuildingCollision(nextX, this.playerPos.z, 0.52)) {
        this.playerPos.x = nextX;
      }
      if (!this.checkBuildingCollision(this.playerPos.x, nextZ, 0.52)) {
        this.playerPos.z = nextZ;
      }

      this.playerWalkCycle +=
        dt * (isSprinting ? 14 : 9) * Math.max(0.45, Math.abs(clampedFwd));
    } else {
      this.playerWalkCycle = 0;
    }

    const insideNow = this.isPlayerInsideHome(this.playerPos.x, this.playerPos.z);
    const floorY = insideNow ? 0.14 : 0;

    if (this.keys['Space'] && this.playerPos.y <= floorY + 0.02) {
      this.playerVelocityY = 6.8;
    }
    if (this.playerPos.y > floorY || this.playerVelocityY !== 0) {
      this.playerPos.y += this.playerVelocityY * dt;
      this.playerVelocityY -= 18.0 * dt;
      if (this.playerPos.y <= floorY) {
        this.playerPos.y = floorY;
        this.playerVelocityY = 0;
      }
    } else {
      this.playerPos.y = floorY;
    }

    // Check if player just walked out or in through the front door of their house!
    if (this.wasInsideHome !== insideNow) {
      this.wasInsideHome = insideNow;
      if (this.playerHouseRoof) {
        this.playerHouseRoof.visible = !insideNow;
      }
      if (!insideNow) {
        this.triggerHomeTransition(
          'out',
          'Keluar dari Rumah Pribadi',
          'Melangkah keluar menuju jalan raya Kota Nusantara!'
        );
      } else {
        this.triggerHomeTransition(
          'in',
          'Masuk ke Rumah Pribadi',
          'Selamat datang kembali di rumah pribadimu!'
        );
      }
    }

    // Smoothly swing the front wooden door open when player is near the doorway
    if (this.playerHouseDoorPivot) {
      const distDoor = Math.hypot(this.playerPos.x - -13.3, this.playerPos.z - 24.0);
      const targetDoorAngle = distDoor < 4.2 || insideNow ? -Math.PI * 0.58 : -Math.PI * 0.08;
      this.playerHouseDoorPivot.rotation.y = THREE.MathUtils.damp(
        this.playerHouseDoorPivot.rotation.y,
        targetDoorAngle,
        6.0,
        dt
      );
    }

    this.playerMesh.position.copy(this.playerPos);
    this.playerMesh.rotation.set(0, this.playerHeading, 0);

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
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.2, dt);
    }

    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 7.5, dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, -v.maxSpeed * 0.45, v.maxSpeed);

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
    v.mesh.rotation.z = THREE.MathUtils.damp(
      v.mesh.rotation.z,
      -steer * (Math.abs(v.speed) / v.maxSpeed) * 0.09,
      8,
      dt
    );

    const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
    if (wheels) {
      wheels.forEach((w) => {
        w.rotation.x += v.speed * dt * 1.8;
      });
    }

    this.playerPos.copy(v.mesh.position);
    this.playerHeading = v.heading;

    if (Math.abs(v.speed) > 1.2) {
      soundFX.playEnginePulse(v.speed / v.maxSpeed, v.type);
    }
  }

  private updateAITrafficAndPedestrians(dt: number, elapsed: number) {
    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    // 1. Update AI Vehicles along their strict Left-Hand Road Lane Waypoints
    for (const v of this.vehicles) {
      if (v === this.drivenVehicle) continue;

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

      if (!v.isAI || v.waypoints.length === 0) continue;

      // =====================================================================
      // ACTIVE POLICE OFF-ROAD PURSUIT MODE (Khusus Pengejaran Mobil Polisi)
      // When wantedStars > 0 and player is outside their safehouse, police cars
      // break off their road loop and chase the player directly (off-road allowed!)
      // =====================================================================
      const isPoliceChasing =
        v.type === 'polisi' && this.wantedStars > 0 && !this.wasInsideHome;

      if (isPoliceChasing) {
        let toPlayerX = activePos.x - v.mesh.position.x;
        let toPlayerZ = activePos.z - v.mesh.position.z;
        let distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

        // If police unit is very far (> 110m), relocate it to an open spot ~52m around player so chase feels active
        if (distToPlayer > 110) {
          const baseAngle =
            (this.drivenVehicle ? this.drivenVehicle.heading : this.playerHeading) +
            Math.PI +
            (Math.random() - 0.5) * 1.4;
          for (let attempt = 0; attempt < 6; attempt++) {
            const tryAngle = baseAngle + attempt * 0.9;
            const spawnDist = 48 + (attempt % 2) * 10;
            const tx = THREE.MathUtils.clamp(
              activePos.x + Math.sin(tryAngle) * spawnDist,
              -175,
              175
            );
            const tz = THREE.MathUtils.clamp(
              activePos.z + Math.cos(tryAngle) * spawnDist,
              -175,
              175
            );
            if (!this.checkBuildingCollision(tx, tz, 2.2)) {
              v.mesh.position.set(tx, 0, tz);
              v.heading = Math.atan2(activePos.x - tx, activePos.z - tz);
              toPlayerX = activePos.x - tx;
              toPlayerZ = activePos.z - tz;
              distToPlayer = Math.hypot(toPlayerX, toPlayerZ);
              break;
            }
          }
        }

        // Direct off-road heading toward player
        let desiredHeading = Math.atan2(toPlayerX, toPlayerZ);

        // Smart building obstacle avoidance while cutting off-road across sidewalks/parks/alleys
        const lookAhead = 4.4;
        const probeX = v.mesh.position.x + Math.sin(desiredHeading) * lookAhead;
        const probeZ = v.mesh.position.z + Math.cos(desiredHeading) * lookAhead;
        if (this.checkBuildingCollision(probeX, probeZ, 1.45)) {
          const candidateOffsets = [0.55, -0.55, 1.05, -1.05, 1.55, -1.55, 2.1, -2.1];
          for (const offset of candidateOffsets) {
            const testH = desiredHeading + offset;
            const tx = v.mesh.position.x + Math.sin(testH) * lookAhead;
            const tz = v.mesh.position.z + Math.cos(testH) * lookAhead;
            if (!this.checkBuildingCollision(tx, tz, 1.4)) {
              desiredHeading = testH;
              break;
            }
          }
        }

        let angleDiff = desiredHeading - v.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const chaseTurnRate = 7.2;
        v.heading +=
          Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), chaseTurnRate * dt);

        const chaseMaxSpeed = 18.0 + this.wantedStars * 1.6;
        v.speed = THREE.MathUtils.damp(v.speed, chaseMaxSpeed, 4.5, dt);

        const stepX = v.mesh.position.x + Math.sin(v.heading) * v.speed * dt;
        const stepZ = v.mesh.position.z + Math.cos(v.heading) * v.speed * dt;

        // Allow free off-road movement anywhere outside solid building colliders
        let moved = false;
        if (!this.checkBuildingCollision(stepX, v.mesh.position.z, 1.3)) {
          v.mesh.position.x = stepX;
          moved = true;
        }
        if (!this.checkBuildingCollision(v.mesh.position.x, stepZ, 1.3)) {
          v.mesh.position.z = stepZ;
          moved = true;
        }
        if (!moved) {
          // Reverse & turn away if wedged against a building corner
          v.heading += 1.25;
          v.speed = -6.0;
        }

        v.mesh.rotation.y = v.heading;
        v.mesh.rotation.z = THREE.MathUtils.damp(
          v.mesh.rotation.z,
          -angleDiff * 0.1,
          7,
          dt
        );

        const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
        if (wheels) {
          wheels.forEach((w) => {
            w.rotation.x += v.speed * dt * 1.8;
          });
        }

        // Check Police Pursuit Intercept / Ramming against Player
        const hitRadius = this.drivenVehicle ? 3.2 : 2.3;
        if (distToPlayer < hitRadius) {
          const lastHit = (v.mesh.userData.lastHitTime as number) || 0;
          if (elapsed - lastHit > 1.15) {
            v.mesh.userData.lastHitTime = elapsed;
            soundFX.playImpactThud();
            this.wantedDecayTimer = Math.max(this.wantedDecayTimer, 30);

            if (this.drivenVehicle) {
              this.drivenVehicle.speed *= -0.35;
              v.speed = -6.5;
              this.health = Math.max(0, this.health - 6);
              this.showNotification(
                'Disergap Mobil Patroli Polisi! (-6 HP)',
                'Polisi menabrak kendaraanmu! Segera menghindar ke Bengkel Cat atau Rumah Pribadi!',
                'warning'
              );
            } else {
              // Knock player slightly back on foot
              const pushH = Math.atan2(toPlayerX, toPlayerZ);
              const px = this.playerPos.x + Math.sin(pushH) * 1.8;
              const pz = this.playerPos.z + Math.cos(pushH) * 1.8;
              if (!this.checkBuildingCollision(px, pz, 0.55)) {
                this.playerPos.x = px;
                this.playerPos.z = pz;
              }
              v.speed = -5.0;
              this.health = Math.max(0, this.health - 8);
              this.showNotification(
                'Tertabrak Mobil Polisi! (-8 HP)',
                'Lari ke gang sempit, masuk kendaraan, atau sembunyi di Rumah Pribadi!',
                'warning'
              );
            }

            if (this.health <= 0) {
              this.money = Math.max(0, this.money - 15000);
              this.health = this.maxHealth;
              this.wantedStars = 0;
              this.showNotification(
                'Tertangkap Polisi! (Denda Rp 15.000)',
                'Status buronan dibersihkan dan kesehatanmu telah pulih kembali.',
                'warning'
              );
            }
            this.broadcastHud(true);
          }
        }
        continue;
      }

      const prevWP = v.waypoints[(v.waypointIdx - 1 + v.waypoints.length) % v.waypoints.length];
      const currWP = v.waypoints[v.waypointIdx];
      const nextWP = v.waypoints[(v.waypointIdx + 1) % v.waypoints.length];

      const dx = currWP.x - v.mesh.position.x;
      const dz = currWP.z - v.mesh.position.z;
      const distToWP = Math.hypot(dx, dz);

      // Check segment orientation
      const isNS = Math.abs(prevWP.x - currWP.x) < 1.0;
      const isEW = Math.abs(prevWP.z - currWP.z) < 1.0;
      const currentSegHeading = Math.atan2(currWP.x - prevWP.x, currWP.z - prevWP.z);
      const nextSegHeading = Math.atan2(nextWP.x - currWP.x, nextWP.z - currWP.z);

      let cornerAngle = nextSegHeading - currentSegHeading;
      while (cornerAngle > Math.PI) cornerAngle -= Math.PI * 2;
      while (cornerAngle < -Math.PI) cornerAngle += Math.PI * 2;
      const isApproachingCorner = Math.abs(cornerAngle) > 0.35;

      // Waypoint Arrival: Advance to next segment when vehicle reaches intersection center
      if (distToWP < 2.5) {
        v.waypointIdx = (v.waypointIdx + 1) % v.waypoints.length;
      }

      // Smooth heading target: follow segment towards target WP, or blend into corner turn when near
      let desiredHeading = Math.atan2(currWP.x - v.mesh.position.x, currWP.z - v.mesh.position.z);
      if (isApproachingCorner && distToWP <= 3.2) {
        const turnBlend = 1.0 - distToWP / 3.2;
        desiredHeading = currentSegHeading + cornerAngle * turnBlend;
      }

      let angleDiff = desiredHeading - v.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const isSharpTurn = Math.abs(angleDiff) > 0.35;
      const turnRate = isSharpTurn ? 9.2 : 5.2;
      v.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);

      // Smart Lane Spacing & Traffic Light Compliance
      const forwardX = Math.sin(v.heading);
      const forwardZ = Math.cos(v.heading);
      let shouldYield = false;
      let stoppedByRedLight = false;

      // Yield for Red/Yellow Traffic Light at approaching intersections
      for (const inter of this.trafficLightSystems) {
        const idx = inter.center.x - v.mesh.position.x;
        const idz = inter.center.z - v.mesh.position.z;
        const distToCenter = Math.hypot(idx, idz);

        // Approaching intersection zone (between stop line ~7.5m and detection distance 26m)
        if (distToCenter > 7.5 && distToCenter < 26.0) {
          const approachDot = (idx * forwardX + idz * forwardZ) / distToCenter;
          if (approachDot > 0.72) {
            const isNorthSouth = Math.abs(forwardZ) >= Math.abs(forwardX);
            const activeLightState = isNorthSouth ? inter.nsState : inter.ewState;
            if (activeLightState === 'red' || activeLightState === 'yellow') {
              shouldYield = true;
              stoppedByRedLight = true;
              break;
            }
          }
        }
      }

      // Yield for player on foot if directly in front on road / crosswalk
      if (!shouldYield && !this.drivenVehicle) {
        const pdx = this.playerPos.x - v.mesh.position.x;
        const pdz = this.playerPos.z - v.mesh.position.z;
        const pDist = Math.hypot(pdx, pdz);
        if (pDist < 7.0 && pDist > 0.1) {
          const dot = (pdx * forwardX + pdz * forwardZ) / pDist;
          if (dot > 0.75) shouldYield = true;
        }
      }

      // Yield for any vehicle directly ahead in the same lane (< 9.0m)
      if (!shouldYield) {
        for (const other of this.vehicles) {
          if (other === v) continue;
          const odx = other.mesh.position.x - v.mesh.position.x;
          const odz = other.mesh.position.z - v.mesh.position.z;
          const oDist = Math.hypot(odx, odz);
          if (oDist < 9.0 && oDist > 0.1) {
            const dot = (odx * forwardX + odz * forwardZ) / oDist;
            if (dot > 0.82) {
              shouldYield = true;
              break;
            }
          }
        }
      }

      // Anti-stuck watchdog: Ensure vehicles keep moving continuously and never freeze indefinitely
      if (!stoppedByRedLight && v.speed < 0.6) {
        v.stuckTimer = (v.stuckTimer || 0) + dt;
        if (v.stuckTimer > 3.0) {
          v.speed = Math.max(v.speed, 6.0);
          v.waypointIdx = (v.waypointIdx + 1) % v.waypoints.length;
          v.stuckTimer = 0;
          shouldYield = false;
        }
      } else {
        v.stuckTimer = 0;
      }

      const baseCruise =
        v.type === 'ojol_motor'
          ? 15.0
          : v.type === 'polisi'
          ? 14.0
          : v.type === 'angkot'
          ? 12.5
          : 11.2;

      // Pre-turn Braking: decelerate smoothly when approaching intersection turns to prevent overshooting
      let targetSpeed: number;
      if (shouldYield) {
        targetSpeed = 0;
      } else if (isApproachingCorner && distToWP < 12.0) {
        const cornerSpeed = v.type === 'ojol_motor' ? 5.8 : 4.8;
        const approachRatio = Math.max(0, distToWP / 12.0);
        targetSpeed = THREE.MathUtils.lerp(cornerSpeed, baseCruise, approachRatio);
      } else if (isSharpTurn) {
        targetSpeed = baseCruise * 0.52;
      } else {
        targetSpeed = baseCruise;
      }

      v.speed = THREE.MathUtils.damp(
        v.speed,
        targetSpeed,
        shouldYield ? 8.5 : 3.5,
        dt
      );

      // Advance vehicle position
      let nx = v.mesh.position.x + Math.sin(v.heading) * v.speed * dt;
      let nz = v.mesh.position.z + Math.cos(v.heading) * v.speed * dt;

      // Active Lane-Centering (Cross-Track Error Correction) along straight road corridors
      if (distToWP > 4.0 && v.type !== 'polisi') {
        if (isNS) {
          nx = THREE.MathUtils.damp(nx, currWP.x, 7.5, dt);
        } else if (isEW) {
          nz = THREE.MathUtils.damp(nz, currWP.z, 7.5, dt);
        }
      }

      // Airtight Road Corridor Boundary Safety Net (for civilian vehicles; police cars can smoothly return from off-road)
      let minDiffX = 999;
      let nearestGX = 0;
      for (const gx of ROAD_GRID_LINES) {
        const diff = Math.abs(nx - gx);
        if (diff < minDiffX) {
          minDiffX = diff;
          nearestGX = gx;
        }
      }

      let minDiffZ = 999;
      let nearestGZ = 0;
      for (const gz of ROAD_GRID_LINES) {
        const diff = Math.abs(nz - gz);
        if (diff < minDiffZ) {
          minDiffZ = diff;
          nearestGZ = gz;
        }
      }

      // Asphalt roadway width is 14m (center ±7.0m). Safe vehicle envelope is ±5.6m.
      const SAFE_ROAD_HALF_WIDTH = 5.6;
      if (
        v.type !== 'polisi' &&
        minDiffX > SAFE_ROAD_HALF_WIDTH &&
        minDiffZ > SAFE_ROAD_HALF_WIDTH
      ) {
        if (minDiffX <= minDiffZ) {
          const sign = Math.sign(nx - nearestGX) || 1;
          nx = nearestGX + sign * SAFE_ROAD_HALF_WIDTH;
        } else {
          const sign = Math.sign(nz - nearestGZ) || 1;
          nz = nearestGZ + sign * SAFE_ROAD_HALF_WIDTH;
        }
      }

      v.mesh.position.set(nx, 0, nz);
      v.mesh.rotation.y = v.heading;
      v.mesh.rotation.z = THREE.MathUtils.damp(
        v.mesh.rotation.z,
        -angleDiff * 0.08,
        6,
        dt
      );

      // Distance culling for AI vehicle details (skip wheels if far from camera)
      const distToCamSq = (v.mesh.position.x - activePos.x) ** 2 + (v.mesh.position.z - activePos.z) ** 2;
      if (distToCamSq < 130 * 130) {
        const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
        if (wheels && v.speed > 0.2) {
          wheels.forEach((w) => {
            w.rotation.x += v.speed * dt * 1.6;
          });
        }
      }

      if (this.drivenVehicle) {
        const distVeh = Math.hypot(
          v.mesh.position.x - this.drivenVehicle.mesh.position.x,
          v.mesh.position.z - this.drivenVehicle.mesh.position.z
        );
        if (distVeh < 3.0 && Math.abs(this.drivenVehicle.speed) > 6.5) {
          soundFX.playImpactThud();
          this.drivenVehicle.speed *= -0.4;
          const addedStars = v.type === 'polisi' ? 2 : 1;
          this.wantedStars = Math.min(5, this.wantedStars + addedStars);
          this.wantedDecayTimer = 35;
          this.showNotification(
            v.type === 'polisi'
              ? `Menabrak Mobil Patroli! (${'★'.repeat(this.wantedStars)})`
              : `Tabrak Lari di Jalan Raya! (${'★'.repeat(this.wantedStars)})`,
            'Mobil Patroli Polisi sedang mengejarmu lintas jalur! Pergi ke Bengkel Cat atau Rumah Pribadi.',
            'warning'
          );
          this.broadcastHud(true);
        }
      }
    }

    // 2. Update Sidewalk & Park Pedestrians along their loops with obstacle avoidance & distance culling
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const distSq = (p.mesh.position.x - activePos.x) ** 2 + (p.mesh.position.z - activePos.z) ** 2;
      const isVisible = distSq < 85 * 85;
      p.mesh.visible = isVisible;

      const wp = p.waypoints[p.waypointIdx];
      const dx = wp.x - p.mesh.position.x;
      const dz = wp.z - p.mesh.position.z;
      if (Math.hypot(dx, dz) < 1.0) {
        p.waypointIdx = (p.waypointIdx + 1) % p.waypoints.length;
      }

      // If outside visible range, coarse positional step only, skip all limb rotations
      if (!isVisible) {
        const nextWP = p.waypoints[p.waypointIdx];
        p.heading = Math.atan2(
          nextWP.x - p.mesh.position.x,
          nextWP.z - p.mesh.position.z
        );
        p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
        p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;
        continue;
      }

      // Active Sidewalk Obstacle Avoidance: Do not halt; fluidly sidestep around people in front
      const fwdX = Math.sin(p.heading);
      const fwdZ = Math.cos(p.heading);
      const rightX = Math.cos(p.heading);
      const rightZ = -Math.sin(p.heading);

      let avoidDir = 0;
      let maxAvoidWeight = 0;

      // 1) Avoid player walking on foot
      if (!this.drivenVehicle) {
        const pdx = activePos.x - p.mesh.position.x;
        const pdz = activePos.z - p.mesh.position.z;
        const pDist = Math.hypot(pdx, pdz);
        if (pDist < 3.2 && pDist > 0.05) {
          const pFwd = pdx * fwdX + pdz * fwdZ;
          const pRight = pdx * rightX + pdz * rightZ;
          if (pFwd > 0.15 && pFwd < 2.9 && Math.abs(pRight) < 1.45) {
            const weight = 1.0 - pFwd / 2.9;
            const dir = pRight >= 0 ? -1 : 1;
            avoidDir += dir * weight;
            maxAvoidWeight = Math.max(maxAvoidWeight, weight);
          }
        }
      }

      // 2) Avoid nearby pedestrians in path to pass smoothly without stopping
      for (let j = 0; j < this.pedestrians.length; j++) {
        if (i === j) continue;
        const other = this.pedestrians[j];
        const odx = other.mesh.position.x - p.mesh.position.x;
        const odz = other.mesh.position.z - p.mesh.position.z;
        const oDistSq = odx * odx + odz * odz;
        if (oDistSq < 2.8 * 2.8 && oDistSq > 0.04) {
          const oFwd = odx * fwdX + odz * fwdZ;
          const oRight = odx * rightX + odz * rightZ;
          if (oFwd > 0.15 && oFwd < 2.5 && Math.abs(oRight) < 1.3) {
            const weight = 1.0 - oFwd / 2.5;
            const dir = oRight >= 0 ? -1 : 1;
            avoidDir += dir * weight;
            maxAvoidWeight = Math.max(maxAvoidWeight, weight);
          }
        }
      }

      const nextWP = p.waypoints[p.waypointIdx];
      const baseHeading = Math.atan2(
        nextWP.x - p.mesh.position.x,
        nextWP.z - p.mesh.position.z
      );

      // Deflect heading smoothly to sidestep around the obstacle
      const steerDeflection = THREE.MathUtils.clamp(avoidDir, -1.0, 1.0) * 0.68;
      const desiredHeading = baseHeading + steerDeflection;

      let headingDiff = desiredHeading - p.heading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

      const limbs = p.mesh.userData.limbs;

      // Handle Pedestrian State Machine: Walking vs Idle Variations (Waving, Calling, Looking around)
      if (p.state === 'walking') {
        p.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), 7.5 * dt);

        // Continuously walk forward (never freeze or stop when walking)
        p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
        p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;

        // Apply subtle lateral sidestep glide for immediate fluid passing
        if (maxAvoidWeight > 0.2) {
          const sideGlide = Math.sign(avoidDir || -1) * p.speed * 0.42 * maxAvoidWeight * dt;
          p.mesh.position.x += rightX * sideGlide;
          p.mesh.position.z += rightZ * sideGlide;
        }

        p.mesh.rotation.y = p.heading;

        // Fluid continuous walking limb swing animation
        p.walkCycle += dt * (p.speed * 3.1);
        if (limbs) {
          const swing = Math.sin(p.walkCycle) * 0.52;
          limbs.leftLeg.rotation.x = swing;
          limbs.rightLeg.rotation.x = -swing;
          limbs.leftArm.rotation.x = -swing * 0.65;
          limbs.rightArm.rotation.x = swing * 0.65;
          limbs.head.rotation.set(0, 0, 0);
          if (limbs.phone) limbs.phone.visible = false;
        }

        p.walkTimer += dt;
        if (p.walkTimer >= p.walkDuration) {
          const mode = (i + Math.floor(p.walkCycle * 2.3)) % 3;
          if (mode === 0) {
            p.state = 'idle_waving';
            p.idleDuration = 4.2 + (i % 3) * 0.7;
          } else if (mode === 1) {
            p.state = 'idle_calling';
            p.idleDuration = 6.0 + (i % 4) * 0.9;
            if (limbs?.phone) limbs.phone.visible = true;
          } else {
            p.state = 'idle_looking';
            p.idleDuration = 4.5 + (i % 3) * 0.8;
          }
          p.idleTimer = 0;
        }
      } else {
        // Pedestrian is paused in an authentic Indonesian idle posture
        p.idleTimer += dt;

        if (limbs) {
          // Legs stand stably on sidewalk
          limbs.leftLeg.rotation.x = THREE.MathUtils.damp(limbs.leftLeg.rotation.x, 0, 8, dt);
          limbs.rightLeg.rotation.x = THREE.MathUtils.damp(limbs.rightLeg.rotation.x, 0, 8, dt);

          if (p.state === 'idle_waving') {
            // Friendly Indonesian waving gesture with right hand ("Halo / Mari Mas!")
            limbs.leftArm.rotation.x = THREE.MathUtils.damp(limbs.leftArm.rotation.x, 0, 6, dt);
            limbs.leftArm.rotation.z = THREE.MathUtils.damp(limbs.leftArm.rotation.z, 0, 6, dt);
            limbs.rightArm.rotation.x = -1.55 + Math.sin(p.idleTimer * 6.5) * 0.22;
            limbs.rightArm.rotation.z = -0.52 + Math.cos(p.idleTimer * 6.5) * 0.25;
            limbs.head.rotation.y = Math.sin(p.idleTimer * 2.4) * 0.22;
            limbs.head.rotation.z = 0;
          } else if (p.state === 'idle_calling') {
            // Holding smartphone up to ear, nodding while chatting
            if (limbs.phone) limbs.phone.visible = true;
            limbs.rightArm.rotation.x = -2.15 + Math.sin(p.idleTimer * 1.6) * 0.05;
            limbs.rightArm.rotation.z = -0.42;
            limbs.leftArm.rotation.x = Math.sin(p.idleTimer * 2.2) * 0.16;
            limbs.leftArm.rotation.z = 0.08;
            limbs.head.rotation.z = -0.15; // Natural head tilt towards phone
            limbs.head.rotation.y = Math.sin(p.idleTimer * 1.8) * 0.12;
          } else if (p.state === 'idle_looking') {
            // Standing calmly, looking left, right & center enjoying Indonesian city atmosphere
            limbs.leftArm.rotation.x = THREE.MathUtils.damp(limbs.leftArm.rotation.x, 0, 6, dt);
            limbs.leftArm.rotation.z = 0;
            limbs.rightArm.rotation.x = THREE.MathUtils.damp(limbs.rightArm.rotation.x, 0, 6, dt);
            limbs.rightArm.rotation.z = 0;
            limbs.head.rotation.y = Math.sin(p.idleTimer * 1.6) * 0.65;
            limbs.head.rotation.x = 0.06 + Math.cos(p.idleTimer * 1.1) * 0.04;
            limbs.head.rotation.z = 0;
          }
        }

        // Interrupt idle if player gets very close or duration expires
        const distToPlayer = Math.hypot(p.mesh.position.x - activePos.x, p.mesh.position.z - activePos.z);
        if (p.idleTimer >= p.idleDuration || (!this.drivenVehicle && distToPlayer < 1.8)) {
          if (limbs?.phone) limbs.phone.visible = false;
          if (limbs) {
            limbs.rightArm.rotation.set(0, 0, 0);
            limbs.leftArm.rotation.set(0, 0, 0);
            limbs.head.rotation.set(0, 0, 0);
          }
          p.state = 'walking';
          p.walkTimer = 0;
          p.walkDuration = 14.0 + (i % 6) * 3.5;
        }
      }

      if (this.drivenVehicle && Math.abs(this.drivenVehicle.speed) > 10) {
        const distP = Math.hypot(
          p.mesh.position.x - activePos.x,
          p.mesh.position.z - activePos.z
        );
        if (distP < 1.8) {
          soundFX.playImpactThud();
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

    // 3. Update Vendor NPCs (Interactive culinary & service shopkeepers)
    for (let k = 0; k < this.vendors.length; k++) {
      const v = this.vendors[k];
      const vdx = v.mesh.position.x - activePos.x;
      const vdz = v.mesh.position.z - activePos.z;
      const vdist = Math.hypot(vdx, vdz);
      if (vdist > 75) {
        v.mesh.visible = false;
        continue;
      }
      v.mesh.visible = true;

      const vLimbs = v.mesh.userData.limbs;

      if (vdist < 9.0) {
        // Player is nearby! Vendor greets and turns to welcome player
        const toPlayer = Math.atan2(activePos.x - v.mesh.position.x, activePos.z - v.mesh.position.z);
        v.mesh.rotation.y = THREE.MathUtils.damp(v.mesh.rotation.y, toPlayer, 4.5, dt);

        v.armPhase += dt * 5.0;

        if (vLimbs?.rightArm) {
          if (v.type === 'pecel_lele') {
            // Cak Har waves bamboo fan (kipas sate) energetically
            vLimbs.rightArm.rotation.x = -1.1 + Math.sin(v.armPhase) * 0.38;
            vLimbs.rightArm.rotation.z = -0.32 + Math.cos(v.armPhase) * 0.28;
          } else if (v.type === 'bakso') {
            // Mas Solo scoops soup with ladle and invites customer
            vLimbs.rightArm.rotation.x = -1.2 + Math.sin(v.armPhase * 0.8) * 0.32;
            vLimbs.rightArm.rotation.z = -0.25;
          } else if (v.type === 'bengkel') {
            // Pak Slamet gestures with wrench
            vLimbs.rightArm.rotation.x = -1.4 + Math.sin(v.armPhase * 0.7) * 0.25;
            vLimbs.rightArm.rotation.z = -0.3;
          } else {
            // Welcoming friendly "Monggo pinarak / Silakan belanja!" hand wave
            vLimbs.rightArm.rotation.x = -1.55 + Math.sin(v.armPhase) * 0.22;
            vLimbs.rightArm.rotation.z = -0.5 + Math.cos(v.armPhase) * 0.25;
          }
        }
        if (vLimbs?.head) {
          vLimbs.head.rotation.y = Math.sin(v.armPhase * 0.5) * 0.15;
        }
      } else {
        // Return smoothly to original stall facing
        v.mesh.rotation.y = THREE.MathUtils.damp(v.mesh.rotation.y, v.baseHeading, 3.2, dt);
        v.armPhase += dt * 1.8;

        if (vLimbs?.rightArm) {
          if (v.type === 'pecel_lele') {
            // Gentle idle fanning over grill
            vLimbs.rightArm.rotation.x = -0.9 + Math.sin(v.armPhase) * 0.2;
            vLimbs.rightArm.rotation.z = -0.25;
          } else {
            vLimbs.rightArm.rotation.x = THREE.MathUtils.damp(vLimbs.rightArm.rotation.x, -0.2, 3, dt);
            vLimbs.rightArm.rotation.z = THREE.MathUtils.damp(vLimbs.rightArm.rotation.z, 0, 3, dt);
          }
        }
        if (vLimbs?.head) {
          vLimbs.head.rotation.y = THREE.MathUtils.damp(vLimbs.head.rotation.y, 0, 3, dt);
        }
      }
    }

    // 4. Update Sitting NPCs (Relaxing at benches, pos kamling, & warungs)
    const animTime = this.clock.getElapsedTime();
    for (let s = 0; s < this.sittingNPCs.length; s++) {
      const sitter = this.sittingNPCs[s];
      const sdist = Math.hypot(sitter.position.x - activePos.x, sitter.position.z - activePos.z);
      if (sdist > 70) {
        sitter.visible = false;
        continue;
      }
      sitter.visible = true;

      const sHead = sitter.userData.head;
      if (sHead) {
        sHead.rotation.y = Math.sin(animTime * 0.7 + s * 1.3) * 0.24;
        sHead.rotation.x = 0.05 + Math.sin(animTime * 0.4 + s) * 0.04;
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

    this.missionBeaconGroup.visible = true;
    this.missionBeaconGroup.position.set(target.x, 0, target.z);
    this.missionBeaconRing.position.y = 0.35 + Math.sin(elapsed * 4) * 0.25;

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

    const dist = Math.hypot(target.x - activePos.x, target.z - activePos.z);
    if (dist < 5.0) {
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
      _vec3CamDesired.set(activePos.x, 38, activePos.z + 9);
      _vec3CamTarget.set(activePos.x, 0.8, activePos.z);
    } else if (!this.drivenVehicle && this.wasInsideHome) {
      // Indoor cutaway camera: closer and slightly higher so room furniture is clearly visible
      const distBack = 4.4;
      const heightUp = 3.8;
      _vec3CamDesired.set(
        activePos.x - Math.sin(activeHeading) * distBack,
        activePos.y + heightUp,
        activePos.z - Math.cos(activeHeading) * distBack
      );
      _vec3CamTarget.set(
        activePos.x + Math.sin(activeHeading) * 2.0,
        activePos.y + 1.2,
        activePos.z + Math.cos(activeHeading) * 2.0
      );
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

    let nearbyVehiclePrompt: string | null = null;
    if (!this.drivenVehicle) {
      let bestDist = 6.8;
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
      trafficCoords: this.vehicles
        .filter((v) => v.isAI)
        .map((v) => ({
          x: Math.round(v.mesh.position.x),
          z: Math.round(v.mesh.position.z),
          type: v.type,
        })),
      completedMissionIds: this.completedMissionIds,
      timeOfDay: this.timeOfDay,
      clockTimeText: this.formatClockHour(this.clockHour),
      autoTime: this.autoTime,
      weather: this.weather,
      isInsideHome: !this.drivenVehicle && this.wasInsideHome,
      isNearHomeDoor:
        !this.drivenVehicle &&
        !this.wasInsideHome &&
        this.isPlayerNearHomeDoor(activePos.x, activePos.z),
      playerHomeState: this.playerHomeState,
      homeTransition: this.homeTransition,
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

    const activePos = this.drivenVehicle
      ? this.drivenVehicle.mesh.position
      : this.playerPos;

    this.keyLightTargetObj.position.set(activePos.x, 0, activePos.z);

    this.updateTrafficLights(dt);
    this.updateAITrafficAndPedestrians(dt, elapsed);
    this.updateMissionLogic(dt, elapsed);
    this.updateSkyAndWeather(dt);
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

    if (this.homeTransitionTimer > 0) {
      this.homeTransitionTimer -= dt;
      if (this.homeTransitionTimer <= 0) {
        this.homeTransition = null;
        this.broadcastHud(true);
      }
    }

    this.broadcastHud();
    this.renderer.render(this.scene, this.camera);

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
    soundFX.setRainAmbience(false);
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
