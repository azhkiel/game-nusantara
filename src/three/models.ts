import * as THREE from 'three';
import { OutfitStyle, PedestrianArchetype, VehicleType } from '../types/game';
import {
  createBatikFabricTexture,
  createLicensePlateTexture,
  createMinimarketSignTexture,
  createWarungSpandukTexture,
} from './textures';

function createContactShadow(width: number, depth: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.025;
  return plane;
}

export function createPlayerCharacter(
  outfit: OutfitStyle,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlayerCharacter';

  // Ground contact shadow
  group.add(createContactShadow(1.3, 1.3));

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b66,
    roughness: 0.65,
    metalness: 0.05,
  });

  let torsoMat: THREE.MeshStandardMaterial;
  if (outfit === 'batik') {
    torsoMat = new THREE.MeshStandardMaterial({
      map: createBatikFabricTexture(maxAnisotropy),
      roughness: 0.78,
      metalness: 0.08,
    });
  } else if (outfit === 'jaket_kulit') {
    torsoMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.35,
    });
  } else {
    // Iconic Ojol Green Jacket with black & reflective stripes
    torsoMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.55,
      metalness: 0.12,
    });
  }

  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.82,
    metalness: 0.05,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.25,
  });

  // Left & Right Legs (pivoted at hip y = 0.82)
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.48, 4, 8);
  legGeo.translate(0, -0.28, 0);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.82, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.36);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.68, 0.05);
  leftLeg.add(leftShoe);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.82, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.68, 0.05);
  rightLeg.add(rightShoe);
  group.add(rightLeg);

  // Torso (extruded beveled chest block)
  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.26, -0.32);
  torsoShape.lineTo(0.26, -0.32);
  torsoShape.lineTo(0.3, 0.32);
  torsoShape.lineTo(-0.3, 0.32);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  torsoGeo.center();
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(0, 1.18, 0);
  torso.castShadow = true;
  group.add(torso);

  // Reflective chest strip for Ojol outfit
  if (outfit === 'ojol') {
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.8,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.33), stripMat);
    strip.position.set(0, 1.24, 0);
    group.add(strip);
  }

  // Arms (pivoted at shoulder y = 1.42)
  const armGeo = new THREE.CapsuleGeometry(0.095, 0.44, 4, 8);
  armGeo.translate(0, -0.24, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.38, 1.42, 0);
  const leftSleeve = new THREE.Mesh(armGeo, torsoMat);
  leftSleeve.castShadow = true;
  leftArm.add(leftSleeve);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), skinMat);
  leftHand.position.set(0, -0.52, 0);
  leftArm.add(leftHand);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.38, 1.42, 0);
  const rightSleeve = new THREE.Mesh(armGeo, torsoMat);
  rightSleeve.castShadow = true;
  rightArm.add(rightSleeve);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), skinMat);
  rightHand.position.set(0, -0.52, 0);
  rightArm.add(rightHand);
  group.add(rightArm);

  // Head + Sunglasses + Hair/Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.72, 0);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Cool dark sunglasses
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    roughness: 0.1,
    metalness: 0.9,
    clearcoat: 1.0,
  });
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.12), visorMat);
  glasses.position.set(0, 0.03, 0.18);
  headGroup.add(glasses);

  if (outfit === 'ojol') {
    // Iconic Green Ojol Helmet
    const helmetMat = new THREE.MeshPhysicalMaterial({
      color: 0x15803d,
      roughness: 0.2,
      metalness: 0.3,
      clearcoat: 0.9,
    });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
      helmetMat
    );
    helmet.position.y = 0.02;
    headGroup.add(helmet);
  } else {
    // Stylized Indonesian Peci / Hair
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.05,
    });
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), hairMat);
    hair.position.set(0, 0.17, 0);
    headGroup.add(hair);
  }

  group.add(headGroup);

  group.userData.limbs = {
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
  };

  return group;
}

export function createNPCPedestrian(
  shirtColor: number,
  pantsColor: number,
  archetype: PedestrianArchetype = 'warga'
): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(1.1, 1.1));

  // Resolve authentic Indonesian outfit colors per archetype
  let finalShirt = shirtColor;
  let finalPants = pantsColor;
  if (archetype === 'pelajar_sma') {
    finalShirt = 0xf8fafc; // Putih seragam SMA
    finalPants = 0x64748b; // Abu-abu SMA
  } else if (archetype === 'ojol') {
    finalShirt = 0x16a34a; // Jaket Ojol Hijau
    finalPants = 0x0f172a;
  } else if (archetype === 'pekerja_batik') {
    finalShirt = 0x92400e; // Batik Sogan Cokelat Emas
    finalPants = 0x1e293b;
  } else if (archetype === 'santri') {
    finalShirt = 0xf8fafc; // Baju Koko Putih
    finalPants = 0x14532d; // Sarung / Celana Hijau Tua
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49464, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: finalShirt, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: finalPants, roughness: 0.85 });

  const legGeo = new THREE.CapsuleGeometry(0.1, 0.45, 4, 8);
  legGeo.translate(0, -0.25, 0);

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.14, 0.75, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.14, 0.75, 0);
  group.add(rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.26), shirtMat);
  torso.position.set(0, 1.1, 0);
  torso.castShadow = true;
  group.add(torso);

  // Archetype-specific details (SMA tie + backpack, Ojol stripe + helmet, Santri peci)
  if (archetype === 'pelajar_sma') {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.32, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    );
    tie.position.set(0, 1.18, 0.14);
    group.add(tie);

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.44, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75 })
    );
    backpack.position.set(0, 1.12, -0.2);
    backpack.castShadow = true;
    group.add(backpack);
  } else if (archetype === 'ojol') {
    const chestStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    chestStripe.position.set(0, 1.18, 0);
    group.add(chestStripe);
  }

  const leftArm = new THREE.Mesh(legGeo, shirtMat);
  leftArm.scale.set(0.8, 0.85, 0.8);
  leftArm.position.set(-0.32, 1.35, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(legGeo, shirtMat);
  rightArm.scale.set(0.8, 0.85, 0.8);
  rightArm.position.set(0.32, 1.35, 0);
  group.add(rightArm);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), skinMat);
  head.position.set(0, 1.62, 0);
  group.add(head);

  // Headgear per archetype
  if (archetype === 'ojol') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3, metalness: 0.2 })
    );
    helmet.position.set(0, 1.64, 0);
    group.add(helmet);
  } else if (archetype === 'santri') {
    // Black Indonesian Peci / Songkok
    const peci = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.13, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    );
    peci.position.set(0, 1.78, 0);
    group.add(peci);
  } else {
    const capColor = archetype === 'pelajar_sma' ? 0x1e3a8a : 0x1e293b;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.5 })
    );
    cap.position.set(0, 1.76, 0);
    group.add(cap);
  }

  group.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm };
  return group;
}

function createWheelAssembly(radius: number, width: number): THREE.Group {
  const wheelGroup = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.88,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.25,
    metalness: 0.85,
  });

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 16),
    tireMat
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheelGroup.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  return wheelGroup;
}

export function createVehicleMesh(
  type: VehicleType,
  primaryColor: number,
  plateCode: string,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const bodyPaintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    roughness: 0.22,
    metalness: 0.65,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.75,
    transparent: true,
    opacity: isSoftwareGl ? 0.5 : 0.88,
    ior: 1.5,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.15,
    metalness: 0.92,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.82,
    metalness: 0.15,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.2,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const plateTex = createLicensePlateTexture(
    plateCode,
    type === 'angkot' || type === 'bus_telolet',
    maxAnisotropy
  );
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });

  if (type === 'bajaj') {
    // 1. Contact shadow
    group.add(createContactShadow(2.4, 3.4));

    // 2. Three Wheels (1 front steerable, 2 rear)
    const wFront = createWheelAssembly(0.36, 0.22);
    wFront.position.set(0, 0.36, 1.18);
    group.add(wFront);
    wheels.push(wFront);

    const wRL = createWheelAssembly(0.38, 0.24);
    wRL.position.set(-0.88, 0.38, -0.95);
    group.add(wRL);
    wheels.push(wRL);

    const wRR = createWheelAssembly(0.38, 0.24);
    wRR.position.set(0.88, 0.38, -0.95);
    group.add(wRR);
    wheels.push(wRR);

    // 3. Lower Rounded Metal Body Hull (ExtrudeGeometry)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-0.92, 0);
    hullShape.lineTo(0.92, 0);
    hullShape.lineTo(0.85, 0.85);
    hullShape.lineTo(-0.85, 0.85);
    hullShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 2.35,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 3,
    });
    hullGeo.center();
    const hull = new THREE.Mesh(hullGeo, bodyPaintMat);
    hull.position.set(0, 0.82, -0.1);
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    // 4. Front Tapered Nose Cowl & Mudguard
    const nose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.55, 0.95, 12),
      bodyPaintMat
    );
    nose.position.set(0, 0.82, 0.98);
    nose.castShadow = true;
    group.add(nose);

    // 5. Black Canvas Tarpaulin Canopy Roof (high roughness contrast)
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.78, 2.25),
      darkTrimMat
    );
    canopy.position.set(0, 1.62, -0.18);
    canopy.castShadow = true;
    group.add(canopy);

    // 6. Front Windshield Glass
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.62, 0.08),
      glassMat
    );
    windshield.position.set(0, 1.56, 0.92);
    windshield.rotation.x = -0.18;
    group.add(windshield);

    // 7. Single Central Iconic Bajaj Headlight + Chrome Bezel
    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16),
      headlightMat
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.86, 1.46);
    group.add(headlight);

    // 8. Rear Taillights & License Plate
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), taillightMat);
    tailL.position.set(-0.65, 0.75, -1.35);
    group.add(tailL);
    const tailR = tailL.clone();
    tailR.position.x = 0.65;
    group.add(tailR);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.24), plateMat);
    plate.position.set(0, 0.62, -1.38);
    plate.rotation.y = Math.PI;
    group.add(plate);

    // 9. Chrome Exhaust Pipe
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
      chromeMat
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.55, 0.42, -1.42);
    group.add(exhaust);
  } else if (type === 'ojol_motor') {
    // 1. Contact shadow
    group.add(createContactShadow(1.2, 2.4));

    // 2. Front & Rear Scooter Wheels
    const wF = createWheelAssembly(0.34, 0.16);
    wF.position.set(0, 0.34, 0.82);
    group.add(wF);
    wheels.push(wF);

    const wR = createWheelAssembly(0.34, 0.18);
    wR.position.set(0, 0.34, -0.78);
    group.add(wR);
    wheels.push(wR);

    // 3. Scooter Step-through Frame & Front Apron
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.85, 0.42),
      bodyPaintMat
    );
    apron.position.set(0, 0.82, 0.58);
    apron.rotation.x = -0.22;
    apron.castShadow = true;
    group.add(apron);

    const rearBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.48, 1.15),
      bodyPaintMat
    );
    rearBody.position.set(0, 0.72, -0.35);
    rearBody.castShadow = true;
    group.add(rearBody);

    // 4. Leather Dual Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.18, 0.92),
      darkTrimMat
    );
    seat.position.set(0, 1.02, -0.32);
    group.add(seat);

    // 5. Handlebars + Mirrors + Headlight Pod
    const handlebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.82, 8),
      chromeMat
    );
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.28, 0.48);
    group.add(handlebar);

    const lightPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.18),
      headlightMat
    );
    lightPod.position.set(0, 1.28, 0.56);
    group.add(lightPod);

    // 6. Iconic Green Ojol Delivery Box on Rear Rack
    const ojolBoxMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.35,
      metalness: 0.2,
    });
    const deliveryBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.52, 0.52),
      ojolBoxMat
    );
    deliveryBox.position.set(0, 1.32, -0.82);
    deliveryBox.castShadow = true;
    group.add(deliveryBox);

    const tailLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.06),
      taillightMat
    );
    tailLight.position.set(0, 0.82, -0.95);
    group.add(tailLight);
  } else if (type === 'bus_telolet') {
    // High-Deck Indonesian Bus TransNusantara / AKAP Telolet
    group.add(createContactShadow(3.6, 8.6));

    const wheelCoords: [number, number, number][] = [
      [-1.32, 0.52, 2.45],
      [1.32, 0.52, 2.45],
      [-1.32, 0.52, -1.65],
      [1.32, 0.52, -1.65],
      [-1.32, 0.52, -2.65],
      [1.32, 0.52, -2.65],
    ];
    wheelCoords.forEach(([wx, wy, wz]) => {
      const w = createWheelAssembly(0.52, 0.32);
      w.position.set(wx, wy, wz);
      group.add(w);
      wheels.push(w);
    });

    // Lower & Upper Bus Coach Body
    const coachBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 2.55, 7.6),
      bodyPaintMat
    );
    coachBody.position.set(0, 1.72, 0);
    coachBody.castShadow = true;
    coachBody.receiveShadow = true;
    group.add(coachBody);

    // Gold/Yellow Indonesian Bus Livery Stripe
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.7,
    });
    const liveryStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.79, 0.36, 7.4),
      stripeMat
    );
    liveryStripe.position.set(0, 1.35, 0);
    group.add(liveryStripe);

    // Panoramic Double-Deck Windshield & Side Windows
    const frontGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 1.35, 0.12),
      glassMat
    );
    frontGlass.position.set(0, 2.1, 3.78);
    group.add(frontGlass);

    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.95, 6.4),
      glassMat
    );
    sideGlass.position.set(0, 2.15, -0.2);
    group.add(sideGlass);

    // Roof AC Pod & Chrome Telolet Horn Trumpets
    const acPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.32, 3.2),
      chromeMat
    );
    acPod.position.set(0, 3.12, -0.3);
    group.add(acPod);

    for (const hx of [-0.55, -0.2, 0.2, 0.55]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.45, 12),
        chromeMat
      );
      horn.rotation.x = -Math.PI / 2;
      horn.position.set(hx, 3.1, 2.8);
      group.add(horn);
    }

    // Headlights & Taillights
    for (const sx of [-0.95, 0.95]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.1), headlightMat);
      hl.position.set(sx, 0.95, 3.8);
      group.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.1), taillightMat);
      tl.position.set(sx, 1.05, -3.8);
      group.add(tl);
    }
  } else {
    // Angkot Minibus ('angkot') OR Police Patrol Sedan ('polisi')
    group.add(createContactShadow(2.8, 5.0));

    const wheelOffsets: [number, number, number][] = [
      [-1.06, 0.42, 1.35],
      [1.06, 0.42, 1.35],
      [-1.06, 0.42, -1.35],
      [1.06, 0.42, -1.35],
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const w = createWheelAssembly(0.42, 0.26);
      w.position.set(wx, wy, wz);
      group.add(w);
      wheels.push(w);
    });

    if (type === 'angkot') {
      // Iconic Indonesian Angkot Boxy Minibus
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 1.72, 4.35),
        bodyPaintMat
      );
      chassis.position.set(0, 1.25, 0);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      group.add(chassis);

      // White Roof Cap + Luggage Rack
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.4,
        metalness: 0.2,
      });
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2.08, 0.22, 4.15),
        roofMat
      );
      roof.position.set(0, 2.18, 0);
      group.add(roof);

      // Open Left Passenger Doorway Recess (Indonesian Angkot signature!)
      const doorway = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.35, 0.92),
        darkTrimMat
      );
      doorway.position.set(1.02, 1.15, 0.15);
      group.add(doorway);

      // Windows
      const frontWin = new THREE.Mesh(
        new THREE.BoxGeometry(1.88, 0.68, 0.1),
        glassMat
      );
      frontWin.position.set(0, 1.62, 2.15);
      group.add(frontWin);

      const sideWin = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.62, 3.6),
        glassMat
      );
      sideWin.position.set(0, 1.62, -0.1);
      group.add(sideWin);

      // Front & Rear Bumpers
      const bumperF = new THREE.Mesh(
        new THREE.BoxGeometry(2.28, 0.24, 0.28),
        darkTrimMat
      );
      bumperF.position.set(0, 0.56, 2.2);
      group.add(bumperF);
    } else {
      // Police Patrol Car ('polisi')
      const lowerBody = new THREE.Mesh(
        new THREE.BoxGeometry(2.18, 0.78, 4.65),
        bodyPaintMat
      );
      lowerBody.position.set(0, 0.78, 0);
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      group.add(lowerBody);

      const cabinMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.5,
      });
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.68, 2.35),
        cabinMat
      );
      cabin.position.set(0, 1.45, -0.2);
      cabin.castShadow = true;
      group.add(cabin);

      const cabinGlass = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.56, 2.15),
        glassMat
      );
      cabinGlass.position.set(0, 1.45, -0.2);
      group.add(cabinGlass);

      // Police Emergency Lightbar on Roof
      const lightbarBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.12, 0.32),
        chromeMat
      );
      lightbarBase.position.set(0, 1.85, -0.15);
      group.add(lightbarBase);

      const redSirenMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.5,
      });
      const blueSirenMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x2563eb,
        emissiveIntensity: 1.5,
      });
      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.16, 0.28),
        redSirenMat
      );
      redLight.position.set(-0.32, 1.88, -0.15);
      group.add(redLight);

      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.16, 0.28),
        blueSirenMat
      );
      blueLight.position.set(0.32, 1.88, -0.15);
      group.add(blueLight);

      group.userData.sirenLights = { redLight, blueLight };
    }

    // Shared Headlights, Taillights & License Plates for Angkot/Police
    for (const sx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.1), headlightMat);
      hl.position.set(sx, 0.82, 2.28);
      group.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.1), taillightMat);
      tl.position.set(sx, 0.82, -2.28);
      group.add(tl);
    }

    const fPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.26), plateMat);
    fPlate.position.set(0, 0.56, 2.36);
    group.add(fPlate);

    const rPlate = fPlate.clone();
    rPlate.position.set(0, 0.56, -2.36);
    rPlate.rotation.y = Math.PI;
    group.add(rPlate);
  }

  group.userData.wheels = wheels;
  return group;
}

export function createMonasLandmark(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TuguMonas';

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.1,
  });

  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
    metalness: 0.05,
  });

  // 1. Octagonal Fountain Pool Base
  const poolRim = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14.5, 0.6, 8),
    podiumMat
  );
  poolRim.position.y = 0.3;
  poolRim.receiveShadow = true;
  group.add(poolRim);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1.0,
  });
  const poolWater = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2, 13.2, 0.65, 8),
    waterMat
  );
  poolWater.position.y = 0.32;
  group.add(poolWater);

  // 2. Stepped Base Platform
  const stepBase = new THREE.Mesh(
    new THREE.BoxGeometry(13, 1.4, 13),
    podiumMat
  );
  stepBase.position.y = 1.0;
  stepBase.castShadow = true;
  stepBase.receiveShadow = true;
  group.add(stepBase);

  // 3. Iconic Monas Cawan (Fluted Goblet Cup) via LatheGeometry
  const cawanPoints = [
    new THREE.Vector2(3.6, 1.7),
    new THREE.Vector2(4.4, 3.2),
    new THREE.Vector2(6.8, 5.4),
    new THREE.Vector2(7.2, 6.2),
    new THREE.Vector2(2.6, 6.4),
  ];
  const cawanGeo = new THREE.LatheGeometry(cawanPoints, 8);
  cawanGeo.computeVertexNormals();
  const cawan = new THREE.Mesh(cawanGeo, marbleMat);
  cawan.castShadow = true;
  cawan.receiveShadow = true;
  group.add(cawan);

  // 4. Soaring Obelisk Shaft
  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 2.05, 22, 8),
    marbleMat
  );
  obelisk.position.y = 17.2;
  obelisk.castShadow = true;
  obelisk.receiveShadow = true;
  group.add(obelisk);

  // 5. Observation Deck Pelataran Puncak
  const topDeck = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.9, 3.2),
    podiumMat
  );
  topDeck.position.y = 28.4;
  topDeck.castShadow = true;
  group.add(topDeck);

  // 6. Lidah Api Kemerdekaan (24K Brushed Gold Flame with Anisotropy)
  const goldFlameMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    metalness: 0.95,
    roughness: 0.15,
    anisotropy: 0.8,
    clearcoat: 1.0,
  });

  const flamePoints = [
    new THREE.Vector2(0.1, 0),
    new THREE.Vector2(0.95, 0.8),
    new THREE.Vector2(1.15, 1.8),
    new THREE.Vector2(0.75, 2.9),
    new THREE.Vector2(0.05, 4.1),
  ];
  const flameGeo = new THREE.LatheGeometry(flamePoints, 16);
  const flame = new THREE.Mesh(flameGeo, goldFlameMat);
  flame.position.y = 28.9;
  group.add(flame);

  return group;
}

export function createWarungTenda(
  title: string,
  subtitle: string,
  bgColor: string,
  borderColor: string,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();

  // 1. Concrete Pad Base (offset >= 0.03 on Y to prevent coplanar Z-fighting)
  const basePad = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.12, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
  );
  basePad.position.y = 0.06;
  basePad.receiveShadow = true;
  group.add(basePad);

  // 2. Four Bamboo / Iron Corner Poles
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.75,
    metalness: 0.1,
  });
  for (const [px, pz] of [
    [-3.1, -2.0],
    [3.1, -2.0],
    [-3.1, 2.0],
    [3.1, 2.0],
  ]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.1, 8),
      poleMat
    );
    pole.position.set(px, 1.55, pz);
    pole.castShadow = true;
    group.add(pole);
  }

  // 3. Blue/Orange Tarp Tent Roof
  const tarpMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.65,
    metalness: 0.05,
  });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.3, 4), tarpMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.8);
  roof.position.y = 3.65;
  roof.castShadow = true;
  group.add(roof);

  // 4. Characteristic Painted Spanduk Banner
  const spandukTex = createWarungSpandukTexture(
    title,
    subtitle,
    bgColor,
    borderColor,
    maxAnisotropy
  );
  const spandukMat = new THREE.MeshStandardMaterial({
    map: spandukTex,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const spanduk = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.35), spandukMat);
  spanduk.position.set(0, 2.35, 2.02);
  group.add(spanduk);

  // 5. Wooden Gerobak Cooking Cart + Aluminum Dandang Pot
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.82,
  });
  const gerobak = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 1.0), woodMat);
  gerobak.position.set(-1.6, 0.68, -0.8);
  gerobak.castShadow = true;
  group.add(gerobak);

  const dandang = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.3, 0.55, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
  );
  dandang.position.set(-1.6, 1.5, -0.8);
  group.add(dandang);

  // 6. Dining Table & Plastic Stools
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.1), woodMat);
  table.position.set(1.2, 0.48, 0.2);
  table.castShadow = true;
  group.add(table);

  const stoolMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.4,
  });
  for (const sx of [0.5, 1.2, 1.9]) {
    const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.42), stoolMat);
    stool.position.set(sx, 0.3, 1.15);
    group.add(stool);
  }

  return group;
}

export function createIndoalfaMinimarket(
  brand: 'INDOALFA' | 'ALFAMARET',
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 1. Main Store Building Block
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.7,
    metalness: 0.05,
  });
  const building = new THREE.Mesh(new THREE.BoxGeometry(11.5, 5.2, 8.5), wallMat);
  building.position.y = 2.6;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  // 2. Iconic Red-Blue-Yellow Fascia Signboard
  const signTex = createMinimarketSignTexture(brand, maxAnisotropy);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.3,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0.35,
  });
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(11.8, 1.45, 0.45), signMat);
  fascia.position.set(0, 4.4, 4.3);
  group.add(fascia);

  // 3. Glass Storefront Windows
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.1,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.7,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.85,
  });
  const storefront = new THREE.Mesh(new THREE.BoxGeometry(9.2, 2.9, 0.15), glassMat);
  storefront.position.set(0, 1.65, 4.26);
  group.add(storefront);

  // 4. ATM Booth & Yellow Parking Bollards outside
  const atmBooth = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 2.3, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 })
  );
  atmBooth.position.set(-4.6, 1.15, 4.9);
  atmBooth.castShadow = true;
  group.add(atmBooth);

  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.4,
    metalness: 0.4,
  });
  for (let bx = -3.5; bx <= 4.5; bx += 2.0) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.9, 10),
      bollardMat
    );
    bollard.position.set(bx, 0.45, 5.4);
    group.add(bollard);
  }

  return group;
}

export function createGapuraMerahPutih(): THREE.Group {
  const group = new THREE.Group();

  const redMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.15,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.55,
    metalness: 0.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Left & Right Stepped Gapura Pillars spanning the street
  for (const sx of [-7.5, 7.5]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), redMat);
    base.position.set(sx, 0.9, 0);
    base.castShadow = true;
    group.add(base);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 1.4), whiteMat);
    mid.position.set(sx, 3.9, 0);
    mid.castShadow = true;
    group.add(mid);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.9), redMat);
    crown.position.set(sx, 6.4, 0);
    group.add(crown);
  }

  // Overhead Arch Beam ("DIRGAHAYU RI / KOTA RAYA")
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(16.8, 1.15, 1.1), redMat);
  archBeam.position.set(0, 6.3, 0);
  archBeam.castShadow = true;
  group.add(archBeam);

  const whiteStripe = new THREE.Mesh(new THREE.BoxGeometry(16.9, 0.45, 1.15), whiteMat);
  whiteStripe.position.set(0, 5.95, 0);
  group.add(whiteStripe);

  // Center Golden Emblem Shield
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 6), goldMat);
  shield.rotation.x = Math.PI / 2;
  shield.position.set(0, 6.5, 0.55);
  group.add(shield);

  return group;
}

export function createMasjidNusantara(): THREE.Group {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xfefce8,
    roughness: 0.65,
  });
  const greenRoofMat = new THREE.MeshPhysicalMaterial({
    color: 0x059669,
    roughness: 0.25,
    metalness: 0.45,
    clearcoat: 0.8,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.2,
    metalness: 0.9,
  });

  // Main Sanctuary Hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(13, 6.2, 13), wallMat);
  hall.position.y = 3.1;
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // First Tier Nusantara Pyramid Roof
  const tierRoof = new THREE.Mesh(new THREE.ConeGeometry(10.8, 3.2, 4), greenRoofMat);
  tierRoof.rotation.y = Math.PI / 4;
  tierRoof.position.y = 7.6;
  tierRoof.castShadow = true;
  group.add(tierRoof);

  // Emerald Green Onion Dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.65),
    greenRoofMat
  );
  dome.position.y = 8.8;
  dome.castShadow = true;
  group.add(dome);

  // Golden Finial Spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 2.2, 8), goldMat);
  spire.position.y = 13.2;
  group.add(spire);

  // Minaret Tower
  const minaret = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.35, 16.5, 12),
    wallMat
  );
  minaret.position.set(7.5, 8.25, 7.5);
  minaret.castShadow = true;
  group.add(minaret);

  const minaretDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 16, 12),
    greenRoofMat
  );
  minaretDome.position.set(7.5, 16.8, 7.5);
  group.add(minaretDome);

  return group;
}

export function createBengkelCat(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.75,
    metalness: 0.2,
  });
  const orangeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.35,
    metalness: 0.4,
  });

  // Left, Right & Back Garage Walls (leaving open drive-in bay in front)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.2, 10), wallMat);
  leftWall.position.set(-5.1, 2.6, 0);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = 5.1;
  group.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(11, 5.2, 0.8), wallMat);
  backWall.position.set(0, 2.6, -4.6);
  backWall.castShadow = true;
  group.add(backWall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.6, 10.6), orangeTrimMat);
  roof.position.set(0, 5.4, 0);
  roof.castShadow = true;
  group.add(roof);

  // Banner Signboard
  const signTex = createWarungSpandukTexture(
    'BENGKEL CAT & STEAM',
    'SERVIS MOBIL · HILANGKAN BURONAN POLISI',
    '#facc15',
    '#ea580c',
    maxAnisotropy
  );
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 1.8, 0.3),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
  );
  sign.position.set(0, 6.4, 4.9);
  group.add(sign);

  return group;
}

export function createTuguSurabayaLandmark(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TuguSurabaya';

  // 1. Majapahit Red-Brick & Stone Octagonal Fountain Base
  const brickMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.78,
    metalness: 0.08,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.38,
    metalness: 0.12,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.28,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 1.0,
  });

  const poolOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 10.2, 0.75, 10),
    brickMat
  );
  poolOuter.position.y = 0.38;
  poolOuter.receiveShadow = true;
  group.add(poolOuter);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
  });
  const poolWater = new THREE.Mesh(
    new THREE.CylinderGeometry(8.8, 8.8, 0.8, 10),
    waterMat
  );
  poolWater.position.y = 0.4;
  group.add(poolWater);

  // 2. Candi Bentar Tiered Pedestal
  const tier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.4, 1.4, 10),
    brickMat
  );
  tier1.position.y = 1.1;
  tier1.castShadow = true;
  tier1.receiveShadow = true;
  group.add(tier1);

  const tier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 4.1, 1.5, 10),
    stoneMat
  );
  tier2.position.y = 2.4;
  tier2.castShadow = true;
  group.add(tier2);

  // 3. Tugu Pahlawan 10-Sided Fluted Obelisk ("Paku Terbalik")
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.55, 17.5, 10),
    stoneMat
  );
  shaft.position.y = 11.8;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Golden ornamental rings along Tugu Pahlawan shaft
  for (const ry of [4.2, 9.0, 14.5, 19.8]) {
    const ringRadius = 1.48 - ((ry - 3.2) / 18) * 0.62;
    const goldBand = new THREE.Mesh(
      new THREE.CylinderGeometry(ringRadius, ringRadius + 0.05, 0.35, 10),
      goldMat
    );
    goldBand.position.y = ry;
    group.add(goldBand);
  }

  // Pointed Golden Spire Tip
  const spireTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.92, 2.8, 10),
    goldMat
  );
  spireTip.position.y = 21.8;
  spireTip.castShadow = true;
  group.add(spireTip);

  // 4. Iconic Patung Sura (Hiu) & Baya (Buaya) Sculptural Duo in Front of the Monument
  const statueGroup = new THREE.Group();
  statueGroup.position.set(0, 1.8, 5.2);

  // Swirling Seaweed / Wave Pedestal under Sura & Baya
  const wavePedestal = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 2.6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x115e59,
      roughness: 0.55,
      metalness: 0.25,
    })
  );
  wavePedestal.position.y = 1.1;
  wavePedestal.castShadow = true;
  statueGroup.add(wavePedestal);

  // Hiu Sura (Silver-Blue Shark spiraling upward on the left/top)
  const suraMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.72,
    clearcoat: 0.85,
  });
  const suraCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.3, 1.2, -0.4),
    new THREE.Vector3(-1.6, 2.7, 0.3),
    new THREE.Vector3(-0.9, 4.3, 0.6),
    new THREE.Vector3(0.2, 5.4, 0.1),
  ]);
  const suraBodyGeo = new THREE.TubeGeometry(suraCurve, 24, 0.44, 12, false);
  const suraBody = new THREE.Mesh(suraBodyGeo, suraMat);
  suraBody.castShadow = true;
  statueGroup.add(suraBody);

  // Shark Snout Head & Dorsal Fin
  const suraHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 1.2, 12),
    suraMat
  );
  suraHead.position.set(0.65, 5.75, 0.0);
  suraHead.rotation.z = -Math.PI / 3;
  statueGroup.add(suraHead);

  const dorsalFin = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.95, 4),
    suraMat
  );
  dorsalFin.position.set(-1.35, 3.6, 0.65);
  dorsalFin.rotation.z = 0.85;
  statueGroup.add(dorsalFin);

  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 1.15, 0.65),
    suraMat
  );
  tailFin.position.set(-1.35, 0.85, -0.55);
  tailFin.rotation.z = 0.4;
  statueGroup.add(tailFin);

  // Buaya Baya (Bronze-Emerald Crocodile spiraling around on the right)
  const bayaMat = new THREE.MeshPhysicalMaterial({
    color: 0x3f6212,
    roughness: 0.38,
    metalness: 0.55,
    clearcoat: 0.6,
  });
  const bayaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, 0.7, -0.6),
    new THREE.Vector3(1.5, 1.9, -0.2),
    new THREE.Vector3(1.3, 3.5, 0.5),
    new THREE.Vector3(0.3, 4.5, 0.4),
  ]);
  const bayaBodyGeo = new THREE.TubeGeometry(bayaCurve, 24, 0.46, 10, false);
  const bayaBody = new THREE.Mesh(bayaBodyGeo, bayaMat);
  bayaBody.castShadow = true;
  statueGroup.add(bayaBody);

  // Crocodile Snout / Jaws facing Sura
  const bayaJaws = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.38, 1.25),
    bayaMat
  );
  bayaJaws.position.set(-0.15, 4.85, 0.35);
  bayaJaws.rotation.y = -0.6;
  bayaJaws.rotation.x = -0.35;
  statueGroup.add(bayaJaws);

  group.add(statueGroup);

  // 5. Monument Name Plaque Banner at Front Entrance
  const plaqueTex = createWarungSpandukTexture(
    'TUGU SURABAYA · SURA & BAYA',
    'MONUMEN KOTA PAHLAWAN · WANI!',
    '#fef08a',
    '#15803d',
    maxAnisotropy
  );
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.25, 0.25),
    new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.35 })
  );
  plaque.position.set(0, 1.65, 8.6);
  group.add(plaque);

  return group;
}

export function createTamanKota(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TamanKotaNusantara';

  const lawnMat = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.85,
    metalness: 0.02,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
    metalness: 0.05,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.72,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.68,
    metalness: 0.08,
  });

  // 1. Full 41.6m x 41.6m Green Park Lawn Base
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(41.6, 0.08, 41.6), lawnMat);
  lawn.position.y = 0.04;
  lawn.receiveShadow = true;
  group.add(lawn);

  // 2. Cross Promenade Paths & Central Circular Plaza
  const pathNS = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 41.6), stoneMat);
  pathNS.position.y = 0.06;
  pathNS.receiveShadow = true;
  group.add(pathNS);

  const pathEW = new THREE.Mesh(new THREE.BoxGeometry(41.6, 0.12, 4.4), stoneMat);
  pathEW.position.y = 0.06;
  pathEW.receiveShadow = true;
  group.add(pathEW);

  const centerCircle = new THREE.Mesh(
    new THREE.CylinderGeometry(8.5, 8.8, 0.16, 32),
    stoneMat
  );
  centerCircle.position.y = 0.08;
  centerCircle.receiveShadow = true;
  group.add(centerCircle);

  // Outer Circular Jogging Track Ring
  const joggingRing = new THREE.Mesh(
    new THREE.RingGeometry(13.5, 16.2, 40),
    new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.78,
      side: THREE.DoubleSide,
    })
  );
  joggingRing.rotation.x = -Math.PI / 2;
  joggingRing.position.y = 0.095;
  joggingRing.receiveShadow = true;
  group.add(joggingRing);

  // 3. Central Gazebo Kayu Jati (Pendopo Joglo Taman)
  const gazeboGroup = new THREE.Group();
  const gazeboDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.9, 0.45, 8),
    woodMat
  );
  gazeboDeck.position.y = 0.32;
  gazeboDeck.castShadow = true;
  gazeboDeck.receiveShadow = true;
  gazeboGroup.add(gazeboDeck);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(angle) * 3.8;
    const pz = Math.sin(angle) * 3.8;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 3.2, 8),
      woodMat
    );
    pillar.position.set(px, 2.0, pz);
    pillar.castShadow = true;
    gazeboGroup.add(pillar);
  }

  // Two-Tier Joglo Terracotta Roof
  const lowerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(5.6, 1.5, 8),
    roofMat
  );
  lowerRoof.position.y = 4.1;
  lowerRoof.castShadow = true;
  gazeboGroup.add(lowerRoof);

  const upperRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3.1, 1.6, 8),
    roofMat
  );
  upperRoof.position.y = 5.1;
  upperRoof.castShadow = true;
  gazeboGroup.add(upperRoof);

  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
    })
  );
  lantern.position.y = 3.3;
  gazeboGroup.add(lantern);
  group.add(gazeboGroup);

  // 4. West Side: Kolam Air Mancur & Ikan Koi (-10.5, 0, -9.5)
  const pondGroup = new THREE.Group();
  pondGroup.position.set(-10.5, 0, -9.5);
  const pondRim = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.8, 0.48, 24),
    stoneMat
  );
  pondRim.position.y = 0.24;
  pondGroup.add(pondRim);

  const pondWater = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.1, 0.5, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
    })
  );
  pondWater.position.y = 0.26;
  pondGroup.add(pondWater);

  const fountainSpout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.8, 1.8, 12),
    stoneMat
  );
  fountainSpout.position.y = 0.9;
  pondGroup.add(fountainSpout);

  const fountainTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
  );
  fountainTop.position.y = 1.95;
  pondGroup.add(fountainTop);
  group.add(pondGroup);

  // 5. East Side: Playground Anak (Ayunan & Perosotan Warna-Warni) at (10.5, 0, -9.5)
  const playGroup = new THREE.Group();
  playGroup.position.set(10.5, 0, -9.5);
  const sandPit = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.12, 7.2),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 })
  );
  sandPit.position.y = 0.08;
  playGroup.add(sandPit);

  // Swing Set Frame (Ayunan)
  const metalBlue = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.5,
    roughness: 0.35,
  });
  const topBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8),
    metalBlue
  );
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(-1.5, 2.5, 0);
  playGroup.add(topBar);

  for (const sx of [-3.4, 0.4]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8),
      metalBlue
    );
    leg.position.set(sx, 1.3, 0);
    playGroup.add(leg);
  }

  // Slide (Perosotan Merah-Kuning)
  const slidePlatform = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.8, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  slidePlatform.position.set(2.2, 0.95, -1.0);
  playGroup.add(slidePlatform);

  const slideRamp = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.16, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 })
  );
  slideRamp.position.set(2.2, 0.95, 0.9);
  slideRamp.rotation.x = 0.52;
  playGroup.add(slideRamp);
  group.add(playGroup);

  // 6. Four Tropical Flowerbed Planters & Park Benches
  const flowerColors = [0xec4899, 0xfacc15, 0xa855f7, 0xf97316];
  const quadrantCoords: [number, number][] = [
    [-9.5, 9.5],
    [9.5, 9.5],
    [-9.5, -1.5],
    [9.5, -1.5],
  ];
  quadrantCoords.forEach(([qx, qz], idx) => {
    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.38, 2.0),
      stoneMat
    );
    planter.position.set(qx, 0.22, qz);
    group.add(planter);

    for (let f = -1.4; f <= 1.4; f += 0.7) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.52, 1),
        new THREE.MeshStandardMaterial({
          color: flowerColors[(idx + Math.round(f + 2)) % flowerColors.length],
          roughness: 0.65,
        })
      );
      bush.position.set(qx + f, 0.62, qz);
      group.add(bush);
    }
  });

  // Park Benches along Central Plaza
  for (const [bx, bz, rotY] of [
    [-6.2, 0, Math.PI / 2],
    [6.2, 0, -Math.PI / 2],
    [0, -6.2, 0],
    [0, 6.2, Math.PI],
  ]) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.45, 0.65),
      woodMat
    );
    bench.position.set(bx, 0.32, bz);
    bench.rotation.y = rotY;
    bench.castShadow = true;
    group.add(bench);
  }

  // 7. Welcome Arch & Signage at North Entrance (facing -Z toward z=60 Avenue)
  const archTex = createWarungSpandukTexture(
    'TAMAN KOTA NUSANTARA',
    'RUANG TERBUKA HIJAU · REKREASI WARGA',
    '#dcfce7',
    '#15803d',
    maxAnisotropy
  );
  const archSign = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.35, 0.28),
    new THREE.MeshStandardMaterial({ map: archTex, roughness: 0.35 })
  );
  archSign.position.set(0, 3.6, -18.8);
  group.add(archSign);

  for (const px of [-3.1, 3.1]) {
    const archPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.8, 8),
      woodMat
    );
    archPole.position.set(px, 1.9, -18.8);
    archPole.castShadow = true;
    group.add(archPole);
  }

  return group;
}

export function createSekolahNusantara(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SekolahSMAN1Nusantara';

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.65,
    metalness: 0.05,
  });
  const whiteTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
  });
  const gentengRoofMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.68,
    metalness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.2,
    clearcoat: 0.9,
  });

  // 1. School Campus Courtyard Paving & Lawn Base (41.6m x 41.6m)
  const campusBase = new THREE.Mesh(
    new THREE.BoxGeometry(41.6, 0.08, 41.6),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 })
  );
  campusBase.position.y = 0.04;
  campusBase.receiveShadow = true;
  group.add(campusBase);

  // 2. Lapangan Upacara & Lapangan Basket in Front Courtyard (z = -6.5)
  const courtMesh = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.08, 13.5),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.72 })
  );
  courtMesh.position.set(0, 0.09, -6.5);
  courtMesh.receiveShadow = true;
  group.add(courtMesh);

  const courtBorder = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.45, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  courtBorder.rotation.x = -Math.PI / 2;
  courtBorder.position.set(0, 0.14, -6.5);
  group.add(courtBorder);

  // Tiang Bendera Merah Putih (School Ceremony Flagpole at z = -1.2)
  const flagPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.45, 2.4),
    whiteTrimMat
  );
  flagPedestal.position.set(0, 0.28, -1.2);
  group.add(flagPedestal);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 11.5, 10),
    whiteTrimMat
  );
  flagPole.position.set(0, 5.8, -1.2);
  flagPole.castShadow = true;
  group.add(flagPole);

  const flagRed = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.65, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
  );
  flagRed.position.set(1.1, 10.9, -1.2);
  group.add(flagRed);

  const flagWhite = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.65, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  );
  flagWhite.position.set(1.1, 10.25, -1.2);
  group.add(flagWhite);

  // 3. Main 2-Story School Building (Gedung Utama di Selatan z = +10.5)
  const mainHall = new THREE.Mesh(
    new THREE.BoxGeometry(32, 8.6, 8.8),
    wallMat
  );
  mainHall.position.set(0, 4.35, 10.5);
  mainHall.castShadow = true;
  mainHall.receiveShadow = true;
  group.add(mainHall);

  // Pitched Terracotta Roof (Atap Genteng Merah Khas Sekolah Indonesia)
  const mainRoof = new THREE.Mesh(
    new THREE.ConeGeometry(24, 3.8, 4),
    gentengRoofMat
  );
  mainRoof.rotation.y = Math.PI / 4;
  mainRoof.scale.set(1.02, 1, 0.36);
  mainRoof.position.set(0, 10.5, 10.5);
  mainRoof.castShadow = true;
  group.add(mainRoof);

  // Classroom Windows along Floor 1 & Floor 2 of Main Hall
  for (let wx = -12; wx <= 12; wx += 4) {
    for (const wy of [2.6, 6.4]) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.5, 0.16),
        glassMat
      );
      win.position.set(wx, wy, 6.05);
      group.add(win);
    }
  }

  // Second-Floor Balcony Corridor & White Pillars
  const balconySlab = new THREE.Mesh(
    new THREE.BoxGeometry(32.4, 0.4, 2.2),
    whiteTrimMat
  );
  balconySlab.position.set(0, 4.5, 5.2);
  group.add(balconySlab);

  for (let px = -14; px <= 14; px += 4) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 8.4, 0.42),
      whiteTrimMat
    );
    col.position.set(px, 4.25, 4.4);
    col.castShadow = true;
    group.add(col);
  }

  // 4. Left & Right Classroom Wings (Leter-U Campus Layout)
  for (const sx of [-14.2, 14.2]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 7.2, 16.5),
      wallMat
    );
    wing.position.set(sx, 3.65, -1.5);
    wing.castShadow = true;
    wing.receiveShadow = true;
    group.add(wing);

    const wingRoof = new THREE.Mesh(
      new THREE.ConeGeometry(13.2, 3.0, 4),
      gentengRoofMat
    );
    wingRoof.rotation.y = Math.PI / 4;
    wingRoof.scale.set(0.45, 1, 0.95);
    wingRoof.position.set(sx, 8.7, -1.5);
    wingRoof.castShadow = true;
    group.add(wingRoof);
  }

  // 5. Front School Perimeter Fence & Main Gate with Banner (at North edge z = -19.2)
  for (const fx of [-12.5, 12.5]) {
    const fenceWall = new THREE.Mesh(
      new THREE.BoxGeometry(13.5, 1.7, 0.45),
      whiteTrimMat
    );
    fenceWall.position.set(fx, 0.9, -19.2);
    fenceWall.castShadow = true;
    group.add(fenceWall);
  }

  for (const gx of [-4.6, 4.6]) {
    const gatePillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 4.4, 0.85),
      gentengRoofMat
    );
    gatePillar.position.set(gx, 2.25, -19.2);
    gatePillar.castShadow = true;
    group.add(gatePillar);
  }

  const schoolBannerTex = createWarungSpandukTexture(
    'SMA NEGERI 1 NUSANTARA',
    'GENERASI CERDAS · BERPRESTASI & BERBUDAYA',
    '#fef08a',
    '#1e3a8a',
    maxAnisotropy
  );
  const schoolSign = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 1.55, 0.35),
    new THREE.MeshStandardMaterial({ map: schoolBannerTex, roughness: 0.35 })
  );
  schoolSign.position.set(0, 4.35, -19.2);
  group.add(schoolSign);

  return group;
}

export function createHutanSungaiBlock(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HutanWisataDanSungaiAlami';

  const forestFloorMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.9,
    metalness: 0.02,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.08,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.78,
    metalness: 0.05,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
  });
  const pineLeavesMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    roughness: 0.75,
  });
  const rainforestLeavesMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.72,
  });

  // 1. Forest Floor Base (41.6m x 41.6m)
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(41.6, 0.08, 41.6),
    forestFloorMat
  );
  floor.position.y = 0.04;
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Winding Natural River Stream (Sungai Alami) flowing diagonally SW -> Center -> NE
  const riverSegments: [number, number, number, number, number][] = [
    [-11, 11, 8.5, 16, Math.PI / 4],
    [0, 0, 9.2, 18, Math.PI / 4],
    [11, -11, 8.5, 16, Math.PI / 4],
  ];
  riverSegments.forEach(([rx, rz, rw, rl, rotY]) => {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(rw + 1.8, 0.1, rl),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
    );
    bed.position.set(rx, 0.07, rz);
    bed.rotation.y = rotY;
    group.add(bed);

    const stream = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.14, rl), waterMat);
    stream.position.set(rx, 0.11, rz);
    stream.rotation.y = rotY;
    group.add(stream);
  });

  // 3. Rocky Waterfall Cliff (Tebing Batu & Air Terjun Mini) in SW Corner (-14.5, 0, 14.5)
  const cliffGroup = new THREE.Group();
  cliffGroup.position.set(-14.5, 0, 14.5);
  const cliffBlocks: [number, number, number, number, number, number][] = [
    [0, 2.6, 0, 7.5, 5.2, 6.5],
    [-2.5, 1.8, 1.5, 4.5, 3.6, 4.5],
    [2.5, 1.9, -1.5, 4.5, 3.8, 4.5],
  ];
  cliffBlocks.forEach(([cx, cy, cz, w, h, d]) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
    rock.position.set(cx, cy, cz);
    rock.scale.set(w * 0.55, h * 0.55, d * 0.55);
    rock.castShadow = true;
    rock.receiveShadow = true;
    cliffGroup.add(rock);
  });

  // Cascading Waterfall Sheet
  const fallWater = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 4.6, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
  );
  fallWater.position.set(1.4, 2.3, -1.4);
  fallWater.rotation.y = Math.PI / 4;
  fallWater.rotation.x = -0.22;
  cliffGroup.add(fallWater);

  const foamPool = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.5, 0.22, 16),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
  );
  foamPool.position.set(2.4, 0.14, -2.4);
  cliffGroup.add(foamPool);
  group.add(cliffGroup);

  // 4. Riverbank Boulders (Batu Kali) along both sides of the river
  const boulderCoords: [number, number, number][] = [
    [-7, 13, 1.1],
    [-13, 7, 1.2],
    [-4, 9, 0.9],
    [-9, 4, 0.85],
    [5, -9, 1.0],
    [9, -5, 1.15],
    [13, -7, 0.95],
    [7, -13, 1.05],
    [15, -11, 1.2],
    [-2, -6, 0.8],
    [6, 2, 0.9],
  ];
  boulderCoords.forEach(([bx, bz, bScale], idx) => {
    const boulder = new THREE.Mesh(
      new THREE.DodecahedronGeometry(bScale, 1),
      rockMat
    );
    boulder.position.set(bx, bScale * 0.45, bz);
    boulder.scale.set(1.2, 0.68, 1.0);
    boulder.rotation.y = idx * 0.9;
    boulder.castShadow = true;
    group.add(boulder);
  });

  // 5. Wooden Arch Bridge over the River (Jembatan Kayu Gantung) at (0, 0, 0)
  const bridgeGroup = new THREE.Group();
  bridgeGroup.rotation.y = -Math.PI / 4; // Perpendicular to the SW-NE river stream
  const bridgeDeck = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.25, 12.5),
    woodMat
  );
  bridgeDeck.position.y = 0.55;
  bridgeDeck.castShadow = true;
  bridgeDeck.receiveShadow = true;
  bridgeGroup.add(bridgeDeck);

  for (const sz of [-5.5, -2.8, 0, 2.8, 5.5]) {
    for (const sx of [-1.65, 1.65]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 1.25, 8),
        woodMat
      );
      post.position.set(sx, 1.1, sz);
      bridgeGroup.add(post);
    }
  }
  for (const sx of [-1.65, 1.65]) {
    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 11.6),
      woodMat
    );
    handrail.position.set(sx, 1.58, 0);
    bridgeGroup.add(handrail);
  }
  group.add(bridgeGroup);

  // 6. Dense Multi-Tiered Pine & Tropical Forest Trees inside the Block
  const forestTreePositions: [number, number, boolean][] = [
    [-15, -14, true],
    [-10, -15, false],
    [-16, -7, true],
    [-11, -7, true],
    [-16, 0, false],
    [-5, -13, true],
    [14, 14, true],
    [9, 15, false],
    [16, 8, true],
    [11, 8, true],
    [15, 1, false],
    [6, 13, true],
    [-4, 15, false],
    [16, -3, true],
  ];
  forestTreePositions.forEach(([tx, tz, isPine], idx) => {
    const tGroup = new THREE.Group();
    const scale = 0.95 + (idx % 3) * 0.22;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.38, 3.2, 8),
      woodMat
    );
    trunk.position.y = 1.6;
    trunk.castShadow = true;
    tGroup.add(trunk);

    if (isPine) {
      // 3-Tier Indonesian Mountain Pine Tree (Pohon Pinus / Cemara)
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.2, 8), pineLeavesMat);
      c1.position.y = 3.4;
      c1.castShadow = true;
      tGroup.add(c1);

      const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.8, 8), pineLeavesMat);
      c2.position.y = 5.0;
      c2.castShadow = true;
      tGroup.add(c2);

      const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), pineLeavesMat);
      c3.position.y = 6.4;
      c3.castShadow = true;
      tGroup.add(c3);
    } else {
      // Lush Tropical Rainforest Canopy Tree
      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.3, 1),
        rainforestLeavesMat
      );
      crown.position.y = 4.2;
      crown.castShadow = true;
      tGroup.add(crown);
    }

    tGroup.position.set(tx, 0, tz);
    tGroup.scale.setScalar(scale);
    group.add(tGroup);
  });

  // 7. Riverside Warung Kopi & Indomie at North Entrance (-5.5, 0, -14.8) facing North (-Z)
  const warungHutan = createWarungTenda(
    'WARUNG KOPI & INDOMIE SUNGAI',
    'JAGUNG BAKAR · ES TEH MANIS · KOPI TUBRUK',
    '#dcfce7',
    '#14532d',
    maxAnisotropy
  );
  warungHutan.position.set(-5.5, 0, -14.8);
  warungHutan.rotation.y = Math.PI;
  group.add(warungHutan);

  // Welcome Wooden Gate Sign at North Entrance (4.5, 0, -18.5)
  const signTex = createWarungSpandukTexture(
    'HUTAN WISATA & SUNGAI ALAMI',
    'AIR TERJUN MINI · JEMBATAN KAYU · HUTAN PINUS',
    '#fef08a',
    '#14532d',
    maxAnisotropy
  );
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 1.35, 0.28),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 })
  );
  signBoard.position.set(4.5, 3.5, -18.5);
  group.add(signBoard);

  for (const px of [1.5, 7.5]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.7, 8),
      woodMat
    );
    pole.position.set(px, 1.85, -18.5);
    group.add(pole);
  }

  return group;
}

export function createOuterRiverSystem(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SungaiKalimasNusantara';

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0891b2,
    roughness: 0.1,
    metalness: 0.18,
    clearcoat: 1.0,
  });
  const bankMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.75,
  });

  // 1. East Valley River Channel (x = 148, z = -165..156, width = 16m)
  const eastBank = new THREE.Mesh(
    new THREE.BoxGeometry(19.5, 0.12, 320),
    bankMat
  );
  eastBank.position.set(148, 0.02, -4);
  group.add(eastBank);

  const eastWater = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.14, 320),
    waterMat
  );
  eastWater.position.set(148, 0.06, -4);
  group.add(eastWater);

  // 2. South Valley River Channel (z = 148, x = -165..156, width = 16m)
  const southBank = new THREE.Mesh(
    new THREE.BoxGeometry(320, 0.12, 19.5),
    bankMat
  );
  southBank.position.set(-4, 0.02, 148);
  group.add(southBank);

  const southWater = new THREE.Mesh(
    new THREE.BoxGeometry(320, 0.14, 16),
    waterMat
  );
  southWater.position.set(-4, 0.06, 148);
  group.add(southWater);

  // 3. Helper to build a Merah-Putih Highway Bridge spanning across the River
  const createHighwayBridge = (bx: number, bz: number, rotY: number) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0, bz);
    bGroup.rotation.y = rotY;

    // Raised Asphalt Bridge Deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.32, 22),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    deck.position.y = 0.18;
    deck.receiveShadow = true;
    bGroup.add(deck);

    const redSteelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.5,
      roughness: 0.35,
    });
    const whiteSteelMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.4,
      roughness: 0.35,
    });

    // Side Bridge Parapet Walls & Red-White Steel Truss Arches
    for (const sx of [-7.2, 7.2]) {
      const railWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.2, 22),
        whiteSteelMat
      );
      railWall.position.set(sx, 0.85, 0);
      bGroup.add(railWall);

      const topChord = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 18),
        redSteelMat
      );
      topChord.position.set(sx, 4.2, 0);
      bGroup.add(topChord);

      for (const sz of [-8.5, -3, 3, 8.5]) {
        const strut = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 3.6, 0.4),
          sz % 2 === 0 ? whiteSteelMat : redSteelMat
        );
        strut.position.set(sx, 2.4, sz);
        bGroup.add(strut);
      }
    }
    return bGroup;
  };

  // Place Highway Bridges where the South (0, 148) & East (148, 0) Gateway Roads cross the River!
  group.add(createHighwayBridge(0, 148, 0));
  group.add(createHighwayBridge(148, 0, Math.PI / 2));

  // 4. Traditional Wooden Boats (Perahu Sampan Kayu) floating on the River
  const boatCoords: [number, number, number][] = [
    [148, -45, 0],
    [148, 55, Math.PI],
    [-45, 148, Math.PI / 2],
    [65, 148, -Math.PI / 2],
  ];
  boatCoords.forEach(([px, pz, rotY]) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.55, 5.2),
      woodMat
    );
    hull.position.y = 0.32;
    hull.castShadow = true;
    boat.add(hull);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.9, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
    );
    canopy.position.y = 0.95;
    boat.add(canopy);

    boat.position.set(px, 0, pz);
    boat.rotation.y = rotY;
    group.add(boat);
  });

  return group;
}



