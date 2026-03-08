// ============================================================
//  PARKOPIA – World / Grid / Placement
// ============================================================

const World = (() => {
    const W = CONFIG.GRID_WIDTH;
    const H = CONFIG.GRID_HEIGHT;

    // Grid layers
    let terrain = [];   // 2D: 'grass' | 'water' | 'dirt'
    let objects = [];    // 2D: null | { type, id, originX, originY, ... }
    let objectsList = []; // flat list of all placed objects
    let nextId = 1;
    let entrancePos = null;

    // Initialize the grid
    function init() {
        terrain = [];
        objects = [];
        objectsList = [];
        nextId = 1;
        entrancePos = null;

        for (let y = 0; y < H; y++) {
            terrain[y] = [];
            objects[y] = [];
            for (let x = 0; x < W; x++) {
                terrain[y][x] = 'grass';
                objects[y][x] = null;
            }
        }

        // Create some natural features
        generateTerrain();

        // Place entrance at a fixed position
        placeEntrance();
    }

    function generateTerrain() {
        // Create a pond (top-left area, away from build zone)
        const pondCX = 6 + Math.floor(Math.random() * 8);
        const pondCY = 6 + Math.floor(Math.random() * 8);
        for (let y = pondCY - 3; y <= pondCY + 3; y++) {
            for (let x = pondCX - 4; x <= pondCX + 4; x++) {
                if (x >= 0 && x < W && y >= 0 && y < H) {
                    const dx = x - pondCX, dy = y - pondCY;
                    if (dx * dx / 16 + dy * dy / 9 < 1) {
                        terrain[y][x] = 'water';
                    }
                }
            }
        }

        // Create another smaller pond (bottom-right area)
        const p2x = W - 12 + Math.floor(Math.random() * 6);
        const p2y = H - 12 + Math.floor(Math.random() * 6);
        for (let y = p2y - 2; y <= p2y + 2; y++) {
            for (let x = p2x - 3; x <= p2x + 3; x++) {
                if (x >= 0 && x < W && y >= 0 && y < H) {
                    const dx = x - p2x, dy = y - p2y;
                    if (dx * dx / 9 + dy * dy / 4 < 1) {
                        terrain[y][x] = 'water';
                    }
                }
            }
        }

        // Scatter natural trees (avoid the central build area near entrance)
        const entranceX = Math.floor(W / 2) - 1;
        const entranceY = H - 3;
        for (let i = 0; i < 40; i++) {
            const tx = 2 + Math.floor(Math.random() * (W - 4));
            const ty = 2 + Math.floor(Math.random() * (H - 4));
            // Keep a clear area around the entrance for building
            const dx = Math.abs(tx - entranceX);
            const dy = entranceY - ty;
            if (dx < 15 && dy > 0 && dy < 22) continue; // skip build zone
            if (terrain[ty][tx] === 'grass' && !objects[ty][tx]) {
                const obj = {
                    type: 'tree',
                    id: nextId++,
                    originX: tx,
                    originY: ty,
                    natural: true,
                };
                objects[ty][tx] = obj;
                objectsList.push(obj);
            }
        }
    }

    function placeEntrance() {
        // Place entrance near the bottom-left area of the map
        const ex = Math.floor(W / 2) - 1;
        const ey = H - 3;
        entrancePos = { x: ex, y: ey };

        const def = BUILDINGS.entrance;
        const obj = {
            type: 'entrance',
            id: nextId++,
            originX: ex,
            originY: ey,
            sizeW: def.size[0],
            sizeH: def.size[1],
        };

        for (let dy = 0; dy < def.size[1]; dy++) {
            for (let dx = 0; dx < def.size[0]; dx++) {
                const px = ex + dx, py = ey + dy;
                if (px < W && py < H) {
                    objects[py][px] = obj;
                    terrain[py][px] = 'grass';
                }
            }
        }
        objectsList.push(obj);

        // Place initial path from entrance inward
        for (let i = 1; i <= 5; i++) {
            const py = ey - i;
            if (py >= 0) {
                placeObject('path', ex, py);
            }
        }
    }

    function getTerrain(x, y) {
        if (x < 0 || x >= W || y < 0 || y >= H) return null;
        return terrain[y][x];
    }

    function getObject(x, y) {
        if (x < 0 || x >= W || y < 0 || y >= H) return null;
        return objects[y][x];
    }

    function inBounds(x, y) {
        return x >= 0 && x < W && y >= 0 && y < H;
    }

    function canPlace(type, x, y) {
        const def = BUILDINGS[type];
        if (!def) return false;
        const sw = def.size[0], sh = def.size[1];
        for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
                const px = x + dx, py = y + dy;
                if (!inBounds(px, py)) return false;
                if (terrain[py][px] === 'water') return false;
                if (objects[py][px] !== null) return false;
            }
        }
        return true;
    }

    function placeObject(type, x, y) {
        const def = BUILDINGS[type];
        if (!def) return null;
        if (!canPlace(type, x, y)) return null;

        const sw = def.size[0], sh = def.size[1];
        const obj = {
            type,
            id: nextId++,
            originX: x,
            originY: y,
            sizeW: sw,
            sizeH: sh,
            // Ride state
            queue: [],
            riders: [],
            rideTimer: 0,
            totalRiders: 0,
            revenue: 0,
        };

        for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
                objects[y + dy][x + dx] = obj;
            }
        }
        objectsList.push(obj);
        return obj;
    }

    function removeObject(x, y) {
        const obj = getObject(x, y);
        if (!obj) return false;
        if (obj.type === 'entrance') return false; // Can't remove entrance

        const sw = obj.sizeW || 1;
        const sh = obj.sizeH || 1;
        for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
                const px = obj.originX + dx;
                const py = obj.originY + dy;
                if (inBounds(px, py)) {
                    objects[py][px] = null;
                }
            }
        }
        const idx = objectsList.indexOf(obj);
        if (idx !== -1) objectsList.splice(idx, 1);

        return true;
    }

    function isWalkable(x, y) {
        if (!inBounds(x, y)) return false;
        const obj = objects[y][x];
        if (obj && (obj.type === 'path' || obj.type === 'wide_path' || obj.type === 'entrance')) return true;
        return false;
    }

    function isPathAdjacent(x, y) {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            if (isWalkable(x + dx, y + dy)) return true;
        }
        return false;
    }

    function getEntrancePos() {
        return entrancePos;
    }

    function getAllObjects() {
        return objectsList;
    }

    function getRides() {
        return objectsList.filter(o => BUILDINGS[o.type]?.category === 'rides');
    }

    function getFoodStalls() {
        return objectsList.filter(o => BUILDINGS[o.type]?.category === 'food');
    }

    function getBuildings() {
        return objectsList.filter(o => BUILDINGS[o.type]?.category === 'buildings');
    }

    function getScenery() {
        return objectsList.filter(o => BUILDINGS[o.type]?.category === 'scenery');
    }

    // Calculate park beauty score around a point
    function getBeautyAt(x, y, radius = 5) {
        let beauty = 0;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const obj = getObject(x + dx, y + dy);
                if (obj) {
                    const def = BUILDINGS[obj.type];
                    if (def?.beauty) beauty += def.beauty;
                }
            }
        }
        return beauty;
    }

    // Check if there's a trash can nearby
    function hasTrashCanNear(x, y) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const obj = getObject(x + dx, y + dy);
                if (obj && obj.type === 'trash_can') return true;
            }
        }
        return false;
    }

    function getGridSize() {
        return { width: W, height: H };
    }

    // ---- Custom Coaster Track System ----

    // Get all track pieces connected to a coaster station via BFS
    function getConnectedTracks(station) {
        if (!station || !BUILDINGS[station.type]?.isCoasterStation) return [];

        const visited = new Set();
        const tracks = [];
        const queue = [];

        // Seed BFS from all tiles occupied by the station
        const sw = station.sizeW || 1;
        const sh = station.sizeH || 1;
        for (let dy = -1; dy <= sh; dy++) {
            for (let dx = -1; dx <= sw; dx++) {
                if (dx >= 0 && dx < sw && dy >= 0 && dy < sh) continue; // skip station tiles
                const nx = station.originX + dx;
                const ny = station.originY + dy;
                const key = nx + ',' + ny;
                if (!inBounds(nx, ny) || visited.has(key)) continue;
                const obj = objects[ny][nx];
                if (obj && BUILDINGS[obj.type]?.isTrack) {
                    visited.add(key);
                    tracks.push(obj);
                    queue.push(obj);
                }
            }
        }

        // BFS through connected track pieces
        while (queue.length > 0) {
            const current = queue.shift();
            const cx = current.originX;
            const cy = current.originY;
            const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            for (const [ddx, ddy] of neighbors) {
                const nx = cx + ddx;
                const ny = cy + ddy;
                const key = nx + ',' + ny;
                if (!inBounds(nx, ny) || visited.has(key)) continue;
                visited.add(key);
                const obj = objects[ny][nx];
                if (obj && BUILDINGS[obj.type]?.isTrack) {
                    tracks.push(obj);
                    queue.push(obj);
                }
            }
        }

        return tracks;
    }

    // Check if tracks form a circuit (loop back to station)
    function validateCircuit(station) {
        if (!station || !BUILDINGS[station.type]?.isCoasterStation) return false;
        const tracks = getConnectedTracks(station);
        if (tracks.length < 4) return false; // Need at least 4 tracks for a loop

        // Check if any track piece is adjacent to the station on a DIFFERENT side
        // than where it was first connected. We need at least 2 station-adjacent tracks.
        const sw = station.sizeW || 1;
        const sh = station.sizeH || 1;
        const stationTiles = new Set();
        for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
                stationTiles.add((station.originX + dx) + ',' + (station.originY + dy));
            }
        }

        // Count how many tracks touch the station
        let touchCount = 0;
        for (const t of tracks) {
            const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            for (const [ddx, ddy] of neighbors) {
                const key = (t.originX + ddx) + ',' + (t.originY + ddy);
                if (stationTiles.has(key)) {
                    touchCount++;
                    break; // count each track only once
                }
            }
        }

        // A circuit needs at least 2 different tracks touching the station
        return touchCount >= 2;
    }

    // Calculate dynamic excitement for a coaster station
    function getCoasterExcitement(station) {
        if (!station || !BUILDINGS[station.type]?.isCoasterStation) {
            const def = BUILDINGS[station?.type];
            return def?.excitement || 0;
        }

        const baseDef = BUILDINGS[station.type];
        let excitement = baseDef.excitement || 3;
        const tracks = getConnectedTracks(station);

        // Sum excitement bonuses from track pieces
        for (const t of tracks) {
            const tDef = BUILDINGS[t.type];
            if (tDef?.excitementBonus) {
                excitement += tDef.excitementBonus;
            }
        }

        // Circuit bonus: +3 excitement if tracks form a complete loop
        if (validateCircuit(station)) {
            excitement += 3;
        }

        return Math.min(10, excitement); // Cap at 10
    }

    // Check if a position is adjacent to a track or coaster station
    function isTrackAdjacent(x, y) {
        const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (const [dx, dy] of neighbors) {
            const obj = getObject(x + dx, y + dy);
            if (obj) {
                const def = BUILDINGS[obj.type];
                if (def?.isTrack || def?.isCoasterStation) return true;
            }
        }
        return false;
    }

    // Get connection bitmask for a track tile (which neighbors are tracks/station)
    // Returns {n, e, s, w} booleans + a string key for caching
    function getTrackConnections(x, y) {
        const dirs = [
            { key: 'n', dx: 0, dy: -1 },
            { key: 'e', dx: 1, dy: 0 },
            { key: 's', dx: 0, dy: 1 },
            { key: 'w', dx: -1, dy: 0 },
        ];
        const conn = { n: false, e: false, s: false, w: false };
        for (const d of dirs) {
            const obj = getObject(x + d.dx, y + d.dy);
            if (obj) {
                const def = BUILDINGS[obj.type];
                if (def?.isTrack || def?.isCoasterStation) {
                    conn[d.key] = true;
                }
            }
        }
        conn.key = (conn.n ? 'N' : '') + (conn.e ? 'E' : '') + (conn.s ? 'S' : '') + (conn.w ? 'W' : '') || 'X';
        return conn;
    }

    // Find the station a track piece is connected to (if any)
    function findStationForTrack(trackObj) {
        if (!trackObj || !BUILDINGS[trackObj.type]?.isTrack) return null;

        const visited = new Set();
        const queue = [trackObj];
        visited.add(trackObj.originX + ',' + trackObj.originY);

        while (queue.length > 0) {
            const current = queue.shift();
            const cx = current.originX;
            const cy = current.originY;
            const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            for (const [ddx, ddy] of neighbors) {
                const nx = cx + ddx;
                const ny = cy + ddy;
                const key = nx + ',' + ny;
                if (!inBounds(nx, ny) || visited.has(key)) continue;
                visited.add(key);
                const obj = objects[ny][nx];
                if (!obj) continue;
                if (BUILDINGS[obj.type]?.isCoasterStation) return obj;
                if (BUILDINGS[obj.type]?.isTrack) {
                    queue.push(obj);
                }
            }
        }
        return null;
    }

    return {
        init,
        getTerrain,
        getObject,
        inBounds,
        canPlace,
        placeObject,
        removeObject,
        isWalkable,
        isPathAdjacent,
        getEntrancePos,
        getAllObjects,
        getRides,
        getFoodStalls,
        getBuildings,
        getScenery,
        getBeautyAt,
        hasTrashCanNear,
        getGridSize,
        getConnectedTracks,
        validateCircuit,
        getCoasterExcitement,
        isTrackAdjacent,
        getTrackConnections,
        findStationForTrack,
    };
})();
