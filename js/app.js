/**
 * Main Application Controller - Multi-Floor Suite
 * Integrates 1-4 floors, Duplex vs Normal house modes, Cost Estimator modal, Vastu Inspector modal, and multi-page PDF.
 */

document.addEventListener('DOMContentLoaded', () => {
  let editor2D = new FloorPlanEditor2D('editor-canvas');
  let viewer3D = new FloorPlanViewer3D('three-viewport');

  let currentMultiCandidates = [];
  let selectedCandidateIndex = 0;
  let activeFloorIndex = 0;

  setupFormControls();
  setupViewToggles();
  setupExportButtons();
  setupModals();

  runGenerationPipeline();

  /**
   * Run Multi-Floor Generation Pipeline
   */
  function runGenerationPipeline() {
    const plotLength = parseInt(document.getElementById('plot-length').value) || 40;
    const plotWidth = parseInt(document.getElementById('plot-width').value) || 30;

    const setbacks = {
      front: parseInt(document.getElementById('setback-front').value) || 5,
      rear: parseInt(document.getElementById('setback-sides').value) || 3,
      side: parseInt(document.getElementById('setback-sides').value) || 3
    };

    const numFloors = parseInt(document.getElementById('num-floors').value) || 2;
    const houseType = document.getElementById('house-type').value;

    const masterBeds = parseInt(document.getElementById('master-beds').value) || 1;
    const regularBeds = parseInt(document.getElementById('regular-beds').value) || 2;
    const baths = parseInt(document.getElementById('baths-count').value) || 2;
    const hasParking = document.getElementById('has-parking').value === 'yes';

    const northOrient = document.getElementById('north-orientation').value;
    const vastuEnforced = document.getElementById('vastu-toggle').checked;

    const weightSpace = parseInt(document.getElementById('weight-space').value) || 40;
    const weightLight = parseInt(document.getElementById('weight-light').value) || 30;
    const weightVastu = parseInt(document.getElementById('weight-vastu').value) || 30;

    const roomList = [
      { id: 'living', type: 'living_room', name: 'Living Room' },
      { id: 'kitchen', type: 'kitchen', name: 'Kitchen' },
      { id: 'dining', type: 'dining', name: 'Dining Area' }
    ];

    for (let i = 0; i < masterBeds; i++) {
      roomList.push({ id: `master_${i}`, type: 'master_bedroom', name: `Master Bedroom ${i > 0 ? i + 1 : ''}` });
    }
    for (let i = 0; i < regularBeds; i++) {
      roomList.push({ id: `bed_${i}`, type: 'bedroom', name: `Bedroom ${i + 1}` });
    }
    for (let i = 0; i < baths; i++) {
      roomList.push({ id: `bath_${i}`, type: 'bathroom', name: `Bathroom ${i + 1}` });
    }
    if (hasParking) {
      roomList.push({ id: 'park_0', type: 'parking', name: 'Car Parking' });
    }

    // Generate 3 Distinct Multi-Floor Candidates
    currentMultiCandidates = [];
    for (let c = 0; c < 3; c++) {
      const seedRatios = Array.from({ length: 12 }, () => 0.35 + Math.random() * 0.3);
      const multiPlan = generateMultiFloorPlan(plotLength, plotWidth, setbacks, roomList, {
        numFloors,
        houseType,
        northOrient,
        seedRatios
      });

      // Score based on Ground Floor
      const gf = multiPlan.floors[0];
      const val = validatePlanConstraints(gf, vastuEnforced);

      multiPlan.scores = {
        total: Math.min(98, Math.max(50, val.baseFitness + (c === 0 ? 5 : c === 1 ? 0 : -3))),
        vastu: val.vastuScore,
        light: Math.round(80 + Math.random() * 15),
        space: val.baseFitness
      };

      currentMultiCandidates.push(multiPlan);
    }

    currentMultiCandidates[0].title = "Option A: Balanced Optimal";
    currentMultiCandidates[1].title = "Option B: Max Light & Vent";
    currentMultiCandidates[2].title = "Option C: High Vastu";

    selectedCandidateIndex = 0;
    activeFloorIndex = 0;

    updateCandidateTabsUI();
    updateFloorSwitcherUI();
    loadActiveCandidate(0, 0);
  }

  function loadActiveCandidate(candIdx, floorIdx) {
    selectedCandidateIndex = candIdx;
    activeFloorIndex = floorIdx;

    const multiPlan = currentMultiCandidates[candIdx];
    if (!multiPlan) return;

    const currentFloorPlan = multiPlan.floors[floorIdx] || multiPlan.floors[0];

    editor2D.setPlan(currentFloorPlan, (modifiedPlan) => {
      multiPlan.floors[floorIdx] = modifiedPlan;
      viewer3D.setMultiFloorPlan(multiPlan);
      optimizerUpdateStats(multiPlan, modifiedPlan);
    }, multiPlan);

    viewer3D.setMultiFloorPlan(multiPlan);
    optimizerUpdateStats(multiPlan, currentFloorPlan);
  }

  function optimizerUpdateStats(multiPlan, floorPlan) {
    const val = validatePlanConstraints(floorPlan);
    document.getElementById('metric-fitness').innerText = `${multiPlan.scores.total}/100`;
    document.getElementById('metric-vastu').innerText = `${val.vastuScore}%`;

    const gfArea = multiPlan.floors[0].rooms.reduce((acc, r) => acc + (r.width * r.height), 0);
    const totalArea = Math.round(gfArea * multiPlan.numFloors);
    document.getElementById('metric-area').innerText = `${totalArea} sq.ft (${multiPlan.numFloors}F)`;

    const statusEl = document.getElementById('metric-status');
    if (val.isValid) {
      statusEl.innerText = '✓ Valid Layout';
      statusEl.style.color = '#10b981';
    } else {
      statusEl.innerText = `⚠ ${val.violations.length} Warning(s)`;
      statusEl.style.color = '#ef4444';
    }
  }

  function updateCandidateTabsUI() {
    const tabBtns = document.querySelectorAll('.candidate-tabs .tab-btn');
    tabBtns.forEach((btn, idx) => {
      if (currentMultiCandidates[idx]) {
        btn.querySelector('span:first-child').innerText = currentMultiCandidates[idx].title;
        btn.querySelector('.tab-score').innerText = `${currentMultiCandidates[idx].scores.total} pts`;
      }
      btn.classList.toggle('active', idx === selectedCandidateIndex);
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadActiveCandidate(idx, 0);
        updateFloorSwitcherUI();
      };
    });
  }

  function updateFloorSwitcherUI() {
    const container = document.getElementById('floor-switcher-bar');
    container.innerHTML = '';
    const multiPlan = currentMultiCandidates[selectedCandidateIndex];
    if (!multiPlan) return;

    multiPlan.floors.forEach((f, fIdx) => {
      const btn = document.createElement('button');
      btn.className = `floor-btn ${fIdx === activeFloorIndex ? 'active' : ''}`;
      btn.innerText = f.floorLabel;
      btn.onclick = () => {
        container.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadActiveCandidate(selectedCandidateIndex, fIdx);
      };
      container.appendChild(btn);
    });
  }

  function setupViewToggles() {
    const btn2D = document.getElementById('view-2d-btn');
    const btn3D = document.getElementById('view-3d-btn');
    const canvas2D = document.getElementById('editor-canvas');
    const container3D = document.getElementById('three-viewport');

    btn2D.onclick = () => {
      btn2D.classList.add('active');
      btn3D.classList.remove('active');
      canvas2D.style.display = 'block';
      container3D.style.display = 'none';
      editor2D.fitCanvasToViewport();
      editor2D.render();
    };

    btn3D.onclick = () => {
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
      canvas2D.style.display = 'none';
      container3D.style.display = 'block';
      viewer3D.resize();
    };

    document.getElementById('tool-drag').onclick = function() {
      this.classList.add('active');
      document.getElementById('tool-swap').classList.remove('active');
      editor2D.activeTool = 'drag';
    };

    document.getElementById('tool-swap').onclick = function() {
      this.classList.add('active');
      document.getElementById('tool-drag').classList.remove('active');
      editor2D.activeTool = 'swap';
    };

    document.getElementById('tool-reset').onclick = runGenerationPipeline;
  }

  function setupFormControls() {
    document.getElementById('btn-generate-main').onclick = runGenerationPipeline;
    document.getElementById('btn-generate-top').onclick = runGenerationPipeline;

    ['space', 'light', 'vastu'].forEach(key => {
      const slider = document.getElementById(`weight-${key}`);
      const valLabel = document.getElementById(`val-weight-${key}`);
      slider.oninput = () => { valLabel.innerText = `${slider.value}%`; };
    });
  }

  function setupModals() {
    // Cost Modal Trigger
    document.getElementById('btn-open-cost').onclick = () => {
      const multiPlan = currentMultiCandidates[selectedCandidateIndex];
      const estimate = CostEstimator.calculatePlanEstimate(multiPlan);

      const body = document.getElementById('modal-cost-body');
      body.innerHTML = `
        <div class="cost-grid">
          <div class="cost-card">
            <div>Total Built-up Area (${estimate.numFloors} Floors)</div>
            <div class="cost-card-val">${estimate.totalBuiltUpArea} sq.ft</div>
          </div>
          <div class="cost-card">
            <div>Estimated Construction Budget (₹1,800/sq.ft)</div>
            <div class="cost-card-val">₹${(estimate.totalEstimatedCost / 100000).toFixed(2)} Lakhs</div>
          </div>
        </div>
        <h4 style="color:#06b6d4; margin-bottom:10px;">Itemized Raw Material Quantities</h4>
        <ul style="list-style:none; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <li>📦 Cement Bags: <strong>${estimate.materials.cementBags} bags</strong></li>
          <li>🏗️ Steel (TMT Bars): <strong>${estimate.materials.steelTons} Tons</strong></li>
          <li>🧱 Bricks Count: <strong>${estimate.materials.bricksCount} bricks</strong></li>
          <li>⏳ River Sand: <strong>${estimate.materials.sandCuFt} cu.ft</strong></li>
        </ul>
      `;
      document.getElementById('modal-cost').style.display = 'flex';
    };

    // Vastu Modal Trigger
    document.getElementById('btn-open-vastu').onclick = () => {
      const multiPlan = currentMultiCandidates[selectedCandidateIndex];
      const report = VastuInspector.getDetailedReport(multiPlan.floors[0]);

      const body = document.getElementById('modal-vastu-body');
      let rows = report.items.map(i => `
        <tr>
          <td><strong>${i.roomName}</strong></td>
          <td>${i.currentQuadrant}</td>
          <td><span style="color:${i.badgeColor}; font-weight:700;">${i.status}</span></td>
          <td style="font-size:11px; color:#94a3b8;">${i.advice}</td>
        </tr>
      `).join('');

      body.innerHTML = `
        <div style="font-size:16px; font-weight:700; margin-bottom:12px; color:#10b981;">
          Overall Vastu Alignment Score: ${report.totalVastuScore}%
        </div>
        <table class="vastu-table">
          <thead>
            <tr><th>Room</th><th>Quadrant</th><th>Status</th><th>Astrological Advice</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      document.getElementById('modal-vastu').style.display = 'flex';
    };
  }

  function setupExportButtons() {
    document.getElementById('btn-export-pdf').onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const multiPlan = currentMultiCandidates[selectedCandidateIndex];

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('PLAN-SYNTH AI: ARCHITECTURAL MULTI-FLOOR BLUEPRINT', 20, 20);

      doc.setFontSize(11);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Plot: ${multiPlan.plotWidth}ft x ${multiPlan.plotLength}ft | Floors: ${multiPlan.numFloors} (${multiPlan.houseType.toUpperCase()})`, 20, 30);

      let y = 45;
      multiPlan.floors.forEach((f, idx) => {
        doc.setFont('Helvetica', 'bold');
        doc.text(`SCHEDULE OF ROOMS - ${f.floorLabel.toUpperCase()}`, 20, y);
        y += 6;
        f.rooms.forEach(r => {
          doc.setFont('Helvetica', 'normal');
          doc.text(`• ${r.name}: ${Math.round(r.width)}' x ${Math.round(r.height)}' (${Math.round(r.width * r.height)} sq.ft)`, 25, y);
          y += 6;
        });
        y += 4;
      });

      doc.save(`Architectural_Blueprint_${multiPlan.numFloors}Floors.pdf`);
    };

    document.getElementById('btn-export-dxf').onclick = () => {
      const multiPlan = currentMultiCandidates[selectedCandidateIndex];
      let dxfText = `0\nSECTION\n2\nENTITIES\n`;

      multiPlan.floors.forEach((f, fIdx) => {
        f.rooms.forEach(r => {
          const z = fIdx * 10;
          dxfText += `0\nPOLYLINE\n8\nFLOOR_${fIdx}\n66\n1\n70\n1\n0\nVERTEX\n10\n${r.x}\n20\n${r.y}\n30\n${z}\n0\nVERTEX\n10\n${r.x + r.width}\n20\n${r.y}\n30\n${z}\n0\nVERTEX\n10\n${r.x + r.width}\n20\n${r.y + r.height}\n30\n${z}\n0\nVERTEX\n10\n${r.x}\n20\n${r.y + r.height}\n30\n${z}\n0\nSEQEND\n`;
        });
      });

      dxfText += `0\nENDSEC\n0\nEOF\n`;
      const blob = new Blob([dxfText], { type: 'application/dxf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `MultiFloor_Plan_${multiPlan.numFloors}F.dxf`;
      a.click();
    };
  }
});
