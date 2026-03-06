// ============================================================
//  PARKOPIA – A* Pathfinding on the tile grid
// ============================================================

const Pathfinding = (() => {
    // Simple binary min-heap for priority queue
    class MinHeap {
        constructor() { this.data = []; }
        push(node) {
            this.data.push(node);
            this._bubbleUp(this.data.length - 1);
        }
        pop() {
            const top = this.data[0];
            const last = this.data.pop();
            if (this.data.length > 0) {
                this.data[0] = last;
                this._sinkDown(0);
            }
            return top;
        }
        get size() { return this.data.length; }
        _bubbleUp(i) {
            while (i > 0) {
                const parent = (i - 1) >> 1;
                if (this.data[i].f < this.data[parent].f) {
                    [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
                    i = parent;
                } else break;
            }
        }
        _sinkDown(i) {
            const n = this.data.length;
            while (true) {
                let smallest = i;
                const l = 2 * i + 1, r = 2 * i + 2;
                if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
                if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
                if (smallest !== i) {
                    [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
                    i = smallest;
                } else break;
            }
        }
    }

    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

    function heuristic(ax, ay, bx, by) {
        return Math.abs(ax - bx) + Math.abs(ay - by);
    }

    /**
     * Find shortest path from (sx,sy) to (ex,ey) walking only on walkable tiles.
     * isWalkable(x, y) => boolean
     * Returns array of {x, y} or null if no path found.
     */
    function findPath(sx, sy, ex, ey, isWalkable, maxSteps = 500) {
        if (!isWalkable(sx, sy) || !isWalkable(ex, ey)) return null;
        if (sx === ex && sy === ey) return [{ x: sx, y: sy }];

        const open = new MinHeap();
        const gScore = {};
        const cameFrom = {};
        const key = (x, y) => x + ',' + y;

        const startKey = key(sx, sy);
        gScore[startKey] = 0;
        open.push({ x: sx, y: sy, f: heuristic(sx, sy, ex, ey) });

        let steps = 0;
        while (open.size > 0 && steps < maxSteps) {
            steps++;
            const current = open.pop();
            const ck = key(current.x, current.y);

            if (current.x === ex && current.y === ey) {
                // Reconstruct path
                const path = [];
                let k = ck;
                while (k) {
                    const [px, py] = k.split(',').map(Number);
                    path.unshift({ x: px, y: py });
                    k = cameFrom[k];
                }
                return path;
            }

            const currentG = gScore[ck];

            for (const [dx, dy] of DIRS) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (!isWalkable(nx, ny)) continue;

                const nk = key(nx, ny);
                const tentativeG = currentG + 1;

                if (gScore[nk] === undefined || tentativeG < gScore[nk]) {
                    gScore[nk] = tentativeG;
                    cameFrom[nk] = ck;
                    open.push({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny, ex, ey) });
                }
            }
        }
        return null; // No path found
    }

    /**
     * Find the nearest tile matching a predicate.
     * Returns {x, y} or null.
     */
    function findNearest(sx, sy, isWalkable, predicate, maxDist = 30) {
        const visited = new Set();
        const queue = [{ x: sx, y: sy, d: 0 }];
        visited.add(sx + ',' + sy);

        while (queue.length > 0) {
            const { x, y, d } = queue.shift();
            if (d > maxDist) continue;
            if (predicate(x, y)) return { x, y };

            for (const [dx, dy] of DIRS) {
                const nx = x + dx;
                const ny = y + dy;
                const nk = nx + ',' + ny;
                if (!visited.has(nk) && isWalkable(nx, ny)) {
                    visited.add(nk);
                    queue.push({ x: nx, y: ny, d: d + 1 });
                }
            }
        }
        return null;
    }

    return { findPath, findNearest };
})();
