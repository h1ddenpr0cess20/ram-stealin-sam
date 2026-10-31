import { wallMaterial } from 'madness-engine/textures/town/textures';

/**
 * Distinct, walkable indoor raid maps. Geometry uses the Madness Engine's
 * painted town wall and floor textures; the returned bounds and obstacles
 * are shared by player collision and the NPC navigation grid.
 */
export function buildInteriorLevel(GFX, root, kind, townSurface) {
  const house = kind === 'HOUSE';
  const store = kind === 'STORE';
  const factory = kind === 'FACTORY';
  const width = house ? 26 : factory ? 40 : 36;
  const depth = house ? 24 : factory ? 34 : store ? 30 : 28;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallHeight = house ? 5.4 : factory ? 7.2 : store ? 5.9 : 6.4;
  const floorMaterial = house
    ? townSurface('plank', width, depth, '#a18465')
    : townSurface('concrete', width, depth, factory ? '#4e5b60' : store ? '#7c8589' : '#69747d');

  const materials = new Map();
  const wall = (texture, tint) => {
    const key = texture + ':' + tint;
    if (materials.has(key)) return materials.get(key);
    const source = wallMaterial(GFX, texture);
    const material = source.clone();
    material.vertexColors = false;
    material.color.set(tint);
    materials.set(key, material);
    return material;
  };
  const mat = {
    plaster: wall('stucco', house ? '#d6c5a4' : store ? '#b8bdba' : '#909ba4'),
    brick: wall('brick', house ? '#a56e58' : factory ? '#59666b' : '#7c858e'),
    timber: wall('timber', '#795b43'),
    metal: new GFX.MeshStandardMaterial({ color: '#35434b', roughness: 0.42, metalness: 0.72 }),
    darkMetal: new GFX.MeshStandardMaterial({ color: '#17232c', roughness: 0.35, metalness: 0.58 }),
    glass: new GFX.MeshPhysicalMaterial({
      color: house ? '#5b7d82' : '#7ba7b8', roughness: 0.16, metalness: 0.2,
      transparent: true, opacity: 0.68, clearcoat: 0.9,
    }),
    fabric: new GFX.MeshStandardMaterial({ color: house ? '#526b58' : '#384b5e', roughness: 0.94 }),
    paleFabric: new GFX.MeshStandardMaterial({ color: house ? '#b9aa8b' : '#9aa7b1', roughness: 0.92 }),
    wood: new GFX.MeshStandardMaterial({ color: '#8b6545', roughness: 0.82 }),
    woodDark: new GFX.MeshStandardMaterial({ color: '#46352b', roughness: 0.86 }),
    black: new GFX.MeshStandardMaterial({ color: '#111b22', roughness: 0.32, metalness: 0.55 }),
    screen: new GFX.MeshStandardMaterial({
      color: '#5dcbdf', emissive: '#176b89', emissiveIntensity: 1.2,
      roughness: 0.2, metalness: 0.16,
    }),
    warmGlow: new GFX.MeshStandardMaterial({
      color: '#ffcf82', emissive: '#c77d2f', emissiveIntensity: 1.5,
      roughness: 0.35,
    }),
    redGlow: new GFX.MeshStandardMaterial({
      color: '#ff675c', emissive: '#8e171b', emissiveIntensity: 1.1,
    }),
    greenGlow: new GFX.MeshStandardMaterial({
      color: '#a6ff52', emissive: '#4b9c17', emissiveIntensity: 1.3,
    }),
    rug: new GFX.MeshStandardMaterial({ color: house ? '#874a3f' : '#344d62', roughness: 0.98 }),
    // A solid, unlit floor is the guaranteed visual ground plane. It does not
    // depend on the painted texture canvas or the current interior lighting.
    floor: new GFX.MeshBasicMaterial({
      color: house ? '#8b704f' : factory ? '#59656a' : store ? '#858d91' : '#697983',
      side: GFX.DoubleSide,
    }),
    floorSeam: new GFX.MeshBasicMaterial({
      color: house ? '#624b36' : '#46545a',
      side: GFX.DoubleSide,
    }),
    trim: new GFX.MeshStandardMaterial({ color: '#b7a98b', roughness: 0.65 }),
  };

  const addBox = (x, y, z, w, h, d, material, castShadow = true) => {
    const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const addPlane = (x, z, w, d, y, material) => {
    const mesh = new GFX.Mesh(new GFX.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const addLightPanel = (x, z, colour = mat.warmGlow, w = 2.2) => {
    addBox(x, wallHeight - 0.42, z, w, 0.08, 0.48, mat.darkMetal, false);
    addBox(x, wallHeight - 0.35, z, w * 0.82, 0.045, 0.28, colour, false);
    lights.push({ x, y: wallHeight - 0.28, z, colour: house ? '#ffd39a' : '#c5e8ff', reach: house ? 11 : 14 });
  };

  const obstacles = [];
  const lights = [];
  const obstacle = (x, z, w, d, yaw = 0) => {
    obstacles.push({ x, z, yaw, halfW: w / 2, halfD: d / 2 });
  };
  const addComputer = (x, z, { tower = true } = {}) => {
    // A recognisable desktop setup: bright monitor, stand, keyboard, mouse,
    // ventilated tower case, fan ring and a row of status LEDs.
    addBox(x, 1.66, z - 0.34, 1.12, 0.92, 0.14, mat.black);
    addBox(x, 1.68, z - 0.255, 0.96, 0.72, 0.035, mat.screen, false);
    addBox(x, 1.16, z - 0.27, 0.16, 0.18, 0.16, mat.metal);
    addBox(x, 0.92, z + 0.24, 1.12, 0.055, 0.36, mat.black, false);
    for (let row = 0; row < 2; row++) for (let key = 0; key < 10; key++) {
      addBox(x - 0.46 + key * 0.102, 0.953, z + 0.12 + row * 0.12,
        0.065, 0.018, 0.065, mat.trim, false);
    }
    addBox(x + 0.74, 0.85, z - 0.02, 0.42, 0.86, 0.68, mat.darkMetal);
    addBox(x + 0.74, 0.87, z + 0.33, 0.31, 0.7, 0.035, mat.black, false);
    for (let i = 0; i < 3; i++) {
      addBox(x + 0.65 + i * 0.09, 0.58, z + 0.36, 0.035, 0.035, 0.018,
        i === 0 ? mat.greenGlow : mat.screen, false);
    }
    if (tower) {
      const fan = new GFX.Mesh(new GFX.TorusGeometry(0.115, 0.025, 8, 18), mat.metal);
      fan.position.set(x + 0.74, 0.87, z + 0.355);
      root.add(fan);
    }
  };

  // Floor, skirting and the four walls. The open roof keeps the interior
  // visible from the elevated third-person camera while the beams read as a ceiling.
  // Use a thin solid floor slab rather than relying only on a textured plane.
  // This remains visible even if a browser/GPU fails to upload a canvas texture.
  addBox(0, -0.08, 0, width, 0.16, depth, mat.floor, false);
  if (house) {
    for (let z = -halfD + 0.7; z < halfD; z += 1.45) {
      addBox(0, 0.008, z, width - 0.3, 0.012, 0.018, mat.floorSeam, false);
    }
  } else {
    for (let x = -halfW + 1; x < halfW; x += 3.5) {
      addBox(x, 0.008, 0, 0.018, 0.012, depth - 0.3, mat.floorSeam, false);
    }
    for (let z = -halfD + 1; z < halfD; z += 3.5) {
      addBox(0, 0.008, z, width - 0.3, 0.012, 0.018, mat.floorSeam, false);
    }
  }
  const sideMat = house || store ? mat.plaster : mat.brick;
  addBox(-halfW + 0.18, wallHeight / 2, 0, 0.36, wallHeight, depth, sideMat);
  addBox(halfW - 0.18, wallHeight / 2, 0, 0.36, wallHeight, depth, sideMat);
  addBox(0, wallHeight / 2, -halfD + 0.18, width, wallHeight, 0.36, sideMat);

  // Split front wall around a wide entrance; a lit lintel frames the way in.
  // Keep the entrance broad enough for the third-person camera to look
  // through it. The previous narrow opening put the camera behind a solid
  // front-wall segment, making the furnished interior appear like an empty lot.
  const doorGap = house ? 8 : 9;
  const frontWallWidth = halfW - doorGap / 2;
  const frontWallOffset = halfW / 2 + doorGap / 4;
  addBox(-frontWallOffset, wallHeight / 2, halfD - 0.18,
    frontWallWidth, wallHeight, 0.36, sideMat);
  addBox(frontWallOffset, wallHeight / 2, halfD - 0.18,
    frontWallWidth, wallHeight, 0.36, sideMat);
  addBox(0, wallHeight - 0.24, halfD - 0.18, doorGap, 0.48, 0.42, mat.trim);
  addBox(-doorGap / 2 - 0.13, 1.25, halfD - 0.48, 0.18, 2.5, 0.22, mat.woodDark);
  addBox(doorGap / 2 + 0.13, 1.25, halfD - 0.48, 0.18, 2.5, 0.22, mat.woodDark);
  addBox(doorGap / 2 - 0.24, 1.2, halfD - 0.56, 0.08, 2.25, 0.08, mat.wood);

  // Repeated ceiling beams and warm/blue fixtures create a clear indoor read.
  const beamCount = house ? 5 : 7;
  for (let i = 0; i < beamCount; i++) {
    const z = -halfD + 2 + i * (depth - 4) / (beamCount - 1);
    addBox(0, wallHeight - 0.12, z, width - 0.6, 0.22, 0.28, mat.darkMetal);
  }
  if (house) {
    addLightPanel(-7, 5.5);
    addLightPanel(7, 5.5);
    addLightPanel(0, -5.5);
    addLightPanel(0, 1.3, mat.warmGlow, 1.5);
  } else {
    const fixtureXs = factory ? [-14, -7, 0, 7, 14] : store ? [-12, -4, 4, 12] : [-12, -4, 4, 12];
    for (const x of fixtureXs) {
      addLightPanel(x, -8, factory ? mat.warmGlow : mat.screen, 2.8);
      addLightPanel(x, 3, factory ? mat.warmGlow : mat.screen, 2.8);
    }
  }

  const glassStrip = house ? '#52747b' : '#6f9eaf';
  const windowMat = new GFX.MeshPhysicalMaterial({
    color: glassStrip, roughness: 0.13, metalness: 0.25,
    transparent: true, opacity: 0.48, clearcoat: 1,
  });
  for (const x of (house ? [-8, 8] : [-13, -7, 0, 7, 13])) {
    addBox(x, 2.9, -halfD + 0.36, house ? 3.2 : 4.1, 2.1, 0.05, windowMat, false);
    addBox(x, 2.9, halfD - 0.38, house ? 2.5 : 3.5, 2.0, 0.05, windowMat, false);
  }

  const properties = [];
  if (house) {
    // Someone's lived-in home: lounge, kitchen, dining nook and bedrooms.
    addPlane(0, 2.0, 13.5, 8.2, 0.035, mat.rug);
    addPlane(-7.8, -7.5, 9.2, 7.4, 0.036, mat.rug);
    addPlane(7.8, -7.5, 9.2, 7.4, 0.036, mat.paleFabric);

    // Living room couch and coffee table.
    addBox(0, 0.48, 4.0, 5.4, 0.72, 1.35, mat.fabric);
    addBox(0, 1.0, 4.48, 5.3, 0.9, 0.42, mat.fabric);
    addBox(-2.65, 0.76, 4.0, 0.35, 1.1, 1.35, mat.paleFabric);
    addBox(2.65, 0.76, 4.0, 0.35, 1.1, 1.35, mat.paleFabric);
    obstacle(0, 4.0, 5.8, 1.55);
    addBox(0, 0.56, 1.0, 2.6, 0.16, 1.35, mat.wood);
    addBox(0, 0.72, 1.0, 2.35, 0.12, 1.12, mat.woodDark);
    obstacle(0, 1.0, 2.8, 1.5);

    // Kitchen at the west end: cabinets, counter, fridge and range.
    for (const z of [-8.4, -5.8]) {
      addBox(-11.2, 1.25, z, 2.6, 2.5, 1.1, mat.woodDark);
      addBox(-11.2, 2.55, z, 2.72, 0.12, 1.2, mat.trim);
      obstacle(-11.2, z, 2.8, 1.2);
    }
    addBox(-9.2, 1.15, -9.6, 1.55, 2.3, 1.5, mat.glass);
    addBox(-9.2, 2.34, -9.6, 1.65, 0.15, 1.6, mat.trim);
    addBox(-10.8, 0.22, -3.9, 2.4, 0.44, 0.9, mat.wood);
    obstacle(-10.8, -3.9, 2.5, 1.0);

    // Bedroom furniture on the east side.
    addBox(8.0, 0.42, -8.7, 4.6, 0.62, 3.1, mat.woodDark);
    addBox(8.0, 0.8, -8.7, 4.3, 0.18, 2.85, mat.paleFabric);
    addBox(8.0, 1.22, -9.65, 4.0, 0.7, 0.18, mat.fabric);
    obstacle(8.0, -8.7, 4.8, 3.3);
    for (const x of [5.0, 11.0]) {
      addBox(x, 0.48, -5.2, 1.15, 0.9, 1.1, mat.wood);
      obstacle(x, -5.2, 1.2, 1.15);
    }

    // A low interior partition separates rooms without creating dead ends.
    addBox(-2.0, 1.35, -8.9, 0.28, 2.7, 5.0, mat.brick);
    addBox(2.0, 1.35, -8.9, 0.28, 2.7, 5.0, mat.brick);
    obstacle(-2.0, -8.9, 0.42, 5.0);
    obstacle(2.0, -8.9, 0.42, 5.0);

    // Two high-value computer stashes, each reachable from the central aisle.
    for (const x of [-7.5, 7.5]) {
      addBox(x, 0.78, -4.3, 2.5, 0.12, 1.05, mat.wood);
      addComputer(x, -4.3);
      properties.push({
        id: properties.length, type: 'computer', label: x < 0 ? 'HOME OFFICE COMPUTER' : 'BEDROOM GAMING COMPUTER',
        kind: 'HOUSE', baseLoot: 12, loot: 12, x, z: -4.3, yaw: 0,
        halfW: 1.25, halfD: 0.62, doorX: x, doorZ: -2.45, raided: false,
      });
    }
    obstacle(-7.5, -4.3, 2.55, 1.18);
    obstacle(7.5, -4.3, 2.55, 1.18);

    // Domestic clutter and framed photographs make the house feel occupied.
    addBox(0, 1.9, -11.1, 3.8, 0.12, 0.08, mat.woodDark);
    for (const x of [-1.1, 1.1]) {
      addBox(x, 2.5, -11.08, 0.72, 0.88, 0.08, mat.trim, false);
      addBox(x, 2.5, -11.01, 0.54, 0.68, 0.035, mat.fabric, false);
    }
  } else if (store) {
    // Neon-lit electronics shop: retail aisles, boxed hardware, demo islands
    // and six independent PC displays that can be hacked for RAM.
    addBox(0, 3.45, -13.55, 22, 0.75, 0.38, mat.darkMetal);
    addBox(0, 3.48, -13.31, 19, 0.42, 0.08, mat.screen, false);
    addBox(0, 4.12, -13.31, 12, 0.1, 0.08, mat.trim, false);
    for (const x of [-10, -6, -2, 2, 6, 10]) addBox(x, 2.9, -13.18, 0.42, 0.14, 0.04, mat.warmGlow, false);
    addPlane(0, 9.6, 25, 3.2, 0.04, mat.rug);

    // Lit perimeter shelves display consoles, graphics cards and boxed PCs.
    for (const x of [-14, 14]) {
      for (const z of [-7, 0, 7]) {
        addBox(x, 1.25, z, 1.5, 2.5, 2.8, mat.darkMetal);
        for (const y of [0.65, 1.35, 2.05]) {
          addBox(x + (x < 0 ? 0.79 : -0.79), y, z, 0.08, 0.08, 2.65, mat.trim, false);
        }
        for (let i = 0; i < 3; i++) {
          const box = addBox(x + (x < 0 ? 0.88 : -0.88), 0.92 + i * 0.55, z - 0.75 + i * 0.65,
            0.32, 0.38, 0.48, i % 2 ? mat.glass : mat.fabric);
          box.rotation.y = 0.08 * i;
        }
        obstacle(x, z, 1.75, 2.95);
      }
    }

    // Central gaming stations leave an aisle to the checkout and exit pad.
    for (const [x, z] of [[-8.5, 7], [8.5, 7]]) {
      addBox(x, 0.88, z, 3.2, 1.75, 1.15, mat.woodDark);
      addBox(x, 1.82, z, 3.0, 0.12, 1.05, mat.metal);
      for (let i = 0; i < 3; i++) addBox(x - 0.8 + i * 0.8, 2.08, z - 0.3, 0.55, 0.38, 0.12, mat.screen, false);
      obstacle(x, z, 3.35, 1.3);
    }

    const demos = [
      [-8.5, -7], [0, -7], [8.5, -7],
      [-8.5, 1.0], [0, 1.0], [8.5, 1.0],
    ];
    for (let i = 0; i < demos.length; i++) {
      const [x, z] = demos[i];
      addBox(x, 0.76, z, 2.45, 0.12, 1.0, mat.wood);
      addComputer(x, z);
      obstacle(x, z, 2.55, 1.12);
      properties.push({
        id: properties.length, type: 'computer', label: ['GRAPHICS PC DISPLAY', 'CUSTOM GAMING RIG', 'STREAMING PC DEMO', 'WORKSTATION DISPLAY', 'LIQUID-COOLED PC', 'HIGH-END GAMING PC'][i],
        kind: 'STORE', baseLoot: 6, loot: 6, x, z, yaw: 0,
        halfW: 1.28, halfD: 0.56, doorX: x, doorZ: z + 1.55,
        screenX: x, screenY: 1.68, screenZ: z - 0.255, raided: false,
      });
    }

    // Checkout counter and glass entrance.
    addBox(0, 0.72, 10.5, 7.5, 1.3, 1.1, mat.darkMetal);
    addBox(0, 1.42, 10.5, 7.7, 0.12, 1.2, mat.trim);
    addBox(-3.6, 2.15, 10.5, 0.08, 1.1, 0.08, mat.screen, false);
    addBox(3.6, 2.15, 10.5, 0.08, 1.1, 0.08, mat.screen, false);
    obstacle(0, 10.5, 7.7, 1.25);

  } else if (factory) {
    // RAM fabrication floor: conveyor belts, robotic presses, component bins,
    // cooling pipes and four production terminals guarding memory output.
    for (const z of [-2.5, 3.8]) {
      addBox(0, 0.38, z, 33, 0.58, 2.4, mat.darkMetal);
      addBox(0, 0.73, z, 32.6, 0.12, 2.1, mat.metal);
      for (let x = -15; x <= 15; x += 1.5) {
        const roller = new GFX.Mesh(new GFX.CylinderGeometry(0.12, 0.12, 2.25, 10), mat.black);
        roller.rotation.z = Math.PI / 2; roller.position.set(x, 0.48, z); root.add(roller);
      }
      for (let x = -14; x <= 14; x += 2.8) {
        addBox(x, 0.84, z, 0.9, 0.12, 0.72, mat.rug, false);
        addBox(x, 1.0, z, 0.68, 0.18, 0.5, mat.greenGlow, false);
      }
      obstacle(0, z, 33.5, 2.55);
    }

    // Robotic memory presses and component silos line both sides of the floor.
    for (const x of [-16, 16]) {
      for (const z of [-9, -2, 5, 11]) {
        addBox(x, 1.6, z, 2.35, 3.2, 2.4, mat.darkMetal);
        addBox(x, 3.35, z, 2.55, 0.18, 2.65, mat.metal);
        addBox(x, 1.9, z + 1.23, 1.55, 0.85, 0.07, mat.black, false);
        addBox(x, 1.92, z + 1.28, 1.28, 0.62, 0.035, mat.redGlow, false);
        for (const side of [-0.72, 0.72]) addBox(x + side, 0.55, z + 1.28, 0.12, 1.05, 0.08, mat.trim, false);
        obstacle(x, z, 2.6, 2.65);
      }
    }

    // Four terminals control the RAM presses and reward a full factory sweep.
    for (let i = 0; i < 4; i++) {
      const x = -12 + i * 8;
      const z = -11.0;
      addBox(x, 0.8, z, 2.7, 0.16, 1.0, mat.metal);
      addComputer(x, z, { tower: false });
      obstacle(x, z, 2.8, 1.15);
      properties.push({
        id: properties.length, type: 'factory-terminal', label: 'RAM PRESS TERMINAL ' + String(i + 1).padStart(2, '0'),
        kind: 'FACTORY', baseLoot: 9, loot: 9, x, z, yaw: 0,
        halfW: 1.4, halfD: 0.58, doorX: x, doorZ: z + 1.68,
        screenX: x, screenY: 1.68, screenZ: z - 0.255, raided: false,
      });
    }

    // Overhead conduits and a control gantry give the factory scale.
    for (const x of [-18, -9, 0, 9, 18]) {
      addBox(x, 6.55, 0, 0.22, 0.25, 30, mat.metal);
      addBox(x, 5.6, 0, 0.12, 0.12, 30, mat.trim, false);
    }
    addBox(0, 6.5, -15.55, 30, 0.3, 0.25, mat.darkMetal);

  } else {
    // Glass-and-steel tower office: reception, cubicles and a server bay.
    addPlane(0, 8.0, 15.5, 5.2, 0.04, mat.rug);
    addBox(0, 0.72, 9.0, 7.2, 1.3, 1.65, mat.darkMetal);
    addBox(0, 1.42, 9.0, 7.4, 0.15, 1.8, mat.metal);
    addBox(0, 1.2, 8.12, 4.8, 0.62, 0.08, mat.glass);
    obstacle(0, 9.0, 7.6, 2.0);

    // Server racks at the back. Blue status bars and red alarm lights animate the silhouette.
    for (const x of [-10.5, 0, 10.5]) {
      addBox(x, 1.8, -7.6, 2.5, 3.6, 1.4, mat.darkMetal);
      addBox(x, 1.95, -6.85, 2.15, 3.1, 0.08, mat.black);
      for (let row = 0; row < 5; row++) {
        const y = 0.68 + row * 0.56;
        addBox(x - 0.62, y, -6.77, 0.12, 0.12, 0.035, mat.screen, false);
        addBox(x - 0.25, y, -6.77, 0.12, 0.12, 0.035, mat.redGlow, false);
        addBox(x + 0.26, y, -6.77, 0.12, 0.12, 0.035, mat.greenGlow, false);
      }
      obstacle(x, -7.6, 2.7, 1.55);
    }

    // Workstations and glass dividers; aisles stay open for crowd movement.
    for (const x of [-12.5, -5.0, 5.0, 12.5]) {
      for (const z of [-2.0, 3.0]) {
        addBox(x, 0.68, z, 3.2, 0.12, 1.35, mat.woodDark);
        addBox(x - 1.65, 0.9, z, 0.08, 1.5, 1.45, mat.glass, false);
        obstacle(x, z, 3.35, 1.5);
      }
    }
    // Six computers are tucked into different office pods; each contains a
    // small stash, so the player must search the floor instead of looting racks.
    const searchable = [
      [-12.5, -2.0], [-5.0, -2.0], [5.0, -2.0], [12.5, -2.0],
      [-5.0, 3.0], [5.0, 3.0],
    ];
    for (const [index, [x, z]] of searchable.entries()) {
      addComputer(x, z);
      properties.push({
        id: properties.length, type: 'computer', label: 'OFFICE COMPUTER ' + String(index + 1).padStart(2, '0'),
        kind: 'TOWER', baseLoot: 6, loot: 6, x, z, yaw: 0,
        halfW: 1.28, halfD: 0.56, doorX: x, doorZ: z + 1.72,
        screenX: x, screenY: 1.68, screenZ: z - 0.255, raided: false,
      });
    }

    // Structural columns, elevator banks and a long glass wall overlooking the city.
    for (const x of [-16, -8, 8, 16]) {
      addBox(x, 3.05, 0, 0.65, 6.1, 0.65, mat.metal);
      obstacle(x, 0, 0.82, 0.82);
    }
    for (const x of [-6.5, -3.25, 0, 3.25, 6.5]) {
      addBox(x, 2.8, 13.25, 2.9, 5.6, 0.22, mat.darkMetal);
      addBox(x, 2.8, 13.12, 2.6, 5.25, 0.06, mat.glass, false);
    }
    addBox(0, 4.4, -13.55, 24, 0.16, 0.3, mat.trim);
  }

  // Small illuminated exit pad. It replaces the outdoor van while preserving
  // the carry-and-fence loop in an indoor map.
  // Enter at the front and extract at the opposite end of the building.
  // Start/exit separation makes each interior a real raid route rather than
  // placing Sam directly on top of the extraction pad.
  const exit = house ? { x: 0, z: -10.0 } : factory ? { x: 0, z: -14.6 } : store ? { x: 0, z: -12.6 } : { x: 0, z: -11.6 };
  const start = house ? { x: 0, z: 9.1 } : factory ? { x: 0, z: 14.1 } : store ? { x: 0, z: 12.1 } : { x: 0, z: 11.1 };
  addPlane(exit.x, exit.z, 2.8, 2.8, 0.045, mat.greenGlow);
  const ring = new GFX.Mesh(new GFX.TorusGeometry(1.25, 0.075, 10, 48), mat.greenGlow);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(exit.x, 0.09, exit.z);
  root.add(ring);
  addBox(exit.x, 0.12, exit.z, 1.0, 0.14, 1.0, mat.darkMetal);

  const spawnPoints = house ? [
    [-11, 9], [-8, 8], [-5, 9], [5, 9], [8, 8], [11, 9],
    [-11, 4], [-8, 4], [-4, 5], [4, 5], [8, 4], [11, 4],
    [-11, -1], [-5, -1], [5, -1], [11, -1],
    [-10, -8], [-6, -9], [6, -9], [10, -8], [-2, -8], [2, -8],
    [-11, -5], [11, -5],
  ] : [
    [-16, 11], [-12, 11], [-8, 11], [-4, 11], [4, 11], [8, 11], [12, 11], [16, 11],
    [-16, 6], [-11, 6], [-5, 6], [5, 6], [11, 6], [16, 6],
    [-16, 0], [-11, -3], [-5, 0], [5, 0], [11, -3], [16, 0],
    [-15, -7], [-6, -6], [6, -6], [15, -7],
  ];

  return {
    bounds: house
      ? { minX: -12.7, maxX: 12.7, minZ: -11.7, maxZ: 11.7 }
      : factory
        ? { minX: -19.7, maxX: 19.7, minZ: -16.7, maxZ: 16.7 }
        : store
          ? { minX: -17.7, maxX: 17.7, minZ: -14.7, maxZ: 14.7 }
          : { minX: -17.7, maxX: 17.7, minZ: -13.7, maxZ: 13.7 },
    obstacles,
    properties,
    spawnPoints,
    start,
    exit,
    lights,
    radar: { horizontal: [], vertical: [] },
    areaName: house ? 'THE HOUSE' : store ? 'ELECTRONICS STORE' : factory ? 'RAM FACTORY' : 'OFFICE TOWER',
  };
}
