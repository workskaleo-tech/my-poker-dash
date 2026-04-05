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
    const entryForm = document.querySelector('.entry-form');
    const resetBtn = document.querySelector('.btn-reset');
    const loginMenu = document.getElementById('login-menu');

    if (user && (user.email === ADMIN_EMAIL || user.email === GUEST_EMAIL)) {
        
        if (!currentViewEmail) {
            currentViewEmail = user.email; 
        }

        if(loginMenu) {
            loginMenu.innerHTML = `
                <button onclick="switchView('${ADMIN_EMAIL}')">📊 Admin</button>
                <button onclick="switchView('${GUEST_EMAIL}')">👀 Piootres</button>
                <button onclick="auth.signOut()" style="color: #ff5555; border-top: 1px solid rgba(255,255,255,0.06);">🚪 Log out</button>
            `;
        }

        if(entryForm) entryForm.style.display = 'flex';
        if(resetBtn) resetBtn.style.display = 'block'; // Tout le monde voit le bouton reset maintenant, mais il ne supprime que SES données

        if (dbUnsubscribe) dbUnsubscribe();
        
        dbUnsubscribe = db.collection("sessions").orderBy("fullDate", "asc").onSnapshot((snapshot) => {
            allSessionsDB = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUI(); 
        });

    } else {
        currentViewEmail = null;
        if(loginMenu) {
            loginMenu.innerHTML = `
                <button onclick="login('admin')">👑 Admin</button>
                <button onclick="login('guest')">🎮 Piootres</button>
            `;
        }
        if(entryForm) entryForm.style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'none';
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

// --- 4. FONCTIONS UTILS ---
function setTodayDate() {
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');
    const now = new Date();
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    if(inputDate) inputDate.value = `${year}-${month}-${day}`;
    if(inputTime) inputTime.value = `${hours}:${minutes}`;
}

function addSession() {
    const handsInput = document.getElementById('input-hands');
    const gainInput = document.getElementById('input-gain');
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    const stakeInput = document.getElementById('input-stake');
    const roomInput = document.getElementById('input-room');
    const rakebackInput = document.getElementById('input-rakeback');
    
    const hands = parseInt(handsInput.value) || 0;
    const gain = parseFloat(gainInput.value) || 0;
    const rakeback = parseFloat(rakebackInput ? rakebackInput.value : 0) || 0;
    const rawDate = dateInput.value;
    const rawTime = timeInput.value;
    const stake = stakeInput ? stakeInput.value : "NL10";
    const room = roomInput ? roomInput.value : "stake";

    if (!rawDate || !rawTime) return alert("Remplis la date et l'heure !");

    if (auth.currentUser && currentViewEmail !== auth.currentUser.email) {
        return alert("Attention ! Tu regardes les stats de l'autre joueur. Repasse sur tes propres stats (via le menu) pour ajouter une session.");
    }

    const now = new Date();
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const uniqueFullDate = `${rawDate}T${rawTime}:${sec}.${ms}`; 

    db.collection("sessions").add({
        date: rawDate.split('-').reverse().slice(0,2).join('/'),
        fullDate: uniqueFullDate,
        hands: hands,
        gain: gain,
        rakeback: rakeback,
        stake: stake,
        room: room,
        ownerEmail: auth.currentUser.email 
    }).then(() => {
        if(typeof playPop === "function") playPop();
        handsInput.value = ''; gainInput.value = '';
        if(rakebackInput) rakebackInput.value = '';
        setTodayDate(); 
    });
}

function deleteSession(id) {
    if(confirm("Supprimer ?")) db.collection("sessions").doc(id).delete();
}

// 🛑 SÉCURITÉ DE SUPPRESSION DE MASSE
function resetData() {
    if(!auth.currentUser) return;
    if(confirm("Es-tu sûr de vouloir supprimer TOUT TON historique ? (Les stats de l'autre joueur seront conservées)")) {
        const myEmail = auth.currentUser.email;
        db.collection("sessions").get().then((q) => {
            q.forEach((doc) => {
                const s = doc.data();
                const owner = s.ownerEmail || ADMIN_EMAIL;
                // On ne supprime QUE les documents qui appartiennent à celui qui a cliqué
                if (owner === myEmail) {
                    doc.ref.delete();
                }
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
        const badgeMap = { "ALL": ["NL", "badge-nl"], "NL2": ["NL2", "badge-nl2"], "NL5": ["NL5", "badge-nl5"], "NL10": ["NL10", "badge-nl10"] };
        const [label, cls] = badgeMap[filterValue] || ["NL", "badge-nl"];
        headerBadge.innerText = label;
        headerBadge.className = "badge " + cls;
    }

    const roomFilterElem = document.getElementById('room-filter');
    const roomFilterValue = roomFilterElem ? roomFilterElem.value : "ALL";

    const isGlobalView = (filterValue === "ALL" && roomFilterValue === "ALL");

    let startBR, goalBR;
    if (filterValue === "NL10") {
        startBR = 500;
        goalBR = 1000;
    } else if (filterValue === "NL5") {
        startBR = 70;
        goalBR = 500;
    } else if (filterValue === "NL2") {
        startBR = 35;  
        goalBR = 500;  
    } else { 
        startBR = 35;  
        goalBR = 1000; 
    }

    const xpTitle = document.getElementById('xp-title-text');
    if(xpTitle) {
        xpTitle.innerHTML = `<span class="xp-start">🏁 Départ ${startBR}€</span> <span class="xp-arrow">➔</span> <span class="xp-goal">🎯 Objectif ${goalBR}€</span>`;
    }

    let filteredSessions = getTargetUserSessions().filter(s => {
        const sessionStake = s.stake || "NL10";
        const sessionRoom = s.room || "stake";

        let matchStake = (filterValue === "ALL") || (sessionStake === filterValue);
        let matchRoom = (roomFilterValue === "ALL") || (sessionRoom === roomFilterValue);

        return matchStake && matchRoom;
    });

    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    let totalBB = 0; let totalRakeback = 0;
    
    let bestGain = -Infinity, worstGain = Infinity;
    let bestSession = null, worstSession = null;

    const historyBody = document.getElementById('history-list');
    const user = auth.currentUser;
    
    let rows = [];

    filteredSessions.forEach((s) => { 
        const sHands = parseInt(s.hands) || 0;
        totalHands += sHands; 
        currentProfitNet += s.gain;
        totalRakeback += (s.rakeback || 0);
        
        if (s.gain > 0) winningSessions++;
        
        if (!(sHands === 0 && s.gain === 0)) {
            if (s.gain > bestGain) { bestGain = s.gain; bestSession = s; }
            if (s.gain < worstGain) { worstGain = s.gain; worstSession = s; }
        }

        handsLabels.push(totalHands);
        profitsNet.push(parseFloat(currentProfitNet.toFixed(2)));

        const sessionStake = s.stake || "NL10";
        const bbValue = (sessionStake === "NL2") ? 0.02 : (sessionStake === "NL5") ? 0.05 : 0.10;
        const gainBB = s.gain / bbValue;
        totalBB += gainBB;

        const isRakebackOnly = (sHands === 0 && s.gain === 0);
        const currentRoom = s.room || 'stake';
        const roomIcon = currentRoom === 'coinpoker' ? '🪙' : '🎲';

        const rakebackBadge = (isGlobalView && s.rakeback && s.rakeback > 0)
            ? `<span style="color:#a78bfa; font-size:0.8em; display:block;">+${s.rakeback.toFixed(2)}€ RB</span>`
            : '';

        // 🛑 SÉCURITÉ BOUTON CROIX ROUGE : La croix ne s'affiche que si la session appartient à l'utilisateur connecté
        const sessionOwner = s.ownerEmail || ADMIN_EMAIL;
        const isMySession = user && user.email === sessionOwner;

        if (isRakebackOnly) {
            if (isGlobalView) {
                rows.push(`<tr style="opacity: 0.5;">
                    <td style="color: #888; font-weight: 400;">
                        ${s.date} <br>
                        <small style="font-weight:400; color:#a78bfa;">RB only</small>
                    </td>
                    <td style="color: #888;">—</td>
                    <td style="color: #a78bfa; font-weight: 400;">+${(s.rakeback || 0).toFixed(2)}€ RB</td>
                    <td style="color: #888;">—</td>
                    <td>${isMySession ? `<button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>` : ''}</td>
                </tr>`);
            }
        } else {
            rows.push(`<tr>
                <td style="color: #888; font-weight: 400;">
                    ${s.date} <br>
                    <small style="font-weight:400; color:#3b82f6;">
                        ${sessionStake} <span style="margin-left: 5px; color: #fff; font-size: 1.1em;">${roomIcon}</span>
                    </small>
                </td>
                <td style="font-weight: 400;">${sHands.toLocaleString()}</td>
                <td style="color: ${s.gain >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">${s.gain.toFixed(2)}€${rakebackBadge}</td>
                <td style="color: ${gainBB >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">
                    ${gainBB.toFixed(1)} BB
                </td>
                <td>${isMySession ? `<button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>` : ''}</td>
            </tr>`);
        }
    });

    if(historyBody) historyBody.innerHTML = rows.reverse().join('');

    const bestGainElem = document.getElementById('best-session-gain');
    const bestDateElem = document.getElementById('best-session-date');
    const worstGainElem = document.getElementById('worst-session-gain');
    const worstDateElem = document.getElementById('worst-session-date');

    if (filteredSessions.length > 0 && bestSession && worstSession) {
        if (bestGainElem) bestGainElem.innerText = `+${bestSession.gain.toFixed(2)}€`;
        if (bestDateElem) bestDateElem.innerText = `le ${bestSession.date} (${bestSession.stake || "NL10"})`;
        if (worstGainElem) worstGainElem.innerText = `${worstSession.gain.toFixed(2)}€`;
        if (worstDateElem) worstDateElem.innerText = `le ${worstSession.date} (${worstSession.stake || "NL10"})`;
    } else {
        if (bestGainElem) bestGainElem.innerText = "0.00€";
        if (bestDateElem) bestDateElem.innerText = "--/--";
        if (worstGainElem) worstGainElem.innerText = "0.00€";
        if (worstDateElem) worstDateElem.innerText = "--/--";
    }

    const brElem = document.getElementById('total-br');
    if(brElem) {
        const newBr = startBR + currentProfitNet + (isGlobalView ? totalRakeback : 0);
        if (previousBr === 0) {
            setTimeout(() => { animateValue('total-br', startBR, newBr, 1500); }, 1200);
        } else if (Math.abs(previousBr - newBr) > 300) {
             brElem.innerText = newBr.toFixed(2) + "€";
        } else {
             animateValue('total-br', previousBr, newBr, 1000); 
        }
        previousBr = newBr; 
    }

    const rakebackElem = document.getElementById('total-rakeback');
    const rakebackCard = document.getElementById('rakeback-card');
    if(rakebackElem) {
        rakebackElem.innerText = "+" + totalRakeback.toFixed(2) + "€";
        rakebackElem.style.color = totalRakeback > 0 ? '#a78bfa' : '#9ca3af';
    }
    if(rakebackCard) {
        rakebackCard.style.display = isGlobalView ? '' : 'none';
    }
    
    document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    
    let winrate = totalHands > 0 ? totalBB / (totalHands / 100) : 0;
    const winrateElem = document.getElementById('winrate');
    winrateElem.innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
    winrateElem.style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    
    let successRate = filteredSessions.length > 0 ? (winningSessions / filteredSessions.length) * 100 : 0;
    document.getElementById('success-rate').innerText = successRate.toFixed(1) + "%";
    
    let prog = ((currentProfitNet + (isGlobalView ? totalRakeback : 0)) / (goalBR - startBR)) * 100;
    let displayProg = Math.min(100, Math.max(0, prog)); 
    document.getElementById('br-progression-text').innerText = displayProg.toFixed(1) + "%";
    document.getElementById('progress-bar-fill').style.width = displayProg + "%";

    renderCalendar(filteredSessions);
    renderChart(handsLabels, profitsNet);
}

// --- 6. CHART ET AUDIO ---
const neonLinePlugin = {
    id: 'neonLine',
    defaults: { 
        neonColor: '#00aaff', 
        coreColor: '#ccffff', 
        ballColor: '#ffffff',
        speed: 2500
    },
    
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

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.lineWidth = 20;
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.08)';
        ctx.shadowColor = options.neonColor;
        ctx.shadowBlur = 40;
        ctx.stroke();

        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)'; 
        ctx.shadowBlur = 20; 
        ctx.stroke();

        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.4)'; 
        ctx.shadowBlur = 10; 
        ctx.stroke();

        ctx.lineWidth = 1.0;
        ctx.strokeStyle = options.coreColor;
        ctx.shadowBlur = 3;
        ctx.stroke();

        if (points.length > 0) {
            let ballX, ballY;
            if (integerEndIndex < points.length - 1) {
                const p1 = points[integerEndIndex];
                const p2 = points[integerEndIndex + 1];
                ballX = p1.x + (p2.x - p1.x) * factionalEndIndex;
                ballY = p1.y + (p2.y - p1.y) * factionalEndIndex;
            } else {
                const last = points[points.length - 1];
                ballX = last.x;
                ballY = last.y;
            }

            ctx.beginPath();
            ctx.arc(ballX, ballY, 18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100, 240, 255, 0.3)'; 
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = options.ballColor;
            ctx.shadowColor = '#ccffff';
            ctx.shadowBlur = 25;
            ctx.fill();
        }

        ctx.restore();

        if (progress < 1) {
            requestAnimationFrame(() => chart.draw()); 
        }
    }
};

function renderChart(labels, values) {
    const canvas = document.getElementById('myChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (window.pokerChart) window.pokerChart.destroy();
    
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit Net',
                data: values,
                pointRadius: 0,
                pointHoverRadius: 5,
                borderWidth: 0,
                borderColor: 'rgba(0,0,0,0)',
                fill: 'start',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                tension: 0.2
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            layout: {
                padding: { left: 0, right: 0, top: 10, bottom: 5 }
            },
            scales: {
                y: { 
                    suggestedMin: 0, 
                    grid: { color: 'rgba(59, 130, 246, 0.1)' }, 
                    ticks: { color: '#9ca3af' } 
                },
                x: { 
                    type: 'linear', 
                    bounds: 'tight', 
                    grid: { display: false }, 
                    min: labels[0], 
                    max: labels[labels.length - 1], 
                    ticks: { color: '#9ca3af' } 
                }
            },
            plugins: { 
                legend: { display: false },
                neonLine: {
                    neonColor: '#3b82f6',
                    coreColor: '#eff6ff',
                    ballColor: '#ffffff', 
                    speed: 2000 
                },
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original' }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                }
            }
        },
        plugins: [neonLinePlugin]
    };

    window.pokerChart = new Chart(ctx, chartConfig);
    
    if (labels.length > 1) {
        window.pokerChart.neonProgress = 0;
        window.pokerChart.neonStartTime = Date.now();
        window.pokerChart.draw();
    }
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerText = (progress * (end - start) + start).toFixed(2) + "€";
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// --- 7. ANIMATIONS DE FOND ---
const bgCanvas = document.getElementById('bg-canvas');
if (bgCanvas) {
    const bgCtx = bgCanvas.getContext('2d');
    let stars = [], smokeTrail = [], shootingStars = [], shootingStarTimer = 0, fireballs = [], fireballTimer = 0, mouse = { x: null, y: null };

    function initBg() {
        bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 50; i++) {
            stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, sx: (Math.random() - 0.5) * 0.5, sy: (Math.random() - 0.5) * 0.5 });
        }
    }

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        for(let i = 0; i < 2; i++) {
            smokeTrail.push({ x: mouse.x, y: mouse.y, size: Math.random() * 5 + 2, speedX: (Math.random() - 0.5) * 0.8, speedY: (Math.random() - 1) * 0.4, opacity: 1 });
        }
    });

    function createShootingStar() {
        shootingStars.push({
            x: Math.random() * bgCanvas.width, 
            y: -10, 
            vx: (Math.random() - 0.5) * 4, 
            vy: Math.random() * 5 + 7,
            trail: [] 
        });
    }

    function createFireball() {
        fireballs.push({
            x: Math.random() * bgCanvas.width, 
            y: -30, 
            vx: (Math.random() - 0.5) * 2, 
            vy: Math.random() * 2 + 3, 
            size: Math.random() * 4 + 3, 
            trail: [] 
        });
    }

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
                gradient.addColorStop(0, `rgba(59, 130, 246, ${s.opacity * 0.15})`);
                gradient.addColorStop(0.7, `rgba(59, 130, 246, ${s.opacity * 0.05})`);
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                bgCtx.beginPath(); bgCtx.fillStyle = gradient; bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2); bgCtx.fill();
            }
        }

        shootingStarTimer++;
        if (shootingStarTimer > 800) { 
            createShootingStar();
            shootingStarTimer = 0;
        }

        shootingStars.forEach((s, idx) => {
            s.x += s.vx; s.y += s.vy;
            s.trail.push({x: s.x, y: s.y});
            if(s.trail.length > 15) s.trail.shift();

            bgCtx.beginPath();
            bgCtx.strokeStyle = "rgba(147, 197, 253, 0.4)";
            bgCtx.lineWidth = 1;
            s.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
            bgCtx.stroke();

            if(s.y > bgCanvas.height) shootingStars.splice(idx, 1);
        });

        fireballTimer++;
        if (fireballTimer > Math.random() * 1000 + 500) { 
            createFireball();
            fireballTimer = 0;
        }

        fireballs.forEach((fb, idx) => {
            fb.x += fb.vx; fb.y += fb.vy;
            fb.trail.push({x: fb.x, y: fb.y, size: fb.size});
            if(fb.trail.length > 25) fb.trail.shift();

            if(fb.trail.length > 1) {
                bgCtx.beginPath();
                let fireGrad = bgCtx.createLinearGradient(fb.trail[0].x, fb.trail[0].y, fb.x, fb.y);
                fireGrad.addColorStop(0, "rgba(255, 50, 0, 0)");
                fireGrad.addColorStop(1, "rgba(255, 140, 0, 0.6)");
                bgCtx.strokeStyle = fireGrad;
                bgCtx.lineWidth = fb.size; 
                bgCtx.lineCap = 'round';
                fb.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
                bgCtx.stroke();
            }

            bgCtx.beginPath();
            bgCtx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2);
            bgCtx.fillStyle = "#ffddaa"; 
            bgCtx.shadowColor = "#ff4500"; 
            bgCtx.shadowBlur = 25; 
            bgCtx.fill();
            bgCtx.shadowBlur = 0;

            if(fb.y > bgCanvas.height + 50) fireballs.splice(idx, 1);
        });

        requestAnimationFrame(animateBg);
    }

    window.addEventListener('resize', initBg);
    initBg(); 
    animateBg();
}

// --- 8. EXPORT ET IMPORT DES DONNÉES ---
function exportData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut exporter les données.");
    }
    const dataStr = JSON.stringify(allSessionsDB, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const downloadNode = document.createElement('a');
    downloadNode.href = url;
    downloadNode.download = "backup_poker_stats.json";
    downloadNode.style.display = 'none';
    document.body.appendChild(downloadNode);
    downloadNode.click();
    document.body.removeChild(downloadNode);
    URL.revokeObjectURL(url);
}

function importData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut importer des données.");
    }

    alert("🚀 Le nouveau script TERMINATOR est bien activé !");

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'; 
    input.style.display = 'none';
    document.body.appendChild(input); 
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return; 

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        
        reader.onload = readerEvent => {
            try {
                const data = JSON.parse(readerEvent.target.result);
                let count = 0;
                data.forEach(s => {
                    let rawGain = String(s.gain).replace(',', '.');
                    let gainNumber = parseFloat(rawGain);

                    let sString = JSON.stringify(s);
                    let match = sString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    
                    let displayDate = "00/00";
                    let isoDate = "2000-01-01T0000";

                    if (match) {
                        let jour = match[1], mois = match[2], annee = match[3];
                        displayDate = `${jour}/${mois}`; 
                        isoDate = `${annee}-${mois}-${jour}T${String(count).padStart(4, '0')}`;
                    }

                    db.collection("sessions").add({
                        date: displayDate,
                        fullDate: isoDate,
                        hands: parseInt(s.hands) || 0,
                        gain: gainNumber,
                        stake: "NL2",
                        ownerEmail: ADMIN_EMAIL // Les imports vont chez l'admin par défaut
                    });
                    count++;
                });
                alert("✅ VICTOIRE ! " + count + " sessions importées avec la bonne date !");
            } catch (err) {
                alert("❌ Erreur. Le fichier n'est pas un JSON valide.");
                console.error(err);
            }
        }
    };
    input.click(); 
    setTimeout(() => document.body.removeChild(input), 100); 
}

let audioCtx;
function playPop() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

// --- 9. CALENDRIER PNL (AXIOM STYLE) ---
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
            <div style="font-size: 1rem; font-weight: 800; color: ${pnlColor};">${monthPnl !== 0 ? pnlSign + monthPnl.toFixed(2) + '€' : '—'}</div>
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
            content += `<p class="cal-pnl">${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}€</p>`;
            content += `<span style="position: absolute; bottom: 3px; left: 0; right: 0; text-align: center; font-size: 0.6rem; color: #888; font-weight: 600;">${data.hands} h</span>`;
        }

        html += `<div class="${classes}">${content}</div>`;
    }
    html += `</div>`;

    calContainer.innerHTML = html;
}

// --- 10. HORLOGE TEMPS RÉEL ---
setTodayDate();

setInterval(() => {
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    if (document.activeElement !== dateInput && document.activeElement !== timeInput) {
        setTodayDate();
    }
}, 30000);

window.addEventListener('focus', () => {
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    if (document.activeElement !== dateInput && document.activeElement !== timeInput) {
        setTodayDate();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const bankrollCard = document.querySelector('.stat-card');
    if (bankrollCard) {
        bankrollCard.style.cursor = 'pointer'; 
        bankrollCard.addEventListener('click', () => {
            bankrollCard.classList.add('spinning');
            if (typeof playPop === "function") playPop();
            setTimeout(() => { bankrollCard.classList.remove('spinning'); }, 600);
        });
    }
});

// --- 11. MODALE RANGES ET NAVIGATION ---
window.currentRangePage = 0;
window.rangeTitles = ["🟢 Open Raise", "🚀 3bet & Défense", "🔥 Iso & Squeeze", "🧮 Équité & Maths"]; 

window.openRangeModal = function() {
    const modal = document.getElementById('range-modal');
    if (modal) {
        modal.classList.add('show');
        window.currentRangePage = 0;
        
        for(let i = 0; i <= 3; i++) {
            let p = document.getElementById('range-page-' + i);
            if(p) p.style.display = 'none';
        }
        
        document.getElementById('range-page-0').style.display = 'block';
        document.getElementById('range-page-title').innerText = window.rangeTitles[0];
    }
}

window.closeRangeModal = function() {
    const modal = document.getElementById('range-modal');
    if (modal) modal.classList.remove('show');
}

window.changeRangePage = function(offset) {
    window.currentRangePage = (window.currentRangePage + offset + 4) % 4; 
    
    for(let i = 0; i <= 3; i++) {
        let p = document.getElementById('range-page-' + i);
        if(p) p.style.display = 'none';
    }
    
    const activePage = document.getElementById('range-page-' + window.currentRangePage);
    activePage.style.display = 'block';
    
    activePage.style.animation = 'none';
    activePage.offsetHeight; 
    activePage.style.animation = 'slideInFade 0.3s ease-out forwards';
    
    document.getElementById('range-page-title').innerText = window.rangeTitles[window.currentRangePage];
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('range-modal');
    if (e.target === modal) {
        window.closeRangeModal();
    }
});