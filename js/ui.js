// ============================================================
//  PARKOPIA – UI Management
// ============================================================

const UI = (() => {
    let selectedCategory = 'paths';
    let selectedItem = null;
    let buildMode = false;
    let demolishMode = false;
    let inspectedObj = null; // currently shown in info panel
    let parkName = 'Parkopia';
    let lastInfoRefresh = 0;
    let forceInfoRefresh = false;

    function init() {
        setupCategoryButtons();
        setupSpeedButtons();
        setupInfoPanel();
        setupParkName();
        setupOverlayButtons();
        setupEntranceFee();
        setupPriceEventDelegation();
        populateToolbarItems('paths');
    }

    function setupCategoryButtons() {
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedCategory = btn.dataset.category;

                if (selectedCategory === 'demolish') {
                    buildMode = false;
                    demolishMode = true;
                    selectedItem = null;
                    document.getElementById('toolbar-items').innerHTML =
                        '<div style="padding:10px; color:var(--text-dim); font-size:12px;">Click on objects to remove them. Press <span class="key">Esc</span> to cancel.</div>';
                    document.getElementById('game-canvas').classList.add('placing');
                    updateBuildPreview();
                } else {
                    demolishMode = false;
                    populateToolbarItems(selectedCategory);
                }
            });
        });
    }

    function populateToolbarItems(category) {
        const container = document.getElementById('toolbar-items');
        container.innerHTML = '';
        const items = CATEGORY_ITEMS[category] || [];

        items.forEach(itemKey => {
            const def = BUILDINGS[itemKey];
            if (!def) return;

            const unlocked = (typeof Levels !== 'undefined') ? Levels.isUnlocked(itemKey) : true;

            const btn = document.createElement('button');
            btn.className = 'item-btn';
            btn.dataset.item = itemKey;

            if (!unlocked) {
                btn.classList.add('locked');
                const lockLevel = (typeof Levels !== 'undefined') ? Levels.getUnlockLevel(itemKey) : '?';

                // Lock overlay
                const lockOverlay = document.createElement('div');
                lockOverlay.className = 'lock-overlay';
                lockOverlay.innerHTML = `🔒 Lv${lockLevel}`;
                btn.appendChild(lockOverlay);
            }

            // Thumbnail
            const thumb = Assets.getThumbnail(itemKey);
            btn.appendChild(thumb);

            // Name
            const nameEl = document.createElement('span');
            nameEl.className = 'item-name';
            nameEl.textContent = def.name;
            btn.appendChild(nameEl);

            // Cost
            const costEl = document.createElement('span');
            costEl.className = 'item-cost';
            costEl.textContent = '$' + def.cost;
            btn.appendChild(costEl);

            if (unlocked) {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedItem = itemKey;
                    buildMode = true;
                    demolishMode = false;
                    document.getElementById('game-canvas').classList.add('placing');
                    updateBuildPreview();
                });
            }

            container.appendChild(btn);
        });
    }

    function refreshToolbar() {
        if (selectedCategory && selectedCategory !== 'demolish') {
            populateToolbarItems(selectedCategory);
        }
    }

    function setupSpeedButtons() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const speed = parseInt(btn.dataset.speed);
                if (typeof Game !== 'undefined') {
                    Game.setSpeed(speed);
                }
            });
        });
    }

    function setupInfoPanel() {
        document.getElementById('info-close').addEventListener('click', () => {
            document.getElementById('info-panel').classList.add('hidden');
            inspectedObj = null;
        });
    }

    // ---- Park Name (click to rename) ----
    function setupParkName() {
        const nameEl = document.getElementById('park-name');
        nameEl.style.cursor = 'pointer';
        nameEl.title = 'Click to rename your park';
        nameEl.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = parkName;
            input.className = 'park-name-input';
            input.maxLength = 24;

            nameEl.textContent = '';
            nameEl.appendChild(input);
            input.focus();
            input.select();

            const finishRename = () => {
                const newName = input.value.trim();
                if (newName && newName.length > 0) {
                    parkName = newName;
                }
                nameEl.textContent = parkName;
                document.title = parkName + ' - Theme Park Tycoon';
            };

            input.addEventListener('blur', finishRename);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { input.blur(); }
                if (e.key === 'Escape') { input.value = parkName; input.blur(); }
                e.stopPropagation(); // prevent game key handlers
            });
            input.addEventListener('keyup', (e) => e.stopPropagation());
        });
    }

    // ---- Overlay Panel Buttons (Stats, Recommendations) ----
    function setupOverlayButtons() {
        // Stats button
        document.getElementById('btn-stats')?.addEventListener('click', () => {
            togglePanel('stats-panel');
            if (!document.getElementById('stats-panel').classList.contains('hidden')) {
                renderStatsPanel();
            }
        });

        // Recommendations button
        document.getElementById('btn-recs')?.addEventListener('click', () => {
            togglePanel('recs-panel');
            if (!document.getElementById('recs-panel').classList.contains('hidden')) {
                renderRecsPanel();
            }
        });

        // Close buttons
        document.getElementById('stats-close')?.addEventListener('click', () => {
            document.getElementById('stats-panel').classList.add('hidden');
        });
        document.getElementById('recs-close')?.addEventListener('click', () => {
            document.getElementById('recs-panel').classList.add('hidden');
        });
    }

    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        // Close other overlays
        ['stats-panel', 'recs-panel'].forEach(id => {
            if (id !== panelId) document.getElementById(id)?.classList.add('hidden');
        });
        panel.classList.toggle('hidden');
    }

    // ---- Stats Panel Rendering ----
    function renderStatsPanel() {
        const content = document.getElementById('stats-content');
        if (!content) return;

        const stats = Stats.getParkStats();
        const topRides = Stats.getTopRides();
        const topFood = Stats.getTopFood();

        let html = '';

        // Park Overview
        html += '<div class="stats-section">';
        html += '<h4 class="stats-heading">Park Overview</h4>';
        html += statsRow('Day', stats.day);
        html += statsRow('Level', `${stats.level} / ${(typeof Levels !== 'undefined') ? Levels.getMaxLevel() : 5}`);
        html += statsRow('XP', `${stats.xp}${(typeof Levels !== 'undefined' && Levels.getXPForNextLevel()) ? ' / ' + Levels.getXPForNextLevel() : ' (MAX)'}`);
        html += statsRow('Rating', '⭐ ' + stats.parkRating + ' / 5.0');
        html += statsRow('Guests', stats.currentGuests + ' / ' + stats.maxGuests);
        html += statsRow('Total Visitors', stats.totalGuestsEver);
        html += statsRow('Avg Happiness', stats.avgHappiness + '%');
        html += '</div>';

        // Finances
        html += '<div class="stats-section">';
        html += '<h4 class="stats-heading">Finances</h4>';
        html += statsRow('Total Income', formatMoney(stats.totalIncome), 'positive');
        html += statsRow('Total Expenses', formatMoney(stats.totalExpenses), 'negative');
        html += statsRow('Net Profit', formatMoney(stats.netProfit), stats.netProfit >= 0 ? 'positive' : 'negative');
        html += statsRow('Today Income', formatMoney(stats.dayIncome), 'positive');
        html += statsRow('Today Expenses', formatMoney(stats.dayExpenses), 'negative');
        html += '</div>';

        // Infrastructure
        html += '<div class="stats-section">';
        html += '<h4 class="stats-heading">Infrastructure</h4>';
        html += statsRow('Rides', stats.totalRides);
        html += statsRow('Food Stalls', stats.totalFoodStalls);
        html += statsRow('Scenery', stats.totalScenery);
        html += statsRow('Buildings', stats.totalBuildings2);
        html += statsRow('Path Tiles', stats.totalPaths);
        html += '</div>';

        // Top Rides
        if (topRides.length > 0) {
            html += '<div class="stats-section">';
            html += '<h4 class="stats-heading">🏆 Top Rides</h4>';
            topRides.slice(0, 5).forEach((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                html += `<div class="stats-ride-row">
                    <span class="stats-medal">${medal}</span>
                    <span class="stats-ride-name">${r.name}</span>
                    <span class="stats-ride-stat">${r.totalRiders} riders · ${formatMoney(r.revenue)}</span>
                </div>`;
            });
            html += '</div>';
        }

        // Top Food
        if (topFood.length > 0) {
            html += '<div class="stats-section">';
            html += '<h4 class="stats-heading">🏆 Top Food Stalls</h4>';
            topFood.slice(0, 5).forEach((f, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                html += `<div class="stats-ride-row">
                    <span class="stats-medal">${medal}</span>
                    <span class="stats-ride-name">${f.name}</span>
                    <span class="stats-ride-stat">${f.totalSales} sales · ${formatMoney(f.revenue)}</span>
                </div>`;
            });
            html += '</div>';
        }

        content.innerHTML = html;
    }

    function statsRow(label, value, cls) {
        return `<div class="info-row"><span class="info-label">${label}</span><span class="info-val${cls ? ' ' + cls : ''}">${value}</span></div>`;
    }

    // ---- Recommendations Panel Rendering ----
    function renderRecsPanel() {
        const content = document.getElementById('recs-content');
        if (!content) return;

        const recs = Stats.getRecommendations();
        let html = '';

        recs.forEach(r => {
            const priorityClass = r.priority === 'high' ? 'rec-high' : r.priority === 'medium' ? 'rec-medium' : 'rec-low';
            html += `<div class="rec-item ${priorityClass}">
                <span class="rec-icon">${r.icon}</span>
                <span class="rec-text">${r.text}</span>
                <span class="rec-priority">${r.priority}</span>
            </div>`;
        });

        content.innerHTML = html;
    }

    // ---- Entrance Fee Controls ----
    function setupEntranceFee() {
        const feeDown = document.getElementById('fee-down');
        const feeUp = document.getElementById('fee-up');
        if (feeDown) {
            feeDown.addEventListener('click', (e) => {
                e.stopPropagation();
                Economy.setEntranceFee(Economy.getEntranceFee() - 1);
            });
        }
        if (feeUp) {
            feeUp.addEventListener('click', (e) => {
                e.stopPropagation();
                Economy.setEntranceFee(Economy.getEntranceFee() + 1);
            });
        }
    }

    // ---- Price Event Delegation on Info Panel ----
    function setupPriceEventDelegation() {
        const content = document.getElementById('info-content');
        if (!content) return;

        content.addEventListener('click', (e) => {
            const btn = e.target.closest('.price-btn');
            if (!btn || !inspectedObj) return;

            e.stopPropagation();
            const dir = parseInt(btn.dataset.dir);
            if (isNaN(dir)) return;

            const currentPrice = Economy.getEffectivePrice(inspectedObj);
            Economy.setObjectPrice(inspectedObj, currentPrice + dir);
            forceInfoRefresh = true;
            refreshInfoPanel();
        });
    }

    // ---- HUD Update ----
    function updateHUD() {
        document.getElementById('money-value').textContent = formatMoney(Economy.getMoney());

        const maxGuests = (typeof Levels !== 'undefined') ? Levels.getMaxGuests() : CONFIG.MAX_GUESTS;
        document.getElementById('guest-value').textContent = Guests.getCount() + '/' + maxGuests;

        const avgHappy = Guests.getAverageHappiness();
        document.getElementById('happiness-value').textContent =
            Guests.getCount() > 0 ? Math.round(avgHappy) + '%' : '--';
        document.getElementById('rating-value').textContent = Economy.getRating().toFixed(1);
        document.getElementById('date-value').textContent = 'Day ' + Economy.getDay();

        // Entrance fee display
        const feeVal = document.getElementById('fee-value');
        if (feeVal) feeVal.textContent = '$' + Economy.getEntranceFee();

        // Level & XP bar
        if (typeof Levels !== 'undefined') {
            const levelEl = document.getElementById('level-value');
            if (levelEl) levelEl.textContent = 'Lv' + Levels.getLevel();

            const xpBar = document.getElementById('xp-bar-fill');
            if (xpBar) {
                const progress = Levels.getXPProgress();
                xpBar.style.width = (progress * 100) + '%';
            }
        }

        // Live-update info panel (throttled to avoid destroying price buttons mid-click)
        const now = Date.now();
        if (forceInfoRefresh || now - lastInfoRefresh > 500) {
            lastInfoRefresh = now;
            forceInfoRefresh = false;
            refreshInfoPanel();
        }

        // Live-update stats/recs if visible
        if (!document.getElementById('stats-panel')?.classList.contains('hidden')) {
            renderStatsPanel();
        }
        if (!document.getElementById('recs-panel')?.classList.contains('hidden')) {
            renderRecsPanel();
        }

        // Dim unaffordable toolbar items
        const money = Economy.getMoney();
        document.querySelectorAll('.item-btn').forEach(btn => {
            const itemKey = btn.dataset.item;
            const def = BUILDINGS[itemKey];
            if (def && !btn.classList.contains('locked')) {
                btn.classList.toggle('unaffordable', money < def.cost);
            }
        });
    }

    function updateBuildPreview() {
        const el = document.getElementById('build-preview');
        if (buildMode && selectedItem) {
            const def = BUILDINGS[selectedItem];
            el.classList.remove('hidden');
            document.getElementById('preview-name').textContent = def.name;
            document.getElementById('preview-cost').textContent = '$' + def.cost;
        } else if (demolishMode) {
            el.classList.remove('hidden');
            document.getElementById('preview-name').textContent = 'Demolish Mode';
            document.getElementById('preview-cost').textContent = 'Click to remove';
        } else {
            el.classList.add('hidden');
        }
    }

    function buildPriceRow(label, obj) {
        const price = Economy.getEffectivePrice(obj);
        const base = Economy.getBasePrice(obj);
        const isCustom = obj.customPrice !== undefined && obj.customPrice !== base;
        const priceClass = isCustom ? ' price-custom' : '';
        return `<div class="info-row">
            <span class="info-label">${label}</span>
            <span class="info-val price-control">
                <button class="price-btn" data-dir="-1">−</button>
                <span class="price-display${priceClass}">$${price}</span>
                <button class="price-btn" data-dir="1">+</button>
            </span>
        </div>`;
    }

    function buildInfoHTML(obj) {
        const def = BUILDINGS[obj.type];
        if (!def) return '';

        let html = '<div class="info-row"><span class="info-label">Type</span><span class="info-val">' + (def.category || '') + '</span></div>';
        html += '<div class="info-row"><span class="info-label">Description</span><span class="info-val">' + (def.description || '') + '</span></div>';

        if (def.category === 'rides') {
            // Coaster station: show dynamic excitement and track info
            if (def.isCoasterStation) {
                const dynamicExcitement = World.getCoasterExcitement(obj);
                const tracks = World.getConnectedTracks(obj);
                const isCircuit = World.validateCircuit(obj);
                const circuitStatus = isCircuit
                    ? '<span style="color:#4ecdc4">✓ Circuit Complete</span>'
                    : '<span style="color:#f7c948">○ Open Track</span>';

                html += '<div class="info-row"><span class="info-label">Excitement</span><span class="info-val">' + dynamicExcitement + '/10</span></div>';
                html += '<div class="info-row"><span class="info-label">Track Pieces</span><span class="info-val">' + tracks.length + '</span></div>';
                html += '<div class="info-row"><span class="info-label">Circuit</span><span class="info-val">' + circuitStatus + '</span></div>';
            } else {
                html += '<div class="info-row"><span class="info-label">Excitement</span><span class="info-val">' + (def.excitement || 0) + '/10</span></div>';
            }
            html += '<div class="info-row"><span class="info-label">Capacity</span><span class="info-val">' + (def.capacity || 0) + '</span></div>';
            html += buildPriceRow('Ticket Price', obj);
            html += '<div class="info-row"><span class="info-label">Queue</span><span class="info-val">' + (obj.queue?.length || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Riders</span><span class="info-val">' + (obj.riders?.length || 0) + '/' + (def.capacity || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Total Riders</span><span class="info-val">' + (obj.totalRiders || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Revenue</span><span class="info-val positive">' + formatMoney(obj.revenue || 0) + '</span></div>';
        }

        if (def.isTrack) {
            const station = World.findStationForTrack(obj);
            html += '<div class="info-row"><span class="info-label">Excitement Bonus</span><span class="info-val">+' + (def.excitementBonus || 0) + '</span></div>';
            if (station) {
                const dynamicExcitement = World.getCoasterExcitement(station);
                const trackCount = World.getConnectedTracks(station).length;
                html += '<div class="info-row"><span class="info-label">Connected Station</span><span class="info-val">Yes (' + trackCount + ' tracks)</span></div>';
                html += '<div class="info-row"><span class="info-label">Coaster Excitement</span><span class="info-val">' + dynamicExcitement + '/10</span></div>';
            } else {
                html += '<div class="info-row"><span class="info-label">Connected Station</span><span class="info-val" style="color:#f7c948">Not connected</span></div>';
            }
        }

        if (def.category === 'food') {
            html += buildPriceRow('Price', obj);
            html += '<div class="info-row"><span class="info-label">Sales</span><span class="info-val">' + (obj.totalRiders || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Revenue</span><span class="info-val positive">' + formatMoney(obj.revenue || 0) + '</span></div>';
        }

        if (def.beauty) {
            html += '<div class="info-row"><span class="info-label">Beauty</span><span class="info-val">+' + def.beauty + '</span></div>';
        }

        if (def.upkeep > 0) {
            html += '<div class="info-row"><span class="info-label">Upkeep</span><span class="info-val negative">$' + def.upkeep + '/cycle</span></div>';
        }

        return html;
    }

    function showObjectInfo(obj) {
        const panel = document.getElementById('info-panel');
        const title = document.getElementById('info-title');
        const content = document.getElementById('info-content');
        const def = BUILDINGS[obj.type];

        if (!def) {
            panel.classList.add('hidden');
            inspectedObj = null;
            return;
        }

        inspectedObj = obj;
        title.textContent = def.name;
        content.innerHTML = buildInfoHTML(obj);
        panel.classList.remove('hidden');
    }

    function refreshInfoPanel() {
        if (!inspectedObj) return;
        const panel = document.getElementById('info-panel');
        if (panel.classList.contains('hidden')) { inspectedObj = null; return; }
        const content = document.getElementById('info-content');
        content.innerHTML = buildInfoHTML(inspectedObj);
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function cancelBuild() {
        buildMode = false;
        demolishMode = false;
        selectedItem = null;
        document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('game-canvas').classList.remove('placing');
        updateBuildPreview();
    }

    function formatMoney(n) {
        if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
        if (n >= 10000) return '$' + (n / 1000).toFixed(1) + 'K';
        return '$' + Math.floor(n).toLocaleString();
    }

    function getSelectedItem() { return selectedItem; }
    function isBuildMode() { return buildMode; }
    function isDemolishMode() { return demolishMode; }

    return {
        init,
        updateHUD,
        showObjectInfo,
        refreshInfoPanel,
        refreshToolbar,
        showToast,
        cancelBuild,
        getSelectedItem,
        isBuildMode,
        isDemolishMode,
        formatMoney,
    };
})();
