// --- 1. CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCQRX7XFYsFqHtPglFPPfvkFaswXc2vewc",
  authDomain: "pokerstats-caaa8.firebaseapp.com",
  projectId: "pokerstats-caaa8",
  storageBucket: "pokerstats-caaa8.firebasestorage.app",
  messagingSenderId: "1090382764377",
  appId: "1:1090382764377:web:8c6b75d35248f7d1d89448",
  measurementId: "G-ESX1LN3XV8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. SÉCURITÉ ADMIN & VARIABLES ---
const ADMIN_EMAIL = "plessier.antoine10@gmail.com";
const GUEST_EMAIL  = "strategos.grepolis@gmail.com";

let allSessionsDB = []; 
let currentViewEmail = null; 
let previousBr = 0;
let dbUnsubscribe = null; 
let editingSessionId = null; 

// --- LOGO USDC VECTORIEL ---
const USDC_LOGO = `<svg style="width:0.82em; height:0.82em; vertical-align:-0.1em; margin-left:3px;" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#2775CA"/><path d="M18.8,11.5c-0.2-0.5-0.7-1-1.3-1.3V8h-2.5v2.1c-1.8,0.3-3,1.6-3,3.3c0,2.1,1.8,2.8,3.6,3.2c1.4,0.3,1.9,0.7,1.9,1.4c0,0.8-1,1-1.8,1c-1.2,0-2.2-0.5-2.7-1.1l-1.5,1.8c0.8,0.9,2,1.4,3.1,1.6V24h2.5v-2.1c1.9-0.3,3.3-1.6,3.3-3.6c0-2.4-2.1-3-4-3.4c-1.4-0.3-1.8-0.6-1.8-1.2c0-0.6,0.6-0.8,1.4-0.8c0.9,0,1.8,0.4,2.3,0.9L18.8,11.5z" fill="#fff"/></svg>`;

// TAUX DE CONVERSION
const RATES_TO_USDC = {
    EUR: 1.08,    
    BTC: 65000,   
    SOL: 145      
};

// --- 3. LE MENU DÉROULANT ---
function toggleLoginMenu() {
    var m = document.getElementById("login-menu");
    if (m) m.classList.toggle("open");
}
document.addEventListener("click", function(e) {
    var g = document.getElementById("login-group");
    var m = document.getElementById("login-menu");
    if (g && m && !g.contains(e.target)) m.classList.remove("open");
});

function login(mode) {
    var m = document.getElementById("login-menu"); if(m) m.classList.remove("open");
    var provider = new firebase.auth.GoogleAuthProvider();
    if (mode === "guest") provider.setCustomParameters({ login_hint: GUEST_EMAIL });
    
    auth.signInWithPopup(provider).catch(function(err) {
        if (err.code !== "auth/popup-closed-by-user") {
            console.warn("Popup bloqué, redirection...", err);
            auth.signInWithRedirect(provider);
        }
    });
}

window.switchView = function(targetEmail) {
    currentViewEmail = targetEmail;
    var m = document.getElementById("login-menu"); 
    if(m) m.classList.remove("open");
    updateUI(); 
};

auth.onAuthStateChanged(user => {
    const loginMenu = document.getElementById('login-menu');

    if (user && (user.email === ADMIN_EMAIL || user.email === GUEST_EMAIL)) {
        if (!currentViewEmail) { currentViewEmail = user.email; }
        if(loginMenu) {
            loginMenu.innerHTML = `
                <button onclick="switchView('${ADMIN_EMAIL}')">📊 PrRaoult</button>
                <button onclick="switchView('${GUEST_EMAIL}')">👀 Piootres</button>
                <button onclick="auth.signOut()" style="color: #ff5555; border-top: 1px solid rgba(255,255,255,0.06);">🚪 Log out</button>
            `;
        }
        if (dbUnsubscribe) dbUnsubscribe();
        dbUnsubscribe = db.collection("sessions").orderBy("fullDate", "asc").onSnapshot((snapshot) => {
            allSessionsDB = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUI(); 
        });
    } else {
        currentViewEmail = null;
        if(loginMenu) {
            loginMenu.innerHTML = `
                <button onclick="login('admin')">👑 PrRaoult</button>
                <button onclick="login('guest')">🎮 Piootres</button>
            `;
        }
        allSessionsDB = [];
        updateUI();
    }
});

function getTargetUserSessions() {
    if (!currentViewEmail) return [];
    return allSessionsDB.filter(s => {
        const sessionOwner = s.ownerEmail || ADMIN_EMAIL; 
        return sessionOwner === currentViewEmail;
    });
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('poker-toast');
    if (existing) existing.remove();
 
    const colors = {
        success: { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.4)', text: '#4ade80', icon: '📋' },
        info:    { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa', icon: '📤' },
        error:   { bg: 'rgba(255, 85, 85, 0.12)',  border: 'rgba(255, 85, 85, 0.4)',  text: '#ff5555', icon: '❌' },
    };
    const c = colors[type] || colors.success;
 
    const toast = document.createElement('div');
    toast.id = 'poker-toast';
    toast.innerHTML = `<span style="font-size:1.1rem;">${c.icon}</span> ${message}`;
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px);
        background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
        font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 0.85rem;
        padding: 12px 24px; border-radius: 12px; backdrop-filter: blur(12px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px ${c.border}; z-index: 999999;
        display: flex; align-items: center; gap: 10px; white-space: nowrap;
        opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
 
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)';
        });
    });
 
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// --- 4. FONCTIONS UTILS ---
let dateEdited = false;

function setTodayDate() {
    if (dateEdited) return;
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');
    if (!inputDate || !inputTime || document.activeElement === inputDate || document.activeElement === inputTime) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    if (inputDate.value !== `${year}-${month}-${day}`) inputDate.value = `${year}-${month}-${day}`;
    if (inputTime.value !== `${hours}:${minutes}`) inputTime.value = `${hours}:${minutes}`;
}

// --- CONVERTISSEURS USDC ---
function convertBaseToCrypto() {
    const baseVal = parseFloat(document.getElementById('input-amount').value) || 0;
    const currency = document.getElementById('input-currency').value;
    const cryptoInput = document.getElementById('input-crypto');
    if (currency !== "USDC" && currency !== "EUR" && RATES_TO_USDC[currency]) {
        cryptoInput.value = (baseVal / RATES_TO_USDC[currency]).toFixed(currency === "BTC" ? 6 : 2);
    }
}

function convertCryptoToBase() {
    const cryptoVal = parseFloat(document.getElementById('input-crypto').value) || 0;
    const currency = document.getElementById('input-currency').value;
    const baseInput = document.getElementById('input-amount');
    if (currency !== "USDC" && currency !== "EUR" && RATES_TO_USDC[currency]) {
        baseInput.value = (cryptoVal * RATES_TO_USDC[currency]).toFixed(2);
    }
}

window.toggleCryptoInput = function() {
    const currency = document.getElementById('input-currency').value;
    const group = document.getElementById('crypto-group');
    const label = document.getElementById('crypto-label');
    if (currency === 'USDC' || currency === 'EUR') {
        group.style.display = 'none';
    } else {
        group.style.display = 'flex';
        label.innerText = 'Montant ' + currency;
        convertBaseToCrypto(); 
    }
};

// --- NOUVEAU : FONCTION POUR MODIFIER UNE SESSION ---
window.editSession = function(id) {
    const session = allSessionsDB.find(doc => doc.id === id);
    if (!session) return;

    if (session.fullDate && session.fullDate.includes('T')) {
        document.getElementById('input-date').value = session.fullDate.split('T')[0];
        document.getElementById('input-time').value = session.fullDate.split('T')[1].substring(0, 5);
    }
    document.getElementById('input-hands').value = session.hands || '';
    document.getElementById('input-currency').value = session.currency || 'USDC';
    document.getElementById('input-crypto').value = session.cryptoAmount || '';
    
    let type = "Session";
    let amount = session.gain || 0;
    
    if (session.deposit > 0) { type = "Depot"; amount = session.deposit; }
    else if (session.withdrawal > 0) { type = "Retrait"; amount = session.withdrawal; }
    else if (session.rakeback > 0 && session.gain === 0 && session.hands === 0) { type = "Rakeback"; amount = session.rakeback; }
    
    document.getElementById('input-type').value = type;
    document.getElementById('input-amount').value = amount;
    document.getElementById('input-stake').value = session.stake || 'NL10';
    document.getElementById('input-room').value = session.room || 'stake';

    window.toggleCryptoInput(); 

    editingSessionId = id;
    
    const btnAdd = document.querySelector('.btn-add');
    if (btnAdd) {
        btnAdd.innerHTML = "💾 Sauvegarder";
        btnAdd.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
        btnAdd.style.boxShadow = "0 0 15px rgba(245, 158, 11, 0.4)";
    }
    
    dateEdited = true; 
    
    // NOUVEAU : Centrage parfait du formulaire à l'écran
    const formElement = document.querySelector('.entry-form');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// --- FONCTION AJOUTER / SAUVEGARDER ---
function addSession() {
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    const handsInput = document.getElementById('input-hands');
    const typeInput = document.getElementById('input-type');
    const amountInput = document.getElementById('input-amount');
    const stakeInput = document.getElementById('input-stake');
    const roomInput = document.getElementById('input-room');
    
    const rawDate = dateInput.value;
    const rawTime = timeInput.value;
    const hands = parseInt(handsInput ? handsInput.value : 0) || 0;
    const type = typeInput ? typeInput.value : "Session";
    const amount = parseFloat(amountInput ? amountInput.value : 0) || 0;
    const stake = stakeInput ? stakeInput.value : "NL10";
    const room = roomInput ? roomInput.value : "stake";

    const currency = document.getElementById('input-currency') ? document.getElementById('input-currency').value : 'USDC';
    const cryptoAmount = parseFloat(document.getElementById('input-crypto') ? document.getElementById('input-crypto').value : 0) || 0;

    if (!rawDate || !rawTime) return alert("Remplis la date et l'heure !");
    if (auth.currentUser && currentViewEmail !== auth.currentUser.email) return alert("Interdit sur ce profil !");

    let gain = 0, rakeback = 0, deposit = 0, withdrawal = 0;
    let finalHands = 0;

    if (type === "Session") { gain = amount; finalHands = hands; } 
    else if (type === "Rakeback") { rakeback = amount; } 
    else if (type === "Depot") { deposit = amount; } 
    else if (type === "Retrait") { withdrawal = amount; }

    // Utilisation d'un timestamp absolu pour garantir l'ordre de saisie chronologique exact
    let uniqueFullDate = `${rawDate}T${rawTime}:${Date.now()}`; 

    if (editingSessionId) {
        const originalSession = allSessionsDB.find(doc => doc.id === editingSessionId);
        if (originalSession && originalSession.fullDate.startsWith(`${rawDate}T${rawTime}`)) {
            uniqueFullDate = originalSession.fullDate; 
        }
    }

    const payload = {
        date: rawDate.split('-').reverse().slice(0,2).join('/'),
        fullDate: uniqueFullDate,
        hands: finalHands,
        gain: gain,
        currency: currency,          
        cryptoAmount: cryptoAmount,  
        rakeback: rakeback,
        deposit: deposit,
        withdrawal: withdrawal,
        stake: stake,
        room: room,
        ownerEmail: auth.currentUser.email 
    };

    if (editingSessionId) {
        db.collection("sessions").doc(editingSessionId).update(payload).then(() => {
            if(typeof playPop === "function") playPop();
            resetFormAfterSubmit();
            showToast("Session modifiée avec succès !");
        });
    } else {
        db.collection("sessions").add(payload).then(() => {
            if(typeof playPop === "function") playPop();
            resetFormAfterSubmit();
        });
    }
}

function resetFormAfterSubmit() {
    document.getElementById('input-hands').value = ''; 
    document.getElementById('input-amount').value = '';
    document.getElementById('input-crypto').value = '';
    
    editingSessionId = null;
    
    const btnAdd = document.querySelector('.btn-add');
    if (btnAdd) {
        btnAdd.innerHTML = "Ajouter";
        btnAdd.style.background = "";
        btnAdd.style.boxShadow = "";
    }
    
    // On ne réinitialise plus la date/heure pour faciliter la saisie multiple à la chaîne
}

function deleteSession(id) {
    if(confirm("Supprimer ?")) {
        db.collection("sessions").doc(id).delete();
        const modal = document.getElementById('session-modal-shell');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        }
    }
}

function resetData() {
    if(!auth.currentUser) return;
    if(confirm("Es-tu sûr de vouloir supprimer TOUT TON historique ?")) {
        const myEmail = auth.currentUser.email;
        db.collection("sessions").get().then((q) => {
            q.forEach((doc) => {
                const owner = doc.data().ownerEmail || ADMIN_EMAIL;
                if (owner === myEmail) doc.ref.delete();
            });
        });
    }
}

// --- 5. LOGIQUE D'AFFICHAGE ---
function updateUI() {
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";

    const headerBadge = document.getElementById('header-badge');
    if (headerBadge) {
        const badgeMap = { "ALL": ["NL", "badge-nl"], "NL2": ["NL2", "badge-nl2"], "NL5": ["NL5", "badge-nl5"], "NL10": ["NL10", "badge-nl10"], "NL20": ["NL20", "badge-nl20"] };
        const [label, cls] = badgeMap[filterValue] || ["NL", "badge-nl"];
        headerBadge.innerText = label;
        headerBadge.className = "badge " + cls;
    }

    const roomFilterElem = document.getElementById('room-filter');
    const roomFilterValue = roomFilterElem ? roomFilterElem.value : "ALL";
    const isGlobalView = (filterValue === "ALL" && roomFilterValue === "ALL");

    let defaultStart, defaultGoal;
    if (currentViewEmail === GUEST_EMAIL) {
        if (filterValue === "NL20") { defaultStart = 0; defaultGoal = 2500; }
        else if (filterValue === "NL10") { defaultStart = 0; defaultGoal = 1000; }
        else if (filterValue === "NL5") { defaultStart = 0; defaultGoal = 500; }
        else if (filterValue === "NL2") { defaultStart = 0; defaultGoal = 100; }
        else { defaultStart = 0; defaultGoal = 2500; }
    } else {
        if (filterValue === "NL20") { defaultStart = 1000; defaultGoal = 2500; }
        else if (filterValue === "NL10") { defaultStart = 500; defaultGoal = 1000; }
        else if (filterValue === "NL5") { defaultStart = 70; defaultGoal = 500; }
        else if (filterValue === "NL2") { defaultStart = 35; defaultGoal = 500; }
        else { defaultStart = 35; defaultGoal = 2500; }
    }

    const userKey = currentViewEmail || "default";
    const savedStart = localStorage.getItem(`startBR_${userKey}_${filterValue}`);
    const savedGoal = localStorage.getItem(`goalBR_${userKey}_${filterValue}`);

    let startBR = savedStart !== null ? parseFloat(savedStart) : defaultStart;
    let goalBR = savedGoal !== null ? parseFloat(savedGoal) : defaultGoal;

    const user = auth.currentUser;
    const isLookingAtOwnStats = user && (user.email === currentViewEmail);

    const entryForm = document.querySelector('.entry-form');
    const resetBtn = document.querySelector('.btn-reset');
    
    if (entryForm) entryForm.style.display = isLookingAtOwnStats ? 'flex' : 'none';
    if (resetBtn) resetBtn.style.display = isLookingAtOwnStats ? 'block' : 'none';

    let filteredSessions = getTargetUserSessions().filter(s => {
        let matchStake = (filterValue === "ALL") || ((s.stake || "NL10") === filterValue);
        let matchRoom = (roomFilterValue === "ALL") || ((s.room || "stake") === roomFilterValue);
        return matchStake && matchRoom;
    });

    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    let totalBB = 0; let totalRakeback = 0; let totalDeposit = 0; let totalWithdrawal = 0;
    
    let bestGain = -Infinity, worstGain = Infinity;
    let bestSession = null, worstSession = null;

    let rows = [];

    filteredSessions.forEach((s) => { 
        const sHands = parseInt(s.hands) || 0;
        const sGain = parseFloat(s.gain) || 0;
        const sRakeback = parseFloat(s.rakeback) || 0;
        const sDeposit = parseFloat(s.deposit) || 0;
        const sWithdrawal = parseFloat(s.withdrawal) || 0;

        totalHands += sHands; 
        currentProfitNet += sGain;
        totalRakeback += sRakeback;
        totalDeposit += sDeposit;
        totalWithdrawal += sWithdrawal;
        
        if (sGain > 0) winningSessions++;
        
        if (!(sHands === 0 && sGain === 0)) {
            if (sGain > bestGain) { bestGain = sGain; bestSession = s; }
            if (sGain < worstGain) { worstGain = sGain; worstSession = s; }
        }

        if (sHands > 0 || sGain !== 0 || (!sRakeback && !sDeposit && !sWithdrawal)) {
            handsLabels.push(totalHands);
            profitsNet.push(parseFloat(currentProfitNet.toFixed(2)));
        }

        const sessionStake = s.stake || "NL10";
        const bbValue = (sessionStake === "NL2") ? 0.02 : (sessionStake === "NL5") ? 0.05 : (sessionStake === "NL20") ? 0.20 : 0.10;
        const gainBB = sGain / bbValue;
        if (sHands > 0) totalBB += gainBB;

        const currentRoom = s.room || 'stake';
        const roomIcon = currentRoom === 'coinpoker' ? '🪙' : '🎲';
        const rakebackBadge = (isGlobalView && sRakeback > 0 && sHands > 0) ? `<span style="color:#a78bfa; font-size:0.8em; display:block;">+${sRakeback.toFixed(2)} ${USDC_LOGO} RB</span>` : '';

        let cryptoBadge = "";
        if (s.currency === "BTC" && s.cryptoAmount) {
            cryptoBadge = `<br><span style="font-size:0.75rem; color:#aaa; font-weight:600;">${s.cryptoAmount > 0 ? '+' : ''}${s.cryptoAmount} BTC</span>`;
        } else if (s.currency === "EUR" && s.cryptoAmount) {
            cryptoBadge = `<br><span style="font-size:0.75rem; color:#aaa; font-weight:600;">${s.cryptoAmount > 0 ? '+' : ''}${s.cryptoAmount} EUR</span>`;
        } else if (s.currency === "SOL" && s.cryptoAmount) {
            cryptoBadge = `<br><span style="font-size:0.75rem; color:#aaa; font-weight:600;">${s.cryptoAmount > 0 ? '+' : ''}${s.cryptoAmount} SOL</span>`;
        }

        let sessionTime = "";
        if (s.fullDate && s.fullDate.includes('T')) {
            sessionTime = s.fullDate.split('T')[1].substring(0, 5).replace(':', 'h');
        }

        const actionButtons = isLookingAtOwnStats ? 
            `<button onclick="editSession('${s.id}')" title="Modifier" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; border-radius: 6px; padding: 4px 7px; cursor: pointer; transition: 0.2s; margin-right: 5px;">✏️</button>` +
            `<button class="btn-delete" onclick="deleteSession('${s.id}')" style="padding: 4px 7px;" title="Supprimer">✕</button>` : '';

        if (sDeposit > 0) {
            rows.push(`<tr><td style="color: #888; font-weight: 400;">${s.date} <span style="font-size:0.65rem; color:#888;">${sessionTime}</span><br><small style="font-weight:700; color:#4ade80;">DÉPÔT</small></td><td style="color: #888;">—</td><td style="color: #4ade80; font-weight: 700;">+${sDeposit.toFixed(2)}${USDC_LOGO}</td><td style="color: #888;">—</td><td style="white-space: nowrap;">${actionButtons}</td></tr>`);
        } else if (sWithdrawal > 0) {
            rows.push(`<tr><td style="color: #888; font-weight: 400;">${s.date} <span style="font-size:0.65rem; color:#888;">${sessionTime}</span><br><small style="font-weight:700; color:#ff5555;">RETRAIT</small></td><td style="color: #888;">—</td><td style="color: #ff5555; font-weight: 700;">-${sWithdrawal.toFixed(2)}${USDC_LOGO}</td><td style="color: #888;">—</td><td style="white-space: nowrap;">${actionButtons}</td></tr>`);
        } else if (sRakeback > 0 && sGain === 0 && sHands === 0) {
            if (isGlobalView) {
                rows.push(`<tr><td style="color: #888; font-weight: 400;">${s.date} <span style="font-size:0.65rem; color:#888;">${sessionTime}</span><br><small style="font-weight:700; color:#a78bfa;">RAKEBACK</small></td><td style="color: #888;">—</td><td style="color: #a78bfa; font-weight: 700;">+${sRakeback.toFixed(2)}${USDC_LOGO}</td><td style="color: #888;">—</td><td style="white-space: nowrap;">${actionButtons}</td></tr>`);
            }
        } else {
            rows.push(`<tr><td style="color: #888; font-weight: 400;">${s.date} <span style="font-size:0.65rem; color:#888;">${sessionTime}</span><br><small style="font-weight:400; color:#3b82f6;">${sessionStake} <span style="margin-left: 5px; color: #fff; font-size: 1.1em;">${roomIcon}</span></small></td><td style="font-weight: 400;">${sHands.toLocaleString()}</td><td style="color: ${sGain >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">${sGain.toFixed(2)}${USDC_LOGO}${rakebackBadge}${cryptoBadge}</td><td style="color: ${gainBB >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">${gainBB.toFixed(1)} BB</td><td style="white-space: nowrap;">${actionButtons}</td></tr>`);
        }
    });

    if(document.getElementById('history-list')) document.getElementById('history-list').innerHTML = rows.reverse().join('');

    const profitDepuisStart = currentProfitNet + (isGlobalView ? totalRakeback : 0);
    const profitColor = profitDepuisStart >= 0 ? '#4ade80' : '#ff5555';
    const profitSign = profitDepuisStart > 0 ? '+' : '';

    const xpTitle = document.getElementById('xp-title-text');
    if(xpTitle) {
        xpTitle.innerHTML = `
            <span style="cursor:pointer; display:inline-flex; align-items:center; gap:8px;" onclick="window.editBankrollConfig()" title="Modifier Départ et Objectif">
                🏁 Départ ${startBR} ${USDC_LOGO} <span class="xp-arrow" style="margin:0 5px;">➔</span> 🎯 Objectif ${goalBR} ${USDC_LOGO} <span style="font-size:0.85rem; opacity:0.8; margin-left:5px;">⚙️</span>
            </span>
            <span style="margin-left: 15px; padding-left: 15px; border-left: 2px solid #333; color: ${profitColor}; font-weight: 800; text-shadow: 0 0 10px ${profitColor.replace(')', ', 0.3)').replace('rgb', 'rgba')};">
                📈 Profit : ${profitSign}${profitDepuisStart.toFixed(2)} ${USDC_LOGO}
            </span>
        `;
    }

    if (filteredSessions.length > 0 && bestSession && worstSession) {
        if (document.getElementById('best-session-gain')) document.getElementById('best-session-gain').innerHTML = `+${bestSession.gain.toFixed(2)} ${USDC_LOGO}`;
        if (document.getElementById('best-session-date')) document.getElementById('best-session-date').innerText = `le ${bestSession.date} (${bestSession.stake || "NL10"})`;
        if (document.getElementById('worst-session-gain')) document.getElementById('worst-session-gain').innerHTML = `${worstSession.gain.toFixed(2)} ${USDC_LOGO}`;
        if (document.getElementById('worst-session-date')) document.getElementById('worst-session-date').innerText = `le ${worstSession.date} (${worstSession.stake || "NL10"})`;
    } else {
        if (document.getElementById('best-session-gain')) document.getElementById('best-session-gain').innerHTML = `0.00 ${USDC_LOGO}`;
        if (document.getElementById('best-session-date')) document.getElementById('best-session-date').innerText = "--/--";
        if (document.getElementById('worst-session-gain')) document.getElementById('worst-session-gain').innerHTML = `0.00 ${USDC_LOGO}`;
        if (document.getElementById('worst-session-date')) document.getElementById('worst-session-date').innerText = "--/--";
    }

    const brElem = document.getElementById('total-br');
    if(brElem) {
        const newBr = startBR + profitDepuisStart + totalDeposit - totalWithdrawal;
        if (previousBr === 0) animateValue('total-br', startBR, newBr, 1500); else animateValue('total-br', previousBr, newBr, 1000); 
        previousBr = newBr; 
    }

    if(document.getElementById('total-rakeback')) {
        document.getElementById('total-rakeback').innerHTML = "+" + totalRakeback.toFixed(2) + " " + USDC_LOGO;
        document.getElementById('total-rakeback').style.color = totalRakeback > 0 ? '#a78bfa' : '#9ca3af';
    }
    if(document.getElementById('rakeback-card')) document.getElementById('rakeback-card').style.display = isGlobalView ? '' : 'none';
    if(document.getElementById('total-volume')) document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    
    let winrate = totalHands > 0 ? totalBB / (totalHands / 100) : 0;
    if(document.getElementById('winrate')) {
        document.getElementById('winrate').innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
        document.getElementById('winrate').style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    }
    if(document.getElementById('success-rate')) document.getElementById('success-rate').innerText = (filteredSessions.length > 0 ? (winningSessions / filteredSessions.length) * 100 : 0).toFixed(1) + "%";
    
    let prog = (profitDepuisStart / (goalBR - startBR)) * 100;
    if(document.getElementById('br-progression-text')) document.getElementById('br-progression-text').innerText = Math.min(100, Math.max(0, prog)).toFixed(1) + "%";
    if(document.getElementById('progress-bar-fill')) document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, prog)) + "%";

    renderCalendar(filteredSessions);
    renderChart(handsLabels, profitsNet, filterValue);
}

// --- 🛑 FONCTION DE PARTAGE 🛑 ---
window.shareSession = function(textStr) {
    const modal = document.getElementById('session-modal-shell');
    const card = modal ? modal.querySelector('.session-card') : null;

    if (!card || typeof html2canvas === 'undefined') {
        _openSharePanel(null, textStr);
        return;
    }

    showToast('Génération de l\'image...', 'info');

    const btns = card.querySelectorAll('button');
    btns.forEach(b => b.style.visibility = 'hidden');

    const watermark = document.createElement('div');
    watermark.style.cssText = 'text-align:center;font-family:Montserrat,sans-serif;font-size:0.6rem;font-weight:700;color:rgba(255,255,255,0.2);letter-spacing:2px;text-transform:uppercase;padding:12px 0 2px;';
    watermark.innerText = 'POKERSTATS';
    card.appendChild(watermark);

    html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true, logging: false })
    .then(canvas => {
        btns.forEach(b => b.style.visibility = '');
        if (card.contains(watermark)) card.removeChild(watermark);

        const isRealMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        if (isRealMobile && navigator.canShare) {
            canvas.toBlob(blob => {
                const file = new File([blob], 'pokerstats-session.png', { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: 'Ma session Poker' })
                        .then(() => showToast('Partagé !', 'success'))
                        .catch(() => _openSharePanel(canvas, textStr));
                } else {
                    _openSharePanel(canvas, textStr);
                }
            }, 'image/png');
        } else {
            _openSharePanel(canvas, textStr);
        }
    })
    .catch(err => {
        btns.forEach(b => b.style.visibility = '');
        if (card.contains(watermark)) card.removeChild(watermark);
        _openSharePanel(null, textStr);
    });
};

function _openSharePanel(canvas, textStr) {
    const existing = document.getElementById('share-panel');
    if (existing) existing.remove();

    const waText = encodeURIComponent(textStr);
    const waUrl = `https://wa.me/?text=${waText}`;

    const panel = document.createElement('div');
    panel.id = 'share-panel';
    panel.style.cssText = `
        position: fixed; bottom: 0; left: 0; right: 0;
        background: rgba(10, 10, 15, 0.97); border-top: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px 20px 0 0; padding: 20px 24px 32px; z-index: 9999999;
        font-family: 'Montserrat', sans-serif; backdrop-filter: blur(20px);
        box-shadow: 0 -10px 40px rgba(0,0,0,0.6); transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    panel.innerHTML = `
        <div style="width:40px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 20px;"></div>
        <div style="font-size:0.7rem;color:#666;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:18px;text-align:center;">Partager la session</div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <a href="${waUrl}" target="_blank" rel="noopener" onclick="setTimeout(()=>_closeSharePanel(),500)" style="
                display:flex;flex-direction:column;align-items:center;gap:8px;
                background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.35);
                border-radius:14px;padding:16px 20px;cursor:pointer;text-decoration:none;
                transition:all 0.2s;min-width:90px;
            " onmouseover="this.style.background='rgba(37,211,102,0.2)'" onmouseout="this.style.background='rgba(37,211,102,0.1)'">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#25d366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.553 4.103 1.522 5.83L.058 23.25a.75.75 0 00.916.999l5.688-1.49A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.953-1.354l-.355-.211-3.676.964.983-3.585-.231-.368A9.715 9.715 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                </svg>
                <span style="color:#25d366;font-size:0.72rem;font-weight:700;">WhatsApp</span>
            </a>
            <button onclick="_copyImageToClipboard(window._shareCanvas)" style="
                display:flex;flex-direction:column;align-items:center;gap:8px;
                background:rgba(88,101,242,0.1);border:1px solid rgba(88,101,242,0.35);
                border-radius:14px;padding:16px 20px;cursor:pointer;
                transition:all 0.2s;min-width:90px;
            " onmouseover="this.style.background='rgba(88,101,242,0.2)'" onmouseout="this.style.background='rgba(88,101,242,0.1)'">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#5865f2">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                </svg>
                <span style="color:#5865f2;font-size:0.72rem;font-weight:700;">Discord</span>
                <span style="color:#5865f2;font-size:0.6rem;opacity:0.7;">Copier l'image</span>
            </button>
            <button onclick="_downloadFromPanel(window._shareCanvas)" style="
                display:flex;flex-direction:column;align-items:center;gap:8px;
                background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.35);
                border-radius:14px;padding:16px 20px;cursor:pointer;
                transition:all 0.2s;min-width:90px;
            " onmouseover="this.style.background='rgba(59,130,246,0.2)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span style="color:#60a5fa;font-size:0.72rem;font-weight:700;">Télécharger</span>
            </button>
        </div>
        <button onclick="_closeSharePanel()" style="
            width:100%;margin-top:20px;padding:12px; background:transparent;border:1px solid rgba(255,255,255,0.08);
            color:#555;border-radius:10px;cursor:pointer; font-family:'Montserrat',sans-serif;font-size:0.8rem;font-weight:600;
            transition:all 0.2s;
        " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#555'">Annuler</button>
    `;
    window._shareCanvas = canvas;
    document.body.appendChild(panel);
    const overlay = document.createElement('div');
    overlay.id = 'share-panel-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999998;backdrop-filter:blur(2px);';
    overlay.onclick = _closeSharePanel;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; }); });
}

window._closeSharePanel = function() {
    const panel = document.getElementById('share-panel');
    const overlay = document.getElementById('share-panel-overlay');
    if (panel) { panel.style.transform = 'translateY(100%)'; setTimeout(() => panel.remove(), 300); }
    if (overlay) overlay.remove();
};

window._copyImageToClipboard = function(canvas) {
    if (!canvas) { showToast('Image non disponible', 'error'); return; }
    canvas.toBlob(blob => {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).then(() => {
            _closeSharePanel(); showToast('Image copiée ! Colle-la dans Discord (Ctrl+V)', 'success');
        }).catch(() => {
            _downloadFromPanel(canvas); showToast('Copie bloquée, image téléchargée à la place', 'info');
        });
    }, 'image/png');
};

window._downloadFromPanel = function(canvas) {
    if (!canvas) { showToast('Image non disponible', 'error'); return; }
    const link = document.createElement('a');
    link.download = 'pokerstats-session.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    _closeSharePanel(); showToast('Image téléchargée !', 'success');
};

// --- 🛑 MODALE VIGNETTES MULTIPLES + CRYPTO + PARTAGE 🛑 ---
window.openSessionDetail = function(dateStr) {
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";
    const roomFilterElem = document.getElementById('room-filter');
    const roomFilterValue = roomFilterElem ? roomFilterElem.value : "ALL";

    let daySessions = getTargetUserSessions().filter(s => s.fullDate && s.fullDate.startsWith(dateStr));
    if (roomFilterValue !== "ALL") {
        daySessions = daySessions.filter(s => (s.room || "stake") === roomFilterValue);
    }
    if (daySessions.length === 0) return;

    let cardsToRender = [];

    if (filterValue === "ALL") {
        cardsToRender.push({ title: "PROFIT GLOBAL", sessions: daySessions, isGlobal: true });
    } else {
        const limitSessions = daySessions.filter(s => (s.stake || "NL10") === filterValue);
        if (limitSessions.length > 0) {
            cardsToRender.push({ title: "PROFIT " + filterValue, sessions: limitSessions, isGlobal: false });
        }
    }

    if (cardsToRender.length === 0) return;

    const parts = dateStr.split('-');
    const displayDate = parts[2] + '/' + parts[1] + '/' + parts[0];

    let finalHtml = `<div style="display: flex; flex-direction: column; gap: 20px; max-height: 100vh; overflow-y: auto; width: 100%; align-items: center; padding: 40px 10px; box-sizing: border-box; overflow-x: hidden;">`;

    cardsToRender.forEach((card) => {
        let profit = 0, hands = 0, rb = 0, totalBB = 0, stakes = new Set(), roomSet = new Set();
        let profitBTC = 0, profitEUR = 0, profitSOL = 0; 

        card.sessions.forEach(s => {
            profit += (parseFloat(s.gain) || 0);
            hands += (parseInt(s.hands) || 0);
            rb += (parseFloat(s.rakeback) || 0);
            
            if (s.currency === 'BTC') profitBTC += (parseFloat(s.cryptoAmount) || 0);
            if (s.currency === 'EUR') profitEUR += (parseFloat(s.cryptoAmount) || 0);
            if (s.currency === 'SOL') profitSOL += (parseFloat(s.cryptoAmount) || 0);

            let r = s.room || 'stake';
            roomSet.add(r === 'coinpoker' ? '🪙 CoinPoker' : '🎲 Stake');
            const bbVal = (s.stake === "NL2") ? 0.02 : (s.stake === "NL5") ? 0.05 : (s.stake === "NL20") ? 0.20 : 0.10;
            if (s.hands > 0) totalBB += (parseFloat(s.gain) || 0) / bbVal;
            if (s.stake) stakes.add(s.stake);
        });

        const winrate = hands > 0 ? totalBB / (hands / 100) : 0;
        const isWin = profit >= 0;
        const mainSession = card.sessions[0];
        
        let displayTime = "00h00";
        if (!card.isGlobal && mainSession.fullDate && mainSession.fullDate.includes('T')) {
            displayTime = mainSession.fullDate.split('T')[1].substring(0, 5).replace(':', 'h');
        }

        let roomsStr = Array.from(roomSet).join(' / ');
        let stakesStr = Array.from(stakes).join(' / ');

        let cryptoStr = "";
        if (profitBTC !== 0) cryptoStr += `<div style="font-size: 1.1rem; color: #888; font-weight: 700; margin-top: 5px;">(${profitBTC > 0 ? '+' : ''}${parseFloat(profitBTC.toFixed(5))} BTC)</div>`;
        if (profitEUR !== 0) cryptoStr += `<div style="font-size: 1.1rem; color: #888; font-weight: 700; margin-top: 5px;">(${profitEUR > 0 ? '+' : ''}${parseFloat(profitEUR.toFixed(2))} EUR)</div>`;
        if (profitSOL !== 0) cryptoStr += `<div style="font-size: 1.1rem; color: #888; font-weight: 700; margin-top: 5px;">(${profitSOL > 0 ? '+' : ''}${parseFloat(profitSOL.toFixed(2))} SOL)</div>`;

        let shareText = `🗓️ ${displayDate}\n💰 ${card.title} : ${profit > 0 ? '+' : ''}${profit.toFixed(2)} USDC`;
        if (profitBTC !== 0) shareText += ` (${profitBTC > 0 ? '+' : ''}${parseFloat(profitBTC.toFixed(5))} BTC)`;
        if (profitEUR !== 0) shareText += ` (${profitEUR > 0 ? '+' : ''}${parseFloat(profitEUR.toFixed(2))} EUR)`;
        if (profitSOL !== 0) shareText += ` (${profitSOL > 0 ? '+' : ''}${parseFloat(profitSOL.toFixed(2))} SOL)`;
        shareText += `\n🎯 Winrate : ${winrate.toFixed(2)} bb/100\n📈 Volume : ${hands} Mains\n🎁 Rakeback : +${rb.toFixed(2)} USDC`;

        let hasActionBtns = (auth.currentUser && auth.currentUser.email === (mainSession.ownerEmail || ADMIN_EMAIL) && !card.isGlobal);

        finalHtml += `
            <div class="session-card ${isWin ? 'win-card' : 'loss-card'}" style="flex-shrink: 0; margin-bottom: 10px;">
                <button class="close-session-btn" onclick="document.getElementById('session-modal-shell').classList.remove('show'); setTimeout(() => document.getElementById('session-modal-shell').style.display='none', 300);">✕</button>
                <div class="session-header">🗓️ ${displayDate} ${card.isGlobal ? '' : '- ' + displayTime}</div>
                <div class="session-profit-title">${card.title}</div>
                <div class="session-profit-value" style="text-align: center;">${profit > 0 ? '+' : ''}${profit.toFixed(2)} ${USDC_LOGO}${cryptoStr}</div>
                <div class="session-stats-grid">
                    <div class="session-stat-box"><span class="stat-label">WINRATE</span><span class="stat-val ${isWin ? 'win-text' : 'loss-text'}">${winrate.toFixed(2)} bb/100</span></div>
                    <div class="session-stat-box"><span class="stat-label">VOLUME</span><span class="stat-val">${hands} Mains</span></div>
                    <div class="session-stat-box"><span class="stat-label">TERRAIN</span><span class="stat-val" style="font-size:0.85rem">${roomsStr} <br><span style="color:#60a5fa">${stakesStr}</span></span></div>
                    <div class="session-stat-box"><span class="stat-label">RAKEBACK</span><span class="stat-val rb-text">+${rb.toFixed(2)} ${USDC_LOGO}</span></div>
                </div>
                
                <button class="share-session-btn" onclick="shareSession(\`${shareText.replace(/\n/g, '\\n')}\`)" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; font-family: 'Montserrat'; font-weight: 600; font-size: 0.8rem; padding: 10px 20px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; margin-bottom: ${hasActionBtns ? '10px' : '0'};">
                    <span style="font-size: 1.1rem;">📤</span> Partager le Résultat
                </button>

                ${hasActionBtns ? 
                    `<div style="display: flex; gap: 10px; width: 100%;">
                        <button class="delete-session-btn" onclick="document.getElementById('session-modal-shell').classList.remove('show'); setTimeout(() => { document.getElementById('session-modal-shell').style.display='none'; editSession('${mainSession.id}'); }, 300);" style="color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); flex: 1;">
                            <span style="font-size: 1.1rem;">✏️</span> Modifier
                        </button>
                        <button class="delete-session-btn" onclick="deleteSession('${mainSession.id}')" style="flex: 1;">
                            <span style="font-size: 1.1rem;">🗑️</span> Supprimer
                        </button>
                    </div>` : ''}
            </div>`;
    });

    finalHtml += `</div>`;

    const modal = document.getElementById('session-modal-shell');
    if (modal) {
        modal.innerHTML = finalHtml;
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('show'); }, 10);
    }
};

// --- 9. CALENDRIER PNL (VOTRE DESIGN EXACT, MAINTENANT AVEC USDC) ---
let currentCalDate = new Date(); 
currentCalDate.setDate(1); 

function toggleHistoryFlip() {
    const flipper = document.getElementById('history-flipper');
    if (flipper) {
        flipper.classList.toggle('is-flipped');
        
        const frontFace = flipper.querySelector('.flip-front');
        if (frontFace) {
            frontFace.style.pointerEvents = flipper.classList.contains('is-flipped') ? 'none' : 'auto';
        }
    }
}

window.changeCalMonth = function(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";

    const roomFilterElem = document.getElementById('room-filter');
    const roomFilterValue = roomFilterElem ? roomFilterElem.value : "ALL";

    let filteredSessions = getTargetUserSessions().filter(s => {
        const sessionStake = s.stake || "NL10";
        const sessionRoom = s.room || "stake";

        let matchStake = (filterValue === "ALL") || (sessionStake === filterValue);
        let matchRoom = (roomFilterValue === "ALL") || (sessionRoom === roomFilterValue);

        return matchStake && matchRoom;
    });

    renderCalendar(filteredSessions);
};

function renderCalendar(filteredSessions) {
    const calContainer = document.getElementById('calendar-view');
    if (!calContainer) return;

    const dailyData = {};
    filteredSessions.forEach(s => {
        if(!s.fullDate) return;
        const dateStr = s.fullDate.split('T')[0]; 
        
        if (!dailyData[dateStr]) dailyData[dateStr] = { gain: 0, stakes: new Set(), hands: 0 };
        
        dailyData[dateStr].room = s.room;
        dailyData[dateStr].gain += s.gain;
        dailyData[dateStr].stakes.add(s.stake || "NL10");
        dailyData[dateStr].hands += (parseInt(s.hands) || 0); 
    });

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth(); 

    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    let monthPnl = 0, monthHands = 0, monthSessions = 0, monthWinSessions = 0;
    Object.entries(dailyData).forEach(([dateStr, data]) => {
        const d = new Date(dateStr);
        if (d.getFullYear() === year && d.getMonth() === month) {
            monthPnl += data.gain;
            monthHands += data.hands;
            monthSessions++;
            if (data.gain > 0) monthWinSessions++;
        }
    });
    const monthWinrate = monthHands > 0 ? (monthPnl / (monthHands / 100)).toFixed(2) : '—';
    const pnlColor = monthPnl > 0 ? '#4ade80' : monthPnl < 0 ? '#ff5555' : '#888';
    const pnlSign  = monthPnl > 0 ? '+' : '';

    let html = `
    <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 10px 5px 10px;">
        <button type="button" onclick="window.changeCalMonth(-1)" style="background: #222; border: 1px solid #333; color: #fff; cursor: pointer; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; z-index: 9999;">◀</button>
        <span style="line-height: 1; transform: translateY(1px); font-weight: 800;">${monthNames[month]} ${year}</span>
        <button type="button" onclick="window.changeCalMonth(1)" style="background: #222; border: 1px solid #333; color: #fff; cursor: pointer; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; z-index: 9999;">▶</button>
    </div>
    <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 8px 10px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 6px;
    ">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-top: 2px solid ${pnlColor}; border-radius: 8px; padding: 8px 10px; text-align: center;">
            <div style="font-size: 0.58rem; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 4px;">💰 PNL Mois</div>
            <div style="font-size: 1rem; font-weight: 800; color: ${pnlColor};">${monthPnl !== 0 ? pnlSign + monthPnl.toFixed(2) + ' ' + USDC_LOGO : '—'}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-top: 2px solid rgba(59,130,246,0.6); border-radius: 8px; padding: 8px 10px; text-align: center;">
            <div style="font-size: 0.58rem; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 4px;">📈 Volume</div>
            <div style="font-size: 1rem; font-weight: 800; color: #fff;">${monthHands > 0 ? monthHands.toLocaleString() : '—'}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-top: 2px solid rgba(168,85,247,0.6); border-radius: 8px; padding: 8px 10px; text-align: center;">
            <div style="font-size: 0.58rem; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 4px;">🏆 Sessions</div>
            <div style="font-size: 1rem; font-weight: 800; color: #a78bfa;">${monthSessions > 0 ? monthWinSessions + '/' + monthSessions : '—'}</div>
        </div>
    </div>`;

    html += `<div class="calendar-grid">`;
    
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(d => {
        html += `<div class="cal-day-name">${d}</div>`;
    });

    for(let i = 0; i < startDay; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    for(let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const data = dailyData[dateStr];

        let classes = "cal-day";
        let content = `<span class="cal-date">${d}</span>`;
        
        if (data !== undefined) {
            const pnl = data.gain;
            const stakesStr = Array.from(data.stakes).join(' / ');

            if (pnl > 0) classes += " win";
            else if (pnl < 0) classes += " loss";
            else classes += " even";

            content += `<span style="position: absolute; top: 3px; right: 4px; font-size: 0.55rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase;">${stakesStr}</span>`;
            content += `<p class="cal-pnl" style="display: flex; align-items: center; justify-content: center; gap: 2px;">${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}${USDC_LOGO}</p>`;
            content += `<span style="position: absolute; bottom: 3px; left: 0; right: 0; text-align: center; font-size: 0.6rem; color: #888; font-weight: 600;">${data.hands} h</span>`;

            html += `<div class="${classes}" onclick="openSessionDetail('${dateStr}')" style="cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${content}</div>`;
        } else {
            html += `<div class="${classes}">${content}</div>`;
        }
    }
    html += `</div>`;

    calContainer.innerHTML = html;
}

// --- 10. CHART ET AUDIO ---
const neonLinePlugin = {
    id: 'neonLine',
    defaults: { neonColor: '#3b82f6', coreColor: '#eff6ff', ballColor: '#ffffff', speed: 2500 },
    afterDatasetsDraw(chart, args, options) {
        const { ctx, scales: { x, y } } = chart;
        const datasetMeta = chart.getDatasetMeta(0);
        const points = datasetMeta.data;
        if (!points || points.length < 2 || chart.neonProgress === undefined) return;
        ctx.save();
        const totalDuration = options.speed;
        const elapsed = Date.now() - chart.neonStartTime;
        const progress = Math.min(elapsed / totalDuration, 1);
        const endIndex = (points.length - 1) * progress;
        const integerEndIndex = Math.floor(endIndex);
        const factionalEndIndex = endIndex - integerEndIndex;

        ctx.beginPath();
        for (let i = 0; i <= integerEndIndex; i++) {
            const point = points[i];
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
        if (integerEndIndex < points.length - 1) {
            const p1 = points[integerEndIndex];
            const p2 = points[integerEndIndex + 1];
            const finalX = p1.x + (p2.x - p1.x) * factionalEndIndex;
            const finalY = p1.y + (p2.y - p1.y) * factionalEndIndex;
            ctx.lineTo(finalX, finalY);
        }

        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = 20; ctx.strokeStyle = options.neonColor.replace(')', ', 0.08)').replace('rgb', 'rgba'); ctx.shadowColor = options.neonColor; ctx.shadowBlur = 40; ctx.stroke();
        ctx.lineWidth = 10; ctx.strokeStyle = options.neonColor.replace(')', ', 0.2)').replace('rgb', 'rgba'); ctx.shadowBlur = 20; ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = options.coreColor.replace(')', ', 0.4)').replace('rgb', 'rgba'); ctx.shadowBlur = 10; ctx.stroke();
        ctx.lineWidth = 1.0; ctx.strokeStyle = options.coreColor; ctx.shadowBlur = 3; ctx.stroke();

        if (points.length > 0) {
            let ballX, ballY;
            if (integerEndIndex < points.length - 1) {
                const p1 = points[integerEndIndex]; const p2 = points[integerEndIndex + 1];
                ballX = p1.x + (p2.x - p1.x) * factionalEndIndex; ballY = p1.y + (p2.y - p1.y) * factionalEndIndex;
            } else { const last = points[points.length - 1]; ballX = last.x; ballY = last.y; }
            ctx.beginPath(); ctx.arc(ballX, ballY, 18, 0, Math.PI * 2); ctx.fillStyle = options.neonColor.replace(')', ', 0.1)').replace('rgb', 'rgba'); ctx.fill();
            ctx.beginPath(); ctx.arc(ballX, ballY, 10, 0, Math.PI * 2); ctx.fillStyle = options.coreColor.replace(')', ', 0.3)').replace('rgb', 'rgba'); ctx.fill();
            ctx.beginPath(); ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2); ctx.fillStyle = options.ballColor; ctx.shadowColor = options.coreColor; ctx.shadowBlur = 25; ctx.fill();
        }
        ctx.restore();
        if (progress < 1) requestAnimationFrame(() => chart.draw()); 
    }
};

function renderChart(labels, values, filterValue = "ALL") {
    const canvas = document.getElementById('myChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.pokerChart) window.pokerChart.destroy();
    let themeColor, coreColor, bgColor, gridColor;
    switch(filterValue) {
        case "NL20": themeColor = 'rgb(236, 72, 153)'; coreColor = 'rgb(253, 242, 248)'; bgColor = 'rgba(236, 72, 153, 0.05)'; gridColor = 'rgba(236, 72, 153, 0.1)'; break;
        case "NL10": themeColor = 'rgb(168, 85, 247)'; coreColor = 'rgb(250, 245, 255)'; bgColor = 'rgba(168, 85, 247, 0.05)'; gridColor = 'rgba(168, 85, 247, 0.1)'; break;
        case "NL5": themeColor = 'rgb(245, 158, 11)'; coreColor = 'rgb(255, 251, 235)'; bgColor = 'rgba(245, 158, 11, 0.05)'; gridColor = 'rgba(245, 158, 11, 0.1)'; break;
        case "NL2": themeColor = 'rgb(34, 197, 94)'; coreColor = 'rgb(240, 253, 244)'; bgColor = 'rgba(34, 197, 94, 0.05)'; gridColor = 'rgba(34, 197, 94, 0.1)'; break;
        default: themeColor = 'rgb(59, 130, 246)'; coreColor = 'rgb(239, 246, 255)'; bgColor = 'rgba(59, 130, 246, 0.05)'; gridColor = 'rgba(59, 130, 246, 0.1)'; break;
    }
    const chartConfig = {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Profit Net', data: values, pointRadius: 0, pointHoverRadius: 5, borderWidth: 0, borderColor: 'rgba(0,0,0,0)', fill: 'start', backgroundColor: bgColor, tension: 0.2 }] },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { left: 0, right: 0, top: 10, bottom: 5 } }, scales: { y: { suggestedMin: 0, grid: { color: gridColor }, ticks: { color: '#9ca3af' } }, x: { type: 'linear', bounds: 'tight', grid: { display: false }, min: labels[0], max: labels[labels.length - 1], ticks: { color: '#9ca3af' } } }, plugins: { legend: { display: false }, neonLine: { neonColor: themeColor, coreColor: coreColor, ballColor: '#ffffff', speed: 2000 }, zoom: { limits: { x: { min: 'original', max: 'original' } }, pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } } },
        plugins: [neonLinePlugin]
    };
    window.pokerChart = new Chart(ctx, chartConfig);
    if (labels.length > 1) { window.pokerChart.neonProgress = 0; window.pokerChart.neonStartTime = Date.now(); window.pokerChart.draw(); }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = (progress * (end - start) + start).toFixed(2) + " " + USDC_LOGO;
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

const bgCanvas = document.getElementById('bg-canvas');
if (bgCanvas) {
    const bgCtx = bgCanvas.getContext('2d');
    let stars = [], smokeTrail = [], shootingStars = [], shootingStarTimer = 0, fireballs = [], fireballTimer = 0, mouse = { x: null, y: null };
    let nukeFlash = 0, nukeParticles = [];

    window.triggerNuke = function() {
        if(typeof playPop === "function") playPop();
        nukeFlash = 1.2; 
        const cx = bgCanvas.width / 2; const cy = bgCanvas.height * 0.4; 
        for(let i = 0; i < 400; i++) { 
            const angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.3; const speed = Math.random() * 45 + 15; 
            nukeParticles.push({ x: cx, y: bgCanvas.height, vx: Math.cos(angle) * speed, vy: -(Math.random() * 4 + 1), life: 1.0, decay: Math.random() * 0.015 + 0.005, size: Math.random() * 50 + 20, color: Math.random() > 0.6 ? '255, 220, 100' : (Math.random() > 0.4 ? '255, 80, 0' : '100, 100, 100') });
        }
        for(let i = 0; i < 300; i++) { 
            nukeParticles.push({ x: cx + (Math.random() - 0.5) * 150, y: bgCanvas.height, vx: (Math.random() - 0.5) * 8, vy: -(Math.random() * 25 + 10), life: 1.0, decay: Math.random() * 0.012 + 0.006, size: Math.random() * 45 + 15, color: Math.random() > 0.5 ? '255, 100, 0' : '80, 80, 80' });
        }
        for(let i = 0; i < 500; i++) {
            const angle = Math.random() * Math.PI * 2; const radius = Math.random() * 40; const speed = Math.random() * 18 + 2;
            nukeParticles.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.5 - (Math.random() * 5), life: 1.0, decay: Math.random() * 0.008 + 0.003, size: Math.random() * 50 + 15, color: Math.random() > 0.6 ? '255, 80, 0' : (Math.random() > 0.5 ? '255, 200, 50' : '60, 60, 60') });
        }
    };

    function initBg() {
        bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 50; i++) stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, sx: (Math.random() - 0.5) * 0.5, sy: (Math.random() - 0.5) * 0.5 });
    }

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        for(let i = 0; i < 2; i++) smokeTrail.push({ x: mouse.x, y: mouse.y, size: Math.random() * 5 + 2, speedX: (Math.random() - 0.5) * 0.8, speedY: (Math.random() - 1) * 0.4, opacity: 1 });
    });

    function createShootingStar() { shootingStars.push({ x: Math.random() * bgCanvas.width, y: -10, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 5 + 7, trail: [] }); }
    function createFireball() { fireballs.push({ x: Math.random() * bgCanvas.width, y: -30, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2 + 3, size: Math.random() * 4 + 3, trail: [] }); }

    function animateBg() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.fillStyle = "rgba(59, 130, 246, 0.2)";
        stars.forEach(p => {
            p.x += p.sx; p.y += p.sy;
            if(p.x < 0 || p.x > bgCanvas.width) p.sx *= -1; if(p.y < 0 || p.y > bgCanvas.height) p.sy *= -1;
            bgCtx.beginPath(); bgCtx.arc(p.x, p.y, 2, 0, Math.PI * 2); bgCtx.fill();
        });

        for (let i = 0; i < smokeTrail.length; i++) {
            let s = smokeTrail[i]; s.x += s.speedX; s.y += s.speedY; s.size += 0.6; s.opacity -= 0.012;
            if (s.opacity <= 0) { smokeTrail.splice(i, 1); i--; } 
            else {
                const gradient = bgCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
                gradient.addColorStop(0, `rgba(59, 130, 246, ${s.opacity * 0.15})`); gradient.addColorStop(0.7, `rgba(59, 130, 246, ${s.opacity * 0.05})`); gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                bgCtx.beginPath(); bgCtx.fillStyle = gradient; bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2); bgCtx.fill();
            }
        }

        shootingStarTimer++; if (shootingStarTimer > 800) { createShootingStar(); shootingStarTimer = 0; }
        shootingStars.forEach((s, idx) => {
            s.x += s.vx; s.y += s.vy; s.trail.push({x: s.x, y: s.y}); if(s.trail.length > 15) s.trail.shift();
            bgCtx.beginPath(); bgCtx.strokeStyle = "rgba(147, 197, 253, 0.4)"; bgCtx.lineWidth = 1;
            s.trail.forEach(t => bgCtx.lineTo(t.x, t.y)); bgCtx.stroke();
            if(s.y > bgCanvas.height) shootingStars.splice(idx, 1);
        });

        fireballTimer++; if (fireballTimer > Math.random() * 1000 + 500) { createFireball(); fireballTimer = 0; }
        fireballs.forEach((fb, idx) => {
            fb.x += fb.vx; fb.y += fb.vy; fb.trail.push({x: fb.x, y: fb.y, size: fb.size}); if(fb.trail.length > 25) fb.trail.shift();
            if(fb.trail.length > 1) {
                bgCtx.beginPath(); let fireGrad = bgCtx.createLinearGradient(fb.trail[0].x, fb.trail[0].y, fb.x, fb.y);
                fireGrad.addColorStop(0, "rgba(255, 50, 0, 0)"); fireGrad.addColorStop(1, "rgba(255, 140, 0, 0.6)");
                bgCtx.strokeStyle = fireGrad; bgCtx.lineWidth = fb.size; bgCtx.lineCap = 'round';
                fb.trail.forEach(t => bgCtx.lineTo(t.x, t.y)); bgCtx.stroke();
            }
            bgCtx.beginPath(); bgCtx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2); bgCtx.fillStyle = "#ffddaa"; bgCtx.shadowColor = "#ff4500"; bgCtx.shadowBlur = 25; bgCtx.fill(); bgCtx.shadowBlur = 0;
            if(fb.y > bgCanvas.height + 50) fireballs.splice(idx, 1);
        });

        if (nukeFlash > 0) { bgCtx.fillStyle = `rgba(255, 255, 240, ${Math.min(nukeFlash, 1)})`; bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height); nukeFlash -= 0.02; }

        for (let i = 0; i < nukeParticles.length; i++) {
            let p = nukeParticles[i]; p.x += p.vx; p.y += p.vy; p.life -= p.decay; p.vx *= 0.94; p.vy *= 0.94;
            if (p.life <= 0) { nukeParticles.splice(i, 1); i--; } else {
                bgCtx.beginPath(); let currentRadius = Math.max(0.1, p.size * p.life); bgCtx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
                const gradient = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius);
                gradient.addColorStop(0, `rgba(${p.color}, ${p.life})`); gradient.addColorStop(1, `rgba(${p.color}, 0)`);
                bgCtx.fillStyle = gradient; bgCtx.fill();
            }
        }
        requestAnimationFrame(animateBg);
    }
    window.addEventListener('resize', initBg); initBg(); animateBg();
}

function exportData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) return alert("Seul l'admin peut exporter les données.");
    const dataStr = JSON.stringify(allSessionsDB, null, 2); const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob); const downloadNode = document.createElement('a');
    downloadNode.href = url; downloadNode.download = "backup_poker_stats.json"; downloadNode.style.display = 'none';
    document.body.appendChild(downloadNode); downloadNode.click(); document.body.removeChild(downloadNode); URL.revokeObjectURL(url);
}

function importData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) return alert("Seul l'admin peut importer des données.");
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
    document.body.appendChild(input); 
    input.onchange = e => {
        const file = e.target.files[0]; if (!file) return; 
        const reader = new FileReader(); reader.readAsText(file, 'UTF-8');
        reader.onload = readerEvent => {
            try {
                const data = JSON.parse(readerEvent.target.result); let count = 0;
                data.forEach(s => {
                    let rawGain = String(s.gain).replace(',', '.'); let gainNumber = parseFloat(rawGain);
                    let sString = JSON.stringify(s); let match = sString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    let displayDate = "00/00"; let isoDate = "2000-01-01T0000";
                    if (match) { let jour = match[1], mois = match[2], annee = match[3]; displayDate = `${jour}/${mois}`; isoDate = `${annee}-${mois}-${jour}T${String(count).padStart(4, '0')}`; }
                    db.collection("sessions").add({ date: displayDate, fullDate: isoDate, hands: parseInt(s.hands) || 0, gain: gainNumber, stake: "NL2", ownerEmail: ADMIN_EMAIL });
                    count++;
                });
                alert("✅ VICTOIRE ! " + count + " sessions importées !");
            } catch (err) { alert("❌ Erreur de fichier."); }
        }
    };
    input.click(); setTimeout(() => document.body.removeChild(input), 100); 
}

window.openRangeModal = function() {
    const modal = document.getElementById('range-modal');
    if (modal) {
        modal.classList.add('show'); window.currentRangePage = 0;
        for(let i = 0; i <= 3; i++) { let p = document.getElementById('range-page-' + i); if(p) p.style.display = 'none'; }
        document.getElementById('range-page-0').style.display = 'block'; document.getElementById('range-page-title').innerText = window.rangeTitles[0];
    }
}
window.closeRangeModal = function() { const modal = document.getElementById('range-modal'); if (modal) modal.classList.remove('show'); }
window.changeRangePage = function(offset) {
    window.currentRangePage = (window.currentRangePage + offset + 4) % 4; 
    for(let i = 0; i <= 3; i++) { let p = document.getElementById('range-page-' + i); if(p) p.style.display = 'none'; }
    const activePage = document.getElementById('range-page-' + window.currentRangePage);
    activePage.style.display = 'block'; activePage.style.animation = 'none'; activePage.offsetHeight; 
    activePage.style.animation = 'slideInFade 0.3s ease-out forwards';
    document.getElementById('range-page-title').innerText = window.rangeTitles[window.currentRangePage];
}
window.addEventListener('click', (e) => { const modal = document.getElementById('range-modal'); if (e.target === modal) window.closeRangeModal(); });

window.editBankrollConfig = function() {
    const filterElem = document.getElementById('global-filter'); const filterValue = filterElem ? filterElem.value : "ALL";
    const userKey = currentViewEmail || "default";
    let defaultStart, defaultGoal;
    if (currentViewEmail === GUEST_EMAIL) {
        if (filterValue === "NL20") { defaultStart = 0; defaultGoal = 2500; } else if (filterValue === "NL10") { defaultStart = 0; defaultGoal = 1000; }
        else if (filterValue === "NL5") { defaultStart = 0; defaultGoal = 500; } else if (filterValue === "NL2") { defaultStart = 0; defaultGoal = 100; }
        else { defaultStart = 0; defaultGoal = 2500; }
    } else {
        if (filterValue === "NL20") { defaultStart = 1000; defaultGoal = 2500; } else if (filterValue === "NL10") { defaultStart = 500; defaultGoal = 1000; }
        else if (filterValue === "NL5") { defaultStart = 70; defaultGoal = 500; } else if (filterValue === "NL2") { defaultStart = 35; defaultGoal = 500; }
        else { defaultStart = 35; defaultGoal = 2500; }
    }
    const savedStart = localStorage.getItem(`startBR_${userKey}_${filterValue}`); const savedGoal = localStorage.getItem(`goalBR_${userKey}_${filterValue}`);
    let currentStart = savedStart !== null ? parseFloat(savedStart) : defaultStart; let currentGoal = savedGoal !== null ? parseFloat(savedGoal) : defaultGoal;
    let newStart = prompt(`💰 Bankroll de DÉPART pour la limite ${filterValue} :`, currentStart);
    if (newStart !== null && newStart.trim() !== "" && !isNaN(newStart)) localStorage.setItem(`startBR_${userKey}_${filterValue}`, parseFloat(newStart));
    let newGoal = prompt(`🎯 OBJECTIF de Bankroll pour la limite ${filterValue} :`, currentGoal);
    if (newGoal !== null && newGoal.trim() !== "" && !isNaN(newGoal)) localStorage.setItem(`goalBR_${userKey}_${filterValue}`, parseFloat(newGoal));
    updateUI();
};

// --- DÉMARRAGE ET ÉCOUTEURS D'INPUTS ---
document.addEventListener('DOMContentLoaded', () => {
    const amountUSDC = document.getElementById('input-amount');
    const amountCrypto = document.getElementById('input-crypto');
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');

    if (amountUSDC) amountUSDC.addEventListener('input', convertBaseToCrypto);
    if (amountCrypto) amountCrypto.addEventListener('input', convertCryptoToBase);

    if (inputDate) inputDate.addEventListener('input', () => dateEdited = true);
    if (inputTime) inputTime.addEventListener('input', () => dateEdited = true);
    
    setTodayDate();
    setInterval(setTodayDate, 30000); 
});