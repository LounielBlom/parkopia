// ============================================================
//  PARKOPIA – Leveling & Progression System
// ============================================================

const Levels = (() => {
    let xp = 0;
    let level = 1;
    let totalXpEarned = 0;

    // Level thresholds — XP needed to reach each level
    const LEVEL_THRESHOLDS = [
        0,       // Level 1 (start)
        200,     // Level 2
        600,     // Level 3
        1500,    // Level 4
        3000,    // Level 5
    ];

    // Max guests allowed at each level
    const GUEST_CAPS = [40, 60, 80, 100, 120];

    // Buildings unlocked at each level (1-indexed)
    const UNLOCK_LEVELS = {
        // Level 1 — starter items
        path: 1,
        carousel: 1,
        tea_cups: 1,
        burger_stand: 1,
        ice_cream_cart: 1,
        tree: 1,
        bench: 1,
        trash_can: 1,

        // Level 2 — expanding the park
        wide_path: 2,
        bumper_cars: 2,
        drinks_booth: 2,
        flower_bed: 2,
        lamp: 2,
        restroom: 2,

        // Level 3 — mid-tier attractions
        ferris_wheel: 3,
        pizza_stand: 3,
        cotton_candy: 3,
        fountain: 3,
        hedge: 3,
        info_booth: 3,

        // Level 4 — thrilling rides & shops
        log_flume: 4,
        drop_tower: 4,
        statue: 4,
        gift_shop: 4,
        first_aid: 4,

        // Level 5 — flagship attraction
        roller_coaster: 5,
    };

    function addXP(amount, source) {
        xp += amount;
        totalXpEarned += amount;

        // Check for level up
        const oldLevel = level;
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (xp >= LEVEL_THRESHOLDS[i]) {
                level = i + 1;
                break;
            }
        }

        if (level > oldLevel) {
            onLevelUp(oldLevel, level);
        }
    }

    function onLevelUp(oldLvl, newLvl) {
        // Find newly unlocked buildings
        const newUnlocks = [];
        for (const [key, lvl] of Object.entries(UNLOCK_LEVELS)) {
            if (lvl > oldLvl && lvl <= newLvl) {
                const def = BUILDINGS[key];
                if (def) newUnlocks.push(def.name);
            }
        }

        const guestCap = getMaxGuests();
        let msg = `Level ${newLvl}! Guest cap: ${guestCap}`;
        if (newUnlocks.length > 0) {
            msg += ` | Unlocked: ${newUnlocks.join(', ')}`;
        }
        UI.showToast(msg, 'success');

        // Refresh the toolbar so newly unlocked items appear
        if (typeof UI !== 'undefined' && UI.refreshToolbar) {
            UI.refreshToolbar();
        }
    }

    function getLevel() { return level; }
    function getXP() { return xp; }
    function getTotalXP() { return totalXpEarned; }

    function getMaxGuests() {
        return GUEST_CAPS[Math.min(level, GUEST_CAPS.length) - 1];
    }

    function getXPForNextLevel() {
        if (level >= LEVEL_THRESHOLDS.length) return null; // max level
        return LEVEL_THRESHOLDS[level]; // next threshold
    }

    function getXPProgress() {
        const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
        const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold;
        if (nextThreshold <= currentThreshold) return 1; // max level
        return (xp - currentThreshold) / (nextThreshold - currentThreshold);
    }

    function isUnlocked(buildingKey) {
        const reqLevel = UNLOCK_LEVELS[buildingKey];
        if (reqLevel === undefined) return true; // unknown items default to unlocked
        return level >= reqLevel;
    }

    function getUnlockLevel(buildingKey) {
        return UNLOCK_LEVELS[buildingKey] || 1;
    }

    function getMaxLevel() {
        return LEVEL_THRESHOLDS.length;
    }

    function reset() {
        xp = 0;
        level = 1;
        totalXpEarned = 0;
    }

    return {
        addXP,
        getLevel,
        getXP,
        getTotalXP,
        getMaxGuests,
        getXPForNextLevel,
        getXPProgress,
        isUnlocked,
        getUnlockLevel,
        getMaxLevel,
        reset,
        UNLOCK_LEVELS,
    };
})();
