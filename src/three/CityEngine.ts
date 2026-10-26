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
  createMasjidNusantara,
  createMonasLandmark,
  createNPCPedestrian,
  createOuterRiverSystem,
  createPlayerCharacter,
  createSekolahNusantara,
  createTamanKota,
  createTrafficLightMesh,
  createTuguSurabayaLandmark,
  createVehicleMesh,
  createWarungTenda,
  TrafficLightRef,
} from './models';
import {
  createPavingTrotoarTexture,
  createRoadAsphaltTexture,
  createRoadIntersectionTexture,
  createRukoFacadeTexture,
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
  private starsPoints!: THREE.Points;
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

  // Actors & World state
  private playerMesh!: THREE.Group;
  private playerOutfit: OutfitStyle = 'ojol';
  private playerPos = new THREE.Vector3(-8.5, 0, 28);
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

  // Game State (start at 75% health so player can immediately test Warung Pecel Lele / Es Teh healing!)
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
    title: 'Selamat Datang di Kota Raya Nusantara!',
    subtitle: 'Waktu berjalan otomatis (Pagi → Siang → Sore → Malam). Aktifkan Hujan untuk efek partikel & suara rintik hujan!',
    tone: 'info',
  };
  private notificationTimer = 7.0;

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
    this.camera.position.set(-8.5, 8, 38);

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

    // 4. Add 4 Gateway Avenue Spurs extending across the River Bridges (±166m)
    addRoadSegment('ns', 0, 127, 168);
    addRoadSegment('ns', 0, -142, -127);
    addRoadSegment('ew', 0, 127, 168);
    addRoadSegment('ew', 0, -142, -127);

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
    // 1. Expanded Natural Island Ground (Radius 215m) & Coastal Ocean
    const oceanGeo = new THREE.PlaneGeometry(1400, 1400);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.18,
      metalness: 0.35,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.45;
    this.scene.add(ocean);

    const islandGeo = new THREE.CylinderGeometry(215, 228, 0.9, 64);
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

    // 9. Neatly Organized Boulevard & Park Tropical Trees (100% Clear of Roads & Buildings)
    this.buildInstancedTropicalTrees();
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

    // 3. Keep clear of all building colliders & interactive spots
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

    // 2. Dense Outer Riverbank & Coastal Forest Belt (Hutan Lindung Lembah Sungai, Radius 162m..204m)
    for (let i = 0; i < 185; i++) {
      const angle = (i / 185) * Math.PI * 2;
      const radius = 164 + (i % 5) * 9.5;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      // Leave avenue gateway corridors & river channels open
      if (Math.abs(tx) < 13 || Math.abs(tz) < 13) continue;
      if (Math.abs(tx - 148) < 12 || Math.abs(tz - 148) < 12) continue;
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

    // Night Starfield Dome
    const starCount = 360;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const r = 240;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.max(28, r * Math.cos(phi));
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    this.starsPoints = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        color: 0xf8fafc,
        size: 1.5,
        fog: false,
      })
    );
    this.starsPoints.visible = false;
    this.scene.add(this.starsPoints);

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
      // 7 & 8. Inner Ring Clockwise (Left lane at ±56.5)
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
    if (!this.drivenVehicle && this.playerPos.y <= 0.01) {
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
        this.wantedDecayTimer = 30;
        this.showNotification(
          'Mobil Patroli Dibajak!',
          'Status Buronan Polisi naik! Pergi ke Bengkel Cat untuk aman.',
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
      this.starsPoints.visible = false;
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
      this.starsPoints.visible = false;
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
      this.starsPoints.visible = false;
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
      this.starsPoints.visible = !isRain;
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
    // 1. Automatic Day-Night Progression (Pagi -> Siang -> Sore -> Malam)
    if (this.autoTime) {
      // 0.25 game hours per real second (~15 game minutes per second; full 24h cycle in 96 seconds)
      this.clockHour = (this.clockHour + dt * 0.25) % 24;
      const nextPhase = this.getPhaseFromHour(this.clockHour);
      if (nextPhase !== this.timeOfDay) {
        this.timeOfDay = nextPhase;
        this.applyAtmosphere();
      } else {
        this.updateCelestialOrbit();
      }
    }

    // Rotate starfield subtly at night
    if (this.starsPoints.visible) {
      this.starsPoints.rotation.y += dt * 0.015;
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

  private updatePlayerOnFoot(dt: number) {
    const forwardInput =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) +
      this.virtualInput.forward;
    const turnInput =
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) -
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) +
      this.virtualInput.turn;

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

      if (!this.checkBuildingCollision(nextX, this.playerPos.z, 0.55)) {
        this.playerPos.x = nextX;
      }
      if (!this.checkBuildingCollision(this.playerPos.x, nextZ, 0.55)) {
        this.playerPos.z = nextZ;
      }

      this.playerWalkCycle +=
        dt * (isSprinting ? 14 : 9) * Math.max(0.45, Math.abs(clampedFwd));
    } else {
      this.playerWalkCycle = 0;
    }

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
        v.type === 'polisi' && this.wantedStars > 0
          ? 18.5
          : v.type === 'ojol_motor'
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
      if (distToWP > 4.0) {
        if (isNS) {
          nx = THREE.MathUtils.damp(nx, currWP.x, 7.5, dt);
        } else if (isEW) {
          nz = THREE.MathUtils.damp(nz, currWP.z, 7.5, dt);
        }
      }

      // Airtight Road Corridor Boundary Safety Net (Ensures vehicle never veers into sidewalk/blocks)
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
      if (minDiffX > SAFE_ROAD_HALF_WIDTH && minDiffZ > SAFE_ROAD_HALF_WIDTH) {
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

      p.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), 7.5 * dt);

      // Continuously walk forward (never freeze or stop!)
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
      const limbs = p.mesh.userData.limbs;
      if (limbs) {
        const swing = Math.sin(p.walkCycle) * 0.52;
        limbs.leftLeg.rotation.x = swing;
        limbs.rightLeg.rotation.x = -swing;
        limbs.leftArm.rotation.x = -swing * 0.65;
        limbs.rightArm.rotation.x = swing * 0.65;
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
