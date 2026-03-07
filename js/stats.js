// ============================================================
//  PARKOPIA – Statistics & Recommendations Engine
// ============================================================

const Stats = (() => {

    // ---- Recommendations ----
    function getRecommendations() {
        const recs = [];
        const rides = World.getRides();
        const food = World.getFoodStalls();
        const scenery = World.getScenery();
        const buildings = World.getBuildings();
        const guests = Guests.getAll();
        const guestCount = guests.length;

        // Path connectivity check (skip paths, entrance, and natural scenery)
        const allObjs = World.getAllObjects();
        let disconnected = 0;
        for (const obj of allObjs) {
            if (obj.type === 'path' || obj.type === 'wide_path' || obj.type === 'entrance') continue;
            if (obj.natural) continue; // skip natural trees from terrain generation
            const def = BUILDINGS[obj.type];
            if (!def) continue;
            const sw = obj.sizeW || 1;
            const sh = obj.sizeH || 1;
            let hasPath = false;
            for (let dy = -1; dy <= sh && !hasPath; dy++) {
                for (let dx = -1; dx <= sw && !hasPath; dx++) {
                    if (dx >= 0 && dx < sw && dy >= 0 && dy < sh) continue;
                    if (World.isWalkable(obj.originX + dx, obj.originY + dy)) hasPath = true;
                }
            }
            if (!hasPath) disconnected++;
        }
        if (disconnected > 0) {
            recs.push({
                icon: '🛤️',
                text: `${disconnected} building${disconnected > 1 ? 's are' : ' is'} not connected to paths!`,
                priority: 'high',
            });
        }

        // Ride to guest ratio
        if (rides.length === 0 && guestCount > 0) {
            recs.push({ icon: '🎢', text: 'Build some rides to attract guests!', priority: 'high' });
        } else if (guestCount > 0 && rides.length < guestCount / 20) {
            recs.push({ icon: '🎡', text: 'Need more rides! Guests are waiting.', priority: 'medium' });
        }

        // Food to guest ratio
        if (food.length === 0 && guestCount > 5) {
            recs.push({ icon: '🍔', text: 'Guests are hungry! Build food stalls.', priority: 'high' });
        } else if (guestCount > 0 && food.length < guestCount / 25) {
            recs.push({ icon: '🍕', text: 'More food stalls needed for your guests.', priority: 'medium' });
        }

        // Drinks check
        const hasDrinks = food.some(f => f.type === 'drinks_booth');
        if (!hasDrinks && guestCount > 15) {
            recs.push({ icon: '🥤', text: 'Add a Drinks Booth — guests are thirsty!', priority: 'medium' });
        }

        // Restroom check
        const restrooms = buildings.filter(b => b.type === 'restroom');
        if (restrooms.length === 0 && guestCount > 10) {
            recs.push({ icon: '🚻', text: 'Build a Restroom — guests need facilities!', priority: 'high' });
        } else if (guestCount > 0 && restrooms.length < guestCount / 40) {
            recs.push({ icon: '🚻', text: 'Consider adding more restrooms.', priority: 'low' });
        }

        // Scenery / beauty
        const totalBeauty = scenery.reduce((sum, s) => sum + (BUILDINGS[s.type]?.beauty || 0), 0);
        if (totalBeauty < 10 && guestCount > 5) {
            recs.push({ icon: '🌳', text: 'Plant trees and flowers to boost happiness!', priority: 'medium' });
        }

        // Trash cans
        const trashCans = scenery.filter(s => s.type === 'trash_can');
        if (trashCans.length === 0 && guestCount > 10) {
            recs.push({ icon: '🗑️', text: 'Place trash cans to keep the park clean.', priority: 'medium' });
        }

        // Benches
        const benches = scenery.filter(s => s.type === 'bench');
        if (benches.length === 0 && guestCount > 15) {
            recs.push({ icon: '🪑', text: 'Add benches so tired guests can rest.', priority: 'low' });
        }

        // Queue warnings
        let longQueues = 0;
        for (const ride of rides) {
            if (ride.queue && ride.queue.length > 10) longQueues++;
        }
        if (longQueues > 0) {
            recs.push({ icon: '⏳', text: `${longQueues} ride${longQueues > 1 ? 's have' : ' has'} very long queues.`, priority: 'medium' });
        }

        // Average happiness warning
        const avgHappy = Guests.getAverageHappiness();
        if (guestCount > 5 && avgHappy < 40) {
            recs.push({ icon: '😟', text: 'Guest happiness is very low! Check their needs.', priority: 'high' });
        } else if (guestCount > 5 && avgHappy < 60) {
            recs.push({ icon: '😐', text: 'Happiness could be better. Add variety & scenery.', priority: 'low' });
        }

        // Ride variety
        const rideTypes = new Set(rides.map(r => r.type));
        if (rides.length >= 3 && rideTypes.size < 3) {
            recs.push({ icon: '🎠', text: 'Add more ride variety to boost your rating!', priority: 'low' });
        }

        // Level-up hint
        if (typeof Levels !== 'undefined') {
            const nextLvl = Levels.getXPForNextLevel();
            if (nextLvl !== null) {
                const xpNeeded = nextLvl - Levels.getXP();
                if (xpNeeded <= 50) {
                    recs.push({ icon: '⭐', text: `Almost level ${Levels.getLevel() + 1}! Just ${xpNeeded} XP to go.`, priority: 'low' });
                }
            }
        }

        // If everything is great
        if (recs.length === 0) {
            recs.push({ icon: '✨', text: 'Park is looking great! Keep growing.', priority: 'low' });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recs.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

        return recs;
    }

    // ---- Statistics ----
    function getParkStats() {
        const rides = World.getRides();
        const food = World.getFoodStalls();
        const scenery = World.getScenery();
        const buildings = World.getBuildings();
        const guests = Guests.getAll();
        const allObj = World.getAllObjects();
        const paths = allObj.filter(o => o.type === 'path' || o.type === 'wide_path');

        return {
            totalBuildings: allObj.length,
            totalRides: rides.length,
            totalFoodStalls: food.length,
            totalScenery: scenery.length,
            totalBuildings2: buildings.length,
            totalPaths: paths.length,
            currentGuests: guests.length,
            maxGuests: (typeof Levels !== 'undefined') ? Levels.getMaxGuests() : CONFIG.MAX_GUESTS,
            avgHappiness: Math.round(Guests.getAverageHappiness()),
            parkRating: Economy.getRating().toFixed(1),
            totalIncome: Economy.getTotalIncome(),
            totalExpenses: Economy.getTotalExpenses(),
            netProfit: Economy.getTotalIncome() - Economy.getTotalExpenses(),
            dayIncome: Economy.getDayIncome(),
            dayExpenses: Economy.getDayExpenses(),
            day: Economy.getDay(),
            level: (typeof Levels !== 'undefined') ? Levels.getLevel() : 1,
            xp: (typeof Levels !== 'undefined') ? Levels.getXP() : 0,
            totalGuestsEver: Economy.getTotalGuestsEver(),
        };
    }

    function getTopRides() {
        const rides = World.getRides();
        return rides
            .map(r => ({
                name: BUILDINGS[r.type]?.name || r.type,
                type: r.type,
                totalRiders: r.totalRiders || 0,
                revenue: r.revenue || 0,
                queueLength: r.queue?.length || 0,
                excitement: BUILDINGS[r.type]?.excitement || 0,
            }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    function getTopFood() {
        const food = World.getFoodStalls();
        return food
            .map(f => ({
                name: BUILDINGS[f.type]?.name || f.type,
                type: f.type,
                totalSales: f.totalRiders || 0,
                revenue: f.revenue || 0,
            }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    return {
        getRecommendations,
        getParkStats,
        getTopRides,
        getTopFood,
    };
})();
