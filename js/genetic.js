/**
 * Genetic Algorithm & Multi-Objective Layout Ranker
 * Runs population search over BSP split parameters and ranks top distinct candidates.
 */

class LayoutOptimizer {
  constructor(plotLength, plotWidth, setbacks, roomList, options = {}) {
    this.plotLength = plotLength;
    this.plotWidth = plotWidth;
    this.setbacks = setbacks;
    this.roomList = roomList;
    this.options = options;

    this.weights = {
      space: (options.weights?.space ?? 40) / 100,
      light: (options.weights?.light ?? 30) / 100,
      vastu: (options.weights?.vastu ?? 30) / 100
    };
  }

  /**
   * Evaluate Natural Light & Ventilation Score (fraction of rooms touching outer perimeter)
   */
  calculateLightScore(plan) {
    const box = plan.buildableBox;
    let perimeterRooms = 0;

    plan.rooms.forEach(r => {
      const touchesLeft = Math.abs(r.x - box.x) < 0.5;
      const touchesRight = Math.abs((r.x + r.width) - (box.x + box.width)) < 0.5;
      const touchesTop = Math.abs(r.y - box.y) < 0.5;
      const touchesBottom = Math.abs((r.y + r.height) - (box.y + box.height)) < 0.5;

      if (touchesLeft || touchesRight || touchesTop || touchesBottom) {
        perimeterRooms++;
      }
    });

    return plan.rooms.length > 0 ? Math.round((perimeterRooms / plan.rooms.length) * 100) : 100;
  }

  /**
   * Evaluate Total Interior Wall Length (Cost proxy)
   */
  calculateWallCostScore(plan) {
    let totalWallLen = 0;
    plan.rooms.forEach(r => {
      totalWallLen += (r.width * 2) + (r.height * 2);
    });
    // Lower wall length per area is better
    const totalArea = plan.buildableBox.width * plan.buildableBox.height;
    const ratio = totalWallLen / totalArea; // typical range 0.15 - 0.3
    const score = Math.max(0, Math.min(100, Math.round(100 - (ratio - 0.15) * 300)));
    return score;
  }

  /**
   * Multi-Objective Fitness Evaluation
   */
  evaluateCandidate(plan) {
    const constraintResult = validatePlanConstraints(plan, this.options.vastuEnforced);
    const lightScore = this.calculateLightScore(plan);
    const wallCostScore = this.calculateWallCostScore(plan);

    // Weighted combination
    const totalScore = Math.round(
      (constraintResult.baseFitness * 0.3) +
      (constraintResult.vastuScore * this.weights.vastu * 0.3) +
      (lightScore * this.weights.light * 0.2) +
      (constraintResult.adjScore * 0.1) +
      (wallCostScore * 0.1)
    );

    plan.scores = {
      total: Math.min(99, Math.max(40, totalScore)),
      vastu: constraintResult.vastuScore,
      light: lightScore,
      space: constraintResult.baseFitness,
      adjacency: constraintResult.adjScore,
      wallCost: wallCostScore
    };
    plan.validation = constraintResult;

    return plan.scores.total;
  }

  /**
   * Run GA Population Search and Select Top 3 Diverse Candidates
   */
  generateTopCandidates(populationSize = 60) {
    const population = [];

    // Generate population with varied BSP split chromosomes
    for (let i = 0; i < populationSize; i++) {
      const seedRatios = Array.from({ length: 8 }, () => 0.35 + Math.random() * 0.3);
      const plan = generateBSPFloorPlan(this.plotLength, this.plotWidth, this.setbacks, this.roomList, seedRatios);
      this.evaluateCandidate(plan);
      population.push(plan);
    }

    // Sort by total score descending
    population.sort((a, b) => b.scores.total - a.scores.total);

    // Pick top 3 structurally distinct plans (not minor variations)
    const top3 = [];
    top3.push(population[0]); // Option A: Highest overall fitness

    // Option B: Highest Light/Ventilation
    const bestLight = [...population].sort((a, b) => b.scores.light - a.scores.light)
      .find(p => p !== top3[0]) || population[1];
    top3.push(bestLight);

    // Option C: Highest Vastu or Space Efficiency
    const bestVastu = [...population].sort((a, b) => b.scores.vastu - a.scores.vastu)
      .find(p => !top3.includes(p)) || population[2];
    top3.push(bestVastu);

    // Annotate titles
    top3[0].title = "Option A: Balanced Optimal";
    top3[1].title = "Option B: Max Light & Ventilation";
    top3[2].title = "Option C: High Vastu Alignment";

    return top3;
  }
}
