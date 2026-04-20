const API_BASE = "https://magenta-wolf-69675.zap.cloud";

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

    if (!items || !items.length) {
        cardInventoryList.innerHTML = "<div class='inventory-item'>Noch keine Karten gesammelt.</div>";
        return;
    }

    cardInventoryList.innerHTML = items.map(item => `
        <div class="inventory-item">
            <strong>${item.card_name}</strong><br>
            Seltenheit: ${item.rarity}<br>
            Menge: ${item.quantity}<br>
            <span class="muted">Zuletzt erhalten: ${formatDate(item.last_acquired_at)}</span>
        </div>
    `).join("");
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

        const openBoosterList = document.getElementById("openBoosterList");
        if (!openBoosterList) {
            return;
        }

        const ownedBoosters = (data.inventory || []).filter(item => Number(item.amount) > 0);

        if (!ownedBoosters.length) {
            openBoosterList.innerHTML = "<div class='inventory-item'>Du hast keine Booster zum Oeffnen.</div>";
            return;
        }

        openBoosterList.innerHTML = ownedBoosters.map(item => `
            <div class="inventory-item">
                <strong>${item.pack_name}</strong><br>
                Menge: ${item.amount}<br><br>
                <button class="shop-btn open-booster-btn" data-pack-key="${item.pack_key}">
                    Booster oeffnen
                    <small>Jetzt benutzen</small>
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

                    const rewardBox = document.getElementById("openReward");
                    if (rewardBox) {
                        rewardBox.innerHTML = `
                            <div class="history-item">
                                <strong>${result.pack_name}</strong><br>
                                Du hast ${result.opened_cards.length} Karten gezogen.
                            </div>
                        `;
                    }

                    const openedCardsList = document.getElementById("openedCardsList");
                    if (openedCardsList) {
                        openedCardsList.innerHTML = result.opened_cards.map(card => `
                            <div class="inventory-item">
                                <strong>Slot ${card.slot_number}: ${card.card_name}</strong><br>
                                Seltenheit: ${card.rarity}
                            </div>
                        `).join("");
                    }

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
