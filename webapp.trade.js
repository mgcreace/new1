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

function getTradeStatusLabel(status) {
    const normalized = String(status || "pending").toLowerCase();
    if (normalized === "accepted") {
        return "angenommen";
    }
    if (normalized === "rejected") {
        return "abgelehnt";
    }
    return "offen";
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

function renderTradeOfferCards(targetElement, offers, userId, emptyMessage = "Noch keine Trades in diesem Bereich.") {
    if (!targetElement) {
        return;
    }

    if (!offers.length) {
        targetElement.innerHTML = `
            <div class="history-item trade-mail-empty">
                <strong>Keine Mail</strong>
                <span>${emptyMessage}</span>
            </div>
        `;
        return;
    }

    targetElement.innerHTML = offers.map(offer => `
        <div class="trade-offer-card trade-mail-card ${Number(offer.to_user_id) === Number(userId) ? "is-incoming" : "is-outgoing"}">
            <div class="trade-mail-head">
                <div class="trade-mail-headline">
                    <span class="trade-mail-tag">${Number(offer.to_user_id) === Number(userId) ? "Eingehend" : "Gesendet"}</span>
                    <strong>Trade #${offer.id}</strong>
                </div>
                <div class="${getTradeStatusClass(offer.status)}">${getTradeStatusLabel(offer.status)}</div>
            </div>
            <div class="trade-mail-meta">
                <span>${Number(offer.to_user_id) === Number(userId) ? `Von User ${offer.from_user_id}` : `An User ${offer.to_user_id}`}</span>
                <span>Erstellt: ${formatDate(offer.created_at)}</span>
                ${offer.responded_at ? `<span>Bearbeitet: ${formatDate(offer.responded_at)}</span>` : ""}
            </div>
            <div class="trade-mail-summary">
                <div class="trade-mail-side">
                    <span class="trade-mail-side-title">${offer.from_user_id === userId ? "Du gibst" : "Du bekommst"}</span>
                    <strong>${offer.offered_card_name}</strong>
                    <small>${offer.offered_card_rarity} • x${offer.offered_quantity || 1}</small>
                </div>
                <div class="trade-mail-swap">⇄</div>
                <div class="trade-mail-side">
                    <span class="trade-mail-side-title">${offer.to_user_id === userId ? "Du gibst" : "Du willst"}</span>
                    <strong>${offer.requested_card_name}</strong>
                    <small>${offer.requested_card_rarity} • x${offer.requested_quantity || 1}</small>
                </div>
            </div>
            <div class="trade-offer-row">
                <div class="card-face ${getRarityClass(offer.offered_card_rarity)}" ${getCardDetailAttributes({ image_url: offer.offered_card_image_url, card_name: offer.offered_card_name, rarity: offer.offered_card_rarity }, { displayQuantity: offer.offered_quantity || 1 })}>
                    ${getCardArtMarkup({ image_url: offer.offered_card_image_url, card_name: offer.offered_card_name, rarity: offer.offered_card_rarity })}
                    <div class="trade-side-label">${offer.from_user_id === userId ? "Dein Angebot" : "An dich"}</div>
                    <div class="card-name">${offer.offered_card_name}</div>
                    <div class="card-rarity">${offer.offered_card_rarity}</div>
                    <div class="card-qty">Menge: ${offer.offered_quantity || 1}</div>
                </div>
                <div class="card-face ${getRarityClass(offer.requested_card_rarity)}" ${getCardDetailAttributes({ image_url: offer.requested_card_image_url, card_name: offer.requested_card_name, rarity: offer.requested_card_rarity }, { displayQuantity: offer.requested_quantity || 1 })}>
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
        const targetTraderSelect = document.getElementById("targetTraderId");
        const myTradeCardSelect = document.getElementById("myTradeCardId");
        const myTradeQuantity = document.getElementById("myTradeQuantity");
        const wantedTradeCardSelect = document.getElementById("wantedTradeCardId");
        const wantedTradeQuantity = document.getElementById("wantedTradeQuantity");
        const myTradePreview = document.getElementById("myTradePreview");
        const wantedTradePreview = document.getElementById("wantedTradePreview");
        const myTradeTapCards = document.getElementById("myTradeTapCards");
        const wantedTradeTapCards = document.getElementById("wantedTradeTapCards");
        const resetMyTradePick = document.getElementById("resetMyTradePick");
        const resetWantedTradePick = document.getElementById("resetWantedTradePick");
        const tradeBuilderSummary = document.getElementById("tradeBuilderSummary");
        const tradeCompareBar = document.getElementById("tradeCompareBar");
        const myTradeQtyDisplay = document.getElementById("myTradeQtyDisplay");
        const wantedTradeQtyDisplay = document.getElementById("wantedTradeQtyDisplay");
        const decreaseMyTradeQty = document.getElementById("decreaseMyTradeQty");
        const increaseMyTradeQty = document.getElementById("increaseMyTradeQty");
        const decreaseWantedTradeQty = document.getElementById("decreaseWantedTradeQty");
        const increaseWantedTradeQty = document.getElementById("increaseWantedTradeQty");
        const tradeParams = new URLSearchParams(window.location.search);
        const preselectTargetUserId = tradeParams.get("target_user_id");
        const preselectWantedCardId = tradeParams.get("wanted_card_id");
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

        function renderTradeBuilderSummary() {
            if (!tradeBuilderSummary) {
                return;
            }

            const selectedTrader = (traderData.traders || []).find(trader => String(trader.user_id) === String(targetTraderSelect ? targetTraderSelect.value : ""));
            const mySelectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
            const wantedSelectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");
            const missing = [];

            if (!selectedTrader) {
                missing.push("Trader");
            }
            if (!mySelectedCard) {
                missing.push("deine Karte");
            }
            if (!wantedSelectedCard) {
                missing.push("Wunschkarte");
            }

            tradeBuilderSummary.className = `trade-builder-summary ${missing.length ? "is-pending" : "is-ready"}`;
            tradeBuilderSummary.innerHTML = `
                <strong>${missing.length ? "Trade noch nicht fertig" : "Trade ist bereit"}</strong>
                <span>${selectedTrader ? `Trader: ${selectedTrader.display_name}` : "Trader noch nicht gewaehlt"}</span>
                <span>${mySelectedCard ? `Du gibst: ${mySelectedCard.card_name} x${myTradeQuantity ? myTradeQuantity.value : 1}` : "Deine Karte fehlt noch"}</span>
                <span>${wantedSelectedCard ? `Du willst: ${wantedSelectedCard.card_name} x${wantedTradeQuantity ? wantedTradeQuantity.value : 1}` : "Wunschkarte fehlt noch"}</span>
                <small>${missing.length ? `Fehlt noch: ${missing.join(", ")}` : "Sieht gut aus. Du kannst das Angebot jetzt senden."}</small>
            `;

            const createButton = document.getElementById("createTradeButton");
            if (createButton) {
                createButton.disabled = missing.length > 0;
            }
        }

        function updateQuantityDisplay() {
            const mySelectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
            const wantedSelectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");

            if (myTradeQtyDisplay) {
                myTradeQtyDisplay.textContent = String(myTradeQuantity ? myTradeQuantity.value : 1);
            }
            if (wantedTradeQtyDisplay) {
                wantedTradeQtyDisplay.textContent = String(wantedTradeQuantity ? wantedTradeQuantity.value : 1);
            }

            if (decreaseMyTradeQty) {
                decreaseMyTradeQty.disabled = !mySelectedCard || Number(myTradeQuantity?.value || 1) <= 1;
            }
            if (increaseMyTradeQty) {
                increaseMyTradeQty.disabled = !mySelectedCard || Number(myTradeQuantity?.value || 1) >= Number(mySelectedCard.quantity || 1);
            }
            if (decreaseWantedTradeQty) {
                decreaseWantedTradeQty.disabled = !wantedSelectedCard || Number(wantedTradeQuantity?.value || 1) <= 1;
            }
            if (increaseWantedTradeQty) {
                increaseWantedTradeQty.disabled = !wantedSelectedCard || Number(wantedTradeQuantity?.value || 1) >= Number(wantedSelectedCard.quantity || 1);
            }
        }

        function renderTradeCompareBar() {
            if (!tradeCompareBar) {
                return;
            }

            const mySelectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
            const wantedSelectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");

            if (!mySelectedCard && !wantedSelectedCard) {
                tradeCompareBar.className = "trade-compare-bar is-empty";
                tradeCompareBar.innerHTML = `
                    <span>Vergleich</span>
                    <strong>Waehle links und rechts je eine Karte.</strong>
                `;
                return;
            }

            tradeCompareBar.className = "trade-compare-bar";
            tradeCompareBar.innerHTML = `
                <div class="trade-compare-side">
                    <span>Du gibst</span>
                    <strong>${mySelectedCard ? mySelectedCard.card_name : "Noch offen"}</strong>
                    <small>${mySelectedCard ? `${mySelectedCard.rarity} • x${myTradeQuantity ? myTradeQuantity.value : 1}` : "Karte fehlt"}</small>
                </div>
                <div class="trade-compare-arrow">⇄</div>
                <div class="trade-compare-side">
                    <span>Du willst</span>
                    <strong>${wantedSelectedCard ? wantedSelectedCard.card_name : "Noch offen"}</strong>
                    <small>${wantedSelectedCard ? `${wantedSelectedCard.rarity} • x${wantedTradeQuantity ? wantedTradeQuantity.value : 1}` : "Karte fehlt"}</small>
                </div>
            `;
        }

        function syncTradeVisualState() {
            updateQuantityDisplay();
            renderTradeCompareBar();
        }

        function focusTradeField(element, message) {
            if (element) {
                element.classList.add("field-needs-attention");
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                window.setTimeout(() => element.classList.remove("field-needs-attention"), 1400);
            }
            showToast(message, "error");
        }

        function renderTradeTapCards(targetElement, cards, selectedCardId, emptyMessage, side) {
            if (!targetElement) {
                return;
            }

            if (!cards || !cards.length) {
                targetElement.innerHTML = `<div class="inventory-item">${emptyMessage}</div>`;
                return;
            }

            targetElement.innerHTML = cards.map(card => `
                <button type="button" class="trade-tap-card ${String(selectedCardId || "") === String(card.card_id) ? "is-selected" : ""}" data-side="${side}" data-card-id="${card.card_id}">
                    ${getCardArtMarkup(card)}
                    <strong>${card.card_name}</strong>
                    <span>${card.rarity} | x${card.quantity}${String(selectedCardId || "") === String(card.card_id) ? ` | Auswahl x${side === "mine" ? myTradeQuantity.value : wantedTradeQuantity.value}` : ""}</span>
                    ${String(selectedCardId || "") === String(card.card_id) ? "<small>Nochmal tippen = +1</small>" : ""}
                </button>
            `).join("");
        }

        function incrementQuantitySelect(selectElement, maxAmount) {
            if (!selectElement) {
                return;
            }

            const currentValue = Number(selectElement.value || 1);
            const safeMax = Math.max(1, Number(maxAmount || 1));
            selectElement.value = String(Math.min(safeMax, currentValue + 1));
        }

        function refreshTradeTapSelection() {
            renderTradeTapCards(myTradeTapCards, myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "", "Du hast noch keine Karten zum Traden.", "mine");
            renderTradeTapCards(wantedTradeTapCards, selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "", "Waehle zuerst einen Trader.", "wanted");
            renderTradeBuilderSummary();
            syncTradeVisualState();
        }

        function selectMyTradeCard(cardId) {
            if (!myTradeCardSelect) {
                return;
            }

            const wasSelected = String(myTradeCardSelect.value || "") === String(cardId || "");
            myTradeCardSelect.value = cardId || "";
            const selectedCard = findCardById(myCardInventory, myTradeCardSelect.value);
            if (!wasSelected) {
                fillQuantitySelect(myTradeQuantity, selectedCard ? selectedCard.quantity : 1, "Deine Menge");
            } else {
                incrementQuantitySelect(myTradeQuantity, selectedCard ? selectedCard.quantity : 1);
            }
            updateTradePreview(myTradePreview, selectedCard, "Deine ausgewaehlte Karte erscheint hier.", "DEIN", myTradeQuantity ? myTradeQuantity.value : 1, "Du gibst");
            refreshTradeTapSelection();
        }

        function selectWantedTradeCard(cardId) {
            if (!wantedTradeCardSelect) {
                return;
            }

            const wasSelected = String(wantedTradeCardSelect.value || "") === String(cardId || "");
            wantedTradeCardSelect.value = cardId || "";
            const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect.value);
            if (!wasSelected) {
                fillQuantitySelect(wantedTradeQuantity, selectedCard ? selectedCard.quantity : 1, "Wunsch-Menge");
            } else {
                incrementQuantitySelect(wantedTradeQuantity, selectedCard ? selectedCard.quantity : 1);
            }
            updateTradePreview(wantedTradePreview, selectedCard, "Die Wunschkarte des Traders erscheint hier.", "WUNSCH", wantedTradeQuantity ? wantedTradeQuantity.value : 1, "Du willst");
            refreshTradeTapSelection();
        }

        function clearMyTradeCard() {
            if (myTradeCardSelect) {
                myTradeCardSelect.value = "";
            }
            fillQuantitySelect(myTradeQuantity, 1, "Deine Menge");
            renderCardCollection([], myTradePreview, "Deine ausgewaehlte Karte erscheint hier.", { slotLabel: "DEIN" });
            refreshTradeTapSelection();
        }

        function clearWantedTradeCard() {
            if (wantedTradeCardSelect) {
                wantedTradeCardSelect.value = "";
            }
            fillQuantitySelect(wantedTradeQuantity, 1, "Wunsch-Menge");
            renderCardCollection([], wantedTradePreview, "Die Wunschkarte des Traders erscheint hier.", { slotLabel: "WUNSCH" });
            refreshTradeTapSelection();
        }

        function resetTradeForm() {
            if (targetTraderSelect) {
                targetTraderSelect.value = "";
            }
            if (myTradeCardSelect) {
                myTradeCardSelect.value = "";
            }
            if (wantedTradeCardSelect) {
                wantedTradeCardSelect.innerHTML = "<option value=''>Karte waehlen</option>";
            }
            fillQuantitySelect(myTradeQuantity, 1, "Deine Menge");
            fillQuantitySelect(wantedTradeQuantity, 1, "Wunsch-Menge");
            selectedTargetCards = [];
            renderCardCollection([], myTradePreview, "Deine ausgewaehlte Karte erscheint hier.", { slotLabel: "DEIN" });
            renderCardCollection([], wantedTradePreview, "Die Wunschkarte des Traders erscheint hier.", { slotLabel: "WUNSCH" });
            refreshTradeTapSelection();
        }

        if (traderList) {
            if (!traderData.traders.length) {
                traderList.innerHTML = "<div class='inventory-item'>Noch keine oeffentlichen Trader gefunden.</div>";
            } else {
                traderList.innerHTML = traderData.traders.map(trader => `
                    <div class="trader-card">
                        <div class="trader-card-head">
                            <div>
                                <strong>${trader.display_name}</strong>
                                <div class="trader-card-id">ID ${trader.user_id}</div>
                            </div>
                            <span class="trader-status-pill ${trader.trading_enabled ? "is-on" : "is-off"}">${trader.trading_enabled ? "Trading an" : "Trading aus"}</span>
                        </div>
                        <p class="trader-card-bio">${trader.bio || "Keine Bio"}</p>
                        <div class="trader-card-meta">
                            <span>Lieblingskarte: ${trader.favorite_card_name || "Keine"}</span>
                            <span>Inventar: ${trader.inventory_visibility || "public"}</span>
                        </div>
                        <div class="trader-card-actions">
                            <button class="shop-btn trader-pick-btn" data-target-user-id="${trader.user_id}">
                                Als Trader waehlen
                                <small>Direkt oben in den Builder</small>
                            </button>
                            <button class="shop-btn trader-profile-btn" data-target-user-id="${trader.user_id}">
                                Profil ansehen
                                <small>Sammlung und Profil ansehen</small>
                            </button>
                        </div>
                    </div>
                `).join("");
            }
        }

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
        refreshTradeTapSelection();

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
                selectMyTradeCard(myTradeCardSelect.value);
            });
        }

        if (myTradeQuantity && !myTradeQuantity.dataset.bound) {
            myTradeQuantity.dataset.bound = "1";
            myTradeQuantity.addEventListener("change", () => {
                const selectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
                updateTradePreview(myTradePreview, selectedCard, "Deine ausgewaehlte Karte erscheint hier.", "DEIN", myTradeQuantity.value, "Du gibst");
                renderTradeBuilderSummary();
                syncTradeVisualState();
            });
        }

        if (myTradeTapCards && !myTradeTapCards.dataset.bound) {
            myTradeTapCards.dataset.bound = "1";
            myTradeTapCards.addEventListener("click", event => {
                const cardButton = event.target.closest(".trade-tap-card");
                if (!cardButton) {
                    return;
                }
                selectMyTradeCard(cardButton.dataset.cardId);
            });
        }

        if (resetMyTradePick && !resetMyTradePick.dataset.bound) {
            resetMyTradePick.dataset.bound = "1";
            resetMyTradePick.addEventListener("click", clearMyTradeCard);
        }

        if (decreaseMyTradeQty && !decreaseMyTradeQty.dataset.bound) {
            decreaseMyTradeQty.dataset.bound = "1";
            decreaseMyTradeQty.addEventListener("click", () => {
                if (!myTradeQuantity) {
                    return;
                }
                myTradeQuantity.value = String(Math.max(1, Number(myTradeQuantity.value || 1) - 1));
                myTradeQuantity.dispatchEvent(new Event("change"));
            });
        }

        if (increaseMyTradeQty && !increaseMyTradeQty.dataset.bound) {
            increaseMyTradeQty.dataset.bound = "1";
            increaseMyTradeQty.addEventListener("click", () => {
                const selectedCard = findCardById(myCardInventory, myTradeCardSelect ? myTradeCardSelect.value : "");
                if (!myTradeQuantity || !selectedCard) {
                    return;
                }
                myTradeQuantity.value = String(Math.min(Number(selectedCard.quantity || 1), Number(myTradeQuantity.value || 1) + 1));
                myTradeQuantity.dispatchEvent(new Event("change"));
            });
        }

        async function loadSelectedTargetCards(options = {}) {
            if (!targetTraderSelect || !wantedTradeCardSelect) {
                return;
            }

            wantedTradeCardSelect.innerHTML = "<option value=''>Karte waehlen</option>";
            fillQuantitySelect(wantedTradeQuantity, 1, "Wunsch-Menge");
            selectedTargetCards = [];
            renderCardCollection([], wantedTradePreview, "Die Wunschkarte des Traders erscheint hier.", { slotLabel: "WUNSCH" });
            refreshTradeTapSelection();

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

            if (options.wantedCardId && selectedTargetCards.some(card => String(card.card_id) === String(options.wantedCardId))) {
                wantedTradeCardSelect.value = options.wantedCardId;
                const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect.value);
                fillQuantitySelect(wantedTradeQuantity, selectedCard ? selectedCard.quantity : 1, "Wunsch-Menge");
                updateTradePreview(wantedTradePreview, selectedCard, "Die Wunschkarte des Traders erscheint hier.", "WUNSCH", wantedTradeQuantity ? wantedTradeQuantity.value : 1, "Du willst");
                renderTradeFeedback("Wunschkarte wurde aus dem Karten-Modal vorausgewaehlt. Waehle jetzt deine Karte fuer das Angebot.", "info");
                wantedTradeCardSelect.classList.add("field-needs-attention");
                window.setTimeout(() => wantedTradeCardSelect.classList.remove("field-needs-attention"), 1400);
            }

            refreshTradeTapSelection();
        }

        if (targetTraderSelect && !targetTraderSelect.dataset.bound) {
            targetTraderSelect.dataset.bound = "1";
            targetTraderSelect.addEventListener("change", async () => {
                await loadSelectedTargetCards();
            });
        }

        document.querySelectorAll(".trader-pick-btn").forEach(button => {
            if (button.dataset.bound) {
                return;
            }

            button.dataset.bound = "1";
            button.addEventListener("click", async () => {
                if (!targetTraderSelect) {
                    return;
                }

                targetTraderSelect.value = button.dataset.targetUserId || "";
                await loadSelectedTargetCards();
                targetTraderSelect.scrollIntoView({ behavior: "smooth", block: "center" });
                targetTraderSelect.classList.add("field-needs-attention");
                window.setTimeout(() => targetTraderSelect.classList.remove("field-needs-attention"), 1400);
                renderTradeFeedback("Trader wurde in den Builder uebernommen. Waehle jetzt die Wunschkarte.", "info");
            });
        });

        if (wantedTradeCardSelect && !wantedTradeCardSelect.dataset.bound) {
            wantedTradeCardSelect.dataset.bound = "1";
            wantedTradeCardSelect.addEventListener("change", () => {
                selectWantedTradeCard(wantedTradeCardSelect.value);
            });
        }

        if (wantedTradeQuantity && !wantedTradeQuantity.dataset.bound) {
            wantedTradeQuantity.dataset.bound = "1";
            wantedTradeQuantity.addEventListener("change", () => {
                const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");
                updateTradePreview(wantedTradePreview, selectedCard, "Die Wunschkarte des Traders erscheint hier.", "WUNSCH", wantedTradeQuantity.value, "Du willst");
                renderTradeBuilderSummary();
                syncTradeVisualState();
            });
        }

        if (wantedTradeTapCards && !wantedTradeTapCards.dataset.bound) {
            wantedTradeTapCards.dataset.bound = "1";
            wantedTradeTapCards.addEventListener("click", event => {
                const cardButton = event.target.closest(".trade-tap-card");
                if (!cardButton) {
                    return;
                }
                selectWantedTradeCard(cardButton.dataset.cardId);
            });
        }

        if (resetWantedTradePick && !resetWantedTradePick.dataset.bound) {
            resetWantedTradePick.dataset.bound = "1";
            resetWantedTradePick.addEventListener("click", clearWantedTradeCard);
        }

        if (decreaseWantedTradeQty && !decreaseWantedTradeQty.dataset.bound) {
            decreaseWantedTradeQty.dataset.bound = "1";
            decreaseWantedTradeQty.addEventListener("click", () => {
                if (!wantedTradeQuantity) {
                    return;
                }
                wantedTradeQuantity.value = String(Math.max(1, Number(wantedTradeQuantity.value || 1) - 1));
                wantedTradeQuantity.dispatchEvent(new Event("change"));
            });
        }

        if (increaseWantedTradeQty && !increaseWantedTradeQty.dataset.bound) {
            increaseWantedTradeQty.dataset.bound = "1";
            increaseWantedTradeQty.addEventListener("click", () => {
                const selectedCard = findCardById(selectedTargetCards, wantedTradeCardSelect ? wantedTradeCardSelect.value : "");
                if (!wantedTradeQuantity || !selectedCard) {
                    return;
                }
                wantedTradeQuantity.value = String(Math.min(Number(selectedCard.quantity || 1), Number(wantedTradeQuantity.value || 1) + 1));
                wantedTradeQuantity.dispatchEvent(new Event("change"));
            });
        }

        if (preselectTargetUserId && targetTraderSelect && targetTraderSelect.value !== preselectTargetUserId) {
            targetTraderSelect.value = preselectTargetUserId;
            await loadSelectedTargetCards({ wantedCardId: preselectWantedCardId });
        }

        syncTradeVisualState();

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

                if (!targetTraderId) {
                    focusTradeField(document.getElementById("targetTraderId"), "Bitte zuerst einen Trader waehlen.");
                    return;
                }

                if (!offeredCardId) {
                    focusTradeField(document.getElementById("myTradeCardId"), "Bitte waehle deine Karte fuer das Angebot.");
                    return;
                }

                if (!requestedCardId) {
                    focusTradeField(document.getElementById("wantedTradeCardId"), "Bitte waehle die Wunschkarte.");
                    return;
                }

                if (!offeredQuantity || !requestedQuantity) {
                    showToast("Bitte waehle die Mengen aus.", "error");
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

                    renderTradeFeedback("Trade-Angebot erstellt. Du findest es jetzt in <strong>Mail</strong> bei gesendeten Angeboten.", "success");
                    resetTradeForm();
                    await loadTradeSummary(tg, user);
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
                    const visibleCards = profile.visible_cards || [];
                    const visibleCount = visibleCards.length;
                    const rareCount = visibleCards.filter(card => String(card.rarity || "").toUpperCase() === "R").length;
                    const srSecCount = visibleCards.filter(card => {
                        const rarity = String(card.rarity || "").toUpperCase();
                        return rarity === "SR" || rarity === "SEC";
                    }).length;

                    publicProfileView.innerHTML = `
                        <div class="trader-card trader-profile-card">
                            <div class="trader-card-head">
                                <div>
                                    <strong>${profile.display_name || "User " + profile.user_id}</strong>
                                    <div class="trader-card-id">ID ${profile.user_id}</div>
                                </div>
                                <span class="trader-status-pill ${profile.trading_enabled ? "is-on" : "is-off"}">${profile.trading_enabled ? "Trading an" : "Trading aus"}</span>
                            </div>
                            <p class="trader-card-bio">${profile.bio || "Keine Bio"}</p>
                            <div class="trader-profile-stats">
                                <div><strong>${profile.inventory_visibility === "public" ? visibleCount : 0}</strong><span>Sichtbar</span></div>
                                <div><strong>${profile.inventory_visibility === "public" ? rareCount : 0}</strong><span>Rare</span></div>
                                <div><strong>${profile.inventory_visibility === "public" ? srSecCount : 0}</strong><span>SR/SEC</span></div>
                            </div>
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
                                            <span class="trade-showcase-label">Lieblingskarte</span>
                                            <strong>${profile.favorite_card_name}</strong>
                                            <p>${profile.favorite_card_rarity || "CARD"} aus ${profile.favorite_card_pack_key || "Collection"}</p>
                                        </div>
                                    `
                                    : "<div class='inventory-item'>Keine Lieblingskarte gesetzt.</div>"
                            }
                        </div>
                        <div class="trade-visible-head">
                            <strong>Oeffentliche Karten</strong>
                            <span>${profile.inventory_visibility === "public" ? `${visibleCount} sichtbar` : "privat"}</span>
                        </div>
                        <div class="card-reveal-grid">
                            ${
                                profile.inventory_visibility === "public"
                                    ? (
                                        visibleCards.length
                                            ? visibleCards.map(card => `
                                                <div class="card-face ${getRarityClass(card.rarity)}" ${getCardDetailAttributes(card, { tradeTargetUserId: profile.user_id })}>
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

    } catch (error) {
        console.log(error);
    }
}

async function loadMailPage(tg, user) {
    try {
        const traderData = await postJson("/traders", {
            initData: tg.initData,
            user_id: user.id
        });

        if (!traderData.ok) {
            return;
        }

        const allTradeOffers = traderData.trade_offers || [];
        const incomingOffers = allTradeOffers.filter(offer => Number(offer.to_user_id) === Number(user.id));
        const outgoingOffers = allTradeOffers.filter(offer => Number(offer.from_user_id) === Number(user.id));
        const pendingIncomingOffers = incomingOffers.filter(offer => offer.status === "pending");
        const pendingOutgoingOffers = outgoingOffers.filter(offer => offer.status === "pending");
        const doneOffers = allTradeOffers.filter(offer => offer.status !== "pending");
        let currentMailFilter = document.querySelector(".mail-filter.active")?.dataset.mailFilter || "incoming";

        function getMailEmptyMessage() {
            if (currentMailFilter === "outgoing") {
                return "Keine gesendeten offenen Trade-Angebote.";
            }
            if (currentMailFilter === "done") {
                return "Noch keine erledigten Trades.";
            }
            return "Keine offenen eingehenden Trade-Angebote.";
        }

        function bindMailTradeActions() {
            const mailTradeOffersList = document.getElementById("mailTradeOffersList");
            if (!mailTradeOffersList || mailTradeOffersList.dataset.bound) {
                return;
            }

            mailTradeOffersList.dataset.bound = "1";
            mailTradeOffersList.addEventListener("click", async event => {
                const responseButton = event.target.closest(".trade-response-btn");
                const debugButton = event.target.closest(".trade-debug-accept-btn");
                const button = responseButton || debugButton;

                if (!button) {
                    return;
                }

                button.disabled = true;

                try {
                    const path = debugButton ? "/trade-offer/debug-accept" : "/trade-offer/respond";
                    const payload = {
                        initData: tg.initData,
                        user_id: user.id,
                        trade_id: button.dataset.tradeId
                    };

                    if (responseButton) {
                        payload.action = button.dataset.action;
                    }

                    const result = await postJson(path, payload);

                    if (!result.ok) {
                        showToast(result.error || "Trade konnte nicht verarbeitet werden.", "error");
                        return;
                    }

                    if (debugButton) {
                        renderTradeFeedback("Debug Accept erfolgreich. Der Test-Trade wurde simuliert und die Karten wurden getauscht.", "success");
                        markInventoryHasNewCards();
                    } else {
                        renderTradeFeedback(
                            button.dataset.action === "accept"
                                ? "Trade erfolgreich angenommen. Die Karten wurden getauscht."
                                : "Trade wurde abgelehnt und geschlossen.",
                            "success"
                        );
                        if (button.dataset.action === "accept") {
                            markInventoryHasNewCards();
                        }
                    }

                    currentMailFilter = "done";
                    document.querySelectorAll(".mail-filter").forEach(item => {
                        item.classList.toggle("active", item.dataset.mailFilter === currentMailFilter);
                    });
                    await loadTradeSummary(tg, user);
                    await loadMailPage(tg, user);
                } catch (error) {
                    console.log(error);
                    showToast(debugButton ? "Fehler bei Debug Accept." : "Fehler beim Bearbeiten des Trades.", "error");
                } finally {
                    button.disabled = false;
                }
            });
        }

        function renderMailFilter() {
            const mailTradeOffersList = document.getElementById("mailTradeOffersList");
            const mailTradeCount = document.getElementById("mailTradeCount");
            let offers = pendingIncomingOffers;

            if (currentMailFilter === "outgoing") {
                offers = pendingOutgoingOffers;
            } else if (currentMailFilter === "done") {
                offers = doneOffers;
            }

            if (mailTradeCount) {
                mailTradeCount.innerText = String(offers.length);
            }

            renderTradeOfferCards(mailTradeOffersList, offers, user.id, getMailEmptyMessage());
            bindMailTradeActions();
        }

        function updateMailFilterCounts() {
            const counts = {
                incoming: pendingIncomingOffers.length,
                outgoing: pendingOutgoingOffers.length,
                done: doneOffers.length
            };

            document.querySelectorAll(".mail-filter").forEach(button => {
                const filter = button.dataset.mailFilter || "incoming";
                button.innerHTML = `${button.dataset.label || button.textContent.split(" ")[0]} <span>${counts[filter] || 0}</span>`;
            });
        }

        document.querySelectorAll(".mail-filter").forEach(button => {
            if (!button.dataset.label) {
                button.dataset.label = button.textContent.trim();
            }
            if (!button.dataset.bound) {
                button.dataset.bound = "1";
                button.addEventListener("click", () => {
                    currentMailFilter = button.dataset.mailFilter || "incoming";
                    document.querySelectorAll(".mail-filter").forEach(item => {
                        item.classList.toggle("active", item === button);
                    });
                    renderMailFilter();
                });
            }
            button.classList.toggle("active", button.dataset.mailFilter === currentMailFilter);
        });

        updateMailFilterCounts();
        renderMailFilter();

        if (document.getElementById("tradeFeedback") && !document.getElementById("tradeFeedback").dataset.initialized) {
            document.getElementById("tradeFeedback").dataset.initialized = "1";
            renderTradeFeedback("Hier kannst du Trade-Angebote annehmen, ablehnen oder Test-Trades simulieren.", "info");
        }

    } catch (error) {
        console.log(error);
    }
}
