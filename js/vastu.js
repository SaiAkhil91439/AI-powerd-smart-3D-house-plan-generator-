/**
 * Detailed Vastu Shastra Inspector & Remedial Advisor
 */

class VastuInspector {
  static getDetailedReport(plan, northOrientation = "NE") {
    const reportItems = [];

    plan.rooms.forEach(r => {
      const quad = getRoomQuadrant(r, plan.plotWidth, plan.plotLength, northOrientation);
      const prefList = VASTU_PREFERENCES[r.type] || [];

      let status = "Sub-optimal";
      let badgeColor = "#ef4444";
      let points = 50;
      let advice = "";

      if (prefList.includes(quad)) {
        status = "Excellent (Ideal Zone)";
        badgeColor = "#10b981";
        points = 100;
        advice = "Positioned in the ideal astrological quadrant according to Vastu Shastra principles.";
      } else if (prefList.some(p => quad.includes(p) || p.includes(quad))) {
        status = "Good (Acceptable)";
        badgeColor = "#f59e0b";
        points = 75;
        advice = "Acceptable positioning. Ensure main door or windows face North or East for positive energy flow.";
      } else {
        advice = `Vastu recommends moving ${r.name} towards ${prefList.join(" or ")} zone for optimal harmony.`;
      }

      reportItems.push({
        roomName: r.name,
        roomType: r.type,
        currentQuadrant: quad,
        idealZones: prefList.join(", "),
        status,
        badgeColor,
        points,
        advice
      });
    });

    const totalVastuScore = evaluateVastuScore(plan, northOrientation);

    return {
      totalVastuScore,
      northOrientation,
      items: reportItems
    };
  }
}
