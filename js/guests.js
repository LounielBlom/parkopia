// ============================================================
//  PARKOPIA – Guest Simulation
// ============================================================

const Guests = (() => {
    let guests = [];
    let nextGuestId = 1;
    const GUEST_COLORS = [
        '#E84040', '#4080E8', '#E8C040', '#40C080', '#E860A0',
        '#A060E0', '#FF8C40', '#40C0C0', '#80D040', '#D06040',
        '#6080FF', '#FF60FF', '#60FFB0', '#FFB060', '#B060FF',
    ];

    const STATES = {
        ENTERING: 'entering',
        WANDERING: 'wandering',
        GOING_TO_RIDE: 'going_to_ride',
        QUEUING: 'queuing',
        RIDING: 'riding',
        GOING_TO_FOOD: 'going_to_food',
        EATING: 'eating',
        GOING_TO_RESTROOM: 'going_to_restroom',
        USING_RESTROOM: 'using_restroom',
        SITTING: 'sitting',
        LEAVING: 'leaving',
    };

    function spawnGuest() {
        const entrance = World.getEntrancePos();
        if (!entrance) return null;
        if (guests.length >= CONFIG.MAX_GUESTS) return null;

        const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
        const guest = {
            id: nextGuestId++,
            x: entrance.x,
            y: entrance.y,
            px: 0, py: 0, // sub-tile pixel offset for smooth movement
            color,
            state: STATES.ENTERING,
            path: null,
            pathIndex: 0,
            moveProgress: 0,
            // Needs (0-100)
            happiness: 70 + Math.random() * 20,
            hunger: 20 + Math.random() * 20,
            thirst: 15 + Math.random() * 15,
            bathroom: 5 + Math.random() * 10,
            energy: 80 + Math.random() * 20,
            // State
            targetObj: null,
            ridesRidden: 0,
            moneySpent: 0,
            patience: CONFIG.GUEST_PATIENCE + Math.random() * 200,
            waitTimer: 0,
            actionTimer: 0,
            wanderTimer: 0,
            stayTimer: 6000 + Math.random() * 8000, // how long they'll stay
            // Visual
            bobPhase: Math.random() * Math.PI * 2,
        };
        guests.push(guest);
        return guest;
    }

    function update(tick) {
        for (let i = guests.length - 1; i >= 0; i--) {
            const g = guests[i];
            g.bobPhase += 0.08;
            g.stayTimer--;

            // Decay needs over time (gentle rates)
            g.hunger = Math.min(100, g.hunger + 0.008);
            g.thirst = Math.min(100, g.thirst + 0.01);
            g.bathroom = Math.min(100, g.bathroom + 0.005);
            g.energy = Math.max(0, g.energy - 0.004);

            // Happiness decays from bad needs
            if (g.hunger > 70) g.happiness = Math.max(0, g.happiness - 0.015);
            if (g.thirst > 80) g.happiness = Math.max(0, g.happiness - 0.015);
            if (g.bathroom > 85) g.happiness = Math.max(0, g.happiness - 0.025);
            if (g.energy < 20) g.happiness = Math.max(0, g.happiness - 0.01);

            // Beauty boost
            const beauty = World.getBeautyAt(g.x, g.y, 3);
            if (beauty > 5) g.happiness = Math.min(100, g.happiness + 0.008);

            // Cleanliness check
            if (!World.hasTrashCanNear(g.x, g.y)) {
                g.happiness = Math.max(0, g.happiness - 0.002);
            }

            // Should leave? (don't interrupt active seeking behavior)
            if (g.stayTimer <= 0 || g.happiness < 10) {
                const busyStates = [STATES.LEAVING, STATES.RIDING, STATES.QUEUING, STATES.EATING,
                                     STATES.GOING_TO_FOOD, STATES.GOING_TO_RESTROOM, STATES.USING_RESTROOM];
                if (!busyStates.includes(g.state)) {
                    startLeaving(g);
                }
            }

            switch (g.state) {
                case STATES.ENTERING:
                case STATES.WANDERING:
                    updateWandering(g, tick);
                    break;
                case STATES.GOING_TO_RIDE:
                case STATES.GOING_TO_FOOD:
                case STATES.GOING_TO_RESTROOM:
                case STATES.LEAVING:
                    updateMoving(g);
                    break;
                case STATES.QUEUING:
                    updateQueuing(g);
                    break;
                case STATES.RIDING:
                    updateRiding(g);
                    break;
                case STATES.EATING:
                case STATES.USING_RESTROOM:
                case STATES.SITTING:
                    updateAction(g);
                    break;
            }

            // Remove guests that have left
            if (g.state === STATES.LEAVING && !g.path) {
                guests.splice(i, 1);
            }
        }
    }

    function updateWandering(g, tick) {
        // If the guest has a path, follow it
        if (g.path && g.pathIndex < g.path.length) {
            updateMoving(g);
            return;
        }

        // No path — waiting, decide what to do next
        g.wanderTimer--;
        if (g.wanderTimer <= 0) {
            // Prioritize needs
            if (g.bathroom > 70) {
                goToFacility(g, 'restroom', STATES.GOING_TO_RESTROOM);
                return;
            }
            if (g.hunger > 60) {
                goToFood(g);
                return;
            }
            if (g.thirst > 65) {
                goToFood(g, true); // prefer drinks
                return;
            }
            if (g.energy < 30) {
                goToSeat(g);
                return;
            }

            // Go to a ride!
            if (Math.random() < 0.6) {
                goToRide(g);
                return;
            }

            // Random wander
            wanderRandomly(g);
        }
    }

    function wanderRandomly(g) {
        g.wanderTimer = 30 + Math.floor(Math.random() * 60);
        // Pick a random walkable tile nearby
        const range = 5;
        let attempts = 10;
        while (attempts-- > 0) {
            const tx = g.x + Math.floor(Math.random() * range * 2) - range;
            const ty = g.y + Math.floor(Math.random() * range * 2) - range;
            if (World.isWalkable(tx, ty)) {
                g.path = Pathfinding.findPath(g.x, g.y, tx, ty, World.isWalkable);
                if (g.path) {
                    g.pathIndex = 0;
                    g.moveProgress = 0;
                    return;
                }
            }
        }
    }

    function goToRide(g) {
        const rides = World.getRides();
        if (rides.length === 0) {
            wanderRandomly(g);
            return;
        }

        // Pick a random ride (prefer ones with shorter queues)
        const sorted = rides.slice().sort((a, b) => (a.queue?.length || 0) - (b.queue?.length || 0));
        const ride = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];

        // Find a walkable tile adjacent to the ride
        const target = findAdjacentWalkable(ride);
        if (!target) {
            wanderRandomly(g);
            return;
        }

        g.path = Pathfinding.findPath(g.x, g.y, target.x, target.y, World.isWalkable);
        if (g.path) {
            g.state = STATES.GOING_TO_RIDE;
            g.targetObj = ride;
            g.pathIndex = 0;
            g.moveProgress = 0;
        } else {
            wanderRandomly(g);
        }
    }

    function goToFood(g, preferDrinks = false) {
        const stalls = World.getFoodStalls();
        if (stalls.length === 0) {
            wanderRandomly(g);
            return;
        }

        let target = null;
        if (preferDrinks) {
            target = stalls.find(s => s.type === 'drinks_booth');
        }
        if (!target) {
            target = stalls[Math.floor(Math.random() * stalls.length)];
        }

        const walkable = findAdjacentWalkable(target);
        if (!walkable) {
            wanderRandomly(g);
            return;
        }

        g.path = Pathfinding.findPath(g.x, g.y, walkable.x, walkable.y, World.isWalkable);
        if (g.path) {
            g.state = STATES.GOING_TO_FOOD;
            g.targetObj = target;
            g.pathIndex = 0;
            g.moveProgress = 0;
        } else {
            wanderRandomly(g);
        }
    }

    function goToFacility(g, type, state) {
        const buildings = World.getBuildings().filter(b => b.type === type);
        if (buildings.length === 0) {
            wanderRandomly(g);
            return;
        }

        const target = buildings[Math.floor(Math.random() * buildings.length)];
        const walkable = findAdjacentWalkable(target);
        if (!walkable) {
            wanderRandomly(g);
            return;
        }

        g.path = Pathfinding.findPath(g.x, g.y, walkable.x, walkable.y, World.isWalkable);
        if (g.path) {
            g.state = state;
            g.targetObj = target;
            g.pathIndex = 0;
            g.moveProgress = 0;
        } else {
            wanderRandomly(g);
        }
    }

    function goToSeat(g) {
        const benches = World.getScenery().filter(s => s.type === 'bench');
        if (benches.length === 0) {
            wanderRandomly(g);
            return;
        }

        const target = benches[Math.floor(Math.random() * benches.length)];
        const walkable = findAdjacentWalkable(target);
        if (!walkable) {
            wanderRandomly(g);
            return;
        }

        g.path = Pathfinding.findPath(g.x, g.y, walkable.x, walkable.y, World.isWalkable);
        if (g.path) {
            g.state = STATES.SITTING;
            g.targetObj = target;
            g.pathIndex = 0;
            g.moveProgress = 0;
            g.actionTimer = 100 + Math.random() * 100;
        } else {
            wanderRandomly(g);
        }
    }

    function startLeaving(g) {
        const entrance = World.getEntrancePos();
        if (!entrance) return;

        g.path = Pathfinding.findPath(g.x, g.y, entrance.x, entrance.y, World.isWalkable);
        if (g.path) {
            g.state = STATES.LEAVING;
            g.pathIndex = 0;
            g.moveProgress = 0;
        } else {
            // Can't find exit, just remove
            g.path = null;
            g.state = STATES.LEAVING;
        }
    }

    function findAdjacentWalkable(obj) {
        const sw = obj.sizeW || 1;
        const sh = obj.sizeH || 1;
        const candidates = [];
        for (let dy = -1; dy <= sh; dy++) {
            for (let dx = -1; dx <= sw; dx++) {
                if (dx >= 0 && dx < sw && dy >= 0 && dy < sh) continue;
                const px = obj.originX + dx;
                const py = obj.originY + dy;
                if (World.isWalkable(px, py)) {
                    candidates.push({ x: px, y: py });
                }
            }
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function updateMoving(g) {
        if (!g.path || g.pathIndex >= g.path.length) {
            // Arrived at destination
            onArrival(g);
            return;
        }

        const target = g.path[g.pathIndex];
        g.moveProgress += CONFIG.GUEST_SPEED;

        if (g.moveProgress >= 1) {
            g.moveProgress = 0;
            g.x = target.x;
            g.y = target.y;
            g.px = 0;
            g.py = 0;
            g.pathIndex++;
        } else {
            // Interpolate position for smooth movement
            const dx = target.x - g.x;
            const dy = target.y - g.y;
            g.px = dx * g.moveProgress;
            g.py = dy * g.moveProgress;
        }
    }

    function onArrival(g) {
        g.path = null;
        g.px = 0;
        g.py = 0;

        switch (g.state) {
            case STATES.GOING_TO_RIDE:
                if (g.targetObj && g.targetObj.queue) {
                    const def = BUILDINGS[g.targetObj.type];
                    if (g.targetObj.queue.length < (def?.capacity || 8) * 2) {
                        g.state = STATES.QUEUING;
                        g.targetObj.queue.push(g);
                        g.waitTimer = 0;
                    } else {
                        // Queue too long
                        g.happiness = Math.max(0, g.happiness - 5);
                        g.state = STATES.WANDERING;
                        g.wanderTimer = 30;
                    }
                } else {
                    g.state = STATES.WANDERING;
                    g.wanderTimer = 30;
                }
                break;

            case STATES.GOING_TO_FOOD:
                if (g.targetObj) {
                    const def = BUILDINGS[g.targetObj.type];
                    g.state = STATES.EATING;
                    g.actionTimer = 60 + Math.random() * 40;
                    g.hunger = Math.max(0, g.hunger - (def?.hungerRelief || 30));
                    g.thirst = Math.max(0, g.thirst - (def?.thirstRelief || 15));
                    if (def?.happinessBoost) g.happiness = Math.min(100, g.happiness + def.happinessBoost);
                    // Pay for food
                    const price = def?.foodPrice || 5;
                    g.moneySpent += price;
                    g.targetObj.revenue = (g.targetObj.revenue || 0) + price;
                    g.targetObj.totalRiders = (g.targetObj.totalRiders || 0) + 1;
                    Economy.addIncome(price, 'Food sale');
                } else {
                    g.state = STATES.WANDERING;
                    g.wanderTimer = 30;
                }
                break;

            case STATES.GOING_TO_RESTROOM:
                if (g.targetObj) {
                    g.state = STATES.USING_RESTROOM;
                    g.actionTimer = 40 + Math.random() * 30;
                    g.bathroom = 0;
                    g.happiness = Math.min(100, g.happiness + 5);
                } else {
                    g.state = STATES.WANDERING;
                    g.wanderTimer = 30;
                }
                break;

            case STATES.LEAVING:
                // Will be removed in update loop
                break;

            default:
                g.state = STATES.WANDERING;
                g.wanderTimer = 30;
                break;
        }
    }

    function updateQueuing(g) {
        g.waitTimer++;
        g.happiness = Math.max(0, g.happiness - 0.02);

        if (g.waitTimer > g.patience) {
            // Give up waiting
            if (g.targetObj?.queue) {
                const idx = g.targetObj.queue.indexOf(g);
                if (idx !== -1) g.targetObj.queue.splice(idx, 1);
            }
            g.happiness = Math.max(0, g.happiness - 15);
            g.state = STATES.WANDERING;
            g.wanderTimer = 30;
            g.targetObj = null;
        }
    }

    function updateRiding(g) {
        g.actionTimer--;
        if (g.actionTimer <= 0) {
            const def = BUILDINGS[g.targetObj?.type];
            if (def) {
                g.happiness = Math.min(100, g.happiness + def.excitement * 3);
                g.energy = Math.max(0, g.energy - 5);
            }
            g.ridesRidden++;
            g.state = STATES.WANDERING;
            g.wanderTimer = 60 + Math.floor(Math.random() * 60);
            g.targetObj = null;
        }
    }

    function updateAction(g) {
        g.actionTimer--;
        if (g.actionTimer <= 0) {
            if (g.state === STATES.SITTING) {
                g.energy = Math.min(100, g.energy + 30);
            }
            g.state = STATES.WANDERING;
            g.wanderTimer = 30 + Math.floor(Math.random() * 60);
            g.targetObj = null;
        }
    }

    // Process ride cycles
    function updateRides() {
        const rides = World.getRides();
        for (const ride of rides) {
            const def = BUILDINGS[ride.type];
            if (!def) continue;

            if (ride.riders && ride.riders.length > 0) {
                ride.rideTimer--;
                if (ride.rideTimer <= 0) {
                    // Ride finished, unload
                    for (const g of ride.riders) {
                        g.state = STATES.WANDERING;
                        g.wanderTimer = 60;
                        const adjWalk = findAdjacentWalkable(ride);
                        if (adjWalk) {
                            g.x = adjWalk.x;
                            g.y = adjWalk.y;
                        }
                    }
                    ride.riders = [];
                }
            } else if (ride.queue && ride.queue.length > 0) {
                // Load guests from queue
                const capacity = def.capacity || 8;
                const toLoad = Math.min(capacity, ride.queue.length);
                ride.riders = ride.queue.splice(0, toLoad);
                ride.rideTimer = def.rideDuration || 200;

                for (const g of ride.riders) {
                    g.state = STATES.RIDING;
                    g.actionTimer = ride.rideTimer;
                    g.targetObj = ride;
                    // Pay for ride
                    const price = def.ticketPrice || 5;
                    g.moneySpent += price;
                    ride.revenue = (ride.revenue || 0) + price;
                    ride.totalRiders = (ride.totalRiders || 0) + 1;
                    Economy.addIncome(price, 'Ride ticket');
                }
            }
        }
    }

    function getAll() {
        return guests;
    }

    function getCount() {
        return guests.length;
    }

    function getAverageHappiness() {
        if (guests.length === 0) return 0;
        const sum = guests.reduce((s, g) => s + g.happiness, 0);
        return sum / guests.length;
    }

    function reset() {
        guests = [];
        nextGuestId = 1;
    }

    return {
        spawnGuest,
        update,
        updateRides,
        getAll,
        getCount,
        getAverageHappiness,
        reset,
        STATES,
    };
})();
