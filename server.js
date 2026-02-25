const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Power cards
// NOTE: keys are part of the client/server protocol; keep kebab-case.
// Tiers are purely informational (client UI), but weights make higher tiers rarer.
const POWER_CARD_DEFS = {
    // Existing cards
    'extra-guess': { name: '➕ +1 Tahmin', roles: ['OPERATIVE'], tier: 'C', weight: 7 },
    'boost': { name: '⚡ Turbo (+2)', roles: ['OPERATIVE'], tier: 'C', weight: 5 },
    'peek': { name: '👁️ Fısılda', roles: ['OPERATIVE'], tier: 'C', weight: 4 },
    'peek2': { name: '👁️‍🗨️ Çift Fısılda', roles: ['OPERATIVE'], tier: 'B', weight: 3 },
    'neutral-flip': { name: '⚪ Nötr Aç', roles: ['OPERATIVE'], tier: 'D', weight: 2 },
    'lock': { name: '🔒 Sustur', roles: ['OPERATIVE'], tier: 'B', weight: 2 },

    // 🔵 Spymaster focused
    'extra-hint': { name: '🧠 Ek İpucu', roles: ['SPYMASTER'], tier: 'C', weight: 5 },
    'number-bend': { name: '🔢 Sayı Bükümü', roles: ['SPYMASTER'], tier: 'B', weight: 4 },
    'silent-hint': { name: '🤫 Sessiz İpucu', roles: ['SPYMASTER'], tier: 'B', weight: 3 },
    'risk-insurance': { name: '🛡️ Risk Sigortası', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 2 },

    // 🟢 Operative focused
    'intuition': { name: '🟢 Sezgi', roles: ['OPERATIVE'], tier: 'C', weight: 4 },
    'second-chance': { name: '🎯 İkinci Şans', roles: ['OPERATIVE'], tier: 'B', weight: 3 },
    'double-guess': { name: '➕ Çifte Tahmin', roles: ['OPERATIVE'], tier: 'C', weight: 6 },

    // 🟣 Tactics
    'distraction': { name: '🌀 Dikkat Dağıtma', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'D', weight: 2 },
    'word-lock': { name: '🔒 Kelime Kilidi', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'D', weight: 2 },
    'shadow': { name: '🌘 Gölge', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'D', weight: 2 },

    // 🕶️ New: Blind (Kor Etki)
    // 30% chance per eligible player's hand (enforced in dealing logic).
    'blind': { name: '🕶️ Kör Etki', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 0 },

    // 🌫️ New: Sis (Fog)
    // Blurs opponent card words for 1 full turn.
    'sis': { name: '🌫️ Sis', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 2 },

    // 🔥 High risk / high reward
    'all-or-nothing': { name: '🔥 Hepsi Ya Da Hiç', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 2 },
    'fate-game': { name: '🎲 Kader Oyunu', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 1 },

    // 🔁 UNO Reverse: steal the opponent's HINT turn before clue is given
    'uno-reverse': { name: '🔁 UNO Reverse', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'A', weight: 1 },

    // 👑 Legendary (1 per game)
    'mind-reading': { name: '👑 Zihin Okuma', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'S', weight: 1, legendary: true },
    'time-rewind': { name: '👑 Zaman Geri Sar', roles: ['OPERATIVE', 'SPYMASTER'], tier: 'S', weight: 1, legendary: true },
    'absolute-hint': { name: '👑 Mutlak İpucu', roles: ['SPYMASTER'], tier: 'S', weight: 1, legendary: true }
};

const POWER_CARD_KEYS = Object.keys(POWER_CARD_DEFS);
const POWER_CARDS_PER_PLAYER = 4;

function getCardDef(cardKey) {
    return POWER_CARD_DEFS[cardKey] || null;
}

function ensurePowerEffects(gameState) {
    if (!gameState) return null;
    if (!gameState.powerEffects) {
        gameState.powerEffects = {
            skipTurns: { RED: 0, BLUE: 0 },
            pendingExtraGuesses: { RED: 0, BLUE: 0 },
            clue: {
                allowTwoWords: { RED: 0, BLUE: 0 },
                silent: { RED: 0, BLUE: 0 },
                numberBend: { RED: 0, BLUE: 0 },
                absolute: { RED: 0, BLUE: 0 }
            },
            guess: {
                insurance: { RED: 0, BLUE: 0 },
                insuranceUsed: { RED: 0, BLUE: 0 },
                secondChance: { RED: 0, BLUE: 0 },
                secondChanceUsed: { RED: 0, BLUE: 0 },
                allOrNothing: { RED: 0, BLUE: 0 },
                allOrNothingWrong: { RED: false, BLUE: false }
            },
            tactical: {
                wordLocks: { RED: [], BLUE: [] },
                shadow: null
            }
        };
    }
    if (!gameState.powerEffects.skipTurns) {
        gameState.powerEffects.skipTurns = { RED: 0, BLUE: 0 };
    }
    if (!gameState.powerEffects.pendingExtraGuesses) {
        gameState.powerEffects.pendingExtraGuesses = { RED: 0, BLUE: 0 };
    }
    if (!gameState.powerEffects.clue) {
        gameState.powerEffects.clue = {
            allowTwoWords: { RED: 0, BLUE: 0 },
            silent: { RED: 0, BLUE: 0 },
            numberBend: { RED: 0, BLUE: 0 },
            absolute: { RED: 0, BLUE: 0 }
        };
    }
    if (!gameState.powerEffects.clue.allowTwoWords) gameState.powerEffects.clue.allowTwoWords = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.clue.silent) gameState.powerEffects.clue.silent = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.clue.numberBend) gameState.powerEffects.clue.numberBend = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.clue.absolute) gameState.powerEffects.clue.absolute = { RED: 0, BLUE: 0 };

    if (!gameState.powerEffects.guess) {
        gameState.powerEffects.guess = {
            insurance: { RED: 0, BLUE: 0 },
            insuranceUsed: { RED: 0, BLUE: 0 },
            secondChance: { RED: 0, BLUE: 0 },
            secondChanceUsed: { RED: 0, BLUE: 0 },
            allOrNothing: { RED: 0, BLUE: 0 },
            allOrNothingWrong: { RED: false, BLUE: false }
        };
    }
    if (!gameState.powerEffects.guess.insurance) gameState.powerEffects.guess.insurance = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.guess.insuranceUsed) gameState.powerEffects.guess.insuranceUsed = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.guess.secondChance) gameState.powerEffects.guess.secondChance = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.guess.secondChanceUsed) gameState.powerEffects.guess.secondChanceUsed = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.guess.allOrNothing) gameState.powerEffects.guess.allOrNothing = { RED: 0, BLUE: 0 };
    if (!gameState.powerEffects.guess.allOrNothingWrong) gameState.powerEffects.guess.allOrNothingWrong = { RED: false, BLUE: false };

    if (!gameState.powerEffects.tactical) {
        gameState.powerEffects.tactical = {
            wordLocks: { RED: [], BLUE: [] },
            shadow: null,
            blind: { RED: 0, BLUE: 0 },
            fog: { RED: 0, BLUE: 0 }
        };
    }
    if (!gameState.powerEffects.tactical.wordLocks) gameState.powerEffects.tactical.wordLocks = { RED: [], BLUE: [] };
    if (!Array.isArray(gameState.powerEffects.tactical.wordLocks.RED)) gameState.powerEffects.tactical.wordLocks.RED = [];
    if (!Array.isArray(gameState.powerEffects.tactical.wordLocks.BLUE)) gameState.powerEffects.tactical.wordLocks.BLUE = [];
    if (gameState.powerEffects.tactical.shadow === undefined) gameState.powerEffects.tactical.shadow = null;
    if (!gameState.powerEffects.tactical.blind) gameState.powerEffects.tactical.blind = { RED: 0, BLUE: 0 };
    if (!Number.isFinite(gameState.powerEffects.tactical.blind.RED)) gameState.powerEffects.tactical.blind.RED = 0;
    if (!Number.isFinite(gameState.powerEffects.tactical.blind.BLUE)) gameState.powerEffects.tactical.blind.BLUE = 0;

    if (!gameState.powerEffects.tactical.fog) gameState.powerEffects.tactical.fog = { RED: 0, BLUE: 0 };
    if (!Number.isFinite(gameState.powerEffects.tactical.fog.RED)) gameState.powerEffects.tactical.fog.RED = 0;
    if (!Number.isFinite(gameState.powerEffects.tactical.fog.BLUE)) gameState.powerEffects.tactical.fog.BLUE = 0;

    return gameState.powerEffects;
}

function ensureTurnMeta(gameState) {
    if (!gameState) return null;
    if (!gameState.turnMeta) {
        gameState.turnMeta = {
            firstSelectionMade: false,
            correctGuesses: 0,
            wrongGuess: false
        };
    }
    if (typeof gameState.turnMeta.firstSelectionMade !== 'boolean') gameState.turnMeta.firstSelectionMade = false;
    if (!Number.isFinite(gameState.turnMeta.correctGuesses)) gameState.turnMeta.correctGuesses = 0;
    if (typeof gameState.turnMeta.wrongGuess !== 'boolean') gameState.turnMeta.wrongGuess = false;
    return gameState.turnMeta;
}

function pushRevealHistory(room, revealIndex, revealType) {
    if (!room || !room.gameState) return;
    const gs = room.gameState;
    if (!Array.isArray(gs.revealHistory)) gs.revealHistory = [];
    let snapshot = null;
    try {
        snapshot = JSON.parse(JSON.stringify(gs));
    } catch (_) {
        snapshot = null;
    }
    if (!snapshot) return;

    gs.revealHistory.push({
        snapshot,
        revealedCardIndex: revealIndex,
        revealedCardType: revealType
    });
    if (gs.revealHistory.length > 30) gs.revealHistory.shift();
}

function restoreLastNonAssassinReveal(room) {
    if (!room || !room.gameState) return { ok: false, reason: 'no-game' };
    const gs = room.gameState;
    const history = Array.isArray(gs.revealHistory) ? gs.revealHistory : [];
    for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (!h || !h.snapshot) continue;
        if (String(h.revealedCardType || '').toUpperCase() === 'ASSASSIN') continue;
        room.gameState = h.snapshot;
        // prune to that point
        if (Array.isArray(room.gameState.revealHistory)) {
            room.gameState.revealHistory = room.gameState.revealHistory.slice(0, i);
        }
        ensurePowerEffects(room.gameState);
        ensureTurnMeta(room.gameState);
        return { ok: true, restoredIndex: h.revealedCardIndex };
    }
    return { ok: false, reason: 'no-eligible-history' };
}

function applyPendingExtraGuessesIfAny(gameState, team) {
    const effects = ensurePowerEffects(gameState);
    if (!effects) return;
    const pending = Number(effects.pendingExtraGuesses?.[team] || 0);
    if (pending > 0) {
        gameState.guessesRemaining += pending;
        effects.pendingExtraGuesses[team] = 0;
    }
}

function getTurnNumber(gameState) {
    const n = Number(gameState?.turnNumber || 0);
    return Number.isFinite(n) ? n : 0;
}

function ensureBombState(gameState) {
    if (!gameState) return null;
    if (!Number.isFinite(Number(gameState.turnNumber))) gameState.turnNumber = 0;
    if (!gameState.bombLocks || typeof gameState.bombLocks !== 'object') gameState.bombLocks = {};
    return { turnNumber: getTurnNumber(gameState), bombLocks: gameState.bombLocks };
}

function isBombLocked(gameState, cardIndex) {
    if (!gameState || !Number.isInteger(cardIndex)) return false;
    ensureBombState(gameState);
    const unlockOnTurn = Number(gameState.bombLocks?.[cardIndex]);
    if (!Number.isFinite(unlockOnTurn)) return false;
    return getTurnNumber(gameState) < unlockOnTurn;
}

function cleanupExpiredBombLocks(gameState) {
    if (!gameState) return;
    ensureBombState(gameState);
    const now = getTurnNumber(gameState);
    const locks = gameState.bombLocks;
    for (const [k, v] of Object.entries(locks)) {
        const idx = parseInt(k, 10);
        const unlockOn = Number(v);
        if (!Number.isInteger(idx) || !Number.isFinite(unlockOn) || now >= unlockOn) {
            delete locks[k];
        }
    }
}

function pickBombSpawnPoint01() {
    // Spawn near an edge so it feels like it "came from somewhere" on the map.
    const edge = Math.floor(Math.random() * 4); // 0 top, 1 right, 2 bottom, 3 left
    const t = Math.random();
    const margin = 0.06;
    if (edge === 0) return { x: t, y: margin };
    if (edge === 1) return { x: 1 - margin, y: t };
    if (edge === 2) return { x: t, y: 1 - margin };
    return { x: margin, y: t };
}

function maybeTriggerBomb(room, reason) {
    if (!room || !room.gameState || !room.id) return;
    const gs = room.gameState;
    if (gs.gameOver) return;
    if (gs.currentTurn?.phase === 'DRAFT') return;

    ensureBombState(gs);

    // Keep it rare and non-stacking: if a bomb lock is already active, do nothing.
    const now = getTurnNumber(gs);
    const hasActive = Object.values(gs.bombLocks || {}).some(v => Number.isFinite(Number(v)) && now < Number(v));
    if (hasActive) return;

    // 10% chance
    if (Math.random() >= 0.10) return;

    const board = Array.isArray(gs.board) ? gs.board : [];
    const candidates = [];
    for (let i = 0; i < board.length; i++) {
        const c = board[i];
        if (!c || c.revealed) continue;
        if (isBombLocked(gs, i)) continue;
        candidates.push(i);
    }
    if (candidates.length === 0) return;

    const targetIndex = candidates[Math.floor(Math.random() * candidates.length)];
    const unlockOnTurn = now + 2;
    gs.bombLocks[targetIndex] = unlockOnTurn;

    const from = pickBombSpawnPoint01();
    io.to(room.id).emit('bomb-triggered', {
        from,
        targetIndex,
        unlockOnTurn,
        reason: reason || 'random'
    });
    emitGameStateSync(room, 'bomb-triggered');
}

function switchToNextTeamTurn(room) {
    if (!room || !room.gameState) return;
    const gameState = room.gameState;
    const effects = ensurePowerEffects(gameState);
    ensureTurnMeta(gameState);

    ensureBombState(gameState);

    const oldTeam = gameState.currentTurn.team;

    const flip = (t) => (t === 'RED' ? 'BLUE' : 'RED');
    let nextTeam = flip(oldTeam);

    // Apply skip-turn effects (silence): if next team is silenced, skip them.
    // Loop guard prevents infinite toggles.
    for (let i = 0; i < 4; i++) {
        const skips = Number(effects.skipTurns?.[nextTeam] || 0);
        if (skips > 0) {
            effects.skipTurns[nextTeam] = Math.max(0, skips - 1);
            nextTeam = flip(nextTeam);
            continue;
        }
        break;
    }

    // End-of-turn cleanup for old team (one-turn effects)
    if (effects?.clue) {
        effects.clue.allowTwoWords[oldTeam] = 0;
        effects.clue.silent[oldTeam] = 0;
        effects.clue.numberBend[oldTeam] = 0;
        effects.clue.absolute[oldTeam] = 0;
    }
    if (effects?.guess) {
        effects.guess.insurance[oldTeam] = 0;
        effects.guess.insuranceUsed[oldTeam] = 0;
        effects.guess.secondChance[oldTeam] = 0;
        effects.guess.secondChanceUsed[oldTeam] = 0;
        effects.guess.allOrNothing[oldTeam] = 0;
        effects.guess.allOrNothingWrong[oldTeam] = false;
    }
    if (effects?.tactical?.wordLocks) {
        effects.tactical.wordLocks[oldTeam] = [];
    }
    if (effects?.tactical?.blind) {
        const cur = Number(effects.tactical.blind[oldTeam] || 0);
        effects.tactical.blind[oldTeam] = Math.max(0, cur - 1);
    }
    if (effects?.tactical?.fog) {
        const cur = Number(effects.tactical.fog[oldTeam] || 0);
        effects.tactical.fog[oldTeam] = Math.max(0, cur - 1);
    }
    if (effects?.tactical?.shadow && effects.tactical.shadow.expiresOnTeam === oldTeam) {
        effects.tactical.shadow = null;
        io.to(room.id).emit('shadow-card', { cardIndex: null, hidden: false });
    }

    // All-or-nothing bonus: if no wrong guess happened this turn, reveal +1 random team card.
    const meta = gameState.turnMeta;
    if (
        effects?.guess?.allOrNothing?.[oldTeam] > 0 &&
        !effects?.guess?.allOrNothingWrong?.[oldTeam] &&
        (meta?.wrongGuess === false) &&
        Number(meta?.correctGuesses || 0) > 0
    ) {
        const candidates = (gameState.board || [])
            .map((c, idx) => ({ c, idx }))
            .filter(({ c }) => c && !c.revealed && c.type === oldTeam);
        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            pushRevealHistory(room, pick.idx, pick.c.type);
            pick.c.revealed = true;
            pick.c.selector = 'ALL-OR-NOTHING';
            if (pick.c.type === 'RED') gameState.redRemaining--;
            else if (pick.c.type === 'BLUE') gameState.blueRemaining--;
            io.to(room.id).emit('card-revealed', {
                cardIndex: pick.idx,
                gameState: room.gameState,
                by: { name: 'Güç Kartı', team: oldTeam, role: 'SYSTEM' },
                via: 'power-card'
            });
        }
    }

    // Start next team's turn
    gameState.turnNumber = getTurnNumber(gameState) + 1;
    cleanupExpiredBombLocks(gameState);
    gameState.currentTurn.team = nextTeam;
    gameState.currentTurn.phase = 'HINT';
    gameState.currentClue = null;
    gameState.guessesRemaining = 0;
    gameState.turnMeta = { firstSelectionMade: false, correctGuesses: 0, wrongGuess: false };
}

function emitGameState(room) {
    if (!room || !room.id || !room.gameState) return;
    io.to(room.id).emit('game-state', room.gameState);
}

function emitGameStateSync(room, reason) {
    if (!room || !room.id || !room.gameState) return;
    io.to(room.id).emit('game-state-sync', { gameState: room.gameState, reason: reason || 'sync' });
}

function applyPowerCardEffect(room, player, cardKey, data) {
    if (!room || !room.gameState || !player) return null;
    const gameState = room.gameState;
    const effects = ensurePowerEffects(gameState);
    ensureTurnMeta(gameState);
    const otherTeam = player.team === 'RED' ? 'BLUE' : 'RED';

    switch (cardKey) {
        case 'blind': {
            // Blind the opponent team for 1 full turn: they can't see card words.
            if (!effects?.tactical?.blind) effects.tactical.blind = { RED: 0, BLUE: 0 };
            const cur = Math.max(0, Number(effects.tactical.blind[otherTeam] || 0));
            effects.tactical.blind[otherTeam] = cur + 1;
            return { type: 'blind', targetTeam: otherTeam, turns: 1 };
        }
        case 'sis': {
            // Fog the opponent team for 1 full turn: card words are blurred (still visible).
            if (!effects?.tactical?.fog) effects.tactical.fog = { RED: 0, BLUE: 0 };
            const cur = Math.max(0, Number(effects.tactical.fog[otherTeam] || 0));
            effects.tactical.fog[otherTeam] = cur + 1;
            return { type: 'sis', targetTeam: otherTeam, turns: 1 };
        }
        case 'extra-guess': {
            if (gameState.currentTurn.phase === 'GUESS') {
                gameState.guessesRemaining += 1;
            } else {
                effects.pendingExtraGuesses[player.team] = (effects.pendingExtraGuesses[player.team] || 0) + 1;
            }
            return { type: 'extra-guess', amount: 1 };
        }
        case 'boost': {
            if (gameState.currentTurn.phase === 'GUESS') {
                gameState.guessesRemaining += 2;
            } else {
                effects.pendingExtraGuesses[player.team] = (effects.pendingExtraGuesses[player.team] || 0) + 2;
            }
            return { type: 'boost', amount: 2 };
        }
        case 'lock': {
            // Silence opponent for their next turn: it will be skipped when the turn changes.
            effects.skipTurns[otherTeam] = (effects.skipTurns[otherTeam] || 0) + 1;
            return { type: 'skip-turn', targetTeam: otherTeam, turns: 1 };
        }
        case 'peek': {
            const unrevealed = gameState.board
                .map((c, idx) => ({ c, idx }))
                .filter(({ c }) => c && !c.revealed);
            if (unrevealed.length === 0) return { type: 'peek', empty: true };
            const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
            const payload = {
                cardIndex: pick.idx,
                cardType: pick.c.type
            };

            // Send to all connected players of the same team (not to the other team)
            room.players
                .filter(p => p && p.team === player.team && players.has(p.id))
                .forEach(p => io.to(p.id).emit('power-card-peek', payload));

            return { type: 'peek', ...payload };
        }
        case 'peek2': {
            const unrevealed = gameState.board
                .map((c, idx) => ({ c, idx }))
                .filter(({ c }) => c && !c.revealed);
            if (unrevealed.length === 0) return { type: 'peek2', empty: true };

            shuffleInPlace(unrevealed);
            const picks = unrevealed.slice(0, Math.min(2, unrevealed.length)).map(p => ({
                cardIndex: p.idx,
                cardType: p.c.type
            }));

            // Send to all connected players of the same team
            room.players
                .filter(p => p && p.team === player.team && players.has(p.id))
                .forEach(p => {
                    picks.forEach(payload => io.to(p.id).emit('power-card-peek', payload));
                });

            return { type: 'peek2', cards: picks };
        }
        case 'neutral-flip': {
            const neutrals = gameState.board
                .map((c, idx) => ({ c, idx }))
                .filter(({ c }) => c && !c.revealed && c.type === 'NEUTRAL');
            if (neutrals.length === 0) {
                return { type: 'neutral-flip', empty: true };
            }
            const pick = neutrals[Math.floor(Math.random() * neutrals.length)];
            pushRevealHistory(room, pick.idx, pick.c.type);
            pick.c.revealed = true;
            pick.c.selector = player.username;

            // Public info; do not change guessesRemaining.
            io.to(room.id).emit('card-revealed', {
                cardIndex: pick.idx,
                gameState: room.gameState,
                by: { name: player.username, team: player.team, role: player.role },
                via: 'power-card'
            });

            return { type: 'neutral-flip', cardIndex: pick.idx };
        }
        case 'extra-hint': {
            effects.clue.allowTwoWords[player.team] = 1;
            return { type: 'extra-hint' };
        }
        case 'number-bend': {
            const delta = (data && Number.isFinite(data.delta)) ? Number(data.delta) : NaN;
            if (delta !== 1 && delta !== -1) return { type: 'number-bend', invalid: true };
            effects.clue.numberBend[player.team] = delta;
            return { type: 'number-bend', delta };
        }
        case 'silent-hint': {
            effects.clue.silent[player.team] = 1;
            return { type: 'silent-hint' };
        }
        case 'absolute-hint': {
            effects.clue.absolute[player.team] = 1;
            return { type: 'absolute-hint' };
        }
        case 'risk-insurance': {
            effects.guess.insurance[player.team] = 1;
            effects.guess.insuranceUsed[player.team] = 0;
            return { type: 'risk-insurance' };
        }
        case 'second-chance': {
            effects.guess.secondChance[player.team] = 1;
            effects.guess.secondChanceUsed[player.team] = 0;
            return { type: 'second-chance' };
        }
        case 'double-guess': {
            if (gameState.currentTurn.phase === 'GUESS') {
                gameState.guessesRemaining += 1;
            } else {
                effects.pendingExtraGuesses[player.team] = (effects.pendingExtraGuesses[player.team] || 0) + 1;
            }
            return { type: 'double-guess', amount: 1 };
        }
        case 'intuition': {
            const idxRaw = data && (typeof data.cardIndex === 'number' ? data.cardIndex : (typeof data.cardIndex === 'string' ? parseInt(data.cardIndex, 10) : NaN));
            if (!Number.isInteger(idxRaw)) return { type: 'intuition', invalid: true };
            const card = gameState.board?.[idxRaw];
            if (!card || card.revealed) return { type: 'intuition', invalid: true };
            const isFriendly = card.type === player.team;
            io.to(player.id).emit('power-card-private', {
                kind: 'intuition',
                cardIndex: idxRaw,
                isFriendly
            });
            return { type: 'intuition', cardIndex: idxRaw };
        }
        case 'distraction': {
            // No mechanical effect: psychological.
            return { type: 'distraction', targetTeam: otherTeam };
        }
        case 'word-lock': {
            const idxRaw = data && (typeof data.cardIndex === 'number' ? data.cardIndex : (typeof data.cardIndex === 'string' ? parseInt(data.cardIndex, 10) : NaN));
            if (!Number.isInteger(idxRaw)) return { type: 'word-lock', invalid: true };
            const card = gameState.board?.[idxRaw];
            if (!card || card.revealed) return { type: 'word-lock', invalid: true };
            const arr = effects.tactical.wordLocks[otherTeam] || [];
            if (!arr.includes(idxRaw)) arr.push(idxRaw);
            effects.tactical.wordLocks[otherTeam] = arr;
            return { type: 'word-lock', targetTeam: otherTeam, cardIndex: idxRaw };
        }
        case 'shadow': {
            const idxRaw = data && (typeof data.cardIndex === 'number' ? data.cardIndex : (typeof data.cardIndex === 'string' ? parseInt(data.cardIndex, 10) : NaN));
            if (!Number.isInteger(idxRaw)) return { type: 'shadow', invalid: true };
            const card = gameState.board?.[idxRaw];
            if (!card || card.revealed) return { type: 'shadow', invalid: true };
            effects.tactical.shadow = { cardIndex: idxRaw, expiresOnTeam: gameState.currentTurn.team };
            io.to(room.id).emit('shadow-card', { cardIndex: idxRaw, hidden: true });
            return { type: 'shadow', cardIndex: idxRaw };
        }
        case 'all-or-nothing': {
            effects.guess.allOrNothing[player.team] = 1;
            effects.guess.allOrNothingWrong[player.team] = false;
            return { type: 'all-or-nothing' };
        }
        case 'fate-game': {
            const unrevealed = (gameState.board || [])
                .map((c, idx) => ({ c, idx }))
                .filter(({ c }) => c && !c.revealed);
            if (unrevealed.length === 0) return { type: 'fate-game', empty: true };
            shuffleInPlace(unrevealed);
            const picks = unrevealed.slice(0, Math.min(2, unrevealed.length));
            const revealed = [];
            for (const pick of picks) {
                const c = pick.c;
                pushRevealHistory(room, pick.idx, c.type);
                c.revealed = true;
                c.selector = player.username;
                if (c.type === 'RED') gameState.redRemaining--;
                else if (c.type === 'BLUE') gameState.blueRemaining--;

                io.to(room.id).emit('card-revealed', {
                    cardIndex: pick.idx,
                    gameState: room.gameState,
                    by: { name: player.username, team: player.team, role: player.role },
                    via: 'power-card'
                });
                revealed.push({ cardIndex: pick.idx, cardType: c.type });

                if (c.type === 'ASSASSIN') {
                    gameState.gameOver = true;
                    gameState.winner = gameState.currentTurn.team === 'RED' ? 'BLUE' : 'RED';
                    emitGameFinished(room, 'assassin');
                    break;
                }
            }
            return { type: 'fate-game', cards: revealed };
        }
        case 'mind-reading': {
            // Allowed on opponent's GUESS turn, before they start selecting.
            if (gameState.currentTurn.phase !== 'GUESS') return { type: 'mind-reading', invalid: true };
            if (player.team === gameState.currentTurn.team) return { type: 'mind-reading', invalid: true };
            const meta = ensureTurnMeta(gameState);
            if (meta.firstSelectionMade) return { type: 'mind-reading', tooLate: true };
            const idxRaw = data && (typeof data.cardIndex === 'number' ? data.cardIndex : (typeof data.cardIndex === 'string' ? parseInt(data.cardIndex, 10) : NaN));
            if (!Number.isInteger(idxRaw)) return { type: 'mind-reading', invalid: true };
            const card = gameState.board?.[idxRaw];
            if (!card || card.revealed) return { type: 'mind-reading', invalid: true };
            io.to(player.id).emit('power-card-private', {
                kind: 'mind-reading',
                cardIndex: idxRaw,
                cardType: card.type
            });
            return { type: 'mind-reading', cardIndex: idxRaw };
        }
        case 'time-rewind': {
            const res = restoreLastNonAssassinReveal(room);
            if (!res.ok) return { type: 'time-rewind', empty: true };
            io.to(room.id).emit('game-state-sync', { gameState: room.gameState, reason: 'time-rewind' });
            return { type: 'time-rewind' };
        }
        case 'uno-reverse': {
            // Can be used ONLY on opponent's HINT phase BEFORE a clue is given.
            const turnTeam = gameState.currentTurn?.team;
            const phase = gameState.currentTurn?.phase;
            if (!turnTeam || (turnTeam !== 'RED' && turnTeam !== 'BLUE')) return { type: 'uno-reverse', invalid: true };
            if (player.team === turnTeam) return { type: 'uno-reverse', invalid: true };
            if (phase !== 'HINT') return { type: 'uno-reverse', invalid: true };
            if (gameState.currentClue) return { type: 'uno-reverse', tooLate: true };

            gameState.turnNumber = getTurnNumber(gameState) + 1;
            cleanupExpiredBombLocks(gameState);

            gameState.currentTurn.team = player.team;
            gameState.currentTurn.phase = 'HINT';
            gameState.currentClue = null;
            gameState.guessesRemaining = 0;
            gameState.turnMeta = { firstSelectionMade: false, correctGuesses: 0, wrongGuess: false };

            return { type: 'uno-reverse', fromTeam: turnTeam, toTeam: player.team };
        }
        default:
            return null;
    }
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function dealPowerCardsForRoom(room, options = {}) {
    const byPlayer = {};
    const playersList = Array.isArray(room.players) ? room.players : [];

    const excludeSet = new Set(Array.isArray(options.excludeKeys) ? options.excludeKeys.filter(Boolean) : []);
    const forcedByPlayer = (options && typeof options.forcedByPlayer === 'object' && options.forcedByPlayer) ? options.forcedByPlayer : {};

    // Tournament mode: allow disabling power cards per room
    if (room && room.powerCardsEnabled === false) {
        playersList.forEach((p) => {
            if (!p || !p.id) return;
            byPlayer[p.id] = [];
        });
        room.powerCardsByPlayer = byPlayer;
        room.dealtLegendaryKeys = [];
        return;
    }

    const dealtLegendary = new Set();
    const allKeys = POWER_CARD_KEYS.slice().filter(k => !excludeSet.has(k));

    // Special-chance cards: enforced per-hand so probability is predictable.
    const SPECIAL_HAND_CHANCE = {
        blind: 0.30
    };

    const isEligibleForRole = (role, key) => {
        const def = getCardDef(key);
        if (!def) return false;
        const roles = Array.isArray(def.roles) ? def.roles : [];
        return roles.includes(role);
    };

    const weightedPick = (eligibleKeys) => {
        const keys = eligibleKeys.filter(Boolean);
        if (!keys.length) return null;
        let total = 0;
        const weights = keys.map(k => {
            const w = Math.max(0, Number(getCardDef(k)?.weight || 1));
            total += w;
            return w;
        });
        if (total <= 0) return keys[Math.floor(Math.random() * keys.length)];
        let r = Math.random() * total;
        for (let i = 0; i < keys.length; i++) {
            r -= weights[i];
            if (r <= 0) return keys[i];
        }
        return keys[keys.length - 1];
    };

    playersList.forEach((p) => {
        if (!p || !p.id) return;
        if (p.role !== 'OPERATIVE' && p.role !== 'SPYMASTER') return;

        const hand = [];
        const forcedKey = forcedByPlayer[p.id];
        if (forcedKey && !excludeSet.has(forcedKey) && isEligibleForRole(p.role, forcedKey)) {
            const def = getCardDef(forcedKey);
            const isLegendary = !!def?.legendary;
            if (!isLegendary || !dealtLegendary.has(forcedKey)) {
                hand.push(forcedKey);
                if (isLegendary) dealtLegendary.add(forcedKey);
            }
        }
        let guard = 0;
        while (hand.length < POWER_CARDS_PER_PLAYER && guard < 250) {
            guard++;
            const eligible = allKeys
                .filter(k => isEligibleForRole(p.role, k))
                .filter(k => !SPECIAL_HAND_CHANCE[k])
                .filter(k => !hand.includes(k))
                .filter(k => {
                    const def = getCardDef(k);
                    if (!def?.legendary) return true;
                    return !dealtLegendary.has(k);
                });

            const pick = weightedPick(eligible);
            if (!pick) break;
            const def = getCardDef(pick);
            hand.push(pick);
            if (def?.legendary) dealtLegendary.add(pick);
        }

        // Inject special-chance cards (max 1 copy per hand)
        Object.keys(SPECIAL_HAND_CHANCE).forEach((k) => {
            const chance = Number(SPECIAL_HAND_CHANCE[k] || 0);
            if (!(chance > 0)) return;
            if (!isEligibleForRole(p.role, k)) return;
            if (hand.includes(k)) return;
            if (Math.random() >= chance) return;

            // Avoid replacing a forced pick (forced is inserted at index 0)
            if (hand.length > 1 && forcedKey && hand[0] === forcedKey) {
                const replaceIdx = 1 + Math.floor(Math.random() * (hand.length - 1));
                const removed = hand[replaceIdx];
                const removedDef = getCardDef(removed);
                if (removedDef?.legendary) dealtLegendary.delete(removed);
                hand[replaceIdx] = k;
            } else if (hand.length > 0) {
                // If the hand only has the forced pick, skip injection to preserve it.
                if (forcedKey && hand[0] === forcedKey) return;
                const replaceIdx = Math.floor(Math.random() * hand.length);
                const removed = hand[replaceIdx];
                const removedDef = getCardDef(removed);
                if (removedDef?.legendary) dealtLegendary.delete(removed);
                hand[replaceIdx] = k;
            } else {
                hand.push(k);
            }
        });
        byPlayer[p.id] = hand;
    });

    room.powerCardsByPlayer = byPlayer;
    room.dealtLegendaryKeys = Array.from(dealtLegendary);
}

function emitPowerCardsToConnectedPlayers(room) {
    if (!room || !room.powerCardsByPlayer) return;
    const playersList = Array.isArray(room.players) ? room.players : [];
    playersList.forEach((p) => {
        if (!p || !p.id) return;
        const s = io.sockets.sockets.get(p.id);
        if (!s) return;
        const cards = Array.isArray(room.powerCardsByPlayer[p.id]) ? room.powerCardsByPlayer[p.id] : [];
        io.to(p.id).emit('power-cards', { cards });
    });
}

// Word sets by category
const wordSets = {
    genel: [
        'ELMA', 'KAPI', 'GÖL', 'YILDIZ', 'KİTAP',
        'MASA', 'KALE', 'AĞAÇ', 'DENIZ', 'GÜNEŞ',
        'AY', 'KÖPRÜ', 'KUTU', 'KUPA', 'SAAT',
        'YÜZÜK', 'KEDI', 'KÖPEK', 'ARABA', 'UÇAK',
        'BALIK', 'KUŞ', 'SU', 'ATEŞ', 'TOPRAK'
    ],
    hayvanlar: [
        'ASLAN', 'KAPLAN', 'AYACIK', 'KURT', 'FOX',
        'TAVŞAN', 'SINCAP', 'KIRPI', 'GELINCIK', 'AY AYI',
        'PENGUEN', 'BAYKUŞ', 'KARTAL', 'ŞAHIN', 'YEŞILBAŞ',
        'PAPAĞAN', 'ÖSÜ', 'KENGURULı', 'DEVE', 'ZÜRAFA'
    ],
    ülkeler: [
        'TÜRKIYE', 'FRANSA', 'İTALYA', 'İSPANYA', 'ALMANYA',
        'İNGİLTERE', 'RUSYA', 'ÇINA', 'JAPONYA', 'KORE',
        'HINDISTAN', 'BRAZİLYA', 'ARJANTIN', 'KANADA', 'AVUSTRALYA'
    ],
    yemekler: [
        'PIZZA', 'BURGER', 'PASTA', 'PILAV', 'KÖFTELİ',
        'DÖNER', 'KEBAP', 'TATLISI', 'BAKLAVA', 'HELVASı',
        'PASTA', 'KEKE', 'TART', 'DONUT', 'KRUVASAN',
        'EKMEK', 'SIMIT', 'SAÇ', 'LAVAŞı', 'MANTI'
    ],
    spor: [
        'FUTBOL', 'BASKETBOL', 'VOLEYBOL', 'TENİS', 'BADMINTON',
        'YÜZME', 'DALGIÇ', 'KOŞU', 'ATLETİZM', 'GÜREŞ',
        'BOKS', 'JİDO', 'KARATE', 'GYMNASTİK', 'AKROBAT'
    ],
    teknoloji: [
        'TELEFON', 'BİLGİSAYAR', 'LAPTOP', 'TABLET', 'SMARTWATCH',
        'DRONE', 'ROBOT', 'REZİL', 'INTERNET', 'WİFİ',
        'KABLOSUZ', 'SENSOR', 'KAMERA', 'MİKROFON', 'HOPARLÖR'
    ],
    renk: [
        'KIRMIZI', 'MAVI', 'YEŞİL', 'SARI', 'SİYAH',
        'BEYAZ', 'PEMBE', 'MOR', 'TURUNCU', 'GÜMÜŞ',
        'ALTIN', 'BAKIR', 'BRONZ', 'YEŞIL TÜRü', 'AÇIK MAVİ'
    ]
};

function normalizeWord(raw) {
    if (!raw) return '';
    return raw
        .trim()
        .replace(/^\uFEFF/, '')
        .replace(/\s+/g, ' ')
        .toUpperCase('tr-TR');
}

function loadWordListFromFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, 'utf8');
        const words = content
            .split(/\r?\n/)
            .map(normalizeWord)
            .filter(Boolean)
            .filter(w => !w.startsWith('#'));

        const unique = Array.from(new Set(words));
        return unique.length >= 25 ? unique : null;
    } catch (_) {
        return null;
    }
}

const externalWordSets = {};
['genel', 'hayvanlar', 'ülkeler', 'yemekler', 'spor', 'teknoloji', 'renk'].forEach((category) => {
    const filePath = path.join(__dirname, 'wordlists', `${category}.txt`);
    const loaded = loadWordListFromFile(filePath);
    if (loaded) externalWordSets[category] = loaded;
});

function getWordList(category) {
    return externalWordSets[category] || wordSets[category] || wordSets['genel'];
}

// Serve static files
app.use(express.static(path.join(__dirname)));

function httpsGetJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
            let data = '';
            resp.on('data', (chunk) => { data += chunk; });
            resp.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: resp.statusCode || 0, body: parsed });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function isSafeTenorMediaUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'https:') return false;
        const host = u.hostname.toLowerCase();
        return host === 'media.tenor.com' || host.endsWith('.tenor.com');
    } catch (_) {
        return false;
    }
}

// Tenor GIF proxy (client calls /api/tenor/search?q=...)
app.get('/api/tenor/search', async (req, res) => {
    const key = process.env.TENOR_KEY;
    if (!key) {
        res.status(501).json({ error: 'TENOR_KEY ayarlı değil (server env). GIF araması devre dışı.' });
        return;
    }

    const q = String(req.query.q || '').trim();
    if (!q) {
        res.status(400).json({ error: 'q parametresi gerekli' });
        return;
    }

    const limitRaw = Number(req.query.limit || 16);
    const limit = Math.max(1, Math.min(24, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 16));

    const url = new URL('https://tenor.googleapis.com/v2/search');
    url.searchParams.set('q', q);
    url.searchParams.set('key', key);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('media_filter', 'gif,tinygif');
    url.searchParams.set('contentfilter', 'low');

    try {
        const { statusCode, body } = await httpsGetJson(url.toString());
        if (statusCode < 200 || statusCode >= 300) {
            res.status(502).json({ error: 'Tenor isteği başarısız.' });
            return;
        }

        const results = Array.isArray(body?.results) ? body.results : [];
        const mapped = results
            .map(r => {
                const formats = r?.media_formats || {};
                const preview = formats?.tinygif?.url || formats?.gif?.url || '';
                const url = formats?.gif?.url || formats?.tinygif?.url || '';
                if (!preview || !url) return null;
                if (!isSafeTenorMediaUrl(url) || !isSafeTenorMediaUrl(preview)) return null;
                return { url, preview };
            })
            .filter(Boolean);

        res.json({ results: mapped });
    } catch (e) {
        res.status(502).json({ error: 'Tenor bağlantı hatası.' });
    }
});

// Store active rooms and players
let rooms = [];
let players = new Map(); // socket.id -> player info

function initDraftState(room) {
    if (!room) return null;
    const shuffled = shuffleInPlace(POWER_CARD_KEYS.slice());
    const available = shuffled.slice();

    const picksPerTeam = Math.max(1, Math.min(8, Number.isFinite(Number(room.draftPicksPerTeam)) ? Math.floor(Number(room.draftPicksPerTeam)) : 4));
    room.draftState = {
        phase: 'LIVE',
        available,
        picked: { RED: [], BLUE: [] },
        turnTeam: 'RED',
        round: 1,
        picksPerTeam,
        anim: null,
        lastResult: null
    };
    return room.draftState;
}

function emitSharedPowerCardsToTeam(room, team) {
    if (!room || (team !== 'RED' && team !== 'BLUE')) return;
    const cards = Array.isArray(room.teamPowerCards?.[team]) ? room.teamPowerCards[team] : [];
    const playersList = Array.isArray(room.players) ? room.players : [];
    playersList
        .filter(p => p && p.id && p.team === team && (p.role === 'OPERATIVE' || p.role === 'SPYMASTER'))
        .forEach(p => {
            const s = io.sockets.sockets.get(p.id);
            if (!s) return;
            io.to(p.id).emit('power-cards', { cards });
        });
}

function buildDraftReel(allKeys, winnerKey) {
    const base = Array.isArray(allKeys) ? allKeys.filter(Boolean) : [];
    const items = [];
    const total = 34;
    const stopIndex = 26;
    for (let i = 0; i < total; i++) {
        if (i === stopIndex) {
            items.push(winnerKey);
            continue;
        }
        const pick = base.length ? base[Math.floor(Math.random() * base.length)] : winnerKey;
        items.push(pick);
    }
    return { items, stopIndex };
}

function emitDraft(room) {
    if (!room) return;
    io.to(room.id).emit('draft-updated', room.draftState || null);
}

function performDraftSpin(room, team, durationMs = 2800) {
    if (!room || !room.gameState) return false;
    if (room.powerCardsEnabled === false) return false;
    if (!room.draftState || room.draftState.phase !== 'LIVE') return false;
    if (!room.gameState.currentTurn || room.gameState.currentTurn.phase !== 'DRAFT') return false;
    if (team !== 'RED' && team !== 'BLUE') return false;

    const d = room.draftState;
    const now = Date.now();
    if (d.anim && d.anim.endsAt && now < d.anim.endsAt) return false;
    if (d.turnTeam !== team) return false;

    const available = Array.isArray(d.available) ? d.available : [];
    if (available.length === 0) {
        d.phase = 'DONE';
        emitDraft(room);
        return false;
    }

    const picksPerTeam = Math.max(1, Math.min(12, Number(d.picksPerTeam || 4)));
    const alreadyPickedRed = Array.isArray(d.picked?.RED) ? d.picked.RED.length : 0;
    const alreadyPickedBlue = Array.isArray(d.picked?.BLUE) ? d.picked.BLUE.length : 0;
    if (alreadyPickedRed >= picksPerTeam && alreadyPickedBlue >= picksPerTeam) {
        d.phase = 'DONE';
        emitDraft(room);
        return false;
    }

    const winnerKey = available[Math.floor(Math.random() * available.length)];
    const reel = buildDraftReel(POWER_CARD_KEYS, winnerKey);
    const ms = Number.isFinite(durationMs) ? durationMs : 2800;
    d.anim = {
        team,
        winnerKey,
        reel,
        endsAt: now + ms
    };
    emitDraft(room);
    io.to(room.id).emit('draft-spin-start', {
        team,
        winnerKey,
        reel,
        durationMs: ms
    });

    const roomId = room.id;
    setTimeout(() => {
        const r = rooms.find(x => x.id === roomId);
        if (!r || !r.draftState) return;
        const dd = r.draftState;
        if (dd.phase !== 'LIVE') return;

        const picksPerTeamInner = Math.max(1, Math.min(12, Number(dd.picksPerTeam || 4)));

        const availNow = Array.isArray(dd.available) ? dd.available : [];
        dd.available = availNow.filter(k => k !== winnerKey);
        dd.picked = dd.picked || { RED: [], BLUE: [] };
        dd.picked[team] = Array.isArray(dd.picked[team]) ? dd.picked[team] : [];
        dd.picked[team].push(winnerKey);
        dd.lastResult = { type: 'SPIN', team, cardKey: winnerKey };
        dd.round = Number(dd.round || 1) + 1;
        dd.turnTeam = team === 'RED' ? 'BLUE' : 'RED';
        dd.anim = null;

        const redCount = Array.isArray(dd.picked?.RED) ? dd.picked.RED.length : 0;
        const blueCount = Array.isArray(dd.picked?.BLUE) ? dd.picked.BLUE.length : 0;
        if (redCount >= picksPerTeamInner && blueCount >= picksPerTeamInner) {
            dd.phase = 'DONE';
            r.teamPowerCards = {
                RED: Array.isArray(dd.picked?.RED) ? dd.picked.RED.slice(0, picksPerTeamInner) : [],
                BLUE: Array.isArray(dd.picked?.BLUE) ? dd.picked.BLUE.slice(0, picksPerTeamInner) : []
            };
            if (r.gameState && r.gameState.currentTurn) {
                r.gameState.currentTurn.phase = 'HINT';
                r.gameState.currentClue = null;
                r.gameState.guessesRemaining = 0;
                r.gameState.turnMeta = { firstSelectionMade: false, correctGuesses: 0, wrongGuess: false };
            }
            r.draftState = null;
            emitDraft(r);
            emitGameStateSync(r, 'draft-done');
            emitSharedPowerCardsToTeam(r, 'RED');
            emitSharedPowerCardsToTeam(r, 'BLUE');

            // If the current team's spymaster/operatives are bots, continue automatically.
            // (Draft ends without calling handleBotTurns elsewhere.)
            setTimeout(() => handleBotTurns(r), 600);
            return;
        }

        emitDraft(r);
        // If next team is bot-only, keep draft moving.
        setTimeout(() => handleBotDraft(r), 650);
    }, ms);

    return true;
}

function handleBotDraft(room) {
    if (!room || !room.gameState) return;
    if (room.powerCardsEnabled === false) return;
    if (!room.draftState || room.draftState.phase !== 'LIVE') return;
    if (room.gameState.currentTurn?.phase !== 'DRAFT') return;

    const d = room.draftState;
    if (d.anim) return;
    const team = d.turnTeam;
    if (team !== 'RED' && team !== 'BLUE') return;

    const hasBotOnTeam = (room.players || []).some(p => p && p.isBot && p.team === team);
    if (!hasBotOnTeam) return;

    // Only auto-spin if there are no real players on that team.
    const hasRealOnTeam = (room.players || []).some(p => p && !p.isBot && p.team === team);
    if (hasRealOnTeam) return;

    performDraftSpin(room, team, 2600);
}

function ensureRoomSuspicion(room) {
    if (!room) return null;
    if (!room.suspicionByTeam) {
        room.suspicionByTeam = { RED: {}, BLUE: {} }; // team -> { [cardIndex]: [playerId...] }
    }
    return room.suspicionByTeam;
}

function emitSuspicionToTeamOperatives(room, team) {
    if (!room || (team !== 'RED' && team !== 'BLUE')) return;
    const store = ensureRoomSuspicion(room);
    const raw = store?.[team] || {};
    const marks = {};
    Object.keys(raw).forEach(k => {
        const arr = Array.isArray(raw[k]) ? raw[k] : [];
        if (arr.length > 0) marks[k] = arr.length;
    });
    const playersList = Array.isArray(room.players) ? room.players : [];
    playersList
        .filter(p => p && p.id && p.team === team && p.role === 'OPERATIVE')
        .forEach(p => io.to(p.id).emit('suspicion-update', { team, marks }));
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    function requirePlayer() {
        const player = players.get(socket.id);
        if (!player) {
            socket.emit('error', 'Önce giriş yapmalısın');
            return null;
        }
        return player;
    }

    // Player login
    socket.on('login', (username) => {
        console.log(`Login attempt: ${username} (${socket.id})`);
        const pl = {
            id: socket.id,
            username: username,
            roomId: null,
            team: null,
            role: null,
            hornState: { cooldownUntil: 0, lockedUntil: 0, usesSinceLock: 0 },
            fxState: { cooldownUntil: 0 }
        };
        // Daily missions disabled.
        players.set(socket.id, pl);
        socket.emit('login-success', { playerId: socket.id, username: username });
        console.log(`Login success: ${username}`);
    });

    // Horn (rate-limited, everyone hears)
    socket.on('horn', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;

        if (!player.hornState) {
            player.hornState = { cooldownUntil: 0, lockedUntil: 0, usesSinceLock: 0 };
        }

        const now = Date.now();
        const state = player.hornState;

        if (state.lockedUntil && now < state.lockedUntil) {
            socket.emit('horn-denied', { reason: 'locked', retryMs: state.lockedUntil - now });
            return;
        }
        if (state.cooldownUntil && now < state.cooldownUntil) {
            socket.emit('horn-denied', { reason: 'cooldown', retryMs: state.cooldownUntil - now });
            return;
        }

        // Allowed: broadcast
        io.to(room.id).emit('horn', {
            playerName: player.username,
            team: player.team || null,
            timestamp: new Date().toISOString()
        });

        // Apply cooldown
        state.cooldownUntil = now + 3000;
        state.usesSinceLock = Number(state.usesSinceLock || 0) + 1;

        // After 5 uses, lock for 1 minute
        if (state.usesSinceLock >= 5) {
            state.lockedUntil = now + 60000;
            state.usesSinceLock = 0;
        }
    });

    // Get rooms list
    socket.on('get-rooms', () => {
        socket.emit('rooms-list', rooms);
    });

    // Create room
    socket.on('create-room', (data) => {
        const player = requirePlayer();
        if (!player) return;

        // If player is already in a room, leave it first (server-authoritative)
        if (player.roomId) {
            const oldRoom = rooms.find(r => r.id === player.roomId);
            if (oldRoom) {
                oldRoom.players = oldRoom.players.filter(p => p && p.id !== socket.id);
                if (!maybeCloseRoomIfNoRealPlayers(oldRoom, 'no-real-players')) {
                    // If host left, reassign
                    if (oldRoom.host === socket.id) {
                        const nextHost = oldRoom.players.find(p => p && !p.isBot);
                        oldRoom.host = (nextHost && nextHost.id) ? nextHost.id : (oldRoom.players[0] && oldRoom.players[0].id);
                    }
                    io.to(oldRoom.id).emit('room-updated', oldRoom);
                }
            }
            try { socket.leave(player.roomId); } catch (_) { /* ignore */ }
            player.roomId = null;
            player.team = null;
            player.role = null;
            io.emit('rooms-list', rooms);
        }

        const { name, maxPlayers, wordCategory, powerCardsEnabled, draftPicksPerTeam, fastDraft } = data;
        const roomId = generateRoomId();
        const inviteCode = generateInviteCode();
        const picksPerTeam = Math.max(1, Math.min(8, Number.isFinite(Number(draftPicksPerTeam)) ? Math.floor(Number(draftPicksPerTeam)) : 4));
        const room = {
            id: roomId,
            name: name,
            maxPlayers: maxPlayers,
            players: [player],
            gameStarted: false,
            host: socket.id,
            inviteCode: inviteCode,
            wordCategory: wordCategory || 'genel',
            powerCardsEnabled: (typeof powerCardsEnabled === 'boolean') ? powerCardsEnabled : true,
            draftPicksPerTeam: picksPerTeam,
            fastDraft: (typeof fastDraft === 'boolean') ? fastDraft : true
        };
        rooms.push(room);
        player.roomId = roomId;
        socket.join(roomId);
        // Inform creator immediately with full room payload (same shape as join)
        socket.emit('room-joined', room);
        socket.emit('room-created', { roomId: room.id });
        io.to(roomId).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Host-only: set how many draft spins/picks each team gets (pre-game)
    socket.on('set-draft-picks-per-team', (value) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;
        if (room.host !== socket.id) {
            socket.emit('error', 'Sadece host draft sayısını ayarlayabilir');
            return;
        }
        if (room.gameStarted) {
            socket.emit('error', 'Oyun başladıktan sonra değiştirilemez');
            return;
        }

        const picksPerTeam = Math.max(1, Math.min(8, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 4));
        room.draftPicksPerTeam = picksPerTeam;
        io.to(room.id).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Join room
    socket.on('join-room', (roomId) => {
        const player = requirePlayer();
        if (!player) return;
        
        // Eğer oyuncu zaten bir odada varsa, öncekinden ayrıl
        if (player.roomId && player.roomId !== roomId) {
            const oldRoom = rooms.find(r => r.id === player.roomId);
            if (oldRoom) {
                oldRoom.players = oldRoom.players.filter(p => p.id !== socket.id);
                if (!maybeCloseRoomIfNoRealPlayers(oldRoom, 'no-real-players')) {
                    if (oldRoom.host === socket.id) {
                        const nextHost = oldRoom.players.find(p => p && !p.isBot);
                        oldRoom.host = (nextHost && nextHost.id) ? nextHost.id : (oldRoom.players[0] && oldRoom.players[0].id);
                    }
                    io.to(oldRoom.id).emit('room-updated', oldRoom);
                }
                socket.leave(player.roomId);
            }
        }
        
        const room = rooms.find(r => r.id === roomId);
        if (!room) {
            socket.emit('join-error', 'Oda bulunamadı - kapatılmış olabilir');
            socket.emit('error', 'Oda bulunamadı - kapatılmış olabilir');
            return;
        }
        if (room.players.length >= room.maxPlayers) {
            socket.emit('join-error', 'Oda dolu');
            socket.emit('error', 'Oda dolu');
            return;
        }
        if (room.gameStarted) {
            socket.emit('join-error', 'Oyun zaten başladı');
            socket.emit('error', 'Oyun zaten başladı');
            return;
        }
        
        // Oyuncu zaten bu odada mı?
        if (!room.players.find(p => p.id === socket.id)) {
            room.players.push(player);
        }
        player.roomId = roomId;
        socket.join(roomId);
        socket.emit('room-joined', room);
        io.to(roomId).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Join room by invite code
    socket.on('join-by-code', (inviteCode) => {
        const player = requirePlayer();
        if (!player) return;
        
        // Eğer oyuncu zaten bir odada varsa, öncekinden ayrıl
        if (player.roomId) {
            const oldRoom = rooms.find(r => r.id === player.roomId);
            if (oldRoom) {
                oldRoom.players = oldRoom.players.filter(p => p.id !== socket.id);
                if (!maybeCloseRoomIfNoRealPlayers(oldRoom, 'no-real-players')) {
                    if (oldRoom.host === socket.id) {
                        const nextHost = oldRoom.players.find(p => p && !p.isBot);
                        oldRoom.host = (nextHost && nextHost.id) ? nextHost.id : (oldRoom.players[0] && oldRoom.players[0].id);
                    }
                    io.to(oldRoom.id).emit('room-updated', oldRoom);
                }
                socket.leave(player.roomId);
            }
        }
        
        const room = rooms.find(r => r.inviteCode === inviteCode);
        if (!room) {
            socket.emit('join-error', 'Geçersiz kod - oda kapatılmış olabilir');
            socket.emit('error', 'Geçersiz kod - oda kapatılmış olabilir');
            return;
        }
        if (room.players.length >= room.maxPlayers) {
            socket.emit('join-error', 'Oda dolu');
            socket.emit('error', 'Oda dolu');
            return;
        }
        if (room.gameStarted) {
            socket.emit('join-error', 'Oyun zaten başladı');
            socket.emit('error', 'Oyun zaten başladı');
            return;
        }
        
        // Oyuncu zaten bu odada mı?
        if (!room.players.find(p => p.id === socket.id)) {
            room.players.push(player);
        }
        player.roomId = room.id;
        socket.join(room.id);
        socket.emit('room-joined', room);
        io.to(room.id).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Leave room
    socket.on('leave-room', () => {
        const player = players.get(socket.id);
        if (!player) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                if (!maybeCloseRoomIfNoRealPlayers(room, 'no-real-players')) {
                    // If host left, reassign host
                    if (room.host === socket.id) {
                        const nextHost = room.players.find(p => p && !p.isBot);
                        room.host = (nextHost && nextHost.id) ? nextHost.id : room.players[0].id;
                    }
                    io.to(player.roomId).emit('room-updated', room);
                }
                socket.leave(player.roomId);
                io.emit('rooms-list', rooms);
            }
            player.roomId = null;
            player.team = null;
            player.role = null;
        }
    });

    // Host-only: close the room immediately and send everyone back to lobby
    socket.on('close-room', () => {
        const player = requirePlayer();
        if (!player) return;
        if (!player.roomId) {
            socket.emit('error', 'Oda bulunamadı');
            return;
        }
        const room = rooms.find(r => r.id === player.roomId);
        if (!room) {
            socket.emit('error', 'Oda bulunamadı - kapatılmış olabilir');
            return;
        }
        if (room.host !== socket.id) {
            socket.emit('error', 'Sadece host lobiyi kapatabilir');
            return;
        }
        closeRoomNow(room.id, 'host-closed');
    });

    // Join team
    socket.on('join-team', (data) => {
        const { team, role } = data;
        const player = requirePlayer();
        if (!player) return;
        if (player.roomId) {
            player.team = team;
            player.role = role;
            const room = rooms.find(r => r.id === player.roomId);
            io.to(player.roomId).emit('room-updated', room);
        }
    });

    // Randomly assign teams to all players
    socket.on('random-teams', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room) {
                if (room.host !== socket.id) {
                    socket.emit('error', 'Sadece host takımları karıştırabilir');
                    return;
                }
                // Reset all team assignments and randomly assign
                room.players.forEach(p => {
                    const rand = Math.random();
                    p.team = rand > 0.5 ? 'RED' : 'BLUE';
                    p.role = Math.random() > 0.5 ? 'SPYMASTER' : 'OPERATIVE';
                });
                io.to(player.roomId).emit('room-updated', room);
            }
        }
    });

    // Add bot
    socket.on('add-bot', (data) => {
        const { team, role } = data;
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room) return;
            if (room.host !== socket.id) {
                socket.emit('bot-error', 'Sadece host bot ekleyebilir');
                socket.emit('error', 'Sadece host bot ekleyebilir');
                return;
            }
            // Check if role is taken
            const existingBot = room.players.find(p => p.team === team && p.role === role && p.isBot);
            if (existingBot) {
                socket.emit('bot-error', 'Bu rol için zaten bot var');
                socket.emit('error', 'Bu rol için zaten bot var');
                return;
            }
            const botId = `bot-${team.toLowerCase()}-${role.toLowerCase()}-${Date.now()}`;
            const botName = `Bot ${team === 'RED' ? '🔴' : '🔵'} ${role === 'SPYMASTER' ? 'Casusbaşı' : 'Operatif'}`;
            const bot = {
                id: botId,
                username: botName,
                team: team,
                role: role,
                isBot: true
            };
            room.players.push(bot);
            io.to(player.roomId).emit('room-updated', room);
        }
    });

    // Remove bot
    socket.on('remove-bot', (botId) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room) return;
            if (room.host !== socket.id) {
                socket.emit('error', 'Sadece host bot kaldırabilir');
                return;
            }
            room.players = room.players.filter(p => p.id !== botId);
            io.to(player.roomId).emit('room-updated', room);
        }
    });

    // Host-only: kick a player from the room
    socket.on('remove-player', (targetPlayerId) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;

        if (room.host !== socket.id) {
            socket.emit('error', 'Sadece host oyuncu atabilir');
            return;
        }

        if (!targetPlayerId || typeof targetPlayerId !== 'string') return;
        if (targetPlayerId === socket.id) {
            socket.emit('error', 'Host kendini atamaz');
            return;
        }

        const target = players.get(targetPlayerId);
        if (!target || target.roomId !== room.id) {
            socket.emit('error', 'Oyuncu odada değil');
            return;
        }

        // Remove from room list
        room.players = (room.players || []).filter(p => p && p.id !== targetPlayerId);

        // If no real players remain, close room right away.
        if (maybeCloseRoomIfNoRealPlayers(room, 'no-real-players')) {
            return;
        }

        // Clear server-side player state
        target.roomId = null;
        target.team = null;
        target.role = null;

        // Force socket to leave the room
        const targetSocket = io.sockets.sockets.get(targetPlayerId);
        if (targetSocket) {
            try { targetSocket.leave(room.id); } catch (_) { /* ignore */ }
            io.to(targetPlayerId).emit('kicked', { roomId: room.id });
        }

        // If room becomes empty, delete it
        if (room.players.length === 0) {
            rooms = rooms.filter(r => r.id !== room.id);
            io.emit('rooms-list', rooms);
            return;
        }

        io.to(room.id).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Start game
    socket.on('start-game', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room && room.host === socket.id && room.players.length >= 2) {
                room.gameStarted = true;
                // Initialize game state with word category
                room.gameState = initializeGameState(room.players, room.wordCategory);

                // New competitive draft: after game starts, open vote+dice draft for 8 random power cards
                if (room.powerCardsEnabled !== false) {
                    if (room.fastDraft) {
                        // Fast draft: skip draft phase, deal cards directly
                        dealPowerCardsForRoom(room);
                        emitPowerCardsToConnectedPlayers(room);
                    } else {
                        if (room.gameState && room.gameState.currentTurn) {
                            room.gameState.currentTurn.phase = 'DRAFT';
                        }
                        initDraftState(room);
                        room.teamPowerCards = { RED: [], BLUE: [] };
                        // Clear any previous hands in UI
                        room.powerCardsByPlayer = {};
                        (Array.isArray(room.players) ? room.players : []).forEach(p => {
                            if (!p || !p.id) return;
                            if (p.role !== 'OPERATIVE' && p.role !== 'SPYMASTER') return;
                            room.powerCardsByPlayer[p.id] = [];
                            const s = io.sockets.sockets.get(p.id);
                            if (s) io.to(p.id).emit('power-cards', { cards: [] });
                        });
                        emitDraft(room);
                        setTimeout(() => handleBotDraft(room), 700);
                    }
                } else {
                    dealPowerCardsForRoom(room);
                }
                io.to(player.roomId).emit('game-started', room.gameState);
                if (room.powerCardsEnabled === false || room.fastDraft) {
                    emitPowerCardsToConnectedPlayers(room);
                } else {
                    emitDraft(room);
                    setTimeout(() => handleBotDraft(room), 700);
                }
                emitGameStateSync(room, 'game-started');
                // Handle initial bot turn if needed
                setTimeout(() => handleBotTurns(room), 500);
            }
        }
    });

    // Draft (sequential spin) - happens after game started
    const spinHandler = () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room || !room.gameState) return;
        if (room.powerCardsEnabled === false) return;
        if (!room.draftState || room.draftState.phase !== 'LIVE') return;
        const team = player.team;
        if (team !== 'RED' && team !== 'BLUE') return;

        const d = room.draftState;
        const now = Date.now();
        if (d.anim && d.anim.endsAt && now < d.anim.endsAt) return;

        const turn = d.turnTeam;
        if (turn !== team) {
            socket.emit('error', `Sıra ${turn === 'RED' ? 'Kırmızı' : 'Mavi'} takımda`);
            return;
        }

        performDraftSpin(room, team, 2800);
    };

    socket.on('draft-spin', spinHandler);
    // Backward compatibility: client used to emit draft-roll
    socket.on('draft-roll', spinHandler);

    // Restart game without leaving room
    socket.on('restart-game', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room && room.host === socket.id) {
                room.gameStarted = true;
                room.gameState = initializeGameState(room.players, room.wordCategory);
                if (room.powerCardsEnabled !== false) {
                    if (room.gameState && room.gameState.currentTurn) {
                        room.gameState.currentTurn.phase = 'DRAFT';
                    }
                    initDraftState(room);
                    room.teamPowerCards = { RED: [], BLUE: [] };
                    room.powerCardsByPlayer = {};
                    (Array.isArray(room.players) ? room.players : []).forEach(p => {
                        if (!p || !p.id) return;
                        if (p.role !== 'OPERATIVE' && p.role !== 'SPYMASTER') return;
                        room.powerCardsByPlayer[p.id] = [];
                        const s = io.sockets.sockets.get(p.id);
                        if (s) io.to(p.id).emit('power-cards', { cards: [] });
                    });
                } else {
                    dealPowerCardsForRoom(room);
                }
                io.to(room.id).emit('game-restarted', room.gameState);
                if (room.powerCardsEnabled === false) {
                    emitPowerCardsToConnectedPlayers(room);
                } else {
                    emitDraft(room);
                    setTimeout(() => handleBotDraft(room), 700);
                }
                emitGameStateSync(room, 'game-restarted');
                setTimeout(() => handleBotTurns(room), 500);
            }
        }
    });

    // Tournament toggle: enable/disable power cards in the room (host only, pre-game)
    socket.on('toggle-power-cards', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;
        if (room.host !== socket.id) {
            socket.emit('error', 'Sadece host power cards ayarlayabilir');
            return;
        }
        if (room.gameStarted) {
            socket.emit('error', 'Oyun başladıktan sonra değiştirilemez');
            return;
        }

        const enabledNow = (room.powerCardsEnabled !== false);
        room.powerCardsEnabled = !enabledNow;
        io.to(room.id).emit('room-updated', room);
        io.emit('rooms-list', rooms);
    });

    // Return to team selection / lobby view for the room
    socket.on('return-to-teams', () => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room) return;
            if (room.host === socket.id) {
                room.gameStarted = false;
                room.gameState = null;
                room.powerCardsByPlayer = null;
                room.draftState = null;
                room.teamPowerCards = null;
                room.suspicionByTeam = null;
                room.players.forEach(p => {
                    p.team = null;
                    p.role = null;
                });
                io.to(room.id).emit('returned-to-teams', room);
                io.emit('rooms-list', rooms);
            }
        }
    });

    // Handle game actions (clues, guesses, etc.)
    socket.on('give-clue', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room || !room.gameState) return;

            // Only spymaster of the current team can give clue
            if (
                player.role !== 'SPYMASTER' ||
                player.team !== room.gameState.currentTurn.team ||
                room.gameState.currentTurn.phase !== 'HINT'
            ) {
                socket.emit('error', 'Şu an ipucu veremezsin');
                return;
            }

            const effects = ensurePowerEffects(room.gameState);
            const meta = ensureTurnMeta(room.gameState);
            // New clue cycle: reset counters for daily mission tracking
            meta.firstSelectionMade = false;
            meta.correctGuesses = 0;
            meta.wrongGuess = false;

            const rawWord = (data && typeof data.word === 'string') ? data.word.trim() : '';
            const rawNumber = (data && Number.isFinite(data.number)) ? Number(data.number) : parseInt(data?.number, 10);
            const number = Number.isFinite(rawNumber) ? rawNumber : NaN;

            if (!rawWord) {
                socket.emit('error', 'Geçerli bir ipucu girin');
                return;
            }
            if (!Number.isFinite(number) || number < 0 || number > 9) {
                socket.emit('error', 'Geçerli bir sayı girin (0-9)');
                return;
            }

            const allowTwoWords = Number(effects?.clue?.allowTwoWords?.[player.team] || 0) > 0;
            const silent = Number(effects?.clue?.silent?.[player.team] || 0) > 0;
            const absolute = Number(effects?.clue?.absolute?.[player.team] || 0) > 0;

            const tokens = rawWord.split(/\s+/).filter(Boolean);
            if (!silent && !absolute) {
                // Normal clue must be 1 word, unless Extra Hint is active
                if (!allowTwoWords && tokens.length !== 1) {
                    socket.emit('error', 'İpucu tek kelime olmalı');
                    return;
                }
                if (allowTwoWords && (tokens.length < 1 || tokens.length > 2)) {
                    socket.emit('error', 'Ek İpucu ile en fazla 2 kelime verebilirsin');
                    return;
                }
            }

            let appliedNumber = number;
            const bend = Number(effects?.clue?.numberBend?.[player.team] || 0);
            if (bend === 1 || bend === -1) {
                appliedNumber = Math.max(0, Math.min(9, appliedNumber + bend));
            }

            // Process clue
            room.gameState.currentClue = {
                word: rawWord,
                number: appliedNumber,
                team: player.team,
                giver: player.username
            };
            room.gameState.currentTurn.phase = 'GUESS';
            room.gameState.guessesRemaining = appliedNumber + 1;

            // Apply any queued extra guesses from power cards (used before GUESS phase)
            applyPendingExtraGuessesIfAny(room.gameState, player.team);
            // IMPORTANT: client expects { clue, gameState }
            io.to(player.roomId).emit('clue-given', { clue: room.gameState.currentClue, gameState: room.gameState });
            emitGameStateSync(room, 'clue-given');
            // Handle bot turns
            setTimeout(() => handleBotTurns(room), 500);
        }
    });

    socket.on('make-guess', (cardIndex) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room || !room.gameState) return;
            const gameState = room.gameState;

            const idx = (typeof cardIndex === 'number')
                ? cardIndex
                : (typeof cardIndex === 'string' ? parseInt(cardIndex, 10) : NaN);
            if (!Number.isInteger(idx)) return;

            if (isBombLocked(gameState, idx)) {
                socket.emit('error', '💣 Bu kart 2 tur kilitli');
                return;
            }

            const effects = ensurePowerEffects(gameState);
            const locks = effects?.tactical?.wordLocks?.[player.team];
            if (Array.isArray(locks) && locks.includes(idx)) {
                socket.emit('error', 'Bu kelime bu tur kilitli');
                return;
            }

            // Check if it's the player's turn and they can guess
            if (player.team === gameState.currentTurn.team &&
                gameState.currentTurn.phase === 'GUESS' &&
                player.role === 'OPERATIVE' &&
                gameState.guessesRemaining > 0 &&
                gameState.board[idx] &&
                !gameState.board[idx].revealed &&
                !gameState.gameOver) {
                // Process guess
                processGuess(room, idx, player);
                io.to(player.roomId).emit('guess-made', {
                    cardIndex: idx,
                    gameState: room.gameState,
                    by: { name: player.username, team: player.team, role: player.role }
                });
                emitGameStateSync(room, 'guess-made');
                // Handle bot turns
                setTimeout(() => handleBotTurns(room), 500);
            } else {
                socket.emit('error', 'Şu an tahmin yapamazsın');
            }
        }
    });

    // Card pre-selection (Codenames-style): show who clicked before confirming
    socket.on('card-clicked', (payload) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.find(r => r.id === player.roomId);
        if (!room || !room.gameState) return;

        const raw = typeof payload === 'number' ? payload : payload?.cardIndex;
        const cardIndex = (typeof raw === 'number') ? raw : (typeof raw === 'string' ? parseInt(raw, 10) : NaN);
        if (!Number.isInteger(cardIndex)) return;

        const gameState = room.gameState;
        if (gameState.gameOver) return;
        if (!gameState.board[cardIndex] || gameState.board[cardIndex].revealed) return;

        if (isBombLocked(gameState, cardIndex)) {
            return;
        }

        const effects = ensurePowerEffects(gameState);
        const locks = effects?.tactical?.wordLocks?.[player.team];
        if (Array.isArray(locks) && locks.includes(cardIndex)) {
            io.to(player.id).emit('error', 'Bu kelime bu tur kilitli');
            return;
        }

        // Only current team operatives can mark cards, and only during GUESS phase
        if (
            player.role !== 'OPERATIVE' ||
            player.team !== gameState.currentTurn.team ||
            gameState.currentTurn.phase !== 'GUESS'
        ) {
            return;
        }

        // Mark that selection has started this turn
        const meta = ensureTurnMeta(gameState);
        meta.firstSelectionMade = true;

        const data = {
            cardIndex,
            playerId: player.id,
            playerName: player.username,
            team: player.team
        };

        // Only send to teammates (so other team doesn't see your selection)
        room.players
            .filter(p => p && p.team === player.team)
            .forEach(p => io.to(p.id).emit('card-clicked', data));
    });

    socket.on('reveal-card', (cardIndex) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId && player.role === 'SPYMASTER') {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room || !room.gameState) return;
            const idx = (typeof cardIndex === 'number')
                ? cardIndex
                : (typeof cardIndex === 'string' ? parseInt(cardIndex, 10) : NaN);
            if (!Number.isInteger(idx)) return;

            const card = room.gameState.board[idx];
            if (!card) return;
            if (!card.revealed) {
                // Save snapshot for potential rewind BEFORE changing state
                pushRevealHistory(room, idx, card.type);
                card.revealed = true;
                card.selector = player.username;
                // Update scores
                if (card.type === 'RED') room.gameState.redRemaining--;
                else if (card.type === 'BLUE') room.gameState.blueRemaining--;
                // Check win
                if (card.type === 'ASSASSIN') {
                    room.gameState.gameOver = true;
                    room.gameState.winner = room.gameState.currentTurn.team === 'RED' ? 'BLUE' : 'RED';
                    emitGameFinished(room, 'assassin');
                } else if (room.gameState.redRemaining === 0) {
                    room.gameState.gameOver = true;
                    room.gameState.winner = 'RED';
                    emitGameFinished(room, 'all-cards-found');
                } else if (room.gameState.blueRemaining === 0) {
                    room.gameState.gameOver = true;
                    room.gameState.winner = 'BLUE';
                    emitGameFinished(room, 'all-cards-found');
                }
                io.to(player.roomId).emit('card-revealed', {
                    cardIndex: idx,
                    gameState: room.gameState,
                    by: { name: player.username, team: player.team, role: player.role }
                });
            }
        }
    });

    // End turn
    socket.on('end-turn', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room && room.gameState) {
                // Switch teams (respect skip-turn/silence effects)
                switchToNextTeamTurn(room);
                io.to(player.roomId).emit('turn-ended', room.gameState);
                // Handle bot turns if needed
                setTimeout(() => handleBotTurns(room), 500);
            }
        }
    });

    // Power Card usage
    socket.on('use-power-card', (data) => {
        const player = players.get(socket.id);
        const cardKey = typeof data === 'string' ? data : data?.cardKey;
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room && room.gameState) {
                if (room.powerCardsEnabled === false) {
                    socket.emit('power-card-error', 'Bu odada güç kartları kapalı');
                    return;
                }
                if (!cardKey || typeof cardKey !== 'string' || !cardKey.trim()) {
                    socket.emit('power-card-error', 'Geçersiz güç kartı');
                    return;
                }
                if (!POWER_CARD_KEYS.includes(cardKey)) {
                    socket.emit('power-card-error', 'Geçersiz güç kartı');
                    return;
                }

                const def = getCardDef(cardKey);
                if (!def) {
                    socket.emit('power-card-error', 'Geçersiz güç kartı');
                    return;
                }

                if (room.gameState.gameOver) {
                    socket.emit('power-card-error', 'Oyun bittiği için güç kartı kullanılamaz');
                    return;
                }

                if (room.gameState.currentTurn?.phase === 'DRAFT') {
                    socket.emit('power-card-error', 'Draft bitmeden güç kartı kullanılamaz');
                    return;
                }

                const currentTurnTeam = room.gameState.currentTurn?.team;
                const effects = ensurePowerEffects(room.gameState);
                const meta = ensureTurnMeta(room.gameState);

                // Default: use on your own turn. Exception: mind-reading is on opponent GUESS turn.
                const isMindReading = cardKey === 'mind-reading';
                const isUnoReverse = cardKey === 'uno-reverse';
                if (currentTurnTeam) {
                    if (!isMindReading && !isUnoReverse && player.team !== currentTurnTeam) {
                        socket.emit('power-card-error', 'Güç kartını sadece kendi sıranızda kullanabilirsiniz');
                        return;
                    }
                    if (isMindReading && player.team === currentTurnTeam) {
                        socket.emit('power-card-error', 'Bu kart rakip sırada kullanılır');
                        return;
                    }
                    if (isUnoReverse) {
                        if (player.team === currentTurnTeam) {
                            socket.emit('power-card-error', 'UNO Reverse rakip sırada kullanılır');
                            return;
                        }
                        if (room.gameState.currentTurn?.phase !== 'HINT') {
                            socket.emit('power-card-error', 'UNO Reverse sadece rakibin ipucu turunda kullanılabilir');
                            return;
                        }
                        if (room.gameState.currentClue) {
                            socket.emit('power-card-error', 'UNO Reverse: ipucu verildikten sonra kullanılamaz');
                            return;
                        }
                    }
                }

                // Role-based cards (spymaster/operative)
                const allowedRoles = Array.isArray(def.roles) ? def.roles : [];
                if (!allowedRoles.includes(player.role)) {
                    socket.emit('power-card-error', 'Bu güç kartını bu rolde kullanamazsın');
                    return;
                }

                // Timing: must be used before the first guess is made in the affected GUESS phase.
                if (room.gameState.currentTurn?.phase === 'GUESS') {
                    const guessAlreadyStarted = (meta.wrongGuess === true) || (Number(meta.correctGuesses || 0) > 0);
                    if (guessAlreadyStarted) {
                        socket.emit('power-card-error', 'Bu tur ilk tahminden sonra güç kartı kullanılamaz');
                        return;
                    }
                }

                const sharedTeamMode = !!(room.teamPowerCards && (player.team === 'RED' || player.team === 'BLUE') && Array.isArray(room.teamPowerCards[player.team]));

                if (sharedTeamMode) {
                    const teamHand = room.teamPowerCards[player.team];
                    const idx = teamHand.indexOf(cardKey);
                    if (idx === -1) {
                        socket.emit('power-card-error', 'Bu güç kartına sahip değilsin');
                        return;
                    }
                    teamHand.splice(idx, 1);
                    emitSharedPowerCardsToTeam(room, player.team);
                } else {
                    if (!room.powerCardsByPlayer || !Array.isArray(room.powerCardsByPlayer[player.id])) {
                        socket.emit('power-card-error', 'Güç kartların bulunamadı');
                        return;
                    }

                    const hand = room.powerCardsByPlayer[player.id];
                    const idx = hand.indexOf(cardKey);
                    if (idx === -1) {
                        socket.emit('power-card-error', 'Bu güç kartına sahip değilsin');
                        return;
                    }

                    // Consume the card
                    hand.splice(idx, 1);
                    io.to(player.id).emit('power-cards', { cards: hand });
                }

                // Track power card usage on server
                if (!room.gameState.powerCardUsage) {
                    room.gameState.powerCardUsage = { RED: [], BLUE: [] };
                }
                room.gameState.powerCardUsage[player.team].push(cardKey);
                
                // Broadcast to room that power card was used
                const effect = applyPowerCardEffect(room, player, cardKey, data);

                io.to(player.roomId).emit('power-card-used', {
                    team: player.team,
                    cardKey,
                    playerName: player.username,
                    effect
                });
                // Some cards also broadcast extra mechanical UI events
                if (effect && effect.type === 'word-lock' && effect.targetTeam && Number.isInteger(effect.cardIndex)) {
                    io.to(player.roomId).emit('word-locked', { targetTeam: effect.targetTeam, cardIndex: effect.cardIndex });
                }
                emitGameStateSync(room, 'power-card');

                // If UNO Reverse just flipped the turn, bots may need to act immediately.
                if (cardKey === 'uno-reverse' && effect && !effect.invalid && !effect.tooLate) {
                    setTimeout(() => handleBotTurns(room), 400);
                }
                console.log(`Power card used: ${cardKey} by ${player.username} (${player.team})`);
            }
        }
    });

    // Chat messages
    socket.on('send-message', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        if (player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (!room) return;

            // Support both client payload shapes
            const messageText = (data && typeof data.message === 'string')
                ? data.message
                : (data && typeof data.text === 'string')
                    ? data.text
                    : '';
            const isTeamMessage = (data && typeof data.isTeamMessage === 'boolean')
                ? data.isTeamMessage
                : (data && data.type === 'team');

            const gifUrl = (data && typeof data.gifUrl === 'string') ? data.gifUrl.trim() : '';
            const hasGif = !!gifUrl;

            if (!messageText.trim() && !hasGif) return;

            if (hasGif && !isSafeTenorMediaUrl(gifUrl)) return;

            const message = {
                player: player.username,
                message: messageText,
                isTeamMessage,
                team: player.team,
                gifUrl: hasGif ? gifUrl : undefined,
                timestamp: new Date().toISOString()
            };

            if (isTeamMessage) {
                const teamPlayers = room.players.filter(p => p.team === player.team);
                teamPlayers.forEach(p => io.to(p.id).emit('message', message));
            } else {
                io.to(player.roomId).emit('message', message);
            }
        }
    });

    // Slash-command FX (broadcast to everyone)
    socket.on('trigger-fx', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;

        const typeRaw = (data && typeof data.type === 'string') ? data.type.trim().toLowerCase() : '';
        const allowed = new Set(['rain', 'lightning', 'water', 'fire', 'snow', 'quake']);
        if (!allowed.has(typeRaw)) return;

        if (!player.fxState) player.fxState = { cooldownUntil: 0 };
        const now = Date.now();
        if (player.fxState.cooldownUntil && now < player.fxState.cooldownUntil) return;

        const cooldownMs = typeRaw === 'lightning' ? 4500 : typeRaw === 'quake' ? 5500 : 3000;
        player.fxState.cooldownUntil = now + cooldownMs;

        io.to(room.id).emit('fx', {
            type: typeRaw,
            by: player.username,
            team: player.team || null,
            timestamp: new Date().toISOString()
        });
    });

    // Suspicion ping: operatives can mark a card for teammates (spymaster doesn't see)
    socket.on('suspicion', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        const room = rooms.find(r => r.id === player.roomId);
        if (!room || !room.gameState) return;
        if (room.gameState.gameOver) return;
        if (player.role !== 'OPERATIVE') return;
        if (player.team !== 'RED' && player.team !== 'BLUE') return;

        // basic cooldown
        if (!player.suspicionState) player.suspicionState = { cooldownUntil: 0 };
        const now = Date.now();
        if (player.suspicionState.cooldownUntil && now < player.suspicionState.cooldownUntil) return;
        player.suspicionState.cooldownUntil = now + 700;

        const idxRaw = (data && (typeof data.cardIndex === 'number' ? data.cardIndex : parseInt(data.cardIndex, 10)));
        const idx = Number.isInteger(idxRaw) ? idxRaw : null;
        if (idx === null) return;
        const card = room.gameState.board?.[idx];
        if (!card || card.revealed) return;

        const store = ensureRoomSuspicion(room);
        const teamStore = store[player.team] || (store[player.team] = {});
        const key = String(idx);
        const arr = Array.isArray(teamStore[key]) ? teamStore[key] : [];
        const pos = arr.indexOf(player.id);
        if (pos >= 0) arr.splice(pos, 1);
        else arr.push(player.id);
        teamStore[key] = arr;

        emitSuspicionToTeamOperatives(room, player.team);
    });

    // Private messages (DenemeChat)
    socket.on('private-message', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = rooms.find(r => r.id === player.roomId);
        if (!room) return;

        const toPlayerId = (data && typeof data.toPlayerId === 'string') ? data.toPlayerId : '';
        const messageText = (data && typeof data.message === 'string') ? data.message : '';

        const text = String(messageText || '').trim();
        if (!toPlayerId || !text) return;
        if (text.length > 200) return;
        if (toPlayerId === player.id) return;

        const target = (Array.isArray(room.players) ? room.players : []).find(p => p && p.id === toPlayerId);
        if (!target) return;

        const payload = {
            fromId: player.id,
            fromName: player.username,
            toId: target.id,
            toName: target.username,
            message: text,
            timestamp: new Date().toISOString()
        };

        // Only sender and receiver get it
        io.to(player.id).emit('private-message', payload);
        io.to(target.id).emit('private-message', payload);
    });

    // Quick emoji reactions
    socket.on('send-reaction', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;

        const emoji = (data && typeof data.emoji === 'string') ? data.emoji : '';
        if (!emoji.trim() || emoji.length > 12) return;

        io.to(player.roomId).emit('reaction', {
            emoji,
            playerName: player.username,
            timestamp: new Date().toISOString()
        });
    });

    // Disconnect
    // Global chat message handler
    socket.on('global-chat-message', (message) => {
        const player = players.get(socket.id);
        if (!player) return;

        // Basic message validation
        if (!message || typeof message !== 'string') return;
        const cleanMessage = message.trim().substring(0, 200);
        if (!cleanMessage) return;

        // Broadcast to all connected clients
        io.emit('global-chat-message', {
            username: player.username,
            message: cleanMessage,
            timestamp: Date.now()
        });

        console.log(`Global chat [${player.username}]: ${cleanMessage}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const room = rooms.find(r => r.id === player.roomId);
            if (room) {
                room.players = room.players.filter(p => p.id !== socket.id);
                if (!maybeCloseRoomIfNoRealPlayers(room, 'no-real-players')) {
                    // If host left, reassign host so room remains playable
                    if (room.host === socket.id) {
                        const nextHost = room.players.find(p => p && !p.isBot);
                        room.host = (nextHost && nextHost.id) ? nextHost.id : room.players[0].id;
                    }
                    // If room is in closing state, prevent stale game state
                    if (room.closing) {
                        room.gameStarted = false;
                        room.gameState = null;
                    }
                    io.to(player.roomId).emit('room-updated', room);
                }
            }
        }
        players.delete(socket.id);
        io.emit('rooms-list', rooms);
    });
});

function countRealPlayers(room) {
    return (Array.isArray(room?.players) ? room.players : []).filter(p => p && !p.isBot).length;
}

function maybeCloseRoomIfNoRealPlayers(room, reason) {
    if (!room || !room.id) return false;
    if (room.closing) return true;

    const realCount = countRealPlayers(room);
    if (realCount <= 0) {
        closeRoomNow(room.id, reason || 'no-real-players');
        return true;
    }
    return false;
}

function generateRoomId() {
    return Math.random().toString(36).substr(2, 9);
}

function generateInviteCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function initializeGameState(players, wordCategory = 'genel') {
    // Get word list based on category
    const wordList = getWordList(wordCategory);
    
    // Select 25 random words from the category
    const shuffledWords = [...wordList].sort(() => Math.random() - 0.5).slice(0, 25);
    
    // Create type assignments: 9 RED, 8 BLUE, 7 NEUTRAL, 1 ASSASSIN
    const types = [
        'RED', 'RED', 'RED', 'RED', 'RED', 'RED', 'RED', 'RED', 'RED',
        'BLUE', 'BLUE', 'BLUE', 'BLUE', 'BLUE', 'BLUE', 'BLUE', 'BLUE',
        'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL', 'NEUTRAL',
        'ASSASSIN'
    ];

    // Shuffle types and create board
    const shuffledTypes = types.sort(() => Math.random() - 0.5);

    const board = shuffledWords.map((word, index) => ({
        word: word,
        type: shuffledTypes[index],
        revealed: false,
        selector: null,
        clickedBy: null
    }));

    return {
        board: board,
        turnNumber: 0,
        bombLocks: {},
        currentTurn: { team: 'RED', phase: 'HINT' },
        currentClue: null,
        guessesRemaining: 0,
        redRemaining: 9,
        blueRemaining: 8,
        gameOver: false,
        winner: null,
        gameFinishedEmitted: false,
        powerEffects: {
            skipTurns: { RED: 0, BLUE: 0 },
            pendingExtraGuesses: { RED: 0, BLUE: 0 },
            clue: {
                allowTwoWords: { RED: 0, BLUE: 0 },
                silent: { RED: 0, BLUE: 0 },
                numberBend: { RED: 0, BLUE: 0 },
                absolute: { RED: 0, BLUE: 0 }
            },
            guess: {
                insurance: { RED: 0, BLUE: 0 },
                insuranceUsed: { RED: 0, BLUE: 0 },
                secondChance: { RED: 0, BLUE: 0 },
                secondChanceUsed: { RED: 0, BLUE: 0 },
                allOrNothing: { RED: 0, BLUE: 0 },
                allOrNothingWrong: { RED: false, BLUE: false }
            },
            tactical: {
                wordLocks: { RED: [], BLUE: [] },
                shadow: null
            }
        },
        turnMeta: {
            firstSelectionMade: false,
            correctGuesses: 0,
            wrongGuess: false
        },
        revealHistory: []
    };
}

function emitGameFinished(room, reason) {
    if (!room || !room.gameState) return;
    const gameState = room.gameState;
    if (!gameState.gameOver || !gameState.winner) return;
    if (gameState.gameFinishedEmitted) return;
    gameState.gameFinishedEmitted = true;

    // Daily missions disabled.

    io.to(room.id).emit('game-finished', {
        winner: gameState.winner,
        reason: reason || 'unknown',
        gameState
    });
}

function processGuess(room, cardIndex, player) {
    const gameState = room.gameState;
    const card = gameState.board[cardIndex];
    if (card.revealed || gameState.gameOver) return;

    ensureBombState(gameState);
    if (isBombLocked(gameState, cardIndex)) {
        return;
    }

    const effects = ensurePowerEffects(gameState);
    const meta = ensureTurnMeta(gameState);

    // Save snapshot for potential rewind BEFORE changing state
    pushRevealHistory(room, cardIndex, card.type);

    card.revealed = true;
    card.selector = player.username;
    gameState.guessesRemaining--;

    // Track turn meta
    if (card.type === player.team) {
        meta.correctGuesses = Number(meta.correctGuesses || 0) + 1;
    } else {
        meta.wrongGuess = true;
    }

    // Update scores
    if (card.type === 'RED') {
        gameState.redRemaining--;
    } else if (card.type === 'BLUE') {
        gameState.blueRemaining--;
    }

    // Check win conditions
    if (card.type === 'ASSASSIN') {
        // Assassin is never protected by any power card
        gameState.gameOver = true;
        gameState.winner = gameState.currentTurn.team === 'RED' ? 'BLUE' : 'RED';
        emitGameFinished(room, 'assassin');
        return;
    }

    if (gameState.redRemaining === 0) {
        gameState.gameOver = true;
        gameState.winner = 'RED';
        emitGameFinished(room, 'all-cards-found');
        return;
    } else if (gameState.blueRemaining === 0) {
        gameState.gameOver = true;
        gameState.winner = 'BLUE';
        emitGameFinished(room, 'all-cards-found');
        return;
    }

    // Rare global event: bomb emoji walks to a random card and locks it for 2 turns.
    maybeTriggerBomb(room, 'after-reveal');

    const guessingTeam = gameState.currentTurn.team;
    const isWrongOrNeutral = (
        card.type === 'NEUTRAL' ||
        (card.type === 'RED' && guessingTeam === 'BLUE') ||
        (card.type === 'BLUE' && guessingTeam === 'RED')
    );

    // All-or-nothing: any wrong ends immediately
    const allOrNothingActive = Number(effects?.guess?.allOrNothing?.[guessingTeam] || 0) > 0;
    if (isWrongOrNeutral && allOrNothingActive) {
        effects.guess.allOrNothingWrong[guessingTeam] = true;
        switchToNextTeamTurn(room);
        return;
    }

    if (isWrongOrNeutral) {
        // Risk insurance / second chance: allow one wrong guess to not end turn
        const insuranceActive = Number(effects?.guess?.insurance?.[guessingTeam] || 0) > 0;
        const insuranceUsed = Number(effects?.guess?.insuranceUsed?.[guessingTeam] || 0) > 0;
        const secondActive = Number(effects?.guess?.secondChance?.[guessingTeam] || 0) > 0;
        const secondUsed = Number(effects?.guess?.secondChanceUsed?.[guessingTeam] || 0) > 0;

        let prevented = false;
        if (insuranceActive && !insuranceUsed) {
            effects.guess.insuranceUsed[guessingTeam] = 1;
            prevented = true;
        } else if (secondActive && !secondUsed) {
            effects.guess.secondChanceUsed[guessingTeam] = 1;
            prevented = true;
        }

        if (!prevented) {
            switchToNextTeamTurn(room);
            return;
        }

        // Even if prevented, if no guesses remain, end the turn to avoid a stuck GUESS phase
        if (gameState.guessesRemaining <= 0) {
            switchToNextTeamTurn(room);
            return;
        }
        return;
    }

    // Correct guess but no more guesses - turn changes
    if (gameState.guessesRemaining === 0) {
        switchToNextTeamTurn(room);
    }
}

// Schedule room closure and notify players
function scheduleRoomClose(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.closing) return;
    room.closing = true;

    setTimeout(() => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        // notify players that room is closing
        io.to(roomId).emit('room-closed', { reason: 'match_end' });

        // Force all sockets to leave the Socket.IO room to prevent stale subscriptions
        try {
            io.in(roomId).socketsLeave(roomId);
        } catch (_) {
            // fallback best-effort
            room.players.forEach(p => {
                const s = p && p.id ? io.sockets.sockets.get(p.id) : null;
                if (s) s.leave(roomId);
            });
        }

        // clear player state for everyone who was in that room
        for (const [_id, pl] of players.entries()) {
            if (pl && pl.roomId === roomId) {
                pl.roomId = null;
                pl.team = null;
                pl.role = null;
            }
        }

        // defensive: clear server-side room state
        room.gameStarted = false;
        room.gameState = null;
        room.powerCardsByPlayer = null;

        // remove the room
        rooms = rooms.filter(r => r.id !== roomId);
        io.emit('rooms-list', rooms);
    }, 7000);
}

function closeRoomNow(roomId, reason) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.closing) return;
    room.closing = true;

    io.to(roomId).emit('room-closed', { reason: reason || 'closed' });

    try {
        io.in(roomId).socketsLeave(roomId);
    } catch (_) {
        room.players.forEach(p => {
            const s = p && p.id ? io.sockets.sockets.get(p.id) : null;
            if (s) s.leave(roomId);
        });
    }

    for (const [_id, pl] of players.entries()) {
        if (pl && pl.roomId === roomId) {
            pl.roomId = null;
            pl.team = null;
            pl.role = null;
        }
    }

    room.gameStarted = false;
    room.gameState = null;
    room.powerCardsByPlayer = null;

    rooms = rooms.filter(r => r.id !== roomId);
    io.emit('rooms-list', rooms);
}

function handleBotTurns(room) {
    if (!room || !room.gameState) return;
    if (room.closing) return;
    const gameState = room.gameState;
    if (!gameState || gameState.gameOver) return;
    if (gameState.currentTurn?.phase === 'DRAFT') return;

    const currentPlayer = room.players.find(p =>
        p.team === gameState.currentTurn.team &&
        p.role === (gameState.currentTurn.phase === 'HINT' ? 'SPYMASTER' : 'OPERATIVE') &&
        p.isBot
    );

    if (!currentPlayer) return;

    if (gameState.currentTurn.phase === 'HINT' && currentPlayer.role === 'SPYMASTER') {
        // Bot spymaster gives clue
        const clue = getSpymasterBotClue(gameState, currentPlayer.team);
        gameState.currentClue = {
            word: clue.word,
            number: clue.number,
            team: currentPlayer.team
        };
        gameState.currentTurn.phase = 'GUESS';
        gameState.guessesRemaining = clue.number + 1;
        io.to(room.id).emit('clue-given', { clue: gameState.currentClue, gameState: gameState });
        // Recursively handle next bot turn
        setTimeout(() => handleBotTurns(room), 2000);
    } else if (gameState.currentTurn.phase === 'GUESS' && currentPlayer.role === 'OPERATIVE') {
        // Bot operative makes guess
        const cardIndex = getOperativeBotGuess(gameState, currentPlayer.team);
        if (cardIndex !== null) {
            processGuess(room, cardIndex, currentPlayer);
            io.to(room.id).emit('guess-made', { cardIndex, gameState: gameState, guesser: currentPlayer.username });
            // Recursively handle next bot turn
            setTimeout(() => handleBotTurns(room), 2000);
        }
    }
}

const botClueWords = [
    'RENK', 'HAYVAN', 'ŞEHİR', 'ÜLKE', 'MEYVE', 'SEBZE', 'SPOR', 'MÜZİK',
    'DENİZ', 'GÖKYÜZÜ', 'EV', 'OKUL', 'ÇALIŞMA', 'OYUN', 'YEMEK', 'İÇECEK',
    'ARAÇ', 'HAVA', 'SU', 'ATEŞ', 'TOPRAK', 'AĞAÇ', 'ÇİÇEK', 'KUŞ'
];

function getSpymasterBotClue(gameState, team) {
    // Get unrevealed cards for the team
    const teamCards = gameState.board.filter(card =>
        !card.revealed && card.type === team
    );

    if (teamCards.length === 0) {
        // No cards left, give a neutral clue
        return {
            word: botClueWords[Math.floor(Math.random() * botClueWords.length)],
            number: 1
        };
    }

    // Simple AI: pick a random clue word and set number to team cards count
    const clueWord = botClueWords[Math.floor(Math.random() * botClueWords.length)];
    const number = Math.min(teamCards.length, Math.floor(Math.random() * 3) + 1); // 1-3 guesses

    return { word: clueWord, number: number };
}

function getOperativeBotGuess(gameState, team) {
    // Simple AI: find unrevealed cards and pick one that might match the clue
    const unrevealedCards = gameState.board
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => !card.revealed && !isBombLocked(gameState, index));

    if (unrevealedCards.length === 0) return null;

    // For now, pick a random unrevealed card (can be improved with better AI)
    const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)];
    return randomCard.index;
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`AGENT0 server running on port ${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    console.log(`Network access: http://YOUR_PUBLIC_IP:${PORT}`);
    // Auto-open browser (dev only). Never let failures crash the server.
    const shouldAutoOpen =
        process.env.AUTO_OPEN_BROWSER === '1' ||
        (process.env.NODE_ENV !== 'production' && process.env.AUTO_OPEN_BROWSER !== '0');

    if (shouldAutoOpen) {
        const { exec } = require('child_process');
        const url = `http://localhost:${PORT}`;
        console.log(`Opening browser at ${url}`);

        try {
            const cmd = process.platform === 'win32'
                ? `start ${url}`
                : (process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`);

            const child = exec(cmd, (err) => {
                if (err) {
                    console.log('Browser auto-open failed (ignored):', err.message || String(err));
                }
            });

            // If spawning fails, Node would otherwise throw on an unhandled 'error' event.
            if (child && typeof child.on === 'function') {
                child.on('error', (e) => {
                    console.log('Browser auto-open spawn error (ignored):', e?.message || String(e));
                });
            }
        } catch (e) {
            console.log('Browser auto-open exception (ignored):', e?.message || String(e));
        }
    }
});