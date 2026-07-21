/**
 * 2D Floor Plan Interactive Canvas Editor
 * High-fidelity graphics: Doors, 90° door swing arcs, windows, main entrance porch, and wall drag handles.
 */

class FloorPlanEditor2D {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.plan = null; // Single floor plan or active floor of multi-floor
    this.multiFloorObj = null;

    this.scale = 12;
    this.offsetX = 40;
    this.offsetY = 40;

    this.activeTool = 'drag';
    this.hoveredWall = null;
    this.draggingWall = null;

    this.selectedRoomForSwap = null;
    this.onPlanModifiedCallback = null;

    this.initEventListeners();
  }

  setPlan(plan, onModified = null, multiFloorObj = null) {
    this.plan = JSON.parse(JSON.stringify(plan));
    this.multiFloorObj = multiFloorObj;
    this.onPlanModifiedCallback = onModified;
    this.fitCanvasToViewport();
    this.render();
  }

  fitCanvasToViewport() {
    if (!this.plan) return;

    const parent = this.canvas.parentElement;
    const availW = parent.clientWidth - 40;
    const availH = parent.clientHeight - 40;

    const scaleX = availW / (this.plan.plotWidth + 10);
    const scaleY = availH / (this.plan.plotLength + 10);

    this.scale = Math.min(scaleX, scaleY, 18);
    this.canvas.width = availW;
    this.canvas.height = availH;

    this.offsetX = (availW - (this.plan.plotWidth * this.scale)) / 2;
    this.offsetY = (availH - (this.plan.plotLength * this.scale)) / 2;
  }

  worldToCanvas(x, y) {
    return {
      x: this.offsetX + (x * this.scale),
      y: this.offsetY + (y * this.scale)
    };
  }

  canvasToWorld(cx, cy) {
    return {
      x: (cx - this.offsetX) / this.scale,
      y: (cy - this.offsetY) / this.scale
    };
  }

  getSharedWalls() {
    if (!this.plan) return [];
    const walls = [];
    const rooms = this.plan.rooms;

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const r1 = rooms[i];
        const r2 = rooms[j];

        if (Math.abs((r1.x + r1.width) - r2.x) < 0.2 || Math.abs((r2.x + r2.width) - r1.x) < 0.2) {
          const leftRoom = r1.x < r2.x ? r1 : r2;
          const rightRoom = r1.x < r2.x ? r2 : r1;
          const wallX = leftRoom.x + leftRoom.width;

          const startY = Math.max(r1.y, r2.y);
          const endY = Math.min(r1.y + r1.height, r2.y + r2.height);

          if (endY - startY > 1) {
            walls.push({ type: 'vertical', x: wallX, startY, endY, roomA: leftRoom, roomB: rightRoom });
          }
        }

        if (Math.abs((r1.y + r1.height) - r2.y) < 0.2 || Math.abs((r2.y + r2.height) - r1.y) < 0.2) {
          const topRoom = r1.y < r2.y ? r1 : r2;
          const bottomRoom = r1.y < r2.y ? r2 : r1;
          const wallY = topRoom.y + topRoom.height;

          const startX = Math.max(r1.x, r2.x);
          const endX = Math.min(r1.x + r1.width, r2.x + r2.width);

          if (endX - startX > 1) {
            walls.push({ type: 'horizontal', y: wallY, startX, endX, roomA: topRoom, roomB: bottomRoom });
          }
        }
      }
    }
    return walls;
  }

  /**
   * Render High-Fidelity 2D Floor Plan
   */
  render() {
    if (!this.plan) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Plot Outer Boundary & Setbacks
    const origin = this.worldToCanvas(0, 0);
    const plotDim = { w: this.plan.plotWidth * this.scale, h: this.plan.plotLength * this.scale };

    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(origin.x, origin.y, plotDim.w, plotDim.h);

    const buildable = this.plan.buildableBox;
    const bPos = this.worldToCanvas(buildable.x, buildable.y);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.strokeRect(bPos.x, bPos.y, buildable.width * this.scale, buildable.height * this.scale);
    ctx.setLineDash([]);

    // 2. Draw Rooms with High-Quality Graphics
    this.plan.rooms.forEach(r => {
      const pos = this.worldToCanvas(r.x, r.y);
      const rw = r.width * this.scale;
      const rh = r.height * this.scale;

      const spec = ROOM_SPECS[r.type] || ROOM_SPECS.hallway;
      const area = Math.round(r.width * r.height);
      const isUndersized = spec && area < spec.minArea;

      // Fill Color
      ctx.fillStyle = isUndersized ? 'rgba(239, 68, 68, 0.25)' : (r.color + '26');
      ctx.fillRect(pos.x, pos.y, rw, rh);

      // Room Border Walls (Thick double line effect)
      ctx.strokeStyle = isUndersized ? '#ef4444' : r.color;
      ctx.lineWidth = isUndersized ? 4 : 3;
      ctx.strokeRect(pos.x, pos.y, rw, rh);

      // Selected Room for Swap
      if (this.selectedRoomForSwap && this.selectedRoomForSwap.id === r.id) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fillRect(pos.x, pos.y, rw, rh);
      }

      // Draw Windows (Cyan Glass Panes)
      if (r.windows) {
        r.windows.forEach(w => {
          const wPos = this.worldToCanvas(w.x, w.y);
          const wLen = w.length * this.scale;
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 5;
          ctx.beginPath();
          if (w.wall === 'top' || w.wall === 'bottom') {
            ctx.moveTo(wPos.x - wLen / 2, wPos.y);
            ctx.lineTo(wPos.x + wLen / 2, wPos.y);
          } else {
            ctx.moveTo(wPos.x, wPos.y - wLen / 2);
            ctx.lineTo(wPos.x, wPos.y + wLen / 2);
          }
          ctx.stroke();
        });
      }

      // Draw Doors & 90° Swing Arcs
      if (r.doors) {
        r.doors.forEach(d => {
          const dPos = this.worldToCanvas(d.x, d.y);
          const dRadius = (d.width || 3) * this.scale;

          // Clear wall cutout for door
          ctx.fillStyle = '#090c14';
          ctx.fillRect(dPos.x, dPos.y - 3, dRadius, 6);

          // Door Leaf line
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(dPos.x, dPos.y);
          ctx.lineTo(dPos.x, dPos.y - dRadius);
          ctx.stroke();

          // 90 Degree Swing Arc
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(dPos.x, dPos.y, dRadius, 0, Math.PI / 2, false);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // Room Labels
      const cx = pos.x + rw / 2;
      const cy = pos.y + rh / 2;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Plus Jakarta Sans"';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.icon || ''} ${r.name}`, cx, cy - 6);

      ctx.font = '11px "JetBrains Mono"';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${Math.round(r.width)}' × ${Math.round(r.height)}' (${area} sq.ft)`, cx, cy + 12);
    });

    // 3. Main Entrance Porch Marker
    if (this.plan.mainEntrance) {
      const me = this.plan.mainEntrance;
      const mePos = this.worldToCanvas(me.x, me.y);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px "Plus Jakarta Sans"';
      ctx.textAlign = 'center';
      ctx.fillText('🚪 MAIN ENTRANCE', mePos.x, mePos.y - 12);
    }

    // 4. Shared Walls Handles
    const sharedWalls = this.getSharedWalls();
    sharedWalls.forEach(w => {
      ctx.beginPath();
      const isHovered = this.hoveredWall && (
        (w.type === 'vertical' && Math.abs(w.x - this.hoveredWall.x) < 0.2 && Math.abs(w.startY - this.hoveredWall.startY) < 0.2) ||
        (w.type === 'horizontal' && Math.abs(w.y - this.hoveredWall.y) < 0.2 && Math.abs(w.startX - this.hoveredWall.startX) < 0.2)
      );

      ctx.strokeStyle = isHovered ? '#6366f1' : '#1e293b';
      ctx.lineWidth = isHovered ? 6 : 4;

      if (w.type === 'vertical') {
        const p1 = this.worldToCanvas(w.x, w.startY);
        const p2 = this.worldToCanvas(w.x, w.endY);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      } else {
        const p1 = this.worldToCanvas(w.startX, w.y);
        const p2 = this.worldToCanvas(w.endX, w.y);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
    });

    ctx.restore();
  }

  initEventListeners() {
    window.addEventListener('resize', () => {
      this.fitCanvasToViewport();
      this.render();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseWorld = this.canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);

      if (this.draggingWall) {
        this.handleWallDrag(mouseWorld);
        this.render();
        if (this.onPlanModifiedCallback) this.onPlanModifiedCallback(this.plan);
        return;
      }

      const walls = this.getSharedWalls();
      this.hoveredWall = null;

      for (let w of walls) {
        if (w.type === 'vertical') {
          if (Math.abs(mouseWorld.x - w.x) < 0.8 && mouseWorld.y >= w.startY && mouseWorld.y <= w.endY) {
            this.hoveredWall = w;
            this.canvas.style.cursor = 'col-resize';
            break;
          }
        } else {
          if (Math.abs(mouseWorld.y - w.y) < 0.8 && mouseWorld.x >= w.startX && mouseWorld.x <= w.endX) {
            this.hoveredWall = w;
            this.canvas.style.cursor = 'row-resize';
            break;
          }
        }
      }

      if (!this.hoveredWall) {
        this.canvas.style.cursor = this.activeTool === 'swap' ? 'pointer' : 'default';
      }
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.hoveredWall && this.activeTool === 'drag') {
        this.draggingWall = this.hoveredWall;
      } else if (this.activeTool === 'swap') {
        const rect = this.canvas.getBoundingClientRect();
        const mw = this.canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const clickedRoom = this.plan.rooms.find(r =>
          mw.x >= r.x && mw.x <= r.x + r.width && mw.y >= r.y && mw.y <= r.y + r.height
        );

        if (clickedRoom) {
          if (!this.selectedRoomForSwap) {
            this.selectedRoomForSwap = clickedRoom;
          } else {
            const typeA = this.selectedRoomForSwap.type;
            const nameA = this.selectedRoomForSwap.name;
            const colorA = this.selectedRoomForSwap.color;

            this.selectedRoomForSwap.type = clickedRoom.type;
            this.selectedRoomForSwap.name = clickedRoom.name;
            this.selectedRoomForSwap.color = clickedRoom.color;

            clickedRoom.type = typeA;
            clickedRoom.name = nameA;
            clickedRoom.color = colorA;

            this.selectedRoomForSwap = null;
            if (this.onPlanModifiedCallback) this.onPlanModifiedCallback(this.plan);
          }
          this.render();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.draggingWall = null;
    });
  }

  handleWallDrag(mouseWorld) {
    const w = this.draggingWall;
    if (!w) return;

    if (w.type === 'vertical') {
      const newX = Math.round(mouseWorld.x);
      const deltaX = newX - w.x;
      if (w.roomA.width + deltaX >= 4 && w.roomB.width - deltaX >= 4) {
        w.roomA.width += deltaX;
        w.roomB.x += deltaX;
        w.roomB.width -= deltaX;
        w.x = newX;
      }
    } else {
      const newY = Math.round(mouseWorld.y);
      const deltaY = newY - w.y;
      if (w.roomA.height + deltaY >= 4 && w.roomB.height - deltaY >= 4) {
        w.roomA.height += deltaY;
        w.roomB.y += deltaY;
        w.roomB.height -= deltaY;
        w.y = newY;
      }
    }
  }
}
