const API_BASE = "https://magenta-wolf-69675.zap.cloud";
const INVENTORY_STATE = {
    items: [],
    filter: "ALL",
    sort: "rarity_desc",
    selectedCardId: null
};
const BOOSTER_REVEAL_STATE = {
    lastPackName: "",
    lastCards: [],
    isAnimating: false
};

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function renderInventory(items) {
    const inventoryList = document.getElementById("inventoryList");

    if (!inventoryList) {
        return;
    }

    if (!items || !items.length) {
        inventoryList.innerHTML = "<div class='inventory-item'>Noch keine Booster im Inventar.</div>";
        return;
    }

    inventoryList.innerHTML = items.map(item => `
        <div class="inventory-item">
            <strong>${item.pack_name}</strong><br>
            Menge: ${item.amount}<br>
            <span class="muted">Zuletzt gekauft: ${formatDate(item.last_purchased_at)}</span>
        </div>
    `).join("");
}

function renderHistory(items) {
    const historyList = document.getElementById("historyList");

    if (!historyList) {
        return;
    }

    if (!items || !items.length) {
        historyList.innerHTML = "<div class='history-item'>Noch keine Booster-Kaeufe vorhanden.</div>";
        return;
    }

    historyList.innerHTML = items.map(item => `
        <div class="history-item">
            <strong>${item.pack_name}</strong><br>
            Kosten: ${item.coins_spent} Coins<br>
            <span class="muted">Gekauft am: ${formatDate(item.purchased_at)}</span>
        </div>
    `).join("");
}

function renderOpenHistory(items) {
    const openHistoryList = document.getElementById("openHistoryList");

    if (!openHistoryList) {
        return;
    }

    if (!items || !items.length) {
        openHistoryList.innerHTML = "<div class='history-item'>Noch keine Booster geoeffnet.</div>";
        return;
    }

    openHistoryList.innerHTML = items.map(item => `
        <div class="history-item">
            <strong>${item.pack_name}</strong><br>
            Reward: ${item.reward_value} ${item.reward_type}<br>
            <span class="muted">Geoeffnet am: ${formatDate(item.opened_at)}</span>
        </div>
    `).join("");
}

function renderCardInventory(items) {
    const cardInventoryList = document.getElementById("cardInventoryList");

    if (!cardInventoryList) {
        return;
    }

    if (document.getElementById("inventorySort")) {
        INVENTORY_STATE.items = Array.isArray(items) ? items.slice() : [];
        renderInventoryCollectionView();
        bindInventoryCollectionControls();
        return;
    }

    renderCardCollection(items, cardInventoryList, "Noch keine Karten gesammelt.");
}

function getRarityClass(rarity) {
    const normalized = String(rarity || "N").toUpperCase();

    if (normalized === "SEC") {
        return "card-face-sec";
    }
    if (normalized === "SR") {
        return "card-face-sr";
    }
    if (normalized === "R") {
        return "card-face-r";
    }

    return "card-face-n";
}

function renderOpenedCards(items, packName) {
    const openedCardsList = document.getElementById("openedCardsList");

    if (!openedCardsList) {
        return;
    }

    if (!items || !items.length) {
        openedCardsList.innerHTML = "<div class='inventory-item'>Noch keine Karten gezogen.</div>";
        return;
    }

    openedCardsList.innerHTML = items.map(card => `
        <div class="card-face ${getRarityClass(card.rarity)}">
            <div class="card-slot">Slot ${card.slot_number}</div>
            <div class="card-name">${card.card_name}</div>
            <div class="card-rarity">${card.rarity}</div>
            <div class="card-pack-label">${packName || "Booster Reveal"}</div>
        </div>
    `).join("");
}

function getRevealSummary(items) {
    const summary = {
        N: 0,
        R: 0,
        SR: 0,
        SEC: 0
    };

    (items || []).forEach(card => {
        const rarity = String(card.rarity || "N").toUpperCase();
        if (summary[rarity] !== undefined) {
            summary[rarity] += 1;
        }
    });

    return summary;
}

function renderRevealBanner(packName, items) {
    const rewardBox = document.getElementById("openReward");
    if (!rewardBox) {
        return;
    }

    const summary = getRevealSummary(items);
    rewardBox.innerHTML = `
        <div class="reward-banner">
            <strong>${packName}</strong><br>
            Du hast ${items.length} Karten gezogen.
            <div class="reveal-summary">
                <span class="summary-pill">R: ${summary.R}</span>
                <span class="summary-pill">SR: ${summary.SR}</span>
                <span class="summary-pill">SEC: ${summary.SEC}</span>
            </div>
            <div class="card-pack-label">9 Normal, 1 Rare, 2 Bonus-Slots</div>
        </div>
    `;
}

async function animateOpenedCards(items, packName) {
    const openedCardsList = document.getElementById("openedCardsList");
    if (!openedCardsList) {
        return;
    }

    BOOSTER_REVEAL_STATE.isAnimating = true;
    openedCardsList.innerHTML = "";

    for (const card of items || []) {
        const cardHtml = `
            <div class="card-face ${getRarityClass(card.rarity)} reveal-enter ${["SR", "SEC"].includes(String(card.rarity || "").toUpperCase()) ? "reveal-hit" : ""}">
                <div class="card-slot">Slot ${card.slot_number}</div>
                <div class="card-name">${card.card_name}</div>
                <div class="card-rarity">${card.rarity}</div>
                <div class="card-pack-label">${packName || "Booster Reveal"}</div>
            </div>
        `;
        openedCardsList.insertAdjacentHTML("beforeend", cardHtml);
        await new Promise(resolve => setTimeout(resolve, 180));
    }

    BOOSTER_REVEAL_STATE.isAnimating = false;
}

function renderCardCollection(items, targetElement, emptyMessage, options = {}) {
    if (!targetElement) {
        return;
    }

    if (!items || !items.length) {
        targetElement.innerHTML = `<div class='inventory-item'>${emptyMessage}</div>`;
        return;
    }

    targetElement.innerHTML = items.map(item => `
        <div class="card-face ${getRarityClass(item.rarity)} ${options.clickable ? "clickable" : ""} ${String(options.selectedCardId || "") === String(item.card_id || "") ? "is-selected" : ""}" ${options.clickable ? `data-card-id="${item.card_id}"` : ""}>
            <div class="card-slot">${options.slotLabel || item.rarity || "CARD"}</div>
            <div class="card-name">${item.card_name}</div>
            <div class="card-rarity">${item.rarity}</div>
            <div class="card-qty">Menge: ${item.quantity || 1}</div>
            <div class="card-pack-label">${item.pack_key || options.packLabel || "Collection"}</div>
        </div>
    `).join("");
}

function findCardById(items, cardId) {
    return (items || []).find(card => String(card.card_id) === String(cardId));
}

function rarityWeight(rarity) {
    const normalized = String(rarity || "N").toUpperCase();
    if (normalized === "SEC") {
        return 4;
    }
    if (normalized === "SR") {
        return 3;
    }
    if (normalized === "R") {
        return 2;
    }
    return 1;
}

function sortInventoryCards(items, sortMode) {
    const sorted = (items || []).slice();

    if (sortMode === "name_asc") {
        sorted.sort((a, b) => String(a.card_name || "").localeCompare(String(b.card_name || "")));
        return sorted;
    }

    if (sortMode === "newest_desc") {
        sorted.sort((a, b) => new Date(b.last_acquired_at || 0) - new Date(a.last_acquired_at || 0));
        return sorted;
    }

    if (sortMode === "quantity_desc") {
        sorted.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0) || String(a.card_name || "").localeCompare(String(b.card_name || "")));
        return sorted;
    }

    sorted.sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity) || String(a.card_name || "").localeCompare(String(b.card_name || "")));
    return sorted;
}

function renderInventoryCardDetail(card) {
    const detailElement = document.getElementById("inventoryCardDetail");
    if (!detailElement) {
        return;
    }

    if (!card) {
        detailElement.innerHTML = "Tippe auf eine Karte, um Details zu sehen.";
        return;
    }

    detailElement.innerHTML = `
        <div class="detail-panel">
            <div class="detail-title">${card.card_name}</div>
            <div class="detail-meta">
                Seltenheit: ${card.rarity}<br>
                Pack: ${card.pack_key || "-"}<br>
                Menge: ${card.quantity || 1}<br>
                Zuletzt erhalten: ${formatDate(card.last_acquired_at)}
            </div>
        </div>
    `;
}

function renderInventoryCollectionView() {
    const cardInventoryList = document.getElementById("cardInventoryList");
    if (!cardInventoryList) {
        return;
    }

    let items = INVENTORY_STATE.items.slice();

    if (INVENTORY_STATE.filter !== "ALL") {
        items = items.filter(item => String(item.rarity || "").toUpperCase() === INVENTORY_STATE.filter);
    }

    items = sortInventoryCards(items, INVENTORY_STATE.sort);

    if (!INVENTORY_STATE.selectedCardId && items.length) {
        INVENTORY_STATE.selectedCardId = items[0].card_id;
    }

    if (INVENTORY_STATE.selectedCardId && !items.some(item => String(item.card_id) === String(INVENTORY_STATE.selectedCardId))) {
        INVENTORY_STATE.selectedCardId = items.length ? items[0].card_id : null;
    }

    renderCardCollection(items, cardInventoryList, "Keine Karten fuer diesen Filter gefunden.", {
        clickable: true,
        selectedCardId: INVENTORY_STATE.selectedCardId
    });

    renderInventoryCardDetail(findCardById(items, INVENTORY_STATE.selectedCardId));

    cardInventoryList.querySelectorAll("[data-card-id]").forEach(cardElement => {
        if (cardElement.dataset.bound) {
            return;
        }

        cardElement.dataset.bound = "1";
        cardElement.addEventListener("click", () => {
            INVENTORY_STATE.selectedCardId = cardElement.dataset.cardId;
            renderInventoryCollectionView();
        });
    });
}

function bindInventoryCollectionControls() {
    document.querySelectorAll("[data-rarity-filter]").forEach(button => {
        if (button.dataset.bound) {
            button.classList.toggle("active", button.dataset.rarityFilter === INVENTORY_STATE.filter);
            return;
        }

        button.dataset.bound = "1";
        button.classList.toggle("active", button.dataset.rarityFilter === INVENTORY_STATE.filter);
        button.addEventListener("click", () => {
            INVENTORY_STATE.filter = button.dataset.rarityFilter || "ALL";
            document.querySelectorAll("[data-rarity-filter]").forEach(chip => {
                chip.classList.toggle("active", chip.dataset.rarityFilter === INVENTORY_STATE.filter);
            });
            renderInventoryCollectionView();
        });
    });

    const sortSelect = document.getElementById("inventorySort");
    if (!sortSelect) {
        return;
    }

    sortSelect.value = INVENTORY_STATE.sort;

    if (sortSelect.dataset.bound) {
        return;
    }

    sortSelect.dataset.bound = "1";
    sortSelect.addEventListener("change", () => {
        INVENTORY_STATE.sort = sortSelect.value || "rarity_desc";
        renderInventoryCollectionView();
    });
}

function renderFavoriteOptions(items, selectedId) {
    const favoriteSelect = document.getElementById("favoriteCardId");

    if (!favoriteSelect) {
        return;
    }

    const options = ["<option value=''>Keine Lieblingskarte</option>"];

    (items || []).forEach(item => {
        const selected = String(selectedId || "") === String(item.card_id || "") ? "selected" : "";
        options.push(
            `<option value="${item.card_id}" ${selected}>${item.card_name} (${item.rarity})</option>`
        );
    });

    favoriteSelect.innerHTML = options.join("");
}

async function postJson(path, payload) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return res.json();
}

async function initTelegramApp(pageName) {
    if (!window.Telegram || !window.Telegram.WebApp) {
        document.body.innerHTML = "<h2 style='color:red;text-align:center;margin-top:100px'>Telegram WebApp script not available</h2>";
        return;
    }

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.ready();

    const navLinks = document.querySelectorAll(".topnav a");
    navLinks.forEach(link => {
        if (link.dataset.page === pageName) {
            link.classList.add("active");
        }
    });

    let attempts = 0;
    while (attempts < 10 && (!tg.initDataUnsafe || !tg.initDataUnsafe.user)) {
        await new Promise(resolve => setTimeout(resolve, 150));
        attempts += 1;
    }

    if (!tg.initDataUnsafe || !tg.initDataUnsafe.user) {
        document.body.innerHTML = "<h2 style='color:red;text-align:center;margin-top:100px'>Open in Telegram</h2>";
        return;
    }

    const user = tg.initDataUnsafe.user;
    window.__tgApp = { tg, user };

    const username = document.getElementById("username");
    const avatar = document.getElementById("avatar");
    const telegramID = document.getElementById("telegramID");

    if (username) {
        username.innerText = user.first_name || "User";
    }

    if (avatar) {
        avatar.src = user.photo_url || "https://via.placeholder.com/45";
    }

    if (telegramID) {
        telegramID.innerText = "ID: " + user.id;
    }

    const data = await postJson("/secure-check", {
        initData: tg.initData,
        user_id: user.id
    });

    if (data.error) {
        const status = document.getElementById("status");
        if (status) {
            status.innerText = "Auth failed";
        }
        return;
    }

    const coins = document.getElementById("coins");
    if (coins) {
        coins.innerText = "Coins: " + (data.coins || 0);
    }

    const premiumBadge = document.getElementById("premiumBadge");
    const status = document.getElementById("status");
    const premiumShopCard = document.getElementById("premiumShopCard");

    if (premiumShopCard) {
        premiumShopCard.style.display = data.premium_enabled ? "block" : "none";
    }

    if (!data.premium_enabled) {
        if (status) {
            status.innerText = "Premium deaktiviert";
        }
        if (premiumBadge) {
            premiumBadge.style.display = "none";
        }
    } else if (data.premium) {
        if (status) {
            status.innerText = "Premium aktiv";
        }
        if (premiumBadge) {
            premiumBadge.style.display = "inline-block";
        }
    } else {
        if (status) {
            status.innerText = "Kein Premium";
        }
        if (premiumBadge) {
            premiumBadge.style.display = "none";
        }
    }

    renderInventory(data.inventory || []);
    renderCardInventory(data.card_inventory || []);

    if (pageName === "shop") {
        setupStarShop(tg, user);
        await loadBoosterShop(tg, user);
    }

    if (pageName === "inventory") {
        await loadBoosterShop(tg, user);
    }

    if (pageName === "openbooster") {
        await loadOpenBoosterPage(tg, user);
    }

    if (pageName === "account") {
        await loadProfilePage(tg, user, data);
    }

    if (pageName === "trading") {
        await loadTradingPage(tg, user);
    }
}

function setupStarShop(tg, user) {
    document.querySelectorAll(".shop-btn[data-item]").forEach(button => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                const data = await postJson("/create-invoice", {
                    initData: tg.initData,
                    user_id: user.id,
                    item: button.dataset.item
                });

                if (!data.ok || !data.invoice_url) {
                    alert("Kauf konnte nicht gestartet werden.");
                    return;
                }

                tg.openInvoice(data.invoice_url, function(status) {
                    if (status === "paid") {
                        window.location.reload();
                    }
                });
            } catch (error) {
                console.log(error);
                alert("Fehler beim Starten des Kaufs.");
            } finally {
                button.disabled = false;
            }
        });
    });
}

async function loadBoosterShop(tg, user) {
    try {
        const data = await postJson("/booster-shop", {
            initData: tg.initData,
            user_id: user.id
        });

        if (!data.ok) {
            return;
        }

        const coins = document.getElementById("coins");
        if (coins) {
            coins.innerText = "Coins: " + (data.coins || 0);
        }

        const boosterShop = document.getElementById("boosterShop");
        if (boosterShop) {
            boosterShop.innerHTML = data.packs.map(pack => `
                <button class="shop-btn booster-buy-btn" data-pack-key="${pack.pack_key}">
                    ${pack.name}
                    <small>${pack.price} Coins</small>
                </button>
            `).join("");

            document.querySelectorAll(".booster-buy-btn").forEach(button => {
                button.addEventListener("click", async () => {
                    button.disabled = true;

                    try {
                        const buyData = await postJson("/buy-booster", {
                            initData: tg.initData,
                            user_id: user.id,
                            pack_key: button.dataset.packKey
                        });

                        if (!buyData.ok) {
                            if (buyData.error === "not enough coins") {
                                alert("Nicht genug Coins fuer diesen Booster.");
                            } else {
                                alert("Booster-Kauf fehlgeschlagen.");
                            }
                            return;
                        }

                        const coinsLabel = document.getElementById("coins");
                        if (coinsLabel) {
                            coinsLabel.innerText = "Coins: " + (buyData.coins || 0);
                        }

                        renderInventory(buyData.inventory || []);
                        renderHistory(buyData.history || []);
                    } catch (error) {
                        console.log(error);
                        alert("Fehler beim Booster-Kauf.");
                    } finally {
                        button.disabled = false;
                    }
                });
            });
        }

        renderInventory(data.inventory || []);
        renderCardInventory(data.card_inventory || []);
        renderHistory(data.history || []);
        renderOpenHistory(data.open_history || []);
    } catch (error) {
        console.log(error);
    }
}

async function loadOpenBoosterPage(tg, user) {
    try {
        const data = await postJson("/booster-shop", {
            initData: tg.initData,
            user_id: user.id
        });

        if (!data.ok) {
            return;
        }

        const coins = document.getElementById("coins");
        if (coins) {
            coins.innerText = "Coins: " + (data.coins || 0);
        }

        renderInventory(data.inventory || []);
        renderCardInventory(data.card_inventory || []);
        renderOpenHistory(data.open_history || []);

        const rewardBox = document.getElementById("openReward");
        const openedCardsList = document.getElementById("openedCardsList");
        const openBoosterList = document.getElementById("openBoosterList");
        if (!openBoosterList) {
            return;
        }

        if (rewardBox && !rewardBox.innerHTML.trim() && !BOOSTER_REVEAL_STATE.lastCards.length) {
            rewardBox.innerHTML = `
                <div class="history-item">
                    Waehle einen Booster aus deinem Inventar und starte den Reveal hier.
                </div>
            `;
        }

        if (BOOSTER_REVEAL_STATE.lastCards.length && !BOOSTER_REVEAL_STATE.isAnimating) {
            renderRevealBanner(BOOSTER_REVEAL_STATE.lastPackName, BOOSTER_REVEAL_STATE.lastCards);
            renderOpenedCards(BOOSTER_REVEAL_STATE.lastCards, BOOSTER_REVEAL_STATE.lastPackName);
        } else if (openedCardsList && !openedCardsList.innerHTML.trim()) {
            openedCardsList.innerHTML = "<div class='inventory-item'>Dein letzter Booster-Reveal erscheint hier.</div>";
        }

        const ownedBoosters = (data.inventory || []).filter(item => Number(item.amount) > 0);

        if (!ownedBoosters.length) {
            openBoosterList.innerHTML = "<div class='inventory-item'>Du hast keine Booster zum Oeffnen.</div>";
            return;
        }

        openBoosterList.innerHTML = ownedBoosters.map(item => `
            <div class="booster-pack-card">
                <div class="booster-pack-header">
                    <div class="booster-pack-title">${item.pack_name}</div>
                    <div class="booster-pack-count">${item.amount}x</div>
                </div>
                <div class="booster-pack-meta">
                    <span>Pack Key: ${item.pack_key}</span>
                    <span>Bereit fuer 12 Karten</span>
                </div>
                <button class="shop-btn open-booster-btn" data-pack-key="${item.pack_key}">
                    Booster oeffnen
                    <small>12 Karten Reveal starten</small>
                </button>
            </div>
        `).join("");

        document.querySelectorAll(".open-booster-btn").forEach(button => {
            button.addEventListener("click", async () => {
                button.disabled = true;

                try {
                    const result = await postJson("/open-booster", {
                        initData: tg.initData,
                        user_id: user.id,
                        pack_key: button.dataset.packKey
                    });

                    if (!result.ok) {
                        if (result.error === "booster not owned") {
                            alert("Diesen Booster besitzt du nicht mehr.");
                        } else {
                            alert("Booster konnte nicht geoeffnet werden.");
                        }
                        return;
                    }

                    const coinsLabel = document.getElementById("coins");
                    if (coinsLabel) {
                        coinsLabel.innerText = "Coins: " + (result.coins || 0);
                    }

                    BOOSTER_REVEAL_STATE.lastPackName = result.pack_name || "Booster Reveal";
                    BOOSTER_REVEAL_STATE.lastCards = result.opened_cards || [];

                    renderRevealBanner(BOOSTER_REVEAL_STATE.lastPackName, BOOSTER_REVEAL_STATE.lastCards);
                    await animateOpenedCards(BOOSTER_REVEAL_STATE.lastCards, BOOSTER_REVEAL_STATE.lastPackName);

                    renderInventory(result.inventory || []);
                    renderCardInventory(result.card_inventory || []);
                    renderOpenHistory(result.open_history || []);
                    await loadOpenBoosterPage(tg, user);
                } catch (error) {
                    console.log(error);
                    alert("Fehler beim Oeffnen.");
                } finally {
                    button.disabled = false;
                }
            });
        });
    } catch (error) {
        console.log(error);
    }
}

async function loadProfilePage(tg, user, secureData) {
    try {
        const profileData = await postJson("/profile", {
            initData: tg.initData,
            user_id: user.id
        });

        if (!profileData.ok) {
            return;
        }

        const profile = profileData.profile || {};
        const cardInventory = profileData.card_inventory || [];

        const accountName = document.getElementById("accountName");
        const accountId = document.getElementById("accountId");
        const displayName = document.getElementById("displayName");
        const bio = document.getElementById("bio");
        const visibility = document.getElementById("inventoryVisibility");
        const tradingEnabled = document.getElementById("tradingEnabled");
        const profileSummary = document.getElementById("profileSummary");

        if (accountName) {
            accountName.innerText = profile.display_name || user.first_name || "User";
        }

        if (accountId) {
            accountId.innerText = user.id;
        }

        if (displayName) {
            displayName.value = profile.display_name || "";
        }

        if (bio) {
            bio.value = profile.bio || "";
        }

        if (visibility) {
            visibility.value = profile.inventory_visibility || "public";
        }

        if (tradingEnabled) {
            tradingEnabled.checked = Boolean(profile.trading_enabled);
        }

        renderFavoriteOptions(cardInventory, profile.favorite_card_id);
        renderCardInventory(cardInventory);

        if (profileSummary) {
            profileSummary.innerHTML = `
                <div class="inventory-item">
                    <strong>Aktuelle Einstellungen</strong><br>
                    Inventar: ${profile.inventory_visibility || "public"}<br>
                    Trading: ${profile.trading_enabled ? "aktiv" : "aus"}<br>
                    Lieblingskarte: ${profile.favorite_card_name || "Keine"}
                </div>
            `;
        }

        const profileForm = document.getElementById("profileForm");
        if (profileForm && !profileForm.dataset.bound) {
            profileForm.dataset.bound = "1";
            profileForm.addEventListener("submit", async event => {
                event.preventDefault();

                const saveButton = document.getElementById("saveProfileButton");
                if (saveButton) {
                    saveButton.disabled = true;
                }

                try {
                    const result = await postJson("/profile/update", {
                        initData: tg.initData,
                        user_id: user.id,
                        display_name: document.getElementById("displayName").value,
                        bio: document.getElementById("bio").value,
                        inventory_visibility: document.getElementById("inventoryVisibility").value,
                        trading_enabled: document.getElementById("tradingEnabled").checked,
                        favorite_card_id: document.getElementById("favoriteCardId").value || null
                    });

                    if (!result.ok) {
                        alert("Profil konnte nicht gespeichert werden.");
                        return;
                    }

                    await loadProfilePage(tg, user, secureData);
                } catch (error) {
                    console.log(error);
                    alert("Fehler beim Speichern des Profils.");
                } finally {
                    if (saveButton) {
                        saveButton.disabled = false;
                    }
                }
            });
        }
    } catch (error) {
        console.log(error);
    }
}

async function loadTradingPage(tg, user) {
    try {
        const traderData = await postJson("/traders", {
            initData: tg.initData,
            user_id: user.id
        });

        if (!traderData.ok) {
            return;
        }

        const traderList = document.getElementById("traderList");
        const tradeOffersList = document.getElementById("tradeOffersList");
        const targetTraderSelect = document.getElementById("targetTraderId");
        const myTradeCardSelect = document.getElementById("myTradeCardId");
        const wantedTradeCardSelect = document.getElementById("wantedTradeCardId");
        const myTradePreview = document.getElementById("myTradePreview");
        const wantedTradePreview = document.getElementById("wantedTradePreview");
        let selectedTargetCards = [];

        if (traderList) {
            if (!traderData.traders.length) {
                traderList.innerHTML = "<div class='inventory-item'>Noch keine oeffentlichen Trader gefunden.</div>";
            } else {
                traderList.innerHTML = traderData.traders.map(trader => `
                    <div class="trader-card">
                        <strong>${trader.display_name}</strong><br>
                        ${trader.bio || "Keine Bio"}<br>
                        <span class="muted">Lieblingskarte: ${trader.favorite_card_name || "Keine"}</span><br><br>
                        <button class="shop-btn trader-profile-btn" data-target-user-id="${trader.user_id}">
                            Profil ansehen
                            <small>Sammlung und Profil ansehen</small>
                        </button>
                    </div>
                `).join("");
            }
        }

        if (tradeOffersList) {
            if (!traderData.trade_offers.length) {
                tradeOffersList.innerHTML = "<div class='history-item'>Noch keine Trade-Angebote.</div>";
            } else {
                tradeOffersList.innerHTML = traderData.trade_offers.map(offer => `
                    <div class="trade-offer-card">
                        <strong>Trade #${offer.id}</strong><br>
                        Status: ${offer.status}<br>
                        <span class="muted">Erstellt: ${formatDate(offer.created_at)}</span>
                        <div class="trade-offer-row">
                            <div class="card-face ${getRarityClass(offer.offered_card_rarity)}">
                                <div class="trade-side-label">Angebot</div>
                                <div class="card-name">${offer.offered_card_name}</div>
                                <div class="card-rarity">${offer.offered_card_rarity}</div>
                            </div>
                            <div class="card-face ${getRarityClass(offer.requested_card_rarity)}">
                                <div class="trade-side-label">Wunsch</div>
                                <div class="card-name">${offer.requested_card_name}</div>
                                <div class="card-rarity">${offer.requested_card_rarity}</div>
                            </div>
                        </div>
                        ${offer.to_user_id === user.id && offer.status === "pending" ? `
                            <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                                <button class="shop-btn trade-response-btn" data-trade-id="${offer.id}" data-action="accept">Annehmen<small>Karten tauschen</small></button>
                                <button class="shop-btn trade-response-btn" data-trade-id="${offer.id}" data-action="reject">Ablehnen<small>Angebot schliessen</small></button>
                            </div>
                        ` : offer.to_user_id === 999000111 && offer.from_user_id === user.id && offer.status === "pending" ? `
                            <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                                <button class="shop-btn trade-debug-accept-btn" data-trade-id="${offer.id}">Debug Accept<small>Test Trader simulieren</small></button>
                            </div>
                        ` : ""}
                    </div>
                `).join("");
            }
        }

        if (targetTraderSelect) {
            targetTraderSelect.innerHTML = "<option value=''>Trader waehlen</option>" + traderData.traders.map(trader => (
                `<option value="${trader.user_id}">${trader.display_name}</option>`
            )).join("");
        }

        const myCards = await postJson("/profile", {
            initData: tg.initData,
            user_id: user.id
        });
        const myCardInventory = myCards.card_inventory || [];

        if (myTradeCardSelect) {
            myTradeCardSelect.innerHTML = "<option value=''>Deine Karte waehlen</option>" + myCardInventory.map(card => (
                `<option value="${card.card_id}">${card.card_name} (${card.rarity}) x${card.quantity}</option>`
            )).join("");
        }

        if (myTradePreview) {
            myTradePreview.innerHTML = "<div class='inventory-item'>Deine ausgewaehlte Karte erscheint hier.</div>";
        }

        if (wantedTradePreview) {
            wantedTradePreview.innerHTML = "<div class='inventory-item'>Die Wunschkarte des Traders erscheint hier.</div>";
        }

        if (myTradeCardSelect && !myTradeCardSelect.dataset.bound) {
            myTradeCardSelect.dataset.bound = "1";
            myTradeCardSelect.addEventListener("change", () => {
                const selectedCard = findCardById(myCardInventory, myTradeCardSelect.value);
                renderCardCollection(
                    selectedCard ? [selectedCard] : [],
                    myTradePreview,
                    "Deine ausgewaehlte Karte erscheint hier.",
                    { slotLabel: "DEIN" }
                );
            });
        }

        if (targetTraderSelect && !targetTraderSelect.dataset.bound) {
            targetTraderSelect.dataset.bound = "1";
            targetTraderSelect.addEventListener("change", async () => {
                wantedTradeCardSelect.innerHTML = "<option value=''>Karte waehlen</option>";
                selectedTargetCards = [];
                renderCardCollection([], wantedTradePreview, "Die Wunschkarte des Traders erscheint hier.", { slotLabel: "WUNSCH" });

                if (!targetTraderSelect.value) {
                    return;
                }

                const targetCards = await postJson("/trader-cards", {
                    initData: tg.initData,
                    user_id: user.id,
                    target_user_id: targetTraderSelect.value
                });

                if (!targetCards.ok) {
                    return;
                }

                selectedTargetCards = targetCards.cards || [];

                wantedTradeCardSelect.innerHTML = "<option value=''>Karte waehlen</option>" + selectedTargetCards.map(card => (
                    `<option value="${card.card_id}">${card.card_name} (${card.rarity}) x${card.quantity}</option>`
                )).join("");
            });
        }

        if (wantedTradeCardSelect && !wantedTradeCardSelect.dataset.bound) {
            wantedTradeCardSelect.dataset.bound = "1";
            wantedTradeCardSelect.addEventListener("change", () => {
                const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect.value);
                renderCardCollection(
                    selectedCard ? [selectedCard] : [],
                    wantedTradePreview,
                    "Die Wunschkarte des Traders erscheint hier.",
                    { slotLabel: "WUNSCH" }
                );
            });
        }

        const tradeForm = document.getElementById("tradeForm");
        if (tradeForm && !tradeForm.dataset.bound) {
            tradeForm.dataset.bound = "1";
            tradeForm.addEventListener("submit", async event => {
                event.preventDefault();

                const targetTraderId = document.getElementById("targetTraderId").value;
                const offeredCardId = document.getElementById("myTradeCardId").value;
                const requestedCardId = document.getElementById("wantedTradeCardId").value;

                if (!targetTraderId || !offeredCardId || !requestedCardId) {
                    alert("Bitte waehle Trader, eigene Karte und Wunschkarte aus.");
                    return;
                }

                const createButton = document.getElementById("createTradeButton");
                if (createButton) {
                    createButton.disabled = true;
                }

                try {
                    const result = await postJson("/trade-offer/create", {
                        initData: tg.initData,
                        user_id: user.id,
                        target_user_id: targetTraderId,
                        offered_card_id: offeredCardId,
                        requested_card_id: requestedCardId
                    });

                    if (!result.ok) {
                        alert(result.error || "Trade-Angebot konnte nicht erstellt werden.");
                        return;
                    }

                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    alert("Fehler beim Erstellen des Trade-Angebots.");
                } finally {
                    if (createButton) {
                        createButton.disabled = false;
                    }
                }
            });
        }

        document.querySelectorAll(".trade-response-btn").forEach(button => {
            if (button.dataset.bound) {
                return;
            }

            button.dataset.bound = "1";
            button.addEventListener("click", async () => {
                button.disabled = true;

                try {
                    const result = await postJson("/trade-offer/respond", {
                        initData: tg.initData,
                        user_id: user.id,
                        trade_id: button.dataset.tradeId,
                        action: button.dataset.action
                    });

                    if (!result.ok) {
                        alert("Trade konnte nicht verarbeitet werden.");
                        return;
                    }

                    renderCardInventory(result.card_inventory || []);
                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    alert("Fehler beim Bearbeiten des Trades.");
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll(".trader-profile-btn").forEach(button => {
            if (button.dataset.bound) {
                return;
            }

            button.dataset.bound = "1";
            button.addEventListener("click", async () => {
                button.disabled = true;

                try {
                    const result = await postJson("/public-profile", {
                        initData: tg.initData,
                        user_id: user.id,
                        target_user_id: button.dataset.targetUserId
                    });

                    if (!result.ok) {
                        alert("Profil konnte nicht geladen werden.");
                        return;
                    }

                    const publicProfileView = document.getElementById("publicProfileView");
                    if (!publicProfileView) {
                        return;
                    }

                    const profile = result.profile;

                    publicProfileView.innerHTML = `
                        <div class="trader-card">
                            <strong>${profile.display_name || "User " + profile.user_id}</strong><br>
                            ${profile.bio || "Keine Bio"}<br>
                            Trading: ${profile.trading_enabled ? "aktiv" : "aus"}<br>
                            Inventar: ${profile.inventory_visibility}<br>
                            Lieblingskarte: ${profile.favorite_card_name || "Keine"}
                        </div>
                        <div class="card-reveal-grid">
                            ${
                                profile.inventory_visibility === "public"
                                    ? (
                                        profile.visible_cards.length
                                            ? profile.visible_cards.map(card => `
                                                <div class="card-face ${getRarityClass(card.rarity)}">
                                                    <div class="card-slot">${card.rarity}</div>
                                                    <div class="card-name">${card.card_name}</div>
                                                    <div class="card-rarity">${card.rarity}</div>
                                                    <div class="card-qty">Menge: ${card.quantity}</div>
                                                    <div class="card-pack-label">${card.pack_key || "Public Collection"}</div>
                                                </div>
                                            `).join("")
                                            : "<div class='inventory-item'>Keine sichtbaren Karten vorhanden.</div>"
                                      )
                                    : "<div class='inventory-item'>Dieses Inventar ist privat.</div>"
                            }
                        </div>
                    `;
                } catch (error) {
                    console.log(error);
                    alert("Fehler beim Laden des Profils.");
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll(".trade-debug-accept-btn").forEach(button => {
            if (button.dataset.bound) {
                return;
            }

            button.dataset.bound = "1";
            button.addEventListener("click", async () => {
                button.disabled = true;

                try {
                    const result = await postJson("/trade-offer/debug-accept", {
                        initData: tg.initData,
                        user_id: user.id,
                        trade_id: button.dataset.tradeId
                    });

                    if (!result.ok) {
                        alert(result.error || "Debug Accept fehlgeschlagen.");
                        return;
                    }

                    renderCardInventory(result.card_inventory || []);
                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    alert("Fehler bei Debug Accept.");
                } finally {
                    button.disabled = false;
                }
            });
        });
    } catch (error) {
        console.log(error);
    }
}
