// AGENT0 Game
const socket = io();

// Sound System
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.initAudio();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    async resumeAudio() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled || !this.audioContext) return;

        this.resumeAudio();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Sound effects
    cardReveal() {
        this.playTone(523, 0.3, 'sine', 0.2);
        setTimeout(() => this.playTone(659, 0.3, 'sine', 0.2), 100);
    }

    wrongGuess() {
        this.playTone(220, 0.4, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(196, 0.4, 'sawtooth', 0.3), 100);
        setTimeout(() => this.playTone(175, 0.4, 'sawtooth', 0.3), 100);
    }

    assassinHit() {
        this.playTone(440, 0.6, 'sawtooth', 0.4);
        setTimeout(() => this.playTone(349, 0.6, 'sawtooth', 0.4), 150);
        setTimeout(() => this.playTone(294, 0.6, 'sawtooth', 0.4), 150);
        setTimeout(() => this.playTone(220, 0.8, 'sawtooth', 0.4), 150);
    }

    clueGiven() {
        this.playTone(800, 0.15, 'sine', 0.2);
        setTimeout(() => this.playTone(1000, 0.15, 'sine', 0.2), 100);
        setTimeout(() => this.playTone(1200, 0.2, 'sine', 0.2), 200);
    }

    gameStart() {
        this.playTone(523, 0.2, 'sine', 0.25);
        setTimeout(() => this.playTone(659, 0.2, 'sine', 0.25), 150);
        setTimeout(() => this.playTone(784, 0.3, 'sine', 0.25), 300);
    }

    victory() {
        this.playTone(523, 0.3, 'triangle', 0.3);
        setTimeout(() => this.playTone(659, 0.3, 'triangle', 0.3), 200);
        setTimeout(() => this.playTone(784, 0.4, 'triangle', 0.3), 400);
        setTimeout(() => this.playTone(1047, 0.6, 'triangle', 0.3), 600);
    }

    timerWarning() {
        this.playTone(1000, 0.1, 'square', 0.2);
        setTimeout(() => this.playTone(1200, 0.1, 'square', 0.2), 200);
        setTimeout(() => this.playTone(1000, 0.1, 'square', 0.2), 400);
    }

    lightningStrike() {
        // Dramatic electricity sound
        this.playTone(400, 0.15, 'sawtooth', 0.5);
        setTimeout(() => this.playTone(1200, 0.2, 'sine', 0.6), 100);
        setTimeout(() => this.playTone(800, 0.1, 'sine', 0.4), 250);
        setTimeout(() => this.playTone(1500, 0.15, 'sine', 0.5), 350);
    }

    stormThunder() {
        // Deep thunder sound
        this.playTone(80, 0.4, 'sawtooth', 0.7);
        setTimeout(() => this.playTone(120, 0.3, 'sawtooth', 0.6), 200);
        setTimeout(() => this.playTone(100, 0.4, 'sine', 0.5), 500);
    }

    powerCardObtained() {
        // Magical sparkle sound for power card
        this.playTone(1200, 0.15, 'sine', 0.4);
        setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.5), 100);
        setTimeout(() => this.playTone(2000, 0.2, 'sine', 0.6), 200);
        setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.4), 350);
    }

    buttonClick() {
        this.playTone(400, 0.05, 'sine', 0.1);
    }

    emojiClick() {
        this.playTone(1200, 0.08, 'sine', 0.15);
        setTimeout(() => this.playTone(1400, 0.08, 'sine', 0.15), 80);
    }
}

const soundManager = new SoundManager();

// Global variables
let currentPlayer = null;
let currentRoom = null;
let currentBoard = null;
let selectedVoteCard = null;

// Power Cards Logic


// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');
}

// Transparency Mode
let isTransparencyMode = localStorage.getItem('transparencyMode') === 'true';

function toggleTransparency() {
    isTransparencyMode = !isTransparencyMode;
    localStorage.setItem('transparencyMode', isTransparencyMode);
    applyTransparencyMode();
}

function applyTransparencyMode() {
    const toggleBtn = document.getElementById('transparency-toggle');
    if (isTransparencyMode) {
        document.body.classList.add('transparent-mode');
        if (toggleBtn) toggleBtn.classList.add('active');
    } else {
        document.body.classList.remove('transparent-mode');
        if (toggleBtn) toggleBtn.classList.remove('active');
    }
}

// Initial application and ambient pointer glow
document.addEventListener('DOMContentLoaded', () => {
    applyTransparencyMode();

    const root = document.documentElement;
    window.addEventListener('mousemove', (e) => {
        root.style.setProperty('--mouse-x', `${e.clientX}px`);
        root.style.setProperty('--mouse-y', `${e.clientY}px`);
    });
});

// Login function
function login() {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();

    if (!username) {
        alert('Lütfen bir kullanıcı adı girin');
        return;
    }

    if (username.length < 2 || username.length > 15) {
        alert('Kullanıcı adı 2-15 karakter arasında olmalıdır');
        return;
    }

    // Emit login to server
    socket.emit('login', username);

    // Listen for login success
    socket.once('login-success', (data) => {
        console.log('Login success:', data);

        // Store current player info
        currentPlayer = {
            id: data.playerId,
            username: username,
            roomId: null,
            team: null,
            role: null
        };

        // Store current username
        localStorage.setItem('username', username);

        // Update User Display Name (Critical Fix for ID mismatch)
        const userDisplayElement = document.getElementById('user-display-name');
        if (userDisplayElement) {
            userDisplayElement.textContent = username;
        } else {
            console.warn('User display element not found!');
        }

        // Request rooms list immediately
        refreshRooms();

        // Show lobby screen
        // Show lobby screen
        showScreen('lobby-screen');
    });

    socket.once('error', (error) => {
        alert('Giriş hatası: ' + error);
    });
}

// Logout function
function logout() {
    localStorage.removeItem('username');
    location.reload();
}

// Refresh rooms list
function refreshRooms() {
    socket.emit('get-rooms');
}

// Socket event listeners
socket.on('rooms-list', (roomsList) => {
    const roomsContainer = document.getElementById('rooms-list');
    roomsContainer.innerHTML = '';

    if (roomsList.length === 0) {
        roomsContainer.innerHTML = '<p>Aktif oda bulunmuyor</p>';
        return;
    }

    roomsList.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <div class="room-info">
                <h4>${room.name}</h4>
                <p>Oyuncular: ${room.playerCount}/${room.maxPlayers}</p>
                <p>Durum: ${room.gameState === 'waiting' ? 'Bekleniyor' : room.gameState === 'playing' ? 'Oynanıyor' : 'Bitti'}</p>
            </div>
            <button class="btn btn-primary" onclick="joinRoom('${room.id}')">Katıl</button>
        `;
        roomsContainer.appendChild(roomElement);
    });
});

// Room state updates
socket.on('room-state', (room) => {
    currentRoom = room;
    updateRoomState(room);
});

// Create room
function createRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxPlayers = document.getElementById('max-players').value;
    const chaosMode = document.getElementById('chaos-mode').checked;
    const boardSize = document.getElementById('board-size').value;

    if (!roomName) {
        alert('Lütfen oda adı girin');
        return;
    }

    // If player is already in a room, leave it first
    if (currentRoom) {
        socket.emit('leave-room');
        currentRoom = null;
    }

    socket.emit('create-room', {
        name: roomName,
        maxPlayers: parseInt(maxPlayers),
        chaosMode: chaosMode,
        boardSize: parseInt(boardSize)
    });

    socket.once('room-created', (data) => {
        joinRoom(data.roomId);
    });

    socket.once('error', (error) => {
        alert('Oda oluşturma hatası: ' + error);
    });
}

// Join room
function joinRoom(roomId) {
    socket.emit('join-room', roomId);

    socket.once('room-joined', (data) => {
        // Persist room immediately so UI elements have players/roles
        currentRoom = data.room;
        showScreen('room-screen');
        updateRoomDisplay(data.room);
        updateRoomState(data.room);
    });

    socket.once('error', (error) => {
        alert('Odaya katılma hatası: ' + error);
    });
}

// Join by code
function joinByCode() {
    const inviteCode = document.getElementById('invite-code').value.trim().toUpperCase();

    if (!inviteCode) {
        alert('Lütfen davet kodu girin');
        return;
    }

    socket.emit('join-by-code', inviteCode);

    socket.once('room-found', (data) => {
        joinRoom(data.roomId);
    });

    socket.once('error', (error) => {
        alert('Davet kodu geçersiz: ' + error);
    });
}

// Leave room
function leaveRoom() {
    socket.emit('leave-room');
    showScreen('lobby-screen');
    refreshRooms();
}

// Update room display
function updateRoomDisplay(room) {
    document.getElementById('room-title').textContent = room.name || `Oda #${room.id}`;
    // HTML already says "Davet Kodu:", so just put the code here
    const code = room.id || room.roomId || '---';
    document.getElementById('invite-code-display').textContent = code;
    console.log("Room Code Updated:", code);
}

// Join team
function joinTeam(team, role) {
    socket.emit('join-team', { team, role });
}

// Add bot
function addBot(team, role) {
    socket.emit('add-bot', { team, role });
}

// Toggle bot management panel
function toggleBotManagement() {
    const botManagement = document.getElementById('bot-management');
    if (botManagement.classList.contains('hidden')) {
        botManagement.classList.remove('hidden');
    } else {
        botManagement.classList.add('hidden');
    }
}

// Remove bot
function removeBot(botId) {
    socket.emit('remove-bot', botId);
}

// Remove player from team
function removePlayer(playerId) {
    socket.emit('remove-player', playerId);
}

// Start game
function startGame() {
    socket.emit('start-game');

    socket.once('error', (error) => {
        alert('Oyun başlatma hatası: ' + error);
    });
}

// Role System
const roleDefinitions = {
    normal: {
        icon: '👤',
        title: 'Normal Oyuncu',
        description: 'Standart kurallara göre oynarsınız.',
        tips: 'Sırası gelmediği sürece tahmin yapmayın. Takım arkadaşlarınızla iletişimde kalın!'
    },
    chaotic_rush: {
        icon: '⚡',
        title: 'Çılgın Hız (Chaotic)',
        description: 'Sıranız 1 turu sadece 30 saniye dayanır!',
        tips: 'Hızlı kararlar alın ve çabuk tahmin edin. Dikkatli olun!'
    },
    chaotic_double: {
        icon: '🔄',
        title: 'Çift Güç (Chaotic)',
        description: 'Her tahmin 2 kez sayılır. Yanlış tahmin 2 kez ceza verir!',
        tips: 'Her tahmininde iki kez etki yaratırsınız. Çok dikkatli olun!'
    },
    chaotic_blind: {
        icon: '👁️‍🗨️',
        title: 'Kör Oyuncu (Chaotic)',
        description: 'Kart türlerini göremezsiniz. Sadece kelimeleri görebilirsiniz.',
        tips: 'Mantığınıza güvenin. Takım arkadaşlarınız size rehberlik edebilir.'
    },
    chaotic_wildcard: {
        icon: '🎲',
        title: 'Jokeri (Chaotic)',
        description: 'Her 3 tahmin sonra rassal bir kart açılır!',
        tips: 'Türlü şanslı olabilirsiniz. Plan yapın!'
    },
    chaotic_silent: {
        icon: '🤐',
        title: 'Sessiz (Chaotic)',
        description: 'Sırası gelmeden sohbet yapamaz, sadece cevap verebilirsiniz.',
        tips: 'Düşüncelerinizi yazıyla aktaramazsınız. Ama tepkileri kullanabilirsiniz! 😀'
    }
};

// Assign random role to player (80% normal, 20% chaotic)
function assignRandomRole() {
    const chaoticRoles = ['chaotic_rush', 'chaotic_double', 'chaotic_blind', 'chaotic_wildcard', 'chaotic_silent'];
    const randomChance = Math.random();

    if (randomChance < 0.8) {
        return 'normal';
    } else {
        const randomIndex = Math.floor(Math.random() * chaoticRoles.length);
        return chaoticRoles[randomIndex];
    }
}

// Show role modal
function showRoleModal(role) {
    const modal = document.getElementById('role-modal');
    const roleInfo = roleDefinitions[role] || roleDefinitions.normal;

    document.getElementById('role-icon').textContent = roleInfo.icon;
    document.getElementById('role-title').textContent = roleInfo.title;
    document.getElementById('role-description').textContent = roleInfo.description;
    document.getElementById('role-tips').textContent = '💡 ' + roleInfo.tips;

    if (modal) modal.classList.remove('hidden');

    // Store current player's role
    if (currentPlayer) {
        currentPlayer.role = role;
    }
}

// Close role modal
function closeRoleModal() {
    const modal = document.getElementById('role-modal');
    if (modal) modal.classList.add('hidden');
}

// Game started event
socket.on('game-started', (data) => {
    currentBoard = data.board;

    if (currentRoom) {
        currentRoom.currentTurn = data.currentTurn;
        currentRoom.gameState = 'playing';
        currentRoom.board = data.board;
        currentRoom.clue = null;
    }

    // Hide team selection, show game phase
    const teamSelectionPhase = document.getElementById('team-selection-phase');
    const gamePhase = document.getElementById('game-phase');

    if (teamSelectionPhase) teamSelectionPhase.classList.add('hidden');
    if (gamePhase) gamePhase.classList.remove('hidden');

    // Render game elements
    renderBoard(currentBoard);
    updateScores(currentBoard);
    updateTurnInfo(data.currentTurn);
    showPlayerPanels();

    if (currentRoom) {
        updateGameTeamMembers(currentRoom);
        updateScoreBoardPlayers(currentRoom);
    }

    // Show role assignment
    const assignedRole = assignRandomRole();
    showRoleModal(assignedRole);

    soundManager.gameStart();
});

// Card revealed event
socket.on('card-revealed', (data) => {
    if (currentBoard && currentBoard[data.index]) {
        currentBoard[data.index] = data.card;
    }

    const cardElement = document.querySelector(`.card[data-index="${data.index}"]`);
    if (cardElement) {
        cardElement.classList.remove('selected', 'animating');
        cardElement.classList.add('revealed', data.card.type.toLowerCase());
        cardElement.onclick = null;
        cardElement.style.cursor = 'not-allowed';
        cardElement.style.opacity = '1';
    }

    if (currentBoard) {
        updateScores(currentBoard);
    }

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo) {
        guessesInfo.textContent = `Kalan tahmin: ${data.guessesLeft}`;
    }

    soundManager.cardReveal();
});

// Turn switched event
socket.on('turn-switched', (data) => {
    if (currentRoom) {
        currentRoom.currentTurn = data.currentTurn;
        currentRoom.clue = null;
    }
    updateTurnInfo(data.currentTurn);
    showPlayerPanels();

    const clueInfo = document.getElementById('clue-info');
    if (clueInfo) clueInfo.textContent = '';

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo) guessesInfo.textContent = '';

    // Re-render board to update click handlers
    if (currentBoard) {
        renderBoard(currentBoard);
    }
});

// Clue given event
socket.on('clue-given', (data) => {
    if (currentRoom) {
        currentRoom.clue = data.clue;
    }

    const clueInfo = document.getElementById('clue-info');
    if (clueInfo) {
        clueInfo.textContent = `${data.clue.spymaster}: ${data.clue.word} ${data.clue.number}`;
    }

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo) {
        guessesInfo.textContent = `Kalan tahmin: ${data.clue.number + 1}`;
    }

    // Re-render board so cards become clickable for operatives
    if (currentBoard) {
        renderBoard(currentBoard);
    }

    // Show operative controls
    showPlayerPanels();

    soundManager.clueGiven();
});

// Update room state display
function updateRoomState(room) {
    if (currentPlayer && room.players && room.players[currentPlayer.id]) {
        currentPlayer = room.players[currentPlayer.id];
    }

    const botList = document.getElementById('bot-list');
    if (botList) {
        botList.innerHTML = '';

        const bots = Object.values(room.bots || {});
        if (bots.length > 0) {
            bots.forEach(bot => {
                const botItem = document.createElement('div');
                botItem.className = 'bot-item';
                botItem.innerHTML = `
                    <div class="bot-info">${bot.team === 'RED' ? '🔴' : '🔵'} ${bot.role === 'SPYMASTER' ? 'Casusbaşı' : 'Operatif'} Bot</div>
                    <button class="remove-btn" onclick="removeBot('${bot.id}')">Kaldır</button>
                `;
                botList.appendChild(botItem);
            });
        } else {
            botList.innerHTML = '<p>Henüz bot eklenmemiş</p>';
        }
    }

    updateTeamDisplays(room);
    updateScoreBoardPlayers(room);

    // If game is playing, show game phase
    if (room.gameState === 'playing' && room.board) {
        const teamSelectionPhase = document.getElementById('team-selection-phase');
        const gamePhase = document.getElementById('game-phase');

        if (teamSelectionPhase) teamSelectionPhase.classList.add('hidden');
        if (gamePhase) gamePhase.classList.remove('hidden');

        // Show Role Modal if just started (simplistic check: if not already visible/handled)
        // Ideally we track state change. For now, let's call it and the user can close it.
        // To avoid spamming, we can check a global flag 'gameStartedModalShown'
        if (!window.gameStartedModalShown && currentPlayer && currentPlayer.role) {
            window.gameStartedModalShown = true;
            const isRed = currentPlayer.team === 'RED';
            const teamName = isRed ? 'Kırmızı Takım' : 'Mavi Takım';
            const teamColor = isRed ? '#ef4444' : '#3b82f6';
            const roleName = currentPlayer.role === 'SPYMASTER' ? 'Casusbaşı 🕵️' : 'Operatif 🔫';

            showRoleModal(
                'Oyun Başladı!',
                `Takımınız: <strong style="color:${teamColor}">${teamName}</strong><br>Rolünüz: <strong>${roleName}</strong>`,
                currentPlayer.role === 'SPYMASTER' ? '😎' : '🔫'
            );
        }

        currentBoard = room.board;
        renderBoard(currentBoard);
        updateScores(currentBoard);
        updateTurnInfo(room.currentTurn);
        showPlayerPanels();
        updateGameTeamMembers(room);
        updateScoreBoardPlayers(room);

        if (room.clue) {
            const clueInfo = document.getElementById('clue-info');
            if (clueInfo) {
                clueInfo.textContent = `🎯 ${room.clue.spymaster}: ${room.clue.word} ${room.clue.number}`;
            }
            const guessesInfo = document.getElementById('guesses-info');
            if (guessesInfo) {
                guessesInfo.textContent = `Kalan tahmin: ${room.guessesLeft}`;
            }
        } else {
            const clueInfo = document.getElementById('clue-info');
            if (clueInfo) clueInfo.textContent = 'İpucu bekleniyor...';
            const guessesInfo = document.getElementById('guesses-info');
            if (guessesInfo) guessesInfo.textContent = '';
        }
    }
}

// Populate the new Scoreboard Header Boxes
function updateScoreBoardPlayers(room) {
    const players = Object.values(room.players || {});
    const bots = Object.values(room.bots || {});
    const all = [...players, ...bots];

    function getNames(team, role) {
        return all
            .filter(p => p.team === team && p.role === role)
            .map(p => p.username || (p.isBot ? 'Bot' : 'Unknown'))
            .join(', ') || '-';
    }

    const setContent = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text.length > 20 ? text.substring(0, 20) + '...' : text;
    };

    setContent('scoreboard-red-spymaster', getNames('RED', 'SPYMASTER'));
    setContent('scoreboard-red-operatives', getNames('RED', 'OPERATIVE'));
    setContent('scoreboard-blue-spymaster', getNames('BLUE', 'SPYMASTER'));
    setContent('scoreboard-blue-operatives', getNames('BLUE', 'OPERATIVE'));
}

// Update team displays
function updateTeamDisplays(room) {
    ['red-spymaster', 'red-operatives', 'blue-spymaster', 'blue-operatives'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    const players = Object.values(room.players || {});
    players.forEach(player => {
        const slotId = `${player.team.toLowerCase()}-${player.role === 'SPYMASTER' ? 'spymaster' : 'operatives'}`;
        const slot = document.getElementById(slotId);
        if (slot) {
            const badge = document.createElement('div');
            // Enhanced player badge classes
            let badgeClass = 'player-badge';
            if (player.team === 'RED') badgeClass += ' red';
            else if (player.team === 'BLUE') badgeClass += ' blue';
            else badgeClass += ' spectator';

            if (player.isBot) badgeClass += ' bot';
            if (player.username === localStorage.getItem('username')) badgeClass += ' you';

            badge.className = badgeClass;
            badge.innerHTML = `<span>${player.username}</span>`;

            // Only show remove option if I am the one viewing (logic can be improved for admin)
            // For now, keep simple click to remove self or others if needed
            badge.setAttribute('onclick', `removePlayer('${player.id}')`);
            slot.appendChild(badge);
        }
    });

    const bots = Object.values(room.bots || {});
    bots.forEach(bot => {
        const slotId = `${bot.team.toLowerCase()}-${bot.role === 'SPYMASTER' ? 'spymaster' : 'operatives'}`;
        const slot = document.getElementById(slotId);
        if (slot) {
            const badge = document.createElement('div');
            badge.className = 'player-badge bot';
            badge.textContent = `${bot.role === 'SPYMASTER' ? 'Casusbaşı' : 'Operatif'} Bot`;
            badge.setAttribute('onclick', `removeBot('${bot.id}')`);
            slot.appendChild(badge);
        }
    });

    // Rest of updateTeamDisplays logic


    const redSpymaster = players.find(p => p.team === 'RED' && p.role === 'SPYMASTER') || bots.find(b => b.team === 'RED' && b.role === 'SPYMASTER');
    const blueSpymaster = players.find(p => p.team === 'BLUE' && p.role === 'SPYMASTER') || bots.find(b => b.team === 'BLUE' && b.role === 'SPYMASTER');
    const redOperatives = [...players.filter(p => p.team === 'RED' && p.role === 'OPERATIVE'), ...bots.filter(b => b.team === 'RED' && b.role === 'OPERATIVE')];
    const blueOperatives = [...players.filter(p => p.team === 'BLUE' && p.role === 'OPERATIVE'), ...bots.filter(b => b.team === 'BLUE' && b.role === 'OPERATIVE')];

    const canStartGame = redSpymaster && blueSpymaster && redOperatives.length > 0 && blueOperatives.length > 0;

    const startBtn = document.getElementById('start-game-btn');
    const readyStatus = document.getElementById('ready-status');

    if (canStartGame) {
        startBtn.disabled = false;
        readyStatus.textContent = 'Oyun başlatılmaya hazır!';
    } else {
        startBtn.disabled = true;
        readyStatus.textContent = 'Her takımda en az bir casusbaşı ve bir operatif olmalı';
    }
}

// Update game team members
function updateGameTeamMembers(room) {
    const redMembers = document.getElementById('game-red-members');
    const blueMembers = document.getElementById('game-blue-members');

    if (!redMembers || !blueMembers) return;

    redMembers.innerHTML = '';
    blueMembers.innerHTML = '';

    const players = Object.values(room.players || {});
    players.forEach(player => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'team-member';
        const roleText = player.role === 'SPYMASTER' ? ' (Casusbaşı)' : ' (Operatif)';
        memberDiv.textContent = player.username + roleText;
        if (player.team === 'RED') {
            redMembers.appendChild(memberDiv);
        } else if (player.team === 'BLUE') {
            blueMembers.appendChild(memberDiv);
        }
    });

    const bots = Object.values(room.bots || {});
    bots.forEach(bot => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'team-member bot';
        const roleText = bot.role === 'SPYMASTER' ? 'Casusbaşı Bot' : 'Operatif Bot';
        memberDiv.textContent = roleText;
        if (bot.team === 'RED') {
            redMembers.appendChild(memberDiv);
        } else if (bot.team === 'BLUE') {
            blueMembers.appendChild(memberDiv);
        }
    });
}

// Update score board team players
function updateScoreBoardPlayers(room) {
    const redAbove = document.querySelector('#game-phase .score-board .team-group:first-child .team-players-above');
    const blueAbove = document.querySelector('#game-phase .score-board .team-group:last-child .team-players-above');

    if (redAbove) redAbove.innerHTML = '';
    if (blueAbove) blueAbove.innerHTML = '';

    const players = Object.values(room.players || {});
    players.forEach(player => {
        const badge = document.createElement('div');
        badge.className = `player-badge ${player.isBot ? 'bot' : ''} ${player.username === localStorage.getItem('username') ? 'you' : ''}`;
        badge.textContent = player.username;
        if (player.team === 'RED' && redAbove) {
            redAbove.appendChild(badge);
        } else if (player.team === 'BLUE' && blueAbove) {
            blueAbove.appendChild(badge);
        }
    });

    const bots = Object.values(room.bots || {});
    bots.forEach(bot => {
        const badge = document.createElement('div');
        badge.className = 'player-badge bot';
        badge.textContent = bot.username;
        if (bot.team === 'RED' && redAbove) {
            redAbove.appendChild(badge);
        } else if (bot.team === 'BLUE' && blueAbove) {
            blueAbove.appendChild(badge);
        }
    });
}

// Update turn info
function updateTurnInfo(currentTurn) {
    const turnInfo = document.getElementById('turn-info');
    const isRed = currentTurn === 'RED';
    turnInfo.textContent = `Sıra: ${isRed ? 'KIRMIZI' : 'MAVİ'} TAKIM`;

    // Reset classes and add specific color
    turnInfo.className = 'current-turn-badge';
    turnInfo.style.backgroundColor = isRed ? '#fee2e2' : '#dbeafe';
    turnInfo.style.color = isRed ? '#dc2626' : '#2563eb';
    turnInfo.style.borderColor = isRed ? '#ef4444' : '#3b82f6';
}

// Setup board interactions (Simplified & Robust)
function setupBoardInteractions() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;

    // Use event delegation properly
    boardElement.onclick = (e) => {
        // Find closest card element if clicked on icon/text inside
        const card = e.target.closest('.card');

        // Ensure we clicked a card and it has an index
        if (card && card.dataset.index !== undefined) {
            e.preventDefault(); // Stop default behaviors
            const index = parseInt(card.dataset.index);

            if (currentRoom && currentRoom.gameState === 'playing') {
                handleCardClick(index);
            }
        }
    };
}

// Handle card click (Clean Logic - No Layout Shifting Overlays)
function handleCardClick(index) {
    if (!currentRoom || !currentPlayer) return;

    const cardElement = document.querySelector(`.card[data-index="${index}"]`);
    if (!cardElement || cardElement.classList.contains('revealed')) return;

    // 1. Validation
    const isSpymaster = currentPlayer.role === 'SPYMASTER';
    const isMyTurn = currentRoom.currentTurn === currentPlayer.team;

    // Strict feedback
    if (isSpymaster) {
        // Optional: Shake animation for "No"
        cardElement.style.animation = 'shake 0.4s ease-in-out';
        setTimeout(() => cardElement.style.animation = '', 400);
        return;
    }

    if (!isMyTurn && !currentRoom.chaosMode) {
        // Not your turn
        return;
    }

    // 2. Interaction
    // User complained about "kayma" (sliding). This means the overly complex DOM overlay 
    // likely disrupted the Grid layout or Flexbox.
    // We will use a standard "Are you sure?" browser confirm OR a non-intrusive floating confirm.
    // Given the request for "smoothness", let's try a direct socket emit BUT with a safety check IF preferred.
    // However, the user LIKED the "Initials + Check" idea CONCEPTUALLY but said implementation was buggy.
    // "kartlari acma yeri bozuk... ona basinca acsin ama simdi layoutlar kayiyor".
    // FIX: The overlay must be ABSOLUTE and NOT affect flow.

    // Check if THIS card is already the "selected" one awaiting confirmation
    const isSelected = cardElement.classList.contains('pending-selection');

    // Deselect all others first to prevent multiple selections
    document.querySelectorAll('.card.pending-selection').forEach(c => {
        c.classList.remove('pending-selection');
        // Remove the overlay if it exists
        const existingOverlay = c.querySelector('.safe-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        // Restore original content if it was modified (though this new approach doesn't modify it directly)
        if (c.dataset.originalContent) {
            c.innerHTML = c.dataset.originalContent;
            delete c.dataset.originalContent; // Clean up
        }
    });

    if (!isSelected) {
        // First Click: SELECT IT visually only (No structural DOM change that shifts layout)
        cardElement.classList.add('pending-selection');

        // Store original content to restore later (if needed, though this approach doesn't modify innerHTML directly)
        if (!cardElement.dataset.originalContent) {
            cardElement.dataset.originalContent = cardElement.innerHTML;
        }

        // Add Overlay purely as Absolute Positioned element (Safe for Layout)
        const overlay = document.createElement('div');
        overlay.className = 'safe-overlay';
        overlay.innerHTML = `
            <div class="overlay-initials">${(currentPlayer.username || 'U')[0].toUpperCase()}</div>
            <button class="overlay-confirm-btn">✅</button>
        `;

        // Stop propagation on the button immediately
        const btn = overlay.querySelector('.overlay-confirm-btn');
        btn.onclick = (ev) => {
            ev.stopPropagation(); // Prevent bubbling to card
            socket.emit('card-clicked', { roomId: currentRoom.id, cardIndex: index });
            // Cleanup handled by socket event -> reveal
            // For immediate visual feedback, remove overlay and pending-selection here too
            overlay.remove();
            cardElement.classList.remove('pending-selection');
            if (cardElement.dataset.originalContent) {
                cardElement.innerHTML = cardElement.dataset.originalContent;
                delete cardElement.dataset.originalContent;
            }
        };

        cardElement.appendChild(overlay);

    } else {
        // Second Click on same card (clicking outside button but on card): 
        // Could be Cancel or Confirm. Let's make it Cancel to be safe.
        cardElement.classList.remove('pending-selection');
        const existingOverlay = cardElement.querySelector('.safe-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        if (cardElement.dataset.originalContent) {
            cardElement.innerHTML = cardElement.dataset.originalContent;
            delete cardElement.dataset.originalContent;
        }
    }
}

// Render the game board
function renderBoard(board) {
    const gameBoard = document.getElementById('game-board');
    if (!gameBoard) return;

    gameBoard.innerHTML = '';

    if (!board || board.length === 0) {
        console.error('Board is empty or invalid');
        return;
    }

    // Set grid columns based on board size
    if (board.length === 25) {
        gameBoard.style.gridTemplateColumns = 'repeat(5, 1fr)';
        gameBoard.style.maxWidth = '600px';
    } else if (board.length === 36) {
        gameBoard.style.gridTemplateColumns = 'repeat(6, 1fr)';
        gameBoard.style.maxWidth = '720px';
    }

    board.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.textContent = card.word;
        cardElement.setAttribute('data-index', index);
        cardElement.setAttribute('data-type', card.type);

        if (card.revealed) {
            cardElement.classList.add('revealed', card.type.toLowerCase());
            cardElement.style.cursor = 'not-allowed';
            cardElement.onclick = null;
        } else {
            // Spymaster can see card types
            if (currentPlayer && currentPlayer.role === 'SPYMASTER') {
                cardElement.classList.add('spymaster-view', card.type.toLowerCase());
            }

            // Only operative from current team with clue can click
            const canClick = currentPlayer &&
                currentRoom &&
                currentPlayer.team === currentRoom.currentTurn &&
                currentPlayer.role === 'OPERATIVE' &&
                currentRoom.clue;

            if (canClick) {
                cardElement.style.cursor = 'pointer';
                cardElement.style.opacity = '1';
                cardElement.onclick = () => showCardOverlay(index);
            } else {
                cardElement.style.cursor = 'not-allowed';
                cardElement.style.opacity = '0.7';
            }
        }

        gameBoard.appendChild(cardElement);
    });
}

// Show card overlay
function showCardOverlay(index) {
    const cardElement = document.querySelector(`.card[data-index="${index}"]`);
    if (!cardElement || cardElement.classList.contains('revealed')) return;

    const canClick = currentPlayer && currentRoom && currentPlayer.team === currentRoom.currentTurn && currentPlayer.role === 'OPERATIVE';
    if (!canClick) return;

    // If card is already selected, deselect it
    if (cardElement.classList.contains('selected')) {
        cardElement.classList.remove('selected');
        const cardNameElement = cardElement.querySelector('.card-name-display');
        if (cardNameElement) cardNameElement.remove();
        const checkElement = cardElement.querySelector('.reveal-btn');
        if (checkElement) checkElement.remove();
        return;
    }

    // Select the card
    cardElement.classList.add('selected');

    // Create or update name display
    let cardNameElement = cardElement.querySelector('.card-name-display');
    if (!cardNameElement) {
        cardNameElement = document.createElement('div');
        cardNameElement.className = 'card-name-display';
        cardElement.appendChild(cardNameElement);
    }

    // Show only current player's initial
    cardNameElement.innerHTML = `<span class="initial">${currentPlayer.username.charAt(0).toUpperCase()}</span>`;

    socket.emit('card-clicked', index);

    // Create reveal button
    let checkElement = cardElement.querySelector('.reveal-btn');
    if (!checkElement) {
        checkElement = document.createElement('button');
        checkElement.className = 'reveal-btn';
        checkElement.innerHTML = '✓';
        checkElement.onclick = (e) => {
            e.stopPropagation();
            cardElement.classList.add('animating');
            revealCard(index);
            cardNameElement.remove();
            checkElement.remove();
            cardElement.classList.remove('selected');
        };
        cardElement.appendChild(checkElement);
    }

    // Handle click outside - Improved for accuracy
    const removeOverlay = (e) => {
        // Check if click is outside the card AND outside the reveal button
        // Use composedPath to handle shadow DOM or complex nesting if needed, though simple contains check usually suffices
        if (!cardElement.contains(e.target)) {
            if (cardElement.classList.contains('selected')) {
                // If we clicked another card, don't remove immediately to allow the other card to select
                // But here we just clean up this specific overlay
                const checkElement = cardElement.querySelector('.reveal-btn');
                const cardNameElement = cardElement.querySelector('.card-name-display');
                if (checkElement) checkElement.remove();
                if (cardNameElement) cardNameElement.remove();
                cardElement.classList.remove('selected');
            }
            document.removeEventListener('click', removeOverlay);
            document.removeEventListener('touchstart', removeOverlay);
        }
    };

    // Use slightly longer timeout to prevent immediate trigger from the same click event bubbling
    setTimeout(() => {
        document.addEventListener('click', removeOverlay);
        document.addEventListener('touchstart', removeOverlay);
    }, 50);
}

// Update scores
function updateScores(board) {
    const redCards = board.filter(card => card.type === 'RED').length;
    const blueCards = board.filter(card => card.type === 'BLUE').length;
    const redRevealed = board.filter(card => card.revealed && card.type === 'RED').length;
    const blueRevealed = board.filter(card => card.revealed && card.type === 'BLUE').length;

    document.getElementById('red-score').textContent = redCards - redRevealed;
    document.getElementById('blue-score').textContent = blueCards - blueRevealed;
}

// Update turn info
function updateTurnInfo(currentTurn) {
    const turnInfo = document.getElementById('turn-info');
    turnInfo.textContent = `Sıra: ${currentTurn === 'RED' ? 'KIRMIZI' : 'MAVI'} TAKIM`;
    turnInfo.className = `turn-info ${currentTurn.toLowerCase()}`;
}

// Show player panels
function showPlayerPanels() {
    if (!currentPlayer || !currentRoom) return;

    const isSpymaster = currentPlayer.role === 'SPYMASTER';
    const isCurrentTeam = currentPlayer.team === currentRoom.currentTurn;

    const spymasterPanel = document.getElementById('spymaster-panel');
    const operativeControls = document.getElementById('operative-controls');

    if (spymasterPanel) {
        if (isSpymaster && isCurrentTeam) {
            spymasterPanel.classList.remove('hidden');
        } else {
            spymasterPanel.classList.add('hidden');
        }
    }

    if (operativeControls) {
        if (!isSpymaster && isCurrentTeam && currentRoom.clue) {
            operativeControls.classList.remove('hidden');
        } else {
            operativeControls.classList.add('hidden');
        }
    }
}

// Give clue
function giveClue() {
    const wordInput = document.getElementById('clue-word');
    const numberInput = document.getElementById('clue-number');

    const word = wordInput.value.trim().toUpperCase();
    const number = parseInt(numberInput.value);

    if (!word || number < 0 || number > 9) {
        alert('Geçerli bir ipucu girin');
        return;
    }

    socket.emit('give-clue', { word, number });

    wordInput.value = '';
    numberInput.value = '1';

    socket.once('error', (error) => {
        alert('İpucu hatası: ' + error);
    });
}

// Reveal card
function revealCard(index) {
    socket.emit('reveal-card', index);

    socket.once('error', (error) => {
        alert('Kart açma hatası: ' + error);
    });
}

// End turn
function endTurn() {
    socket.emit('end-turn');

    socket.once('error', (error) => {
        alert('Tur bitirme hatası: ' + error);
    });
}

// Chat functions
function sendGameMessage() {
    const input = document.getElementById('game-chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Handle debug commands
    if (message.startsWith('/randomevent ')) {
        const eventType = message.substring(13).trim().toLowerCase();
        if (eventType === 'lightning' || eventType === 'storm') {
            socket.emit('debug-random-event', { eventType });
            input.value = '';
            return;
        }
    }

    // Check for /p prefix for team message
    const isTeamMessage = message.startsWith('/p ');
    const actualMessage = isTeamMessage ? message.substring(3).trim() : message;

    if (!actualMessage) {
        alert('Lütfen bir mesaj yazın');
        return;
    }

    socket.emit('send-message', {
        message: actualMessage,
        isTeamMessage: isTeamMessage
    });

    input.value = '';
    input.placeholder = isTeamMessage
        ? 'Takım mesajı (/p takım mesajı için)'
        : 'Mesaj yazın (/p takım mesajı için)';
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

// Send emoji reaction
function sendEmojiReaction(emoji) {
    const container = document.getElementById('emoji-reactions');
    if (!container) return;

    // Play emoji sound
    soundManager.emojiClick();

    // Create emoji reaction element
    const emojiReaction = document.createElement('div');
    emojiReaction.className = 'emoji-reaction';
    emojiReaction.textContent = emoji;

    // Random position on screen
    const randomX = Math.random() * (window.innerWidth - 100);
    const randomY = Math.random() * (window.innerHeight - 100);

    emojiReaction.style.left = randomX + 'px';
    emojiReaction.style.top = randomY + 'px';

    container.appendChild(emojiReaction);

    // Remove after animation
    setTimeout(() => {
        emojiReaction.remove();
    }, 2000);

    // Close picker
    const picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.add('hidden');
}

// Socket chat event
socket.on('message', (data) => {
    const messagesContainer = document.getElementById('game-chat-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    const messageClass = (data.isTeamMessage && data.team) ? `team team-${data.team.toLowerCase()}` : 'general';
    messageElement.className = `game-chat-message ${messageClass}`;

    const timestamp = new Date(data.timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Create message with team indicator
    let teamIndicator = '';
    if (data.isTeamMessage && data.team) {
        teamIndicator = data.team === 'RED' ? '🔴' : '🔵';
    }

    messageElement.setAttribute('data-timestamp', data.timestamp);
    messageElement.innerHTML = `
        <span class="player">${teamIndicator} ${data.player}:</span>
        <span class="text">${data.message}</span>
        <span class="timestamp">${timestamp}</span>
    `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Card clicked event
socket.on('card-clicked', (data) => {
    const cardElement = document.querySelector(`.card[data-index="${data.index}"]`);
    if (cardElement) {
        let nameDisplay = cardElement.querySelector('.card-name-display');
        if (!nameDisplay) {
            nameDisplay = document.createElement('div');
            nameDisplay.className = 'card-name-display';
            cardElement.appendChild(nameDisplay);
        }
        const existingInitials = nameDisplay.querySelectorAll('.initial');
        const hasInitial = Array.from(existingInitials).some(span => span.textContent === data.player.charAt(0).toUpperCase());
        if (!hasInitial) {
            nameDisplay.innerHTML += ` <span class="initial">${data.player.charAt(0).toUpperCase()}</span>`;
        }
    }
});

// Board updated
socket.on('board-updated', (data) => {
    currentBoard = data.board;
    renderBoard(currentBoard);
    updateScores(currentBoard);
});

// Power card used
socket.on('power-card-used', (data) => {
    alert(data.player + " " + data.card + " kullandı!");
});

// Game finished
socket.on('game-finished', (data) => {
    const gameOverElement = document.getElementById('game-over');
    const gamePhaseElement = document.getElementById('game-phase');
    const winnerTextElement = document.getElementById('winner-text');

    // Play victory sound
    soundManager.victory();

    if (winnerTextElement) {
        const winnerText = data.winner === 'RED' ? '🔴 Kırmızı Takım Kazandı!' : '🔵 Mavi Takım Kazandı!';
        winnerTextElement.textContent = winnerText;
    }

    // DON'T hide game phase - keep board visible
    // Make game over appear as overlay
    if (gameOverElement) {
        gameOverElement.classList.remove('hidden');
        gameOverElement.style.position = 'fixed';
        gameOverElement.style.top = '0';
        gameOverElement.style.left = '0';
        gameOverElement.style.width = '100%';
        gameOverElement.style.height = '100%';
        gameOverElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        gameOverElement.style.display = 'flex';
        gameOverElement.style.alignItems = 'center';
        gameOverElement.style.justifyContent = 'center';
        gameOverElement.style.zIndex = '10000';
        // Also show alert for user awareness
        setTimeout(() => {
            const alertMsg = data.winner === 'RED'
                ? '🎉 Kırmızı Takım Kazandı! Tebrikler!'
                : '🎉 Mavi Takım Kazandı! Tebrikler!';
            // The modal is shown, so we don't need alert but we ensure visibility
            console.log('Game finished:', alertMsg);
        }, 100);
    }
});

// New game
function newGame() {
    socket.emit('restart-game');
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
        gameOverElement.classList.add('hidden');
    }
}

// Back to team selection
function backToTeamSelection() {
    const gameOverElement = document.getElementById('game-over');
    const gamePhaseElement = document.getElementById('game-phase');
    const teamSelectionPhase = document.getElementById('team-selection-phase');

    if (gameOverElement) gameOverElement.classList.add('hidden');
    if (gamePhaseElement) gamePhaseElement.classList.add('hidden');
    if (teamSelectionPhase) teamSelectionPhase.classList.remove('hidden');

    currentBoard = null;
    if (currentRoom) {
        currentRoom.clue = null;
        currentRoom.gameState = 'waiting';
    }
}

// Toggle power cards modal
function togglePowerCardsModal() {
    const modal = document.getElementById('power-cards-modal');
    if (!modal) return;

    modal.classList.toggle('hidden');

    if (!modal.classList.contains('hidden')) {
        // Populate power cards when opening modal
        const container = document.getElementById('power-cards-display');
        if (container && currentRoom && currentPlayer) {
            container.innerHTML = '';

            const playerTeam = currentPlayer.team;
            const playerCards = playerTeam === 'RED' ?
                (currentRoom.redPowerCards || []) :
                (currentRoom.bluePowerCards || []);

            if (playerCards.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">Henüz güç kartı yok</p>';
                return;
            }

            playerCards.forEach((card, index) => {
                const cardElement = document.createElement('div');
                cardElement.className = 'power-card-item';
                cardElement.style.cssText = `
                    padding: 15px;
                    margin: 10px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
                    border: 2px solid var(--primary);
                    cursor: pointer;
                    transition: all 0.3s;
                `;

                const cardIcon = getCardIcon(card.id);
                const bonusIndicator = card.isBonus ? '⭐ ' : '';
                const cardDetails = getCardDetails(card.id);

                cardElement.innerHTML = `
                    <div style="font-size: 2em; margin-bottom: 10px; text-align: center;">${cardIcon}</div>
                    <strong>${bonusIndicator}${card.name}</strong>
                    <p style="margin-top: 8px; font-size: 0.85em; color: #666; line-height: 1.4;">${card.description}</p>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 0.8em; color: #888;">
                        <strong>Detay:</strong> ${cardDetails}
                    </div>
                `;

                cardElement.addEventListener('click', () => {
                    usePowerCard(card, index, playerTeam);
                });

                cardElement.addEventListener('mouseover', () => {
                    cardElement.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4))';
                    cardElement.style.transform = 'scale(1.05)';
                });

                cardElement.addEventListener('mouseout', () => {
                    cardElement.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))';
                    cardElement.style.transform = 'scale(1)';
                });

                container.appendChild(cardElement);
            });
        }
    }
}

// Toggle ultimate modal
function toggleUltimateModal() {
    const modal = document.getElementById('ultimate-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
}

// Get card icon
function getCardIcon(cardId) {
    const icons = {
        'extra_guess': '✨',
        'peek_card': '👁️',
        'block_opponent': '🛡️',
        'swap_cards': '🔄',
        'reveal_hint': '💡',
        'bomb_card': '💥',
        'echo_card': '🎧',
        'swap_card': '🔁',
        'doctor_card': '⚕️',
        'bonus_double_points': '💰',
        'bonus_lock_turn': '🔒',
        'bonus_swap_position': '🌪️',
        'uno_reverse': '🔄'
    };
    return icons[cardId] || '⚡';
}

// Get card details
function getCardDetails(cardId) {
    const details = {
        'extra_guess': 'Sıradaki tahminde 1 ek tahmin hakkı kazanırsın',
        'peek_card': 'Haritadaki herhangi bir kartın tipini (rengi) görebilirsin',
        'block_opponent': 'Rakip takımın bir tahmini otomatik olarak engellenir',
        'swap_cards': 'İki kartın konumlarını harita üzerinde değiştirebilirsin',
        'reveal_hint': 'Bir kartı otomatik olarak açtırırsın (rakibe karşı kullanışlı)',
        'bomb_card': 'Rakip takımın sıradaki turunda sadece 1 tahmin yapabilir',
        'echo_card': 'Casusbaşı sıradaki turda 2 ipucu verebilir',
        'swap_card': 'Haritadaki 2 kartın konumları otomatik olarak değişir',
        'doctor_card': '1 tur boyunca rakibin tüm saldırılarından korunursun',
        'bonus_double_points': 'Kazandığın kartlarla 2 puan alırsın!',
        'bonus_lock_turn': 'Rakip takımı 1 tur geçmek zorunda kalır',
        'bonus_swap_position': 'Tüm harita kartları rastgele konumlarında değişir',
        'uno_reverse': 'Rakip takımın tüm puanlarını çal!'
    };
    return details[cardId] || 'Özel bir güç kartı';
}

// Use power card
function usePowerCard(card, index, teamColor) {
    if (!socket || !currentRoom) return;

    // Check if it's current team's turn
    if (currentPlayer.team !== currentRoom.currentTurn) {
        alert('Güç kartını sadece kendi sıranızda kullanabilirsiniz!');
        return;
    }

    // Send only card ID to server
    socket.emit('use-power-card', card.id);

    // Close modal
    togglePowerCardsModal();

    console.log(`${card.name} kartı kullanılıyor...`);

    // Listen for success/error
    socket.once('error', (error) => {
        alert('Güç kartı hatası: ' + error);
    });
}

// Add bot from menu
function addBotFromMenu() {
    const teamSelect = document.getElementById('bot-team-select');
    const roleSelect = document.getElementById('bot-role-select');

    if (teamSelect && roleSelect) {
        const team = teamSelect.value;
        const role = roleSelect.value;
        addBot(team, role);
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');

    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
        btn.classList.toggle('dark-enabled', isDarkMode);
    }
}

// Toggle sound
function toggleSound() {
    soundManager.enabled = !soundManager.enabled;
    const btn = document.getElementById('sound-toggle');
    if (btn) {
        btn.classList.toggle('muted', !soundManager.enabled);
        btn.style.opacity = soundManager.enabled ? '1' : '0.5';
    }
    localStorage.setItem('soundEnabled', soundManager.enabled ? 'true' : 'false');
}

// Toggle music
function toggleMusic() {
    const music = document.getElementById('background-music');
    if (music) {
        if (music.paused) {
            music.play().catch(e => console.log('Müzik oynatma hatası:', e));
        } else {
            music.pause();
        }
    }
    const btn = document.getElementById('music-toggle');
    if (btn) {
        btn.style.opacity = (music && !music.paused) ? '1' : '0.5';
    }
}

// Toggle transparency mode
function toggleTransparency() {
    document.body.classList.toggle('transparent-mode');
    const isTransparent = document.body.classList.contains('transparent-mode');
    localStorage.setItem('transparencyMode', isTransparent ? 'true' : 'false');

    const btn = document.getElementById('transparency-toggle');
    if (btn) {
        btn.classList.toggle('active', isTransparent);
    }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) btn.classList.add('dark-enabled');
    }

    // Load sound preference
    const savedSound = localStorage.getItem('soundEnabled');
    if (savedSound === 'false') {
        soundManager.enabled = false;
        const btn = document.getElementById('sound-toggle');
        if (btn) {
            btn.classList.add('muted');
            btn.style.opacity = '0.5';
        }
    }

    // Load transparency mode preference
    const savedTransparency = localStorage.getItem('transparencyMode');
    if (savedTransparency === 'true') {
        document.body.classList.add('transparent-mode');
        const btn = document.getElementById('transparency-toggle');
        if (btn) btn.classList.add('active');
    }

    // Chat enter key support
    const chatInput = document.getElementById('game-chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendGameMessage();
            }
        });
    }
});
// Lightning Event Handler
socket.on('lightning-event', (data) => {
    const cardElement = document.querySelector(`.card[data-index="${data.index}"]`);
    if (cardElement) {
        // Show lightning animation
        cardElement.classList.add('lightning-struck');

        // Update card visual
        const colorMap = {
            'RED': 'red',
            'BLUE': 'blue',
            'NEUTRAL': 'neutral',
            'BLACK': 'black'
        };

        cardElement.classList.remove('revealed', 'red', 'blue', 'neutral', 'black');
        cardElement.classList.add('revealed', colorMap[data.newType] || 'neutral');

        // Remove animation class after effect
        setTimeout(() => cardElement.classList.remove('lightning-struck'), 1200);
    }

    // Play dramatic lightning sound
    soundManager.lightningStrike();
});

// Storm Event Handler
socket.on('storm-event', (data) => {
    const colorMap = {
        'RED': 'red',
        'BLUE': 'blue',
        'NEUTRAL': 'neutral',
        'BLACK': 'black'
    };

    // Play thunder sound
    soundManager.stormThunder();

    data.changedCards.forEach((change, idx) => {
        setTimeout(() => {
            const cardElement = document.querySelector(`.card[data-index="${change.index}"]`);
            if (cardElement) {
                cardElement.classList.add('storm-hit');
                cardElement.classList.remove('revealed', 'red', 'blue', 'neutral', 'black');
                cardElement.classList.add('revealed', colorMap[change.newType] || 'neutral');

                setTimeout(() => cardElement.classList.remove('storm-hit'), 1000);
            }
        }, idx * 150); // Stagger the hits
    });
});

// Power Card Distribution Handler
socket.on('power-card-distributed', (data) => {
    showPowerCardNotification(data);
});

// Black Card Explosion Handler
socket.on('black-card-explosion', (data) => {
    showBlackExplosionModal();
});

// Power Card Notification Functions
function showPowerCardNotification(data) {
    const modal = document.getElementById('power-card-notification');
    if (!modal) return;

    // Only show notification if this player's team is receiving the card
    if (!currentPlayer || data.team !== currentPlayer.team) return;

    // Play magical sound
    soundManager.powerCardObtained();

    const cardInfo = data.card;
    const teamColor = currentPlayer.team === 'RED' ? 'red' : 'blue';

    // Update modal content
    document.getElementById('power-card-icon').textContent = cardInfo.isBonus ? '⭐' : '✨';
    document.getElementById('power-card-title').textContent = cardInfo.name || 'Güç Kartı';
    document.getElementById('power-card-description').textContent = cardInfo.description || 'Yeni bir güç kartı aldın!';

    const teamElement = document.getElementById('power-card-team');
    teamElement.textContent = currentPlayer.team === 'RED' ? '🔴 KIRMIZI TAKIMI' : '🔵 MAVİ TAKIMI';
    teamElement.className = `power-card-team ${teamColor}`;

    // Show modal
    modal.classList.remove('hidden');

    // Auto-close after 3 seconds
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 3000);
}

function closePowerCardNotification() {
    const modal = document.getElementById('power-card-notification');
    if (modal) modal.classList.add('hidden');
}

// Black Explosion Modal Functions
function showBlackExplosionModal() {
    const modal = document.getElementById('black-explosion-modal');
    const resultElement = document.getElementById('explosion-result');

    if (!modal) return;

    // Reset spinner
    const spinner = document.getElementById('explosion-spinner');
    if (spinner) {
        spinner.style.animation = 'none';
        setTimeout(() => {
            spinner.style.animation = 'explosionSpin 8s linear infinite';
        }, 10);
    }

    resultElement.textContent = '...';
    modal.classList.remove('hidden');

    // Simulate spinning and landing
    let finalTeam = '';
    setTimeout(() => {
        finalTeam = Math.random() < 0.5 ? 'KIRMIZI' : 'MAVİ';
        resultElement.textContent = finalTeam === 'KIRMIZI' ? '🔴 KIRMIZI KAZANDI!' : '🔵 MAVİ KAZANDI!';
        resultElement.style.color = finalTeam === 'KIRMIZI' ? '#dc2626' : '#2563eb';

        // Stop spinner
        if (spinner) {
            spinner.style.animation = 'none';
            spinner.style.transform = finalTeam === 'KIRMIZI' ? 'rotateY(-90deg)' : 'rotateY(90deg)';
        }

        // Play win sound
        if (finalTeam === 'KIRMIZI') {
            soundManager.playTone(523, 0.3, 'sine', 0.3);
            setTimeout(() => soundManager.playTone(659, 0.3, 'sine', 0.3), 150);
        } else {
            soundManager.playTone(659, 0.3, 'sine', 0.3);
            setTimeout(() => soundManager.playTone(523, 0.3, 'sine', 0.3), 150);
        }
    }, 3000);
}

function closeExplosionModal() {
    const modal = document.getElementById('black-explosion-modal');
    if (modal) modal.classList.add('hidden');
}

// Card Selection Popup Functions (stable centered CSGO-style)
const CARD_WIDTH_WITH_GAP = 175; // 160 width + 15 gap (CSS)
let popupTeamCards = [];

function renderTeamSection(teamKey, cards, reveal) {
    const container = document.getElementById(teamKey === 'red' ? 'red-team-cards' : 'blue-team-cards');
    if (!container) return;
    container.innerHTML = '';

    cards.forEach((card, idx) => {
        const slot = document.createElement('div');
        slot.className = 'card-slot filled';
        if (reveal) {
            slot.innerHTML = `
                <div style="font-size: 1.15em; margin-bottom: 4px;">${card.name}</div>
                <div style="font-size: 0.82em; opacity: 0.85;">${card.description}</div>
            `;
        } else {
            slot.classList.add('hidden-opponent');
            slot.innerHTML = `
                <div style="font-size: 1.2em; opacity: 0.35;">?</div>
                <div style="font-size: 0.8em; opacity: 0.5;">Gizli</div>
            `;
        }

        slot.style.opacity = '0';
        slot.style.transform = 'translateY(6px)';
        container.appendChild(slot);
        requestAnimationFrame(() => {
            setTimeout(() => {
                slot.style.transition = 'all 0.35s ease';
                slot.style.opacity = '1';
                slot.style.transform = 'translateY(0)';
            }, idx * 120);
        });
    });
}

function resetCaseStrip() {
    const caseCardsContainer = document.getElementById('case-cards');
    if (!caseCardsContainer) return;
    caseCardsContainer.innerHTML = '';
    caseCardsContainer.style.transition = 'none';
    caseCardsContainer.style.transform = 'translateX(0)';
}

function getCardColor(card) {
    if (card.isUltraRare) {
        return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    } else if (card.isBonus) {
        return 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)';
    } else {
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
}

function buildStrip(targetCard) {
    const caseCardsContainer = document.getElementById('case-cards');
    if (!caseCardsContainer) return { winningIndex: 0, total: 0 };

    const filler = popupAllCards.length ? popupAllCards : [targetCard];
    const stripLength = 180;
    const fragment = document.createDocumentFragment();
    const winningIndex = Math.floor(Math.random() * (120 - 90) + 90);

    for (let i = 0; i < stripLength; i++) {
        const cardObj = i === winningIndex ? targetCard : filler[i % filler.length];
        const cardEl = document.createElement('div');
        cardEl.className = 'case-card';
        cardEl.textContent = cardObj.name || 'Kart';
        cardEl.style.background = getCardColor(cardObj);
        fragment.appendChild(cardEl);
    }

    caseCardsContainer.innerHTML = '';
    caseCardsContainer.appendChild(fragment);
    return { winningIndex, total: stripLength };
}

function startSpinSequence() {
    const teamCards = popupTeamCards && popupTeamCards.length ? popupTeamCards : [];
    if (!teamCards.length) return;
    spinsCompleted = 0;
    spinNext(teamCards);
}

function spinNext(teamCards) {
    if (spinsCompleted >= 3 || spinsCompleted >= teamCards.length) {
        showConfirmButton();
        return;
    }

    const target = teamCards[spinsCompleted];
    const caseCardsContainer = document.getElementById('case-cards');
    const confirmBtn = document.getElementById('confirm-cards-btn');
    const autoBtn = document.getElementById('auto-select-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (autoBtn) autoBtn.disabled = true;

    const { winningIndex, total } = buildStrip(target);
    const containerWidth = caseCardsContainer.parentElement.offsetWidth;
    const totalWidth = total * CARD_WIDTH_WITH_GAP;
    const rawTarget = (containerWidth / 2) - (winningIndex * CARD_WIDTH_WITH_GAP + (160 / 2));
    const minTarget = -(totalWidth - containerWidth);
    const maxTarget = containerWidth * 0.08;
    const scrollTarget = Math.max(minTarget, Math.min(rawTarget, maxTarget));

    playCaseOpeningSound();
    requestAnimationFrame(() => {
        setTimeout(() => {
            caseCardsContainer.style.transition = 'transform 3.2s cubic-bezier(0.16, 0, 0.07, 1)';
            caseCardsContainer.style.transform = `translateX(${scrollTarget}px)`;
        }, 40);
    });

    setTimeout(() => {
        playCardStopSound();
        highlightWinningCard(caseCardsContainer, winningIndex);
        spinsCompleted += 1;
        setTimeout(() => spinNext(teamCards), 1200);
    }, 3800);
}

function highlightWinningCard(container, index) {
    const cards = container.children;
    Array.from(cards).forEach(c => c.classList.remove('selected'));
    const winningCard = cards[index];
    if (winningCard) {
        winningCard.classList.add('selected');
    }
}

function playCaseOpeningSound() {
    if (soundManager && soundManager.playTone) {
        soundManager.playTone(220, 0.12, 'sine', 0.25);
        setTimeout(() => soundManager.playTone(320, 0.12, 'sine', 0.22), 80);
    }
}

function playCardStopSound() {
    if (soundManager && soundManager.playTone) {
        soundManager.playTone(720, 0.16, 'sine', 0.35);
        setTimeout(() => soundManager.playTone(1020, 0.12, 'sine', 0.3), 120);
    }
}

function autoSelectCards() {
    // Simple reveal without animation
    const teamCards = popupTeamCards && popupTeamCards.length ? popupTeamCards : [];
    if (!teamCards.length) return;

    const confirmBtn = document.getElementById('confirm-cards-btn');
    const autoBtn = document.getElementById('auto-select-btn');
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (autoBtn) autoBtn.disabled = true;

    playCaseOpeningSound();

    // Just show the cards immediately
    setTimeout(() => {
        renderTeamSection(currentPlayer.team.toLowerCase(), teamCards, true);
        showConfirmButton();
    }, 500);
}

function showConfirmButton() {
    const confirmBtn = document.getElementById('confirm-cards-btn');
    if (confirmBtn) {
        confirmBtn.style.display = 'inline-block';
        confirmBtn.style.animation = 'pulse 0.7s ease';
    }
}

function confirmCardSelection() {
    const popup = document.getElementById('card-selection-popup');
    if (popup) {
        popup.classList.add('hidden');
    }
    resetCaseStrip();
    spinsCompleted = 0;
}

// Dictionary for localized game messages
const gameMessages = {
    joined: "Odaya katıldı",
    left: "Odadan ayrıldı",
    newGame: "Yeni oyun başladı",
    redTurn: "Sıra KIRMIZI takımda",
    blueTurn: "Sıra MAVİ takımda",
    winRed: "KIRMIZI takım kazandı!",
    winBlue: "MAVİ takım kazandı!",
    spyHint: "Casusbaşı ipucu veriyor...",
    waiting: "Diğer oyuncular bekleniyor..."
};

// Global Chat Functionality
function toggleTeamChat() {
    const input = document.getElementById('chat-input');
    const toggleBtn = document.getElementById('toggle-team-chat');

    if (input.dataset.teamOnly === 'true') {
        input.dataset.teamOnly = 'false';
        input.placeholder = "Bir mesaj yaz...";
        toggleBtn.style.color = 'white';
        toggleBtn.textContent = '📢';
    } else {
        input.dataset.teamOnly = 'true';
        input.placeholder = "[TAKIM] Bir mesaj yaz...";
        toggleBtn.style.color = currentPlayer.team === 'RED' ? '#ef4444' : '#3b82f6';
        toggleBtn.textContent = '🔒';
    }
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    let message = input.value.trim();
    if (!message) return;

    let isTeamMessage = input.dataset.teamOnly === 'true';

    // Chat Command: /p (Team Chat)
    if (message.startsWith('/p ')) {
        isTeamMessage = true;
        message = message.substring(3).trim();
    }
    // Chat Command: /randomevent (Admin/Cheat)
    else if (message.startsWith('/randomevent ')) {
        const eventType = message.split(' ')[1];
        if (eventType) {
            socket.emit('trigger-event', { type: eventType });
            // Show local feedback
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                const feedback = document.createElement('div');
                feedback.className = 'chat-message system';
                feedback.textContent = `⚡ Event Triggered: ${eventType}`;
                chatMessages.appendChild(feedback);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        input.value = '';
        return; // Don't send as chat message
    }

    if (!message) return;

    socket.emit('send-message', {
        message: message,
        isTeamMessage: isTeamMessage
    });

    input.value = '';
}

// Role Modal Logic
function showRoleModal(title, text, icon) {
    const modal = document.getElementById('role-modal');
    document.getElementById('role-modal-title').textContent = title;
    document.getElementById('role-modal-text').innerHTML = text; // Allow HTML for colors
    document.getElementById('role-modal-icon').textContent = icon || '🕵️';
    if (modal) modal.classList.remove('hidden');
}

function closeRoleModal() {
    const modal = document.getElementById('role-modal');
    if (modal) modal.classList.add('hidden');
}

// Hook into startGame response or room update to show modal? 
// Better to show it when the game phase starts.
// Check updateRoom function -> around line 603 where it detects 'playing' state.


// Helper to add emoji to chat input
function addEmoji(emoji) {
    const input = document.getElementById('chat-input');
    input.value += emoji;
    input.focus();
}

// Initialize Emoji Picker
document.addEventListener('DOMContentLoaded', () => {
    // Add enter key support for login
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }

    const pickerBtn = document.getElementById('emoji-picker-btn');
    if (pickerBtn) {
        const picker = document.createElement('div');
        picker.id = 'emoji-picker-popover';
        picker.style.cssText = `
            position: absolute;
            bottom: 60px;
            left: 20px;
            background: rgba(30,30,30,0.95);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 10px;
            display: none;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
            z-index: 2100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const emojis = ['😀', '😎', '🎉', '🤔', '❤️', '🔥', '👍', '👎', '👋', '😂', '👀', '✨', '🚀', '💀', '🤡'];
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.textContent = emoji;
            span.style.cursor = 'pointer';
            span.style.fontSize = '1.2em';
            span.onclick = () => {
                addEmoji(emoji);
                picker.style.display = 'none';
            };
            picker.appendChild(span);
        });

        document.getElementById('chat-container').appendChild(picker);

        pickerBtn.onclick = (e) => {
            e.stopPropagation();
            picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
        };

        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target) && e.target !== pickerBtn) {
                picker.style.display = 'none';
            }
        });
    }
});

// Listen for incoming messages
socket.on('message', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${data.team === 'RED' ? 'team-red' : data.team === 'BLUE' ? 'team-blue' : ''}`;

    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const prefix = data.isTeamMessage ? '[TAKIM] ' : '';

    msgDiv.innerHTML = `<span style="opacity:0.6; font-size:0.8em">[${time}]</span> <strong>${prefix}${data.player}:</strong> ${data.message}`;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Handle server errors gracefully
socket.on('connect_error', (err) => {
    console.error('Connection failed', err);
    // Optionally show a toast to the user
});
