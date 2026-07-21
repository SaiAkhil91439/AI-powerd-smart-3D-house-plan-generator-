/**
 * Material Quantity & Construction Cost Estimator Engine
 * Calculates built-up area across all floors and itemized construction budget.
 */

class CostEstimator {
  static calculatePlanEstimate(plan, costPerSqFt = 1800) {
    const numFloors = plan.numFloors || 1;
    let groundBuiltUp = plan.rooms.reduce((acc, r) => acc + (r.width * r.height), 0);
    let totalBuiltUpArea = groundBuiltUp * numFloors;

    const baseCost = totalBuiltUpArea * costPerSqFt;

    // Itemized Material Quantities
    const cementBags = Math.round(totalBuiltUpArea * 0.4);       // 0.4 bags per sq.ft
    const steelTons = ((totalBuiltUpArea * 3.5) / 1000).toFixed(2); // 3.5 kg per sq.ft
    const bricksCount = Math.round(totalBuiltUpArea * 9.5);     // 9.5 bricks per sq.ft
    const sandCuFt = Math.round(totalBuiltUpArea * 1.2);         // 1.2 cu.ft per sq.ft
    const aggregateCuFt = Math.round(totalBuiltUpArea * 1.35);   // 1.35 cu.ft per sq.ft

    // Cost Allocation Breakdown (%)
    const structureCost = Math.round(baseCost * 0.50);  // 50% Civil & Structure
    const finishingCost = Math.round(baseCost * 0.25);  // 25% Tiles, Paint, Plaster
    const MEPcost = Math.round(baseCost * 0.15);        // 15% Plumbing & Electrical
    const fittingsCost = Math.round(baseCost * 0.10);   // 10% Doors, Windows, Fixtures

    return {
      numFloors,
      groundBuiltUp: Math.round(groundBuiltUp),
      totalBuiltUpArea: Math.round(totalBuiltUpArea),
      costPerSqFt,
      totalEstimatedCost: Math.round(baseCost),
      materials: {
        cementBags,
        steelTons,
        bricksCount,
        sandCuFt,
        aggregateCuFt
      },
      breakdown: {
        structureCost,
        finishingCost,
        MEPcost,
        fittingsCost
      }
    };
  }
}
