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

// --- 2. SÉCURITÉ ADMIN ---
const ADMIN_EMAIL = "plessier.antoine10@gmail.com";

function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("Erreur : " + err.message));
}

auth.onAuthStateChanged(user => {
    const entryForm = document.querySelector('.entry-form');
    const resetBtn = document.querySelector('.btn-reset');
    if (user && user.email === ADMIN_EMAIL) {
        if(entryForm) entryForm.style.display = 'flex';
        if(resetBtn) resetBtn.style.display = 'block';
    } else {
        if(entryForm) entryForm.style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'none';
    }
});

// --- 3. VARIABLES ET SYNCHRO ---
let sessions = [];
let previousBr = 0;

db.collection("sessions").orderBy("fullDate", "asc").onSnapshot((snapshot) => {
    sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateUI(); 
});

// --- 4. FONCTIONS UTILS ---
function setTodayDate() {
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');
    const now = new Date();
    if(inputDate) inputDate.value = now.toISOString().split('T')[0];
    if(inputTime) inputTime.value = now.toTimeString().slice(0,5); 
}

function addSession() {
    const handsInput = document.getElementById('input-hands');
    const gainInput = document.getElementById('input-gain');
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    const stakeInput = document.getElementById('input-stake');
    
    const hands = parseInt(handsInput.value);
    const gain = parseFloat(gainInput.value);
    const rawDate = dateInput.value;
    const rawTime = timeInput.value;
    const stake = stakeInput ? stakeInput.value : "NL10";

    if (isNaN(hands) || isNaN(gain) || !rawDate || !rawTime) return alert("Remplis tout !");

    db.collection("sessions").add({
        date: rawDate.split('-').reverse().slice(0,2).join('/'),
        fullDate: rawDate + "T" + rawTime, 
        hands: hands,
        gain: gain,
        stake: stake
    }).then(() => {
        if(typeof playPop === "function") playPop();
        handsInput.value = ''; gainInput.value = '';
        setTodayDate(); // 👈 Remet l'horloge à jour pour la prochaine session !
    });
}

function deleteSession(id) {
    if(confirm("Supprimer ?")) db.collection("sessions").doc(id).delete();
}

// --- 5. LOGIQUE D'AFFICHAGE ---
function updateUI() {
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";

    let startBR, goalBR;
    if (filterValue === "NL10") {
        startBR = 500;
        goalBR = 1000;
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

    let filteredSessions = sessions.filter(s => {
        const sessionStake = s.stake || "NL10";
        if (filterValue === "ALL") return true;
        return sessionStake === filterValue;
    });

    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    let totalBB = 0; 
    
    let bestGain = -Infinity, worstGain = Infinity;
    let bestSession = null, worstSession = null;

    const historyBody = document.getElementById('history-list');
    const user = auth.currentUser;
    const isAntoine = user && user.email === ADMIN_EMAIL;
    let rows = [];

    filteredSessions.forEach((s) => { 
        totalHands += s.hands; 
        currentProfitNet += s.gain;
        if (s.gain > 0) winningSessions++;
        
        if (s.gain > bestGain) { bestGain = s.gain; bestSession = s; }
        if (s.gain < worstGain) { worstGain = s.gain; worstSession = s; }

        handsLabels.push(totalHands);
        profitsNet.push(parseFloat(currentProfitNet.toFixed(2)));

        const sessionStake = s.stake || "NL10";
        const bbValue = (sessionStake === "NL2") ? 0.02 : 0.10;
        const gainBB = s.gain / bbValue;
        totalBB += gainBB;

        rows.push(`<tr>
            <td style="color: #888; font-weight: 400;">${s.date} <br><small style="font-weight:400; color:#3b82f6;">${sessionStake}</small></td>
            <td style="font-weight: 400;">${s.hands.toLocaleString()}</td>
            <td style="color: ${s.gain >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">${s.gain.toFixed(2)}€</td>
            <td style="color: ${gainBB >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">
                ${gainBB.toFixed(1)} BB
            </td>
            <td>${isAntoine ? `<button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>` : ''}</td>
        </tr>`);
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
        const newBr = startBR + currentProfitNet;
        if (previousBr === 0) {
            setTimeout(() => { animateValue('total-br', startBR, newBr, 1500); }, 1200);
        } else if (Math.abs(previousBr - newBr) > 300) {
             brElem.innerText = newBr.toFixed(2) + "€";
        } else {
             animateValue('total-br', previousBr, newBr, 1000); 
        }
        previousBr = newBr; 
    }
    
    document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    let winrate = totalHands > 0 ? totalBB / (totalHands / 100) : 0;
    const winrateElem = document.getElementById('winrate');
    winrateElem.innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
    winrateElem.style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    
    let successRate = filteredSessions.length > 0 ? (winningSessions / filteredSessions.length) * 100 : 0;
    document.getElementById('success-rate').innerText = successRate.toFixed(1) + "%";
    
    let prog = (currentProfitNet / (goalBR - startBR)) * 100;
    let displayProg = Math.min(100, Math.max(0, prog)); 
    document.getElementById('br-progression-text').innerText = displayProg.toFixed(1) + "%";
    document.getElementById('progress-bar-fill').style.width = displayProg + "%";

    // 🛑 APPEL DES DEUX FONCTIONS ICI
    renderChart(handsLabels, profitsNet);
    renderCalendar(filteredSessions); 
}

// --- 6. CHART ET AUDIO (AVEC EFFET NÉON AFFINÉ ET INTENSE - TECHNIQUE SABRE LASER) ---

// 🛑 A. DÉFINITION DU PLUGIN NÉON SABRE LASER (Unique à ajouter avant la fonction renderChart)
const neonLinePlugin = {
    id: 'neonLine',
    defaults: { 
        // 👈 La couleur de base du néon (Bleu intense)
        neonColor: '#00aaff', 
        // 👈 La couleur du cœur (Très pâle/blanc) pour simuler l'intensité
        coreColor: '#ccffff', 
        ballColor: '#ffffff', // Cœur blanc boule
        speed: 2500 // Vitesse d'animation : 2.5 secondes
    },
    
    afterDatasetsDraw(chart, args, options) {
        const { ctx, scales: { x, y } } = chart;
        const datasetMeta = chart.getDatasetMeta(0);
        const points = datasetMeta.data;

        // Sécurité : On ne dessine que s'il y a des données et si l'animation a commencé
        if (!points || points.length < 2 || chart.neonProgress === undefined) return;

        ctx.save();

        // 🛑 B. CALCUL DU PARCOURS ANIME
        const totalDuration = options.speed; // Durée totale de l'animation en ms
        const elapsed = Date.now() - chart.neonStartTime;
        const progress = Math.min(elapsed / totalDuration, 1); // Progression de 0 à 1
        
        const endIndex = (points.length - 1) * progress;
        const integerEndIndex = Math.floor(endIndex);
        const factionalEndIndex = endIndex - integerEndIndex;

        // --- C. DÉFINITION DU TRACÉ (Path) ---
        // On crée un tracé pour le sabre laser qu'on va réutiliser pour chaque couche de lumière
        ctx.beginPath();
        for (let i = 0; i <= integerEndIndex; i++) {
            const point = points[i];
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
        
        // Dessine la partie fractionnaire finale pour que ce soit fluide
        if (integerEndIndex < points.length - 1) {
            const p1 = points[integerEndIndex];
            const p2 = points[integerEndIndex + 1];
            const finalX = p1.x + (p2.x - p1.x) * factionalEndIndex;
            const finalY = p1.y + (p2.y - p1.y) * factionalEndIndex;
            ctx.lineTo(finalX, finalY);
        }

        // On retient ce tracé pour l'appliquer à toutes les couches de dessin
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // --- D. L'EFFET NÉON PAR EMPILEMENT DE LUEURS (LA TECHNIQUE DU SABRE LASER) ---

        // Couche 1 : Lueure diffuse ultra-large (Halo le plus externe)
        ctx.lineWidth = 20; // Très large
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.08)'; // Très transparent
        ctx.shadowColor = options.neonColor; // Bleu pur
        ctx.shadowBlur = 40; // Flou gigantesque
        ctx.stroke();

        // Couche 2 : Lueure moyenne (Halo principal)
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)'; 
        ctx.shadowBlur = 20; 
        ctx.stroke();

        // Couche 3 : Cœur de lueure concentrée (Intensity)
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.4)'; 
        ctx.shadowBlur = 10; 
        ctx.stroke();

        // Couche 4 : 🛑 LE CŒUR BLANC INTENSE ET FIN (AFFINER ET INTENSIFIER ICI)
        ctx.lineWidth = 1.0; // 👈 🛑 ULTRA FIN pour la précision
        ctx.strokeStyle = options.coreColor; // 👈 🛑 TRÈS CLAIR (presque blanc) pour la brillance pure
        ctx.shadowBlur = 3; // Lueure intime juste autour
        ctx.stroke();

        // --- E. DESSIN DE LA BOULE DE LUMIÈRE (Renforcée) ---
        if (points.length > 0) {
            // Calcule la position exacte de la boule au bout du parcours
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

            // Halo lumineux externe (Bleu intense)
            ctx.beginPath();
            ctx.arc(ballX, ballY, 18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 100, 255, 0.1)'; // Halo doux
            ctx.fill();

            // Halo concentré (Intensity)
            ctx.beginPath();
            ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100, 240, 255, 0.3)'; 
            ctx.fill();

            // Cœur brillant (Blanc pur intense - comme l'original)
            ctx.beginPath();
            ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = options.ballColor; // Blanc pur
            ctx.shadowColor = '#ccffff'; // Halo brillant très clair autour
            ctx.shadowBlur = 25; // Explosion de lumière
            ctx.fill();
        }

        ctx.restore();

        // 🛑 F. BOUCLE D'ANIMATION (Demande de re-dessiner le cadre suivant si pas fini)
        if (progress < 1) {
            requestAnimationFrame(() => chart.draw()); 
        }
    }
};

// 🛑 G. FONCTION RENDERCHART MODIFIÉE POUR CACHER L'ANCIENNE LIGNE
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
                // 🛑 CHANGEMENT MAJEUR ICI 🛑
                borderWidth: 0, // 👈 🛑 ON CACHE COMPLÈTEMENT LA LIGNE BLEUE EPAISSE DU GRAPHIQUE
                borderColor: 'rgba(0,0,0,0)', // 👈 Ligne 100% transparente
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
            // 🛑 H. CONFIGURATION DU PLUGIN NÉON SABRE LASER
            plugins: { 
                legend: { display: false },
                // Active le plugin personnalisé
                neonLine: {
                    neonColor: '#3b82f6', // 👈 Vrai bleu du thème
                    coreColor: '#eff6ff', // 👈 Blanc bleuté
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
        // Enregistre le plugin pour ce graphique précis
        plugins: [neonLinePlugin]
    };

    // Création du chart
    window.pokerChart = new Chart(ctx, chartConfig);
    
    // 🛑 I. DÉMARRAGE DE L'ANIMATION LORSQUE LE CHART S'AFFICHE
    if (labels.length > 1) {
        window.pokerChart.neonProgress = 0; // Point de départ
        window.pokerChart.neonStartTime = Date.now(); // Temps de départ
        window.pokerChart.draw(); // Force le premier dessin pour lancer la boucle d'animation
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

function resetData() {
    if(confirm("Tout supprimer ?")) {
        db.collection("sessions").get().then((q) => q.forEach((doc) => doc.ref.delete()));
    }
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
    const dataStr = JSON.stringify(sessions, null, 2);
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
                        stake: "NL2"
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
let currentCalDate = new Date(); // 👈 Nouvelle mémoire pour retenir le mois qu'on est en train de regarder

function toggleHistoryFlip() {
    const flipper = document.getElementById('history-flipper');
    if (flipper) flipper.classList.toggle('is-flipped');
}

// 👈 Nouvelle fonction pour changer de mois !
function changeCalMonth(offset) {
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    updateUI(); // Recharge la page avec le nouveau mois
}

function renderCalendar(filteredSessions) {
    const calContainer = document.getElementById('calendar-view');
    if (!calContainer) return;

    // 1. On regroupe tous les gains ET les limites par jour
    const dailyData = {};
    filteredSessions.forEach(s => {
        if(!s.fullDate) return;
        const dateStr = s.fullDate.split('T')[0]; 
        
        // On crée une petite mémoire pour chaque jour qui stocke le gain et les limites
        if (!dailyData[dateStr]) dailyData[dateStr] = { gain: 0, stakes: new Set() };
        
        dailyData[dateStr].gain += s.gain;
        dailyData[dateStr].stakes.add(s.stake || "NL10"); // Enregistre la limite jouée
    });

    // 2. On configure le mois affiché
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth(); 

    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    // 3. On dessine la grille AVEC LES FLÈCHES DE NAVIGATION
    let html = `
    <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 10px 5px 10px;">
        <button onclick="changeCalMonth(-1)" style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; border-radius: 4px; padding: 4px 12px; font-size: 0.8rem; transition: 0.2s; display: flex; align-items: center; justify-content: center;">◀</button>
        <span style="line-height: 1; transform: translateY(1px);">${monthNames[month]} ${year}</span>
        <button onclick="changeCalMonth(1)" style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; border-radius: 4px; padding: 4px 12px; font-size: 0.8rem; transition: 0.2s; display: flex; align-items: center; justify-content: center;">▶</button>
    </div>`;
    
    html += `<div class="calendar-grid">`;
    
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(d => {
        html += `<div class="cal-day-name">${d}</div>`;
    });

    for(let i = 0; i < startDay; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    // 4. On remplit les cases du calendrier
    for(let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const data = dailyData[dateStr];

        let classes = "cal-day";
        let content = `<span class="cal-date">${d}</span>`;

        if (data !== undefined) {
            const pnl = data.gain;
            // On transforme la liste des limites en texte (ex: "NL10" ou "NL2 / NL10")
            const stakesStr = Array.from(data.stakes).join(' / '); 

            if (pnl > 0) classes += " win";
            else if (pnl < 0) classes += " loss";
            else classes += " even";

            content += `<span class="cal-pnl">${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}€</span>`;
            
            // 👈 L'étiquette bleue de la limite est ajoutée ici en haut à droite !
            content += `<span style="position: absolute; top: 3px; right: 4px; font-size: 0.5rem; color: #60a5fa; font-weight: 700; letter-spacing: 0.5px;">${stakesStr}</span>`;
        }

        html += `<div class="${classes}">${content}</div>`;
    }
    html += `</div>`;

    calContainer.innerHTML = html;
}

// --- 10. HORLOGE TEMPS RÉEL ---
setTodayDate();

// Met à jour l'heure automatiquement toutes les 30 secondes
setInterval(() => {
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    // Sécurité : On ne met à jour QUE si tu n'es pas en train d'écrire dedans
    if (document.activeElement !== dateInput && document.activeElement !== timeInput) {
        setTodayDate();
    }
}, 30000);

// Bonus : Met à l'heure instantanément quand tu reviens sur l'onglet (Alt+Tab)
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
