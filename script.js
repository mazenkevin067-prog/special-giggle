let gameState = {
    players: [],
    mafiaCount: 2,
    doctorCount: 1,
    detectiveCount: 1,
    currentRound: 1,
    currentRevealIndex: 0,
    phase: 'setup', 
    
    mafiaLeaderTurnIndex: 0,
    detectiveLeaderTurnIndex: 0,
    
    currentNightPlayerIndex: 0, 
    nightKillTargetId: null, 
    nightSaves: [], 
    
    currentVoterIndex: 0,
    dayVotes: {}, 
    historyLog: []
};

let tempSelectedTargetId = null;
let activeModalCallback = null; 

document.addEventListener("DOMContentLoaded", () => {
    generatePlayerInputs();
    checkSavedGame();
});

function changeScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function generatePlayerInputs() {
    const count = parseInt(document.getElementById('player-count').value) || 5;
    const container = document.getElementById('players-names-container');
    container.innerHTML = '<h4>أسماء اللاعبين:</h4>';
    for (let i = 1; i <= count; i++) {
        container.innerHTML += `<input type="text" id="p-name-${i}" value="لاعب ${i}">`;
    }
}

function startGame() {
    const count = parseInt(document.getElementById('player-count').value);
    gameState.mafiaCount = parseInt(document.getElementById('mafia-count').value);
    gameState.doctorCount = parseInt(document.getElementById('doctor-count').value);
    gameState.detectiveCount = parseInt(document.getElementById('detective-count').value);
    
    let totalSpecial = gameState.mafiaCount + gameState.doctorCount + gameState.detectiveCount;
    if (totalSpecial >= count) {
        showCustomModal("🔕 خطأ في الإعدادات", "إجمالي عدد الأدوار الخاصة المحددة أكبر أو يساوي عدد اللاعبين الكلي للروم!", "🔔", "court-style");
        return;
    }

    gameState.players = [];
    for (let i = 1; i <= count; i++) {
        let name = document.getElementById(`p-name-${i}`).value.trim();
        gameState.players.push({ id: i, name: name ? name : `لاعب ${i}`, role: 'Citizen', alive: true });
    }

    let pool = [];
    for (let i = 0; i < gameState.mafiaCount; i++) pool.push('Mafia');
    for (let i = 0; i < gameState.doctorCount; i++) pool.push('Doctor');
    for (let i = 0; i < gameState.detectiveCount; i++) pool.push('Detective');
    while (pool.length < count) pool.push('Citizen');
    pool.sort(() => Math.random() - 0.5);

    gameState.players.forEach((p, idx) => p.role = pool[idx]);
    gameState.currentRound = 1;
    gameState.currentRevealIndex = 0;
    gameState.mafiaLeaderTurnIndex = 0;
    gameState.detectiveLeaderTurnIndex = 0;
    gameState.historyLog = ["بدأت اللعبة وتوزعت بطاقات الهوية السرية بنجاح."];

    saveToLocalStorage();
    setupRevealScreen();
}

function setupRevealScreen() {
    gameState.phase = 'reveal';
    changeScreen('screen-reveal');
    
    if (gameState.currentRevealIndex < gameState.players.length) {
        let p = gameState.players[gameState.currentRevealIndex];
        document.getElementById('next-player-name').innerText = p.name;
        document.getElementById('role-card-display').classList.add('hidden');
        document.getElementById('btn-reveal-action').classList.remove('hidden');
    } else {
        startNightPhase();
    }
}

function revealRole() {
    let p = gameState.players[gameState.currentRevealIndex];
    let cardInner = document.getElementById('role-card-inner');
    let icon = document.getElementById('role-icon');
    
    document.getElementById('role-name').innerText = translateRole(p.role);
    document.getElementById('role-desc').innerText = getRoleDescription(p.role);
    
    if (p.role === 'Mafia') { cardInner.style.background = "var(--color-mafia)"; icon.innerText = "🥷"; }
    else if (p.role === 'Doctor') { cardInner.style.background = "var(--color-doctor)"; icon.innerText = "🩺"; }
    else if (p.role === 'Detective') { cardInner.style.background = "var(--color-detective)"; icon.innerText = "🔍"; }
    else { cardInner.style.background = "var(--color-citizen)"; icon.innerText = "👤"; }

    document.getElementById('btn-reveal-action').classList.add('hidden');
    document.getElementById('role-card-display').classList.remove('hidden');
}

function confirmRoleSeen() {
    gameState.currentRevealIndex++;
    saveToLocalStorage();
    setupRevealScreen();
}

function startNightPhase() {
    gameState.phase = 'night';
    gameState.currentNightPlayerIndex = 0;
    gameState.nightKillTargetId = null; 
    gameState.nightSaves = [];
    
    assignNightLeaders();
    changeScreen('screen-night');
    nextNightPlayerFlow();
}

function assignNightLeaders() {
    let aliveMafias = gameState.players.filter(p => p.alive && p.role === 'Mafia');
    if (aliveMafias.length > 0) {
        let index = gameState.mafiaLeaderTurnIndex % aliveMafias.length;
        aliveMafias.forEach((m, idx) => m.hasNightPower = (idx === index));
    }
    
    let aliveDetectives = gameState.players.filter(p => p.alive && p.role === 'Detective');
    if (aliveDetectives.length > 0) {
        let index = gameState.detectiveLeaderTurnIndex % aliveDetectives.length;
        aliveDetectives.forEach((d, idx) => d.hasNightPower = (idx === index));
    }
}

function nextNightPlayerFlow() {
    while (gameState.currentNightPlayerIndex < gameState.players.length && !gameState.players[gameState.currentNightPlayerIndex].alive) {
        gameState.currentNightPlayerIndex++;
    }

    if (gameState.currentNightPlayerIndex >= gameState.players.length) {
        evaluateNightOutcome();
        return;
    }

    let currentPlayer = gameState.players[gameState.currentNightPlayerIndex];
    document.getElementById('night-player-name').innerText = currentPlayer.name;
    document.getElementById('night-pass-container').classList.remove('hidden');
    document.getElementById('night-action-wrapper').classList.add('hidden');
}

function revealNightAction() {
    document.getElementById('night-pass-container').classList.add('hidden');
    document.getElementById('night-action-wrapper').classList.remove('hidden');
    
    let currentPlayer = gameState.players[gameState.currentNightPlayerIndex];
    let title = document.getElementById('night-action-title');
    let container = document.getElementById('night-action-container');
    let teamBox = document.getElementById('team-reveal-box');
    
    container.innerHTML = '';
    teamBox.classList.add('hidden');
    tempSelectedTargetId = null;
    document.getElementById('btn-confirm-night').classList.add('hidden');

    if (currentPlayer.role === 'Mafia') {
        let teammates = gameState.players.filter(p => p.role === 'Mafia' && p.id !== currentPlayer.id).map(p => p.name);
        if (currentPlayer.hasNightPower) {
            title.innerText = "أنت قائد المافيا الليلة 🥷 - اختر ضحية لتصفيتها:";
            if (teammates.length > 0) {
                teamBox.innerText = `👥 رفقاء عصابتك المستورين: ${teammates.join(' ، ')} (ملاحظة: لا يمكنك استهدافهم)`;
                teamBox.classList.remove('hidden');
            }
            // بناء الأهداف مع حظر استهداف أي زميل مافيا بالكامل!
            buildNightTargetsGrid(container, false, true);
        } else {
            title.innerText = "أنت مافيا 🥷\nدور القتل الليلة يقع على عاتق زميلك الآخر بالترتيب. انتظر للتمويه ثم أكد.";
            if (teammates.length > 0) {
                teamBox.innerText = `👥 رفقاء عصابتك المستورين: ${teammates.join(' ، ')}`;
                teamBox.classList.remove('hidden');
            }
            document.getElementById('btn-confirm-night').classList.remove('hidden');
        }
    } else if (currentPlayer.role === 'Doctor') {
        title.innerText = "أنت طبيب المدينة 🩺 - اختر لاعباً لإنقاذه وحمايته:";
        buildNightTargetsGrid(container, true, false);  
    } else if (currentPlayer.role === 'Detective') {
        let teamDetectives = gameState.players.filter(p => p.role === 'Detective' && p.id !== currentPlayer.id).map(p => p.name);
        if (currentPlayer.hasNightPower) {
            title.innerText = "أنت المحقق الرئيسي الليلة 🔍 - اختر شخصاً لكشف هويته الحقيقية:";
            if (teamDetectives.length > 0) {
                teamBox.innerText = `🕵️ زملائك في جهاز التحقيق: ${teamDetectives.join(' ، ')}`;
                teamBox.classList.remove('hidden');
            }
            buildNightTargetsGrid(container, false, false);
        } else {
            title.innerText = "أنت محقق 🔍\nزميلك الآخر يقوم بالتحقيق الفردي الليلة بالترتيب. انتظر للتمويه.";
            if (teamDetectives.length > 0) {
                teamBox.innerText = `🕵️ زملائك في جهاز التحقيق: ${teamDetectives.join(' ، ')}`;
                teamBox.classList.remove('hidden');
            }
            document.getElementById('btn-confirm-night').classList.remove('hidden');
        }
    } else {
        title.innerText = "أنت مواطن صالح 👤\nالرجاء الانتظار قليلاً لتمويه المحيطين بك، ثم اضغط تأكيد.";
        document.getElementById('btn-confirm-night').classList.remove('hidden');
    }
}

// دالة المحاذاة والفرز الفردي للأهداف الليلية
function buildNightTargetsGrid(container, allowSelf, excludeMafiaTeam) {
    let currentP = gameState.players[gameState.currentNightPlayerIndex];
    gameState.players.forEach(p => {
        if (p.alive) {
            // التحقق من شرط عدم قتل النفس
            if (!allowSelf && p.id === currentP.id) return;
            
            // شرط مازن الصارم: حظر المافيا تماماً من تصفية أو رؤية خيار قتل أصدقائه المافيا
            if (excludeMafiaTeam && p.role === 'Mafia') return;

            let btn = document.createElement('button');
            btn.className = 'player-btn';
            btn.innerText = p.name;
            btn.onclick = () => {
                document.querySelectorAll('#night-action-container .player-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                tempSelectedTargetId = p.id;
                document.getElementById('btn-confirm-night').classList.remove('hidden');
            };
            container.appendChild(btn);
        }
    });
}

function confirmNightAction() {
    let currentPlayer = gameState.players[gameState.currentNightPlayerIndex];

    if (tempSelectedTargetId) {
        if (currentPlayer.role === 'Mafia' && currentPlayer.hasNightPower) {
            gameState.nightKillTargetId = tempSelectedTargetId;
            proceedToNextNightPlayer();
        } else if (currentPlayer.role === 'Doctor') {
            gameState.nightSaves.push(tempSelectedTargetId);
            proceedToNextNightPlayer();
        } else if (currentPlayer.role === 'Detective' && currentPlayer.hasNightPower) {
            let target = gameState.players.find(p => p.id === tempSelectedTargetId);
            showCustomModal(
                "كشف تحقيق سري 🔍", 
                `اللاعب المستهدف: <strong style="color:#f59e0b; font-size:1.2rem;">${target.name}</strong><br><br>الهوية السرية الفعلية له هي:<br><span style="font-size:1.3rem; font-weight:bold;">${translateRole(target.role)}</span>`, 
                "🔍", 
                "detective-style",
                () => { proceedToNextNightPlayer(); }
            );
        } else { proceedToNextNightPlayer(); }
    } else { proceedToNextNightPlayer(); }
}

function proceedToNextNightPlayer() {
    gameState.currentNightPlayerIndex++;
    saveToLocalStorage();
    nextNightPlayerFlow();
}

function evaluateNightOutcome() {
    let targetId = gameState.nightKillTargetId;
    let report = "";

    if (targetId) {
        if (gameState.nightSaves.includes(targetId)) {
            report = "حاول الأشرار تصفية أحد السكان في الليل، ولكن لحسن الحظ تدخل الأطباء وأنقذوا حياته في آخر لحظة! 🎉";
            gameState.historyLog.push(`الجولة ${gameState.currentRound} ليلاً: المافيا هاجمت لاعباً وتم إنقاذه من الطبيب.`);
        } else {
            let targetPlayer = gameState.players.find(p => p.id === targetId);
            targetPlayer.alive = false;
            report = `للاسف الغادر.. استيقظت المدينة على خبر مقتل اللاعب الفاضل: [ ${targetPlayer.name} ] 💀`;
            gameState.historyLog.push(`الجولة ${gameState.currentRound} ليلاً: تم اغتيال اللاعب ${targetPlayer.name}.`);
        }
    } else {
        report = "مرت الليلة بهدوء تام دون وقوع أي ضحايا في شتى أنحاء المدينة.";
        gameState.historyLog.push(`الجولة ${gameState.currentRound} ليلاً: مرت هادئة.`);
    }

    let aliveMafias = gameState.players.filter(p => p.alive && p.role === 'Mafia');
    if (aliveMafias.length > 0) gameState.mafiaLeaderTurnIndex++;
    
    let aliveDetectives = gameState.players.filter(p => p.alive && p.role === 'Detective');
    if (aliveDetectives.length > 0) gameState.detectiveLeaderTurnIndex++;

    saveToLocalStorage();
    if (checkWinConditions()) return;

    setupDayPhase(report);
}

function setupDayPhase(report) {
    gameState.phase = 'day';
    changeScreen('screen-day');
    document.getElementById('day-round-number').innerText = `الجولة النهارية: ${gameState.currentRound}`;
    document.getElementById('day-report-text').innerText = report;

    const list = document.getElementById('alive-players-list');
    list.innerHTML = '';
    gameState.players.forEach(p => {
        if (p.alive) {
            let item = document.createElement('div');
            item.className = 'player-btn';
            item.style.cursor = 'default';
            item.innerText = p.name;
            list.appendChild(item);
        }
    });
}

function startVotingPhase() {
    gameState.phase = 'voting';
    gameState.currentVoterIndex = 0;
    gameState.dayVotes = {};
    changeScreen('screen-voting');
    nextVoterFlow();
}

function nextVoterFlow() {
    while (gameState.currentVoterIndex < gameState.players.length && !gameState.players[gameState.currentVoterIndex].alive) {
        gameState.currentVoterIndex++;
    }

    if (gameState.currentVoterIndex >= gameState.players.length) {
        evaluateVotingOutcome();
        return;
    }

    let voter = gameState.players[gameState.currentVoterIndex];
    document.getElementById('voter-player-name').innerText = voter.name;
    document.getElementById('voting-pass-container').classList.remove('hidden');
    document.getElementById('voting-options-wrapper').classList.add('hidden');
}

function revealVotingOptions() {
    document.getElementById('voting-pass-container').classList.add('hidden');
    document.getElementById('voting-options-wrapper').classList.remove('hidden');

    let container = document.getElementById('voting-choices-container');
    container.innerHTML = '';
    tempSelectedTargetId = null;

    const confirmBtn = document.getElementById('btn-confirm-vote');
    confirmBtn.className = "btn btn-confirm disabled";
    confirmBtn.disabled = true;

    let voter = gameState.players[gameState.currentVoterIndex];
    gameState.players.forEach(p => {
        if (p.alive && p.id !== voter.id) {
            let btn = document.createElement('button');
            btn.className = 'player-btn';
            btn.innerText = p.name;
            btn.onclick = () => {
                document.querySelectorAll('#voting-choices-container .player-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                tempSelectedTargetId = p.id;
                
                confirmBtn.className = "btn btn-confirm";
                confirmBtn.disabled = false;
            };
            container.appendChild(btn);
        }
    });
}

function submitVote(isConfirmed) {
    if (isConfirmed && tempSelectedTargetId) {
        gameState.dayVotes[tempSelectedTargetId] = (gameState.dayVotes[tempSelectedTargetId] || 0) + 1;
    }
    gameState.currentVoterIndex++;
    saveToLocalStorage();
    nextVoterFlow();
}

function evaluateVotingOutcome() {
    let topTargetId = null;
    let maxVotes = 0;
    let isTie = false;

    for (let id in gameState.dayVotes) {
        let vCount = gameState.dayVotes[id];
        if (vCount > maxVotes) {
            maxVotes = vCount;
            topTargetId = parseInt(id);
            isTie = false;
        } else if (vCount === maxVotes) {
            isTie = true;
        }
    }

    if (topTargetId && !isTie) {
        let eliminatedPlayer = gameState.players.find(p => p.id === topTargetId);
        eliminatedPlayer.alive = false;
        
        gameState.historyLog.push(`الجولة ${gameState.currentRound} نهاراً: تم إقصاء ${eliminatedPlayer.name} كونه (${translateRole(eliminatedPlayer.role)}).`);
        saveToLocalStorage();

        showCustomModal(
            "قرار محكمة المدينة ⚖️", 
            `بأغلبية الأصوات الصريحة، تقرر إقصاء ونفي اللاعب الإشكالي:<br><strong style="color:#ef4444; font-size:1.3rem;">[ ${eliminatedPlayer.name} ]</strong><br><br>الهوية التي كان يخفيها هي:<br><strong>${translateRole(eliminatedPlayer.role)}</strong>`,
            "⚖️",
            "court-style",
            () => {
                if (checkWinConditions()) return;
                gameState.currentRound++;
                startNightPhase();
            }
        );
    } else {
        gameState.historyLog.push(`الجولة ${gameState.currentRound} نهاراً: انتهى التصويت بالتعادل.`);
        saveToLocalStorage();

        showCustomModal(
            "تعادل الأصوات ⚖️", 
            "انتهت الجلسة بالتعادل الأصم في أصوات المتهمين، أو بـأوراق بيضاء ممتنعة.. لم يتم طرد أحد في هذا النهار!",
            "⚖️",
            "court-style",
            () => {
                if (checkWinConditions()) return;
                gameState.currentRound++;
                startNightPhase();
            }
        );
    }
}

function showCustomModal(title, text, icon, styleClass, callback = null) {
    let modal = document.getElementById('game-modal');
    let card = document.getElementById('game-modal-card');
    
    document.getElementById('game-modal-title').innerText = title;
    document.getElementById('game-modal-text').innerHTML = text;
    document.getElementById('game-modal-icon').innerText = icon;
    
    card.className = "popup-card animate-pop " + styleClass;
    activeModalCallback = callback;
    
    modal.classList.remove('hidden');
}

function closeGameModal() {
    document.getElementById('game-modal').classList.add('hidden');
    if (activeModalCallback) {
        let cb = activeModalCallback;
        activeModalCallback = null;
        cb();
    }
}

function checkWinConditions() {
    let aliveMafia = gameState.players.filter(p => p.alive && p.role === 'Mafia').length;
    let aliveOthers = gameState.players.filter(p => p.alive && p.role !== 'Mafia').length;

    if (aliveMafia === 0) { showVictoryScreen('المواطنين والأخيار 🎉'); return true; }
    if (aliveMafia >= aliveOthers) { showVictoryScreen('عصابات المافيا والأشرار 🥷'); return true; }
    return false;
}

function showVictoryScreen(winner) {
    gameState.phase = 'victory';
    changeScreen('screen-victory');
    document.getElementById('victory-title').innerText = `الفوز والانتصار لـ ${winner}`;

    const logContainer = document.getElementById('history-log-container');
    logContainer.innerHTML = '';
    gameState.historyLog.forEach(log => {
        logContainer.innerHTML += `<p style="padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.1); font-size:0.95rem;">• ${log}</p>`;
    });

    localStorage.removeItem('mafia_party_v5_save');
    document.getElementById('btn-resume').classList.add('hidden');
}

function resetToHome() { document.getElementById('btn-resume').classList.add('hidden'); changeScreen('screen-home'); }

function translateRole(role) {
    switch(role) {
        case 'Mafia': return 'مافيا 🥷';
        case 'Citizen': return 'مواطن صالِح 👤';
        case 'Doctor': return 'طبيب المدينة 🩺';
        case 'Detective': return 'المحقق الذكي 🔍';
        default: return role;
    }
}

function getRoleDescription(role) {
    switch(role) {
        case 'Mafia': return 'هدفك التنسيق سراً لتصفية بقية اللاعبين دون كشف هويتك العدائية.';
        case 'Citizen': return 'أنت العين الساهرة، ناقش واكتشف الأشرار من لغة الجسد لتصوت ضد أقرب مشتبه به.';
        case 'Doctor': return 'تستيقظ سراً لإنقاذ شخص واحد قد يكون مستهدفاً للتصفية الليلية المباغتة.';
        case 'Detective': return 'تمتلك الصلاحية لكشف هوية لاعب واحد بالكامل في كل ليلة لتوجيه المحكمة بذكاء.';
        default: return '';
    }
}

function saveToLocalStorage() { localStorage.setItem('mafia_party_v5_save', JSON.stringify(gameState)); }
function checkSavedGame() { if (localStorage.getItem('mafia_party_v5_save')) { document.getElementById('btn-resume').classList.remove('hidden'); } }

function resumeGame() {
    let data = localStorage.getItem('mafia_party_v5_save');
    if (!data) return;
    gameState = JSON.parse(data);
    
    if (gameState.phase === 'reveal') setupRevealScreen();
    else if (gameState.phase === 'night') { changeScreen('screen-night'); nextNightPlayerFlow(); }
    else if (gameState.phase === 'day') setupDayPhase("تم استعادة مجريات الجولة النهارية.");
    else if (gameState.phase === 'voting') { changeScreen('screen-voting'); nextVoterFlow(); }
    else changeScreen('screen-home');
}
