// ============================================================
//  PARKOPIA – Economy & Park Management
// ============================================================

const Economy = (() => {
    let money = CONFIG.STARTING_MONEY;
    let totalIncome = 0;
    let totalExpenses = 0;
    let dayIncome = 0;
    let dayExpenses = 0;
    let parkRating = 0;
    let day = 1;
    let tickInDay = 0;
    let totalGuestsEver = 0;
    let log = []; // recent transactions

    // Adjustable entrance fee
    let entranceFee = CONFIG.ENTRANCE_FEE;

    function addIncome(amount, source) {
        money += amount;
        totalIncome += amount;
        dayIncome += amount;
        addLog('+$' + amount, source, 'income');
    }

    function spend(amount, reason) {
        if (money < amount) return false;
        money -= amount;
        totalExpenses += amount;
        dayExpenses += amount;
        addLog('-$' + amount, reason, 'expense');
        return true;
    }

    function canAfford(amount) {
        return money >= amount;
    }

    function addLog(amountStr, desc, type) {
        log.push({ amountStr, desc, type, day, tick: tickInDay });
        if (log.length > 50) log.shift();
    }

    // ---- Entrance Fee ----
    function getEntranceFee() { return entranceFee; }
    function setEntranceFee(val) {
        entranceFee = Math.max(0, Math.min(50, Math.round(val)));
    }

    // ---- Per-Object Pricing ----
    function getEffectivePrice(obj) {
        if (obj.customPrice !== undefined) return obj.customPrice;
        const def = BUILDINGS[obj.type];
        if (def?.ticketPrice !== undefined) return def.ticketPrice;
        if (def?.foodPrice !== undefined) return def.foodPrice;
        return 0;
    }

    function setObjectPrice(obj, price) {
        const def = BUILDINGS[obj.type];
        const basePrice = def?.ticketPrice ?? def?.foodPrice ?? 0;
        // Clamp between 0 and 5x the base price (min $1 step)
        obj.customPrice = Math.max(0, Math.min(basePrice * 5, Math.round(price)));
    }

    function getBasePrice(obj) {
        const def = BUILDINGS[obj.type];
        return def?.ticketPrice ?? def?.foodPrice ?? 0;
    }

    // ---- Update ----
    function update(tick) {
        tickInDay++;

        // Upkeep costs
        if (tickInDay % CONFIG.UPKEEP_INTERVAL === 0) {
            let upkeepTotal = 0;
            const allObjects = World.getAllObjects();
            for (const obj of allObjects) {
                const def = BUILDINGS[obj.type];
                if (def?.upkeep) {
                    upkeepTotal += def.upkeep;
                }
            }
            if (upkeepTotal > 0) {
                money -= upkeepTotal;
                totalExpenses += upkeepTotal;
                dayExpenses += upkeepTotal;
                addLog('-$' + upkeepTotal, 'Upkeep', 'expense');
            }
        }

        // Day cycle
        if (tickInDay >= CONFIG.TICKS_PER_DAY) {
            tickInDay = 0;
            day++;
            dayIncome = 0;
            dayExpenses = 0;
            // Award daily XP
            if (typeof Levels !== 'undefined') Levels.addXP(5, 'daily');
        }

        // Update park rating
        updateRating();
    }

    function updateRating() {
        let score = 0;
        const rides = World.getRides();
        const food = World.getFoodStalls();
        const scenery = World.getScenery();
        const buildings = World.getBuildings();

        // Ride variety and excitement
        const rideTypes = new Set(rides.map(r => r.type));
        score += rideTypes.size * 8;
        rides.forEach(r => {
            const def = BUILDINGS[r.type];
            if (def?.excitement) score += def.excitement * 2;
        });

        // Food variety
        const foodTypes = new Set(food.map(f => f.type));
        score += foodTypes.size * 5;

        // Scenery beauty
        scenery.forEach(s => {
            const def = BUILDINGS[s.type];
            if (def?.beauty) score += def.beauty * 0.5;
        });

        // Facilities
        if (buildings.some(b => b.type === 'restroom')) score += 10;
        if (buildings.some(b => b.type === 'first_aid')) score += 5;
        if (buildings.some(b => b.type === 'info_booth')) score += 5;

        // Guest happiness
        const avgHappy = Guests.getAverageHappiness();
        score += avgHappy * 0.3;

        // Normalize to 0-5 scale
        parkRating = Math.min(5, Math.max(0, score / 40));
    }

    function getSpawnRate() {
        // Better rating = more guests
        const baseRate = CONFIG.GUEST_SPAWN_RATE;
        const ratingFactor = Math.max(0.3, 1 - (parkRating / 5) * 0.7);

        // Price elasticity: entrance fee affects demand
        const feeRatio = entranceFee / CONFIG.ENTRANCE_FEE;
        // At default price (ratio=1): priceFactor = 1.0 (no change)
        // At free entry (ratio=0): priceFactor = 0.5 (2x faster spawns)
        // At 2x price (ratio=2): priceFactor = 1.7 (70% slower)
        // At 5x price (ratio=5): priceFactor = 3.0 (capped)
        const priceFactor = Math.max(0.5, Math.min(3.0, 0.3 + 0.7 * feeRatio));

        return Math.floor(baseRate * ratingFactor * priceFactor);
    }

    function getMoney() { return money; }
    function getRating() { return parkRating; }
    function getDay() { return day; }
    function getDayIncome() { return dayIncome; }
    function getDayExpenses() { return dayExpenses; }
    function getTotalIncome() { return totalIncome; }
    function getTotalExpenses() { return totalExpenses; }
    function getLog() { return log; }

    function guestEntered() {
        totalGuestsEver++;
        addIncome(entranceFee, 'Entrance fee');
        if (typeof Levels !== 'undefined') Levels.addXP(1, 'entrance');
    }

    function getTotalGuestsEver() { return totalGuestsEver; }

    function reset() {
        money = CONFIG.STARTING_MONEY;
        totalIncome = 0;
        totalExpenses = 0;
        dayIncome = 0;
        dayExpenses = 0;
        parkRating = 0;
        day = 1;
        tickInDay = 0;
        totalGuestsEver = 0;
        log = [];
        entranceFee = CONFIG.ENTRANCE_FEE;
    }

    return {
        addIncome,
        spend,
        canAfford,
        update,
        getSpawnRate,
        getMoney,
        getRating,
        getDay,
        getDayIncome,
        getDayExpenses,
        getTotalIncome,
        getTotalExpenses,
        getLog,
        guestEntered,
        getTotalGuestsEver,
        getEntranceFee,
        setEntranceFee,
        getEffectivePrice,
        setObjectPrice,
        getBasePrice,
        reset,
    };
})();
