/**
 * Binary Space Partitioning (BSP) & Multi-Floor Layout Generator
 * Handles multi-level (1-4 floors), Duplex vs Normal house modes, Door/Window positioning, and Main Entrance placement.
 */

const ROOM_SPECS = {
  master_bedroom: { name: "Master Bedroom", minArea: 120, maxArea: 240, minWidth: 10, color: "#4f46e5", icon: "🛏️" },
  bedroom:        { name: "Bedroom",        minArea: 90,  maxArea: 160, minWidth: 9,  color: "#6366f1", icon: "🛏️" },
  living_room:    { name: "Living Room",    minArea: 140, maxArea: 320, minWidth: 11, color: "#0ea5e9", icon: "🛋️" },
  dining:         { name: "Dining Area",    minArea: 70,  maxArea: 140, minWidth: 8,  color: "#ec4899", icon: "🍽️" },
  kitchen:        { name: "Kitchen",        minArea: 65,  maxArea: 130, minWidth: 7,  color: "#f59e0b", icon: "🍳" },
  bathroom:       { name: "Bathroom",       minArea: 30,  maxArea: 60,  minWidth: 5,  color: "#10b981", icon: "🚿" },
  parking:        { name: "Car Parking",    minArea: 120, maxArea: 220, minWidth: 10, color: "#64748b", icon: "🚗" },
  staircase:      { name: "Staircase / Lift",minArea: 80,  maxArea: 120, minWidth: 8,  color: "#8b5cf6", icon: "🪜" },
  duplex_void:    { name: "Duplex Void",    minArea: 100, maxArea: 200, minWidth: 9,  color: "#0284c7", icon: "🌌" },
  hallway:        { name: "Corridor / Hall",minArea: 35,  maxArea: 100, minWidth: 4,  color: "#334155", icon: "🚶" }
};

class BSPNode {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.leftChild = null;
    this.rightChild = null;
    this.room = null;
  }

  get area() {
    return this.width * this.height;
  }

  isLeaf() {
    return !this.leftChild && !this.rightChild;
  }

  split(minDimension = 5, splitRatio = 0.5) {
    if (!this.isLeaf()) return false;

    let splitH = Math.random() > 0.5;
    if (this.width / this.height > 1.4) splitH = false;
    else if (this.height / this.width > 1.4) splitH = true;

    const max = (splitH ? this.height : this.width) - minDimension;
    if (max <= minDimension) return false;

    const clampedRatio = Math.max(0.35, Math.min(0.65, splitRatio));

    if (splitH) {
      const splitPos = Math.round(this.height * clampedRatio);
      this.leftChild = new BSPNode(this.x, this.y, this.width, splitPos);
      this.rightChild = new BSPNode(this.x, this.y + splitPos, this.width, this.height - splitPos);
    } else {
      const splitPos = Math.round(this.width * clampedRatio);
      this.leftChild = new BSPNode(this.x, this.y, splitPos, this.height);
      this.rightChild = new BSPNode(this.x + splitPos, this.y, this.width - splitPos, this.height);
    }
    return true;
  }

  getLeaves() {
    if (this.isLeaf()) return [this];
    return [...this.leftChild.getLeaves(), ...this.rightChild.getLeaves()];
  }
}

/**
 * Generate Multi-Floor (1 to 4 floors) House Plans with Doors & Windows
 */
function generateMultiFloorPlan(plotLength, plotWidth, setbacks, roomReqs, config = {}) {
  const numFloors = config.numFloors || 1;
  const houseType = config.houseType || 'normal'; // 'normal' or 'duplex'
  const northOrient = config.northOrient || 'NE';

  const floors = [];

  // Always include staircase if > 1 floor
  const hasStaircase = numFloors > 1;

  for (let f = 0; f < numFloors; f++) {
    const floorLabel = f === 0 ? "Ground Floor" : `${f}st Floor`;
    const floorCode = f === 0 ? "GF" : `${f}F`;

    // Filter rooms for this floor
    let floorRooms = [];
    if (f === 0) {
      // Ground Floor: Living, Kitchen, Dining, Parking, Master Bed 1, Staircase
      floorRooms = roomReqs.filter(r => ['living_room', 'kitchen', 'dining', 'parking', 'master_bedroom'].includes(r.type));
      if (floorRooms.length === 0) floorRooms = [...roomReqs];
      if (hasStaircase && !floorRooms.some(r => r.type === 'staircase')) {
        floorRooms.push({ id: 'stair_0', type: 'staircase', name: 'Staircase / Lift' });
      }
    } else {
      // Upper Floors: Bedrooms, Bathrooms, Lounge, Duplex Void if duplex
      floorRooms = roomReqs.filter(r => ['bedroom', 'bathroom', 'master_bedroom'].includes(r.type));
      if (floorRooms.length < 2) {
        floorRooms.push({ id: `bed_u_${f}`, type: 'bedroom', name: `Bedroom ${f + 1}` });
        floorRooms.push({ id: `bath_u_${f}`, type: 'bathroom', name: `Bathroom ${f + 1}` });
      }
      if (hasStaircase && !floorRooms.some(r => r.type === 'staircase')) {
        floorRooms.push({ id: `stair_${f}`, type: 'staircase', name: 'Staircase / Lift' });
      }
      if (houseType === 'duplex') {
        floorRooms.push({ id: `void_${f}`, type: 'duplex_void', name: 'Open Duplex Void' });
      }
    }

    const singleFloorPlan = generateBSPFloorPlan(plotLength, plotWidth, setbacks, floorRooms, config.seedRatios || []);
    singleFloorPlan.floorCode = floorCode;
    singleFloorPlan.floorLabel = floorLabel;

    // Calculate Doors & Windows for rooms
    calculateDoorsAndWindows(singleFloorPlan, f === 0, northOrient);
    floors.push(singleFloorPlan);
  }

  return {
    numFloors,
    houseType,
    plotWidth,
    plotLength,
    setbacks,
    floors,
    activeFloorIndex: 0
  };
}

/**
 * Single Floor BSP Division
 */
function generateBSPFloorPlan(plotLength, plotWidth, setbacks, roomList, seedRatios = []) {
  const buildableX = setbacks.side;
  const buildableY = setbacks.front;
  const buildableWidth = Math.max(15, plotWidth - (setbacks.side * 2));
  const buildableHeight = Math.max(15, plotLength - setbacks.front - setbacks.rear);

  const root = new BSPNode(buildableX, buildableY, buildableWidth, buildableHeight);
  let leaves = [root];
  let ratioIdx = 0;

  let safetyLoop = 0;
  while (leaves.length < roomList.length && safetyLoop < 40) {
    safetyLoop++;
    leaves.sort((a, b) => b.area - a.area);
    const candidate = leaves[0];
    const ratio = seedRatios[ratioIdx % seedRatios.length] || (0.4 + Math.random() * 0.2);
    ratioIdx++;

    if (candidate.split(5, ratio)) {
      leaves = root.getLeaves();
    } else {
      break;
    }
  }

  leaves.sort((a, b) => b.area - a.area);
  const sortedRooms = [...roomList].sort((a, b) => {
    const areaA = ROOM_SPECS[a.type]?.minArea || 50;
    const areaB = ROOM_SPECS[b.type]?.minArea || 50;
    return areaB - areaA;
  });

  const rooms = [];
  leaves.forEach((leaf, idx) => {
    const rMeta = sortedRooms[idx] || { id: `room_${idx}`, type: "hallway", name: "Corridor" };
    const spec = ROOM_SPECS[rMeta.type] || ROOM_SPECS.hallway;

    const roomObj = {
      id: rMeta.id || `room_${idx}`,
      type: rMeta.type,
      name: rMeta.name || spec.name,
      x: leaf.x,
      y: leaf.y,
      width: leaf.width,
      height: leaf.height,
      color: spec.color,
      icon: spec.icon,
      doors: [],
      windows: []
    };
    leaf.room = roomObj;
    rooms.push(roomObj);
  });

  return {
    plotWidth,
    plotLength,
    buildableBox: { x: buildableX, y: buildableY, width: buildableWidth, height: buildableHeight },
    rooms,
    bspTree: root
  };
}

/**
 * Calculate Main Entrance, Internal Doors, and Windows Placement
 */
function calculateDoorsAndWindows(floorPlan, isGroundFloor, northOrient = 'NE') {
  const box = floorPlan.buildableBox;
  const rooms = floorPlan.rooms;

  // 1. Calculate Main Entrance on Ground Floor
  if (isGroundFloor) {
    const living = rooms.find(r => r.type === 'living_room') || rooms[0];
    floorPlan.mainEntrance = {
      x: living.x + living.width / 2,
      y: living.y, // Facing North/Front
      width: 4.5,
      orientation: northOrient
    };
  }

  // 2. Add Internal Doors & Windows per room
  rooms.forEach(r => {
    // Door connecting room to center/corridor
    r.doors.push({
      x: r.x + Math.min(3, r.width / 2),
      y: r.y + r.height,
      width: 3,
      swing: 'inward'
    });

    // Windows on exterior walls
    const touchesTop = Math.abs(r.y - box.y) < 0.5;
    const touchesBottom = Math.abs((r.y + r.height) - (box.y + box.height)) < 0.5;
    const touchesLeft = Math.abs(r.x - box.x) < 0.5;
    const touchesRight = Math.abs((r.x + r.width) - (box.x + box.width)) < 0.5;

    if (touchesTop) r.windows.push({ x: r.x + r.width / 2, y: r.y, length: 4, wall: 'top' });
    if (touchesBottom) r.windows.push({ x: r.x + r.width / 2, y: r.y + r.height, length: 4, wall: 'bottom' });
    if (touchesLeft) r.windows.push({ x: r.x, y: r.y + r.height / 2, length: 4, wall: 'left' });
    if (touchesRight) r.windows.push({ x: r.x + r.width, y: r.y + r.height / 2, length: 4, wall: 'right' });
  });
}
