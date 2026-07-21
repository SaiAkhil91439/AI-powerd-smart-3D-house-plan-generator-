/**
 * 3D Procedural Floor Plan Renderer (Three.js)
 * Extrudes multi-floor 3D walls, 3D doors, windows, procedural furniture, and floating 3D room labels!
 */

class FloorPlanViewer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.buildingGroup = null;

    this.showFurniture = true;
    this.showLabels = true;

    this.initThree();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090c14');

    const aspect = this.container.clientWidth / this.container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(20, 60, 60);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth || 800, this.container.clientHeight || 500);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(50, 90, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    this.buildingGroup = new THREE.Group();
    this.scene.add(this.buildingGroup);

    this.animate();
  }

  setMultiFloorPlan(multiFloorObj) {
    if (!multiFloorObj) return;

    while (this.buildingGroup.children.length > 0) {
      const obj = this.buildingGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
    }

    const wallHeight = 10;
    const wallThickness = 0.6;
    const offsetX = -multiFloorObj.plotWidth / 2;
    const offsetZ = -multiFloorObj.plotLength / 2;

    // 1. Ground Foundation Base
    const groundGeo = new THREE.BoxGeometry(multiFloorObj.plotWidth + 10, 0.5, multiFloorObj.plotLength + 10);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -0.25, 0);
    groundMesh.receiveShadow = true;
    this.buildingGroup.add(groundMesh);

    // 2. Render Each Floor Level Stacked
    multiFloorObj.floors.forEach((floorPlan, floorIdx) => {
      const yOffset = floorIdx * wallHeight;

      floorPlan.rooms.forEach(r => {
        const rw = r.width;
        const rh = r.height;
        const rx = r.x + rw / 2 + offsetX;
        const rz = r.y + rh / 2 + offsetZ;

        // Floor Tile
        const floorGeo = new THREE.BoxGeometry(rw, 0.2, rh);
        const floorMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(r.color || '#6366f1'),
          roughness: 0.4
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.position.set(rx, yOffset + 0.1, rz);
        floorMesh.receiveShadow = true;
        this.buildingGroup.add(floorMesh);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });

        const wallN = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThickness), wallMat);
        wallN.position.set(rx, yOffset + wallHeight / 2, rz - rh / 2);
        wallN.castShadow = true;
        this.buildingGroup.add(wallN);

        const wallS = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThickness), wallMat);
        wallS.position.set(rx, yOffset + wallHeight / 2, rz + rh / 2);
        wallS.castShadow = true;
        this.buildingGroup.add(wallS);

        const wallW = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, rh), wallMat);
        wallW.position.set(rx - rw / 2, yOffset + wallHeight / 2, rz);
        wallW.castShadow = true;
        this.buildingGroup.add(wallW);

        const wallE = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, rh), wallMat);
        wallE.position.set(rx + rw / 2, yOffset + wallHeight / 2, rz);
        wallE.castShadow = true;
        this.buildingGroup.add(wallE);

        // Procedural 3D Furniture Assets
        if (this.showFurniture) {
          this.createProceduralFurniture(r, rx, yOffset + 0.2, rz, rw, rh);
        }

        // Floating 3D Room Text Label Sprite
        if (this.showLabels) {
          this.create3DTextSprite(`${r.icon || ''} ${r.name}`, `${Math.round(rw * rh)} sq.ft`, rx, yOffset + wallHeight + 1.5, rz);
        }
      });
    });

    this.controls.target.set(0, 5, 0);
    this.camera.position.set(0, multiFloorObj.plotLength * 1.6, multiFloorObj.plotLength * 1.4);
    this.controls.update();
  }

  /**
   * Procedural 3D Furniture Asset Generator
   */
  createProceduralFurniture(room, rx, ry, rz, rw, rh) {
    const group = new THREE.Group();

    if (room.type === 'master_bedroom' || room.type === 'bedroom') {
      // 3D Bed
      const bedMat = new THREE.MeshStandardMaterial({ color: 0x4338ca });
      const bed = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 6.5), bedMat);
      bed.position.set(rx, ry + 0.9, rz);

      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 1.2), pillowMat);
      pillow1.position.set(rx - 1.2, ry + 1.9, rz - 2.2);

      const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 1.2), pillowMat);
      pillow2.position.set(rx + 1.2, ry + 1.9, rz - 2.2);

      group.add(bed, pillow1, pillow2);
    } else if (room.type === 'living_room') {
      // 3D Sofa & Coffee Table
      const sofaMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(7, 1.5, 2.5), sofaMat);
      sofa.position.set(rx, ry + 0.75, rz - 2);

      const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const table = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 2), tableMat);
      table.position.set(rx, ry + 0.4, rz + 1);

      group.add(sofa, table);
    } else if (room.type === 'dining') {
      // Dining Table
      const dMat = new THREE.MeshStandardMaterial({ color: 0x991b1b });
      const dTable = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 3.5), dMat);
      dTable.position.set(rx, ry + 0.6, rz);
      group.add(dTable);
    } else if (room.type === 'parking') {
      // 3D SUV Car Model
      const carMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 11), carMat);
      carBody.position.set(rx, ry + 1.5, rz);
      group.add(carBody);
    }

    this.buildingGroup.add(group);
  }

  /**
   * Floating 3D Room Canvas Sprite Text Label
   */
  create3DTextSprite(title, subtitle, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background Pill
    ctx.fillStyle = 'rgba(18, 24, 38, 0.85)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 108, 16);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 52);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(subtitle, 128, 86);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);

    sprite.position.set(x, y, z);
    sprite.scale.set(7, 3.5, 1);

    this.buildingGroup.add(sprite);
  }

  resize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
