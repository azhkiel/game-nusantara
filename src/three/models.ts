import * as THREE from 'three';
import { OutfitStyle, VehicleType } from '../types/game';
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
  pantsColor: number
): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(1.1, 1.1));

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49464, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });

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

  // Cap / hat accent
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  );
  cap.position.set(0, 1.76, 0);
  group.add(cap);

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

