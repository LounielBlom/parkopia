// ============================================================
//  PARKOPIA – UI Management
// ============================================================

const UI = (() => {
    let selectedCategory = 'paths';
    let selectedItem = null;
    let buildMode = false;
    let demolishMode = false;
    let inspectedObj = null; // currently shown in info panel

    function init() {
        setupCategoryButtons();
        setupSpeedButtons();
        setupInfoPanel();
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

            const btn = document.createElement('button');
            btn.className = 'item-btn';
            btn.dataset.item = itemKey;

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

            btn.addEventListener('click', () => {
                document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedItem = itemKey;
                buildMode = true;
                demolishMode = false;
                document.getElementById('game-canvas').classList.add('placing');
                updateBuildPreview();
            });

            container.appendChild(btn);
        });
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

    function updateHUD() {
        document.getElementById('money-value').textContent = formatMoney(Economy.getMoney());
        document.getElementById('guest-value').textContent = Guests.getCount();
        const avgHappy = Guests.getAverageHappiness();
        document.getElementById('happiness-value').textContent =
            Guests.getCount() > 0 ? Math.round(avgHappy) + '%' : '--';
        document.getElementById('rating-value').textContent = Economy.getRating().toFixed(1);
        document.getElementById('date-value').textContent = 'Day ' + Economy.getDay();

        // Live-update info panel
        refreshInfoPanel();

        // Dim unaffordable toolbar items
        const money = Economy.getMoney();
        document.querySelectorAll('.item-btn').forEach(btn => {
            const itemKey = btn.dataset.item;
            const def = BUILDINGS[itemKey];
            if (def) {
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

    function buildInfoHTML(obj) {
        const def = BUILDINGS[obj.type];
        if (!def) return '';

        let html = '<div class="info-row"><span class="info-label">Type</span><span class="info-val">' + (def.category || '') + '</span></div>';
        html += '<div class="info-row"><span class="info-label">Description</span><span class="info-val">' + (def.description || '') + '</span></div>';

        if (def.category === 'rides') {
            html += '<div class="info-row"><span class="info-label">Excitement</span><span class="info-val">' + (def.excitement || 0) + '/10</span></div>';
            html += '<div class="info-row"><span class="info-label">Capacity</span><span class="info-val">' + (def.capacity || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Ticket Price</span><span class="info-val">$' + (def.ticketPrice || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Queue</span><span class="info-val">' + (obj.queue?.length || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Riders</span><span class="info-val">' + (obj.riders?.length || 0) + '/' + (def.capacity || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Total Riders</span><span class="info-val">' + (obj.totalRiders || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Revenue</span><span class="info-val positive">$' + formatMoney(obj.revenue || 0).slice(1) + '</span></div>';
        }

        if (def.category === 'food') {
            html += '<div class="info-row"><span class="info-label">Price</span><span class="info-val">$' + (def.foodPrice || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Sales</span><span class="info-val">' + (obj.totalRiders || 0) + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Revenue</span><span class="info-val positive">$' + formatMoney(obj.revenue || 0).slice(1) + '</span></div>';
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
        showToast,
        cancelBuild,
        getSelectedItem,
        isBuildMode,
        isDemolishMode,
        formatMoney,
    };
})();
