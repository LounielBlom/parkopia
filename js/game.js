// ============================================================
//  PARKOPIA – Main Game Loop & Isometric Engine
// ============================================================

const Game = (() => {
    const TW = CONFIG.TILE_W;
    const TH = CONFIG.TILE_H;

    let canvas, ctx;
    let width, height;
    let animFrame;
    let tick = 0;
    let gameSpeed = 1; // 0=pause, 1=normal, 2=fast, 3=ultra
    let guestSpawnTimer = 0;

    // Camera
    let camX = 0, camY = 0;
    let zoom = 0.8;
    let targetZoom = 0.8;

    // Input state
    let mouseX = 0, mouseY = 0;
    let mouseDown = false;
    let mouseDragStart = null;
    let camDragStart = null;
    let hoveredTile = null;
    let keys = {};

    // Placement drag state
    let isDraggingPlace = false;
    let dragPlacedTiles = new Set();

    // Placement flash effects
    let placeFlashes = []; // { x, y, alpha, sizeW, sizeH }

    // Guest tooltip
    let hoveredGuest = null;

    // ---- Coordinate transforms ----
    function worldToScreen(wx, wy) {
        const sx = (wx - wy) * (TW / 2);
        const sy = (wx + wy) * (TH / 2);
        return {
            x: (sx - camX) * zoom + width / 2,
            y: (sy - camY) * zoom + height / 2,
        };
    }

    function screenToWorld(sx, sy) {
        const rx = (sx - width / 2) / zoom + camX;
        const ry = (sy - height / 2) / zoom + camY;
        const wx = (rx / (TW / 2) + ry / (TH / 2)) / 2;
        const wy = (ry / (TH / 2) - rx / (TW / 2)) / 2;
        return { x: Math.floor(wx), y: Math.floor(wy) };
    }

    // ---- Init ----
    function init() {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');

        resize();
        window.addEventListener('resize', resize);

        // Initialize systems
        World.init();
        Economy.reset();
        Guests.reset();
        Levels.reset();
        UI.init();

        // Center camera slightly above entrance for a good overview
        const entrance = World.getEntrancePos();
        if (entrance) {
            const eScreen = tileToIso(entrance.x, entrance.y - 5);
            camX = eScreen.x;
            camY = eScreen.y;
        }
        zoom = 1.0;
        targetZoom = 1.0;

        setupInput();
        showWelcome();
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function tileToIso(tx, ty) {
        return {
            x: (tx - ty) * (TW / 2),
            y: (tx + ty) * (TH / 2),
        };
    }

    // ---- Welcome Screen ----
    function showWelcome() {
        const overlay = document.createElement('div');
        overlay.id = 'welcome-overlay';
        overlay.innerHTML = `
            <div class="welcome-card">
                <h1>PARKOPIA</h1>
                <p>Build the theme park of your dreams! Place rides, food stalls, and scenery to attract guests and grow your park.</p>
                <button class="welcome-start" id="start-btn">Start Building</button>
                <div class="controls-hint">
                    <span class="key">Click + Drag</span> Pan camera &nbsp;
                    <span class="key">Scroll</span> Zoom &nbsp;
                    <span class="key">Esc</span> Cancel build<br>
                    <span class="key">WASD</span> Move camera &nbsp;
                    <span class="key">1-5</span> Quick-select category
                </div>
            </div>
        `;
        document.getElementById('game-container').appendChild(overlay);

        // Start rendering behind the overlay
        gameLoop();

        document.getElementById('start-btn').addEventListener('click', () => {
            overlay.style.transition = 'opacity 0.4s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
        });
    }

    // ---- Input ----
    function setupInput() {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Touch support
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
    }

    function onMouseDown(e) {
        if (e.button === 0) {
            mouseDown = true;
            mouseDragStart = { x: e.clientX, y: e.clientY };
            camDragStart = { x: camX, y: camY };
            isDraggingPlace = false;
            dragPlacedTiles = new Set();

            if (UI.isBuildMode() || UI.isDemolishMode()) {
                // Try to place/demolish immediately
                handlePlacement(e.clientX, e.clientY);
                isDraggingPlace = true;
            }
        }
    }

    function onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        hoveredTile = screenToWorld(e.clientX, e.clientY);

        // Detect guest under cursor
        hoveredGuest = getGuestAtScreen(e.clientX, e.clientY);

        if (mouseDown && mouseDragStart) {
            if (UI.isBuildMode() || UI.isDemolishMode()) {
                // Drag placing/demolishing
                if (isDraggingPlace) {
                    handlePlacement(e.clientX, e.clientY);
                }
            } else {
                // Camera drag
                const dx = e.clientX - mouseDragStart.x;
                const dy = e.clientY - mouseDragStart.y;
                camX = camDragStart.x - dx / zoom;
                camY = camDragStart.y - dy / zoom;
                canvas.classList.add('grabbing');
            }
        }
    }

    function onMouseUp(e) {
        mouseDown = false;
        canvas.classList.remove('grabbing');

        if (!UI.isBuildMode() && !UI.isDemolishMode()) {
            // Check if this was a click (not a drag)
            if (mouseDragStart) {
                const dx = Math.abs(e.clientX - mouseDragStart.x);
                const dy = Math.abs(e.clientY - mouseDragStart.y);
                if (dx < 5 && dy < 5) {
                    handleClick(e.clientX, e.clientY);
                }
            }
        }
        mouseDragStart = null;
        camDragStart = null;
        isDraggingPlace = false;
        dragPlacedTiles = new Set();
    }

    function onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
        targetZoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, targetZoom + delta));
    }

    function onKeyDown(e) {
        keys[e.key.toLowerCase()] = true;

        if (e.key === 'Escape') {
            UI.cancelBuild();
            document.getElementById('info-panel').classList.add('hidden');
        }

        // Quick-select categories
        const catMap = { '1': 'paths', '2': 'rides', '3': 'food', '4': 'scenery', '5': 'buildings' };
        if (catMap[e.key]) {
            const btn = document.querySelector(`[data-category="${catMap[e.key]}"]`);
            if (btn) btn.click();
        }
    }

    function onKeyUp(e) {
        keys[e.key.toLowerCase()] = false;
    }

    // Touch handlers
    let lastTouchDist = 0;
    function onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            mouseDown = true;
            mouseDragStart = { x: t.clientX, y: t.clientY };
            camDragStart = { x: camX, y: camY };
            hoveredTile = screenToWorld(t.clientX, t.clientY);

            if (UI.isBuildMode() || UI.isDemolishMode()) {
                handlePlacement(t.clientX, t.clientY);
                isDraggingPlace = true;
            }
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            mouseX = t.clientX;
            mouseY = t.clientY;
            hoveredTile = screenToWorld(t.clientX, t.clientY);

            if (UI.isBuildMode() && isDraggingPlace) {
                handlePlacement(t.clientX, t.clientY);
            } else if (mouseDragStart) {
                const dx = t.clientX - mouseDragStart.x;
                const dy = t.clientY - mouseDragStart.y;
                camX = camDragStart.x - dx / zoom;
                camY = camDragStart.y - dy / zoom;
            }
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastTouchDist > 0) {
                const scale = dist / lastTouchDist;
                targetZoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, targetZoom * scale));
            }
            lastTouchDist = dist;
        }
    }

    function onTouchEnd(e) {
        mouseDown = false;
        isDraggingPlace = false;
        dragPlacedTiles = new Set();
        lastTouchDist = 0;
    }

    function handleClick(sx, sy) {
        const tile = screenToWorld(sx, sy);
        if (!World.inBounds(tile.x, tile.y)) return;

        const obj = World.getObject(tile.x, tile.y);
        if (obj && obj.type !== 'path' && obj.type !== 'wide_path') {
            UI.showObjectInfo(obj);
        }
    }

    function handlePlacement(sx, sy) {
        const tile = screenToWorld(sx, sy);
        if (!World.inBounds(tile.x, tile.y)) return;
        const tileKey = tile.x + ',' + tile.y;

        if (UI.isDemolishMode()) {
            if (dragPlacedTiles.has(tileKey)) return;
            const obj = World.getObject(tile.x, tile.y);
            if (obj && obj.type !== 'entrance') {
                const def = BUILDINGS[obj.type];
                const refund = Math.floor((def?.cost || 0) * 0.5);
                const sw = obj.sizeW || 1, sh = obj.sizeH || 1;
                const ox = obj.originX, oy = obj.originY;
                if (World.removeObject(tile.x, tile.y)) {
                    if (refund > 0) Economy.addIncome(refund, 'Demolish refund');
                    dragPlacedTiles.add(tileKey);
                    placeFlashes.push({ x: ox, y: oy, alpha: 0.5, sizeW: sw, sizeH: sh, color: '#ff6b6b' });
                }
            }
            return;
        }

        const item = UI.getSelectedItem();
        if (!item) return;
        if (dragPlacedTiles.has(tileKey)) return;

        const def = BUILDINGS[item];
        if (!def) return;

        if (!Economy.canAfford(def.cost)) {
            UI.showToast('Not enough money!', 'error');
            return;
        }

        if (!World.canPlace(item, tile.x, tile.y)) return;

        // For non-path buildings, require at least one edge tile adjacent to a path
        if (def.category !== 'paths') {
            let hasPath = false;
            const sw = def.size[0], sh = def.size[1];
            outer: for (let dy = -1; dy <= sh; dy++) {
                for (let dx = -1; dx <= sw; dx++) {
                    // Only check border tiles (not interior)
                    if (dx >= 0 && dx < sw && dy >= 0 && dy < sh) continue;
                    if (World.isWalkable(tile.x + dx, tile.y + dy)) { hasPath = true; break outer; }
                }
            }
            if (!hasPath) {
                if (!isDraggingPlace || dragPlacedTiles.size === 0) {
                    UI.showToast('Must be placed next to a path!', 'error');
                }
                return;
            }
        }

        if (Economy.spend(def.cost, 'Build ' + def.name)) {
            World.placeObject(item, tile.x, tile.y);
            dragPlacedTiles.add(tileKey);
            placeFlashes.push({ x: tile.x, y: tile.y, alpha: 0.6, sizeW: def.size[0], sizeH: def.size[1] });
        }
    }

    // ---- Game Loop ----
    function gameLoop() {
        update();
        render();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function update() {
        // Camera keyboard movement
        const camSpeed = CONFIG.CAMERA_SPEED / zoom;
        if (keys['w'] || keys['arrowup']) camY -= camSpeed;
        if (keys['s'] || keys['arrowdown']) camY += camSpeed;
        if (keys['a'] || keys['arrowleft']) camX -= camSpeed;
        if (keys['d'] || keys['arrowright']) camX += camSpeed;

        // Smooth zoom
        zoom += (targetZoom - zoom) * 0.15;

        // Game simulation (speed-dependent)
        for (let i = 0; i < gameSpeed; i++) {
            tick++;

            // Spawn guests
            guestSpawnTimer++;
            const spawnRate = Economy.getSpawnRate();
            if (guestSpawnTimer >= spawnRate) {
                guestSpawnTimer = 0;
                const g = Guests.spawnGuest();
                if (g) Economy.guestEntered();
            }

            Guests.update(tick);
            Guests.updateRides();
            Economy.update(tick);
        }

        UI.updateHUD();

        // Update hovered tile
        hoveredTile = screenToWorld(mouseX, mouseY);
    }

    // ---- Rendering ----
    function render() {
        ctx.clearRect(0, 0, width, height);

        // Sky gradient background
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(0.6, '#B0E0E6');
        skyGrad.addColorStop(1, '#98D4A2');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();

        const gridSize = World.getGridSize();

        // Determine visible tile range
        const topLeft = screenToWorld(0, 0);
        const topRight = screenToWorld(width, 0);
        const bottomLeft = screenToWorld(0, height);
        const bottomRight = screenToWorld(width, height);
        const margin = 4;
        const minX = Math.max(0, Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) - margin);
        const maxX = Math.min(gridSize.width - 1, Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + margin);
        const minY = Math.max(0, Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) - margin);
        const maxY = Math.min(gridSize.height - 1, Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + margin);

        // ---- Draw terrain ----
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const terrainType = World.getTerrain(x, y);
                if (!terrainType) continue;

                const sp = worldToScreen(x, y);
                let sprite;
                if (terrainType === 'water') {
                    sprite = Assets.getWater(tick);
                } else {
                    // Use position-seeded variant for natural look (4 variants)
                    const v = ((x * 7 + y * 13) & 0x7FFFFFFF) % 4;
                    sprite = Assets.getGrass(v);
                }
                const sw = sprite.width * zoom;
                const sh = sprite.height * zoom;
                // +1 to avoid subpixel gaps between tiles
                ctx.drawImage(sprite, sp.x - sw / 2, sp.y - sh / 2, sw + 1, sh + 1);
            }
        }

        // ---- Draw objects (sorted by y for depth) ----
        // Collect all renderable objects with their draw positions
        const renderList = [];
        const drawnOrigins = new Set();

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const obj = World.getObject(x, y);
                if (!obj) continue;

                const originKey = obj.originX + ',' + obj.originY;
                if (drawnOrigins.has(originKey)) continue;
                drawnOrigins.add(originKey);

                const sw = obj.sizeW || 1;
                const sh = obj.sizeH || 1;
                // Draw at the center-bottom of the footprint
                const centerX = obj.originX + sw / 2;
                const centerY = obj.originY + sh / 2;
                const sp = worldToScreen(centerX, centerY);

                renderList.push({
                    obj,
                    screenX: sp.x,
                    screenY: sp.y,
                    sortY: obj.originY + sh,
                    sortX: obj.originX + sw,
                });
            }
        }

        // Sort by depth (further back first)
        renderList.sort((a, b) => {
            const da = a.sortY + a.sortX;
            const db = b.sortY + b.sortX;
            return da - db;
        });

        // Draw objects
        for (const item of renderList) {
            const sprite = Assets.getForType(item.obj.type, tick);
            if (!sprite) continue;

            const drawX = item.screenX - (sprite.width * zoom) / 2;
            const drawY = item.screenY - (sprite.height * zoom) + (TH * zoom) / 2;

            ctx.drawImage(sprite, drawX, drawY, sprite.width * zoom, sprite.height * zoom);

            // Draw queue indicators for rides
            if (item.obj.queue && item.obj.queue.length > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.font = `${Math.round(10 * zoom)}px Fredoka, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(item.obj.queue.length + ' in queue', item.screenX, drawY - 4 * zoom);
            }
        }

        // ---- Draw guests ----
        const allGuests = Guests.getAll();
        // Sort guests by position for depth
        const sortedGuests = allGuests.slice().sort((a, b) => {
            return (a.y + a.py + a.x + a.px) - (b.y + b.py + b.x + b.px);
        });

        for (const g of sortedGuests) {
            if (g.state === Guests.STATES.RIDING) continue; // Don't render while on ride

            const gx = g.x + g.px;
            const gy = g.y + g.py;
            const sp = worldToScreen(gx + 0.5, gy + 0.5);

            const guestSprite = Assets.getGuest(g.color);
            const bob = Math.sin(g.bobPhase) * 1.5;
            const gw = guestSprite.width * zoom;
            const gh = guestSprite.height * zoom;

            ctx.drawImage(guestSprite, sp.x - gw / 2, sp.y - gh + bob * zoom, gw, gh);

            // Thought bubbles for unhappy guests
            if (g.happiness < 30) {
                ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
                ctx.font = `${Math.round(12 * zoom)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(':(', sp.x, sp.y - gh - 4 * zoom);
            } else if (g.hunger > 75) {
                ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
                ctx.font = `${Math.round(10 * zoom)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('hungry', sp.x, sp.y - gh - 4 * zoom);
            }
        }

        // ---- Guest hover tooltip ----
        if (hoveredGuest && !UI.isBuildMode() && !UI.isDemolishMode()) {
            renderGuestTooltip(hoveredGuest);
        }

        // ---- Placement flash effects ----
        for (let i = placeFlashes.length - 1; i >= 0; i--) {
            const f = placeFlashes[i];
            f.alpha -= 0.02;
            if (f.alpha <= 0) { placeFlashes.splice(i, 1); continue; }
            ctx.globalAlpha = f.alpha;
            ctx.fillStyle = f.color || '#4ecdc4';
            for (let dy = 0; dy < f.sizeH; dy++) {
                for (let dx = 0; dx < f.sizeW; dx++) {
                    const sp = worldToScreen(f.x + dx, f.y + dy);
                    ctx.beginPath();
                    ctx.moveTo(sp.x, sp.y - TH / 2 * zoom);
                    ctx.lineTo(sp.x + TW / 2 * zoom, sp.y);
                    ctx.lineTo(sp.x, sp.y + TH / 2 * zoom);
                    ctx.lineTo(sp.x - TW / 2 * zoom, sp.y);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }

        // ---- Placement ghost ----
        if (hoveredTile && World.inBounds(hoveredTile.x, hoveredTile.y)) {
            if (UI.isBuildMode() && UI.getSelectedItem()) {
                const item = UI.getSelectedItem();
                const def = BUILDINGS[item];
                if (def) {
                    const sw = def.size[0], sh = def.size[1];
                    let pathOk = def.category === 'paths';
                    if (!pathOk) {
                        for (let dy = -1; dy <= sh && !pathOk; dy++) {
                            for (let dx = -1; dx <= sw && !pathOk; dx++) {
                                if (dx >= 0 && dx < sw && dy >= 0 && dy < sh) continue;
                                if (World.isWalkable(hoveredTile.x + dx, hoveredTile.y + dy)) pathOk = true;
                            }
                        }
                    }
                    const valid = World.canPlace(item, hoveredTile.x, hoveredTile.y) &&
                                  Economy.canAfford(def.cost) && pathOk;

                    for (let dy = 0; dy < sh; dy++) {
                        for (let dx = 0; dx < sw; dx++) {
                            const sp = worldToScreen(hoveredTile.x + dx, hoveredTile.y + dy);
                            const indicator = valid ? Assets.getPlacementValid() : Assets.getPlacementInvalid();
                            const iw = indicator.width * zoom, ih = indicator.height * zoom;
                            ctx.drawImage(indicator, sp.x - iw / 2, sp.y - ih / 2, iw, ih);
                        }
                    }

                    // Ghost sprite
                    if (valid) {
                        ctx.globalAlpha = 0.5;
                        const sprite = Assets.getForType(item, tick);
                        const centerX = hoveredTile.x + sw / 2;
                        const centerY = hoveredTile.y + sh / 2;
                        const sp = worldToScreen(centerX, centerY);
                        const drawX = sp.x - (sprite.width * zoom) / 2;
                        const drawY = sp.y - (sprite.height * zoom) + (TH * zoom) / 2;
                        ctx.drawImage(sprite, drawX, drawY, sprite.width * zoom, sprite.height * zoom);
                        ctx.globalAlpha = 1;
                    }
                }
            } else if (UI.isDemolishMode()) {
                const sp = worldToScreen(hoveredTile.x, hoveredTile.y);
                const sel = Assets.getSelection();
                const sw2 = sel.width * zoom, sh2 = sel.height * zoom;
                ctx.drawImage(sel, sp.x - sw2 / 2, sp.y - sh2 / 2, sw2, sh2);
            } else if (!mouseDown) {
                // Subtle hover highlight
                const sp = worldToScreen(hoveredTile.x, hoveredTile.y);
                ctx.globalAlpha = 0.15;
                const sel = Assets.getPlacementValid();
                const sw2 = sel.width * zoom, sh2 = sel.height * zoom;
                ctx.drawImage(sel, sp.x - sw2 / 2, sp.y - sh2 / 2, sw2, sh2);
                ctx.globalAlpha = 1;
            }
        }

        ctx.restore();
    }

    // ---- Guest hover detection ----
    function getGuestAtScreen(sx, sy) {
        const allGuests = Guests.getAll();
        let closest = null;
        let closestDist = 20; // pixel radius for detection

        for (const g of allGuests) {
            if (g.state === Guests.STATES.RIDING) continue;
            const gx = g.x + g.px;
            const gy = g.y + g.py;
            const sp = worldToScreen(gx + 0.5, gy + 0.5);
            const dx = sx - sp.x;
            const dy = sy - (sp.y - 10 * zoom); // offset for sprite center
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = g;
            }
        }
        return closest;
    }

    function getGuestThought(g) {
        const thoughts = [];
        const STATES = Guests.STATES;

        // Needs-based thoughts
        if (g.hunger > 75) thoughts.push({ icon: '🍔', text: "I'm starving!", priority: 3 });
        else if (g.hunger > 55) thoughts.push({ icon: '🍕', text: 'Getting hungry...', priority: 1 });

        if (g.thirst > 80) thoughts.push({ icon: '🥤', text: 'So thirsty!', priority: 3 });
        else if (g.thirst > 60) thoughts.push({ icon: '💧', text: 'Need a drink', priority: 1 });

        if (g.bathroom > 80) thoughts.push({ icon: '🚻', text: 'Need a restroom NOW!', priority: 4 });
        else if (g.bathroom > 60) thoughts.push({ icon: '🚻', text: 'Looking for a restroom', priority: 2 });

        if (g.energy < 20) thoughts.push({ icon: '😴', text: 'So tired...', priority: 2 });
        else if (g.energy < 35) thoughts.push({ icon: '💤', text: 'Need to sit down', priority: 1 });

        // State-based thoughts
        if (g.state === STATES.QUEUING) {
            if (g.waitTimer > g.patience * 0.7) thoughts.push({ icon: '😤', text: 'This queue is too long!', priority: 3 });
            else thoughts.push({ icon: '⏳', text: 'Waiting in line...', priority: 0 });
        }
        if (g.state === STATES.RIDING) thoughts.push({ icon: '🎢', text: 'Wheee!', priority: 0 });
        if (g.state === STATES.EATING) thoughts.push({ icon: '😋', text: 'Yummy!', priority: 0 });
        if (g.state === STATES.SITTING) thoughts.push({ icon: '😌', text: 'Nice to rest', priority: 0 });
        if (g.state === STATES.LEAVING) thoughts.push({ icon: '👋', text: 'Time to go home', priority: 0 });

        // Happiness-based thoughts
        if (g.happiness > 85) thoughts.push({ icon: '😄', text: 'Best park ever!', priority: 0 });
        else if (g.happiness > 65) thoughts.push({ icon: '🙂', text: 'Having a good time', priority: 0 });
        else if (g.happiness < 25) thoughts.push({ icon: '😡', text: 'This park is awful!', priority: 3 });
        else if (g.happiness < 40) thoughts.push({ icon: '😕', text: 'Not having fun...', priority: 2 });

        // Price-related thoughts
        const entranceFee = Economy.getEntranceFee();
        if (entranceFee === 0) {
            thoughts.push({ icon: '🎟️', text: 'Free admission — nice!', priority: 0 });
        } else if (entranceFee >= 25) {
            thoughts.push({ icon: '💸', text: 'This park is pricey!', priority: 2 });
        } else if (entranceFee <= 3) {
            thoughts.push({ icon: '🤑', text: 'What a deal to get in!', priority: 0 });
        }

        // Ride desire
        if (g.state === STATES.WANDERING && g.ridesRidden === 0) {
            thoughts.push({ icon: '🎡', text: 'Want to ride something!', priority: 1 });
        }

        if (g.state === STATES.GOING_TO_RIDE && g.targetObj) {
            const def = BUILDINGS[g.targetObj.type];
            thoughts.push({ icon: '🎠', text: `Heading to ${def?.name || 'a ride'}`, priority: 0 });
        }
        if (g.state === STATES.GOING_TO_FOOD && g.targetObj) {
            const def = BUILDINGS[g.targetObj.type];
            thoughts.push({ icon: '🍽️', text: `Going to ${def?.name || 'eat'}`, priority: 0 });
        }

        // Pick highest priority thought
        thoughts.sort((a, b) => b.priority - a.priority);
        return thoughts[0] || { icon: '💭', text: 'Just looking around', priority: 0 };
    }

    function renderGuestTooltip(g) {
        const gx = g.x + g.px;
        const gy = g.y + g.py;
        const sp = worldToScreen(gx + 0.5, gy + 0.5);

        const thought = getGuestThought(g);

        // Tooltip background
        const tooltipW = 180;
        const tooltipH = 72;
        const tx = sp.x - tooltipW / 2;
        const ty = sp.y - 28 * zoom - tooltipH - 10;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(ctx, tx + 2, ty + 2, tooltipW, tooltipH, 8);
        ctx.fill();

        // Background
        ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
        roundRect(ctx, tx, ty, tooltipW, tooltipH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(247, 201, 72, 0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, tx, ty, tooltipW, tooltipH, 8);
        ctx.stroke();

        // Arrow
        ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
        ctx.beginPath();
        ctx.moveTo(sp.x - 6, ty + tooltipH);
        ctx.lineTo(sp.x, ty + tooltipH + 6);
        ctx.lineTo(sp.x + 6, ty + tooltipH);
        ctx.closePath();
        ctx.fill();

        // Guest name & ID
        ctx.fillStyle = '#f7c948';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Guest #${g.id}`, tx + 10, ty + 15);

        // Thought
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '11px Fredoka, sans-serif';
        ctx.fillText(`${thought.icon} ${thought.text}`, tx + 10, ty + 32);

        // Mini stat bars
        const barY = ty + 42;
        const barW = 36;
        const barH = 5;
        const barGap = 4;
        const labels = [
            { label: '😊', val: g.happiness / 100, color: '#4ecdc4' },
            { label: '🍔', val: 1 - g.hunger / 100, color: '#f7c948' },
            { label: '💧', val: 1 - g.thirst / 100, color: '#74b9ff' },
            { label: '⚡', val: g.energy / 100, color: '#ff9ff3' },
        ];

        labels.forEach((stat, i) => {
            const bx = tx + 10 + i * (barW + barGap + 12);
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#888';
            ctx.fillText(stat.label, bx, barY + 4);

            // Bar background
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            roundRect(ctx, bx + 13, barY - 2, barW, barH, 2);
            ctx.fill();

            // Bar fill
            ctx.fillStyle = stat.color;
            const fillW = Math.max(1, barW * Math.max(0, Math.min(1, stat.val)));
            roundRect(ctx, bx + 13, barY - 2, fillW, barH, 2);
            ctx.fill();
        });

        // Rides ridden
        ctx.fillStyle = '#8888aa';
        ctx.font = '9px Fredoka, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Rides: ${g.ridesRidden} | Spent: $${g.moneySpent}`, tx + 10, ty + 65);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function setSpeed(s) {
        gameSpeed = s;
    }

    function getTick() { return tick; }
    function getWorldToScreen() { return worldToScreen; }
    function getScreenToWorld() { return screenToWorld; }

    // Start the game
    window.addEventListener('DOMContentLoaded', init);

    return {
        setSpeed,
        getTick,
        getWorldToScreen,
        getScreenToWorld,
    };
})();
