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

function ensureToastStack() {
    let stack = document.getElementById("toastStack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "toastStack";
        stack.className = "toast-stack";
        document.body.appendChild(stack);
    }
    return stack;
}

function showToast(message, mode = "info", duration = 2600) {
    const stack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${mode}`;
    toast.innerHTML = message;
    stack.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, duration);
}

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

function updateAccountHero(user, secureData = {}, profile = {}) {
    const displayName = profile.display_name || user.first_name || "User";
    const username = user.username ? `@${user.username}` : `@user_${user.id}`;
    const avatarUrl = user.photo_url || "https://via.placeholder.com/120";
    const cardCount = (secureData.card_inventory || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const boosterCount = (secureData.inventory || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const fields = {
        accountProfileName: displayName,
        accountHandle: username,
        accountCoins: Number(secureData.coins || 0),
        accountCards: cardCount,
        accountBoosters: boosterCount,
        accountBioText: profile.bio || "Baue dein Deck, oeffne Booster und trade mit anderen Spielern.",
        accountTradingStatus: profile.trading_enabled ? "Trading aktiv" : "Trading aus",
        accountVisibilityStatus: `Inventar ${profile.inventory_visibility || "public"}`,
        accountOpeningStatus: `Openings ${profile.opening_visibility || "public"}`
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerText = value;
        }
    });

    const accountAvatar = document.getElementById("accountAvatar");
    if (accountAvatar) {
        accountAvatar.src = avatarUrl;
    }

    renderProfileShowcase(profile);
}

function renderProfileShowcase(profile = {}) {
    const showcase = document.getElementById("profileShowcase");
    if (!showcase) {
        return;
    }

    if (!profile.favorite_card_id) {
        showcase.innerHTML = `
            <div class="showcase-empty">
                <strong>Keine Lieblingskarte gesetzt</strong>
                <span>Waehle eine Karte im Inventory als Showcase.</span>
            </div>
        `;
        return;
    }

    const card = {
        card_name: profile.favorite_card_name,
        rarity: profile.favorite_card_rarity,
        image_url: profile.favorite_card_image_url
    };

    showcase.innerHTML = `
        <div class="showcase-copy">
            <span>Showcase</span>
            <strong>${profile.favorite_card_name || "Lieblingskarte"}</strong>
            <p>${profile.favorite_card_rarity || "CARD"} aus ${profile.favorite_card_pack_key || "Collection"}</p>
        </div>
        <div class="showcase-card ${getRarityClass(profile.favorite_card_rarity)}">
            ${getCardArtMarkup(card)}
            <div class="card-slot">${profile.favorite_card_rarity || "CARD"}</div>
        </div>
    `;
}

function setupProfileTabs() {
    const tabs = document.querySelectorAll("[data-profile-tab]");
    const panels = document.querySelectorAll("[data-profile-panel]");

    if (!tabs.length || !panels.length) {
        return;
    }

    tabs.forEach(tab => {
        if (tab.dataset.bound) {
            return;
        }

        tab.dataset.bound = "1";
        tab.addEventListener("click", () => {
            const target = tab.dataset.profileTab;

            tabs.forEach(item => {
                item.classList.toggle("active", item === tab);
            });

            panels.forEach(panel => {
                panel.classList.toggle("active", panel.dataset.profilePanel === target);
            });
        });
    });
}

function setupKeyboardFriendlyForms() {
    const focusableSelector = "input, textarea, select";
    const closeFormFocus = () => {
        if (document.activeElement && document.activeElement.matches(focusableSelector)) {
            document.activeElement.blur();
        }
        document.body.classList.remove("form-focus-mode");
    };

    document.addEventListener("focusin", event => {
        if (!event.target.matches(focusableSelector)) {
            return;
        }

        document.body.classList.add("form-focus-mode");
        window.setTimeout(() => {
            event.target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 120);
    });

    document.addEventListener("focusout", event => {
        if (!event.target.matches(focusableSelector)) {
            return;
        }

        window.setTimeout(() => {
            if (!document.activeElement || !document.activeElement.matches(focusableSelector)) {
                document.body.classList.remove("form-focus-mode");
            }
        }, 120);
    });

    document.addEventListener("pointerdown", event => {
        if (!document.body.classList.contains("form-focus-mode")) {
            return;
        }

        if (event.target.closest(focusableSelector)) {
            return;
        }

        closeFormFocus();
    });
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

function renderDashboardStats(inventoryItems, cardItems, coinAmount) {
    const dashboardStats = document.getElementById("dashboardStats");
    const rarityStats = document.getElementById("rarityStats");

    if (!dashboardStats && !rarityStats) {
        return;
    }

    const inventory = inventoryItems || [];
    const cards = cardItems || [];
    const totalBoosters = inventory.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalCards = cards.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const uniqueCards = cards.length;
    const rarityCounts = { N: 0, R: 0, SR: 0, SEC: 0 };

    cards.forEach(card => {
        const rarity = String(card.rarity || "N").toUpperCase();
        if (rarityCounts[rarity] !== undefined) {
            rarityCounts[rarity] += Number(card.quantity || 0);
        }
    });

    if (dashboardStats) {
        dashboardStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Coins</div>
                <div class="stat-value">${Number(coinAmount || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Booster</div>
                <div class="stat-value">${totalBoosters}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Alle Karten</div>
                <div class="stat-value">${totalCards}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique Cards</div>
                <div class="stat-value">${uniqueCards}</div>
            </div>
        `;
    }

    if (rarityStats) {
        rarityStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Normal</div>
                <div class="stat-value">${rarityCounts.N}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Rare</div>
                <div class="stat-value">${rarityCounts.R}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">SR</div>
                <div class="stat-value">${rarityCounts.SR}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">SEC</div>
                <div class="stat-value">${rarityCounts.SEC}</div>
            </div>
        `;
    }
}

async function loadHomeDashboard(tg, user) {
    try {
        const [data, pullData] = await Promise.all([
            postJson("/news", {
                initData: tg.initData,
                user_id: user.id
            }),
            postJson("/top-pulls", {
                initData: tg.initData,
                user_id: user.id
            })
        ]);

        renderHomeNews(data.news || []);
        renderTopPulls(pullData.pulls || []);
    } catch (error) {
        console.log(error);
    }
}

function renderTopPulls(pulls) {
    const topPullNewsList = document.getElementById("topPullNewsList");
    if (!topPullNewsList || !pulls.length) {
        return;
    }

    topPullNewsList.innerHTML = pulls.map(pull => {
        const username = pull.username || pull.first_name || "Spieler";
        return `
            <article class="news-card top-pull-card ${String(pull.rarity).toLowerCase()}">
                ${pull.image_url ? `<img src="${pull.image_url}" alt="${pull.card_name}">` : `<div class="top-pull-fallback">${pull.rarity}</div>`}
                <div>
                    <strong>${pull.card_name}</strong>
                    <p>${username} hat ${pull.rarity} aus ${pull.pack_name || "Booster"} gezogen.</p>
                    <small>${formatDate(pull.opened_at)}</small>
                </div>
            </article>
        `;
    }).join("");
}

function renderNewsCards(items, targetElement, fallbackHtml) {
    if (!targetElement) {
        return;
    }

    if (!items.length) {
        targetElement.innerHTML = fallbackHtml;
        return;
    }

    targetElement.innerHTML = items.map(item => `
        <article class="news-card">
            <strong>${item.title}</strong>
            <p>${item.body}</p>
        </article>
    `).join("");
}

function renderHomeNews(newsItems) {
    const items = newsItems || [];
    const featuredNews = document.getElementById("featuredNews");
    const topPullNewsList = document.getElementById("topPullNewsList");
    const shopNewsList = document.getElementById("shopNewsList");
    const roadmapNewsList = document.getElementById("roadmapNewsList");

    const featured = items.find(item => item.news_type === "featured");
    if (featuredNews && featured) {
        featuredNews.innerHTML = `
            <span class="news-tag">${featured.badge || "News"}</span>
            <h2>${featured.title}</h2>
            <p>${featured.body}</p>
            <div class="news-pack-preview">
                <span>${String(featured.pack_key || "PK").slice(0, 2).toUpperCase()}</span>
            </div>
        `;
    }

    renderNewsCards(
        items.filter(item => item.news_type === "pull"),
        topPullNewsList,
        `
            <article class="news-card">
                <strong>Top Pull der Woche</strong>
                <p>Hier spaeter: User zieht SEC Karte aus einem Booster.</p>
            </article>
            <article class="news-card">
                <strong>Rare Streak</strong>
                <p>Hier spaeter: beste Serie oder besondere Pull-Statistik.</p>
            </article>
        `
    );

    renderNewsCards(
        items.filter(item => item.news_type === "shop"),
        shopNewsList,
        `
            <article class="news-card">
                <strong>Coin Bonus Event</strong>
                <p>Platzhalter fuer spaetere Angebote, Bonus-Coins oder Rabattaktionen.</p>
            </article>
            <article class="news-card">
                <strong>Premium Update</strong>
                <p>Platzhalter fuer Premium-Funktionen, falls Premium wieder aktiv genutzt wird.</p>
            </article>
        `
    );

    if (roadmapNewsList) {
        const roadmapItems = items.filter(item => item.news_type === "roadmap");
        if (roadmapItems.length) {
            roadmapNewsList.innerHTML = roadmapItems.map(item => `<span>${item.title}</span>`).join("");
        }
    }
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

function getCardArtMarkup(card) {
    if (card && card.image_url) {
        return `<img class="card-art" src="${card.image_url}" alt="${card.card_name || "Card"}">`;
    }

    const rarity = String((card && card.rarity) || "N").toUpperCase();
    return `<div class="card-art-fallback">${rarity}</div>`;
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
            ${getCardArtMarkup(card)}
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
                ${getCardArtMarkup(card)}
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
            ${getCardArtMarkup(item)}
            <div class="card-slot">${options.slotLabel || item.rarity || "CARD"}</div>
            <div class="card-name">${item.card_name}</div>
            <div class="card-rarity">${item.rarity}</div>
            <div class="card-qty">${options.qtyLabel || "Menge"}: ${options.displayQuantity || item.quantity || 1}</div>
            <div class="card-pack-label">${item.pack_key || options.packLabel || "Collection"}</div>
        </div>
    `).join("");
}

function findCardById(items, cardId) {
    return (items || []).find(card => String(card.card_id) === String(cardId));
}

function getTradeStatusClass(status) {
    const normalized = String(status || "pending").toLowerCase();
    if (normalized === "accepted") {
        return "trade-status trade-status-accepted";
    }
    if (normalized === "rejected") {
        return "trade-status trade-status-rejected";
    }
    return "trade-status trade-status-pending";
}

function renderTradeFeedback(message, mode = "info") {
    const feedbackBox = document.getElementById("tradeFeedback");
    if (!feedbackBox) {
        return;
    }

    feedbackBox.className = mode === "success"
        ? "inventory-item trade-feedback-success"
        : "inventory-item trade-feedback-info";
    feedbackBox.innerHTML = message;
}

function renderTradeOfferCards(targetElement, offers, userId) {
    if (!targetElement) {
        return;
    }

    if (!offers.length) {
        targetElement.innerHTML = "<div class='history-item'>Noch keine Trades in diesem Bereich.</div>";
        return;
    }

    targetElement.innerHTML = offers.map(offer => `
        <div class="trade-offer-card">
            <strong>Trade #${offer.id}</strong><br>
            <div class="${getTradeStatusClass(offer.status)}">${offer.status}</div><br>
            <span class="muted">Erstellt: ${formatDate(offer.created_at)}</span>
            ${offer.responded_at ? `<br><span class="muted">Bearbeitet: ${formatDate(offer.responded_at)}</span>` : ""}
            <div class="trade-offer-row">
                <div class="card-face ${getRarityClass(offer.offered_card_rarity)}">
                    ${getCardArtMarkup({ image_url: offer.offered_card_image_url, card_name: offer.offered_card_name, rarity: offer.offered_card_rarity })}
                    <div class="trade-side-label">${offer.from_user_id === userId ? "Dein Angebot" : "Angeboten an dich"}</div>
                    <div class="card-name">${offer.offered_card_name}</div>
                    <div class="card-rarity">${offer.offered_card_rarity}</div>
                    <div class="card-qty">Menge: ${offer.offered_quantity || 1}</div>
                </div>
                <div class="card-face ${getRarityClass(offer.requested_card_rarity)}">
                    ${getCardArtMarkup({ image_url: offer.requested_card_image_url, card_name: offer.requested_card_name, rarity: offer.requested_card_rarity })}
                    <div class="trade-side-label">${offer.to_user_id === userId ? "Dein Erhalt" : "Dein Wunsch"}</div>
                    <div class="card-name">${offer.requested_card_name}</div>
                    <div class="card-rarity">${offer.requested_card_rarity}</div>
                    <div class="card-qty">Menge: ${offer.requested_quantity || 1}</div>
                </div>
            </div>
            ${offer.to_user_id === userId && offer.status === "pending" ? `
                <div class="trade-action-row">
                    <button class="shop-btn trade-response-btn trade-accept-btn" data-trade-id="${offer.id}" data-action="accept">Annehmen<small>Karten tauschen</small></button>
                    <button class="shop-btn trade-response-btn trade-reject-btn" data-trade-id="${offer.id}" data-action="reject">Ablehnen<small>Angebot schliessen</small></button>
                </div>
            ` : offer.to_user_id === 999000111 && offer.from_user_id === userId && offer.status === "pending" ? `
                <div class="trade-action-row">
                    <button class="shop-btn trade-debug-accept-btn trade-debug-btn" data-trade-id="${offer.id}">Debug Accept<small>Test Trader simulieren</small></button>
                </div>
            ` : ""}
        </div>
    `).join("");
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
        detailElement.innerHTML = `
            <div class="detail-empty">
                <strong>Keine Karte ausgewaehlt</strong>
                <span>Tippe auf eine Karte aus deiner Collection.</span>
            </div>
        `;
        return;
    }

    detailElement.innerHTML = `
        <div class="detail-panel inventory-detail-panel">
            <div class="detail-card-art showcase-card-art ${getRarityClass(card.rarity)}">
                ${getCardArtMarkup(card)}
            </div>
            <div>
                <div class="detail-title">${card.card_name}</div>
                <div class="detail-meta-grid">
                    <span><strong>${card.rarity}</strong><small>Seltenheit</small></span>
                    <span><strong>${card.quantity || 1}</strong><small>Menge</small></span>
                    <span><strong>${card.pack_key || "-"}</strong><small>Pack</small></span>
                    <span><strong>${formatDate(card.last_acquired_at)}</strong><small>Erhalten</small></span>
                </div>
                <button class="shop-btn favorite-card-btn" type="button" data-card-id="${card.card_id}">
                    Als Lieblingskarte setzen
                    <small>Im Profil anzeigen</small>
                </button>
            </div>
        </div>
    `;

    const favoriteButton = detailElement.querySelector(".favorite-card-btn");
    if (favoriteButton) {
        favoriteButton.addEventListener("click", () => setFavoriteCardFromInventory(favoriteButton.dataset.cardId));
    }
}

async function setFavoriteCardFromInventory(cardId) {
    if (!window.__tgApp || !cardId) {
        return;
    }

    const { tg, user } = window.__tgApp;
    try {
        const result = await postJson("/profile/favorite-card", {
            initData: tg.initData,
            user_id: user.id,
            favorite_card_id: cardId
        });

        if (!result.ok) {
            showToast("Lieblingskarte konnte nicht gesetzt werden.", "error");
            return;
        }

        showToast("Lieblingskarte gespeichert.", "success");
    } catch (error) {
        console.log(error);
        showToast("Fehler beim Speichern der Lieblingskarte.", "error");
    }
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
    setupProfileTabs();
    setupKeyboardFriendlyForms();

    const username = document.getElementById("username");
    const heroUsername = document.getElementById("heroUsername");
    const avatar = document.getElementById("avatar");
    const telegramID = document.getElementById("telegramID");

    if (username) {
        username.innerText = user.first_name || "User";
    }

    if (heroUsername) {
        heroUsername.innerText = user.first_name || "Dashboard";
    }

    if (avatar) {
        avatar.src = user.photo_url || "https://via.placeholder.com/45";
    }

    updateAccountHero(user);

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
    renderDashboardStats(data.inventory || [], data.card_inventory || [], data.coins || 0);
    updateAccountHero(user, data);

    if (pageName === "shop") {
        setupStarShop(tg, user);
        await loadBoosterShop(tg, user);
    }

    if (pageName === "inventory") {
        await loadBoosterShop(tg, user);
    }

    if (pageName === "home") {
        await loadHomeDashboard(tg, user);
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
                    showToast("Kauf konnte nicht gestartet werden.", "error");
                    return;
                }

                tg.openInvoice(data.invoice_url, function(status) {
                    if (status === "paid") {
                        window.location.reload();
                    }
                });
            } catch (error) {
                console.log(error);
                showToast("Fehler beim Starten des Kaufs.", "error");
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
                <button class="shop-btn booster-buy-btn booster-product-card" data-pack-key="${pack.pack_key}">
                    <span class="shop-pack-art">${String(pack.name || "PK").slice(0, 2).toUpperCase()}</span>
                    <span class="shop-product-name">${pack.name}</span>
                    <small>${pack.price} Coins | 12 Karten</small>
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
                                showToast("Nicht genug Coins fuer diesen Booster.", "error");
                            } else {
                                showToast("Booster-Kauf fehlgeschlagen.", "error");
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
                        showToast("Fehler beim Booster-Kauf.", "error");
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
                <div class="booster-pack-art" aria-hidden="true">
                    <span>${String(item.pack_name || "PACK").slice(0, 2).toUpperCase()}</span>
                </div>
                <div class="booster-pack-header">
                    <div class="booster-pack-title">${item.pack_name}</div>
                    <div class="booster-pack-count">${item.amount}x</div>
                </div>
                <div class="booster-pack-meta">
                    <span>${item.pack_key}</span>
                    <span>12 Karten</span>
                    <span>1 Rare garantiert</span>
                </div>
                <button class="shop-btn open-booster-btn open-pack-cta" data-pack-key="${item.pack_key}">
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
                            showToast("Diesen Booster besitzt du nicht mehr.", "error");
                        } else {
                            showToast("Booster konnte nicht geoeffnet werden.", "error");
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
                    showToast("Fehler beim Oeffnen.", "error");
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
        updateAccountHero(user, {
            ...secureData,
            card_inventory: cardInventory
        }, profile);

        const accountName = document.getElementById("accountName");
        const accountId = document.getElementById("accountId");
        const displayName = document.getElementById("displayName");
        const bio = document.getElementById("bio");
        const visibility = document.getElementById("inventoryVisibility");
        const openingVisibility = document.getElementById("openingVisibility");
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

        if (openingVisibility) {
            openingVisibility.value = profile.opening_visibility || "public";
        }

        if (tradingEnabled) {
            tradingEnabled.checked = Boolean(profile.trading_enabled);
        }

        renderFavoriteOptions(cardInventory, profile.favorite_card_id);
        renderCardInventory(cardInventory);

        if (profileSummary) {
            profileSummary.innerHTML = `
                <div class="profile-status-card">
                    <span>Inventar</span>
                    <strong>${profile.inventory_visibility || "public"}</strong>
                </div>
                <div class="profile-status-card">
                    <span>Trading</span>
                    <strong>${profile.trading_enabled ? "aktiv" : "aus"}</strong>
                </div>
                <div class="profile-status-card">
                    <span>Openings</span>
                    <strong>${profile.opening_visibility || "public"}</strong>
                </div>
                <div class="profile-status-card wide">
                    <span>Lieblingskarte</span>
                    <strong>${profile.favorite_card_name || "Keine"}</strong>
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
                        opening_visibility: document.getElementById("openingVisibility").value,
                        trading_enabled: document.getElementById("tradingEnabled").checked,
                        favorite_card_id: document.getElementById("favoriteCardId").value || null
                    });

                    if (!result.ok) {
                        showToast("Profil konnte nicht gespeichert werden.", "error");
                        return;
                    }

                    await loadProfilePage(tg, user, secureData);
                } catch (error) {
                    console.log(error);
                    showToast("Fehler beim Speichern des Profils.", "error");
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
        const incomingTradeOffersList = document.getElementById("incomingTradeOffersList");
        const outgoingTradeOffersList = document.getElementById("outgoingTradeOffersList");
        const targetTraderSelect = document.getElementById("targetTraderId");
        const myTradeCardSelect = document.getElementById("myTradeCardId");
        const myTradeQuantity = document.getElementById("myTradeQuantity");
        const wantedTradeCardSelect = document.getElementById("wantedTradeCardId");
        const wantedTradeQuantity = document.getElementById("wantedTradeQuantity");
        const myTradePreview = document.getElementById("myTradePreview");
        const wantedTradePreview = document.getElementById("wantedTradePreview");
        let selectedTargetCards = [];

        function fillQuantitySelect(selectElement, maxAmount, labelPrefix) {
            if (!selectElement) {
                return;
            }

            const safeMax = Math.max(1, Number(maxAmount || 1));
            const options = [];
            for (let i = 1; i <= safeMax; i += 1) {
                options.push(`<option value="${i}">${labelPrefix}: ${i}</option>`);
            }
            selectElement.innerHTML = options.join("");
        }

        function updateTradePreview(targetElement, selectedCard, emptyMessage, slotLabel, quantityValue, qtyLabel) {
            renderCardCollection(
                selectedCard ? [selectedCard] : [],
                targetElement,
                emptyMessage,
                {
                    slotLabel,
                    displayQuantity: Number(quantityValue || 1),
                    qtyLabel
                }
            );
        }

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

        const allTradeOffers = traderData.trade_offers || [];
        const incomingOffers = allTradeOffers.filter(offer => Number(offer.to_user_id) === Number(user.id));
        const outgoingOffers = allTradeOffers.filter(offer => Number(offer.from_user_id) === Number(user.id));

        renderTradeOfferCards(incomingTradeOffersList, incomingOffers, user.id);
        renderTradeOfferCards(outgoingTradeOffersList, outgoingOffers, user.id);

        if (document.getElementById("tradeFeedback") && !document.getElementById("tradeFeedback").dataset.initialized) {
            document.getElementById("tradeFeedback").dataset.initialized = "1";
            renderTradeFeedback("Hier siehst du gleich, ob ein Trade erstellt, angenommen oder abgelehnt wurde.", "info");
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

        fillQuantitySelect(myTradeQuantity, 1, "Deine Menge");
        fillQuantitySelect(wantedTradeQuantity, 1, "Wunsch-Menge");

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
                fillQuantitySelect(myTradeQuantity, selectedCard ? selectedCard.quantity : 1, "Deine Menge");
                updateTradePreview(myTradePreview, selectedCard, "Deine ausgewaehlte Karte erscheint hier.", "DEIN", myTradeQuantity ? myTradeQuantity.value : 1, "Du gibst");
            });
        }

        if (myTradeQuantity && !myTradeQuantity.dataset.bound) {
            myTradeQuantity.dataset.bound = "1";
            myTradeQuantity.addEventListener("change", () => {
                const selectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
                updateTradePreview(myTradePreview, selectedCard, "Deine ausgewaehlte Karte erscheint hier.", "DEIN", myTradeQuantity.value, "Du gibst");
            });
        }

        if (targetTraderSelect && !targetTraderSelect.dataset.bound) {
            targetTraderSelect.dataset.bound = "1";
            targetTraderSelect.addEventListener("change", async () => {
                wantedTradeCardSelect.innerHTML = "<option value=''>Karte waehlen</option>";
                fillQuantitySelect(wantedTradeQuantity, 1, "Wunsch-Menge");
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
                fillQuantitySelect(wantedTradeQuantity, selectedCard ? selectedCard.quantity : 1, "Wunsch-Menge");
                updateTradePreview(wantedTradePreview, selectedCard, "Die Wunschkarte des Traders erscheint hier.", "WUNSCH", wantedTradeQuantity ? wantedTradeQuantity.value : 1, "Du willst");
            });
        }

        if (wantedTradeQuantity && !wantedTradeQuantity.dataset.bound) {
            wantedTradeQuantity.dataset.bound = "1";
            wantedTradeQuantity.addEventListener("change", () => {
                const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");
                updateTradePreview(wantedTradePreview, selectedCard, "Die Wunschkarte des Traders erscheint hier.", "WUNSCH", wantedTradeQuantity.value, "Du willst");
            });
        }

        const tradeForm = document.getElementById("tradeForm");
        if (tradeForm && !tradeForm.dataset.bound) {
            tradeForm.dataset.bound = "1";
            tradeForm.addEventListener("submit", async event => {
                event.preventDefault();

                const targetTraderId = document.getElementById("targetTraderId").value;
                const offeredCardId = document.getElementById("myTradeCardId").value;
                const offeredQuantity = document.getElementById("myTradeQuantity").value;
                const requestedCardId = document.getElementById("wantedTradeCardId").value;
                const requestedQuantity = document.getElementById("wantedTradeQuantity").value;

                if (!targetTraderId || !offeredCardId || !requestedCardId || !offeredQuantity || !requestedQuantity) {
                    showToast("Bitte waehle Trader, Karten und Mengen aus.", "error");
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
                        offered_quantity: offeredQuantity,
                        requested_card_id: requestedCardId,
                        requested_quantity: requestedQuantity
                    });

                    if (!result.ok) {
                        showToast(result.error || "Trade-Angebot konnte nicht erstellt werden.", "error");
                        return;
                    }

                    renderTradeFeedback("Trade-Angebot erfolgreich erstellt. Es ist jetzt im Bereich <strong>Gesendete Trades</strong> sichtbar.", "success");
                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    showToast("Fehler beim Erstellen des Trade-Angebots.", "error");
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
                        showToast("Trade konnte nicht verarbeitet werden.", "error");
                        return;
                    }

                    renderTradeFeedback(
                        button.dataset.action === "accept"
                            ? "Trade erfolgreich angenommen. Die Karten wurden getauscht."
                            : "Trade wurde abgelehnt und geschlossen.",
                        "success"
                    );
                    renderCardInventory(result.card_inventory || []);
                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    showToast("Fehler beim Bearbeiten des Trades.", "error");
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
                        showToast("Profil konnte nicht geladen werden.", "error");
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
                        <div class="public-showcase-card">
                            ${
                                profile.favorite_card_id
                                    ? `
                                        <div class="showcase-card ${getRarityClass(profile.favorite_card_rarity)}">
                                            ${getCardArtMarkup({
                                                card_name: profile.favorite_card_name,
                                                rarity: profile.favorite_card_rarity,
                                                image_url: profile.favorite_card_image_url
                                            })}
                                            <div class="card-slot">${profile.favorite_card_rarity || "CARD"}</div>
                                        </div>
                                        <div>
                                            <strong>${profile.favorite_card_name}</strong>
                                            <p>${profile.favorite_card_rarity || "CARD"} aus ${profile.favorite_card_pack_key || "Collection"}</p>
                                        </div>
                                    `
                                    : "<div class='inventory-item'>Keine Lieblingskarte gesetzt.</div>"
                            }
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
                    showToast("Fehler beim Laden des Profils.", "error");
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
                        showToast(result.error || "Debug Accept fehlgeschlagen.", "error");
                        return;
                    }

                    renderTradeFeedback("Debug Accept erfolgreich. Der Test-Trade wurde simuliert und die Karten wurden getauscht.", "success");
                    renderCardInventory(result.card_inventory || []);
                    await loadTradingPage(tg, user);
                } catch (error) {
                    console.log(error);
                    showToast("Fehler bei Debug Accept.", "error");
                } finally {
                    button.disabled = false;
                }
            });
        });
    } catch (error) {
        console.log(error);
    }
}


