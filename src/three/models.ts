import * as THREE from 'three';
import { OutfitStyle, PedestrianArchetype, VehicleType } from '../types/game';
import {
  createBankSampahSignTexture,
  createBatikFabricTexture,
  createGentengClayTexture,
  createLicensePlateTexture,
  createLosPasarSignTexture,
  createMaduraSignTexture,
  createMinimarketSignTexture,
  createPasarBannerTexture,
  createPosKamlingSignTexture,
  createRumahKarakterSignTexture,
  createTokoSembakoSignTexture,
  createTPSSignTexture,
  createTPUSignTexture,
  createWarkopSignTexture,
  createWarungSpandukTexture,
} from './textures';

let _sharedContactShadowMat: THREE.MeshBasicMaterial | null = null;
let _sharedContactShadowGeo: THREE.PlaneGeometry | null = null;

function createContactShadow(width: number, depth: number): THREE.Mesh {
  if (!_sharedContactShadowMat) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    _sharedContactShadowMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }
  if (!_sharedContactShadowGeo) {
    _sharedContactShadowGeo = new THREE.PlaneGeometry(1, 1);
    _sharedContactShadowGeo.rotateX(-Math.PI / 2);
  }
  const plane = new THREE.Mesh(_sharedContactShadowGeo, _sharedContactShadowMat);
  plane.scale.set(width, 1, depth);
  plane.position.y = 0.025;
  return plane;
}

export function createPlayerCharacter(
  outfit: OutfitStyle,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlayerCharacter';

  // Ground contact shadow (stays flat on ground)
  group.add(createContactShadow(1.3, 1.3));

  // Root animated body container (allows vertical stride bounce & turn banking without lifting contact shadow)
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b66,
    roughness: 0.6,
    metalness: 0.04,
  });

  let jacketMat: THREE.MeshStandardMaterial;
  let innerShirtColor = 0xf8fafc;
  if (outfit === 'batik') {
    jacketMat = new THREE.MeshStandardMaterial({
      map: createBatikFabricTexture(maxAnisotropy),
      roughness: 0.72,
      metalness: 0.08,
    });
    innerShirtColor = 0x1e293b;
  } else if (outfit === 'jaket_kulit') {
    jacketMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.3,
      metalness: 0.38,
    });
    innerShirtColor = 0xdc2626;
  } else {
    // Iconic Ojol Green Jacket
    jacketMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.5,
      metalness: 0.12,
    });
    innerShirtColor = 0xf8fafc;
  }

  const innerShirtMat = new THREE.MeshStandardMaterial({
    color: innerShirtColor,
    roughness: 0.7,
  });

  const darkAccentMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: outfit === 'batik' ? 0x0f172a : 0x1e293b,
    roughness: 0.78,
    metalness: 0.05,
  });

  const shoeUpperMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.2,
  });
  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
  });

  // 1. Pelvis / Hip Belt Group
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.88, 0);
  const pelvisMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.22, 6, 10),
    pantsMat
  );
  pelvisMesh.rotation.z = Math.PI / 2;
  pelvisMesh.scale.set(1, 1, 0.82);
  pelvisMesh.castShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Leather belt & buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14),
    darkAccentMat
  );
  belt.scale.set(1.08, 1, 0.72);
  belt.position.y = 0.06;
  pelvisGroup.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.075, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
  );
  buckle.position.set(0, 0.06, 0.175);
  pelvisGroup.add(buckle);
  bodyRoot.add(pelvisGroup);

  // 2. Articulated Two-Segment Legs (Thigh -> Knee Joint -> Shin/Calf -> Sneaker)
  const buildArticulatedLeg = (hipX: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(hipX, 0.86, 0);

    // Upper Leg (Thigh)
    const thighGeo = new THREE.CapsuleGeometry(0.115, 0.26, 5, 10);
    thighGeo.translate(0, -0.18, 0);
    const thighMesh = new THREE.Mesh(thighGeo, pantsMat);
    thighMesh.castShadow = true;
    hipPivot.add(thighMesh);

    // Knee Pivot at y = -0.38 relative to hip
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.38, 0);

    const shinGeo = new THREE.CapsuleGeometry(0.098, 0.26, 5, 10);
    shinGeo.translate(0, -0.18, 0);
    const shinMesh = new THREE.Mesh(shinGeo, pantsMat);
    shinMesh.castShadow = true;
    kneePivot.add(shinMesh);

    // Ankle & Detailed Sneaker
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.4, 0.04);

    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.11, 0.34),
      shoeUpperMat
    );
    shoeUpper.position.set(0, 0.03, 0);
    shoeUpper.castShadow = true;
    shoeGroup.add(shoeUpper);

    const shoeSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.045, 0.37),
      shoeSoleMat
    );
    shoeSole.position.set(0, -0.04, 0.005);
    shoeGroup.add(shoeSole);

    const shoeStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.218, 0.03, 0.16),
      shoeSoleMat
    );
    shoeStripe.position.set(0, 0.03, -0.02);
    shoeGroup.add(shoeStripe);

    kneePivot.add(shoeGroup);
    hipPivot.add(kneePivot);
    bodyRoot.add(hipPivot);

    return { hipPivot, kneePivot };
  };

  const leftLegData = buildArticulatedLeg(-0.155);
  const rightLegData = buildArticulatedLeg(0.155);

  const leftLeg = leftLegData.hipPivot;
  const rightLeg = rightLegData.hipPivot;
  const leftKnee = leftLegData.kneePivot;
  const rightKnee = rightLegData.kneePivot;

  // 3. Upper Body / Spine Pivot (at waist y = 0.94)
  const upperBodyGroup = new THREE.Group();
  upperBodyGroup.position.set(0, 0.94, 0);
  bodyRoot.add(upperBodyGroup);

  // Sculpted Torso (Tapered athletic chest)
  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.23, 0.0);
  torsoShape.lineTo(0.23, 0.0);
  torsoShape.lineTo(0.29, 0.56);
  torsoShape.lineTo(-0.29, 0.56);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  torsoGeo.translate(0, 0, -0.12);
  const torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.position.set(0, 0.0, 0);
  torso.castShadow = true;
  upperBodyGroup.add(torso);

  // Inner Shirt V-Neck / Chest Panel
  if (outfit !== 'batik') {
    const innerTee = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.46, 0.04),
      innerShirtMat
    );
    innerTee.position.set(0, 0.31, 0.15);
    upperBodyGroup.add(innerTee);
  }

  // Jacket Collar
  const collarGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.11, 12, 1, true, -Math.PI * 0.8, Math.PI * 1.6);
  const collar = new THREE.Mesh(collarGeo, outfit === 'ojol' ? darkAccentMat : jacketMat);
  collar.rotation.y = Math.PI;
  collar.position.set(0, 0.6, 0);
  upperBodyGroup.add(collar);

  // Outfit-specific details (Reflective stripes + Sling bag for Ojol)
  if (outfit === 'ojol') {
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.8,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.065, 0.33), stripMat);
    strip.position.set(0, 0.36, 0);
    upperBodyGroup.add(strip);

    // Shoulder pads
    for (const sx of [-0.26, 0.26]) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.07, 0.28),
        darkAccentMat
      );
      pad.position.set(sx, 0.56, 0);
      upperBodyGroup.add(pad);
    }

    // Crossbody Sling Bag (Tas Selempang Ojol)
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.62, 0.32),
      darkAccentMat
    );
    strap.position.set(0.02, 0.3, 0);
    strap.rotation.z = 0.58;
    upperBodyGroup.add(strap);

    const pouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.15, 0.09),
      darkAccentMat
    );
    pouch.position.set(-0.08, 0.22, 0.17);
    pouch.rotation.z = -0.15;
    upperBodyGroup.add(pouch);
  }

  // 4. Articulated Two-Segment Arms (Shoulder -> Upper Arm -> Elbow Joint -> Forearm -> Hand)
  const buildArticulatedArm = (shoulderX: number, isLeft: boolean) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(shoulderX, 0.52, 0);

    // Upper Arm (Sleeve)
    const upperArmGeo = new THREE.CapsuleGeometry(0.088, 0.21, 5, 10);
    upperArmGeo.translate(0, -0.13, 0);
    const upperArmMesh = new THREE.Mesh(upperArmGeo, jacketMat);
    upperArmMesh.castShadow = true;
    shoulderPivot.add(upperArmMesh);

    // Elbow Pivot at y = -0.27 relative to shoulder
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.27, 0);

    const forearmGeo = new THREE.CapsuleGeometry(
      0.076,
      0.2,
      5,
      10
    );
    forearmGeo.translate(0, -0.12, 0);
    const forearmMesh = new THREE.Mesh(
      forearmGeo,
      outfit === 'batik' ? skinMat : jacketMat
    );
    forearmMesh.castShadow = true;
    elbowPivot.add(forearmMesh);

    // Wristwatch on Left Wrist
    if (isLeft) {
      const watch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.082, 0.04, 10),
        darkAccentMat
      );
      watch.position.set(0, -0.21, 0);
      elbowPivot.add(watch);
    }

    // Sculpted Hand & Thumb
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.27, 0);
    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 10, 10),
      skinMat
    );
    palm.scale.set(0.88, 1.08, 0.95);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.025, 0.04, 4, 6),
      skinMat
    );
    thumb.position.set(isLeft ? 0.05 : -0.05, 0.01, 0.04);
    thumb.rotation.x = 0.5;
    handGroup.add(thumb);

    elbowPivot.add(handGroup);
    shoulderPivot.add(elbowPivot);
    upperBodyGroup.add(shoulderPivot);

    return { shoulderPivot, elbowPivot };
  };

  const leftArmData = buildArticulatedArm(-0.36, true);
  const rightArmData = buildArticulatedArm(0.36, false);

  const leftArm = leftArmData.shoulderPivot;
  const rightArm = rightArmData.shoulderPivot;
  const leftElbow = leftArmData.elbowPivot;
  const rightElbow = rightArmData.elbowPivot;

  // 5. Neck & Expressive Head Group (at y = 0.62 relative to upperBodyGroup)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.1, 0.14, 10),
    skinMat
  );
  neck.position.set(0, 0.62, 0);
  upperBodyGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.78, 0);

  // Rounded Head
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 18, 16),
    skinMat
  );
  headMesh.scale.set(0.96, 1.05, 0.98);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Left & Right Ears
  for (const ex of [-0.205, 0.205]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      skinMat
    );
    ear.scale.set(0.55, 1.1, 0.8);
    ear.position.set(ex, 0.0, 0);
    headGroup.add(ear);
  }

  // Nose bridge
  const nose = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.04, 4, 6),
    skinMat
  );
  nose.position.set(0, -0.01, 0.21);
  headGroup.add(nose);

  // Stylish Dark Aviator Sunglasses
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    roughness: 0.08,
    metalness: 0.9,
    clearcoat: 1.0,
  });
  for (const gx of [-0.075, 0.075]) {
    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.125, 0.078, 0.04),
      visorMat
    );
    lens.position.set(gx, 0.035, 0.195);
    lens.rotation.y = gx < 0 ? 0.12 : -0.12;
    headGroup.add(lens);
  }
  const glassBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.018, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
  );
  glassBridge.position.set(0, 0.045, 0.205);
  headGroup.add(glassBridge);

  // Confident Smile Mouth Line
  const smile = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.018, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  smile.position.set(0, -0.085, 0.198);
  headGroup.add(smile);

  if (outfit === 'ojol') {
    // Iconic Green Ojol Half-Face Helmet with Black Trim & Top Visor Peak
    const helmetMat = new THREE.MeshPhysicalMaterial({
      color: 0x15803d,
      roughness: 0.18,
      metalness: 0.28,
      clearcoat: 0.95,
    });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.64),
      helmetMat
    );
    helmet.position.y = 0.02;
    headGroup.add(helmet);

    // Helmet front peak cap
    const peak = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.035, 0.16),
      darkAccentMat
    );
    peak.position.set(0, 0.13, 0.19);
    peak.rotation.x = 0.18;
    headGroup.add(peak);

    // Helmet ear pads & chin strap
    for (const sx of [-0.21, 0.21]) {
      const earPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.16, 0.16),
        darkAccentMat
      );
      earPad.position.set(sx, -0.02, -0.01);
      headGroup.add(earPad);
    }
  } else if (outfit === 'batik') {
    // Authentic Velvet Black Indonesian Peci Songkok with Gold Trim
    const peciMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });
    const peci = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.215, 0.15, 16),
      peciMat
    );
    peci.scale.set(0.95, 1, 1.06);
    peci.position.set(0, 0.18, 0);
    peci.rotation.x = -0.05;
    headGroup.add(peci);
  } else {
    // Stylized Layered Modern Hair
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.05,
    });
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairCap.position.set(0, 0.03, -0.01);
    headGroup.add(hairCap);

    const quiff = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.18),
      hairMat
    );
    quiff.position.set(0, 0.2, 0.1);
    quiff.rotation.x = -0.25;
    headGroup.add(quiff);
  }

  upperBodyGroup.add(headGroup);

  group.userData.limbs = {
    bodyRoot,
    pelvisGroup,
    upperBodyGroup,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
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

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

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

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49464, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: finalShirt, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: finalPants, roughness: 0.82 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });

  // 1. Pelvis / Hip Group
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.24),
    pantsMat
  );
  pelvis.position.set(0, 0.82, 0);
  bodyRoot.add(pelvis);

  // 2. Articulated Two-Segment Legs (Thigh -> Knee -> Shin -> Shoe)
  const thighGeo = new THREE.CapsuleGeometry(0.098, 0.24, 4, 8);
  thighGeo.translate(0, -0.15, 0);
  const shinGeo = new THREE.CapsuleGeometry(0.084, 0.24, 4, 8);
  shinGeo.translate(0, -0.15, 0);

  const buildNPCLeg = (hipX: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(hipX, 0.8, 0);

    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.34, 0);

    const shin = new THREE.Mesh(shinGeo, pantsMat);
    shin.castShadow = true;
    kneePivot.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.29), shoeMat);
    shoe.position.set(0, -0.36, 0.035);
    kneePivot.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.31), soleMat);
    sole.position.set(0, -0.41, 0.035);
    kneePivot.add(sole);

    hipPivot.add(kneePivot);
    bodyRoot.add(hipPivot);
    return { hipPivot, kneePivot };
  };

  const leftLegData = buildNPCLeg(-0.135);
  const rightLegData = buildNPCLeg(0.135);
  const leftLeg = leftLegData.hipPivot;
  const rightLeg = rightLegData.hipPivot;
  const leftKnee = leftLegData.kneePivot;
  const rightKnee = rightLegData.kneePivot;

  // 3. Upper Body / Spine Group (pivoted at waist y = 0.88)
  const upperBodyGroup = new THREE.Group();
  upperBodyGroup.position.set(0, 0.88, 0);
  bodyRoot.add(upperBodyGroup);

  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.21, 0);
  torsoShape.lineTo(0.21, 0);
  torsoShape.lineTo(0.25, 0.54);
  torsoShape.lineTo(-0.25, 0.54);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  torsoGeo.translate(0, 0, -0.11);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.castShadow = true;
  upperBodyGroup.add(torso);

  // Shirt Collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.08, 10),
    shirtMat
  );
  collar.position.set(0, 0.57, 0);
  upperBodyGroup.add(collar);

  // Archetype-specific details (SMA tie + backpack, Ojol stripe, Santri koko embroidery, Batik placket)
  if (archetype === 'pelajar_sma') {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.32, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    );
    tie.position.set(0, 0.34, 0.14);
    upperBodyGroup.add(tie);

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75 })
    );
    backpack.position.set(0, 0.28, -0.2);
    backpack.castShadow = true;
    upperBodyGroup.add(backpack);
  } else if (archetype === 'ojol') {
    const chestStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.51, 0.07, 0.29),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.22,
        roughness: 0.3,
      })
    );
    chestStripe.position.set(0, 0.34, 0);
    upperBodyGroup.add(chestStripe);
  } else if (archetype === 'santri') {
    // Gold Baju Koko vertical embroidery placket
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.38, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
    );
    placket.position.set(0, 0.32, 0.14);
    upperBodyGroup.add(placket);
  } else if (archetype === 'pekerja_batik') {
    const batikAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.48, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
    );
    batikAccent.position.set(0, 0.28, 0.14);
    upperBodyGroup.add(batikAccent);
  }

  // 4. Articulated Two-Segment Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
  const upperArmGeo = new THREE.CapsuleGeometry(0.076, 0.19, 4, 8);
  upperArmGeo.translate(0, -0.12, 0);
  const forearmGeo = new THREE.CapsuleGeometry(0.066, 0.19, 4, 8);
  forearmGeo.translate(0, -0.11, 0);

  const buildNPCArm = (shoulderX: number) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(shoulderX, 0.5, 0);

    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    upperArm.castShadow = true;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.25, 0);

    const forearm = new THREE.Mesh(
      forearmGeo,
      archetype === 'ojol' ? shirtMat : skinMat
    );
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
    hand.position.set(0, -0.24, 0);
    elbowPivot.add(hand);

    shoulderPivot.add(elbowPivot);
    upperBodyGroup.add(shoulderPivot);
    return { shoulderPivot, elbowPivot };
  };

  const leftArmData = buildNPCArm(-0.31);
  const rightArmData = buildNPCArm(0.31);
  const leftArm = leftArmData.shoulderPivot;
  const rightArm = rightArmData.shoulderPivot;
  const leftElbow = leftArmData.elbowPivot;
  const rightElbow = rightArmData.elbowPivot;

  // Smartphone held in Right Hand (attached to rightElbow so it moves with the hand!)
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.14, 0.025),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.8,
    })
  );
  phone.position.set(0, -0.26, 0.06);
  phone.visible = false;
  rightElbow.add(phone);

  // 5. Neck & Expressive Head (Eyes, Eyebrows, Nose, Ears, Smile & Headgear)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.088, 0.12, 8),
    skinMat
  );
  neck.position.set(0, 0.6, 0);
  upperBodyGroup.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.74, 0);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), skinMat);
  headSphere.scale.set(0.96, 1.04, 0.98);
  headSphere.castShadow = true;
  head.add(headSphere);

  // Ears
  for (const ex of [-0.18, 0.18]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), skinMat);
    ear.scale.set(0.55, 1.1, 0.8);
    ear.position.set(ex, 0, 0);
    head.add(ear);
  }

  // Eyes & Eyebrows
  for (const ex of [-0.062, 0.062]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 6),
      darkMat
    );
    eye.position.set(ex, 0.025, 0.172);
    head.add(eye);

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.014, 0.015),
      darkMat
    );
    brow.position.set(ex, 0.065, 0.172);
    head.add(brow);
  }

  // Nose & Friendly Smile
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.045, 0.035), skinMat);
  nose.position.set(0, -0.01, 0.185);
  head.add(nose);

  const smile = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.016, 0.015),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  smile.position.set(0, -0.07, 0.175);
  head.add(smile);

  // Headgear per archetype
  if (archetype === 'ojol') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.215, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.25, metalness: 0.25 })
    );
    helmet.position.set(0, 0.02, 0);
    head.add(helmet);

    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.12), darkMat);
    peak.position.set(0, 0.11, 0.16);
    peak.rotation.x = 0.15;
    head.add(peak);
  } else if (archetype === 'santri') {
    // Black Indonesian Peci / Songkok
    const peci = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.19, 0.13, 14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
    );
    peci.scale.set(0.95, 1, 1.05);
    peci.position.set(0, 0.15, 0);
    head.add(peci);
  } else if (archetype === 'pelajar_sma') {
    // Navy blue & white Indonesian SMA school cap (Topi Sekolah SMA)
    const capCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.198, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 })
    );
    capCrown.position.set(0, 0.03, 0);
    head.add(capCrown);

    const capBrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.025, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
    );
    capBrim.position.set(0, 0.08, 0.16);
    capBrim.rotation.x = 0.15;
    head.add(capBrim);
  } else {
    // Styled Natural Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      darkMat
    );
    hair.position.set(0, 0.03, -0.01);
    head.add(hair);
  }

  upperBodyGroup.add(head);

  group.userData.limbs = {
    bodyRoot,
    upperBodyGroup,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    head,
    phone,
  };
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
    roughness: 0.62,
    metalness: 0.04,
  });
  const accentWallMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.6,
    metalness: 0.05,
  });
  const whiteTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.45,
  });
  const stonePlinthMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
  });
  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const gentengRoofMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    color: 0xb91c1c,
    roughness: 0.65,
    metalness: 0.08,
  });
  const ridgeCapMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.55,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.2,
    clearcoat: 0.9,
  });
  const woodDoorMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.65,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.7,
  });

  // Helper: Build a properly aligned rectangular Hip Roof (Atap Limasan Genteng) with white fascia eaves & ridge beam
  // By rotating the ConeGeometry in vertex space BEFORE scaling, the rectangular base aligns 100% with X and Z!
  const createAlignedHipRoof = (
    widthX: number,
    depthZ: number,
    heightY: number
  ): THREE.Group => {
    const rGroup = new THREE.Group();

    // 1. White fascia eaves board (Lisplang Putih)
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(widthX + 0.3, 0.34, depthZ + 0.3),
      whiteTrimMat
    );
    fascia.position.y = 0.17;
    fascia.castShadow = true;
    rGroup.add(fascia);

    // 2. Rectangular pyramid hip roof (geometry rotated 45 deg BEFORE scaling X and Z)
    const pyrGeo = new THREE.ConeGeometry(Math.SQRT1_2, heightY, 4);
    pyrGeo.rotateY(Math.PI / 4);
    pyrGeo.translate(0, heightY / 2 + 0.22, 0);
    pyrGeo.scale(widthX, 1, depthZ);
    pyrGeo.computeVertexNormals();

    const pyrMesh = new THREE.Mesh(pyrGeo, gentengRoofMat);
    pyrMesh.castShadow = true;
    pyrMesh.receiveShadow = true;
    rGroup.add(pyrMesh);

    // 3. Upper Limasan flat ridge crest (Bubungan Atap Genteng) so long roofs look like authentic Indonesian Limasan roofs
    const isLongX = widthX >= depthZ;
    const ridgeLen = isLongX ? widthX * 0.52 : depthZ * 0.52;
    const ridgePrismGeo = new THREE.ConeGeometry(Math.SQRT1_2, heightY * 0.78, 4);
    ridgePrismGeo.rotateY(Math.PI / 4);
    ridgePrismGeo.translate(0, (heightY * 0.78) / 2 + 0.22, 0);
    ridgePrismGeo.scale(
      isLongX ? widthX * 0.86 : widthX * 0.72,
      1,
      isLongX ? depthZ * 0.72 : depthZ * 0.86
    );
    ridgePrismGeo.computeVertexNormals();
    const upperTier = new THREE.Mesh(ridgePrismGeo, gentengRoofMat);
    upperTier.position.y = heightY * 0.22;
    upperTier.castShadow = true;
    rGroup.add(upperTier);

    // Terracotta ridge beam cap (Nok Genteng)
    const nok = new THREE.Mesh(
      new THREE.BoxGeometry(
        isLongX ? ridgeLen : 0.32,
        0.24,
        isLongX ? 0.32 : ridgeLen
      ),
      ridgeCapMat
    );
    nok.position.y = heightY + 0.18;
    rGroup.add(nok);

    return rGroup;
  };

  // 1. School Campus Courtyard Paving & Green Lawn Base (41.6m x 41.6m)
  const campusBase = new THREE.Mesh(
    new THREE.BoxGeometry(41.6, 0.08, 41.6),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 })
  );
  campusBase.position.y = 0.04;
  campusBase.receiveShadow = true;
  group.add(campusBase);

  // Green lawn border strips around campus perimeter
  for (const [lx, lz, lw, ld] of [
    [0, 17.8, 39.6, 4.2],
    [-18.8, -1.5, 2.8, 34.0],
    [18.8, -1.5, 2.8, 34.0],
  ]) {
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(lw, 0.09, ld),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.88 })
    );
    lawn.position.set(lx, 0.05, lz);
    lawn.receiveShadow = true;
    group.add(lawn);
  }

  // 2. Lapangan Upacara & Lapangan Basket in Front Courtyard (z = -6.5)
  const courtMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20.5, 0.08, 12.8),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.72 })
  );
  courtMesh.position.set(0, 0.09, -6.5);
  courtMesh.receiveShadow = true;
  group.add(courtMesh);

  // White court boundary lines & center circle
  const courtCenterRing = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 2.22, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  courtCenterRing.rotation.x = -Math.PI / 2;
  courtCenterRing.position.set(0, 0.14, -6.5);
  group.add(courtCenterRing);

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.02, 12.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  centerLine.position.set(0, 0.14, -6.5);
  group.add(centerLine);

  // Basketball Hoops (Tiang Ring Basket Sekolah) at West & East ends of the court
  for (const dir of [-1, 1]) {
    const hoopGroup = new THREE.Group();
    hoopGroup.position.set(dir * 9.6, 0, -6.5);
    hoopGroup.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8),
      stonePlinthMat
    );
    post.position.y = 1.7;
    hoopGroup.add(post);

    const backboard = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.05, 0.08),
      whiteTrimMat
    );
    backboard.position.set(0, 3.25, 0.45);
    hoopGroup.add(backboard);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.03, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 2.95, 0.74);
    hoopGroup.add(rim);

    group.add(hoopGroup);
  }

  // Tiang Bendera Merah Putih (School Ceremony Flagpole at z = -0.5)
  const flagPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.42, 2.6),
    whiteTrimMat
  );
  flagPedestal.position.set(0, 0.25, -0.5);
  group.add(flagPedestal);

  const flagPedestalStep = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.18, 3.4),
    stonePlinthMat
  );
  flagPedestalStep.position.set(0, 0.09, -0.5);
  group.add(flagPedestalStep);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 11.8, 10),
    whiteTrimMat
  );
  flagPole.position.set(0, 5.9, -0.5);
  flagPole.castShadow = true;
  group.add(flagPole);

  const flagRed = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.65, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
  );
  flagRed.position.set(1.1, 11.1, -0.5);
  group.add(flagRed);

  const flagWhite = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.65, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  );
  flagWhite.position.set(1.1, 10.45, -0.5);
  group.add(flagWhite);

  // 3. Main 2-Story School Building (Gedung Utama di Selatan z = +10.5)
  const mainHall = new THREE.Mesh(
    new THREE.BoxGeometry(32.0, 8.4, 8.8),
    wallMat
  );
  mainHall.position.set(0, 4.25, 10.5);
  mainHall.castShadow = true;
  mainHall.receiveShadow = true;
  group.add(mainHall);

  // Stone foundation plinth
  const mainPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(32.4, 0.45, 9.2),
    stonePlinthMat
  );
  mainPlinth.position.set(0, 0.22, 10.5);
  group.add(mainPlinth);

  // Properly Aligned Rectangular Hip Roof over Main Hall (33.8m x 10.6m overhang, 3.6m tall)
  const mainRoof = createAlignedHipRoof(33.8, 10.6, 3.6);
  mainRoof.position.set(0, 8.45, 10.5);
  group.add(mainRoof);

  // Central Front Lobby / Aula Projection (Pendopo / Teras Utama SMAN 1 at x = 0, z = 5.4)
  const lobbyProjection = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 8.6, 2.4),
    accentWallMat
  );
  lobbyProjection.position.set(0, 4.35, 5.6);
  lobbyProjection.castShadow = true;
  group.add(lobbyProjection);

  const lobbyRoof = createAlignedHipRoof(8.4, 4.2, 2.3);
  lobbyRoof.position.set(0, 8.65, 5.5);
  group.add(lobbyRoof);

  // Golden School Crest & Wall Clock on Central Lobby Pediment
  const clockDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.14, 16),
    whiteTrimMat
  );
  clockDisc.rotation.x = Math.PI / 2;
  clockDisc.position.set(0, 7.2, 4.38);
  group.add(clockDisc);

  const clockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.08, 8, 20),
    goldAccentMat
  );
  clockRim.position.set(0, 7.2, 4.44);
  group.add(clockRim);

  // Double Wooden Main Entrance Doors at Central Lobby
  const mainDoor = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.8, 0.18),
    woodDoorMat
  );
  mainDoor.position.set(0, 1.5, 4.38);
  group.add(mainDoor);

  // Classroom Windows & Doors along Floor 1 & Floor 2 of Main Hall
  for (let wx = -12; wx <= 12; wx += 4) {
    if (Math.abs(wx) < 2) continue; // Skip center where lobby projection stands
    for (const wy of [2.5, 6.3]) {
      const winFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 1.65, 0.14),
        whiteTrimMat
      );
      winFrame.position.set(wx, wy, 6.06);
      group.add(winFrame);

      const win = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 1.4, 0.18),
        glassMat
      );
      win.position.set(wx, wy, 6.06);
      group.add(win);
    }
  }

  // Second-Floor Balcony Corridor, Parapet Railing & White Pillars
  const balconySlab = new THREE.Mesh(
    new THREE.BoxGeometry(32.4, 0.36, 2.3),
    whiteTrimMat
  );
  balconySlab.position.set(0, 4.45, 5.15);
  group.add(balconySlab);

  const balconyRail = new THREE.Mesh(
    new THREE.BoxGeometry(32.2, 0.95, 0.18),
    accentWallMat
  );
  balconyRail.position.set(0, 5.05, 4.15);
  group.add(balconyRail);

  const balconyTopBar = new THREE.Mesh(
    new THREE.BoxGeometry(32.4, 0.14, 0.26),
    whiteTrimMat
  );
  balconyTopBar.position.set(0, 5.55, 4.15);
  group.add(balconyTopBar);

  // Overhang Canopy Roof above 2nd-floor corridor
  const corridorCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(32.6, 0.22, 2.5),
    gentengRoofMat
  );
  corridorCanopy.position.set(0, 8.32, 5.15);
  corridorCanopy.rotation.x = 0.08;
  group.add(corridorCanopy);

  for (let px = -14; px <= 14; px += 4) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 8.3, 0.42),
      whiteTrimMat
    );
    col.position.set(px, 4.2, 4.2);
    col.castShadow = true;
    group.add(col);
  }

  // 4. Left & Right Classroom Wings (Leter-U Campus Layout at x = ±14.2, z = -1.5)
  for (const sx of [-14.2, 14.2]) {
    const isLeft = sx < 0;
    const innerDir = isLeft ? 1 : -1;

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 7.2, 16.5),
      wallMat
    );
    wing.position.set(sx, 3.65, -1.5);
    wing.castShadow = true;
    wing.receiveShadow = true;
    group.add(wing);

    const wingPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(7.1, 0.42, 16.8),
      stonePlinthMat
    );
    wingPlinth.position.set(sx, 0.21, -1.5);
    group.add(wingPlinth);

    // Properly Aligned Rectangular Hip Roof over Classroom Wing (8.4m x 18.2m overhang, 2.9m tall)
    const wingRoof = createAlignedHipRoof(8.4, 18.2, 2.9);
    wingRoof.position.set(sx, 7.25, -1.5);
    group.add(wingRoof);

    // Covered Veranda Walkway along inner courtyard side of each wing
    const wingVerandaRoof = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 16.4),
      gentengRoofMat
    );
    wingVerandaRoof.position.set(sx + innerDir * 4.0, 3.85, -1.5);
    wingVerandaRoof.rotation.z = innerDir * -0.14;
    group.add(wingVerandaRoof);

    // Classroom Windows & Doors facing the inner courtyard
    for (const wz of [-7.0, -3.0, 1.0, 4.5]) {
      for (const wy of [2.2, 5.4]) {
        const wFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 1.45, 2.2),
          whiteTrimMat
        );
        wFrame.position.set(sx + innerDir * 3.42, wy, wz);
        group.add(wFrame);

        const wGlass = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 1.25, 1.95),
          glassMat
        );
        wGlass.position.set(sx + innerDir * 3.42, wy, wz);
        group.add(wGlass);
      }

      // Veranda support pillars
      const vCol = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 3.8, 0.28),
        whiteTrimMat
      );
      vCol.position.set(sx + innerDir * 4.65, 1.9, wz);
      group.add(vCol);
    }
  }

  // 5. Shady School Trees (Pohon Rindang Ketapang & Mangga Sekolah) with Stone Tree Planters
  const treeLeafDarkMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.75,
  });
  const treeLeafLightMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.72,
  });
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c2b0e,
    roughness: 0.85,
  });

  const addSchoolTree = (tx: number, tz: number, scale: number, withPlanter: boolean) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);

    if (withPlanter) {
      const ringWall = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.45, 0.42, 12),
        whiteTrimMat
      );
      ringWall.position.y = 0.21;
      tGroup.add(ringWall);

      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 0.46, 12),
        new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 })
      );
      soil.position.y = 0.22;
      tGroup.add(soil);
    }

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24 * scale, 0.36 * scale, 3.6 * scale, 8),
      trunkMat
    );
    trunk.position.y = 1.8 * scale;
    trunk.castShadow = true;
    tGroup.add(trunk);

    // Layered lush tropical school tree canopy
    const canopyClusters: [number, number, number, number, boolean][] = [
      [0, 4.1 * scale, 0, 2.1 * scale, false],
      [-1.1 * scale, 3.6 * scale, 0.8 * scale, 1.55 * scale, true],
      [1.1 * scale, 3.7 * scale, -0.7 * scale, 1.6 * scale, false],
      [0.7 * scale, 3.8 * scale, 1.0 * scale, 1.45 * scale, true],
      [-0.8 * scale, 3.9 * scale, -1.0 * scale, 1.5 * scale, false],
      [0, 5.1 * scale, 0, 1.55 * scale, true],
    ];
    canopyClusters.forEach(([cx, cy, cz, r, isLight]) => {
      const leaf = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r, 1),
        isLight ? treeLeafLightMat : treeLeafDarkMat
      );
      leaf.position.set(cx, cy, cz);
      leaf.scale.set(1.15, 0.82, 1.15);
      leaf.castShadow = true;
      tGroup.add(leaf);
    });

    group.add(tGroup);
  };

  // Shady trees flanking the front courtyard, gate corners, and rear garden
  addSchoolTree(-8.2, -15.2, 1.05, true);
  addSchoolTree(8.2, -15.2, 1.05, true);
  addSchoolTree(-18.2, -14.5, 0.95, false);
  addSchoolTree(18.2, -14.5, 0.95, false);
  addSchoolTree(-18.2, 12.5, 1.1, false);
  addSchoolTree(18.2, 12.5, 1.1, false);

  // 6. Colorful School Flower Gardens (Taman Bunga Bougainvillea, Mawar, & Marigold)
  const bushLeafMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.75,
  });
  const flowerPalette = [
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 }), // Rose red
    new THREE.MeshStandardMaterial({ color: 0xd946ef, roughness: 0.5 }), // Bougainvillea magenta
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }), // Marigold yellow
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 }), // Hibiscus orange
    new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5 }), // Orchid purple
  ];

  const addFlowerPlanterBox = (
    bx: number,
    bz: number,
    lenX: number,
    lenZ: number,
    seed: number
  ) => {
    const pBox = new THREE.Group();
    pBox.position.set(bx, 0, bz);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(lenX, 0.42, lenZ),
      whiteTrimMat
    );
    frame.position.y = 0.21;
    frame.castShadow = true;
    pBox.add(frame);

    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(lenX - 0.22, 0.45, lenZ - 0.22),
      new THREE.MeshStandardMaterial({ color: 0x422006, roughness: 0.95 })
    );
    soil.position.y = 0.22;
    pBox.add(soil);

    const isHorizontal = lenX >= lenZ;
    const span = (isHorizontal ? lenX : lenZ) - 0.8;
    const steps = Math.max(2, Math.floor(span / 0.85));

    for (let i = 0; i <= steps; i++) {
      const offset = -span / 2 + (i / steps) * span;
      const sx = isHorizontal ? offset : 0;
      const sz = isHorizontal ? 0 : offset;

      // Green shrub base
      const shrub = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 1),
        bushLeafMat
      );
      shrub.position.set(sx, 0.56, sz);
      shrub.scale.set(1.1, 0.8, 1.1);
      pBox.add(shrub);

      // Colorful flower blossoms on top & sides of shrub
      const fMat1 = flowerPalette[(seed + i) % flowerPalette.length];
      const fMat2 = flowerPalette[(seed + i + 2) % flowerPalette.length];

      const bloom1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), fMat1);
      bloom1.position.set(sx - 0.12, 0.84, sz + 0.08);
      pBox.add(bloom1);

      const bloom2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), fMat2);
      bloom2.position.set(sx + 0.14, 0.8, sz - 0.09);
      pBox.add(bloom2);
    }

    group.add(pBox);
  };

  // Flower beds along both Classroom Wings facing the courtyard
  addFlowerPlanterBox(-9.5, -5.8, 1.25, 5.2, 0);
  addFlowerPlanterBox(-9.5, 1.5, 1.25, 5.2, 1);
  addFlowerPlanterBox(9.5, -5.8, 1.25, 5.2, 2);
  addFlowerPlanterBox(9.5, 1.5, 1.25, 5.2, 3);

  // Flower beds flanking the Main Hall entrance & Flagpole
  addFlowerPlanterBox(-6.8, 3.2, 5.0, 1.3, 4);
  addFlowerPlanterBox(6.8, 3.2, 5.0, 1.3, 1);

  // Flower beds lining the front school fence (North entrance)
  addFlowerPlanterBox(-12.5, -18.0, 9.5, 1.3, 2);
  addFlowerPlanterBox(12.5, -18.0, 9.5, 1.3, 3);

  // Decorative Potted Bougainvillea & Gerabah Plants around Kantin & Lobby steps
  for (const [px, pz, variant] of [
    [-3.2, 4.0, 'ember_cat'],
    [3.2, 4.0, 'ember_cat'],
    [-2.2, -0.5, 'gerabah'],
    [2.2, -0.5, 'gerabah'],
    [-4.2, -16.8, 'caladium'],
    [4.2, -16.8, 'caladium'],
  ] as [number, number, 'ember_cat' | 'gerabah' | 'caladium'][]) {
    const pot = createPotBungaKampung(variant);
    pot.position.set(px, 0, pz);
    group.add(pot);
  }

  // Courtyard Student Study Bench (where pelajar_sma sitting NPCs sit at global 28.5..31.5, 72.8 -> local -1.5..1.5, -17.2)
  const studentBench = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.44, 0.9),
    woodDoorMat
  );
  studentBench.position.set(0, 0.24, -17.2);
  studentBench.castShadow = true;
  group.add(studentBench);

  // 7. Front School Perimeter Fence & Main Gate with Banner (at North edge z = -19.2)
  for (const fx of [-12.5, 12.5]) {
    const fenceWall = new THREE.Mesh(
      new THREE.BoxGeometry(13.5, 1.7, 0.45),
      whiteTrimMat
    );
    fenceWall.position.set(fx, 0.9, -19.2);
    fenceWall.castShadow = true;
    group.add(fenceWall);

    // Terracotta cap on fence wall
    const fenceCap = new THREE.Mesh(
      new THREE.BoxGeometry(13.7, 0.18, 0.58),
      gentengRoofMat
    );
    fenceCap.position.set(fx, 1.82, -19.2);
    group.add(fenceCap);
  }

  for (const gx of [-4.6, 4.6]) {
    const gatePillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 4.5, 0.95),
      gentengRoofMat
    );
    gatePillar.position.set(gx, 2.25, -19.2);
    gatePillar.castShadow = true;
    group.add(gatePillar);

    const pillarCap = createAlignedHipRoof(1.45, 1.45, 0.65);
    pillarCap.position.set(gx, 4.5, -19.2);
    group.add(pillarCap);
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

  // Mini hip roof crowning the main school gate banner
  const gateBannerRoof = createAlignedHipRoof(10.8, 1.4, 0.9);
  gateBannerRoof.position.set(0, 5.15, -19.2);
  group.add(gateBannerRoof);

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

  // 1. East Valley River Channel (x = 188, z = -200..200, width = 18m)
  const eastBank = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.12, 420),
    bankMat
  );
  eastBank.position.set(188, 0.02, 0);
  group.add(eastBank);

  const eastWater = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.14, 420),
    waterMat
  );
  eastWater.position.set(188, 0.06, 0);
  group.add(eastWater);

  // 2. South Valley River Channel (z = 188, x = -200..200, width = 18m)
  const southBank = new THREE.Mesh(
    new THREE.BoxGeometry(420, 0.12, 22),
    bankMat
  );
  southBank.position.set(0, 0.02, 188);
  group.add(southBank);

  const southWater = new THREE.Mesh(
    new THREE.BoxGeometry(420, 0.14, 18),
    waterMat
  );
  southWater.position.set(0, 0.06, 188);
  group.add(southWater);

  // 3. Helper to build a Merah-Putih Highway Bridge spanning across the River
  const createHighwayBridge = (bx: number, bz: number, rotY: number) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0, bz);
    bGroup.rotation.y = rotY;

    // Raised Asphalt Bridge Deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.32, 26),
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
        new THREE.BoxGeometry(0.55, 1.2, 26),
        whiteSteelMat
      );
      railWall.position.set(sx, 0.85, 0);
      bGroup.add(railWall);

      const topChord = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 22),
        redSteelMat
      );
      topChord.position.set(sx, 4.2, 0);
      bGroup.add(topChord);

      for (const sz of [-10, -4, 4, 10]) {
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

  // Place Highway Bridges where the South (0, 188) & East (188, 0) Gateway Roads cross the River!
  group.add(createHighwayBridge(0, 188, 0));
  group.add(createHighwayBridge(188, 0, Math.PI / 2));

  // 4. Traditional Wooden Boats (Perahu Sampan Kayu) floating on the River
  const boatCoords: [number, number, number][] = [
    [188, -45, 0],
    [188, 65, Math.PI],
    [-45, 188, Math.PI / 2],
    [75, 188, -Math.PI / 2],
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

export interface TrafficLightRef {
  group: THREE.Group;
  setState: (state: 'red' | 'yellow' | 'green') => void;
  getState: () => 'red' | 'yellow' | 'green';
}

export function createTrafficLightMesh(): TrafficLightRef {
  const group = new THREE.Group();
  group.name = 'TrafficLight';

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.75,
    roughness: 0.35,
  });

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
    metalness: 0.25,
  });

  const yellowBorderMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.45,
    metalness: 0.2,
  });

  // Vertical Mast Pole
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 5.8, 12),
    steelMat
  );
  mast.position.y = 2.9;
  mast.castShadow = true;
  group.add(mast);

  // Concrete / Steel Base Plinth
  const basePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.35, 12),
    steelMat
  );
  basePlinth.position.y = 0.175;
  group.add(basePlinth);

  // Cantilever Horizontal Arm reaching out over road lane (Length 3.8m)
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 3.8, 10),
    steelMat
  );
  arm.rotation.z = -Math.PI / 2;
  arm.position.set(1.9, 5.2, 0);
  group.add(arm);

  // Diagonal support strut
  const strut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8),
    steelMat
  );
  strut.rotation.z = -Math.PI / 4;
  strut.position.set(0.65, 4.65, 0);
  group.add(strut);

  // Main Overhead Signal Head placed at arm tip (x = 3.6, y = 5.2)
  const headGroup = new THREE.Group();
  headGroup.position.set(3.6, 5.2, 0);

  // Backplate with yellow safety border
  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 1.88, 0.04),
    yellowBorderMat
  );
  backplate.position.set(0, 0, -0.06);
  headGroup.add(backplate);

  // Main Signal Housing Body
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 1.7, 0.38),
    housingMat
  );
  housing.position.set(0, 0, 0.12);
  housing.castShadow = true;
  headGroup.add(housing);

  // 3 Colored Lenses (Red, Yellow, Green)
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xff0000,
    emissiveIntensity: 2.5,
    roughness: 0.25,
    metalness: 0.1,
  });

  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    emissive: 0x000000,
    emissiveIntensity: 0.05,
    roughness: 0.25,
    metalness: 0.1,
  });

  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    emissive: 0x000000,
    emissiveIntensity: 0.05,
    roughness: 0.25,
    metalness: 0.1,
  });

  const lensGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16);
  lensGeo.rotateX(Math.PI / 2);

  const visorGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.24, 16, 1, true, -Math.PI / 2, Math.PI);
  visorGeo.rotateX(Math.PI / 2);

  // Red Lens (Top, y = 0.52)
  const redLens = new THREE.Mesh(lensGeo, redMat);
  redLens.position.set(0, 0.52, 0.32);
  headGroup.add(redLens);

  const redVisor = new THREE.Mesh(visorGeo, housingMat);
  redVisor.position.set(0, 0.52, 0.38);
  headGroup.add(redVisor);

  // Yellow Lens (Middle, y = 0.0)
  const yellowLens = new THREE.Mesh(lensGeo, yellowMat);
  yellowLens.position.set(0, 0, 0.32);
  headGroup.add(yellowLens);

  const yellowVisor = new THREE.Mesh(visorGeo, housingMat);
  yellowVisor.position.set(0, 0, 0.38);
  headGroup.add(yellowVisor);

  // Green Lens (Bottom, y = -0.52)
  const greenLens = new THREE.Mesh(lensGeo, greenMat);
  greenLens.position.set(0, -0.52, 0.32);
  headGroup.add(greenLens);

  const greenVisor = new THREE.Mesh(visorGeo, housingMat);
  greenVisor.position.set(0, -0.52, 0.38);
  headGroup.add(greenVisor);

  group.add(headGroup);

  // Secondary lower eye-level signal box on vertical mast (y = 2.4)
  const lowerBox = new THREE.Group();
  lowerBox.position.set(0, 2.4, 0);

  const lowerHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.92, 0.28),
    housingMat
  );
  lowerHousing.position.set(0, 0, 0.16);
  lowerBox.add(lowerHousing);

  const lowerRed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12),
    redMat
  );
  lowerRed.rotation.x = Math.PI / 2;
  lowerRed.position.set(0, 0.22, 0.31);
  lowerBox.add(lowerRed);

  const lowerGreen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12),
    greenMat
  );
  lowerGreen.rotation.x = Math.PI / 2;
  lowerGreen.position.set(0, -0.22, 0.31);
  lowerBox.add(lowerGreen);

  group.add(lowerBox);

  let currentState: 'red' | 'yellow' | 'green' = 'red';

  const setState = (state: 'red' | 'yellow' | 'green') => {
    currentState = state;
    if (state === 'red') {
      redMat.color.setHex(0xef4444);
      redMat.emissive.setHex(0xff0000);
      redMat.emissiveIntensity = 2.6;

      yellowMat.color.setHex(0x451a03);
      yellowMat.emissive.setHex(0x000000);
      yellowMat.emissiveIntensity = 0.05;

      greenMat.color.setHex(0x064e3b);
      greenMat.emissive.setHex(0x000000);
      greenMat.emissiveIntensity = 0.05;
    } else if (state === 'yellow') {
      redMat.color.setHex(0x450a0a);
      redMat.emissive.setHex(0x000000);
      redMat.emissiveIntensity = 0.05;

      yellowMat.color.setHex(0xfbbf24);
      yellowMat.emissive.setHex(0xffaa00);
      yellowMat.emissiveIntensity = 2.6;

      greenMat.color.setHex(0x064e3b);
      greenMat.emissive.setHex(0x000000);
      greenMat.emissiveIntensity = 0.05;
    } else {
      redMat.color.setHex(0x450a0a);
      redMat.emissive.setHex(0x000000);
      redMat.emissiveIntensity = 0.05;

      yellowMat.color.setHex(0x451a03);
      yellowMat.emissive.setHex(0x000000);
      yellowMat.emissiveIntensity = 0.05;

      greenMat.color.setHex(0x10b981);
      greenMat.emissive.setHex(0x00ff88);
      greenMat.emissiveIntensity = 2.6;
    }
  };

  setState('red');

  return {
    group,
    setState,
    getState: () => currentState,
  };
}

export function createRumahJoglo(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RumahJoglo';

  // 1. Raised Stone Umpak Plinth Base (offset to ground flush)
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.05,
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.4, 11.6), stoneMat);
  plinth.position.y = 0.2;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Front access steps
  const step = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.2), stoneMat);
  step.position.set(0, 0.1, 6.2);
  step.receiveShadow = true;
  group.add(step);

  // 2. Teakwood Structure Materials
  const teakWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c2b0e,
    roughness: 0.65,
    metalness: 0.1,
  });
  const darkTeakMat = new THREE.MeshStandardMaterial({
    color: 0x3d1a06,
    roughness: 0.6,
    metalness: 0.12,
  });

  // 3. Central Soko Guru (4 Primary Teak Pillars)
  const sokoRadius = 0.22;
  const sokoHeight = 5.2;
  const sokoCoords: [number, number][] = [
    [-2.2, -1.2],
    [2.2, -1.2],
    [-2.2, 1.8],
    [2.2, 1.8],
  ];
  sokoCoords.forEach(([px, pz]) => {
    const soko = new THREE.Mesh(
      new THREE.CylinderGeometry(sokoRadius, sokoRadius, sokoHeight, 10),
      teakWoodMat
    );
    soko.position.set(px, sokoHeight / 2 + 0.4, pz);
    soko.castShadow = true;
    group.add(soko);

    // Stone umpak pedestal under each soko
    const umpak = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.65), stoneMat);
    umpak.position.set(px, 0.55, pz);
    group.add(umpak);
  });

  // Tumpang Sari (Tiered Stepped Wooden Crossbeams connecting Soko Guru)
  for (let t = 0; t < 3; t++) {
    const beamW = 4.8 - t * 0.4;
    const beamD = 3.6 - t * 0.3;
    const beamH = 0.22;
    const beamY = 4.8 + t * 0.35;
    const beamX = new THREE.Mesh(new THREE.BoxGeometry(beamW, beamH, 0.3), darkTeakMat);
    beamX.position.set(0, beamY, -1.2);
    group.add(beamX);
    const beamX2 = beamX.clone();
    beamX2.position.z = 1.8;
    group.add(beamX2);

    const beamZ = new THREE.Mesh(new THREE.BoxGeometry(0.3, beamH, beamD), darkTeakMat);
    beamZ.position.set(-2.2, beamY, 0.3);
    group.add(beamZ);
    const beamZ2 = beamZ.clone();
    beamZ2.position.x = 2.2;
    group.add(beamZ2);
  }

  // 4. Perimeter Pillars (Soko Pengarak) around Pendopo & Omah
  const perimeterRadius = 0.14;
  const perimHeight = 3.6;
  const perimCoords: [number, number][] = [
    [-5.8, -4.8],
    [-2.0, -4.8],
    [2.0, -4.8],
    [5.8, -4.8],
    [-5.8, 4.8],
    [-2.0, 4.8],
    [2.0, 4.8],
    [5.8, 4.8],
    [-5.8, 0],
    [5.8, 0],
  ];
  perimCoords.forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(perimeterRadius, perimeterRadius, perimHeight, 8),
      teakWoodMat
    );
    pillar.position.set(px, perimHeight / 2 + 0.4, pz);
    pillar.castShadow = true;
    group.add(pillar);
  });

  // 5. Back Living Sanctuary (Omah Njero Walls with Gebyok Jepara Wood Paneling)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.72,
    metalness: 0.08,
  });
  const backHall = new THREE.Mesh(new THREE.BoxGeometry(11.8, 3.4, 5.2), wallMat);
  backHall.position.set(0, 2.1, -2.4);
  backHall.castShadow = true;
  backHall.receiveShadow = true;
  group.add(backHall);

  // Front Carved Sliding Door (Gebyok)
  const gebyokMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.5,
    metalness: 0.2,
  });
  const gebyokDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.15), gebyokMat);
  gebyokDoor.position.set(0, 1.8, 0.25);
  group.add(gebyokDoor);

  // 6. Multi-Tiered Joglo Tajug Roof (Atap Tajug Piramida Khas Jawa)
  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const gentengMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    roughness: 0.75,
    metalness: 0.08,
  });

  // Lower Eaves (Atap Pananggap - broad low-slope skirt)
  const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(9.8, 2.2, 4), gentengMat);
  lowerRoof.rotation.y = Math.PI / 4;
  lowerRoof.scale.set(1.4, 1.0, 1.15);
  lowerRoof.position.set(0, 4.9, 0);
  lowerRoof.castShadow = true;
  group.add(lowerRoof);

  // Upper Steep Tajug Pyramid (Brunjung Joglo)
  const topTajug = new THREE.Mesh(new THREE.ConeGeometry(4.8, 3.2, 4), gentengMat);
  topTajug.rotation.y = Math.PI / 4;
  topTajug.scale.set(1.2, 1.0, 0.95);
  topTajug.position.set(0, 6.9, 0.3);
  topTajug.castShadow = true;
  group.add(topTajug);

  // Carved Ridge Beam (Wuwungan Kayu Jati & Molo)
  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.45), darkTeakMat);
  ridgeBeam.position.set(0, 8.45, 0.3);
  group.add(ridgeBeam);

  // 7. Traditional Accents & Props
  // Clay Water Crock (Gentong Air Tanah Liat) on porch
  const crockGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.7, 10);
  const crockMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.78 });
  const waterCrock = new THREE.Mesh(crockGeo, crockMat);
  waterCrock.position.set(-4.5, 0.75, 4.2);
  group.add(waterCrock);

  // Hanging Bird Cage (Kurungan Burung Perkutut)
  const cageMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
  const cage = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), cageMat);
  cage.position.set(3.2, 3.2, 3.8);
  group.add(cage);
  const cageRope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4),
    teakWoodMat
  );
  cageRope.position.set(3.2, 3.65, 3.8);
  group.add(cageRope);

  // Lincak / Balai-balai Bambu on pendopo
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.1), teakWoodMat);
  bench.position.set(-3.2, 0.65, 2.2);
  group.add(bench);

  return group;
}

export function createRumahGadang(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RumahGadang';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.68,
    metalness: 0.12,
  });
  const darkRoofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.55,
  });
  const goldOrnamentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.8,
  });

  // 1. Stilt Foundation (Tiang Kayu Penyangga Rumah Panggung)
  for (let x = -6.5; x <= 6.5; x += 3.25) {
    for (let z = -2.8; z <= 2.8; z += 2.8) {
      const stilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8),
        woodMat
      );
      stilt.position.set(x, 0.8, z);
      stilt.castShadow = true;
      group.add(stilt);
    }
  }

  // 2. Main Boat-Shaped Body (Badan Rumah Membesar ke Atas)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-7.2, 0);
  bodyShape.lineTo(7.2, 0);
  bodyShape.lineTo(8.2, 3.4);
  bodyShape.lineTo(-8.2, 3.4);
  bodyShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 5.8,
    bevelEnabled: false,
  });
  bodyGeo.center();
  const bodyMesh = new THREE.Mesh(bodyGeo, woodMat);
  bodyMesh.position.set(0, 3.3, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Ornate Front Windows
  for (let wx = -5.8; wx <= 5.8; wx += 2.3) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.4, 0.1),
      goldOrnamentMat
    );
    win.position.set(wx, 3.5, 2.95);
    group.add(win);
  }

  // 3. Sweeping Curved Roof Base
  const roofBase = new THREE.Mesh(
    new THREE.BoxGeometry(17.8, 1.2, 6.4),
    darkRoofMat
  );
  roofBase.position.set(0, 5.2, 0);
  roofBase.castShadow = true;
  group.add(roofBase);

  // 4. Iconic Horn-like Gonjong Spires (4 Curved Spires Rising into the Sky)
  const gonjongPoints = [
    new THREE.Vector2(0.85, 0),
    new THREE.Vector2(0.65, 1.2),
    new THREE.Vector2(0.38, 2.4),
    new THREE.Vector2(0.12, 3.8),
    new THREE.Vector2(0.02, 4.6),
  ];
  const gonjongGeo = new THREE.LatheGeometry(gonjongPoints, 12);

  const gonjongPositions: [number, number, number, number][] = [
    [-7.8, 5.6, -1.8, -0.35],
    [-7.8, 5.6, 1.8, -0.35],
    [7.8, 5.6, -1.8, 0.35],
    [7.8, 5.6, 1.8, 0.35],
  ];

  gonjongPositions.forEach(([gx, gy, gz, tiltZ]) => {
    const spire = new THREE.Mesh(gonjongGeo, darkRoofMat);
    spire.position.set(gx, gy, gz);
    spire.rotation.z = tiltZ;
    spire.castShadow = true;
    group.add(spire);

    // Golden Finial Cap
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), goldOrnamentMat);
    tip.position.set(gx + (tiltZ > 0 ? 0.7 : -0.7), gy + 4.5, gz);
    group.add(tip);
  });

  // Central Twin Crown Spire
  for (const cx of [-2.4, 2.4]) {
    const centerSpire = new THREE.Mesh(gonjongGeo, darkRoofMat);
    centerSpire.scale.set(0.75, 0.75, 0.75);
    centerSpire.position.set(cx, 5.8, 0);
    centerSpire.castShadow = true;
    group.add(centerSpire);
  }

  // 5. Traditional Stairway Entrance (Janjang)
  const stair = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.6, 2.4),
    woodMat
  );
  stair.position.set(0, 0.8, 4.1);
  group.add(stair);

  return group;
}

export function createPosKamling(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PosKamling';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.75,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.6,
  });
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.8,
  });

  // 1. Concrete Corner Footings
  for (const [px, pz] of [
    [-1.8, -1.4],
    [1.8, -1.4],
    [-1.8, 1.4],
    [1.8, 1.4],
  ]) {
    const footing = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
    );
    footing.position.set(px, 0.175, pz);
    group.add(footing);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8),
      woodMat
    );
    post.position.set(px, 1.75, pz);
    post.castShadow = true;
    group.add(post);
  }

  // 2. Bamboo Deck / Bale-Bale Seating Platform
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 3.1), bambooMat);
  deck.position.set(0, 0.55, 0);
  deck.receiveShadow = true;
  group.add(deck);

  // Low backrest rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.65, 0.1), woodMat);
  rail.position.set(0, 0.95, -1.35);
  group.add(rail);

  // 3. Iconic Bamboo Slit Drum (Kentongan Bambu) & Mallet
  const kentongan = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 1.1, 10),
    bambooMat
  );
  kentongan.position.set(1.4, 2.2, 1.3);
  group.add(kentongan);

  // Slit cavity in kentongan
  const slit = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.8, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  slit.position.set(1.4, 2.2, 1.38);
  group.add(slit);

  // Wooden mallet beater
  const mallet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.04, 0.45, 6),
    woodMat
  );
  mallet.rotation.z = Math.PI / 4;
  mallet.position.set(1.55, 2.05, 1.3);
  group.add(mallet);

  // 4. Hip Pyramid Roof (Atap Genteng Gardu)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 4), tileMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.3, 1.0, 1.05);
  roof.position.set(0, 3.8, 0);
  roof.castShadow = true;
  group.add(roof);

  // 5. Official Pos Kamling Signboard Banner
  const signTex = createPosKamlingSignTexture(maxAnisotropy);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.85),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35, side: THREE.DoubleSide })
  );
  sign.position.set(0, 2.7, 1.42);
  group.add(sign);

  return group;
}

export function createWarungMadura(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WarungMadura24Jam';

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
  });

  // 1. Shophouse Main Building (7.4m x 4.2m x 5.0m)
  const store = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.4, 5.0), wallMat);
  store.position.y = 2.2;
  store.castShadow = true;
  store.receiveShadow = true;
  group.add(store);

  // Zinc Roof Eaves
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.35, 5.8),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
  );
  roof.position.set(0, 4.5, 0.3);
  roof.castShadow = true;
  group.add(roof);

  // 2. Iconic Red-and-Yellow "TOKO KELONTONG MADURA 24 JAM" Signboard
  const signTex = createMaduraSignTexture(maxAnisotropy);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.3,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0.3,
  });
  const signboard = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.25, 0.25), signMat);
  signboard.position.set(0, 3.85, 2.65);
  group.add(signboard);

  // 3. Glass Display Front (Showcase & Hanging Snack Sachets)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.75,
    transparent: true,
    opacity: isSoftwareGl ? 0.6 : 0.85,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.2, 0.15), glassMat);
  glass.position.set(0.6, 1.6, 2.52);
  group.add(glass);

  // 4. "PERTAMINI" Digital Fuel Pump Machine on the Left Front Terrace
  const pertaminiGroup = new THREE.Group();
  pertaminiGroup.position.set(-2.6, 0, 3.2);

  const pumpBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.9, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.3 })
  );
  pumpBody.position.y = 0.95;
  pumpBody.castShadow = true;
  pertaminiGroup.add(pumpBody);

  // Digital lit display screen
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.4, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.8,
    })
  );
  screen.position.set(0, 1.3, 0.42);
  pertaminiGroup.add(screen);

  // Fuel nozzle & hose
  const hose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  hose.position.set(0.48, 0.9, 0.2);
  pertaminiGroup.add(hose);

  group.add(pertaminiGroup);

  // 5. Stack of 3kg Green LPG Cylinders ("Tabung Gas Melon")
  const lpgMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.4,
    metalness: 0.4,
  });
  for (let ix = 0; ix < 3; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8),
        lpgMat
      );
      tank.position.set(1.8 + ix * 0.42, 0.23, 2.8 + iz * 0.42);
      tank.castShadow = true;
      group.add(tank);
    }
  }

  // 6. Stack of 19L Blue Mineral Water Gallons ("Galon Aqua")
  const aquaMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    transmission: isSoftwareGl ? 0 : 0.6,
    transparent: true,
    opacity: 0.8,
  });
  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 2; gx++) {
      const galon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10),
        aquaMat
      );
      galon.position.set(-1.2 + gx * 0.46, 0.28 + gy * 0.56, 2.9);
      group.add(galon);
    }
  }

  return group;
}

export function createPasarTradisional(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PasarTradisionalRakyat';

  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const gentengRoofMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    color: 0xb91c1c,
    roughness: 0.68,
    metalness: 0.06,
  });
  const greenRoofMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.55,
    metalness: 0.15,
  });
  const whiteTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.45,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.35,
    metalness: 0.5,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    roughness: 0.45,
    metalness: 0.35,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.8,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.78,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.82,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.85,
    roughness: 0.25,
  });

  // Helper: Rectangular Hip Roof (Atap Limasan Pasar) with 100% axis-aligned base
  const makeHipRoof = (
    wX: number,
    dZ: number,
    hY: number,
    mat: THREE.Material
  ): THREE.Group => {
    const rGroup = new THREE.Group();
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(wX + 0.3, 0.32, dZ + 0.3),
      whiteTrimMat
    );
    fascia.position.y = 0.16;
    rGroup.add(fascia);

    const pyrGeo = new THREE.ConeGeometry(Math.SQRT1_2, hY, 4);
    pyrGeo.rotateY(Math.PI / 4);
    pyrGeo.translate(0, hY / 2 + 0.2, 0);
    pyrGeo.scale(wX, 1, dZ);
    pyrGeo.computeVertexNormals();

    const pyr = new THREE.Mesh(pyrGeo, mat);
    pyr.castShadow = true;
    pyr.receiveShadow = true;
    rGroup.add(pyr);

    return rGroup;
  };

  // 1. Expanded Market Plaza Foundation (36m wide X [-18..+18] x 24m deep Z [-12..+12])
  const mainPad = new THREE.Mesh(
    new THREE.BoxGeometry(36.0, 0.14, 24.0),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 })
  );
  mainPad.position.y = 0.07;
  mainPad.receiveShadow = true;
  group.add(mainPad);

  // Decorative Terracotta & Cream Walk-In Shopping Aisles (Lorong Utama & Lorong Lintas Pasar)
  const aisleTileMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.65,
  });
  const borderTileMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.75,
  });

  // Central Front-to-Back Promenade (localX: -2.4..+2.4, localZ: -11.6..+11.8)
  const mainAisle = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.04, 23.4),
    aisleTileMat
  );
  mainAisle.position.set(0, 0.15, 0.1);
  mainAisle.receiveShadow = true;
  group.add(mainAisle);

  // Cross Aisle between Front Los (Sayur/Buah) and Rear Los (Daging/Ikan) at localZ = -1.8
  const crossAisle = new THREE.Mesh(
    new THREE.BoxGeometry(33.6, 0.04, 3.4),
    aisleTileMat
  );
  crossAisle.position.set(0, 0.15, -1.8);
  crossAisle.receiveShadow = true;
  group.add(crossAisle);

  // Front Outdoor Culinary & Fruit Terrace Apron (localZ = +8.2)
  const frontTerrace = new THREE.Mesh(
    new THREE.BoxGeometry(34.4, 0.035, 6.4),
    borderTileMat
  );
  frontTerrace.position.set(0, 0.148, 8.4);
  frontTerrace.receiveShadow = true;
  group.add(frontTerrace);

  // 2. Main Covered Market Hall Structure (Gedung Induk Los Pasar: localX [-16.8..+16.8], localZ [-11.2..+5.4])
  // Sturdy structural columns connecting floor (y=0.14) to roof beam (y=4.6)
  const colPositionsX = [-15.8, -9.8, -3.2, 3.2, 9.8, 15.8];
  const colPositionsZ = [-10.4, -4.6, 0.8, 5.2];

  for (const cx of colPositionsX) {
    for (const cz of colPositionsZ) {
      // Concrete plinth base
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.55, 0.46),
        brickMat
      );
      plinth.position.set(cx, 0.35, cz);
      group.add(plinth);

      // Steel column up to roof
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 4.5, 10),
        pillarMat
      );
      col.position.set(cx, 2.38, cz);
      col.castShadow = true;
      group.add(col);
    }
  }

  // Perimeter Steel Ring Beam & Trusses at y = 4.55 (centered at localZ = -2.6)
  const ringBeam = new THREE.Mesh(
    new THREE.BoxGeometry(33.2, 0.32, 16.4),
    pillarMat
  );
  ringBeam.position.set(0, 4.55, -2.6);
  group.add(ringBeam);

  // Two-Tiered Nusantara Market Hall Roof (Atap Bertingkat dengan Ventilasi Clerestory)
  const lowerHallRoof = makeHipRoof(34.8, 18.0, 2.4, gentengRoofMat);
  lowerHallRoof.position.set(0, 4.65, -2.6);
  group.add(lowerHallRoof);

  // Skylight Clerestory Louver Box
  const clerestory = new THREE.Mesh(
    new THREE.BoxGeometry(20.0, 0.85, 8.8),
    whiteTrimMat
  );
  clerestory.position.set(0, 6.45, -2.6);
  group.add(clerestory);

  const upperHallRoof = makeHipRoof(22.4, 10.6, 2.1, gentengRoofMat);
  upperHallRoof.position.set(0, 6.85, -2.6);
  group.add(upperHallRoof);

  // Warm Interior Market Hall Ceiling Lamps (glowing warmly for shoppers)
  const hallBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
  });
  for (const lx of [-9.5, 0, 9.5]) {
    for (const lz of [-6.0, 1.8]) {
      const lampHood = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.22, 8),
        steelMat
      );
      lampHood.position.set(lx, 4.35, lz);
      group.add(lampHood);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        hallBulbMat
      );
      bulb.position.set(lx, 4.2, lz);
      group.add(bulb);
    }
  }

  // 3. Grand Gapura & Front Entrance Archway (at localZ = +11.4, facing +Z / World West)
  for (const gx of [-4.2, 4.2]) {
    const basePillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.4, 1.05),
      brickMat
    );
    basePillar.position.set(gx, 0.75, 11.2);
    basePillar.castShadow = true;
    group.add(basePillar);

    const upperPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 4.4, 0.78),
      pillarMat
    );
    upperPillar.position.set(gx, 3.4, 11.2);
    upperPillar.castShadow = true;
    group.add(upperPillar);

    const goldRing = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.22, 0.92),
      goldTrimMat
    );
    goldRing.position.set(gx, 1.5, 11.2);
    group.add(goldRing);
  }

  // Gate Crossbeam & Traditional Crown Roof over Main Gate
  const gateCrossBeam = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.48, 0.9),
    pillarMat
  );
  gateCrossBeam.position.set(0, 5.45, 11.2);
  group.add(gateCrossBeam);

  const gateRoof = makeHipRoof(11.4, 2.4, 1.45, greenRoofMat);
  gateRoof.position.set(0, 5.65, 11.2);
  group.add(gateRoof);

  // Main Illuminated Banner ("PASAR RAYA TRADISIONAL RAKYAT")
  const bannerTex = createPasarBannerTexture(maxAnisotropy);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.3,
  });
  const bannerBox = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 2.35, 0.22),
    bannerMat
  );
  bannerBox.position.set(0, 4.35, 11.35);
  group.add(bannerBox);

  // Festive Indonesian Umbul-Umbul Pennants flanking the market front (localZ = +11.6)
  const umbulColors = [0xdc2626, 0xfacc15, 0x16a34a, 0x2563eb];
  for (let u = 0; u < 4; u++) {
    const ux = u < 2 ? -15.5 + u * 4.5 : 11.0 + (u - 2) * 4.5;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 5.2, 6),
      bambooMat
    );
    pole.position.set(ux, 2.6, 11.5);
    pole.rotation.z = ux < 0 ? 0.06 : -0.06;
    group.add(pole);

    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 3.6, 0.03),
      new THREE.MeshStandardMaterial({
        color: umbulColors[u % umbulColors.length],
        roughness: 0.6,
      })
    );
    flag.position.set(ux + (ux < 0 ? -0.22 : 0.22), 3.1, 11.5);
    group.add(flag);
  }

  // Helper to hang section signboards inside the market
  const addSectionSign = (
    x: number,
    y: number,
    z: number,
    title: string,
    sub: string,
    bg: string,
    accent: string
  ) => {
    const tex = createLosPasarSignTexture(title, sub, bg, accent, maxAnisotropy);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.05, 0.12),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    );
    sign.position.set(x, y, z);
    group.add(sign);
  };

  // ============================================================================
  // SECTION 1: LOS SAYUR MAYUR & SEMBAKO SEGAR (Blok A1: localX [-14.2..-4.2], localZ [+1.2..+4.2])
  // ============================================================================
  addSectionSign(
    -9.2,
    3.75,
    4.6,
    'LOS SAYUR & SEMBAKO',
    'BAYAM · CABAI · TOMAT · BERAS PANDAN WANGI',
    '#14532d',
    '#facc15'
  );

  const vegColors = [
    0x16a34a, // Bayam / Kangkung hijau segar
    0xdc2626, // Cabai merah keriting & tomat
    0xf97316, // Wortel Brastagi
    0x84cc16, // Kubis / Sawi putih hijau muda
    0x7e22ce, // Terong ungu & bawang merah
    0xeab308, // Kentang Dieng & jagung manis
  ];

  for (let vx = -13.2; vx <= -5.2; vx += 4.0) {
    const stallGroup = new THREE.Group();
    stallGroup.position.set(vx, 0.14, 2.6);

    // Two-tier wooden vegetable table
    const tableBase = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.78, 1.75),
      woodMat
    );
    tableBase.position.y = 0.39;
    tableBase.castShadow = true;
    stallGroup.add(tableBase);

    const upperRack = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.32, 0.82),
      woodMat
    );
    upperRack.position.set(0, 0.92, -0.42);
    stallGroup.add(upperRack);

    // 6 Woven Bamboo Baskets (Keranjang Sayur) filled with fresh produce
    for (let b = 0; b < 6; b++) {
      const bx = -1.0 + (b % 3) * 1.0;
      const bz = b < 3 ? 0.38 : -0.42;
      const by = b < 3 ? 0.84 : 1.14;

      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.3, 0.16, 10),
        bambooMat
      );
      basket.position.set(bx, by, bz);
      stallGroup.add(basket);

      const vMat = new THREE.MeshStandardMaterial({
        color: vegColors[(b + Math.abs(Math.round(vx))) % vegColors.length],
        roughness: 0.55,
      });
      for (let m = 0; m < 4; m++) {
        const morsel = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.14, 1),
          vMat
        );
        morsel.position.set(
          bx + ((m % 2) - 0.5) * 0.18,
          by + 0.1,
          bz + (Math.floor(m / 2) - 0.5) * 0.18
        );
        stallGroup.add(morsel);
      }
    }

    // Classic Green Indonesian Market Scale (Timbangan Bebek Pasar)
    const scaleBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.24, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.5, roughness: 0.4 })
    );
    scaleBase.position.set(1.25, 0.9, 0.45);
    stallGroup.add(scaleBase);

    const scalePan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.06, 10),
      goldTrimMat
    );
    scalePan.position.set(1.12, 1.06, 0.45);
    stallGroup.add(scalePan);

    // Burlap Sacks of Rice (Karung Beras 25kg) stacked in front of the table
    const sackMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.9,
    });
    for (let s = 0; s < 2; s++) {
      const sack = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.32, 0.42),
        sackMat
      );
      sack.position.set(-1.1 + s * 0.65, 0.16, 1.15);
      stallGroup.add(sack);
    }

    group.add(stallGroup);
  }

  // ============================================================================
  // SECTION 2: LOS BUAH-BUAHAN SEGAR NUSANTARA (Blok A2: localX [+4.2..+14.2], localZ [+1.2..+4.2])
  // ============================================================================
  addSectionSign(
    9.2,
    3.75,
    4.6,
    'LOS BUAH TROPIS SEGAR',
    'SEMANGKA · PISANG · MANGGA · DURIAN · JERUK',
    '#b45309',
    '#fef08a'
  );

  const watermelonMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  const mangoMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const appleMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 });
  const durianMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85 });

  for (let fx = 5.2; fx <= 13.2; fx += 4.0) {
    const fruitStall = new THREE.Group();
    fruitStall.position.set(fx, 0.14, 2.6);

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.78, 1.75),
      woodMat
    );
    counter.position.y = 0.39;
    counter.castShadow = true;
    fruitStall.add(counter);

    // Overhead wooden rack for hanging banana bunches (Sisir & Tandan Pisang Raja)
    for (const px of [-1.4, 1.4]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.45, 6),
        woodMat
      );
      post.position.set(px, 1.45, 0.35);
      fruitStall.add(post);
    }
    const topBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.0, 6),
      woodMat
    );
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, 2.15, 0.35);
    fruitStall.add(topBar);

    // Hanging Yellow Banana Bunches
    for (const bx of [-0.9, 0, 0.9]) {
      const bunch = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.22, 4, 8),
        mangoMat
      );
      bunch.position.set(bx, 1.92, 0.35);
      fruitStall.add(bunch);
    }

    // Pyramids of Watermelons, Oranges, Apples & Spiky Durians on the table
    for (let w = 0; w < 4; w++) {
      const melon = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        watermelonMat
      );
      melon.scale.set(1.2, 0.95, 1.0);
      melon.position.set(-1.05 + (w % 2) * 0.46, 0.96, -0.3 + Math.floor(w / 2) * 0.45);
      fruitStall.add(melon);
    }
    for (let o = 0; o < 6; o++) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        o % 2 === 0 ? orangeMat : appleMat
      );
      fruit.position.set(-0.1 + (o % 3) * 0.3, 0.9, -0.25 + Math.floor(o / 3) * 0.35);
      fruitStall.add(fruit);
    }
    for (let d = 0; d < 3; d++) {
      const durian = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.21, 0),
        durianMat
      );
      durian.position.set(0.95 + (d % 2) * 0.35, 0.96, -0.2 + Math.floor(d / 2) * 0.4);
      fruitStall.add(durian);
    }

    group.add(fruitStall);
  }

  // ============================================================================
  // SECTION 3: LOS DAGING SAPI & AYAM POTONG (Blok B1: localX [-14.2..-4.2], localZ [-7.5..-4.5])
  // ============================================================================
  addSectionSign(
    -9.2,
    3.75,
    -3.8,
    'LOS DAGING & AYAM POTONG',
    'DAGING SAPI SEGAR · AYAM KAMPUNG · IGA & BAKSO',
    '#991b1b',
    '#fef08a'
  );

  const ceramicWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
  });
  const beefMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.45,
  });
  const fatTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfecdd3,
    roughness: 0.5,
  });
  const chickenMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.45,
  });

  for (let mx = -13.2; mx <= -5.2; mx += 4.0) {
    const meatStall = new THREE.Group();
    meatStall.position.set(mx, 0.14, -6.0);

    // White Ceramic Butcher Counter (Meja Keramik Los Daging)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.85, 1.65),
      ceramicWhiteMat
    );
    counter.position.y = 0.425;
    counter.castShadow = true;
    meatStall.add(counter);

    // Red butcher front tile stripe
    const redStripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.24, 0.24, 1.68),
      beefMat
    );
    redStripe.position.y = 0.72;
    meatStall.add(redStripe);

    // Heavy Round Tamarind Wood Chopping Block (Talenan Kayu Asem) & Meat Cleaver
    const choppingBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12),
      woodMat
    );
    choppingBlock.position.set(-0.9, 0.94, 0.25);
    meatStall.add(choppingBlock);

    // Stainless Steel Meat Hanging Rack with Hanging Beef Cuts & Whole Chickens
    for (const px of [-1.35, 1.35]) {
      const rackPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.35, 8),
        steelMat
      );
      rackPost.position.set(px, 1.5, -0.2);
      meatStall.add(rackPost);
    }
    const meatRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.8, 8),
      steelMat
    );
    meatRail.rotation.z = Math.PI / 2;
    meatRail.position.set(0, 2.15, -0.2);
    meatStall.add(meatRail);

    // Hanging Beef Cuts
    for (const hx of [-0.95, -0.35]) {
      const beefCut = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.34, 4, 8),
        beefMat
      );
      beefCut.position.set(hx, 1.78, -0.2);
      meatStall.add(beefCut);

      const marbling = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.08, 0.25),
        fatTrimMat
      );
      marbling.position.set(hx, 1.82, -0.2);
      meatStall.add(marbling);
    }

    // Whole Dressed Chickens on the counter & hanging
    for (const cx of [0.35, 0.95]) {
      const chicken = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        chickenMat
      );
      chicken.scale.set(0.9, 1.25, 0.85);
      chicken.position.set(cx, 1.0, 0.2);
      meatStall.add(chicken);
    }

    group.add(meatStall);
  }

  // ============================================================================
  // SECTION 4: LOS IKAN LAUT & HASIL TAMBAK SEGAR (Blok B2: localX [+4.2..+14.2], localZ [-7.5..-4.5])
  // ============================================================================
  addSectionSign(
    9.2,
    3.75,
    -3.8,
    'LOS IKAN LAUT & TAMBAK',
    'IKAN BANDENG · TONGKOL · KAKAP · UDANG & CUMI',
    '#0369a1',
    '#bae6fd'
  );

  const ceramicBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
  });
  const iceBedMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.2,
  });
  const silverFishMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.75,
    roughness: 0.25,
  });
  const redSnapperMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    metalness: 0.35,
    roughness: 0.3,
  });

  for (let ix = 5.2; ix <= 13.2; ix += 4.0) {
    const fishStall = new THREE.Group();
    fishStall.position.set(ix, 0.14, -6.0);

    // Blue Tiled Wet-Market Fish Counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.82, 1.65),
      ceramicBlueMat
    );
    counter.position.y = 0.41;
    counter.castShadow = true;
    fishStall.add(counter);

    // White Crushed Ice Display Trays (Hamparan Es Batu Ikan)
    for (const tx of [-0.75, 0.75]) {
      const iceTray = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.12, 1.25),
        iceBedMat
      );
      iceTray.position.set(tx, 0.86, 0);
      fishStall.add(iceTray);

      // Neatly lined rows of fresh fish on the ice
      for (let f = 0; f < 4; f++) {
        const fish = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.065, 0.28, 4, 8),
          tx < 0 ? silverFishMat : redSnapperMat
        );
        fish.rotation.x = Math.PI / 2;
        fish.scale.set(0.75, 1.0, 1.2);
        fish.position.set(tx - 0.42 + f * 0.28, 0.95, 0);
        fishStall.add(fish);
      }
    }

    // Insulated Blue Cooler Box (Box Es Pendingin Ikan) beside the stall
    const coolerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.62, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 })
    );
    coolerBox.position.set(1.25, 0.31, 1.15);
    fishStall.add(coolerBox);

    const coolerLid = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.08, 0.6),
      ceramicWhiteMat
    );
    coolerLid.position.set(1.25, 0.65, 1.15);
    fishStall.add(coolerLid);

    group.add(fishStall);
  }

  // ============================================================================
  // SECTION 5: LOS BUMBU DAPUR, REMPAH, TEMPE & TAHU (Center Rear: localX [0], localZ [-8.5])
  // ============================================================================
  addSectionSign(
    0,
    3.75,
    -6.8,
    'LOS BUMBU REMPAH & JAMU',
    'BAWANG · KUNYIT · JAHE · PETE · TEMPE & TAHU',
    '#78350f',
    '#fde047'
  );

  const spiceStall = new THREE.Group();
  spiceStall.position.set(0, 0.14, -8.4);

  const spiceTable = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.8, 1.65),
    woodMat
  );
  spiceTable.position.y = 0.4;
  spiceTable.castShadow = true;
  spiceStall.add(spiceTable);

  // Round Woven Bamboo Tampah Trays of Indonesian Spices (Kunyit, Jahe, Bawang Merah, Bawang Putih, Kemiri)
  const spicePalette = [0xfacc15, 0xd97706, 0x9f1239, 0xf8fafc, 0x15803d];
  for (let s = 0; s < 5; s++) {
    const sx = -1.6 + s * 0.8;
    const tampah = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.32, 0.06, 12),
      bambooMat
    );
    tampah.position.set(sx, 0.84, 0.15);
    spiceStall.add(tampah);

    const spiceHeap = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: spicePalette[s], roughness: 0.7 })
    );
    spiceHeap.position.set(sx, 0.96, 0.15);
    spiceStall.add(spiceHeap);
  }

  // Hanging Green Petai Strings (Untaian Papan Pete Segar) & Garlic Braids
  const peteMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.5 });
  for (let p = 0; p < 5; p++) {
    const peteStrand = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.65, 0.03),
      peteMat
    );
    peteStrand.position.set(-1.2 + p * 0.6, 1.75, 0.6);
    spiceStall.add(peteStrand);
  }

  group.add(spiceStall);

  // ============================================================================
  // SECTION 6: FRONT OUTDOOR TERRACE — WARUNG JAJAN PASAR & DAWET AYU + KIOS BUAH SEGAR
  // ============================================================================
  // 6A. Warung Kuliner Jajan Pasar, Kue Tradisional & Es Dawet Ayu (North-Front Terrace: localX = -8.5, localZ = +8.2)
  const jajanStall = new THREE.Group();
  jajanStall.position.set(-8.5, 0.15, 8.2);

  // Striped Green-Yellow Traditional Canopy Tent
  for (const [px, pz] of [
    [-2.4, -1.5],
    [2.4, -1.5],
    [-2.4, 1.5],
    [2.4, 1.5],
  ]) {
    const tPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8),
      steelMat
    );
    tPole.position.set(px, 1.45, pz);
    jajanStall.add(tPole);
  }
  const jajanRoof = makeHipRoof(5.4, 3.6, 1.15, greenRoofMat);
  jajanRoof.position.set(0, 2.85, 0);
  jajanStall.add(jajanRoof);

  // Jajan Pasar Counter & Glass Showcase
  const jajanCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.82, 1.25),
    woodMat
  );
  jajanCounter.position.set(0, 0.41, -0.35);
  jajanCounter.castShadow = true;
  jajanStall.add(jajanCounter);

  // Trays of colorful Indonesian Kue Basah (Klepon Hijau, Kue Lapis Merah-Putih, Onde-Onde)
  const kueColors = [0x22c55e, 0xf43f5e, 0xfacc15, 0xa855f7];
  for (let k = 0; k < 4; k++) {
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.14, 0.55),
      new THREE.MeshStandardMaterial({ color: kueColors[k], roughness: 0.45 })
    );
    tray.position.set(-1.4 + k * 0.72, 0.9, -0.35);
    jajanStall.add(tray);
  }

  // Twin Terracotta Gentong Jars for Es Dawet Ayu Banjarnegara (Santan & Gula Aren)
  const gentongMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.65 });
  for (const gx of [1.2, 1.75]) {
    const gentong = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      gentongMat
    );
    gentong.scale.set(1, 1.15, 1);
    gentong.position.set(gx, 1.02, -0.35);
    jajanStall.add(gentong);
  }

  // Long Wooden Dining Bench for Shoppers (at localZ = +1.15, i.e., worldX = 149.2, worldZ = -58.5)
  const jajanBench = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.42, 0.48),
    woodMat
  );
  jajanBench.position.set(0, 0.21, 1.15);
  jajanStall.add(jajanBench);

  group.add(jajanStall);

  // 6B. Kios Buah Tropis & Jamu Segar Bu Rahayu (South-Front Terrace: localX = +8.5, localZ = +8.2)
  const buahFrontStall = new THREE.Group();
  buahFrontStall.position.set(8.5, 0.15, 8.2);

  for (const [px, pz] of [
    [-2.4, -1.5],
    [2.4, -1.5],
    [-2.4, 1.5],
    [2.4, 1.5],
  ]) {
    const tPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8),
      steelMat
    );
    tPole.position.set(px, 1.45, pz);
    buahFrontStall.add(tPole);
  }
  const buahRoof = makeHipRoof(
    5.4,
    3.6,
    1.15,
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
  );
  buahRoof.position.set(0, 2.85, 0);
  buahFrontStall.add(buahRoof);

  const buahCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.82, 1.35),
    woodMat
  );
  buahCounter.position.set(0, 0.41, -0.2);
  buahCounter.castShadow = true;
  buahFrontStall.add(buahCounter);

  // Colorful Baskets of Tropical Fruits & Jamu Kunyit Asam / Beras Kencur Bottles
  for (let b = 0; b < 5; b++) {
    const bx = -1.5 + b * 0.75;
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.22, 0.75),
      bambooMat
    );
    crate.position.set(bx, 0.92, -0.2);
    buahFrontStall.add(crate);

    const fruitMound = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      b % 2 === 0 ? mangoMat : b === 1 ? watermelonMat : appleMat
    );
    fruitMound.scale.set(1.1, 0.7, 1.1);
    fruitMound.position.set(bx, 1.08, -0.2);
    buahFrontStall.add(fruitMound);
  }

  group.add(buahFrontStall);

  return group;
}

/**
 * Deretan Kios Pasar Barat (Blok B: Kios Pakaian Batik, Warung Ikan/Ayam Bakar Pasar & Grosir Sembako)
 * Placed on the West side of Gang Pasar (worldX = 134.0, worldZ = -50.0, facing East toward the main market hall)
 */
export function createKiosPasarBarat(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'KiosPasarBaratBlokB';

  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const gentengMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    color: 0xb91c1c,
    roughness: 0.68,
  });
  const wallCreamMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.72,
  });
  const trimGreenMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.55,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.78,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.7,
    roughness: 0.3,
  });

  // 1. Concrete Foundation Apron (24m wide X [-12..+12] x 6.4m deep Z [-3.2..+3.2])
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(24.0, 0.14, 6.4),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 })
  );
  pad.position.y = 0.07;
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Main Shophouse Row Building (3 Connected Market Kiosks: Batik/Pakaian, Kuliner Bakar, Grosir Sembako)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(22.4, 3.6, 3.8),
    wallCreamMat
  );
  body.position.set(0, 1.94, -0.9);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Partition pillars between the 3 kiosks
  for (const px of [-11.1, -3.7, 3.7, 11.1]) {
    const pil = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 3.7, 4.0),
      trimGreenMat
    );
    pil.position.set(px, 1.98, -0.9);
    group.add(pil);
  }

  // Aligned Pitched Hip Roof over the 22.4m Kiosk Row
  const pyrGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1.85, 4);
  pyrGeo.rotateY(Math.PI / 4);
  pyrGeo.translate(0, 1.85 / 2, 0);
  pyrGeo.scale(23.4, 1, 4.8);
  pyrGeo.computeVertexNormals();
  const roof = new THREE.Mesh(pyrGeo, gentengMat);
  roof.position.set(0, 3.74, -0.9);
  roof.castShadow = true;
  group.add(roof);

  // Front Shade Awning over the Kiosk Terrace (+Z)
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(22.8, 0.14, 2.4),
    trimGreenMat
  );
  awning.rotation.x = 0.16;
  awning.position.set(0, 3.15, 1.8);
  awning.castShadow = true;
  group.add(awning);

  for (const px of [-10.8, -3.6, 3.6, 10.8]) {
    const aPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.95, 8),
      steelMat
    );
    aPole.position.set(px, 1.52, 2.75);
    group.add(aPole);
  }

  // Signboards for the 3 Kiosks
  const kioskSigns: [number, string, string, string, string][] = [
    [-7.4, 'KIOS BATIK & SANDANG', 'BATIK NUSANTARA · KEBAYA · SARUNG TENUN', '#4c1d95', '#fde047'],
    [0, 'WARUNG BAKAR HAJI ROZAK', 'IKAN LAUT BAKAR · AYAM BUMBU RUJAK · SATE', '#9a3412', '#fef08a'],
    [7.4, 'GROSIR SEMBAKO & BERAS', 'BERAS KARUNG · MINYAK · KERUPUK · REMPAH', '#065f46', '#facc15'],
  ];
  for (const [sx, title, sub, bg, acc] of kioskSigns) {
    const tex = createLosPasarSignTexture(title, sub, bg, acc, maxAnisotropy);
    const sMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 1.05, 0.14),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    );
    sMesh.position.set(sx, 3.65, 1.15);
    group.add(sMesh);
  }

  // Kiosk 1 Props (x = -7.4): Hanging Batik Shirts, Sarongs & Mannequin Display
  const batikColors = [0xd97706, 0x2563eb, 0xdc2626, 0x16a34a, 0x9333ea];
  const clothesBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 5.6, 6),
    steelMat
  );
  clothesBar.rotation.z = Math.PI / 2;
  clothesBar.position.set(-7.4, 2.25, 1.45);
  group.add(clothesBar);

  for (let c = 0; c < 7; c++) {
    const garment = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.78, 0.08),
      new THREE.MeshStandardMaterial({
        color: batikColors[c % batikColors.length],
        roughness: 0.7,
      })
    );
    garment.position.set(-9.8 + c * 0.8, 1.8, 1.45);
    group.add(garment);
  }

  // Kiosk 2 Props (x = 0): Smoking Fish/Chicken Grill Counter & Dining Bench
  const grillCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.85, 1.1),
    woodMat
  );
  grillCounter.position.set(0, 0.56, 1.45);
  group.add(grillCounter);

  const charcoalGrill = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.28, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
  );
  charcoalGrill.position.set(-1.1, 1.12, 1.45);
  group.add(charcoalGrill);

  const embers = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.06, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.5,
    })
  );
  embers.position.set(-1.1, 1.27, 1.45);
  group.add(embers);

  const diningBench = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.42, 0.46),
    woodMat
  );
  diningBench.position.set(0.4, 0.35, 2.55);
  group.add(diningBench);

  // Kiosk 3 Props (x = +7.4): Stacked Rice Sacks, Blue Cracker Tins & Gas Cylinders
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
  for (let r = 0; r < 4; r++) {
    const sack = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.35, 0.52),
      sackMat
    );
    sack.position.set(5.4 + (r % 2) * 0.85, 0.32 + Math.floor(r / 2) * 0.34, 1.65);
    group.add(sack);
  }

  const tinMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.55,
    roughness: 0.3,
  });
  for (let t = 0; t < 3; t++) {
    const tin = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.58, 0.44),
      tinMat
    );
    tin.position.set(7.8 + t * 0.6, 0.43, 1.65);
    group.add(tin);
  }

  return group;
}

export function createIndonesianRumahKampung(
  wallColorHex: number,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RumahKampung';

  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColorHex,
    roughness: 0.75,
    metalness: 0.05,
  });
  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const roofMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    roughness: 0.75,
  });

  // 1. House Body (9m x 4.2m x 7.5m)
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.8, 7.5), wallMat);
  body.position.y = 1.9;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Front porch canopy (emperan rumah kampung)
  const porch = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 })
  );
  porch.position.set(0, 2.8, 4.6);
  porch.castShadow = true;
  group.add(porch);

  // 2. Genteng Gable Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.4, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.25, 1, 0.95);
  roof.position.set(0, 4.8, 0);
  roof.castShadow = true;
  group.add(roof);

  // 3. Orange Water Tower Tank ("Toren Air Penguin") mounted on roof steel frame
  const torenGroup = new THREE.Group();
  torenGroup.position.set(3.2, 5.2, -1.8);

  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.35,
    metalness: 0.15,
  });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 12), tankMat);
  tank.position.y = 0.8;
  tank.castShadow = true;
  torenGroup.add(tank);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.7,
    roughness: 0.4,
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), frameMat);
  frame.position.y = 0.2;
  torenGroup.add(frame);
  group.add(torenGroup);

  // 4. TV Antenna Bamboo Pole with metallic crossbars
  const antennaPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 3.8, 6),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
  );
  antennaPole.position.set(-3.2, 6.2, -1.5);
  group.add(antennaPole);

  const antennaBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.04, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
  );
  antennaBar.position.set(-3.2, 7.8, -1.5);
  group.add(antennaBar);

  // 5. Clothesline with Hanging Laundry ("Jemuran Baju")
  const jemuranGroup = new THREE.Group();
  jemuranGroup.position.set(-3.2, 0, 4.2);

  const jemuranFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.6,
      roughness: 0.4,
      wireframe: true,
    })
  );
  jemuranFrame.position.y = 0.7;
  jemuranGroup.add(jemuranFrame);

  // Hanging colorful shirts / sarongs
  const laundryColors = [0xef4444, 0x3b82f6, 0xfacc15, 0x10b981];
  for (let li = 0; li < 4; li++) {
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.6, 0.04),
      new THREE.MeshStandardMaterial({ color: laundryColors[li], roughness: 0.8 })
    );
    shirt.position.set(-0.8 + li * 0.5, 0.8, 0);
    shirt.castShadow = true;
    jemuranGroup.add(shirt);
  }
  group.add(jemuranGroup);

  return group;
}

export function createPortalGang(gangName: string): THREE.Group {
  const group = new THREE.Group();

  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.5,
    roughness: 0.35,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
  });

  // Left & Right Portal Steel Posts (spanning 5.5m alley)
  for (const px of [-2.8, 2.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 8), pipeMat);
    post.position.set(px, 1.9, 0);
    post.castShadow = true;
    group.add(post);

    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.8, 8), whiteMat);
    stripe.position.set(px, 2.2, 0);
    group.add(stripe);
  }

  // Overhead Crossbeam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.22, 0.22), pipeMat);
  beam.position.set(0, 3.7, 0);
  group.add(beam);

  // Gang Name Signboard Plaque
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 384, 96);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 376, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(gangName.toUpperCase(), 192, 42);
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TAMU HARAP LAPOR 1X24 JAM', 192, 72);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.9),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })
  );
  sign.position.set(0, 3.25, 0);
  group.add(sign);

  return group;
}

export function createTiangListrikKampung(): THREE.Group {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3,
  });

  // Octagonal Concrete Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 8), concreteMat);
  pole.position.y = 3.6;
  pole.castShadow = true;
  group.add(pole);

  // Crossarms for electric wires
  for (const cy of [5.6, 6.6]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), ironMat);
    arm.position.set(0, cy, 0);
    group.add(arm);

    // Ceramic insulators
    for (const ix of [-0.6, 0, 0.6]) {
      const ins = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
      );
      ins.position.set(ix, cy + 0.14, 0);
      group.add(ins);
    }
  }

  // Cylindrical Transformer Drum
  const trans = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.85, 10),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })
  );
  trans.position.set(0.35, 4.8, 0);
  trans.castShadow = true;
  group.add(trans);

  // Round Convex Street Mirror (Cermin Cembung Tikungan Gang)
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(0, 2.9, 0.3);
  const mirrorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    })
  );
  mirrorDisc.rotation.x = Math.PI / 2;
  mirrorGroup.add(mirrorDisc);

  const mirrorRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.04, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 })
  );
  mirrorGroup.add(mirrorRim);
  group.add(mirrorGroup);

  return group;
}

export type VendorType =
  | 'pecel_lele'
  | 'bakso'
  | 'indoalfa'
  | 'alfamaret'
  | 'bengkel'
  | 'monas_betawi'
  | 'surabaya'
  | 'taman_jajanan'
  | 'kantin'
  | 'hutan'
  | 'pos_kamling'
  | 'pasar'
  | 'pasar_buah'
  | 'pasar_daging'
  | 'pasar_ikan'
  | 'pasar_bumbu'
  | 'pasar_pakaian'
  | 'madura'
  | 'toko_sembako'
  | 'warkop'
  | 'penjaga_makam'
  | 'petugas_tps';

export function createVendorNPC(type: VendorType): THREE.Group {
  const group = new THREE.Group();
  group.name = `VendorNPC_${type}`;
  group.add(createContactShadow(1.1, 1.1));

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49464, roughness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

  let shirtColor = 0xf8fafc;
  let pantsColor = 0x1e293b;
  let apronColor = 0x15803d;
  let hasApron = true;
  let headwear: 'peci' | 'cap' | 'caping' | 'udeng' | 'hair' | 'hijab' = 'peci';
  let hasMustache = false;

  if (type === 'pecel_lele') {
    shirtColor = 0xfef08a; // Kaos kuning santai
    pantsColor = 0x1e293b;
    apronColor = 0x15803d; // Celemek hijau khas Lamongan
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'bakso') {
    shirtColor = 0xf8fafc;
    pantsColor = 0x334155;
    apronColor = 0xb91c1c; // Celemek merah kuah bakso
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'indoalfa') {
    shirtColor = 0x2563eb; // Seragam biru-merah minimarket
    pantsColor = 0x0f172a;
    apronColor = 0xdc2626;
    hasApron = false;
    headwear = 'cap';
  } else if (type === 'alfamaret') {
    shirtColor = 0xdc2626; // Seragam merah
    pantsColor = 0x0f172a;
    hasApron = false;
    headwear = 'cap';
  } else if (type === 'bengkel') {
    shirtColor = 0xea580c; // Wearpack bengkel oranye
    pantsColor = 0xea580c;
    hasApron = false;
    headwear = 'cap';
    hasMustache = true;
  } else if (type === 'monas_betawi') {
    shirtColor = 0xf8fafc; // Baju koko putih
    pantsColor = 0x1e293b;
    hasApron = false;
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'surabaya') {
    shirtColor = 0xdc2626; // Kaos merah "Wani!"
    pantsColor = 0x0f172a;
    apronColor = 0x78350f;
    headwear = 'udeng';
    hasMustache = true;
  } else if (type === 'taman_jajanan') {
    shirtColor = 0x0284c7;
    pantsColor = 0x334155;
    apronColor = 0xf59e0b;
    headwear = 'cap';
  } else if (type === 'kantin') {
    shirtColor = 0xf43f5e; // Baju santai ibu kantin
    pantsColor = 0x1e293b;
    apronColor = 0xd97706; // Celemek batik
    headwear = 'hair';
  } else if (type === 'hutan') {
    shirtColor = 0x166534;
    pantsColor = 0x422006;
    apronColor = 0xb45309;
    headwear = 'cap';
  } else if (type === 'pos_kamling') {
    shirtColor = 0x334155; // Jaket siskamling ronda
    pantsColor = 0x1e3a8a; // Sarung biru ronda
    hasApron = false;
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'pasar') {
    shirtColor = 0xd97706;
    pantsColor = 0x1e293b;
    apronColor = 0x15803d;
    headwear = 'caping';
  } else if (type === 'pasar_buah') {
    shirtColor = 0x10b981; // Blus hijau segar Ibu Penjual Sayur & Buah
    pantsColor = 0x1e293b;
    apronColor = 0xfacc15; // Celemek kuning cerah
    headwear = 'hijab';
  } else if (type === 'pasar_daging') {
    shirtColor = 0xf8fafc; // Kaos putih Pak Jagal Daging
    pantsColor = 0x0f172a;
    apronColor = 0xb91c1c; // Celemek merah jagal daging
    headwear = 'udeng';
    hasMustache = true;
  } else if (type === 'pasar_ikan') {
    shirtColor = 0x0284c7; // Kaos biru laut Bang Bahri
    pantsColor = 0x1e293b;
    apronColor = 0x1e3a8a; // Celemek anti-air biru tua
    headwear = 'cap';
    hasMustache = true;
  } else if (type === 'pasar_bumbu') {
    shirtColor = 0x92400e; // Kebaya lurik Mbok Jamu & Rempah
    pantsColor = 0x451a03; // Kain jarik batik coklat
    apronColor = 0xd97706;
    headwear = 'hair';
  } else if (type === 'pasar_pakaian') {
    shirtColor = 0x7c3aed; // Kemeja batik ungu Haji Rozak
    pantsColor = 0x0f172a;
    hasApron = false;
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'madura') {
    shirtColor = 0x0f172a; // Kaos hitam santai
    pantsColor = 0x14532d; // Sarung hijau Madura
    hasApron = false;
    headwear = 'peci';
    hasMustache = true;
  } else if (type === 'toko_sembako') {
    shirtColor = 0xf43f5e; // Daster / blus Bu Tejo
    pantsColor = 0x1e293b;
    apronColor = 0xfacc15;
    headwear = 'hair';
  } else if (type === 'warkop') {
    shirtColor = 0x78350f; // Baju lurik Mbah Darmo
    pantsColor = 0x0f172a;
    apronColor = 0xd97706;
    headwear = 'udeng';
    hasMustache = true;
  } else if (type === 'penjaga_makam') {
    shirtColor = 0x064e3b; // Baju koko hijau tua penjaga makam
    pantsColor = 0x1e293b;
    hasApron = false;
    headwear = 'peci';
  } else if (type === 'petugas_tps') {
    shirtColor = 0xf8fafc; // Kemeja putih KPPS
    pantsColor = 0x0f172a;
    apronColor = 0xdc2626; // Rompi KPPS Merah Putih
    hasApron = true;
    headwear = 'peci';
  }

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.82 });

  // 1. Pelvis & Articulated Legs with Shoes
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.25), pantsMat);
  pelvis.position.set(0, 0.82, 0);
  bodyRoot.add(pelvis);

  const legGeo = new THREE.CapsuleGeometry(0.1, 0.44, 4, 8);
  legGeo.translate(0, -0.24, 0);

  const makeVendorLeg = (lx: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(lx, 0.8, 0);
    const legMesh = new THREE.Mesh(legGeo, pantsMat);
    legMesh.castShadow = true;
    legGroup.add(legMesh);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.29), shoeMat);
    shoe.position.set(0, -0.52, 0.035);
    legGroup.add(shoe);

    bodyRoot.add(legGroup);
    return legGroup;
  };

  const leftLeg = makeVendorLeg(-0.14);
  const rightLeg = makeVendorLeg(0.14);

  // 2. Upper Body / Spine Group (pivoted at waist y = 0.88)
  const upperBodyGroup = new THREE.Group();
  upperBodyGroup.position.set(0, 0.88, 0);
  bodyRoot.add(upperBodyGroup);

  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.22, 0);
  torsoShape.lineTo(0.22, 0);
  torsoShape.lineTo(0.26, 0.56);
  torsoShape.lineTo(-0.26, 0.56);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  torsoGeo.translate(0, 0, -0.12);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.castShadow = true;
  upperBodyGroup.add(torso);

  // Apron or Vest
  if (hasApron) {
    const apronMat = new THREE.MeshStandardMaterial({ color: apronColor, roughness: 0.65 });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.04), apronMat);
    apron.position.set(0, 0.14, 0.15);
    upperBodyGroup.add(apron);

    // Front apron pocket
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.025),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 })
    );
    pocket.position.set(0, 0.12, 0.175);
    upperBodyGroup.add(pocket);
  } else if (type === 'monas_betawi') {
    // Red Betawi Cukin cloth draped over shoulders
    const cukinMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
    const cukin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 0.08), cukinMat);
    cukin.position.set(0, 0.36, 0.14);
    upperBodyGroup.add(cukin);
  } else if (type === 'indoalfa' || type === 'alfamaret') {
    // Minimarket vest stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.12, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    stripe.position.set(0, 0.32, 0);
    upperBodyGroup.add(stripe);
  } else if (type === 'pos_kamling' || type === 'madura') {
    // Cross-body woven Sarung / Selempang Sarung Ronda
    const sarungSling = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.62, 0.31),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.75 })
    );
    sarungSling.position.set(0, 0.28, 0);
    sarungSling.rotation.z = 0.55;
    upperBodyGroup.add(sarungSling);
  }

  // 3. Articulated Two-Segment Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
  const upperArmGeo = new THREE.CapsuleGeometry(0.08, 0.2, 4, 8);
  upperArmGeo.translate(0, -0.12, 0);
  const forearmGeo = new THREE.CapsuleGeometry(0.07, 0.2, 4, 8);
  forearmGeo.translate(0, -0.12, 0);

  const buildVendorArm = (shoulderX: number) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(shoulderX, 0.5, 0);

    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    upperArm.castShadow = true;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.25, 0);

    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.074, 8, 8), skinMat);
    hand.position.set(0, -0.25, 0);
    elbowPivot.add(hand);

    shoulderPivot.add(elbowPivot);
    upperBodyGroup.add(shoulderPivot);
    return { shoulderPivot, elbowPivot };
  };

  const leftArmData = buildVendorArm(-0.32);
  const rightArmData = buildVendorArm(0.32);
  const leftArm = leftArmData.shoulderPivot;
  const rightArm = rightArmData.shoulderPivot;
  const leftElbow = leftArmData.elbowPivot;
  const rightElbow = rightArmData.elbowPivot;

  // 4. Neck & Expressive Face (Eyes, Eyebrows, Nose, Mustache, Smile & Headwear)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8),
    skinMat
  );
  neck.position.set(0, 0.6, 0);
  upperBodyGroup.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.75, 0);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 14), skinMat);
  headSphere.scale.set(0.96, 1.04, 0.98);
  headSphere.castShadow = true;
  head.add(headSphere);

  // Ears & Eyes
  for (const ex of [-0.185, 0.185]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), skinMat);
    ear.scale.set(0.55, 1.1, 0.8);
    ear.position.set(ex, 0, 0);
    head.add(ear);
  }
  for (const ex of [-0.065, 0.065]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), darkMat);
    eye.position.set(ex, 0.025, 0.175);
    head.add(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.015), darkMat);
    brow.position.set(ex, 0.068, 0.175);
    head.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.045, 0.035), skinMat);
  nose.position.set(0, -0.01, 0.188);
  head.add(nose);

  if (hasMustache) {
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.02), darkMat);
    mustache.position.set(0, -0.052, 0.185);
    head.add(mustache);
  }

  const smile = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.016, 0.015),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  smile.position.set(0, -0.08, 0.178);
  head.add(smile);

  // Headwear attached to head group so it nods and turns with the vendor's head!
  if (headwear === 'peci') {
    const peci = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.195, 0.14, 14),
      darkMat
    );
    peci.scale.set(0.95, 1, 1.05);
    peci.position.set(0, 0.15, 0);
    head.add(peci);
  } else if (headwear === 'caping') {
    const caping = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 })
    );
    caping.position.set(0, 0.19, 0);
    head.add(caping);
  } else if (headwear === 'udeng') {
    const udeng = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.048, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 })
    );
    udeng.rotation.x = Math.PI / 2;
    udeng.position.set(0, 0.11, 0);
    head.add(udeng);
  } else if (headwear === 'cap') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      darkMat
    );
    cap.position.set(0, 0.03, 0);
    head.add(cap);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.14), darkMat);
    visor.position.set(0, 0.08, 0.16);
    visor.rotation.x = 0.15;
    head.add(visor);
  } else if (headwear === 'hijab') {
    const hijabMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.65 });
    const hijabHood = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72),
      hijabMat
    );
    hijabHood.position.set(0, 0.01, -0.02);
    head.add(hijabHood);

    const hijabCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 0.14, 12),
      hijabMat
    );
    hijabCollar.position.set(0, -0.15, 0);
    head.add(hijabCollar);
  } else {
    // Neat hair + Ibu Kantin / Bu Tejo / Mbok Jamu hair bun (Sanggul/Konde)
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      darkMat
    );
    hairCrown.position.set(0, 0.02, -0.01);
    head.add(hairCrown);

    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), darkMat);
    bun.position.set(0, 0.06, -0.18);
    head.add(bun);
  }

  upperBodyGroup.add(head);

  // 5. Held Prop (in right hand, attached to rightElbow!)
  let rightItem: THREE.Mesh | null = null;
  if (type === 'pecel_lele') {
    // Bamboo woven fan for grilling lele/ayam (Kipas Bambu)
    rightItem = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.26, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
    );
    rightItem.position.set(0, -0.28, 0.12);
    rightElbow.add(rightItem);
  } else if (type === 'bakso') {
    // Stainless steel soup ladle (Centong Kuah Bakso)
    rightItem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
    );
    rightItem.position.set(0, -0.28, 0.1);
    rightElbow.add(rightItem);
  } else if (type === 'bengkel') {
    // Wrench / spanner tool (Kunci Inggris)
    rightItem = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.34, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
    );
    rightItem.position.set(0, -0.28, 0.08);
    rightElbow.add(rightItem);
  } else if (type === 'pos_kamling') {
    // Patrol flashlight (Senter Ronda)
    rightItem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.34, 8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.3 })
    );
    rightItem.rotation.x = Math.PI / 2;
    rightItem.position.set(0, -0.26, 0.14);
    rightElbow.add(rightItem);
  } else if (type === 'pasar_daging') {
    // Stainless Steel Butcher Cleaver (Golok Potong Daging)
    rightItem = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.32, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
    );
    rightItem.position.set(0, -0.28, 0.12);
    rightElbow.add(rightItem);
  } else if (type === 'pasar_ikan') {
    // Fresh Silver Fish held up to show shoppers
    rightItem = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.22, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 })
    );
    rightItem.rotation.x = Math.PI / 2;
    rightItem.position.set(0, -0.26, 0.12);
    rightElbow.add(rightItem);
  } else if (type === 'pasar_buah') {
    // Woven Bamboo Fruit Basket
    rightItem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
    );
    rightItem.position.set(0, -0.28, 0.12);
    rightElbow.add(rightItem);
  } else if (type === 'pasar_bumbu') {
    // Bottle of Jamu Kunyit Asam
    rightItem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
    );
    rightItem.position.set(0, -0.26, 0.1);
    rightElbow.add(rightItem);
  }

  group.userData.vendorType = type;
  group.userData.limbs = {
    bodyRoot,
    upperBodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    head,
    rightItem,
  };
  return group;
}

export function createSittingNPC(
  shirtColor: number,
  pantsColor: number,
  archetype: PedestrianArchetype = 'warga'
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SittingNPC';
  group.add(createContactShadow(0.9, 0.9));

  let finalShirt = shirtColor;
  let finalPants = pantsColor;
  if (archetype === 'pelajar_sma') {
    finalShirt = 0xf8fafc;
    finalPants = 0x64748b;
  } else if (archetype === 'santri') {
    finalShirt = 0xf8fafc;
    finalPants = 0x14532d;
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49464, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: finalShirt, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: finalPants, roughness: 0.82 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });

  // 1. Sitting Legs (Thigh extended horizontally, bent knee, calf downward + shoes)
  const thighGeo = new THREE.CapsuleGeometry(0.095, 0.32, 4, 8);
  thighGeo.translate(0, 0, 0.17);
  const calfGeo = new THREE.CapsuleGeometry(0.084, 0.34, 4, 8);
  calfGeo.translate(0, -0.18, 0.34);

  for (const sx of [-0.14, 0.14]) {
    const legGroup = new THREE.Group();
    legGroup.position.set(sx, 0.52, 0);

    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.rotation.x = -Math.PI / 2;
    legGroup.add(thigh);

    const calf = new THREE.Mesh(calfGeo, pantsMat);
    legGroup.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.085, 0.27), shoeMat);
    shoe.position.set(0, -0.38, 0.38);
    legGroup.add(shoe);

    group.add(legGroup);
  }

  // 2. Sculpted Upper Body Group (pivoted at hip y = 0.56)
  const upperBodyGroup = new THREE.Group();
  upperBodyGroup.position.set(0, 0.56, -0.05);
  group.add(upperBodyGroup);

  const torsoShape = new THREE.Shape();
  torsoShape.moveTo(-0.21, 0);
  torsoShape.lineTo(0.21, 0);
  torsoShape.lineTo(0.25, 0.52);
  torsoShape.lineTo(-0.25, 0.52);
  torsoShape.closePath();

  const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  torsoGeo.translate(0, 0, -0.11);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.castShadow = true;
  upperBodyGroup.add(torso);

  // 3. Articulated Two-Segment Sitting Arms + Coffee Cup
  const upperArmGeo = new THREE.CapsuleGeometry(0.075, 0.18, 4, 8);
  upperArmGeo.translate(0, -0.11, 0);
  const forearmGeo = new THREE.CapsuleGeometry(0.065, 0.18, 4, 8);
  forearmGeo.translate(0, -0.11, 0);

  const makeSitArm = (sx: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx, 0.48, 0);
    const uArm = new THREE.Mesh(upperArmGeo, shirtMat);
    shoulder.add(uArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    const fArm = new THREE.Mesh(forearmGeo, skinMat);
    elbow.add(fArm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), skinMat);
    hand.position.set(0, -0.22, 0);
    elbow.add(hand);

    shoulder.add(elbow);
    upperBodyGroup.add(shoulder);
    return { shoulder, elbow };
  };

  const leftArmData = makeSitArm(-0.3);
  const rightArmData = makeSitArm(0.3);
  const leftArm = leftArmData.shoulder;
  const rightArm = rightArmData.shoulder;
  const leftElbow = leftArmData.elbow;
  const rightElbow = rightArmData.elbow;

  leftArm.rotation.set(-0.35, 0, 0.12);
  leftElbow.rotation.x = -0.75;
  rightArm.rotation.set(-0.45, 0, -0.12);
  rightElbow.rotation.x = -0.85;

  // Coffee cup held in right hand
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.04, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  cup.position.set(0, -0.24, 0.05);
  cup.rotation.x = Math.PI / 2;
  rightElbow.add(cup);

  // 4. Expressive Head with Face & Headwear
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.11, 8), skinMat);
  neck.position.set(0, 0.58, 0);
  upperBodyGroup.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.72, 0);

  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 14), skinMat);
  headSphere.scale.set(0.96, 1.04, 0.98);
  head.add(headSphere);

  for (const ex of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), darkMat);
    eye.position.set(ex, 0.025, 0.168);
    head.add(eye);
  }
  const smile = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.015, 0.015),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  smile.position.set(0, -0.068, 0.17);
  head.add(smile);

  if (archetype === 'santri') {
    const peci = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.185, 0.12, 12),
      darkMat
    );
    peci.position.set(0, 0.14, 0);
    head.add(peci);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.192, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      darkMat
    );
    hair.position.set(0, 0.03, 0);
    head.add(hair);
  }

  upperBodyGroup.add(head);

  group.userData.head = head;
  group.userData.limbs = {
    upperBodyGroup,
    head,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
  };
  return group;
}

export function createPohonPisang(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PohonPisang';

  // Base planter mound/earth
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0x3f2e18, roughness: 0.95 })
  );
  mound.position.y = 0.08;
  group.add(mound);

  // Pseudostem (Batang semu pisang berlapis hijau kecokelatan)
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x65a30d,
    roughness: 0.85,
    metalness: 0.02,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.8, 10),
    trunkMat
  );
  trunk.position.set(0, 1.4, 0);
  trunk.rotation.z = 0.05;
  trunk.castShadow = true;
  group.add(trunk);

  // Broad arching banana leaves (daun pisang mekar melengkung)
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const leafAngles = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.5];
  for (let i = 0; i < leafAngles.length; i++) {
    const angle = leafAngles[i];
    const leafGroup = new THREE.Group();
    leafGroup.position.set(0, 2.65, 0);
    leafGroup.rotation.y = angle;

    // Petiole / Midrib (tangkai daun)
    const petiole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.8 })
    );
    petiole.rotation.z = -Math.PI / 4;
    petiole.position.set(0.42, 0.35, 0);
    leafGroup.add(petiole);

    // Blade (helaian daun lebar melengkung)
    const bladeGeo = new THREE.PlaneGeometry(0.72, 1.9, 3, 5);
    bladeGeo.rotateZ(-Math.PI / 3.2);
    bladeGeo.rotateX(Math.PI / 2.3);
    const blade = new THREE.Mesh(bladeGeo, leafMat);
    blade.position.set(1.15, 0.65, 0);
    blade.castShadow = true;
    leafGroup.add(blade);

    group.add(leafGroup);
  }

  // Banana bunch (Tandan pisang kuning-hijau menggantung)
  const bunchGroup = new THREE.Group();
  bunchGroup.position.set(0.3, 2.35, 0);

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x4d7c0f })
  );
  stalk.rotation.z = Math.PI / 5;
  stalk.position.set(0.12, -0.15, 0);
  bunchGroup.add(stalk);

  const bananaMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.5,
  });
  for (let b = 0; b < 10; b++) {
    const bMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.22, 4, 8),
      bananaMat
    );
    const bAngle = (b / 10) * Math.PI * 2;
    bMesh.position.set(
      0.15 + Math.cos(bAngle) * 0.12,
      -0.25 - (b % 3) * 0.08,
      Math.sin(bAngle) * 0.12
    );
    bMesh.rotation.z = Math.PI / 2.5;
    bunchGroup.add(bMesh);
  }

  // Jantung Pisang (purple flower bud hanging at the tip)
  const jantung = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.32, 8),
    new THREE.MeshStandardMaterial({ color: 0x701a75, roughness: 0.6 })
  );
  jantung.rotation.x = Math.PI;
  jantung.position.set(0.25, -0.62, 0);
  bunchGroup.add(jantung);

  group.add(bunchGroup);
  return group;
}

export function createPohonManggaKampung(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PohonMangga';

  // Base soil mound
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x3f2e18, roughness: 0.95 })
  );
  mound.position.y = 0.1;
  group.add(mound);

  // Main woody trunk
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.9,
    metalness: 0.05,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.55, 3.2, 10),
    trunkMat
  );
  trunk.position.set(0, 1.6, 0);
  trunk.castShadow = true;
  group.add(trunk);

  // Side branches
  for (const [bx, by, bz, rx, rz] of [
    [-0.5, 2.5, 0.2, 0.2, 0.55],
    [0.55, 2.7, -0.25, -0.3, -0.6],
    [0.1, 2.9, 0.5, 0.6, 0.1],
  ]) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6),
      trunkMat
    );
    branch.position.set(bx, by, bz);
    branch.rotation.set(rx, 0, rz);
    group.add(branch);
  }

  // Dense, layered shady mango canopy
  const canopyMat1 = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.85,
  });
  const canopyMat2 = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.82,
  });

  const canopyPuffs = [
    { x: 0, y: 4.4, z: 0, r: 2.1, mat: canopyMat1 },
    { x: -1.2, y: 3.8, z: 0.6, r: 1.6, mat: canopyMat2 },
    { x: 1.3, y: 3.9, z: -0.5, r: 1.7, mat: canopyMat1 },
    { x: 0.3, y: 4.1, z: 1.2, r: 1.5, mat: canopyMat2 },
    { x: -0.4, y: 4.2, z: -1.2, r: 1.6, mat: canopyMat2 },
  ];

  for (const puff of canopyPuffs) {
    const sphere = new THREE.Mesh(new THREE.DodecahedronGeometry(puff.r, 1), puff.mat);
    sphere.position.set(puff.x, puff.y, puff.z);
    sphere.castShadow = true;
    group.add(sphere);
  }

  // Little mangoes peeking from foliage
  const mangoMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.4 });
  for (const [mx, my, mz] of [
    [-0.9, 2.9, 0.8],
    [0.7, 3.1, -0.8],
    [-0.3, 3.2, -1.0],
    [1.1, 3.0, 0.4],
  ]) {
    const mango = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mangoMat);
    mango.scale.set(0.9, 1.3, 0.9);
    mango.position.set(mx, my, mz);
    group.add(mango);
  }

  return group;
}

export function createPotBungaKampung(variant: 'ember_cat' | 'gerabah' | 'caladium'): THREE.Group {
  const group = new THREE.Group();
  group.name = `PotBunga_${variant}`;

  if (variant === 'ember_cat') {
    // Recycled paint can pot with Bougainvillea
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.2, 0.42, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
    );
    can.position.y = 0.21;
    group.add(can);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.242, 0.242, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 })
    );
    stripe.position.y = 0.22;
    group.add(stripe);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x27190d, roughness: 0.95 })
    );
    soil.position.y = 0.41;
    group.add(soil);

    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.38, 1),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    );
    foliage.position.y = 0.68;
    group.add(foliage);

    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.4 });
    for (let f = 0; f < 8; f++) {
      const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), flowerMat);
      const fa = (f / 8) * Math.PI * 2;
      fl.position.set(Math.cos(fa) * 0.32, 0.65 + (f % 3) * 0.1, Math.sin(fa) * 0.32);
      group.add(fl);
    }
  } else if (variant === 'gerabah') {
    // Traditional terracotta clay pot with Sansevieria / Lidah Mertua
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.18, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.85 })
    );
    pot.position.y = 0.24;
    group.add(pot);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.29, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 })
    );
    rim.position.y = 0.48;
    group.add(rim);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    for (let l = 0; l < 7; l++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75 + (l % 3) * 0.15, 0.02), leafMat);
      const la = (l / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(la) * 0.12, 0.8, Math.sin(la) * 0.12);
      leaf.rotation.y = la;
      leaf.rotation.z = (Math.random() - 0.5) * 0.2;
      group.add(leaf);
    }
  } else {
    // Caladium / Keladi Hias
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    pot.position.y = 0.18;
    group.add(pot);

    const caladiumMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.6 });
    for (let c = 0; c < 5; c++) {
      const ca = (c / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.22, 5), caladiumMat);
      leaf.rotation.x = -Math.PI / 3;
      leaf.rotation.z = ca;
      leaf.position.set(Math.cos(ca) * 0.15, 0.45, Math.sin(ca) * 0.15);
      group.add(leaf);
    }
  }

  return group;
}

export function createWarungKelontongKampung(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TokoSembakoBuTejo';

  // 1. Concrete Paved Front Foundation
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.16, 6.2),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })
  );
  base.position.set(0, 0.08, 0);
  base.receiveShadow = true;
  group.add(base);

  // 2. Building Walls (Tembok toko warna krem lembut)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.4, 0.25), wallMat);
  backWall.position.set(0, 1.86, -2.8);
  backWall.castShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 5.6), wallMat);
  leftWall.position.set(-3.3, 1.86, 0);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 5.6), wallMat);
  rightWall.position.set(3.3, 1.86, 0);
  rightWall.castShadow = true;
  group.add(rightWall);

  // 3. Front Wooden / Rolling Shutters (Pintu lipat biru toko)
  const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.7, 0.12), woodDoorMat);
  doorPanel.position.set(0, 1.5, 0.8);
  group.add(doorPanel);

  // Open shop window counter cutout
  const counterOpening = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 1.4, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  counterOpening.position.set(0, 1.85, 0.8);
  group.add(counterOpening);

  // Wooden counter ledge
  const ledge = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.16, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
  );
  ledge.position.set(0, 1.15, 1.15);
  group.add(ledge);

  // 4. Corrugated Awning (Kanopi Seng Depan Toko)
  const awningMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 2.4), awningMat);
  awning.rotation.x = Math.PI / 14;
  awning.position.set(0, 3.15, 1.8);
  awning.castShadow = true;
  group.add(awning);

  // Awning iron support poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
  for (const px of [-3.4, 3.4]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), poleMat);
    pole.position.set(px, 1.45, 2.7);
    group.add(pole);
  }

  // 5. Store Signboard Banner ("TOKO SEMBAKO BU TEJO")
  const signTex = createTokoSembakoSignTexture(maxAnisotropy);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.4,
    metalness: 0.1,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), signMat);
  sign.position.set(0, 3.85, 0.85);
  group.add(sign);

  // 6. Iconic Indonesian Store Props:
  // a) Kerupuk Blek Kaleng Biru (4 Blue cracker tins with round glass lids)
  const tinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
  for (let k = 0; k < 4; k++) {
    const tin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.42), tinMat);
    tin.position.set(-1.8 + k * 0.55, 1.52, 1.15);
    group.add(tin);
  }

  // b) Gas Elpiji 3kg Hijau Melon
  const gasMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.4 });
  for (let g = 0; g < 4; g++) {
    const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 10), gasMat);
    gas.position.set(-2.6 + (g % 2) * 0.45, 0.36 + Math.floor(g / 2) * 0.4, 2.1);
    group.add(gas);
  }

  // c) Aqua Galon Biru 19L
  const galonMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.2,
  });
  for (let a = 0; a < 3; a++) {
    const galon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.52, 10), galonMat);
    galon.position.set(2.4, 0.42, 1.6 + a * 0.42);
    group.add(galon);
  }

  // d) Sacks of Rice
  const riceMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
  for (let r = 0; r < 3; r++) {
    const sack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.42), riceMat);
    sack.position.set(1.5, 0.31 + r * 0.28, 2.0);
    group.add(sack);
  }

  return group;
}

export function createWarungKopiKampung(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WarkopMbahDarmo';

  // 1. Raised Wooden Floor Base
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.16, 4.8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
  );
  floor.position.set(0, 0.08, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Bamboo & Timber Pillars
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75 });
  for (const px of [-2.8, 2.8]) {
    for (const pz of [-2.1, 2.1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.9, 8), woodMat);
      pillar.position.set(px, 1.45, pz);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }

  // 3. Bamboo Woven Wall (Gedek) at back
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.4, 0.08), wallMat);
  backWall.position.set(0, 1.4, -2.1);
  group.add(backWall);

  // 4. Roof with Clay Tiles
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.4, 1.6, 4),
    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 3.4, 0);
  roof.castShadow = true;
  group.add(roof);

  // 5. Long Coffee Counter & Wooden Benches
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.95, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
  );
  counter.position.set(0, 0.55, -0.4);
  group.add(counter);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 })
  );
  bench.position.set(0, 0.3, 0.8);
  group.add(bench);

  // 6. Hanging Coffee Sachets (Rencengan Kopi)
  const sachetMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
  for (let s = 0; s < 4; s++) {
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.02), sachetMat);
    strand.position.set(-1.2 + s * 0.7, 1.8, -0.4);
    group.add(strand);
  }

  // 7. Signboard ("WARKOP MBAH DARMO")
  const signTex = createWarkopSignTexture(maxAnisotropy);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.05),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
  );
  sign.position.set(0, 2.65, 2.05);
  group.add(sign);

  return group;
}

/**
 * TPU Kamboja Nusantara (Kuburan / Tempat Pemakaman Umum Warga Indonesia)
 * Features:
 * - Wrought-iron & brick archway gate with "TPU KAMBOJA NUSANTARA" signboard
 * - Peaceful grassy cemetery lawn with central paving path
 * - 12 authentic Indonesian grave mounds (gundukan tanah & rumput) with twin head/foot tombstones
 *   (batu nisan putih marmer & nisan kayu ukir) + scattered red/white rose petals (bunga tabur)
 * - 3 gnarly Pohon Kamboja (Frangipani cemetery trees) with white-yellow blossoms & fallen flowers
 * - Caretaker & Bunga Tabur / Air Mawar kiosk (Pos Penjaga Makam & Kembang Ziarah)
 * - Warm cemetery garden lanterns for atmospheric night visibility
 */
export function createKuburanTPU(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'KuburanTPUNusantara';

  // 1. Cemetery Lawn Base (18m wide x 15m deep) — raised slightly to y=0.05 to avoid z-fighting
  const lawnMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.92,
  });
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.1, 15.0), lawnMat);
  lawn.position.set(0, 0.05, 0);
  lawn.receiveShadow = true;
  group.add(lawn);

  // Central stone walkway leading from front gate (+Z) to the back (-Z)
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
  });
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.13, 14.2), pathMat);
  walkway.position.set(0, 0.065, 0.2);
  walkway.receiveShadow = true;
  group.add(walkway);

  // 2. Low Brick & Wrought-Iron Perimeter Fence (Pagar Besi & Bata Pendek TPU)
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 });
  const pillarCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const ironFenceMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.35,
  });

  // Back wall (-Z) and Side walls (-X, +X)
  const backLowWall = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.55, 0.28), brickMat);
  backLowWall.position.set(0, 0.32, -7.35);
  group.add(backLowWall);

  const backIron = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.65, 0.08), ironFenceMat);
  backIron.position.set(0, 0.9, -7.35);
  group.add(backIron);

  for (const sx of [-8.8, 8.8]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 14.8), brickMat);
    sideWall.position.set(sx, 0.32, 0);
    group.add(sideWall);

    const sideIron = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 14.6), ironFenceMat);
    sideIron.position.set(sx, 0.9, 0);
    group.add(sideIron);
  }

  // Front fence left & right wings (leaving 3.6m entrance gap in center at z = +7.35)
  for (const fx of [-5.3, 5.3]) {
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 0.28), brickMat);
    frontWall.position.set(fx, 0.32, 7.35);
    group.add(frontWall);

    const frontIron = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.65, 0.08), ironFenceMat);
    frontIron.position.set(fx, 0.9, 7.35);
    group.add(frontIron);
  }

  // Brick Fence Pillars around perimeter & Main Gate Arch Pillars
  const pillarPositions: [number, number, number][] = [
    [-8.8, -7.35, 1.35],
    [0, -7.35, 1.35],
    [8.8, -7.35, 1.35],
    [-8.8, 0, 1.35],
    [8.8, 0, 1.35],
    [-8.8, 7.35, 1.35],
    [8.8, 7.35, 1.35],
    [-2.0, 7.35, 3.6], // Left Main Gate Pillar
    [2.0, 7.35, 3.6],  // Right Main Gate Pillar
  ];
  for (const [px, pz, ph] of pillarPositions) {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, ph, 0.48), brickMat);
    pMesh.position.set(px, ph / 2, pz);
    pMesh.castShadow = true;
    group.add(pMesh);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.58), pillarCapMat);
    cap.position.set(px, ph + 0.07, pz);
    group.add(cap);
  }

  // Main Gate Overhead Arch Beam & TPU Kamboja Signboard (at z = +7.35)
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 0.45), ironFenceMat);
  gateBeam.position.set(0, 3.65, 7.35);
  group.add(gateBeam);

  const tpuSignTex = createTPUSignTexture(maxAnisotropy);
  const tpuSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.25, 0.16),
    new THREE.MeshStandardMaterial({ map: tpuSignTex, roughness: 0.35 })
  );
  tpuSign.position.set(0, 4.15, 7.35);
  group.add(tpuSign);

  // 3. Twelve Authentic Indonesian Graves (Makam Gundukan Tanah & Nisan Kembar)
  // Arranged in neat rows on the West (Blok A) and East (Blok B) sides of the walkway
  const soilMoundMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });
  const whiteMarbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const greyStoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.65 });
  const teakNisanMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const redPetalMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 });
  const whitePetalMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });

  const graveCoords: [number, number, 'marble' | 'stone' | 'wood'][] = [
    // Blok A (Left / West side)
    [-6.2, -4.5, 'marble'],
    [-3.4, -4.5, 'stone'],
    [-6.2, -1.2, 'wood'],
    [-3.4, -1.2, 'marble'],
    [-6.2, 2.1, 'stone'],
    [-3.4, 2.1, 'marble'],
    // Blok B (Right / East side)
    [3.4, -4.5, 'marble'],
    [6.2, -4.5, 'wood'],
    [3.4, -1.2, 'stone'],
    [6.2, -1.2, 'marble'],
    [3.4, 2.1, 'marble'],
    [6.2, 2.1, 'stone'],
  ];

  graveCoords.forEach(([gx, gz, style], idx) => {
    const graveGroup = new THREE.Group();
    graveGroup.position.set(gx, 0.1, gz);

    // Kijing / stone border frame around the grave mound
    const borderMat = style === 'wood' ? teakNisanMat : style === 'marble' ? whiteMarbleMat : greyStoneMat;
    const kijingBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 2.25), borderMat);
    kijingBase.position.y = 0.09;
    kijingBase.castShadow = true;
    kijingBase.receiveShadow = true;
    graveGroup.add(kijingBase);

    // Raised earth & grass mound (Gundukan Tanah Makam)
    const mound = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 1.85), soilMoundMat);
    mound.position.y = 0.22;
    mound.castShadow = true;
    graveGroup.add(mound);

    // Twin Indonesian Tombstones (Batu Nisan Kepala di Utara -Z & Kaki di Selatan +Z)
    for (const nz of [-0.78, 0.78]) {
      const nisanBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), borderMat);
      nisanBase.position.set(0, 0.36, nz);
      graveGroup.add(nisanBase);

      const nisanPillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.58, 0.12), borderMat);
      nisanPillar.position.set(0, 0.68, nz);
      nisanPillar.castShadow = true;
      graveGroup.add(nisanPillar);

      // Pointed lotus/crown finial typical of Nusantara tombstones (Maesan)
      const nisanTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.26, 4), borderMat);
      nisanTip.rotation.y = Math.PI / 4;
      nisanTip.position.set(0, 1.08, nz);
      graveGroup.add(nisanTip);

      // Gold/black name plaque on headstone (North stone)
      if (nz < 0) {
        const plaque = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.22, 0.02),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
        );
        plaque.position.set(0, 0.68, nz + 0.07);
        graveGroup.add(plaque);
      }
    }

    // Scattered Flower Petals (Taburan Bunga Mawar & Melati Ziarah) on top of the mound
    for (let p = 0; p < 6; p++) {
      const petal = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.03, 0.11),
        (p + idx) % 2 === 0 ? redPetalMat : whitePetalMat
      );
      petal.position.set(
        ((p % 2) - 0.5) * 0.38,
        0.34,
        -0.45 + p * 0.18
      );
      petal.rotation.y = p * 0.7;
      graveGroup.add(petal);
    }

    group.add(graveGroup);
  });

  // 4. Three Iconic Pohon Kamboja (Frangipani Cemetery Trees with White-Yellow Blossoms)
  const kambojaTrunkMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
  const kambojaLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
  const kambojaFlowerMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });

  const kambojaCoords: [number, number, number][] = [
    [-7.2, -5.8, 1.05],
    [7.2, -5.8, 1.1],
    [-7.2, 4.8, 0.95],
  ];

  kambojaCoords.forEach(([kx, kz, kScale], idx) => {
    const kTree = new THREE.Group();
    kTree.position.set(kx, 0.1, kz);

    // Gnarly twisting frangipani trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.34, 2.6, 8),
      kambojaTrunkMat
    );
    trunk.position.y = 1.3;
    trunk.rotation.z = idx % 2 === 0 ? 0.12 : -0.12;
    trunk.castShadow = true;
    kTree.add(trunk);

    // Forked branches
    for (const [bx, bz, rz] of [
      [-0.55, 0.25, 0.52],
      [0.55, -0.25, -0.52],
      [0.1, 0.55, 0.35],
    ]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.5, 6), kambojaTrunkMat);
      br.position.set(bx, 2.5, bz);
      br.rotation.z = rz;
      kTree.add(br);
    }

    // Umbrella-like canopy clusters
    for (const [cx, cy, cz, cr] of [
      [0, 3.6, 0, 1.45],
      [-0.95, 3.3, 0.4, 1.15],
      [0.95, 3.3, -0.4, 1.15],
      [0.2, 3.4, 0.9, 1.05],
    ]) {
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(cr, 1), kambojaLeafMat);
      foliage.position.set(cx, cy, cz);
      foliage.scale.set(1.15, 0.65, 1.15);
      foliage.castShadow = true;
      kTree.add(foliage);
    }

    // Frangipani blossoms in canopy & fallen on the grass below
    for (let f = 0; f < 9; f++) {
      const ang = (f / 9) * Math.PI * 2;
      const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), kambojaFlowerMat);
      blossom.position.set(Math.cos(ang) * 1.25, 3.45 + (f % 3) * 0.18, Math.sin(ang) * 1.25);
      kTree.add(blossom);

      // Fallen frangipani flower on the ground
      const fallen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), kambojaFlowerMat);
      fallen.position.set(Math.cos(ang + 0.4) * 1.4, 0.03, Math.sin(ang + 0.4) * 1.4);
      kTree.add(fallen);
    }

    kTree.scale.setScalar(kScale);
    group.add(kTree);
  });

  // 5. Caretaker & Flower Seller Kiosk (Pos Penjaga Makam & Kembang Ziarah) at Front-Right (x = 5.4, z = 5.1)
  const kioskGroup = new THREE.Group();
  kioskGroup.position.set(5.4, 0.1, 5.1);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.65 });

  // Wooden booth counter & shelter posts
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), woodMat);
  counter.position.set(0, 0.45, 0);
  counter.castShadow = true;
  kioskGroup.add(counter);

  for (const [px, pz] of [
    [-1.2, -0.5],
    [1.2, -0.5],
    [-1.2, 0.5],
    [1.2, 0.5],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), woodMat);
    post.position.set(px, 1.2, pz);
    kioskGroup.add(post);
  }

  const kioskRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.95, 4), roofMat);
  kioskRoof.rotation.y = Math.PI / 4;
  kioskRoof.scale.set(1.25, 1, 0.85);
  kioskRoof.position.set(0, 2.65, 0);
  kioskRoof.castShadow = true;
  kioskGroup.add(kioskRoof);

  // Baskets of Bunga Tabur (Rose & Jasmine petals) and Air Mawar bottles on the counter
  for (const bx of [-0.7, 0.0]) {
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
    );
    basket.position.set(bx, 0.99, 0);
    kioskGroup.add(basket);

    const petals = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.06, 10),
      bx < 0 ? redPetalMat : whitePetalMat
    );
    petals.position.set(bx, 1.09, 0);
    kioskGroup.add(petals);
  }

  // Rose water bottles (Botol Air Mawar Ziarah)
  const bottleMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.85,
    roughness: 0.2,
  });
  for (let b = 0; b < 3; b++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8), bottleMat);
    bottle.position.set(0.6 + b * 0.2, 1.04, 0);
    kioskGroup.add(bottle);
  }

  group.add(kioskGroup);

  // 6. Warm Garden Lanterns flanking the central path
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
  });
  for (const [lx, lz] of [
    [-1.5, 4.5],
    [1.5, 4.5],
    [-1.5, -2.5],
    [1.5, -2.5],
  ]) {
    const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), ironFenceMat);
    lPost.position.set(lx, 0.95, lz);
    group.add(lPost);

    const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lanternGlowMat);
    lBulb.position.set(lx, 1.9, lz);
    group.add(lBulb);
  }

  return group;
}

/**
 * TPS 04 Kampung Nusantara (Tempat Pemungutan Suara Pemilu / Pilkada Warga)
 * Features:
 * - Festive Merah-Putih KPPS Canopy Tent (Tenda TPS Merah Putih)
 * - Official "TPS 04 KAMPUNG NUSANTARA" banner
 * - 3 Aluminum/Cardboard Voting Booths (Bilik Suara) on tables
 * - Transparent Ballot Box (Kotak Suara Transparan KPU) with yellow padlock
 * - KPPS Registration & Ink Table with iconic Botol Tinta Ungu (Purple Ink Bottle)
 * - DPT (Daftar Pemilih Tetap) announcement board & red/blue plastic waiting chairs
 */
export function createTPSPemilu(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TPS04KampungNusantara';

  // 1. Paved Platform Base (8.6m wide x 7.4m deep)
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.12, 7.4), baseMat);
  base.position.set(0, 0.06, 0);
  base.receiveShadow = true;
  group.add(base);

  // Green event carpet inside the TPS tent
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.04, 6.6),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 })
  );
  carpet.position.set(0, 0.13, 0);
  carpet.receiveShadow = true;
  group.add(carpet);

  // 2. Tent Steel Frame & Merah-Putih Striped Canopy Roof
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 });
  for (const [px, pz] of [
    [-3.8, -3.1],
    [3.8, -3.1],
    [-3.8, 3.1],
    [3.8, 3.1],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), poleMat);
    pole.position.set(px, 1.65, pz);
    pole.castShadow = true;
    group.add(pole);
  }

  // Red & White Valance Skirts around top of tent
  const redFabricMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 });
  const whiteFabricMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });

  const roofRed = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.35, 4), redFabricMat);
  roofRed.rotation.y = Math.PI / 4;
  roofRed.scale.set(1.05, 1.0, 0.9);
  roofRed.position.set(0, 3.85, 0);
  roofRed.castShadow = true;
  group.add(roofRed);

  const valanceWhite = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.32, 6.8), whiteFabricMat);
  valanceWhite.position.set(0, 3.15, 0);
  group.add(valanceWhite);

  // 3. Official TPS 04 Spanduk Banner at Front (+Z)
  const tpsSignTex = createTPSSignTexture(maxAnisotropy);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 1.25, 0.12),
    new THREE.MeshStandardMaterial({ map: tpsSignTex, roughness: 0.35 })
  );
  banner.position.set(0, 3.35, 3.42);
  group.add(banner);

  // Small Indonesian Merah Putih Flags on front tent corners
  for (const fx of [-3.9, 3.9]) {
    const flagStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), poleMat);
    flagStaff.position.set(fx, 2.8, 3.2);
    flagStaff.rotation.z = fx < 0 ? 0.25 : -0.25;
    group.add(flagStaff);

    const fRed = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.03), redFabricMat);
    fRed.position.set(fx + (fx < 0 ? -0.35 : 0.35), 3.55, 3.2);
    group.add(fRed);

    const fWhite = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.03), whiteFabricMat);
    fWhite.position.set(fx + (fx < 0 ? -0.35 : 0.35), 3.33, 3.2);
    group.add(fWhite);
  }

  // 4. Three Voting Booths (Bilik Suara) along the Back Row (z = -2.0)
  const tableClothMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.75 });
  const boothScreenMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
    metalness: 0.2,
  });
  const redAccentMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });

  for (const bx of [-2.2, 0, 2.2]) {
    const boothGroup = new THREE.Group();
    boothGroup.position.set(bx, 0.15, -2.0);

    // Table under voting booth
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.78, 0.85), tableClothMat);
    table.position.y = 0.39;
    table.castShadow = true;
    boothGroup.add(table);

    // 3-Sided Privacy Screen (Bilik Suara KPU)
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.05), boothScreenMat);
    backPanel.position.set(0, 1.25, -0.32);
    boothGroup.add(backPanel);

    const topStripe = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.06), redAccentMat);
    topStripe.position.set(0, 1.65, -0.32);
    boothGroup.add(topStripe);

    for (const sx of [-0.46, 0.46]) {
      const wingPanel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.65), boothScreenMat);
      wingPanel.position.set(sx, 1.25, 0);
      boothGroup.add(wingPanel);
    }

    // Nail & Cushion for punching paper ballot (Bantalan & Paku Coblos)
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.05, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 })
    );
    cushion.position.set(0, 0.81, 0);
    boothGroup.add(cushion);

    group.add(boothGroup);
  }

  // 5. Transparent Ballot Box Table (Kotak Suara Transparan) at Center-Right (x = 2.1, z = 0.4)
  const ballotTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.76, 0.9), tableClothMat);
  ballotTable.position.set(2.1, 0.53, 0.4);
  ballotTable.castShadow = true;
  group.add(ballotTable);

  for (const kx of [1.65, 2.55]) {
    const kotak = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.78, 0.62),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      })
    );
    kotak.position.set(kx, 1.3, 0.4);
    kotak.castShadow = true;
    group.add(kotak);

    // Ballot slot on top & yellow padlock on front
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    slot.position.set(kx, 1.7, 0.4);
    group.add(slot);

    const padlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    padlock.position.set(kx, 1.3, 0.73);
    group.add(padlock);
  }

  // 6. KPPS Registration & Purple Ink Table at Front-Left (x = -1.9, z = 1.2)
  const kppsTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.76, 0.95), tableClothMat);
  kppsTable.position.set(-1.9, 0.53, 1.2);
  kppsTable.castShadow = true;
  group.add(kppsTable);

  // Iconic Botol Tinta Ungu Pemilu (Purple Ink Bottle for dipping little finger!)
  const inkBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 0.24, 10),
    new THREE.MeshStandardMaterial({
      color: 0x7e22ce,
      emissive: 0x581c87,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    })
  );
  inkBottle.position.set(-1.15, 1.03, 1.35);
  group.add(inkBottle);

  // Stack of Ballot Papers (Surat Suara)
  const ballotStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.12, 0.35),
    whiteFabricMat
  );
  ballotStack.position.set(-2.1, 0.97, 1.2);
  group.add(ballotStack);

  // 7. Plastic Waiting Chairs for Voters (Kursi Plastik Kondangan Merah & Biru)
  const chairRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const chairBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 });
  for (let c = 0; c < 4; c++) {
    const cMat = c % 2 === 0 ? chairRedMat : chairBlueMat;
    const chairGroup = new THREE.Group();
    chairGroup.position.set(1.2 + (c % 2) * 0.95, 0.15, 1.7 + Math.floor(c / 2) * 0.95);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.46), cMat);
    seat.position.y = 0.21;
    chairGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.08), cMat);
    back.position.set(0, 0.62, 0.19);
    chairGroup.add(back);

    group.add(chairGroup);
  }

  // 8. Standing DPT (Daftar Pemilih Tetap) Board at Entrance Corner (-3.4, 0, 2.7)
  const dptBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 })
  );
  dptBoard.position.set(-3.3, 1.35, 2.65);
  dptBoard.rotation.y = 0.25;
  group.add(dptBoard);

  return group;
}

/**
 * TPS Lingkungan & Bank Sampah Warga (Tempat Penampungan Sementara Sampah RT/RW)
 * Features:
 * - Painted Yellow & Green Concrete Waste Bay (Bak Sampah Beton Lingkungan)
 * - 3 Color-Coded Sorted Bins (Hijau Organik, Kuning Anorganik, Merah B3)
 * - Iconic Indonesian Gerobak Sampah RT/RW (Blue & Yellow steel handcart with wheels)
 * - Official "TPS LINGKUNGAN & BANK SAMPAH" signboard
 */
export function createTPSSampahKampung(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TPSSampahKampung';

  // 1. Concrete Pad Base (6.6m wide x 4.8m deep)
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 0.14, 4.8),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 })
  );
  pad.position.set(0, 0.07, 0);
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Concrete Waste Enclosure Walls (Bak TPS Beton Hijau-Kuning)
  const greenWallMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
  const yellowTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.35, 0.26), greenWallMat);
  backWall.position.set(-1.1, 0.75, -1.5);
  backWall.castShadow = true;
  group.add(backWall);

  for (const sx of [-2.8, 0.6]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.35, 2.2), greenWallMat);
    sideWall.position.set(sx, 0.75, -0.5);
    sideWall.castShadow = true;
    group.add(sideWall);
  }

  const lowFrontLip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.48, 0.22), yellowTrimMat);
  lowFrontLip.position.set(-1.1, 0.35, 0.5);
  group.add(lowFrontLip);

  // Tied black & blue trash bags inside the concrete enclosure
  const blackBagMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const blueBagMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  for (let b = 0; b < 6; b++) {
    const bag = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.42, 1),
      b % 2 === 0 ? blackBagMat : blueBagMat
    );
    bag.position.set(
      -2.0 + (b % 3) * 0.85,
      0.48 + Math.floor(b / 3) * 0.35,
      -0.6 + (b % 2) * 0.45
    );
    bag.castShadow = true;
    group.add(bag);
  }

  // 3. Three Color-Coded Sorted Trash Bins (Tong Sampah Pilah 3 Warna: Organik, Anorganik, B3)
  const binConfigs: [number, number, number][] = [
    [-2.2, 1.45, 0x16a34a], // Hijau - Organik
    [-1.1, 1.45, 0xeab308], // Kuning - Anorganik
    [0.0, 1.45, 0xdc2626],  // Merah - B3
  ];
  for (const [bx, bz, bColor] of binConfigs) {
    const binMat = new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.45 });
    const binBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.88, 12), binMat);
    binBody.position.set(bx, 0.56, bz);
    binBody.castShadow = true;
    group.add(binBody);

    const binLid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12), binMat);
    binLid.position.set(bx, 1.04, bz);
    group.add(binLid);
  }

  // 4. Iconic Indonesian Gerobak Sampah RT/RW (Blue & Yellow Steel Garbage Cart) at Right (x = 1.85, z = 0.2)
  const cartGroup = new THREE.Group();
  cartGroup.position.set(1.85, 0.14, 0.2);
  cartGroup.rotation.y = -0.25;

  const cartBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55, metalness: 0.25 });
  const cartStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

  const cartBox = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.95, 2.1), cartBodyMat);
  cartBox.position.y = 0.82;
  cartBox.castShadow = true;
  cartGroup.add(cartBox);

  const cartStripe = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.24, 2.12), cartStripeMat);
  cartStripe.position.y = 0.92;
  cartGroup.add(cartStripe);

  // Two spoked rubber wheels on the sides
  for (const wx of [-0.76, 0.76]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, 0);
    cartGroup.add(wheel);
  }

  // Push handle bars in front (+Z)
  for (const hx of [-0.5, 0.5]) {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.95, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
    );
    handle.rotation.x = Math.PI / 2.2;
    handle.position.set(hx, 0.72, 1.45);
    cartGroup.add(handle);
  }

  group.add(cartGroup);

  // 5. Overhead Shelter Roof & Signboard ("TPS LINGKUNGAN & BANK SAMPAH")
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
  for (const px of [-2.8, 2.8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8), poleMat);
    pole.position.set(px, 1.5, -1.6);
    group.add(pole);
  }

  const signTex = createBankSampahSignTexture(maxAnisotropy);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.15, 0.14),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 })
  );
  signBoard.position.set(0, 2.65, -1.55);
  group.add(signBoard);

  return group;
}

/**
 * Rumah Pribadi Karakter Utama (Walk-in 3D Indonesian Safehouse)
 * Local coordinates (11.0m wide X [-5.5..+5.5] by 9.6m deep Z [-4.8..+4.8], front door at +Z):
 * - Cutaway Roof Group (`userData.roofGroup`) that automatically hides when player is inside
 * - Animated Front Wooden Door (`userData.doorPivot`) that swings open on enter/exit
 * - Bedroom Corner (local X: -3.2, Z: -2.2): Teak Bed, Mattress, Pillow, Guling (Bolster), Blanket & Warm Lamp
 * - Living Room (local X: -2.9, Z: 1.6): Plush Sofa, Coffee Table with Kopi & Pisang Goreng, Batik Rug & LED TV
 * - Dining & Kitchen Area (local X: 3.0, Z: -1.8): Dining Table, Chairs, Nasi Goreng & Tudung Saji, Kitchen Stove, Magic Com & Dispenser Galon
 */
export function createRumahKarakterUtama(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RumahPribadiKarakterUtama';

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3, // Warm Indonesian cream wall paint
    roughness: 0.72,
  });
  const PlinthMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
  });
  const tileFloorMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.08,
  });
  const teakMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.55,
  });
  const darkTeakMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.6,
  });

  // 1. Interior Ceramic Floor & Front Terrace Porch (y = 0.08 so player walks smoothly)
  const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.14, 9.6), tileFloorMat);
  mainFloor.position.set(0, 0.07, 0);
  mainFloor.receiveShadow = true;
  group.add(mainFloor);

  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.12, 2.2), PlinthMat);
  porchFloor.position.set(0, 0.06, 5.8);
  porchFloor.receiveShadow = true;
  group.add(porchFloor);

  // Welcome Doormat at Front Doorway (z = 5.0)
  const doormat = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.03, 0.95),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9 })
  );
  doormat.position.set(0, 0.13, 5.05);
  group.add(doormat);

  // Living Room Batik Carpet Rug
  const batikTex = createBatikFabricTexture(maxAnisotropy);
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.025, 3.4),
    new THREE.MeshStandardMaterial({ map: batikTex, roughness: 0.85 })
  );
  rug.position.set(-2.2, 0.145, 1.5);
  rug.receiveShadow = true;
  group.add(rug);

  // 2. Exterior & Interior Perimeter Walls (Height = 3.1m)
  const wallH = 3.1;
  // Back wall (-Z at z = -4.7)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(11.0, wallH, 0.24), wallMat);
  backWall.position.set(0, wallH / 2 + 0.07, -4.68);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Left wall (-X at x = -5.38) & Right wall (+X at x = +5.38)
  for (const sx of [-5.38, 5.38]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, wallH, 9.6), wallMat);
    sideWall.position.set(sx, wallH / 2 + 0.07, 0);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    group.add(sideWall);
  }

  // Front wall (+Z at z = +4.68) split into Left & Right wings leaving a 2.6m wide center doorway
  for (const fx of [-3.4, 3.4]) {
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, wallH, 0.24), wallMat);
    frontWing.position.set(fx, wallH / 2 + 0.07, 4.68);
    frontWing.castShadow = true;
    frontWing.receiveShadow = true;
    group.add(frontWing);

    // Front Glass Window with Wooden Frame on each wing
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.35, 0.28), teakMat);
    winFrame.position.set(fx, 1.75, 4.68);
    group.add(winFrame);

    const winGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.1, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.55,
        roughness: 0.15,
      })
    );
    winGlass.position.set(fx, 1.75, 4.68);
    group.add(winGlass);
  }

  // Doorway Top Lintel & Teak Door Frame
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 0.24), wallMat);
  lintel.position.set(0, 2.85, 4.68);
  group.add(lintel);

  for (const dx of [-1.25, 1.25]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.5, 0.3), darkTeakMat);
    jamb.position.set(dx, 1.32, 4.68);
    group.add(jamb);
  }

  // Animated Wooden Front Door (Pivoted at Left Jamb x = -1.2, z = 4.68)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-1.2, 0.14, 4.68);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.38, 0.1), teakMat);
  doorPanel.position.set(0.68, 1.19, 0);
  doorPanel.castShadow = true;
  doorPivot.add(doorPanel);

  // Brass door handle
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
  );
  handle.position.set(1.18, 1.15, 0.08);
  doorPivot.add(handle);
  // Start slightly open so player sees the inviting doorway
  doorPivot.rotation.y = -Math.PI * 0.42;
  group.add(doorPivot);

  // Front Porch Pillars supporting the terrace overhang
  for (const px of [-4.8, -1.8, 1.8, 4.8]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.28), darkTeakMat);
    pillar.position.set(px, 1.56, 6.6);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // 3. BEDROOM ZONE (Kamar Tidur — Local X: -3.4, Local Z: -2.5)
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-3.4, 0.14, -2.5);

  // Teak Bedframe & Headboard
  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.36, 2.7), darkTeakMat);
  bedBase.position.y = 0.18;
  bedBase.castShadow = true;
  bedGroup.add(bedBase);

  const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.15, 0.16), darkTeakMat);
  headboard.position.set(0, 0.58, -1.27);
  bedGroup.add(headboard);

  // Plush White Mattress
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.24, 2.45),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
  );
  mattress.position.set(0, 0.44, 0.05);
  bedGroup.add(mattress);

  // Cozy Blue Blanket covering lower 60% of bed
  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.26, 1.55),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
  );
  blanket.position.set(0, 0.45, 0.48);
  bedGroup.add(blanket);

  // Two White Pillows (Bantal)
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
  for (const px of [-0.52, 0.52]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.46), pillowMat);
    pillow.position.set(px, 0.6, -0.82);
    bedGroup.add(pillow);
  }

  // Iconic Indonesian Bolster Pillow (Guling!) in the middle of the bed
  const guling = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 1.45, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })
  );
  guling.rotation.x = Math.PI / 2;
  guling.position.set(0.15, 0.62, 0.15);
  bedGroup.add(guling);

  // Bedside Nightstand & Warm Lamp
  const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.65), teakMat);
  nightstand.position.set(1.58, 0.29, -0.95);
  bedGroup.add(nightstand);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.32, 10),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5,
    })
  );
  lampShade.position.set(1.58, 0.78, -0.95);
  bedGroup.add(lampShade);

  // Wooden Wardrobe (Lemari Pakaian Jati) next to bed
  const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.65), teakMat);
  wardrobe.position.set(2.55, 1.1, -0.95);
  wardrobe.castShadow = true;
  bedGroup.add(wardrobe);

  group.add(bedGroup);

  // 4. LIVING ROOM & SOFA ZONE (Ruang Tamu — Local X: -2.2, Local Z: +1.6)
  const sofaGroup = new THREE.Group();
  sofaGroup.position.set(-2.2, 0.14, 1.6);

  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.65 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });

  // 3-Seater Plush Sofa facing West (-X) toward the TV on the Left Wall
  const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 2.5), sofaMat);
  sofaSeat.position.set(0.55, 0.21, 0);
  sofaSeat.castShadow = true;
  sofaGroup.add(sofaSeat);

  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, 2.5), sofaMat);
  sofaBack.position.set(0.88, 0.44, 0);
  sofaBack.castShadow = true;
  sofaGroup.add(sofaBack);

  for (const az of [-1.18, 1.18]) {
    const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.62, 0.22), sofaMat);
    armrest.position.set(0.55, 0.31, az);
    sofaGroup.add(armrest);
  }

  // Throw Cushions on Sofa
  for (const cz of [-0.75, 0.75]) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.38), cushionMat);
    cushion.position.set(0.68, 0.56, cz);
    cushion.rotation.z = 0.2;
    sofaGroup.add(cushion);
  }

  // Wooden Coffee Table (Meja Tamu) with Kopi & Pisang Goreng
  const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 1.5), teakMat);
  coffeeTable.position.set(-0.65, 0.21, 0);
  coffeeTable.castShadow = true;
  sofaGroup.add(coffeeTable);

  const snackPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  snackPlate.position.set(-0.65, 0.44, -0.2);
  sofaGroup.add(snackPlate);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.06, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
  );
  mug.position.set(-0.65, 0.48, 0.3);
  sofaGroup.add(mug);

  // TV Media Console & Big LED TV mounted against West Wall (local X = -2.85 relative to sofaGroup -> -5.05)
  const tvStand = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 2.1), darkTeakMat);
  tvStand.position.set(-2.65, 0.29, 0);
  sofaGroup.add(tvStand);

  const tvFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.05, 1.85),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
  );
  tvFrame.position.set(-2.68, 1.18, 0);
  sofaGroup.add(tvFrame);

  const tvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.92, 1.72),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.15,
    })
  );
  tvScreen.position.set(-2.64, 1.18, 0);
  sofaGroup.add(tvScreen);

  group.add(sofaGroup);

  // 5. DINING TABLE & KITCHEN ZONE (Meja Makan & Dapur — Local X: +3.0, Local Z: -1.6)
  const diningGroup = new THREE.Group();
  diningGroup.position.set(3.0, 0.14, -1.6);

  // Teak Dining Table (2.1m x 1.3m)
  const dTableTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 2.1), teakMat);
  dTableTop.position.set(0, 0.76, 0);
  dTableTop.castShadow = true;
  diningGroup.add(dTableTop);

  for (const [lx, lz] of [
    [-0.58, -0.9],
    [0.58, -0.9],
    [-0.58, 0.9],
    [0.58, 0.9],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.76, 8), darkTeakMat);
    leg.position.set(lx, 0.38, lz);
    diningGroup.add(leg);
  }

  // Dining Chairs on West & East sides of the Dining Table
  for (const [cx, cz, rotY] of [
    [-0.95, -0.45, Math.PI / 2],
    [-0.95, 0.45, Math.PI / 2],
    [0.95, 0, -Math.PI / 2],
  ]) {
    const chair = new THREE.Group();
    chair.position.set(cx, 0, cz);
    chair.rotation.y = rotY;
    const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.48), darkTeakMat);
    cSeat.position.y = 0.22;
    chair.add(cSeat);
    const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.08), darkTeakMat);
    cBack.position.set(0, 0.66, -0.2);
    chair.add(cBack);
    diningGroup.add(chair);
  }

  // Plates of Nasi Goreng Rumahan & Colorful Tudung Saji (Woven Food Cover) on Dining Table
  const tudungSaji = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.26, 12),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
  );
  tudungSaji.position.set(0.1, 0.93, -0.35);
  diningGroup.add(tudungSaji);

  const foodPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  foodPlate.position.set(-0.22, 0.82, 0.45);
  diningGroup.add(foodPlate);

  const nasiGoreng = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  nasiGoreng.scale.set(1, 0.45, 1);
  nasiGoreng.position.set(-0.22, 0.86, 0.45);
  diningGroup.add(nasiGoreng);

  // Kitchen Counter along East Wall (local X = +1.85 relative to diningGroup -> +4.85)
  const kitchenCounter = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.88, 3.8),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 })
  );
  kitchenCounter.position.set(1.8, 0.44, 1.4);
  kitchenCounter.castShadow = true;
  diningGroup.add(kitchenCounter);

  // Magic Com (Red Rice Cooker) & Dispenser Galon Aqua
  const magicCom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 })
  );
  magicCom.position.set(1.8, 1.02, 0.3);
  diningGroup.add(magicCom);

  const dispenser = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.95, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  dispenser.position.set(1.8, 0.48, 3.6);
  diningGroup.add(dispenser);

  const aquaGalon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.48, 12),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
    })
  );
  aquaGalon.position.set(1.8, 1.18, 3.6);
  diningGroup.add(aquaGalon);

  group.add(diningGroup);

  // 6. Glowing Interactive Floor Rings inside the House (for Bed, Dining Table, Sofa & Door)
  const addActivityMarker = (mx: number, mz: number, hex: number) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 20),
      new THREE.MeshBasicMaterial({
        color: hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(mx, 0.16, mz);
    group.add(ring);
  };
  addActivityMarker(-2.1, -2.2, 0x38bdf8); // Bedside (Tidur)
  addActivityMarker(1.7, -1.6, 0x22c55e);  // Dining Table (Makan)
  addActivityMarker(-2.1, 1.6, 0xf59e0b);  // Sofa (Duduk)
  addActivityMarker(0, 4.1, 0xf43f5e);     // Front Door Inside (Keluar Rumah)

  // 7. Front Terrace Signboard & Tropical Potted Plants (Always Visible!)
  const houseSignTex = createRumahKarakterSignTexture(maxAnisotropy);
  const houseSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.15, 0.16),
    new THREE.MeshStandardMaterial({ map: houseSignTex, roughness: 0.35 })
  );
  houseSign.position.set(0, 3.45, 6.72);
  group.add(houseSign);

  for (const px of [-4.2, 4.2]) {
    const pot = createPotBungaKampung(px < 0 ? 'ember_cat' : 'gerabah');
    pot.position.set(px, 0.12, 6.2);
    group.add(pot);
  }

  // 8. Cutaway Pitched Terracotta Roof (`roofGroup` — automatically hides when player is inside!)
  const roofGroup = new THREE.Group();
  const gentengTex = createGentengClayTexture(maxAnisotropy);
  const gentengMat = new THREE.MeshStandardMaterial({
    map: gentengTex,
    roughness: 0.72,
    metalness: 0.08,
  });

  const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 2.8, 4), gentengMat);
  mainRoof.rotation.y = Math.PI / 4;
  mainRoof.scale.set(1.08, 1.0, 0.96);
  mainRoof.position.set(0, 4.5, 0);
  mainRoof.castShadow = true;
  roofGroup.add(mainRoof);

  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.25, 2.6), gentengMat);
  porchRoof.position.set(0, 3.1, 5.75);
  porchRoof.rotation.x = 0.12;
  porchRoof.castShadow = true;
  roofGroup.add(porchRoof);

  group.add(roofGroup);

  group.userData.roofGroup = roofGroup;
  group.userData.doorPivot = doorPivot;
  return group;
}

export type KucingCoatType = 'oyen' | 'calico' | 'hitam_putih' | 'abu';

export function createKucingKampung(coatType: KucingCoatType = 'oyen'): THREE.Group {
  const group = new THREE.Group();
  group.name = `KucingKampung_${coatType}`;

  const primaryHex =
    coatType === 'oyen'
      ? 0xf97316
      : coatType === 'calico'
      ? 0xf8fafc
      : coatType === 'hitam_putih'
      ? 0x1e293b
      : 0x64748b;

  const secondaryHex =
    coatType === 'oyen'
      ? 0xfdba74
      : coatType === 'calico'
      ? 0xea580c
      : coatType === 'hitam_putih'
      ? 0xf8fafc
      : 0x94a3b8;

  const furMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.78,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    roughness: 0.78,
  });
  const darkPatchMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.8,
  });
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    roughness: 0.5,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: coatType === 'oyen' ? 0x84cc16 : 0xfacc15,
    emissive: coatType === 'oyen' ? 0x4d7c0f : 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // 1. Torso (Badan Kucing)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.52), furMat);
  torso.position.set(0, 0.28, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Chest / Belly fur
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), secondaryMat);
  chest.position.set(0, 0.25, 0.18);
  bodyGroup.add(chest);

  // Calico / Tabby markings on back
  if (coatType === 'calico') {
    const patch1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.18), secondaryMat);
    patch1.position.set(0.01, 0.34, 0.08);
    bodyGroup.add(patch1);
    const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.18), darkPatchMat);
    patch2.position.set(-0.01, 0.34, -0.12);
    bodyGroup.add(patch2);
  } else if (coatType === 'oyen') {
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.8 });
    for (const sz of [-0.14, 0.0, 0.14]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.05), stripeMat);
      stripe.position.set(0, 0.36, sz);
      bodyGroup.add(stripe);
    }
  }

  // Cute Collar & Golden Bell (Kalung Lonceng Kucing)
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.05, 0.06),
    new THREE.MeshStandardMaterial({
      color: coatType === 'oyen' ? 0xdc2626 : 0x0284c7,
      roughness: 0.4,
    })
  );
  collar.position.set(0, 0.3, 0.24);
  bodyGroup.add(collar);

  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.2 })
  );
  bell.position.set(0, 0.24, 0.28);
  bodyGroup.add(bell);

  // 2. Head Pivot (Kepala, Telinga Lancip, Hidung Pink & Kumis)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.38, 0.28);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.21, 0.22), furMat);
  headMesh.position.set(0, 0.04, 0.04);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  // Muzzle / Snout
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), secondaryMat);
  muzzle.position.set(0, 0.0, 0.16);
  headPivot.add(muzzle);

  // Pink nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.03), pinkMat);
  nose.position.set(0, 0.03, 0.2);
  headPivot.add(nose);

  // Eyes & Pupils
  for (const ex of [-0.065, 0.065]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.02), eyeMat);
    eye.position.set(ex, 0.065, 0.15);
    headPivot.add(eye);

    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.038, 0.024), pupilMat);
    pupil.position.set(ex, 0.065, 0.153);
    headPivot.add(pupil);
  }

  // Pointy Cat Ears (Telinga Kucing)
  const earGeo = new THREE.ConeGeometry(0.055, 0.11, 4);
  const innerEarGeo = new THREE.ConeGeometry(0.032, 0.07, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, coatType === 'calico' && side > 0 ? darkPatchMat : furMat);
    ear.position.set(side * 0.075, 0.18, 0.03);
    ear.rotation.y = Math.PI / 4;
    ear.rotation.z = side * -0.15;
    headPivot.add(ear);

    const innerEar = new THREE.Mesh(innerEarGeo, pinkMat);
    innerEar.position.set(side * 0.075, 0.175, 0.045);
    innerEar.rotation.y = Math.PI / 4;
    innerEar.rotation.z = side * -0.15;
    headPivot.add(innerEar);
  }

  bodyGroup.add(headPivot);

  // 3. Articulated 4 Legs with Paws
  const makeLeg = (lx: number, lz: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.2, lz);

    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.2, 0.065), furMat);
    legMesh.position.set(0, -0.09, 0);
    legMesh.castShadow = true;
    pivot.add(legMesh);

    const pawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.045, 0.085), secondaryMat);
    pawMesh.position.set(0, -0.18, 0.01);
    pivot.add(pawMesh);

    group.add(pivot);
    return pivot;
  };

  const frontLeft = makeLeg(-0.075, 0.18);
  const frontRight = makeLeg(0.075, 0.18);
  const backLeft = makeLeg(-0.075, -0.18);
  const backRight = makeLeg(0.075, -0.18);

  // 4. Articulated Raised Tail (Ekor Kucing Melengkung)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.34, -0.25);

  const tailBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.032, 0.26, 7),
    coatType === 'calico' ? darkPatchMat : furMat
  );
  tailBase.position.set(0, 0.11, -0.05);
  tailBase.rotation.x = -0.45;
  tailPivot.add(tailBase);

  const tailTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.16, 7),
    secondaryMat
  );
  tailTip.position.set(0, 0.25, -0.09);
  tailTip.rotation.x = -0.15;
  tailPivot.add(tailTip);

  bodyGroup.add(tailPivot);

  group.scale.setScalar(1.18);

  group.userData.catParts = {
    bodyGroup,
    headPivot,
    tailPivot,
    frontLeft,
    frontRight,
    backLeft,
    backRight,
  };

  return group;
}

export type BurungVariant = 'merpati' | 'gereja' | 'elang';

export function createBurungTerbang(variant: BurungVariant = 'merpati'): THREE.Group {
  const group = new THREE.Group();
  group.name = `BurungTerbang_${variant}`;

  const bodyHex =
    variant === 'elang'
      ? 0x7c2d12 // Chestnut brown Elang Bondol
      : variant === 'merpati'
      ? 0x64748b // Slate grey Merpati
      : 0x78350f; // Warm brown Burung Gereja

  const breastHex =
    variant === 'elang'
      ? 0xf8fafc // White head & breast of Elang Bondol
      : variant === 'merpati'
      ? 0xcbd5e1
      : 0xd6d3d1;

  const wingTipHex =
    variant === 'elang'
      ? 0x1e293b
      : variant === 'merpati'
      ? 0x334155
      : 0x451a03;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    roughness: 0.65,
  });
  const breastMat = new THREE.MeshStandardMaterial({
    color: breastHex,
    roughness: 0.65,
  });
  const wingTipMat = new THREE.MeshStandardMaterial({
    color: wingTipHex,
    roughness: 0.7,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.4,
  });

  // 1. Streamlined Torso & Breast
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.48), bodyMat);
  body.castShadow = true;
  group.add(body);

  const breast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.28), breastMat);
  breast.position.set(0, -0.03, 0.14);
  group.add(breast);

  // 2. Head & Beak
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.15, 0.18),
    variant === 'elang' ? breastMat : bodyMat
  );
  head.position.set(0, 0.06, 0.28);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.05, 0.42);
  group.add(beak);

  // 3. Fanned Tail Feathers (Ekor Burung)
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 0.26),
    variant === 'elang' ? wingTipMat : bodyMat
  );
  tail.position.set(0, 0.01, -0.32);
  tail.rotation.x = 0.12;
  group.add(tail);

  // 4. Articulated Left & Right Wings (Sayap Kiri & Kanan)
  const createWing = (dir: -1 | 1) => {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(dir * 0.1, 0.03, 0.04);

    // Inner wing
    const innerWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.26), bodyMat);
    innerWing.position.set(dir * 0.21, 0, 0);
    innerWing.castShadow = true;
    wingPivot.add(innerWing);

    // Outer primary feathers
    const outerWing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.028, 0.2), wingTipMat);
    outerWing.position.set(dir * 0.56, 0, -0.03);
    outerWing.rotation.y = dir * -0.18;
    outerWing.castShadow = true;
    wingPivot.add(outerWing);

    group.add(wingPivot);
    return wingPivot;
  };

  const leftWing = createWing(-1);
  const rightWing = createWing(1);

  const scale = variant === 'elang' ? 1.45 : variant === 'merpati' ? 1.05 : 0.85;
  group.scale.setScalar(scale);

  group.userData.wings = {
    leftWing,
    rightWing,
  };

  return group;
}





