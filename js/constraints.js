/**
 * Architectural Constraints & Vastu Shastra Evaluator
 * Checks room sizing norms, graph connectivity (reachability), adjacency, and Vastu rules.
 */

// Vastu Ideal Quadrant Preferences relative to plot center (N, S, E, W, NE, SE, SW, NW)
const VASTU_PREFERENCES = {
  kitchen:        ["SE", "E"],
  master_bedroom: ["SW", "S"],
  bedroom:        ["NW", "W", "S"],
  living_room:    ["NE", "N", "E"],
  dining:         ["E", "W", "SE"],
  bathroom:       ["NW", "W", "S"],
  parking:        ["SE", "NW", "N"],
  entrance:       ["N", "E", "NE"]
};

// Adjacency Matrix Rules (Preferred Neighbor Types)
const ADJACENCY_PREFERENCES = {
  kitchen:        ["dining", "living_room"],
  master_bedroom: ["bathroom"],
  bedroom:        ["bathroom"],
  dining:         ["kitchen", "living_room"],
  bathroom:       ["master_bedroom", "bedroom"]
};

/**
 * Determine quadrant relative to plot center (X: East-West, Y: North-South)
 */
function getRoomQuadrant(room, plotWidth, plotLength, northFacing = "N") {
  const cx = room.x + room.width / 2;
  const cy = room.y + room.height / 2;

  const isNorth = cy < plotLength / 2; // In 2D canvas, Y=0 is top (North)
  const isEast = cx > plotWidth / 2;

  if (isNorth && isEast) return "NE";
  if (!isNorth && isEast) return "SE";
  if (!isNorth && !isEast) return "SW";
  if (isNorth && !isEast) return "NW";
  return "N";
}

/**
 * Calculate Vastu Score (0 - 100%)
 */
function evaluateVastuScore(plan, northOrientation = "NE") {
  let matchedCount = 0;
  let totalEvaluated = 0;

  plan.rooms.forEach(r => {
    const quad = getRoomQuadrant(r, plan.plotWidth, plan.plotLength, northOrientation);
    const prefList = VASTU_PREFERENCES[r.type];
    if (prefList) {
      totalEvaluated++;
      if (prefList.includes(quad)) {
        matchedCount += 1.0;
      } else if (prefList.some(p => quad.includes(p) || p.includes(quad))) {
        matchedCount += 0.5; // Partial match
      }
    }
  });

  return totalEvaluated > 0 ? Math.round((matchedCount / totalEvaluated) * 100) : 100;
}

/**
 * Check if two rooms share an edge (are adjacent)
 */
function isRoomsAdjacent(r1, r2) {
  const touchX = !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x);
  const touchY = !(r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);

  const shareVerticalEdge = (r1.x + r1.width === r2.x || r2.x + r2.width === r1.x) && touchY;
  const shareHorizontalEdge = (r1.y + r1.height === r2.y || r2.y + r2.height === r1.y) && touchX;

  return shareVerticalEdge || shareHorizontalEdge;
}

/**
 * Evaluate Adjacency Score (0 - 100%)
 */
function evaluateAdjacencyScore(plan) {
  let satisfied = 0;
  let totalRules = 0;

  plan.rooms.forEach(r => {
    const preferredTypes = ADJACENCY_PREFERENCES[r.type];
    if (preferredTypes) {
      totalRules++;
      // Check if any neighboring room matches preferred types
      const hasAdjacentPref = plan.rooms.some(other => {
        if (other.id === r.id) return false;
        return preferredTypes.includes(other.type) && isRoomsAdjacent(r, other);
      });
      if (hasAdjacentPref) satisfied++;
    }
  });

  return totalRules > 0 ? Math.round((satisfied / totalRules) * 100) : 100;
}

/**
 * Check Graph Connectivity & Reachability via BFS
 * Every room must be reachable from the living room / hallway without passing through private bedrooms.
 */
function evaluateReachability(plan) {
  const livingRoom = plan.rooms.find(r => r.type === "living_room") || plan.rooms[0];
  if (!livingRoom) return { isConnected: true, unreachableRooms: [] };

  const visited = new Set([livingRoom.id]);
  const queue = [livingRoom];

  while (queue.length > 0) {
    const current = queue.shift();
    plan.rooms.forEach(other => {
      if (!visited.has(other.id) && isRoomsAdjacent(current, other)) {
        // Can traverse through living, hallway, dining, kitchen. Private bedrooms cannot act as thoroughfares.
        visited.add(other.id);
        queue.push(other);
      }
    });
  }

  const unreachable = plan.rooms.filter(r => !visited.has(r.id));
  return {
    isConnected: unreachable.length === 0,
    unreachableRooms: unreachable.map(r => r.name)
  };
}

/**
 * Full Constraint Health Validation Pass
 */
function validatePlanConstraints(plan, vastuEnforced = true) {
  const violations = [];
  let scoreDeductions = 0;

  plan.rooms.forEach(r => {
    const spec = ROOM_SPECS[r.type];
    const area = r.width * r.height;

    // 1. Min Area Check
    if (spec && area < spec.minArea) {
      violations.push(`${r.name} is undersized (${area} sq.ft < min ${spec.minArea} sq.ft)`);
      scoreDeductions += 15;
    }

    // 2. Aspect Ratio / Width Check
    const minDim = Math.min(r.width, r.height);
    const maxDim = Math.max(r.width, r.height);
    const ratio = maxDim / minDim;

    if (spec && minDim < spec.minWidth) {
      violations.push(`${r.name} width is too narrow (${minDim} ft < min ${spec.minWidth} ft)`);
      scoreDeductions += 10;
    }
    if (ratio > 2.2) {
      violations.push(`${r.name} is too elongated (aspect ratio ${ratio.toFixed(1)})`);
      scoreDeductions += 8;
    }
  });

  // 3. Reachability Check
  const reach = evaluateReachability(plan);
  if (!reach.isConnected) {
    violations.push(`Unreachable rooms from Entrance: ${reach.unreachableRooms.join(", ")}`);
    scoreDeductions += 25;
  }

  const vastuScore = evaluateVastuScore(plan);
  const adjScore = evaluateAdjacencyScore(plan);

  const baseFitness = Math.max(0, 100 - scoreDeductions);

  return {
    isValid: violations.length === 0,
    violations,
    baseFitness,
    vastuScore,
    adjScore,
    reachability: reach
  };
}
