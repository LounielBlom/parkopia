// ============================================================
//  PARKOPIA – Programmatic Isometric Asset Renderer
// ============================================================

const Assets = (() => {
    const cache = {};
    const TW = CONFIG.TILE_W;
    const TH = CONFIG.TILE_H;

    function createCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    // ---- Isometric helper: draw a flat diamond tile ----
    function drawDiamond(ctx, x, y, w, h, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    // ---- Draw an isometric box ----
    function drawIsoBox(ctx, x, y, w, h, depth, topColor, leftColor, rightColor) {
        const hw = w / 2, hh = h / 2;
        // Top face
        ctx.beginPath();
        ctx.moveTo(x + hw, y);
        ctx.lineTo(x + w, y + hh);
        ctx.lineTo(x + hw, y + h);
        ctx.lineTo(x, y + hh);
        ctx.closePath();
        ctx.fillStyle = topColor;
        ctx.fill();
        // Left face
        ctx.beginPath();
        ctx.moveTo(x, y + hh);
        ctx.lineTo(x + hw, y + h);
        ctx.lineTo(x + hw, y + h + depth);
        ctx.lineTo(x, y + hh + depth);
        ctx.closePath();
        ctx.fillStyle = leftColor;
        ctx.fill();
        // Right face
        ctx.beginPath();
        ctx.moveTo(x + w, y + hh);
        ctx.lineTo(x + hw, y + h);
        ctx.lineTo(x + hw, y + h + depth);
        ctx.lineTo(x + w, y + hh + depth);
        ctx.closePath();
        ctx.fillStyle = rightColor;
        ctx.fill();
    }

    // ---- Grass Tile ----
    function renderGrass(variant = 0) {
        const c = createCanvas(TW + 2, TH + 2);
        const ctx = c.getContext('2d');
        // Very subtle variation - almost imperceptible checkerboard
        const r = variant ? 122 : 126;
        const g = variant ? 198 : 200;
        const b = variant ? 78 : 80;
        const baseColor = `rgb(${r},${g},${b})`;
        drawDiamond(ctx, 1, 1, TW, TH, baseColor, `rgba(90,158,58,0.25)`);
        // Grass texture dots
        const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
        const rand = rng(variant * 137 + 42);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 6; i++) {
            const gx = 12 + rand() * 40;
            const gy = 6 + rand() * 20;
            ctx.beginPath();
            ctx.arc(gx, gy, 0.8 + rand() * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (let i = 0; i < 4; i++) {
            const gx = 10 + rand() * 44;
            const gy = 4 + rand() * 24;
            ctx.beginPath();
            ctx.arc(gx, gy, 0.6 + rand() * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    // ---- Water Tile ----
    function renderWater(frame = 0) {
        const c = createCanvas(TW + 2, TH + 2);
        const ctx = c.getContext('2d');
        const shimmer = Math.sin(frame * 0.05) * 10;
        const r = parseInt(CONFIG.COLOR_WATER.substr(1, 2), 16) + shimmer;
        const g = parseInt(CONFIG.COLOR_WATER.substr(3, 2), 16) + shimmer;
        const b = parseInt(CONFIG.COLOR_WATER.substr(5, 2), 16);
        drawDiamond(ctx, 1, 1, TW, TH, `rgb(${r},${g},${b})`, CONFIG.COLOR_WATER_DEEP);
        // Wave highlights
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20 + Math.sin(frame * 0.08) * 3, 12);
        ctx.lineTo(40 + Math.sin(frame * 0.08 + 1) * 3, 18);
        ctx.stroke();
        return c;
    }

    // ---- Path Tile ----
    function renderPath(connections = {}, wide = false) {
        const c = createCanvas(TW + 2, TH + 4);
        const ctx = c.getContext('2d');
        // Path has slight height/depth for visual clarity
        const pathTop = '#D4C6A1';
        const pathLeft = '#B8A882';
        const pathRight = '#C4B892';
        // Draw a slightly raised path
        drawIsoBox(ctx, 1, 1, TW, TH, 3, pathTop, pathLeft, pathRight);
        // Cobblestone pattern
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        const stones = [[20,8],[32,6],[26,12],[38,14],[16,14],[44,10],[22,18],[34,20],[40,18]];
        for (const [sx, sy] of stones) {
            ctx.beginPath();
            ctx.ellipse(sx, sy, 3, 2, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Light edge highlights
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 0.5;
        for (const [sx, sy] of stones.slice(0, 5)) {
            ctx.beginPath();
            ctx.arc(sx - 1, sy - 1, 2, Math.PI, Math.PI * 1.5);
            ctx.stroke();
        }
        if (wide) {
            // Center stripe for wide path
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            drawDiamond(ctx, 14, 7, TW - 26, TH - 12, 'rgba(255,255,255,0.1)');
        }
        return c;
    }

    // ---- Tree ----
    function renderTree() {
        const c = createCanvas(TW + 20, TH + 50);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 10;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(cx - 3, base - 36, 6, 20);
        ctx.fillStyle = '#7A5B10';
        ctx.fillRect(cx - 3, base - 36, 3, 20);
        // Canopy layers (lush, round)
        const greens = ['#3d8c3a', '#4a9e45', '#5cb852', '#4a9e45'];
        const offsets = [[-8, -42], [6, -46], [-2, -50], [2, -38]];
        greens.forEach((col, i) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(cx + offsets[i][0], base + offsets[i][1], 12 - i, 0, Math.PI * 2);
            ctx.fill();
        });
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(cx - 2, base - 50, 6, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    // ---- Flower Bed ----
    function renderFlowers() {
        const c = createCanvas(TW + 4, TH + 14);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 4;
        // Soil base
        drawDiamond(ctx, 8, base - TH / 2 - 2, TW - 12, TH / 2 + 2, '#8B7355', '#6B5335');
        // Flowers
        const colors = ['#FF6B8A', '#FFD93D', '#FF8CC8', '#74B9FF', '#A29BFE'];
        for (let i = 0; i < 7; i++) {
            const fx = cx - 16 + (i % 4) * 10 + (i > 3 ? 5 : 0);
            const fy = base - 10 - (i % 3) * 4;
            // Stem
            ctx.strokeStyle = '#4a8c3a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(fx, fy + 4);
            ctx.lineTo(fx, fy);
            ctx.stroke();
            // Petals
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.arc(fx, fy - 1, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFE066';
            ctx.beginPath();
            ctx.arc(fx, fy - 1, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    // ---- Fountain ----
    function renderFountain(frame = 0) {
        const c = createCanvas(TW + 20, TH + 50);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 8;
        // Base pool
        ctx.fillStyle = '#78A0C0';
        ctx.beginPath();
        ctx.ellipse(cx, base - 6, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5090B8';
        ctx.beginPath();
        ctx.ellipse(cx, base - 6, 22, 10, 0, 0, Math.PI);
        ctx.fill();
        // Pedestal
        ctx.fillStyle = '#C0B8A8';
        ctx.fillRect(cx - 5, base - 28, 10, 22);
        ctx.fillStyle = '#A8A090';
        ctx.fillRect(cx - 5, base - 28, 5, 22);
        // Bowl
        ctx.fillStyle = '#D0C8B8';
        ctx.beginPath();
        ctx.ellipse(cx, base - 26, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#88B8D8';
        ctx.beginPath();
        ctx.ellipse(cx, base - 26, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Water spray
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.7)';
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
            const spread = i * 4;
            const height = 18 + Math.sin(frame * 0.1 + i) * 3;
            ctx.beginPath();
            ctx.moveTo(cx, base - 26);
            ctx.quadraticCurveTo(cx + spread * 0.5, base - 26 - height, cx + spread, base - 26 - 4);
            ctx.stroke();
        }
        // Droplets
        ctx.fillStyle = 'rgba(180, 220, 255, 0.6)';
        for (let i = 0; i < 5; i++) {
            const dx = cx - 8 + Math.sin(frame * 0.15 + i * 1.3) * 10;
            const dy = base - 30 - Math.abs(Math.sin(frame * 0.12 + i * 0.9)) * 14;
            ctx.beginPath();
            ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    // ---- Bench ----
    function renderBench() {
        const c = createCanvas(TW, TH + 16);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 4;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillStyle = '#555';
        ctx.fillRect(cx - 10, base - 10, 2, 8);
        ctx.fillRect(cx + 8, base - 10, 2, 8);
        // Seat
        ctx.fillStyle = '#C88040';
        ctx.fillRect(cx - 12, base - 12, 24, 4);
        // Back
        ctx.fillStyle = '#B07030';
        ctx.fillRect(cx - 12, base - 18, 24, 3);
        return c;
    }

    // ---- Lamp Post ----
    function renderLamp() {
        const c = createCanvas(TW, TH + 48);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pole
        ctx.fillStyle = '#444';
        ctx.fillRect(cx - 2, base - 40, 4, 38);
        // Lamp head
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - 6, base - 44, 12, 4);
        // Glow
        const grad = ctx.createRadialGradient(cx, base - 42, 2, cx, base - 42, 18);
        grad.addColorStop(0, 'rgba(255, 230, 150, 0.35)');
        grad.addColorStop(1, 'rgba(255, 230, 150, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, base - 38, 18, 0, Math.PI * 2);
        ctx.fill();
        // Bulb
        ctx.fillStyle = '#FFE880';
        ctx.beginPath();
        ctx.arc(cx, base - 42, 3, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    // ---- Trash Can ----
    function renderTrashCan() {
        const c = createCanvas(TW, TH + 16);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 4;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#558855';
        ctx.beginPath();
        ctx.moveTo(cx - 7, base - 4);
        ctx.lineTo(cx - 6, base - 16);
        ctx.lineTo(cx + 6, base - 16);
        ctx.lineTo(cx + 7, base - 4);
        ctx.closePath();
        ctx.fill();
        // Lid
        ctx.fillStyle = '#447744';
        ctx.beginPath();
        ctx.ellipse(cx, base - 16, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    // ---- Statue ----
    function renderStatue() {
        const c = createCanvas(TW + 10, TH + 52);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pedestal
        drawIsoBox(ctx, cx - 12, base - 18, 24, 12, 8, '#C0B8A0', '#A09880', '#B0A890');
        // Figure
        ctx.fillStyle = '#D8D0C0';
        ctx.fillRect(cx - 3, base - 44, 6, 24);
        // Head
        ctx.fillStyle = '#D8D0C0';
        ctx.beginPath();
        ctx.arc(cx, base - 48, 5, 0, Math.PI * 2);
        ctx.fill();
        // Arms
        ctx.strokeStyle = '#D8D0C0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 3, base - 36);
        ctx.lineTo(cx - 10, base - 30);
        ctx.moveTo(cx + 3, base - 36);
        ctx.lineTo(cx + 10, base - 32);
        ctx.stroke();
        return c;
    }

    // ---- Hedge ----
    function renderHedge() {
        const c = createCanvas(TW + 4, TH + 14);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 4;
        drawIsoBox(ctx, cx - 16, base - 18, 32, 16, 6, '#3d7a3a', '#2d6a2a', '#358a32');
        // Leaf highlights
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(cx - 8 + i * 6, base - 16 + (i % 2) * 3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    // ---- Multi-tile rides ----
    function renderCarousel(frame = 0) {
        const w = TW * 2 + 10, h = TH * 2 + 60;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 12;
        // Platform
        ctx.fillStyle = '#C0A080';
        ctx.beginPath();
        ctx.ellipse(cx, base - 4, 40, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A08060';
        ctx.beginPath();
        ctx.ellipse(cx, base - 4, 40, 18, 0, Math.PI * 0.1, Math.PI * 0.9);
        ctx.fill();
        // Poles
        const colors = ['#E84040', '#4080E8', '#E8C040', '#40C080', '#E860A0', '#60A0E8'];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + frame * 0.02;
            const px = cx + Math.cos(angle) * 28;
            const py = base - 8 + Math.sin(angle) * 12;
            ctx.fillStyle = '#888';
            ctx.fillRect(px - 1, py - 28, 2, 24);
            // Horse/seat
            ctx.fillStyle = colors[i];
            ctx.beginPath();
            ctx.ellipse(px, py - 8 + Math.sin(frame * 0.06 + i) * 3, 5, 7, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Center pole
        ctx.fillStyle = '#C8A060';
        ctx.fillRect(cx - 3, base - 52, 6, 48);
        // Roof
        ctx.fillStyle = '#E84040';
        ctx.beginPath();
        ctx.moveTo(cx, base - 60);
        ctx.lineTo(cx + 42, base - 26);
        ctx.lineTo(cx - 42, base - 26);
        ctx.closePath();
        ctx.fill();
        // Roof stripes
        ctx.fillStyle = '#F0E040';
        ctx.beginPath();
        ctx.moveTo(cx - 2, base - 58);
        ctx.lineTo(cx + 14, base - 26);
        ctx.lineTo(cx + 8, base - 26);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 2, base - 58);
        ctx.lineTo(cx - 14, base - 26);
        ctx.lineTo(cx - 8, base - 26);
        ctx.closePath();
        ctx.fill();
        // Top ornament
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx, base - 62, 4, 0, Math.PI * 2);
        ctx.fill();
        // Scalloped edge
        ctx.fillStyle = '#F0E040';
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const sx = cx + Math.cos(a) * 40;
            const sy = base - 26 + Math.sin(a) * 16;
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    function renderFerrisWheel(frame = 0) {
        const w = TW * 3 + 20, h = TH * 3 + 110;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 16;
        // Support structure
        ctx.strokeStyle = '#6080A0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 30, base);
        ctx.lineTo(cx, base - 80);
        ctx.lineTo(cx + 30, base);
        ctx.stroke();
        // Cross bracing
        ctx.strokeStyle = '#5070A0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 15, base - 40);
        ctx.lineTo(cx + 15, base - 40);
        ctx.stroke();
        // Wheel rim
        const wheelCX = cx, wheelCY = base - 80;
        ctx.strokeStyle = '#7090B0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, 42, 0, Math.PI * 2);
        ctx.stroke();
        // Inner ring
        ctx.strokeStyle = '#6080A0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, 30, 0, Math.PI * 2);
        ctx.stroke();
        // Spokes & cabins
        const cabinColors = ['#E84040', '#4080E8', '#E8C040', '#40C080', '#E860A0', '#A060E0', '#FF8C40', '#40C0C0'];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + frame * 0.01;
            const sx = wheelCX + Math.cos(angle) * 42;
            const sy = wheelCY + Math.sin(angle) * 42;
            // Spoke
            ctx.strokeStyle = '#8090A0';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(wheelCX, wheelCY);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            // Cabin
            ctx.fillStyle = cabinColors[i];
            ctx.beginPath();
            ctx.roundRect(sx - 6, sy - 2, 12, 10, 3);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(sx - 4, sy, 8, 4);
        }
        // Center hub
        ctx.fillStyle = '#A0B0C0';
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(wheelCX, wheelCY, 3, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    function renderRollerCoaster() {
        const w = TW * 4 + 20, h = TH * 3 + 120;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 16;
        // Support structure
        ctx.strokeStyle = '#8060A0';
        ctx.lineWidth = 2;
        // Left tower
        ctx.beginPath();
        ctx.moveTo(cx - 60, base);
        ctx.lineTo(cx - 55, base - 90);
        ctx.moveTo(cx - 48, base);
        ctx.lineTo(cx - 53, base - 90);
        ctx.stroke();
        // Cross braces
        for (let y = base - 20; y > base - 90; y -= 18) {
            ctx.beginPath();
            ctx.moveTo(cx - 60 + (base - y) * 0.05, y);
            ctx.lineTo(cx - 48 - (base - y) * 0.05, y);
            ctx.stroke();
        }
        // Right tower (smaller)
        ctx.beginPath();
        ctx.moveTo(cx + 40, base);
        ctx.lineTo(cx + 42, base - 50);
        ctx.moveTo(cx + 52, base);
        ctx.lineTo(cx + 50, base - 50);
        ctx.stroke();
        for (let y = base - 15; y > base - 50; y -= 15) {
            ctx.beginPath();
            ctx.moveTo(cx + 40, y);
            ctx.lineTo(cx + 52, y);
            ctx.stroke();
        }
        // Track (the fun part!)
        ctx.strokeStyle = '#D040D0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 70, base - 10);
        ctx.bezierCurveTo(cx - 60, base - 95, cx - 45, base - 95, cx - 20, base - 50);
        ctx.bezierCurveTo(cx, base - 10, cx + 10, base - 10, cx + 20, base - 30);
        ctx.bezierCurveTo(cx + 30, base - 55, cx + 45, base - 55, cx + 55, base - 30);
        ctx.bezierCurveTo(cx + 65, base - 10, cx + 75, base - 10, cx + 80, base - 10);
        ctx.stroke();
        // Rail highlights
        ctx.strokeStyle = 'rgba(255,100,255,0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx - 55, base - 90);
        ctx.quadraticCurveTo(cx - 40, base - 60, cx - 20, base - 50);
        ctx.stroke();
        // Cart on track
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.roundRect(cx - 30, base - 56, 16, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#4444FF';
        ctx.beginPath();
        ctx.roundRect(cx - 14, base - 54, 16, 8, 2);
        ctx.fill();
        // Flag on top
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 55, base - 98, 2, 10);
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.moveTo(cx - 53, base - 98);
        ctx.lineTo(cx - 43, base - 94);
        ctx.lineTo(cx - 53, base - 90);
        ctx.closePath();
        ctx.fill();
        return c;
    }

    function renderBumperCars() {
        const w = TW * 2 + 10, h = TH * 2 + 36;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 10;
        // Floor
        ctx.fillStyle = '#505060';
        ctx.beginPath();
        ctx.ellipse(cx, base - 8, 38, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#606070';
        ctx.beginPath();
        ctx.ellipse(cx, base - 8, 38, 16, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // Cars
        const carData = [
            { x: -14, y: -10, col: '#E84040', rot: 0.3 },
            { x: 10, y: -6, col: '#4080E8', rot: -0.5 },
            { x: -4, y: -14, col: '#E8C040', rot: 0.8 },
            { x: 16, y: -14, col: '#40C080', rot: -0.2 },
        ];
        carData.forEach(car => {
            ctx.save();
            ctx.translate(cx + car.x, base + car.y);
            ctx.rotate(car.rot);
            ctx.fillStyle = car.col;
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.ellipse(-2, -1, 4, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        // Canopy poles
        ctx.fillStyle = '#888';
        [[cx - 30, base - 32], [cx + 30, base - 32], [cx - 30, base - 4], [cx + 30, base - 4]].forEach(([px, py]) => {
            ctx.fillRect(px - 1, py, 2, 24);
        });
        // Canopy
        ctx.fillStyle = 'rgba(255, 200, 60, 0.7)';
        ctx.beginPath();
        ctx.ellipse(cx, base - 30, 38, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    function renderTeaCups(frame = 0) {
        const w = TW * 2 + 10, h = TH * 2 + 40;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 10;
        // Platform
        ctx.fillStyle = '#D0A0D0';
        ctx.beginPath();
        ctx.ellipse(cx, base - 6, 36, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#C090C0';
        ctx.beginPath();
        ctx.ellipse(cx, base - 6, 36, 14, 0, 0, Math.PI);
        ctx.fill();
        // Tea cups
        const cupColors = ['#FF8888', '#88CCFF', '#FFDD66', '#88DDAA', '#CC88FF'];
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + frame * 0.02;
            const cpx = cx + Math.cos(angle) * 22;
            const cpy = base - 8 + Math.sin(angle) * 9;
            ctx.fillStyle = cupColors[i];
            // Cup body
            ctx.beginPath();
            ctx.moveTo(cpx - 7, cpy - 2);
            ctx.lineTo(cpx - 5, cpy - 10);
            ctx.lineTo(cpx + 5, cpy - 10);
            ctx.lineTo(cpx + 7, cpy - 2);
            ctx.closePath();
            ctx.fill();
            // Cup top
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.ellipse(cpx, cpy - 10, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Handle
            ctx.strokeStyle = cupColors[i];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cpx + 7, cpy - 6, 3, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();
        }
        // Center teapot
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(cx, base - 14, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E8C000';
        ctx.beginPath();
        ctx.ellipse(cx, base - 14, 8, 6, 0, 0, Math.PI);
        ctx.fill();
        // Spout
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 1, base - 22, 2, 8);
        ctx.beginPath();
        ctx.arc(cx, base - 22, 3, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    function renderLogFlume() {
        const w = TW * 3 + 10, h = TH * 2 + 60;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 12;
        // Water channel
        ctx.fillStyle = '#4898C8';
        ctx.beginPath();
        ctx.moveTo(cx - 60, base - 10);
        ctx.quadraticCurveTo(cx - 40, base - 8, cx - 20, base - 20);
        ctx.quadraticCurveTo(cx, base - 50, cx + 10, base - 50);
        ctx.quadraticCurveTo(cx + 30, base - 50, cx + 40, base - 30);
        ctx.quadraticCurveTo(cx + 50, base - 10, cx + 60, base - 6);
        ctx.lineTo(cx + 60, base);
        ctx.lineTo(cx - 60, base);
        ctx.closePath();
        ctx.fill();
        // Channel walls
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 60, base - 12);
        ctx.quadraticCurveTo(cx - 40, base - 10, cx - 20, base - 22);
        ctx.quadraticCurveTo(cx, base - 54, cx + 10, base - 54);
        ctx.quadraticCurveTo(cx + 30, base - 54, cx + 40, base - 32);
        ctx.quadraticCurveTo(cx + 50, base - 12, cx + 60, base - 8);
        ctx.stroke();
        // Log boat
        ctx.fillStyle = '#8B5E14';
        ctx.beginPath();
        ctx.ellipse(cx - 30, base - 16, 12, 5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#704A0F';
        ctx.beginPath();
        ctx.ellipse(cx - 30, base - 16, 12, 5, -0.2, 0, Math.PI);
        ctx.fill();
        // Splash at bottom
        ctx.fillStyle = 'rgba(150, 210, 255, 0.5)';
        for (let i = 0; i < 6; i++) {
            const sx = cx + 48 + i * 3;
            const sy = base - 10 - Math.random() * 8;
            ctx.beginPath();
            ctx.arc(sx, sy, 2 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Structure supports
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(cx - 5, base - 50, 4, 46);
        ctx.fillRect(cx + 25, base - 40, 4, 38);
        return c;
    }

    function renderDropTower() {
        const w = TW * 2 + 10, h = TH * 2 + 100;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 10;
        // Main tower
        ctx.fillStyle = '#6070A0';
        ctx.fillRect(cx - 6, base - 90, 12, 86);
        ctx.fillStyle = '#5060A0';
        ctx.fillRect(cx - 6, base - 90, 6, 86);
        // Support rails
        ctx.strokeStyle = '#8090C0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 10, base - 4);
        ctx.lineTo(cx - 8, base - 90);
        ctx.moveTo(cx + 10, base - 4);
        ctx.lineTo(cx + 8, base - 90);
        ctx.stroke();
        // Cross braces
        ctx.strokeStyle = 'rgba(128,144,192,0.5)';
        ctx.lineWidth = 1;
        for (let y = base - 20; y > base - 90; y -= 16) {
            ctx.beginPath();
            ctx.moveTo(cx - 9, y);
            ctx.lineTo(cx + 9, y);
            ctx.stroke();
        }
        // Gondola/seat ring
        const gondolaY = base - 40;
        ctx.fillStyle = '#FF6040';
        ctx.beginPath();
        ctx.ellipse(cx, gondolaY, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E04020';
        ctx.beginPath();
        ctx.ellipse(cx, gondolaY, 16, 6, 0, 0, Math.PI);
        ctx.fill();
        // Seats
        ctx.fillStyle = '#333';
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const sx = cx + Math.cos(a) * 14;
            const sy = gondolaY + Math.sin(a) * 5;
            ctx.fillRect(sx - 2, sy, 4, 5);
        }
        // Top cap
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx, base - 92, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E8B800';
        ctx.beginPath();
        ctx.arc(cx, base - 92, 8, 0, Math.PI);
        ctx.fill();
        // Base platform
        ctx.fillStyle = '#505060';
        ctx.beginPath();
        ctx.ellipse(cx, base - 2, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    // ---- Food Stalls ----
    function renderFoodStall(type) {
        const c = createCanvas(TW + 16, TH + 36);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        const colors = {
            burger_stand: { roof: '#E84040', body: '#F5DEB3', accent: '#FFD700' },
            ice_cream_cart: { roof: '#FF8CC8', body: '#FFF0F5', accent: '#88DDFF' },
            drinks_booth: { roof: '#40A0E8', body: '#E0F0FF', accent: '#FFD700' },
            cotton_candy: { roof: '#CC88FF', body: '#FFF0FF', accent: '#FF88CC' },
            pizza_stand: { roof: '#FF6040', body: '#FFF8E0', accent: '#40A040' },
        };
        const col = colors[type] || colors.burger_stand;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Counter
        drawIsoBox(ctx, cx - 16, base - 14, 32, 16, 8, col.body, '#C8B898', '#D0C0A0');
        // Awning
        ctx.fillStyle = col.roof;
        ctx.beginPath();
        ctx.moveTo(cx - 20, base - 28);
        ctx.lineTo(cx + 20, base - 28);
        ctx.lineTo(cx + 22, base - 20);
        ctx.lineTo(cx - 22, base - 20);
        ctx.closePath();
        ctx.fill();
        // Awning stripes
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(cx - 18 + i * 12, base - 28, 4, 8);
        }
        // Sign
        ctx.fillStyle = col.accent;
        ctx.beginPath();
        ctx.roundRect(cx - 10, base - 34, 20, 7, 2);
        ctx.fill();
        return c;
    }

    // ---- Buildings ----
    function renderRestroom() {
        const c = createCanvas(TW + 12, TH + 36);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawIsoBox(ctx, cx - 14, base - 24, 28, 14, 16, '#D0D8E0', '#A0A8B0', '#B8C0C8');
        // Door
        ctx.fillStyle = '#6080A0';
        ctx.fillRect(cx - 4, base - 10, 8, 10);
        // Sign
        ctx.fillStyle = '#4080D0';
        ctx.beginPath();
        ctx.roundRect(cx - 6, base - 28, 12, 6, 2);
        ctx.fill();
        return c;
    }

    function renderGiftShop() {
        const c = createCanvas(TW + 16, TH + 40);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawIsoBox(ctx, cx - 16, base - 24, 32, 16, 16, '#FFE0B0', '#D0A870', '#E0B880');
        // Display window
        ctx.fillStyle = 'rgba(100,180,255,0.3)';
        ctx.fillRect(cx - 10, base - 12, 20, 8);
        // Roof
        ctx.fillStyle = '#E84080';
        ctx.beginPath();
        ctx.moveTo(cx, base - 36);
        ctx.lineTo(cx + 20, base - 22);
        ctx.lineTo(cx - 20, base - 22);
        ctx.closePath();
        ctx.fill();
        // Gift box on top
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 3, base - 40, 6, 5);
        ctx.fillStyle = '#FF4040';
        ctx.fillRect(cx - 1, base - 40, 2, 5);
        ctx.fillRect(cx - 3, base - 38, 6, 1);
        return c;
    }

    function renderInfoBooth() {
        const c = createCanvas(TW + 8, TH + 30);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        drawIsoBox(ctx, cx - 12, base - 16, 24, 12, 10, '#B0D0E0', '#80A0B0', '#90B0C0');
        // "i" sign
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, base - 22, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4080D0';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('i', cx, base - 19);
        return c;
    }

    function renderFirstAid() {
        const c = createCanvas(TW + 12, TH + 32);
        const ctx = c.getContext('2d');
        const cx = c.width / 2, base = c.height - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        drawIsoBox(ctx, cx - 14, base - 20, 28, 14, 14, '#FFFFFF', '#D0D0D0', '#E0E0E0');
        // Red cross
        ctx.fillStyle = '#E84040';
        ctx.fillRect(cx - 2, base - 18, 4, 12);
        ctx.fillRect(cx - 6, base - 14, 12, 4);
        return c;
    }

    function renderEntrance() {
        const w = TW * 2 + 20, h = TH + 60;
        const c = createCanvas(w, h);
        const ctx = c.getContext('2d');
        const cx = w / 2, base = h - 10;
        // Gate posts
        ctx.fillStyle = '#C8A060';
        ctx.fillRect(cx - 36, base - 48, 8, 44);
        ctx.fillRect(cx + 28, base - 48, 8, 44);
        // Arch
        ctx.strokeStyle = '#C8A060';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, base - 44, 34, Math.PI, 0);
        ctx.stroke();
        // Sign
        ctx.fillStyle = '#E84040';
        ctx.beginPath();
        ctx.roundRect(cx - 26, base - 56, 52, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PARKOPIA', cx, base - 44);
        // Decorative balls on posts
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx - 32, base - 50, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 32, base - 50, 5, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    // ---- Guest ----
    function renderGuest(color) {
        const c = createCanvas(20, 32);
        const ctx = c.getContext('2d');
        const cx = 10, base = 30;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, base, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillStyle = '#445';
        ctx.fillRect(cx - 4, base - 8, 3, 7);
        ctx.fillRect(cx + 1, base - 8, 3, 7);
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(cx - 5, base - 18, 10, 12, 3);
        ctx.fill();
        // Body shading
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.roundRect(cx, base - 18, 5, 12, [0, 3, 3, 0]);
        ctx.fill();
        // Head
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath();
        ctx.arc(cx, base - 22, 5, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx - 2, base - 23, 0.8, 0, Math.PI * 2);
        ctx.arc(cx + 2, base - 23, 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Hair
        const hairColors = { '#E84040': '#4a2810', '#4080E8': '#2a1a0a', '#E8C040': '#8B4513', '#40C080': '#3a1a08', '#E860A0': '#654321' };
        ctx.fillStyle = hairColors[color] || '#5a3818';
        ctx.beginPath();
        ctx.arc(cx, base - 24, 5, Math.PI * 0.9, Math.PI * 0.1, true);
        ctx.fill();
        // Smile
        ctx.strokeStyle = '#B8856E';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, base - 20, 2.5, 0.1, Math.PI - 0.1);
        ctx.stroke();
        return c;
    }

    // ---- Selection highlight ----
    function renderSelection() {
        const c = createCanvas(TW + 4, TH + 4);
        const ctx = c.getContext('2d');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        drawDiamond(ctx, 2, 2, TW, TH, null, 'rgba(255, 255, 255, 0.8)');
        return c;
    }

    function renderPlacementValid() {
        const c = createCanvas(TW + 4, TH + 4);
        const ctx = c.getContext('2d');
        drawDiamond(ctx, 2, 2, TW, TH, 'rgba(78, 205, 196, 0.3)', 'rgba(78, 205, 196, 0.7)');
        return c;
    }

    function renderPlacementInvalid() {
        const c = createCanvas(TW + 4, TH + 4);
        const ctx = c.getContext('2d');
        drawDiamond(ctx, 2, 2, TW, TH, 'rgba(255, 107, 107, 0.3)', 'rgba(255, 107, 107, 0.7)');
        return c;
    }

    // ---- Get or create cached asset ----
    function get(key, renderFn, ...args) {
        const cacheKey = key + (args.length ? '_' + args.join('_') : '');
        if (!cache[cacheKey]) {
            cache[cacheKey] = renderFn(...args);
        }
        return cache[cacheKey];
    }

    // ---- Public API ----
    return {
        getGrass: (v) => get('grass_' + v, renderGrass, v),
        getWater: (f) => renderWater(f), // animated, no cache
        getPath: (conn, wide) => get('path_' + wide, renderPath, conn, wide),
        getTree: () => get('tree', renderTree),
        getFlowers: () => get('flowers', renderFlowers),
        getFountain: (f) => renderFountain(f), // animated
        getBench: () => get('bench', renderBench),
        getLamp: () => get('lamp', renderLamp),
        getTrashCan: () => get('trash_can', renderTrashCan),
        getStatue: () => get('statue', renderStatue),
        getHedge: () => get('hedge', renderHedge),
        getCarousel: (f) => renderCarousel(f), // animated
        getFerrisWheel: (f) => renderFerrisWheel(f), // animated
        getRollerCoaster: () => get('roller_coaster', renderRollerCoaster),
        getBumperCars: () => get('bumper_cars', renderBumperCars),
        getTeaCups: (f) => renderTeaCups(f), // animated
        getLogFlume: () => get('log_flume', renderLogFlume),
        getDropTower: () => get('drop_tower', renderDropTower),
        getFoodStall: (type) => get('food_' + type, renderFoodStall, type),
        getRestroom: () => get('restroom', renderRestroom),
        getGiftShop: () => get('gift_shop', renderGiftShop),
        getInfoBooth: () => get('info_booth', renderInfoBooth),
        getFirstAid: () => get('first_aid', renderFirstAid),
        getEntrance: () => get('entrance', renderEntrance),
        getGuest: (color) => get('guest_' + color, renderGuest, color),
        getSelection: () => get('selection', renderSelection),
        getPlacementValid: () => get('pv', renderPlacementValid),
        getPlacementInvalid: () => get('pi', renderPlacementInvalid),

        // Return the sprite for a building type
        getForType(type, frame) {
            switch (type) {
                case 'path': return this.getPath({}, false);
                case 'wide_path': return this.getPath({}, true);
                case 'tree': return this.getTree();
                case 'flower_bed': return this.getFlowers();
                case 'fountain': return this.getFountain(frame || 0);
                case 'bench': return this.getBench();
                case 'lamp': return this.getLamp();
                case 'trash_can': return this.getTrashCan();
                case 'statue': return this.getStatue();
                case 'hedge': return this.getHedge();
                case 'carousel': return this.getCarousel(frame || 0);
                case 'ferris_wheel': return this.getFerrisWheel(frame || 0);
                case 'roller_coaster': return this.getRollerCoaster();
                case 'bumper_cars': return this.getBumperCars();
                case 'tea_cups': return this.getTeaCups(frame || 0);
                case 'log_flume': return this.getLogFlume();
                case 'drop_tower': return this.getDropTower();
                case 'burger_stand': return this.getFoodStall('burger_stand');
                case 'ice_cream_cart': return this.getFoodStall('ice_cream_cart');
                case 'drinks_booth': return this.getFoodStall('drinks_booth');
                case 'cotton_candy': return this.getFoodStall('cotton_candy');
                case 'pizza_stand': return this.getFoodStall('pizza_stand');
                case 'restroom': return this.getRestroom();
                case 'gift_shop': return this.getGiftShop();
                case 'info_booth': return this.getInfoBooth();
                case 'first_aid': return this.getFirstAid();
                case 'entrance': return this.getEntrance();
                default: return this.getTree();
            }
        },

        // Generate a small thumbnail for toolbar
        getThumbnail(type) {
            const key = 'thumb_' + type;
            if (cache[key]) return cache[key];
            const sprite = this.getForType(type, 0);
            const maxDim = 40;
            const scale = Math.min(maxDim / sprite.width, maxDim / sprite.height, 1);
            const tc = document.createElement('canvas');
            tc.width = Math.ceil(sprite.width * scale);
            tc.height = Math.ceil(sprite.height * scale);
            const tctx = tc.getContext('2d');
            tctx.drawImage(sprite, 0, 0, tc.width, tc.height);
            cache[key] = tc;
            return tc;
        },

        clearAnimationCache() {
            // Remove cached animated sprites so they re-render
            Object.keys(cache).forEach(k => {
                if (k.startsWith('fountain') || k.startsWith('carousel') ||
                    k.startsWith('ferris') || k.startsWith('tea_cups') || k.startsWith('water')) {
                    delete cache[k];
                }
            });
        },
    };
})();
