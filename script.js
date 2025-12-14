// AGENT0 Game
const socket = io();

// Apply background color with transparency
function applyBackgroundColor(color) {
    if (!color || color === '#rainbow') {
        // Show default rainbow background
        document.body.style.removeProperty('background-color');
        return;
    }
    // Convert hex to rgba with 30% opacity for glassmorphism compatibility
    const rgbaColor = hexToRgba(color, 0.3);
    document.body.style.setProperty('background-color', rgbaColor, 'important');
}

// Convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Reset background to default rainbow
function resetBackground() {
    localStorage.removeItem('backgroundColor');
    document.body.style.removeProperty('background-color');
    const colorInput = document.getElementById('background-color');
    if (colorInput) colorInput.value = '#1e3a5f';
    const gameColorInput = document.getElementById('game-background-color');
    if (gameColorInput) gameColorInput.value = '#1e3a5f';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Sound System
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.masterVolume = 0.6;
        this._unlocked = false;
        this._pendingPlays = [];
        this._unlocking = false;
        this._unlockListenersAttached = false;
        this._boundUnlockHandler = null;
        // Don't rely on creating AudioContext before a user gesture.
        // We'll unlock it from the first real user interaction.
        this.attachUnlockListeners();
    }

    attachUnlockListeners() {
        if (this._unlockListenersAttached) return;
        this._unlockListenersAttached = true;

        this._boundUnlockHandler = async () => {
            await this.unlock();
        };

        const opts = { once: true, passive: true, capture: true };
        window.addEventListener('pointerdown', this._boundUnlockHandler, opts);
        window.addEventListener('touchstart', this._boundUnlockHandler, opts);
        window.addEventListener('mousedown', this._boundUnlockHandler, opts);
        window.addEventListener('keydown', this._boundUnlockHandler, opts);
        window.addEventListener('click', this._boundUnlockHandler, opts);
    }

    async unlock() {
        if (!this.enabled) return false;
        if (this._unlocked) {
            this.flushPending();
            return true;
        }
        if (this._unlocking) return false;

        this._unlocking = true;
        // Important: create/resume AudioContext from inside a user gesture.
        this.initAudio();
        const ok = await this.resumeAudio();
        if (ok) {
            this.flushPending();
        }
        this._unlocking = false;
        return ok;
    }

    flushPending() {
        if (!this._unlocked) return;
        if (!this._pendingPlays.length) return;
        const pending = this._pendingPlays.slice();
        this._pendingPlays.length = 0;
        pending.forEach(fn => {
            try { fn(); } catch (_) { /* ignore */ }
        });
    }

    initAudio() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    ensureAudioContext() {
        if (this.audioContext) return true;
        this.initAudio();
        return !!this.audioContext;
    }

    async resumeAudio() {
        if (!this.ensureAudioContext()) return false;
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            this._unlocked = this.audioContext.state === 'running';
            return this._unlocked;
        } catch (e) {
            return false;
        }
    }

    _playToneNow(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.ensureAudioContext()) return;
        const ctx = this.audioContext;
        const doPlay = () => {
            try {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
                oscillator.type = type;

                const vol = Math.max(0, Math.min(1, Number(volume) || 0)) * Math.max(0, Math.min(1, Number(this.masterVolume) || 0));
                if (vol <= 0) return;

                gainNode.gain.setValueAtTime(0, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + duration);
            } catch (_) {
                // ignore
            }
        };

        if (ctx.state !== 'running') {
            ctx.resume().then(() => {
                this._unlocked = ctx.state === 'running';
                if (this._unlocked) doPlay();
            }).catch(() => {
                // can't resume without a user gesture
            });
            return;
        }

        doPlay();
    }

    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled) return;

        // If not unlocked yet, queue tones until the first user gesture unlocks audio.
        if (!this._unlocked) {
            this._pendingPlays.push(() => this._playToneNow(frequency, duration, type, volume));
            return;
        }

        this._playToneNow(frequency, duration, type, volume);
    }

    // Sound effects
    cardReveal() {
        // Soft "flip" + pleasant arpeggio (avoid sounding like an error)
        this.playTone(1200, 0.02, 'triangle', 0.06);
        this.playTone(523, 0.18, 'triangle', 0.16);
        setTimeout(() => this.playTone(659, 0.18, 'triangle', 0.14), 120);
        setTimeout(() => this.playTone(784, 0.16, 'sine', 0.11), 240);
    }

    wrongGuess() {
        // Distinct feedback, but not harsh/"error-like"
        this.playTone(330, 0.12, 'sine', 0.14);
        setTimeout(() => this.playTone(247, 0.14, 'sine', 0.13), 120);
        setTimeout(() => this.playTone(196, 0.18, 'triangle', 0.12), 260);
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

    fxRain() {
        // Soft rainy hiss (fast tiny drops)
        this.playTone(780, 0.06, 'triangle', 0.10);
        setTimeout(() => this.playTone(920, 0.05, 'triangle', 0.10), 90);
        setTimeout(() => this.playTone(680, 0.07, 'triangle', 0.10), 180);
        setTimeout(() => this.playTone(820, 0.06, 'triangle', 0.10), 270);
    }

    fxWater() {
        // Splashy "whoosh"
        this.playTone(300, 0.10, 'sine', 0.18);
        setTimeout(() => this.playTone(220, 0.14, 'triangle', 0.18), 90);
        setTimeout(() => this.playTone(180, 0.22, 'sine', 0.16), 180);
    }

    fxFire() {
        // Crackle + flicker
        this.playTone(520, 0.05, 'square', 0.10);
        setTimeout(() => this.playTone(610, 0.05, 'square', 0.10), 70);
        setTimeout(() => this.playTone(460, 0.06, 'square', 0.10), 150);
        setTimeout(() => this.playTone(740, 0.04, 'square', 0.09), 230);
        setTimeout(() => this.playTone(540, 0.06, 'triangle', 0.10), 310);
    }

    fxSnow() {
        // Light glittery chimes
        this.playTone(1047, 0.10, 'sine', 0.12);
        setTimeout(() => this.playTone(1319, 0.10, 'sine', 0.12), 120);
        setTimeout(() => this.playTone(1568, 0.12, 'sine', 0.10), 240);
    }

    fxQuake() {
        // Low rumble + thump
        this.playTone(90, 0.25, 'sawtooth', 0.22);
        setTimeout(() => this.playTone(70, 0.30, 'sawtooth', 0.22), 120);
        setTimeout(() => this.playTone(120, 0.10, 'square', 0.18), 280);
    }

    powerCardObtained() {
        // Magical sparkle sound for power card
        this.playTone(1200, 0.15, 'sine', 0.4);
        setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.5), 100);
        setTimeout(() => this.playTone(2000, 0.2, 'sine', 0.6), 200);
        setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.4), 350);
    }

    draftSpinStart() {
        // Short "case opening" whoosh-like sweep
        this.playTone(220, 0.05, 'triangle', 0.10);
        setTimeout(() => this.playTone(330, 0.06, 'triangle', 0.11), 40);
        setTimeout(() => this.playTone(440, 0.07, 'sine', 0.10), 90);
        setTimeout(() => this.playTone(660, 0.08, 'sine', 0.09), 150);
    }

    draftTierWin(tier) {
        const t = String(tier || '').toUpperCase();

        // Keep it very short; these fire on every spin.
        if (t === 'S') {
            // Rare: bright + tiny crackle
            this.playTone(1047, 0.10, 'sine', 0.16);
            setTimeout(() => this.playTone(1319, 0.10, 'sine', 0.16), 70);
            setTimeout(() => this.playTone(1568, 0.12, 'triangle', 0.14), 140);
            setTimeout(() => this.fxFire?.(), 160);
            return;
        }
        if (t === 'A') {
            // Strong hit (requested: A is "kırmızı" vibe)
            this.playTone(660, 0.08, 'sawtooth', 0.14);
            setTimeout(() => this.playTone(880, 0.10, 'triangle', 0.13), 70);
            return;
        }
        if (t === 'B') {
            this.playTone(784, 0.08, 'triangle', 0.12);
            setTimeout(() => this.playTone(988, 0.10, 'sine', 0.11), 70);
            return;
        }
        if (t === 'C') {
            this.playTone(523, 0.07, 'sine', 0.10);
            setTimeout(() => this.playTone(659, 0.08, 'sine', 0.10), 60);
            return;
        }
        // D / unknown
        this.playTone(330, 0.09, 'sine', 0.10);
        setTimeout(() => this.playTone(247, 0.12, 'triangle', 0.09), 70);
    }

    buttonClick() {
        this.playTone(400, 0.05, 'sine', 0.1);
    }

    emojiClick() {
        this.playTone(1200, 0.08, 'sine', 0.15);
        setTimeout(() => this.playTone(1400, 0.08, 'sine', 0.15), 80);
    }

    cardSelect() {
        this.playTone(620, 0.045, 'sine', 0.09);
        setTimeout(() => this.playTone(840, 0.045, 'sine', 0.07), 45);
    }

    cardHover() {
        // Very light "tick" so it feels responsive (avoid annoyance)
        this.playTone(980, 0.028, 'sine', 0.05);
        setTimeout(() => this.playTone(1240, 0.028, 'sine', 0.04), 28);
    }

    messageSend() {
        this.playTone(520, 0.05, 'triangle', 0.10);
        setTimeout(() => this.playTone(740, 0.06, 'triangle', 0.11), 55);
    }

    messageReceive() {
        // More noticeable notification sound for chat messages
        this.playTone(523, 0.12, 'sine', 0.15); // C5
        setTimeout(() => this.playTone(659, 0.12, 'sine', 0.15), 80); // E5
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.18), 160); // G5
    }

    turnSwitch() {
        this.playTone(330, 0.08, 'sine', 0.12);
        setTimeout(() => this.playTone(494, 0.10, 'sine', 0.13), 90);
    }

    horn() {
        if (!this.enabled) return;
        if (!this.ensureAudioContext()) return;

        const ctx = this.audioContext;
        const doPlay = () => {
            try {
                const now = ctx.currentTime;
                const gain = ctx.createGain();
                gain.connect(ctx.destination);

                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.type = 'sawtooth';
                osc2.type = 'triangle';
                osc1.connect(gain);
                osc2.connect(gain);

                const base = 440;
                osc1.frequency.setValueAtTime(base, now);
                osc2.frequency.setValueAtTime(base * 1.5, now);
                osc1.frequency.linearRampToValueAtTime(base * 0.88, now + 0.18);
                osc2.frequency.linearRampToValueAtTime(base * 1.32, now + 0.18);

                const vol = Math.max(0, Math.min(1, Number(this.masterVolume) || 0));
                const peak = 0.18 * vol;
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(peak, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.45);
                osc2.stop(now + 0.45);
            } catch (_) {
                // ignore
            }
        };

        if (!this._unlocked) {
            this._pendingPlays.push(doPlay);
            return;
        }

        if (ctx.state !== 'running') {
            ctx.resume().then(() => {
                this._unlocked = ctx.state === 'running';
                if (this._unlocked) doPlay();
            }).catch(() => { /* ignore */ });
            return;
        }

        doPlay();
    }
}

const soundManager = new SoundManager();

function setHornButtonDisabled(disabled, retryMs) {
    const btn = document.getElementById('horn-btn');
    if (!btn) return;
    btn.disabled = !!disabled;
    if (disabled && typeof retryMs === 'number' && retryMs > 0) {
        const until = Date.now() + retryMs;
        btn.dataset.disabledUntil = String(until);
        setTimeout(() => {
            const t = parseInt(btn.dataset.disabledUntil || '0', 10);
            if (t && Date.now() >= t) {
                btn.disabled = false;
                btn.dataset.disabledUntil = '';
            }
        }, Math.min(65000, retryMs + 50));
    }
}

function sendHorn() {
    if (!currentRoom || !currentPlayer) return;
    // Small local guard; server is authoritative.
    const btn = document.getElementById('horn-btn');
    if (btn && btn.disabled) return;
    setHornButtonDisabled(true, 3000);
    socket.emit('horn');
}

function clamp01(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function applyAudioPrefsToUI() {
    const toggleBtn = document.getElementById('audio-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = soundManager.enabled ? '🔊' : '🔇';
        toggleBtn.classList.toggle('muted', !soundManager.enabled);
        toggleBtn.style.opacity = soundManager.enabled ? '1' : '0.6';
    }

    const volumeInput = document.getElementById('audio-volume');
    if (volumeInput) {
        volumeInput.value = String(clamp01(soundManager.masterVolume, 0.6));
        volumeInput.style.opacity = soundManager.enabled ? '1' : '0.6';
    }
}

// index.html top bar uses these names
function toggleAudio() {
    soundManager.enabled = !soundManager.enabled;
    localStorage.setItem('soundEnabled', soundManager.enabled ? 'true' : 'false');
    // Compatibility with older/v2 keys
    localStorage.setItem('audioEnabled', soundManager.enabled ? 'true' : 'false');
    applyAudioPrefsToUI();
    if (soundManager.enabled) {
        soundManager.unlock();
        soundManager.buttonClick();
    }
}

function setAudioVolume(value) {
    soundManager.masterVolume = clamp01(value, soundManager.masterVolume);
    localStorage.setItem('soundVolume', String(soundManager.masterVolume));
    // Compatibility with older/v2 keys
    localStorage.setItem('audioVolume', String(soundManager.masterVolume));
    applyAudioPrefsToUI();
    if (soundManager.enabled) {
        soundManager.unlock();
    }
}

let __lastChatSfxTimestamp = null;
function maybePlayChatReceiveSfx(data) {
    const ts = data && data.timestamp ? data.timestamp : null;
    if (ts && __lastChatSfxTimestamp === ts) return;
    if (ts) __lastChatSfxTimestamp = ts;

    // Avoid double-playing on your own messages if we can detect it.
    const myName = currentPlayer && currentPlayer.username ? currentPlayer.username : null;
    if (myName && data && data.player === myName) return;

    soundManager.messageReceive();
}

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');

    let bg = 'linear-gradient(135deg, rgba(102,126,234,0.95), rgba(118,75,162,0.95))';
    if (type === 'success') {
        bg = 'linear-gradient(135deg, rgba(81,207,102,0.95), rgba(64,192,87,0.95))';
    } else if (type === 'error') {
        bg = 'linear-gradient(135deg, rgba(255,107,107,0.95), rgba(238,90,111,0.95))';
    } else if (type === 'warning') {
        bg = 'linear-gradient(135deg, rgba(255,193,7,0.95), rgba(255,152,0,0.95))';
    }

    notif.style.cssText = `
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bg};
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        z-index: 100000;
        font-weight: 700;
        max-width: min(680px, calc(100vw - 24px));
        text-align: center;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2200);
}

function appendGameSystemLine(text, variant = 'success') {
    const messagesContainer = document.getElementById('game-chat-messages');
    if (!messagesContainer) return;

    const el = document.createElement('div');
    el.className = `game-chat-message system ${variant}`;
    el.textContent = text;
    messagesContainer.appendChild(el);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function typeToRevealText(cardType) {
    const t = String(cardType || '').toUpperCase();
    if (t === 'RED') return { label: '🔴 KIRMIZI', variant: 'red' };
    if (t === 'BLUE') return { label: '🔵 MAVİ', variant: 'blue' };
    if (t === 'NEUTRAL') return { label: '⚪ NÖTR', variant: 'warning' };
    if (t === 'ASSASSIN') return { label: '💀 ASSASSIN', variant: 'error' };
    return { label: t || 'BİLİNMİYOR', variant: 'info' };
}

function appendRevealLogFromGameState(gameState, cardIndex, by) {
    const idx = (typeof cardIndex === 'number')
        ? cardIndex
        : (typeof cardIndex === 'string' ? parseInt(cardIndex, 10) : NaN);
    if (!Number.isInteger(idx)) return;
    const card = gameState?.board?.[idx];
    if (!card) return;

    const word = card.word || `#${idx + 1}`;
    const { label, variant } = typeToRevealText(card.type);
    const who = by && by.name ? ` - ${by.name} tarafından açıldı` : '';
    appendGameSystemLine(`🃏 ${word} ${label}${who}`, variant);
}

function renderClueInfo(clue, currentTurnTeam) {
    const clueInfo = document.getElementById('clue-info');
    if (!clueInfo) return;
    if (!clue) {
        clueInfo.innerHTML = '';
        clueInfo.className = '';
        return;
    }

    const team = (clue.team || currentTurnTeam || '').toUpperCase();
    const teamClass = team === 'RED' ? 'clue-red' : team === 'BLUE' ? 'clue-blue' : '';
    const giver = clue.giver ? ` <span class="clue-giver">${clue.giver}</span>` : '';

    clueInfo.className = `clue-pill ${teamClass}`.trim();
    clueInfo.innerHTML = `🎯 <span class="clue-word">${clue.word}</span> <span class="clue-number">(${clue.number})</span>${giver}`;
}

// My power cards are private (server sends via `power-cards`)
let myPowerCards = [];

// Word Sets by Category
const wordSets = {
    // Genel havuza tüm kategorileri ve ekstra kelimeleri ekledik
    genel: [
        // Eski genel
        'ELMA', 'KAPI', 'GÖL', 'YILDIZ', 'KİTAP', 'MASA', 'KALE', 'AĞAÇ', 'DENIZ', 'GÜNEŞ',
        'AY', 'KÖPRÜ', 'KUTU', 'KUPA', 'SAAT', 'YÜZÜK', 'KEDI', 'KÖPEK', 'ARABA', 'UÇAK',
        'BALIK', 'KUŞ', 'SU', 'ATEŞ', 'TOPRAK',

        // Hayvanlar
        'ASLAN', 'KAPLAN', 'AYACIK', 'KURT', 'TILKI', 'TAVŞAN', 'SINCAP', 'KIRPI', 'GELINCIK', 'AYAYI',
        'PENGUEN', 'BAYKUŞ', 'KARTAL', 'ŞAHIN', 'YEŞILBAŞ', 'PAPAĞAN', 'MAYMUN', 'ZÜRAFA', 'FİL', 'RHINOSEROS',
        'SUAYGIRI', 'ZEBRA', 'ANTILOP', 'ÇITA', 'PUMA',

        // Ülkeler
        'TÜRKIYE', 'FRANSA', 'İTALYA', 'İSPANYA', 'ALMANYA', 'İNGİLTERE', 'RUSYA', 'ÇİN', 'JAPONYA', 'KORE',
        'HINDISTAN', 'BREZILYA', 'ARJANTIN', 'KANADA', 'AVUSTRALYA', 'MEKSIKA', 'MISIIR', 'SUUDI ARABISTAN', 'DUBAI', 'TAYLAND',

        // Yemekler
        'PIZZA', 'BURGER', 'PASTA', 'PILAV', 'KÖFTE', 'DÖNER', 'KEBAP', 'BAKLAVA', 'HELVA', 'KEK',
        'TART', 'DONUT', 'KRUVASAN', 'EKMEK', 'SİMİT', 'MANTI', 'ÇORBA', 'MERCIMEK', 'ŞEHRIYE', 'TARHANA',
        'TURŞU', 'REÇEL', 'MARMELAT', 'KREM', 'PUDDING',

        // Spor
        'FUTBOL', 'BASKETBOL', 'VOLEYBOL', 'TENİS', 'BADMINTON', 'YÜZME', 'DALGİÇ', 'KOŞU', 'ATLETİZM', 'GÜREŞ',
        'BOKS', 'JİDO', 'KARATE', 'HALTER', 'OKÇULUK', 'BİLYARD', 'TENIS TOPU', 'GOLF', 'HOKEİ', 'BIATLON',

        // Teknoloji
        'TELEFON', 'BİLGİSAYAR', 'LAPTOP', 'TABLET', 'SMARTWATCH', 'DRONE', 'ROBOT', 'INTERNET', 'WİFİ', 'BLUETOOTH',
        'SENSOR', 'KAMERA', 'MİKROFON', 'HOPARLÖR', 'BATARYA', 'GÜNEŞ PANELİ', 'TURBIN', 'PROJEKTÖRÜ', 'SUNUCU', 'VERİTABANI',

        // Renkler
        'KIRMIZI', 'MAVI', 'YEŞİL', 'SARI', 'SİYAH', 'BEYAZ', 'PEMBE', 'MOR', 'TURUNCU', 'GÜMÜŞ',
        'ALTIN', 'BAKIR', 'BRONZ', 'GRİ', 'AÇIK MAVİ', 'LACIVERT', 'AÇIK YEŞİL', 'ZEYTİN', 'İNDİGO', 'TİRKÜAZ',

        // Ekstra kelimeler
        'GALAKSİ', 'UZAY', 'ROKET', 'ASTRONOT', 'TELESKOP', 'YAZILIM', 'DONANIM', 'EFSANE', 'EJDERHA', 'VOLKAN',
        'DEPREM', 'ORKİDE', 'LAVANTA', 'KAMPÜS', 'STADYUM', 'TİYATRO', 'SİNEMA', 'MÜZE', 'KUTUP', 'ÇÖL',
        'OVA', 'OKYANUS', 'NEHİR', 'ORMAN', 'ŞEHİR', 'KÖY', 'SARAY', 'CAMİ', 'KİLİSE', 'ANTEN', 'ŞELALE', 'KANYON',
        'KARADENİZ', 'AKDENİZ', 'MAĞARA', 'ÇAYIR',

        // Mitoloji
        'ZEUS', 'HERMES', 'ARTEMİS', 'ODYSSEUS', 'ARES', 'APOLLO', 'AFRODIT', 'ATLAS', 'PERSEFON', 'HEKATE'
    ],
    hayvanlar: [
        'ASLAN', 'KAPLAN', 'AYACIK', 'KURT', 'TILKI',
        'TAVŞAN', 'SINCAP', 'KIRPI', 'GELINCIK', 'AYAYI',
        'PENGUEN', 'BAYKUŞ', 'KARTAL', 'ŞAHIN', 'YEŞILBAŞ',
        'PAPAĞAN', 'MAYMUN', 'ZÜRAFA', 'FİL', 'RHINOSEROS',
        'SUAYGIRI', 'ZEBRA', 'ANTILOP', 'ÇITA', 'PUMA',
        'GÜVERCİN', 'KURBAĞA', 'CEYLAN', 'KUZU', 'KELEBEK',
        'KARGA', 'PAPATYA KUŞU', 'DENİZATI', 'LEOPARD', 'MORS'
    ],
    ülkeler: [
        'TÜRKIYE', 'FRANSA', 'İTALYA', 'İSPANYA', 'ALMANYA',
        'İNGİLTERE', 'RUSYA', 'ÇİN', 'JAPONYA', 'KORE',
        'HINDISTAN', 'BREZILYA', 'ARJANTIN', 'KANADA', 'AVUSTRALYA',
        'MEKSIKA', 'MISIIR', 'SUUDI ARABISTAN', 'DUBAI', 'TAYLAND',
        'İSVEÇ', 'NORVEÇ', 'İRLANDA', 'İSVİÇRE', 'NİJERYA', 'TUNUS', 'PERU'
    ],
    yemekler: [
        'PIZZA', 'BURGER', 'PASTA', 'PILAV', 'KÖFTE',
        'DÖNER', 'KEBAP', 'BAKLAVA', 'HELVA', 'KEK',
        'TART', 'DONUT', 'KRUVASAN', 'EKMEK', 'SİMİT',
        'MANTI', 'ÇORBA', 'MERCIMEK', 'ŞEHRIYE', 'TARHANA',
        'TURŞU', 'REÇEL', 'MARMELAT', 'KREM', 'PUDDING',
        'SÜTLAÇ', 'KÜNEFE', 'ÇİĞ KÖFTE', 'GÜVEÇ', 'BÖREK', 'KAHVALTI TABAĞI'
    ],
    spor: [
        'FUTBOL', 'BASKETBOL', 'VOLEYBOL', 'TENİS', 'BADMINTON',
        'YÜZME', 'DALGİÇ', 'KOŞU', 'ATLETİZM', 'GÜREŞ',
        'BOKS', 'JİDO', 'KARATE', 'HALTER', 'OKÇULUK',
        'BİLYARD', 'TENIS TOPU', 'GOLF', 'HOKEİ', 'BIATLON',
        'KRİKET', 'DART', 'PARAPENT', 'SURF', 'MOTOSİKLET', 'ESKRİM'
    ],
    teknoloji: [
        'TELEFON', 'BİLGİSAYAR', 'LAPTOP', 'TABLET', 'SMARTWATCH',
        'DRONE', 'ROBOT', 'INTERNET', 'WİFİ', 'BLUETOOTH',
        'SENSOR', 'KAMERA', 'MİKROFON', 'HOPARLÖR', 'BATARYA',
        'GÜNEŞ PANELİ', 'TURBIN', 'PROJEKTÖRü', 'SUNUCU', 'VERİTABANI',
        'YAZILIM', 'BULUT', 'VERİ MADENCİLİĞİ', 'KRİPTO', 'YAPAY ZEKA', 'SİBER GÜVENLİK'
    ],
    renk: [
        'KIRMIZI', 'MAVI', 'YEŞİL', 'SARI', 'SİYAH',
        'BEYAZ', 'PEMBE', 'MOR', 'TURUNCU', 'GÜMÜŞ',
        'ALTIN', 'BAKIR', 'BRONZ', 'GRİ', 'AÇIK MAVİ',
        'LACIVERT', 'AÇIK YEŞİL', 'ZEYTİN', 'İNDİGO', 'TİRKÜAZ',
        'LİLA', 'FÜME', 'TURKUAZ', 'ŞARAP', 'İNCİ', 'MAVİ-GÖK MAVİ'
    ],
    yerler: [
        'ŞELALE', 'ÇAYIR', 'MAĞARA', 'KANYON', 'KÖRFEZ', 'LİMAN', 'DAĞ', 'VADİ', 'KİLİSE', 'SARAY', 'ŞATO'
    ],
    mitoloji: [
        'ZEUS', 'POSEIDON', 'ATLAS', 'ARTEMİS', 'HERMES', 'APHRODITE', 'CYCLOPS', 'HADES', 'APOLLO', 'HEKATE'
    ]
};

let currentWordSet = 'genel';
let words = wordSets[currentWordSet];

// Global variables
let currentPlayer = null;
let currentRoom = null;
let currentBoard = null;
let selectedVoteCard = null;

let selectedCardIndex = null;
const lastSelectionByPlayerId = new Map();

// Competitive features
let currentDraftState = null;
let suspicionMarks = { RED: {}, BLUE: {} }; // team -> { [cardIndex]: count }

function normalizeRoomFromServer(room) {
    if (!room) return room;
    // Server uses `room.gameState` as the authoritative game state object.
    // Client legacy UI expects `room.gameState` to be a string ('waiting'/'playing')
    // and relies on top-level fields like `currentTurn`, `clue`, and `board`.
    if (room.gameState && typeof room.gameState === 'object') {
        room._gameStateObj = room.gameState;
        room.currentTurn = room.gameState.currentTurn || room.currentTurn || null;
        room.clue = room.gameState.currentClue || room.clue || null;
        room.board = room.gameState.board || room.board || null;
        room.powerEffects = room.gameState.powerEffects || room.powerEffects || null;
        room.turnNumber = room.gameState.turnNumber ?? room.turnNumber ?? 0;
        room.bombLocks = room.gameState.bombLocks || room.bombLocks || {};
        room.gameStarted = room.gameStarted || true;
        room.gameState = 'playing';
    }
    return room;
}

function isBombLockedForMe(cardIndex) {
    if (!currentRoom) return false;
    const turn = Number(currentRoom.turnNumber || 0);
    const unlockOnTurn = Number(currentRoom.bombLocks?.[cardIndex]);
    if (!Number.isFinite(unlockOnTurn)) return false;
    return turn < unlockOnTurn;
}

function animateBombToCard(from01, targetIndex) {
    const boardEl = document.getElementById('game-board');
    const cardEl = document.querySelector(`.card[data-index="${targetIndex}"]`);
    if (!boardEl || !cardEl) return;

    const boardRect = boardEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();

    const fxFrom = (from01 && typeof from01.x === 'number' && typeof from01.y === 'number')
        ? from01
        : { x: Math.random(), y: Math.random() };

    const startX = boardRect.left + (boardRect.width * Math.max(0, Math.min(1, fxFrom.x)));
    const startY = boardRect.top + (boardRect.height * Math.max(0, Math.min(1, fxFrom.y)));
    const targetX = cardRect.left + (cardRect.width / 2);
    const targetY = cardRect.top + (cardRect.height / 2);

    const dx = targetX - startX;
    const dy = targetY - startY;

    const el = document.createElement('div');
    el.className = 'bomb-emoji-fx';
    el.textContent = '💣';
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    document.body.appendChild(el);

    const midLift = Math.max(-48, Math.min(-18, -Math.abs(dy) * 0.12));

    const walk = el.animate(
        [
            { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx * 0.55}px, ${dy * 0.55 + midLift}px) scale(1.08) rotate(10deg)`, opacity: 1 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(1.15) rotate(-6deg)`, opacity: 1 }
        ],
        { duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    );

    walk.onfinish = () => {
        // Small impact on the target card
        cardEl.classList.add('bomb-hit');
        window.setTimeout(() => cardEl.classList.remove('bomb-hit'), 520);

        el.textContent = '💥';
        const boom = el.animate(
            [
                { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(1.15)`, opacity: 1 },
                { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(2.1)`, opacity: 0 }
            ],
            { duration: 520, easing: 'ease-out', fill: 'forwards' }
        );
        boom.onfinish = () => el.remove();
    };
}

socket.on('draft-updated', (draftState) => {
    currentDraftState = draftState || null;
    renderDraftUI();
});

socket.on('daily-missions', (payload) => {
    // Daily missions removed from UI; ignore server payload.
});

socket.on('suspicion-update', (payload) => {
    if (!payload || !payload.team) return;
    const team = payload.team;
    if (team !== 'RED' && team !== 'BLUE') return;
    suspicionMarks[team] = payload.marks || {};
    if (currentBoard) renderBoard(currentBoard);
});

function startDraft() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host draft başlatabilir', 'error');
        return;
    }
    // Old pre-game Pick&Ban draft removed; draft now auto-starts after game starts.
    showNotification('Draft oyun başladıktan sonra otomatik açılır', 'info');
}

function resetDraft() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host draft sıfırlayabilir', 'error');
        return;
    }
    showNotification('Draft oyun içinde ilerler; şu an sıfırlama yok', 'info');
}

function spinDraft() {
    socket.emit('draft-spin');
}

function getPowerCardDefByKey(key) {
    if (!key) return null;
    if (typeof POWER_CARD_CATALOG === 'undefined' || !Array.isArray(POWER_CARD_CATALOG)) return null;
    return POWER_CARD_CATALOG.find(c => c.key === key) || null;
}

function isSTierCard(key) {
    const def = getPowerCardDefByKey(key);
    return (def && String(def.tier).toUpperCase() === 'S');
}

function setDraftSTierEffect(active, durationMs) {
    const overlay = document.getElementById('draft-overlay');
    if (!overlay) return;

    if (active) overlay.setAttribute('data-s-tier', '1');
    else overlay.removeAttribute('data-s-tier');

    if (window.__draftSTierTimer) {
        clearTimeout(window.__draftSTierTimer);
        window.__draftSTierTimer = null;
    }
    if (active) {
        const ms = Number.isFinite(durationMs) ? durationMs : 2800;
        window.__draftSTierTimer = setTimeout(() => {
            const ov = document.getElementById('draft-overlay');
            if (ov) ov.removeAttribute('data-s-tier');
        }, Math.max(1200, ms) + 1200);
    }
}

function setDraftResultEffect(team, tier) {
    const overlay = document.getElementById('draft-overlay');
    if (!overlay) return;

    const t = (team === 'BLUE' || team === 'RED') ? team : '';
    const tr = tier ? String(tier).toUpperCase() : '';

    if (t) overlay.setAttribute('data-last-team', t);
    else overlay.removeAttribute('data-last-team');

    if (tr) overlay.setAttribute('data-last-tier', tr);
    else overlay.removeAttribute('data-last-tier');

    // Tiny, punchy visual flash on each win.
    overlay.setAttribute('data-flash', '1');
    if (window.__draftFlashTimer) {
        clearTimeout(window.__draftFlashTimer);
        window.__draftFlashTimer = null;
    }
    window.__draftFlashTimer = setTimeout(() => {
        const ov = document.getElementById('draft-overlay');
        if (ov) ov.removeAttribute('data-flash');
    }, 700);
}

function triggerDraftNudge(durationMs) {
    const overlay = document.getElementById('draft-overlay');
    if (!overlay) return;

    overlay.setAttribute('data-nudge', '1');
    if (window.__draftNudgeTimer) {
        clearTimeout(window.__draftNudgeTimer);
        window.__draftNudgeTimer = null;
    }
    const ms = Number.isFinite(durationMs) ? durationMs : 420;
    window.__draftNudgeTimer = window.setTimeout(() => {
        const ov = document.getElementById('draft-overlay');
        if (ov) ov.removeAttribute('data-nudge');
    }, Math.max(260, Math.min(900, ms)));
}

socket.on('draft-spin-start', (payload) => {
    const reelEl = document.getElementById('draft-reel');
    if (!reelEl) return;
    const reel = payload?.reel;
    const items = Array.isArray(reel?.items) ? reel.items : [];
    const stopIndex = Number.isInteger(reel?.stopIndex) ? reel.stopIndex : null;
    const durationMs = Number.isFinite(payload?.durationMs) ? payload.durationMs : 2800;
    if (!items.length || stopIndex === null) return;

    // Ensure the overlay is rendered before applying winner tint / S-tier effects.
    renderDraftUI();
    const overlay = document.getElementById('draft-overlay');
    if (!overlay) return;

    const winnerKey = payload?.winnerKey;
    const sTierWinner = isSTierCard(winnerKey);
    setDraftSTierEffect(sTierWinner, durationMs);

    const winnerDef = getPowerCardDefByKey(winnerKey);
    const winnerTier = winnerDef?.tier ? String(winnerDef.tier).toUpperCase() : '';
    const winTeam = payload?.team;
    setDraftResultEffect(winTeam, winnerTier);
    if (soundManager && soundManager.enabled) {
        soundManager.draftSpinStart?.();
        // play tier stinger at the landing moment
        if (window.__draftTierSfxTimer) {
            clearTimeout(window.__draftTierSfxTimer);
            window.__draftTierSfxTimer = null;
        }
        window.__draftTierSfxTimer = setTimeout(() => {
            if (soundManager && soundManager.enabled) {
                soundManager.draftTierWin?.(winnerTier);
            }
        }, Math.max(600, durationMs - 120));
    }

    // "Sayfayı çekme" hissi: kart landing anında kısa nudge.
    if (window.__draftNudgeLandingTimer) {
        clearTimeout(window.__draftNudgeLandingTimer);
        window.__draftNudgeLandingTimer = null;
    }
    window.__draftNudgeLandingTimer = setTimeout(() => {
        triggerDraftNudge(420);
    }, Math.max(520, durationMs - 140));

    reelEl.classList.remove('hidden');
    reelEl.setAttribute('aria-hidden', 'false');
    reelEl.innerHTML = '';

    const track = document.createElement('div');
    track.className = 'draft-reel-track';
    reelEl.appendChild(track);

    items.forEach((key, idx) => {
        const def = getPowerCardDefByKey(key);
        const label = def?.name || key;
        const item = document.createElement('div');
        item.className = 'draft-reel-item';
        if (def?.tier) item.classList.add(`draft-tier-${String(def.tier).toLowerCase()}`);
        if (idx === stopIndex) item.classList.add('draft-reel-item-winner');
        item.textContent = label;
        track.appendChild(item);
    });

    if (sTierWinner) {
        reelEl.classList.add('draft-reel-s-tier');
    } else {
        reelEl.classList.remove('draft-reel-s-tier');
    }

    // Animate so the stopIndex item lands under the center marker
    const itemWidth = 160;
    const gap = 8;
    const slot = itemWidth + gap;
    const containerWidth = reelEl.clientWidth;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    const targetX = (stopIndex * slot) - centerOffset;

    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    requestAnimationFrame(() => {
        track.style.transition = `transform ${Math.max(1200, durationMs)}ms cubic-bezier(0.12, 0.78, 0.12, 1)`;
        track.style.transform = `translateX(${-Math.max(0, targetX)}px)`;
    });

    window.setTimeout(() => {
        // Hide reel after settle; keep it simple
        reelEl.classList.add('hidden');
        reelEl.setAttribute('aria-hidden', 'true');
        reelEl.classList.remove('draft-reel-s-tier');
    }, Math.max(1200, durationMs) + 250);
});

function renderDraftUI() {
    // Hide old pre-game panel if it exists
    const legacyPanel = document.getElementById('draft-panel');
    if (legacyPanel) {
        legacyPanel.classList.add('hidden');
        legacyPanel.setAttribute('aria-hidden', 'true');
    }

    const overlay = document.getElementById('draft-overlay');
    const statusEl = document.getElementById('draft-overlay-status');
    const cardsEl = document.getElementById('draft-overlay-cards');
    const rollBtn = document.getElementById('draft-roll-btn');
    if (!overlay || !statusEl || !cardsEl) return;

    const enabled = (currentRoom && currentRoom.powerCardsEnabled !== false);
    const d = currentDraftState;
    // IMPORTANT: overlay should ONLY block the UI during the actual DRAFT phase.
    const inDraftPhase = !!(currentRoom && currentRoom.currentTurn && currentRoom.currentTurn.phase === 'DRAFT');
    const show = !!(enabled && currentRoom && currentRoom.gameStarted && inDraftPhase && d && d.phase && d.phase !== 'DONE');

    // Prevent body scrollbars while the overlay is visible.
    if (document && document.body) {
        document.body.classList.toggle('draft-no-scroll', show);
    }

    overlay.classList.toggle('hidden', !show);
    overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) {
        overlay.removeAttribute('data-turn');
        overlay.removeAttribute('data-can-spin');
        overlay.removeAttribute('data-anim');
        overlay.removeAttribute('data-s-tier');
        overlay.removeAttribute('data-last-team');
        overlay.removeAttribute('data-last-tier');
        overlay.removeAttribute('data-flash');
        overlay.removeAttribute('data-nudge');
        return;
    }

    const myTeam = currentPlayer?.team;
    const myId = currentPlayer?.id;
    const available = Array.isArray(d.available) ? d.available : [];
    const picked = d.picked || { RED: [], BLUE: [] };
    const turnTeam = d.turnTeam;
    const animActive = !!d.anim;

    overlay.setAttribute('data-turn', turnTeam === 'BLUE' ? 'BLUE' : 'RED');
    overlay.setAttribute('data-anim', animActive ? '1' : '0');

    if (rollBtn) {
        const canSpin = !animActive && myTeam && (myTeam === 'RED' || myTeam === 'BLUE') && myTeam === turnTeam;
        overlay.setAttribute('data-can-spin', canSpin ? '1' : '0');
        rollBtn.disabled = !canSpin;
        rollBtn.textContent = animActive
            ? 'Çevriliyor...'
            : (turnTeam === 'RED' ? '🔴 Çevir' : '🔵 Çevir');
    }
    const last = d.lastResult;
    const lastDef = last?.type === 'SPIN' ? getPowerCardDefByKey(last.cardKey) : null;
    const lastLabel = lastDef?.name || last?.cardKey || '';
    const lastTier = lastDef?.tier ? String(lastDef.tier).toUpperCase() : '';
    const lastIsS = lastTier === 'S';
    const lastText = last?.type === 'SPIN'
        ? `${last.team === 'RED' ? '🔴' : '🔵'} aldı → ${lastLabel}`
        : '';
    const turnText = turnTeam === 'RED' ? 'Sıra: 🔴 Kırmızı' : 'Sıra: 🔵 Mavi';
    const header = `Tur: <span class="draft-strong">${escapeHtml(String(d.round || 1))}</span> • <span class="draft-strong">${escapeHtml(turnText)}</span> • Kalan Kart: <span class="draft-strong">${escapeHtml(String(available.length))}</span>`;
    const lastHtml = lastText
        ? ` • Son: <span class="draft-last ${lastIsS ? 'draft-last-s' : ''}">${escapeHtml(lastText)}${lastTier ? ` <span class="draft-tier-badge draft-tier-${escapeHtml(lastTier.toLowerCase())}">${escapeHtml(lastTier)}-Tier</span>` : ''}</span>`
        : '';
    statusEl.innerHTML = header + lastHtml;
    if (lastIsS) overlay.setAttribute('data-s-tier', '1');

    if (last?.type === 'SPIN') {
        setDraftResultEffect(last.team, lastTier);
    }

    // If an animation is active, ensure reel area is visible (server also emits draft-spin-start)
    const reelEl = document.getElementById('draft-reel');
    if (reelEl) {
        const showReel = !!d.anim;
        reelEl.classList.toggle('hidden', !showReel);
        reelEl.setAttribute('aria-hidden', showReel ? 'false' : 'true');
    }

    const availableSet = new Set(available);
    const pickedSet = new Set([...(Array.isArray(picked?.RED) ? picked.RED : []), ...(Array.isArray(picked?.BLUE) ? picked.BLUE : [])]);

    cardsEl.innerHTML = '';
    const allKeys = (typeof POWER_CARD_CATALOG !== 'undefined' && Array.isArray(POWER_CARD_CATALOG))
        ? POWER_CARD_CATALOG.map(c => c.key)
        : available;

    allKeys.forEach((key) => {
        const def = getPowerCardDefByKey(key);
        const label = def?.name || key;
        const tier = def?.tier ? `Tier ${def.tier}` : '';
        const roles = def?.roles ? def.roles.join(',') : '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'draft-card-btn draft-card-static';
        if (def?.tier) btn.classList.add(`draft-tier-${String(def.tier).toLowerCase()}`);
        const inPool = availableSet.has(key);
        const alreadyPicked = pickedSet.has(key);
        const tag = alreadyPicked ? '✅ Alındı' : inPool ? '🟢 Havuzda' : '⚪ Havuz Dışı';
        btn.innerHTML = `${escapeHtml(label)}<span class="meta">${escapeHtml([tier, roles, tag].filter(Boolean).join(' • '))}</span>`;
        if (inPool) btn.classList.add('draft-card-in-pool');
        else btn.classList.add('draft-card-out-pool');
        if (alreadyPicked) btn.classList.add('draft-card-picked');
        cardsEl.appendChild(btn);
    });
}

// Daily missions UI removed.

function markJustRevealed(cardIndex) {
    const idx = (typeof cardIndex === 'number')
        ? cardIndex
        : (typeof cardIndex === 'string' ? parseInt(cardIndex, 10) : NaN);
    if (!Number.isInteger(idx)) return;
    requestAnimationFrame(() => {
        const el = document.querySelector(`.card[data-index="${idx}"]`);
        if (!el) return;
        el.classList.add('just-revealed');
        const cleanup = () => el.classList.remove('just-revealed');
        el.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, 1200);
    });
}

function playRevealSfxForCardType(cardType, guessingTeam) {
    if (!soundManager || !soundManager.enabled) return;
    const type = (cardType || '').toUpperCase();
    const team = (guessingTeam || '').toUpperCase();

    if (type === 'ASSASSIN') {
        soundManager.assassinHit();
        return;
    }

    // Wrong guess = neutral or opponent color
    if (team && (type === 'NEUTRAL' || ((type === 'RED' || type === 'BLUE') && type !== team))) {
        soundManager.wrongGuess();
        return;
    }

    soundManager.cardReveal();
}

function displayGameFinished(data) {
    const winner = data && data.winner ? data.winner : null;
    if (!winner) return;

    if (window.__gameFinishedShown) return;
    window.__gameFinishedShown = true;

    const gameOverElement = document.getElementById('game-over');
    const winnerTextElement = document.getElementById('winner-text');

    soundManager.victory();

    if (winnerTextElement) {
        const winnerText = winner === 'RED' ? '🔴 Kırmızı Takım Kazandı!' : '🔵 Mavi Takım Kazandı!';
        winnerTextElement.textContent = winnerText;
    }

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
    }
}

function maybeDisplayGameFinishedFromGameState(gameState) {
    if (!gameState || !gameState.gameOver || !gameState.winner) return;
    displayGameFinished({ winner: gameState.winner });
}

function buildPlayerBadgeHtml(player) {
    const teamClass = player.team === 'RED' ? 'red' : (player.team === 'BLUE' ? 'blue' : '');
    const name = (player.username || (player.isBot ? 'Bot' : 'Oyuncu'));
    const initial = (name || '?').charAt(0).toUpperCase();
    const roleIcon = player.role === 'SPYMASTER' ? '🕵️' : (player.role === 'OPERATIVE' ? '🎯' : '');
    return `
        <span class="avatar ${teamClass}">${initial}</span>
        <span class="player-name">${name}</span>
        ${roleIcon ? `<span class="role-icon">${roleIcon}</span>` : ''}
    `;
}

function clearMySelectionUI() {
    if (selectedCardIndex === null) return;
    const cardElement = document.querySelector(`.card[data-index="${selectedCardIndex}"]`);
    if (cardElement) {
        const initialEl = cardElement.querySelector('.player-initial');
        if (initialEl && initialEl.dataset.playerId === currentPlayer?.id) {
            initialEl.remove();
        }
        const btn = cardElement.querySelector('.reveal-btn');
        if (btn && btn.dataset.playerId === currentPlayer?.id) {
            btn.remove();
        }
        cardElement.classList.remove('selected');
    }
    selectedCardIndex = null;
}

function applySelectionUI(cardIndex, team, playerId, playerName, isMine) {
    const cardElement = document.querySelector(`.card[data-index="${cardIndex}"]`);
    if (!cardElement || cardElement.classList.contains('revealed')) return;

    // Initial badge (bottom-left)
    let initialEl = cardElement.querySelector('.player-initial');
    if (!initialEl) {
        initialEl = document.createElement('div');
        initialEl.className = 'player-initial';
        cardElement.appendChild(initialEl);
    }

    const initial = (playerName || '?').charAt(0).toUpperCase();
    initialEl.textContent = initial;
    initialEl.dataset.playerId = playerId || '';
    initialEl.classList.toggle('red', team === 'RED');
    initialEl.classList.toggle('blue', team === 'BLUE');

    // Confirm button (bottom-right) only for the player who selected
    let confirmBtn = cardElement.querySelector('.reveal-btn');
    if (isMine) {
        if (!confirmBtn) {
            confirmBtn = document.createElement('button');
            confirmBtn.className = 'reveal-btn';
            confirmBtn.type = 'button';
            confirmBtn.textContent = '✓';
            cardElement.appendChild(confirmBtn);
        }
        confirmBtn.dataset.playerId = playerId || '';
        confirmBtn.style.display = 'flex';
        confirmBtn.onclick = (e) => {
            e.stopPropagation();
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.7';
            makeGuess(cardIndex);
        };

        cardElement.classList.add('selected');
    } else if (confirmBtn && confirmBtn.dataset.playerId === playerId) {
        // Never show another player's confirm button on this client
        confirmBtn.remove();
    }
}

function selectCard(cardIndex) {
    if (!currentPlayer || !currentRoom) return;

    if (isBombLockedForMe(cardIndex)) {
        return;
    }

    const isOperative = currentPlayer.role === 'OPERATIVE';
    const isCurrentTeam = currentPlayer.team === currentRoom.currentTurn?.team;
    const isGuessPhase = currentRoom.currentTurn?.phase === 'GUESS';
    const hasClue = !!currentRoom.clue;

    if (!isOperative || !isCurrentTeam || !isGuessPhase || !hasClue) {
        return;
    }

    // Toggle: click the same selected card to clear
    if (selectedCardIndex === cardIndex) {
        clearMySelectionUI();
        return;
    }

    clearMySelectionUI();
    selectedCardIndex = cardIndex;

    soundManager.cardSelect();

    // Broadcast selection to teammates (and apply immediately for snappy UI)
    applySelectionUI(cardIndex, currentPlayer.team, currentPlayer.id, currentPlayer.username, true);
    socket.emit('card-clicked', { cardIndex });
}

function syncCurrentPlayerFromRoom(room) {
    if (!currentPlayer || !room) return;
    const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
    const me = playersList.find(p => p && p.id === currentPlayer.id);
    if (!me) return;
    // Keep client-side state aligned with server authoritative state
    currentPlayer.username = me.username ?? currentPlayer.username;
    currentPlayer.team = me.team ?? null;
    currentPlayer.role = me.role ?? null;
}

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

    // Global mouse tracking for optional overlays (e.g., crosshair).
    // Keep it cheap: update at most once per animation frame and only when actually needed.
    const prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let crosshairEl = null;

    const effectsEnabled = () => {
        if (prefersReducedMotion) return false;
        const cl = document.body && document.body.classList;
        if (!cl) return false;
        return !cl.contains('power-save') && !cl.contains('animations-disabled');
    };

    const getCrosshairEl = () => {
        if (crosshairEl && crosshairEl.isConnected) return crosshairEl;
        crosshairEl = document.querySelector('.crosshair-overlay');
        return crosshairEl;
    };

    const shouldTrackPointer = () => {
        if (!effectsEnabled()) return false;
        const ch = getCrosshairEl();
        if (!ch) return false;
        return !ch.classList.contains('hidden');
    };

    let pendingMove = null;
    let moveRaf = 0;
    const flushMove = () => {
        moveRaf = 0;
        const e = pendingMove;
        pendingMove = null;
        if (!e || !shouldTrackPointer()) return;
        root.style.setProperty('--mouse-x', `${e.clientX}px`);
        root.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    window.addEventListener('mousemove', (e) => {
        if (!shouldTrackPointer()) return;
        pendingMove = e;
        if (!moveRaf) moveRaf = window.requestAnimationFrame(flushMove);
    }, { passive: true });
});

// Login function
function login() {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();
    let backgroundColor = document.getElementById('background-color').value;
    
    // If no color selected, use rainbow (empty or default)
    if (!backgroundColor) {
        backgroundColor = '#rainbow';
    }
    
    console.log('Login function called with username:', username);

    if (!username) {
        alert('Lütfen bir kullanıcı adı girin');
        return;
    }

    if (username.length < 2 || username.length > 15) {
        alert('Kullanıcı adı 2-15 karakter arasında olmalıdır');
        return;
    }

    // Save background color preference
    localStorage.setItem('backgroundColor', backgroundColor);
    applyBackgroundColor(backgroundColor);

    console.log('Emitting login event with username:', username);
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

        // Update username display in lobby
        const currentUsernameEl = document.getElementById('current-username');
        if (currentUsernameEl) {
            currentUsernameEl.textContent = username;
        }

        // Load saved background color
        const savedBackgroundColor = localStorage.getItem('backgroundColor');
        if (savedBackgroundColor) {
            applyBackgroundColor(savedBackgroundColor);
            const colorInput = document.getElementById('background-color');
            if (colorInput) colorInput.value = savedBackgroundColor;
        }

        // Load saved power save mode
        const savedPowerSave = localStorage.getItem('powerSaveMode');
        if (savedPowerSave === 'true') {
            document.body.classList.add('power-save');
            const btn = document.getElementById('power-save-toggle');
            if (btn) {
                btn.classList.add('power-save-enabled');
            }
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
        const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
        const playerCount = room.playerCount ?? playersList.length;
        const maxPlayers = room.maxPlayers ?? '-';

        // room.gameState is used on server as the actual game state object, so use gameStarted boolean
        const statusText = room.gameStarted ? 'Oynanıyor' : 'Bekleniyor';

        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <div class="room-info">
                <h4>${room.name}</h4>
                <p>Oyuncular: ${playerCount}/${maxPlayers}</p>
                <p>Durum: ${statusText}</p>
            </div>
            <button class="btn btn-primary" onclick="joinRoom('${room.id}')">Katıl</button>
        `;
        roomsContainer.appendChild(roomElement);
    });
});

// Room state updates
socket.on('room-state', (room) => {
    currentRoom = normalizeRoomFromServer(room);
    syncCurrentPlayerFromRoom(room);
    updateRoomState(room);
});

socket.on('room-updated', (room) => {
    currentRoom = normalizeRoomFromServer(room);
    syncCurrentPlayerFromRoom(room);
    updateRoomDisplay(room);
    updateRoomState(room);
});

// Generic server error messages (avoid one-off `socket.once('error')` handlers)
socket.on('error', (msg) => {
    // Keep UX consistent: prefer in-site notifications.
    showNotification(String(msg || 'Bir hata oluştu'), 'error');
});

// Create room
function createRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxPlayers = document.getElementById('max-players').value;
    const wordCategory = document.getElementById('word-category')?.value || 'genel';
    const tournamentMode = !!document.getElementById('tournament-mode')?.checked;
    const draftPicksCreateRaw = Number(document.getElementById('draft-picks-create')?.value);
    const draftPicksPerTeam = Math.max(1, Math.min(8, Number.isFinite(draftPicksCreateRaw) ? Math.floor(draftPicksCreateRaw) : 4));
    const fastDraft = !!document.getElementById('fast-draft')?.checked;

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
        wordCategory: wordCategory,
        powerCardsEnabled: !tournamentMode,
        draftPicksPerTeam,
        fastDraft
    });

    // Server will respond with `room-joined` for the creator.
    socket.once('room-joined', (data) => {
        currentRoom = data;
        syncCurrentPlayerFromRoom(data);
        showScreen('room-screen');
        updateRoomDisplay(data);
        updateRoomState(data);
    });
}

function togglePowerCards() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host ayarlayabilir', 'error');
        return;
    }
    if (currentRoom && currentRoom.gameStarted) {
        showNotification('Oyun başladıktan sonra değiştirilemez', 'error');
        return;
    }
    socket.emit('toggle-power-cards');
}

function setDraftPicksPerTeam(value) {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host ayarlayabilir', 'error');
        return;
    }
    if (currentRoom && currentRoom.gameStarted) {
        showNotification('Oyun başladıktan sonra değiştirilemez', 'error');
        return;
    }
    socket.emit('set-draft-picks-per-team', value);
}

// Join room
function joinRoom(roomId) {
    socket.emit('join-room', roomId);

    socket.once('room-joined', (data) => {
        // Persist room immediately so UI elements have players/roles
        currentRoom = data;
        syncCurrentPlayerFromRoom(data);
        showScreen('room-screen');
        updateRoomDisplay(data);
        updateRoomState(data);
    });

    socket.once('join-error', (error) => {
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

    socket.once('room-joined', (data) => {
        currentRoom = data;
        syncCurrentPlayerFromRoom(data);
        showScreen('room-screen');
        updateRoomDisplay(data);
        updateRoomState(data);
    });

    socket.once('join-error', (error) => {
        alert('Davet kodu geçersiz: ' + error);
    });

    socket.once('error', (error) => {
        alert('Davet kodu geçersiz: ' + error);
    });
}

// Leave room
function leaveRoom() {
    socket.emit('leave-room');
    resetClientRoomState();
    showScreen('lobby-screen');
    refreshRooms();
}

// Update room display
function updateRoomDisplay(room) {
    document.getElementById('room-title').textContent = room.name || `Oda #${room.id}`;
    const invite = room.inviteCode || room.id || room.roomId || '---';
    const inviteEl = document.getElementById('invite-code-display');
    if (inviteEl) inviteEl.textContent = `Davet Kodu: ${invite}`;

    // Host-only: show "Lobiyi Kapat" button
    const closeBtn = document.getElementById('close-lobby-btn');
    if (closeBtn) {
        const isHost = !!(currentPlayer && room && room.host && currentPlayer.id === room.host);
        closeBtn.classList.toggle('hidden', !isHost);
    }
}

// Host can force-close the room and send everyone back to lobby
function closeLobby() {
    if (!currentRoom || !currentPlayer) return;
    // No extra modals/UI; a simple confirmation is enough to prevent misclick.
    const ok = confirm('Lobi kapatılsın mı? (Herkes lobiye dönecek)');
    if (!ok) return;

    showNotification('Lobi kapatılıyor...', 'info');
    socket.emit('close-room');
}

// Join team
function joinTeam(team, role) {
    socket.emit('join-team', { team, role });
    // Optimistic local update; server room-updated will confirm
    if (currentPlayer) {
        currentPlayer.team = team;
        currentPlayer.role = role;
    }
}

// Add bot
function addBot(team, role) {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host bot ekleyebilir', 'error');
        return;
    }
    socket.emit('add-bot', { team, role });
}

// Toggle bot management panel
function toggleBotManagement() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host botları yönetebilir', 'error');
        return;
    }
    const botManagement = document.getElementById('bot-management');
    if (botManagement.classList.contains('hidden')) {
        botManagement.classList.remove('hidden');
    } else {
        botManagement.classList.add('hidden');
    }
}

// Remove bot
function removeBot(botId) {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host bot kaldırabilir', 'error');
        return;
    }
    socket.emit('remove-bot', botId);
}

// Remove player from team
function removePlayer(playerId) {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host oyuncu atabilir', 'error');
        return;
    }
    if (currentPlayer && playerId === currentPlayer.id) return;
    socket.emit('remove-player', playerId);
}

// Start game
function startGame() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host oyunu başlatabilir', 'error');
        return;
    }
    socket.emit('start-game');
}

// Randomize teams for all players
function randomizeTeams() {
    const isHost = !!(currentRoom && currentPlayer && currentRoom.host === currentPlayer.id);
    if (!isHost) {
        showNotification('Sadece host takımları karıştırabilir', 'error');
        return;
    }
    socket.emit('random-teams');
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
    window.gameStartedModalShown = false;

    if (currentRoom) {
        currentRoom.gameStarted = true;
        currentRoom.currentTurn = data.currentTurn;
        currentRoom.gameState = 'playing';
        currentRoom.board = data.board;
        currentRoom.clue = null;
        currentRoom.redRemaining = data.redRemaining || 9;
        currentRoom.blueRemaining = data.blueRemaining || 8;
    }

    // Hide team selection, show game phase
    const teamSelectionPhase = document.getElementById('team-selection-phase');
    const gamePhase = document.getElementById('game-phase');

    if (teamSelectionPhase) teamSelectionPhase.classList.add('hidden');
    if (gamePhase) gamePhase.classList.remove('hidden');

    // Show power cards button above chat if power cards are enabled
    const powerCardsAboveChat = document.getElementById('power-cards-above-chat');
    if (powerCardsAboveChat && currentRoom && currentRoom.powerCardsEnabled) {
        powerCardsAboveChat.classList.remove('hidden');
    }

    // Move top bar to bottom after game starts
    const topBar = document.querySelector('.top-bar');
    if (topBar) {
        topBar.classList.add('game-started');
    }

    // Add game-started class to body for padding
    document.body.classList.add('game-started');

    // Render game elements
    renderBoard(currentBoard);
    updateScores(currentBoard);
    updateTurnInfo(data.currentTurn);
    showPlayerPanels();

    if (currentRoom) {
        updateGameTeamMembers(currentRoom);
        updateScoreBoardPlayers(currentRoom);
    }

    // If server opened the in-game draft, show overlay immediately.
    renderDraftUI();

    soundManager.gameStart();
});

// Card revealed event
socket.on('card-revealed', (data) => {
    // Server sends { cardIndex, gameState }
    const prevTurnTeam = currentRoom?.currentTurn?.team;
    if (data && data.gameState && data.gameState.board) {
        currentBoard = data.gameState.board;
        if (currentRoom) {
            currentRoom.board = data.gameState.board;
            currentRoom.currentTurn = data.gameState.currentTurn;
        }
        renderBoard(currentBoard);
        updateScores(currentBoard);
        markJustRevealed(data.cardIndex);
        appendRevealLogFromGameState(data.gameState, data.cardIndex, data.by);
        maybeDisplayGameFinishedFromGameState(data.gameState);
        const revealedType = data.gameState.board?.[data.cardIndex]?.type;
        playRevealSfxForCardType(revealedType, prevTurnTeam);
        return;
    }

    // Backward compatibility: { index, card, guessesLeft }
    if (!data || typeof data.index !== 'number' || !data.card) return;

    if (currentBoard && currentBoard[data.index]) {
        currentBoard[data.index] = data.card;
    }

    const cardElement = document.querySelector(`.card[data-index="${data.index}"]`);
    if (cardElement) {
        cardElement.classList.remove('selected', 'animating');
        cardElement.classList.add('revealed', data.card.type.toLowerCase());
        cardElement.classList.add('just-revealed');
        cardElement.addEventListener('animationend', () => cardElement.classList.remove('just-revealed'), { once: true });
        setTimeout(() => cardElement.classList.remove('just-revealed'), 1200);
        cardElement.onclick = null;
        cardElement.style.cursor = 'not-allowed';
        cardElement.style.opacity = '1';
    }

    if (currentBoard) {
        updateScores(currentBoard);
    }

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo && typeof data.guessesLeft === 'number') {
        guessesInfo.textContent = `Kalan tahmin: ${data.guessesLeft}`;
    }

    playRevealSfxForCardType(data.card?.type, prevTurnTeam);
});

// Turn ended / switched event
socket.on('turn-ended', (data) => {
    if (currentRoom) {
        currentRoom.currentTurn = data.currentTurn;
        currentRoom.clue = null;
    }
    clearMySelectionUI();
    soundManager.turnSwitch();
    updateTurnInfo(data.currentTurn);
    showPlayerPanels();

    renderClueInfo(null);

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo) guessesInfo.textContent = '';

    // Re-render board to update click handlers
    if (currentBoard) {
        renderBoard(currentBoard);
    }
});

// Clue given event
socket.on('clue-given', (data) => {
    // Server should send: { clue, gameState }
    // Older server builds may send just gameState
    const gameState = data && data.gameState ? data.gameState : data;
    const clue = data && data.clue ? data.clue : gameState?.currentClue;

    if (currentRoom && gameState) {
        currentRoom.currentTurn = gameState.currentTurn;
        currentRoom.board = gameState.board;
        currentRoom.clue = clue || null;
    }
    if (gameState && gameState.board) {
        currentBoard = gameState.board;
    }

    renderClueInfo(clue, gameState?.currentTurn?.team);

    const guessesInfo = document.getElementById('guesses-info');
    if (guessesInfo && clue) {
        guessesInfo.textContent = `Kalan tahmin: ${(clue?.number || 0) + 1}`;
    }

    // Re-render board so cards become clickable for operatives
    if (currentBoard) {
        renderBoard(currentBoard);
    }

    // Show operative controls
    showPlayerPanels();

    soundManager.clueGiven();
});

// Guess made event
socket.on('guess-made', (data) => {
    const prevTurnTeam = currentRoom?.currentTurn?.team;
    if (data.gameState) {
        currentBoard = data.gameState.board;
        if (currentRoom) {
            currentRoom.board = data.gameState.board;
            currentRoom.currentTurn = data.gameState.currentTurn;
        }
    }

    // Re-render board to show revealed card
    if (currentBoard) {
        renderBoard(currentBoard);
        updateScores(currentBoard);
    }

    if (data && data.cardIndex !== undefined && data.cardIndex !== null) {
        markJustRevealed(data.cardIndex);
    }
    if (data && data.gameState) {
        maybeDisplayGameFinishedFromGameState(data.gameState);
    }

    if (data && data.gameState && data.cardIndex !== undefined && data.cardIndex !== null) {
        appendRevealLogFromGameState(data.gameState, data.cardIndex, data.by);
    }

    // Clear local selection after any guess resolves
    clearMySelectionUI();

    const idx = (typeof data?.cardIndex === 'number')
        ? data.cardIndex
        : (typeof data?.cardIndex === 'string' ? parseInt(data.cardIndex, 10) : NaN);
    if (data && data.gameState && Number.isInteger(idx)) {
        const revealedType = data.gameState.board?.[idx]?.type;
        playRevealSfxForCardType(revealedType, prevTurnTeam);
    } else {
        soundManager.cardReveal();
    }
});

// Update room state display
function updateRoomState(room) {
    const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});

    // Ensure local player state stays in sync so turn/click gating works
    syncCurrentPlayerFromRoom(room);

    const isHost = !!(currentPlayer && room && room.host && currentPlayer.id === room.host);

    // Tournament toggle (host only, pre-game)
    const powerBtn = document.getElementById('toggle-power-cards-btn');
    if (powerBtn) {
        const enabled = (room && room.powerCardsEnabled !== false);
        powerBtn.textContent = '⚡ Güç Kartları';
        const show = isHost && !room.gameStarted;
        powerBtn.classList.toggle('hidden', !show);
        powerBtn.disabled = !show;
    }

    // Draft picks per team (host only, pre-game, only relevant when power cards enabled)
    const picksWrap = document.getElementById('draft-picks-setting');
    const picksSel = document.getElementById('draft-picks-per-team');
    if (picksWrap && picksSel) {
        const enabled = (room && room.powerCardsEnabled !== false);
        const show = isHost && !room.gameStarted && enabled;
        picksWrap.classList.toggle('hidden', !show);
        picksSel.disabled = !show;

        const v = Math.max(1, Math.min(8, Number.isFinite(Number(room?.draftPicksPerTeam)) ? Math.floor(Number(room.draftPicksPerTeam)) : 4));
        if (String(picksSel.value) !== String(v)) {
            picksSel.value = String(v);
        }

        if (!picksSel.__draftPicksBound) {
            picksSel.__draftPicksBound = true;
            picksSel.addEventListener('change', () => {
                const raw = Number(picksSel.value);
                setDraftPicksPerTeam(raw);
            });
        }
    }

    // Host-only controls
    const botMgmtBtn = document.getElementById('bot-management-btn');
    if (botMgmtBtn) botMgmtBtn.disabled = !isHost;
    const randomTeamsBtn = document.getElementById('random-teams-btn');
    if (randomTeamsBtn) randomTeamsBtn.disabled = !isHost;

    // If non-host somehow opened bot panel, close it.
    const botManagement = document.getElementById('bot-management');
    if (!isHost && botManagement && !botManagement.classList.contains('hidden')) {
        botManagement.classList.add('hidden');
    }
    
    // Update bot list
    const botList = document.getElementById('bot-list');
    if (botList) {
        botList.innerHTML = '';
        const bots = playersList.filter(p => p.isBot);
        if (bots.length > 0) {
            bots.forEach(bot => {
                const botItem = document.createElement('div');
                botItem.className = 'bot-item';
                botItem.innerHTML = `
                    <div class="bot-info">${bot.team === 'RED' ? '🔴' : '🔵'} ${bot.role === 'SPYMASTER' ? 'Casusbaşı' : 'Operatif'} Bot</div>
                    ${isHost ? `<button class="remove-btn" onclick="removeBot('${bot.id}')">Kaldır</button>` : ''}
                `;
                botList.appendChild(botItem);
            });
        } else {
            botList.innerHTML = '<p>Henüz bot eklenmemiş</p>';
        }
    }

    updateTeamDisplays(room);
    updateScoreBoardPlayers(room);

    // Show power cards button above chat during game if power cards are enabled
    const powerCardsAboveChat = document.getElementById('power-cards-above-chat');
    if (powerCardsAboveChat) {
        const enabled = (room && room.powerCardsEnabled !== false);
        const show = room.gameStarted && enabled;
        powerCardsAboveChat.classList.toggle('hidden', !show);
    }

    // Keep DenemeChat recipient list in sync with current room players
    refreshDenemeChatRecipients(room);

    // Competitive panels
    renderDraftUI();

    // If the server updated game turn/phase via room updates (e.g. after draft),
    // keep in-game UI and click gating in sync even if a specific game event was missed.
    if (room && room.gameStarted) {
        if (Array.isArray(room.board) && room.board.length > 0) {
            currentBoard = room.board;
            renderBoard(currentBoard);
            updateScores(currentBoard);
        }

        if (room.currentTurn) {
            updateTurnInfo(room.currentTurn);
        }

        renderClueInfo(room.clue, room.currentTurn?.team);
        showPlayerPanels();
    }
}

// Update team displays
function updateTeamDisplays(room) {
    ['red-spymaster', 'red-operatives', 'blue-spymaster', 'blue-operatives'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    // Server sends room.players as array
    const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
    const isHost = !!(currentPlayer && room && room.host && currentPlayer.id === room.host);
    
    playersList.forEach(player => {
        if (!player.team || !player.role) return; // Skip unassigned players
        
        const slotId = `${player.team.toLowerCase()}-${player.role === 'SPYMASTER' ? 'spymaster' : 'operatives'}`;
        const slot = document.getElementById(slotId);
        if (slot) {
            const badge = document.createElement('div');
            let badgeClass = 'player-badge';
            if (player.team === 'RED') badgeClass += ' red';
            else if (player.team === 'BLUE') badgeClass += ' blue';
            if (player.isBot) badgeClass += ' bot';
            const saved = (localStorage.getItem('username') || '').trim();
            const isMe = (currentPlayer && player.id === currentPlayer.id) || (saved && player.username === saved);
            if (isMe) badgeClass += ' you';

            badge.className = badgeClass;
            badge.innerHTML = buildPlayerBadgeHtml(player);

            // Host-only actions: show small kick icon on player badges (not bots, not self)
            if (isHost && !player.isBot && !(currentPlayer && player.id === currentPlayer.id)) {
                const kickBtn = document.createElement('button');
                kickBtn.type = 'button';
                kickBtn.className = 'kick-btn';
                kickBtn.title = 'Oyuncuyu At';
                kickBtn.setAttribute('aria-label', 'Oyuncuyu At');
                kickBtn.textContent = '✕';
                kickBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removePlayer(player.id);
                };
                badge.appendChild(kickBtn);
            }

            // Bots: keep existing behavior (host can remove via management or click flows)
            if (!isHost) badge.style.cursor = 'default';
            slot.appendChild(badge);
        }
    });

    // Check start conditions
    const redSpymaster = playersList.find(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const blueSpymaster = playersList.find(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    const redOperatives = playersList.filter(p => p.team === 'RED' && p.role === 'OPERATIVE');
    const blueOperatives = playersList.filter(p => p.team === 'BLUE' && p.role === 'OPERATIVE');

    const canStartGame = redSpymaster && blueSpymaster && redOperatives.length > 0 && blueOperatives.length > 0;

    const startBtn = document.getElementById('start-game-btn');
    const readyStatus = document.getElementById('ready-status');

    if (canStartGame) {
        startBtn.disabled = !isHost;
        readyStatus.textContent = isHost ? 'Oyun başlatılmaya hazır!' : 'Oyun hazır (host başlatabilir)';
    } else {
        startBtn.disabled = true;
        readyStatus.textContent = 'Her takımda en az bir casusbaşı ve bir operatif olmalı';
    }
}

// Host kicked you out
socket.on('kicked', (data) => {
    showNotification('Host seni lobiden attı', 'error');
    currentRoom = null;
    currentBoard = null;
    selectedCardIndex = null;
    returnToLobby();
});

// Update game team members
function updateGameTeamMembers(room) {
    const redMembers = document.getElementById('game-red-members');
    const blueMembers = document.getElementById('game-blue-members');

    if (!redMembers || !blueMembers) return;

    redMembers.innerHTML = '';
    blueMembers.innerHTML = '';

    const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
    playersList.forEach(player => {
        if (!player.team) return;
        const memberDiv = document.createElement('div');
        memberDiv.className = `player-badge ${player.team === 'RED' ? 'red' : 'blue'}`;
        memberDiv.innerHTML = buildPlayerBadgeHtml(player);
        if (player.team === 'RED') {
            redMembers.appendChild(memberDiv);
        } else if (player.team === 'BLUE') {
            blueMembers.appendChild(memberDiv);
        }
    });
}

// Update score board team players
function updateScoreBoardPlayers(room) {
    // Get players list - server sends it as array
    const playersList = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
    
    // Find spymasters for each team (multiple possible)
    const redSpymasters = playersList.filter(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const blueSpymasters = playersList.filter(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    
    // Update spymaster displays
    const redSpymasterDiv = document.getElementById('red-team-spymaster');
    const blueSpymasterDiv = document.getElementById('blue-team-spymaster');
    
    if (redSpymasterDiv) {
        if (redSpymasters.length > 0) {
            redSpymasterDiv.innerHTML = `Casusbaşı: <span class="spymaster-name">${redSpymasters.map(p => `<span class="player-badge red">${buildPlayerBadgeHtml(p)}</span>`).join(', ')}</span>`;
        } else {
            redSpymasterDiv.innerHTML = `Casusbaşı: <span class="spymaster-name">-</span>`;
        }
    }
    if (blueSpymasterDiv) {
        if (blueSpymasters.length > 0) {
            blueSpymasterDiv.innerHTML = `Casusbaşı: <span class="spymaster-name">${blueSpymasters.map(p => `<span class="player-badge blue">${buildPlayerBadgeHtml(p)}</span>`).join(', ')}</span>`;
        } else {
            blueSpymasterDiv.innerHTML = `Casusbaşı: <span class="spymaster-name">-</span>`;
        }
    }
    
    // Update operative displays
    const redOperativesDiv = document.getElementById('red-team-operatives');
    const blueOperativesDiv = document.getElementById('blue-team-operatives');
    
    if (redOperativesDiv) {
        redOperativesDiv.innerHTML = '';
        playersList.filter(p => p.team === 'RED' && p.role === 'OPERATIVE').forEach(p => {
            const badge = document.createElement('div');
            const isMe = currentPlayer && p.id === currentPlayer.id;
            badge.className = `player-badge red ${p.isBot ? 'bot' : ''} ${isMe ? 'you' : ''}`.trim();
            badge.innerHTML = buildPlayerBadgeHtml(p);
            redOperativesDiv.appendChild(badge);
        });
    }
    if (blueOperativesDiv) {
        blueOperativesDiv.innerHTML = '';
        playersList.filter(p => p.team === 'BLUE' && p.role === 'OPERATIVE').forEach(p => {
            const badge = document.createElement('div');
            const isMe = currentPlayer && p.id === currentPlayer.id;
            badge.className = `player-badge blue ${p.isBot ? 'bot' : ''} ${isMe ? 'you' : ''}`.trim();
            badge.innerHTML = buildPlayerBadgeHtml(p);
            blueOperativesDiv.appendChild(badge);
        });
    }
}


// Update turn info
function updateTurnInfo(currentTurn) {
    const turnInfo = document.getElementById('turn-info');
    // currentTurn is object { team: 'RED'/'BLUE', phase: 'HINT'/'GUESS' }
    const team = currentTurn && currentTurn.team ? currentTurn.team : 'RED';
    const isRed = team === 'RED';
    turnInfo.textContent = `Sıra: ${isRed ? 'KIRMIZI' : 'MAVİ'} TAKIM`;

    // Reset classes and add specific color
    turnInfo.className = 'current-turn-badge';
    turnInfo.style.color = isRed ? '#dc2626' : '#2563eb';
    turnInfo.style.borderColor = isRed ? '#ef4444' : '#3b82f6';
}

// Setup board interactions (Simplified & Robust)
function setupBoardInteractions() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;

    // Idempotent: renderBoard() is called often; don't attach listeners multiple times.
    if (boardElement.dataset && boardElement.dataset.interactionsBound === '1') return;
    if (boardElement.dataset) boardElement.dataset.interactionsBound = '1';

    // Hover SFX + ripple (throttled)
    let lastHoverKey = null;
    let lastHoverAt = 0;

    const setCardMouseVars = (card, ev) => {
        try {
            const r = card.getBoundingClientRect();
            const mx = ((ev.clientX - r.left) / Math.max(1, r.width)) * 100;
            const my = ((ev.clientY - r.top) / Math.max(1, r.height)) * 100;
            card.style.setProperty('--mx', `${mx}%`);
            card.style.setProperty('--my', `${my}%`);
        } catch (_) {
            // ignore
        }
    };

    const setBoardMouseVars = (el, ev) => {
        try {
            const r = el.getBoundingClientRect();
            const bx = ((ev.clientX - r.left) / Math.max(1, r.width)) * 100;
            const by = ((ev.clientY - r.top) / Math.max(1, r.height)) * 100;
            el.style.setProperty('--bx', `${bx}%`);
            el.style.setProperty('--by', `${by}%`);
        } catch (_) {
            // ignore
        }
    };

    boardElement.addEventListener('mouseenter', () => {
        boardElement.classList.add('board-ripple');
    }, { passive: true });

    boardElement.addEventListener('mouseleave', () => {
        boardElement.classList.remove('board-ripple');
    }, { passive: true });

    boardElement.addEventListener('mousemove', (e) => {
        setBoardMouseVars(boardElement, e);
        const card = e.target.closest('.card');
        if (!card) return;
        setCardMouseVars(card, e);
    }, { passive: true });

    boardElement.addEventListener('mouseover', (e) => {
        // Make board fire/smoke react immediately on hover (even before any mousemove)
        setBoardMouseVars(boardElement, e);

        const card = e.target.closest('.card');
        if (!card) return;
        if (card.classList.contains('revealed')) return;

        // Avoid repeated fire when moving within the same card
        const idx = card.dataset.index ?? '';
        const key = `card:${idx}`;
        const now = Date.now();
        if (key === lastHoverKey && (now - lastHoverAt) < 180) return;

        lastHoverKey = key;
        lastHoverAt = now;

        // Visual ripple disabled
        // card.classList.remove('hover-ripple');
        // // Force reflow so animation can restart
        // void card.offsetWidth;
        // card.classList.add('hover-ripple');
        // setTimeout(() => card.classList.remove('hover-ripple'), 650);

        // Sound
        if (soundManager && soundManager.enabled) {
            soundManager.cardHover();
        }
    }, { capture: true });

    // Use event delegation properly
    boardElement.onclick = (e) => {
        // Find closest card element if clicked on icon/text inside
        const card = e.target.closest('.card');

        // Ensure we clicked a card and it has an index
        if (card && card.dataset.index !== undefined) {
            e.preventDefault(); // Stop default behaviors
            const index = parseInt(card.dataset.index);

            if (currentRoom && currentRoom.gameState === 'playing') {
                // Route to the new two-step selection/confirm flow
                selectCard(index);
            }
        }
    };

    // Suspicion ping (right-click) - operatives only, spymaster doesn't see
    boardElement.oncontextmenu = (e) => {
        const card = e.target.closest('.card');
        if (!card || card.dataset.index === undefined) return;
        e.preventDefault();

        const index = parseInt(card.dataset.index, 10);
        if (!Number.isInteger(index)) return;
        if (!currentRoom || currentRoom.gameState !== 'playing') return;
        if (!currentPlayer || currentPlayer.role !== 'OPERATIVE') return;
        if (!currentPlayer.team || (currentPlayer.team !== 'RED' && currentPlayer.team !== 'BLUE')) return;

        const board = currentBoard;
        const c = Array.isArray(board) ? board[index] : null;
        if (!c || c.revealed) return;

        socket.emit('suspicion', { cardIndex: index });
        soundManager.emojiClick();
    };
}

// Legacy handler kept for compatibility; delegate to new selection flow.
function handleCardClick(index) {
    selectCard(index);
}

// Render the game board
function renderBoard(board) {
    const gameBoard = document.getElementById('game-board');
    if (!gameBoard) return;

    // Ensure hover handlers (ripple + SFX) are attached
    setupBoardInteractions();

    gameBoard.innerHTML = '';

    if (!board || board.length === 0) {
        console.error('Board is empty or invalid');
        return;
    }

    // Set grid columns based on board size
    if (board.length === 25) {
        gameBoard.style.gridTemplateColumns = 'repeat(5, 1fr)';
        gameBoard.style.maxWidth = '1320px';
    } else if (board.length === 36) {
        gameBoard.style.gridTemplateColumns = 'repeat(6, 1fr)';
        gameBoard.style.maxWidth = '1320px';
    }

    const shouldAnimateIn = !window.__boardAnimatedIn;

    const myTeamForBlind = currentPlayer?.team;
    const blindTurns = (myTeamForBlind === 'RED' || myTeamForBlind === 'BLUE')
        ? Number(currentRoom?.powerEffects?.tactical?.blind?.[myTeamForBlind] || 0)
        : 0;
    const isBlindedForMe = blindTurns > 0;

    const myTeamForFog = currentPlayer?.team;
    const fogTurns = (myTeamForFog === 'RED' || myTeamForFog === 'BLUE')
        ? Number(currentRoom?.powerEffects?.tactical?.fog?.[myTeamForFog] || 0)
        : 0;
    const isFoggedForMe = (fogTurns > 0) && (currentPlayer?.role === 'OPERATIVE');

    board.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        if (shouldAnimateIn) cardElement.classList.add('animate-in');
        const isShadowed = (shadowedCardIndex !== null && shadowedCardIndex === index && !card.revealed);

        const wordSpan = document.createElement('span');
        wordSpan.className = 'card-word';
        wordSpan.textContent = isShadowed ? '????' : (isBlindedForMe ? '••••' : card.word);
        cardElement.appendChild(wordSpan);
        cardElement.setAttribute('data-index', index);
        cardElement.setAttribute('data-type', card.type);

        if (card.revealed) {
            cardElement.classList.add('revealed', card.type.toLowerCase());
            const check = document.createElement('div');
            check.className = 'revealed-check';
            check.textContent = '✓';
            cardElement.appendChild(check);
            cardElement.style.cursor = 'not-allowed';
            cardElement.onclick = null;
        } else {
            // Spymaster can see card types
            if (currentPlayer && currentPlayer.role === 'SPYMASTER') {
                cardElement.classList.add('spymaster-view', card.type.toLowerCase());
            }

            // Only operative from current team can click
            const isOperative = currentPlayer && currentPlayer.role === 'OPERATIVE';
            const isCurrentTeam = currentPlayer && currentRoom && currentPlayer.team === currentRoom.currentTurn?.team;
            const isGuessPhase = currentRoom && currentRoom.currentTurn?.phase === 'GUESS';
            const hasClue = currentRoom && !!currentRoom.clue;
            const myTeam = currentPlayer?.team;
            const isLockedForMe = (myTeam === 'RED' || myTeam === 'BLUE')
                ? (Array.isArray(lockedWordState?.[myTeam]) && lockedWordState[myTeam].includes(index))
                : false;
            const isBombLocked = isBombLockedForMe(index);
            const canClick = !isBombLocked && !isLockedForMe && isOperative && isCurrentTeam && currentRoom && currentRoom.gameState === 'playing' && isGuessPhase && hasClue;

            if (canClick) {
                cardElement.style.cursor = 'pointer';
                cardElement.style.opacity = '1';
                cardElement.onclick = () => selectCard(index);
            } else {
                cardElement.style.cursor = 'not-allowed';
                cardElement.style.opacity = '0.7';
            }

            if (isShadowed) {
                cardElement.classList.add('shadowed');
            }
            if (isLockedForMe) {
                cardElement.classList.add('locked');
            }
            if (isBombLocked) {
                cardElement.classList.add('bomb-locked');
            }
            if (isBlindedForMe) {
                cardElement.classList.add('blinded');
            }
            if (isFoggedForMe) {
                cardElement.classList.add('fogged');
            }

            // Suspicion markers (operatives only; spymasters excluded)
            if (currentPlayer && currentPlayer.role === 'OPERATIVE') {
                const team = currentPlayer.team;
                const marks = (team === 'RED' || team === 'BLUE') ? (suspicionMarks?.[team] || {}) : {};
                const count = Number(marks?.[index] || 0);
                if (count > 0) {
                    const badge = document.createElement('div');
                    badge.className = 'suspicion-badge';
                    badge.textContent = count > 1 ? `?${count}` : '?';
                    cardElement.appendChild(badge);
                }
            }
        }

        gameBoard.appendChild(cardElement);
    });

    if (shouldAnimateIn) {
        window.__boardAnimatedIn = true;
    }
}

// Show card overlay
function showCardOverlay(index) {
    // Legacy helper: keep name, delegate to new selection flow.
    selectCard(index);
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

// Show player panels
function showPlayerPanels() {
    if (!currentPlayer || !currentRoom) return;

    const isSpymaster = currentPlayer.role === 'SPYMASTER';
    const isCurrentTeam = currentPlayer.team === currentRoom.currentTurn?.team;

    const spymasterPanel = document.getElementById('spymaster-panel');
    const operativeControls = document.getElementById('operative-controls');
    const powerCardsSection = document.getElementById('power-cards-section');

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

    // Show power cards section during game for operatives
    if (powerCardsSection) {
        if (currentRoom.gameState === 'playing') {
            powerCardsSection.classList.remove('hidden');
        } else {
            powerCardsSection.classList.add('hidden');
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

// Make guess - click on card to guess
function makeGuess(cardIndex) {
    if (!currentPlayer || !currentRoom) return;

    if (isBombLockedForMe(cardIndex)) {
        alert('💣 Bu kart 2 tur kilitli');
        return;
    }
    
    const isOperative = currentPlayer.role === 'OPERATIVE';
    const isCurrentTeam = currentPlayer.team === currentRoom.currentTurn?.team;
    const isGuessPhase = currentRoom.currentTurn?.phase === 'GUESS';
    const hasClue = !!currentRoom.clue;
    
    if (!isOperative || !isCurrentTeam || !isGuessPhase || !hasClue) {
        alert('Tahmin yapamazsın');
        return;
    }
    
    socket.emit('make-guess', cardIndex);
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

// Power Card Functions
function togglePowerCardMenu() {
    const menu = document.getElementById('power-card-menu');
    if (menu) {
        const isHidden = menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        
        if (!isHidden) {
            // Menu is being closed
            document.removeEventListener('click', handleOutsideClick);
        } else {
            // Menu is being opened
            // Populate power cards if not already done
            populatePowerCards();
            
            // Add outside click handler
            setTimeout(() => {
                document.addEventListener('click', handleOutsideClick);
            }, 10);
        }
    }
}

function handleOutsideClick(event) {
    const menu = document.getElementById('power-card-menu');
    const button = document.querySelector('#power-cards-above-chat button');
    
    if (menu && !menu.classList.contains('hidden') && 
        !menu.contains(event.target) && 
        (!button || !button.contains(event.target))) {
        closePowerCardMenu();
        document.removeEventListener('click', handleOutsideClick);
    }
}

const POWER_CARD_CATALOG = [
    // Existing
    { key: 'extra-guess', tier: 'C', name: '➕ +1 Tahmin', description: 'Bu tur +1 tahmin hakkı ekler.', icon: '➕' },
    { key: 'boost', tier: 'C', name: '⚡ Turbo (+2)', description: 'Bu tur +2 tahmin hakkı ekler.', icon: '⚡' },
    { key: 'peek', tier: 'C', name: '👁️ Fısılda', description: 'Takımına rastgele 1 kartın rengini gösterir (açılmaz).', icon: '👁️' },
    { key: 'peek2', tier: 'B', name: '👁️‍🗨️ Çift Fısılda', description: 'Takımına rastgele 2 kartın rengini gösterir (açılmaz).', icon: '👁️‍🗨️' },
    { key: 'neutral-flip', tier: 'D', name: '⚪ Nötr Aç', description: 'Rastgele 1 nötr kartı herkes için açar (tahmin hakkını etkilemez).', icon: '⚪' },
    { key: 'lock', tier: 'B', name: '🔒 Sustur', description: 'Rakibin bir sonraki turunu atlatır (sıra tekrar sizde).', icon: '🔒' },

    // 🔵 Spymaster odaklı
    { key: 'extra-hint', tier: 'C', name: '🧠 Ek İpucu', description: 'Bu tur 1 kelime daha söyleyebilirsin (sayı değişmez).', icon: '🧠' },
    { key: 'number-bend', tier: 'B', name: '🔢 Sayı Bükümü', description: 'Verilen sayı bu tur +1 veya -1 uygulanır.', icon: '🔢' },
    { key: 'silent-hint', tier: 'B', name: '🤫 Sessiz İpucu', description: 'Bu tur ipucu tek kelime olmak zorunda değil (cümle).', icon: '🤫' },
    { key: 'absolute-hint', tier: 'S', name: '👑 Mutlak İpucu', description: 'Bu tur tek kelime yerine kısa tanım yazabilirsin.', icon: '👑' },

    // 🟢 Operatif odaklı
    { key: 'intuition', tier: 'C', name: '🟢 Sezgi', description: 'Seçtiğin 1 kelimenin rengi takımın mı? (evet/hayır)', icon: '🟢' },
    { key: 'second-chance', tier: 'B', name: '🎯 İkinci Şans', description: 'Bu tur ilk yanlış tahminden sonra tur bitmez (Assassin hariç).', icon: '🎯' },
    { key: 'double-guess', tier: 'C', name: '➕ Çifte Tahmin', description: 'Bu tur +1 ekstra tahmin hakkı.', icon: '➕' },

    // 🟣 Taktik
    { key: 'distraction', tier: 'D', name: '🌀 Dikkat Dağıtma', description: 'Rakip takım bu tur fısıldasın (psikolojik).', icon: '🌀' },
    { key: 'word-lock', tier: 'D', name: '🔒 Kelime Kilidi', description: 'Seçtiğin kelimeyi rakip bu tur seçemez.', icon: '🔒' },
    { key: 'shadow', tier: 'D', name: '🌘 Gölge', description: 'Seçtiğin kelime tur sonuna kadar gizlenir.', icon: '🌘' },

    // 🕶️ New
    { key: 'blind', tier: 'A', name: '🕶️ Kör Etki', description: 'Rakibi 1 tur kör eder: kartların yazıları görünmez.', icon: '🕶️' },

    // 🌫️ Sis
    { key: 'sis', tier: 'A', name: '🌫️ Sis', description: 'Rakibi 1 tur sisler: kartların yazıları blurlu görünür.', icon: '🌫️' },

    // 🔥 Risk
    { key: 'risk-insurance', tier: 'A', name: '🛡️ Risk Sigortası', description: 'Bu tur ilk yanlış tahmin turu bitirmez (Assassin hariç).', icon: '🛡️' },
    { key: 'all-or-nothing', tier: 'A', name: '🔥 Hepsi Ya Da Hiç', description: 'Bu tur yanlış olursa tur anında biter; hepsi doğruysa +1 kart açılır.', icon: '🔥' },
    { key: 'fate-game', tier: 'A', name: '🎲 Kader Oyunu', description: 'Assassin çıkmazsa +2 kart açılır; çıkarsa anında kayıp.', icon: '🎲' },

    // 🔁 UNO Reverse
    { key: 'uno-reverse', tier: 'A', name: '🔁 UNO Reverse', description: 'Rakibin ipucu turunda (ipucu verilmeden önce) sırayı çalar: sıra sana geçer.', icon: '🔁' },

    // 👑 Legendary
    { key: 'mind-reading', tier: 'S', name: '👑 Zihin Okuma', description: 'Rakip ipucu verdikten sonra seçtiğin 1 kelimenin rengini öğren.', icon: '👑' },
    { key: 'time-rewind', tier: 'S', name: '👑 Zaman Geri Sar', description: 'Son açılan kelimeyi kapatır (Assassin hariç).', icon: '👑' }
];

function powerCardTierToClass(tier) {
    const t = String(tier || '').toUpperCase();
    if (t === 'S' || t === 'A') return 'power-card-strong';
    if (t === 'B') return 'power-card-medium';
    return 'power-card-small';
}

function populatePowerCards() {
    const cardList = document.getElementById('power-card-list');
    if (!cardList) return;

    const cards = Array.isArray(myPowerCards) ? myPowerCards : [];
    cardList.innerHTML = '';

    if (cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'power-card-item used';
        empty.innerHTML = `
            <div class="power-card-header">
                <span class="power-card-icon">⚡</span>
                <span class="power-card-name">Güç kartın yok</span>
            </div>
            <div class="power-card-desc">Kullanılabilir bir kartın bulunmuyor.</div>
        `;
        cardList.appendChild(empty);
        return;
    }

    cards.forEach((key) => {
        const card = POWER_CARD_CATALOG.find(c => c.key === key) || { key, tier: '?', name: key, description: '', icon: '⚡' };
        const cardDiv = document.createElement('div');
        cardDiv.className = `power-card-item ${powerCardTierToClass(card.tier)}`;
        cardDiv.innerHTML = `
            <div class="power-card-header">
                <span class="power-card-icon">${card.icon}</span>
                <span class="power-card-name">${card.name}</span>
            </div>
            <div class="power-card-desc">${card.description}</div>
            <div class="power-card-rarity">Tier: ${escapeHtml(String(card.tier || '?'))}</div>
            <button class="btn btn-small" onclick="usePowerCard('${card.key}')">Kullan</button>
        `;
        cardList.appendChild(cardDiv);
    });
}

function closePowerCardMenu() {
    const menu = document.getElementById('power-card-menu');
    if (menu) {
        menu.classList.add('hidden');
    }
}

function usePowerCard(cardKey) {
    if (!currentPlayer || !currentRoom) return;
    if (!currentPlayer.team) {
        showNotification('Önce bir takım seçmelisin', 'warning');
        return;
    }

    if (!cardKey || typeof cardKey !== 'string') {
        showNotification('Geçersiz güç kartı', 'error');
        return;
    }

    const isMindReading = cardKey === 'mind-reading';
    const isUnoReverse = cardKey === 'uno-reverse';
    const currentTurnTeam = currentRoom.currentTurn?.team;
    if (currentTurnTeam) {
        if (!isMindReading && !isUnoReverse && currentPlayer.team !== currentTurnTeam) {
            showNotification('Güç kartını sadece kendi sıranızda kullanabilirsiniz!', 'warning');
            return;
        }
        if (isMindReading && currentPlayer.team === currentTurnTeam) {
            showNotification('Zihin Okuma rakip sırada kullanılır!', 'warning');
            return;
        }
        if (isUnoReverse) {
            if (currentPlayer.team === currentTurnTeam) {
                showNotification('UNO Reverse rakip sırada kullanılır!', 'warning');
                return;
            }
            if (currentRoom.currentTurn?.phase !== 'HINT') {
                showNotification('UNO Reverse sadece rakibin ipucu turunda kullanılabilir!', 'warning');
                return;
            }
            if (currentRoom.clue) {
                showNotification('UNO Reverse: ipucu verildikten sonra kullanılamaz!', 'warning');
                return;
            }
        }
    }

    const payload = { cardKey: cardKey };

    // Cards that need extra input
    if (cardKey === 'number-bend') {
        const v = prompt('Sayı Bükümü: +1 için 1 yaz, -1 için -1 yaz', '1');
        const delta = (v === '-1') ? -1 : 1;
        payload.delta = delta;
    }

    const needsTarget = ['intuition', 'word-lock', 'shadow', 'mind-reading'].includes(cardKey);
    if (needsTarget) {
        if (!Number.isInteger(selectedCardIndex)) {
            showNotification('Önce board’dan bir kelime seç (sadece seç, açma).', 'warning');
            return;
        }
        payload.cardIndex = selectedCardIndex;
    }

    socket.emit('use-power-card', payload);
    closePowerCardMenu();
}

socket.on('power-card-private', (data) => {
    const kind = data?.kind;
    if (kind === 'intuition') {
        const idx = Number.isInteger(data.cardIndex) ? data.cardIndex : null;
        const isFriendly = !!data.isFriendly;
        if (idx === null) return;
        const txt = isFriendly ? 'EVET ✅ (takım kartı)' : 'HAYIR ❌ (takım kartı değil)';
        appendGameSystemLine(`🟢 Sezgi: #${idx + 1} → ${txt}`, isFriendly ? 'success' : 'warning');
        return;
    }
    if (kind === 'mind-reading') {
        const idx = Number.isInteger(data.cardIndex) ? data.cardIndex : null;
        const type = typeof data.cardType === 'string' ? data.cardType : '';
        if (idx === null || !type) return;
        const typeText = type === 'RED' ? '🔴 KIRMIZI' : type === 'BLUE' ? '🔵 MAVİ' : type === 'NEUTRAL' ? '⚪ NÖTR' : '💀 ASSASSIN';
        appendGameSystemLine(`👑 Zihin Okuma: #${idx + 1} → ${typeText}`, 'success');
    }
});

socket.on('game-state-sync', (data) => {
    const gs = data?.gameState;
    if (!gs || !gs.board) return;

    currentBoard = gs.board;
    if (currentRoom) {
        currentRoom.board = gs.board;
        currentRoom.currentTurn = gs.currentTurn;
        currentRoom.clue = gs.currentClue || null;
        currentRoom.powerEffects = gs.powerEffects || null;
        currentRoom.turnNumber = gs.turnNumber ?? currentRoom.turnNumber ?? 0;
        currentRoom.bombLocks = gs.bombLocks || currentRoom.bombLocks || {};
    }

    renderBoard(currentBoard);
    updateScores(currentBoard);
    updateTurnInfo(gs.currentTurn);
    showPlayerPanels();
    renderClueInfo(gs.currentClue, gs.currentTurn?.team);

    // Show/hide draft overlay if server toggled draft state.
    renderDraftUI();
});

socket.on('bomb-triggered', (payload) => {
    const targetIndex = Number.isInteger(payload?.targetIndex) ? payload.targetIndex : null;
    if (targetIndex === null) return;

    // If the locked card is currently selected for confirmation, clear it.
    if (selectedCardIndex === targetIndex) {
        clearMySelectionUI();
    }

    animateBombToCard(payload?.from, targetIndex);

    // Re-render board shortly after so the lock styling/click gating updates.
    window.setTimeout(() => {
        if (currentBoard) renderBoard(currentBoard);
    }, 120);
});

let lockedWordState = { RED: [], BLUE: [] };
let shadowedCardIndex = null;

socket.on('word-locked', (data) => {
    const targetTeam = data?.targetTeam;
    const idx = Number.isInteger(data?.cardIndex) ? data.cardIndex : null;
    if ((targetTeam !== 'RED' && targetTeam !== 'BLUE') || idx === null) return;
    if (!Array.isArray(lockedWordState[targetTeam])) lockedWordState[targetTeam] = [];
    if (!lockedWordState[targetTeam].includes(idx)) lockedWordState[targetTeam].push(idx);

    // Re-render so click gating updates
    if (currentBoard) renderBoard(currentBoard);
});

socket.on('shadow-card', (data) => {
    const idx = (data && (Number.isInteger(data.cardIndex) ? data.cardIndex : null));
    const hidden = !!data?.hidden;
    shadowedCardIndex = hidden ? idx : null;
    if (currentBoard) renderBoard(currentBoard);
});

socket.on('power-card-peek', (data) => {
    const idx = data && Number.isInteger(data.cardIndex) ? data.cardIndex : null;
    const type = data && typeof data.cardType === 'string' ? data.cardType : null;
    if (idx === null || !type) return;

    const typeText = type === 'RED' ? '🔴 KIRMIZI' : type === 'BLUE' ? '🔵 MAVİ' : type === 'NEUTRAL' ? '⚪ NÖTR' : '💀 ASSASSIN';
    appendGameSystemLine(`👁️ Peek: #${idx + 1} kartı ${typeText}`, 'success');
});

socket.on('power-card-error', (msg) => {
    showNotification(String(msg || 'Güç kartı hatası'), 'error');
});

socket.on('power-cards', (data) => {
    myPowerCards = Array.isArray(data?.cards) ? data.cards : [];
    const menu = document.getElementById('power-card-menu');
    if (menu && !menu.classList.contains('hidden')) {
        populatePowerCards();
    }
});

// Chat functions
function sendGameMessage() {
    const input = document.getElementById('game-chat-input');
    if (!input) return;
    const message = input.value.trim();

    if (!message) return;

    // If room was closed on server but UI hasn't reset yet
    if (!currentPlayer || !currentRoom) {
        alert('Oda bağlantısı yok. Lobiye dönüp tekrar odaya gir.');
        return;
    }

    // Handle debug commands
    if (message.startsWith('/randomevent ')) {
        const eventType = message.substring(13).trim().toLowerCase();
        if (eventType === 'lightning' || eventType === 'storm') {
            socket.emit('debug-random-event', { eventType });
            input.value = '';
            return;
        }
    }

    // Slash-command FX (broadcast to everyone)
    const msgLower = message.toLowerCase();
    const fxMap = {
        '/yagmur': 'rain',
        '/zeus': 'lightning',
        '/water': 'water',
        '/fire': 'fire',
        '/snow': 'snow',
        '/quake': 'quake'
    };
    if (fxMap[msgLower]) {
        socket.emit('trigger-fx', { type: fxMap[msgLower] });
        soundManager.emojiClick();
        input.value = '';
        return;
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

    soundManager.messageSend();

    input.value = '';
    input.placeholder = isTeamMessage
        ? 'Takım mesajı (/p takım mesajı için)'
        : 'Mesaj yazın (/p takım mesajı için)';
}

// DenemeChat (popup chat - removable experimental feature)
let denemeChatTargetId = null;
let denemeChatTargetName = null;

function normalizePlayersList(room) {
    if (!room) return [];
    return Array.isArray(room.players) ? room.players : Object.values(room.players || {});
}

function refreshDenemeChatRecipients(room) {
    const container = document.getElementById('denemechat-recipients');
    if (!container) return;

    const r = room || currentRoom;
    const playersList = normalizePlayersList(r);

    const meId = currentPlayer?.id;
    const candidates = playersList
        .filter(p => p && p.id && p.username)
        .filter(p => !p.isBot)
        .filter(p => !meId || p.id !== meId);

    container.innerHTML = '';

    if (candidates.length === 0) {
        const empty = document.createElement('div');
        empty.style.opacity = '0.8';
        empty.style.fontSize = '12px';
        empty.textContent = 'Özel mesaj için oyuncu yok';
        container.appendChild(empty);
        denemeChatTargetId = null;
        denemeChatTargetName = null;
        return;
    }

    // If current target left, clear selection
    if (denemeChatTargetId && !candidates.some(p => p.id === denemeChatTargetId)) {
        denemeChatTargetId = null;
        denemeChatTargetName = null;
    }

    candidates.forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'denemechat-recipient' + (p.id === denemeChatTargetId ? ' active' : '');
        btn.textContent = p.username;
        btn.onclick = () => {
            denemeChatTargetId = p.id;
            denemeChatTargetName = p.username;

            Array.from(container.querySelectorAll('.denemechat-recipient')).forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            const input = document.getElementById('denemechat-input');
            if (input) {
                input.placeholder = `@${p.username} (özel mesaj)`;
                input.focus();
            }
        };
        container.appendChild(btn);
    });

    // Default-select first recipient for convenience
    if (!denemeChatTargetId && candidates[0]) {
        denemeChatTargetId = candidates[0].id;
        denemeChatTargetName = candidates[0].username;
        const firstBtn = container.querySelector('.denemechat-recipient');
        if (firstBtn) firstBtn.classList.add('active');
        const input = document.getElementById('denemechat-input');
        if (input) input.placeholder = `@${denemeChatTargetName} (özel mesaj)`;
    }
}

function toggleDenemeChat(forceOpen) {
    const panel = document.getElementById('denemechat');
    if (!panel) return;

    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : panel.classList.contains('hidden');

    panel.classList.toggle('hidden', !shouldOpen);
    panel.setAttribute('aria-hidden', String(!shouldOpen));

    if (shouldOpen) {
        const input = document.getElementById('denemechat-input');
        if (input) input.focus();

        // Refresh recipient list when opening
        refreshDenemeChatRecipients(currentRoom);
    }
}

function sendDenemeChatMessage() {
    const input = document.getElementById('denemechat-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    if (!currentPlayer || !currentRoom) {
        alert('Oda bağlantısı yok. Lobiye dönüp tekrar odaya gir.');
        return;
    }

    if (!denemeChatTargetId) {
        showNotification('Önce bir oyuncu seç (DenemeChat üstünden)', 'warning');
        return;
    }

    const actualMessage = message;
    if (!actualMessage) return;

    socket.emit('private-message', {
        toPlayerId: denemeChatTargetId,
        message: actualMessage
    });

    soundManager.messageSend();
    input.value = '';
}

function resetClientRoomState() {
    currentBoard = null;
    myPowerCards = [];
    window.__gameFinishedShown = false;
    window.__boardAnimatedIn = false;

    if (currentRoom) {
        currentRoom = null;
    }
    if (currentPlayer) {
        currentPlayer.team = null;
        currentPlayer.role = null;
    }

    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) gameOverElement.classList.add('hidden');
    const gamePhaseElement = document.getElementById('game-phase');
    if (gamePhaseElement) gamePhaseElement.classList.add('hidden');
    const teamSelectionPhase = document.getElementById('team-selection-phase');
    if (teamSelectionPhase) teamSelectionPhase.classList.add('hidden');
}

function returnToLobby() {
    try {
        socket.emit('leave-room');
    } catch (_) {
        // ignore
    }
    resetClientRoomState();
    showScreen('lobby-screen');
    refreshRooms();
}

// index.html uses restartGame() but older code used newGame()
function restartGame() {
    // New round: go back to team selection in the same room.
    backToTeamSelection();
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    
    picker.classList.toggle('hidden');
}



function toggleChat() {
    const chatSection = document.querySelector('.game-chat-section');
    const chatContent = document.querySelector('.game-chat-section .chat-header + *');
    const toggleBtn = document.getElementById('chat-toggle-btn');
    
    if (!chatSection || !chatContent || !toggleBtn) return;
    
    const isHidden = chatContent.style.display === 'none';
    
    if (isHidden) {
        // Show chat
        chatContent.style.display = '';
        const allChatElements = chatSection.querySelectorAll('.game-chat-messages, .game-chat-input, .emoji-picker');
        allChatElements.forEach(el => {
            if (el) el.style.display = '';
        });
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Chat\'i Gizle';
        chatSection.style.minHeight = '';
    } else {
        // Hide chat
        chatContent.style.display = 'none';
        const allChatElements = chatSection.querySelectorAll('.game-chat-messages, .game-chat-input, .emoji-picker');
        allChatElements.forEach(el => {
            if (el) el.style.display = 'none';
        });
        toggleBtn.innerHTML = '💬';
        toggleBtn.title = 'Chat\'i Göster';
        chatSection.style.minHeight = '60px';
    }
}

function toggleGifPanel() {
    const panel = document.getElementById('gif-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    panel.setAttribute('aria-hidden', panel.classList.contains('hidden') ? 'true' : 'false');
    if (!panel.classList.contains('hidden')) {
        const input = document.getElementById('gif-search-input');
        if (input) input.focus();
    }
}

function closeGifPanel() {
    const panel = document.getElementById('gif-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
}

function isSafeGifUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        const host = u.hostname.toLowerCase();
        return host === 'media.tenor.com' || host.endsWith('.tenor.com');
    } catch (_) {
        return false;
    }
}

async function searchTenorGifs() {
    const input = document.getElementById('gif-search-input');
    const resultsEl = document.getElementById('gif-results');
    if (!input || !resultsEl) return;
    const q = input.value.trim();
    if (!q) return;

    resultsEl.innerHTML = '<div style="grid-column:1/-1; opacity:.75; font-size:12px;">Aranıyor...</div>';
    try {
        const res = await fetch(`/api/tenor/search?q=${encodeURIComponent(q)}&limit=16`);
        const data = await res.json();
        if (!res.ok) {
            const msg = data?.error || 'GIF araması başarısız.';
            resultsEl.innerHTML = `<div style="grid-column:1/-1; opacity:.75; font-size:12px;">${escapeHtml(msg)}</div>`;
            return;
        }

        const gifs = Array.isArray(data?.results) ? data.results : [];
        if (!gifs.length) {
            resultsEl.innerHTML = '<div style="grid-column:1/-1; opacity:.75; font-size:12px;">Sonuç yok.</div>';
            return;
        }

        resultsEl.innerHTML = '';
        gifs.forEach(item => {
            const url = item?.url;
            const preview = item?.preview;
            if (!url || !preview) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = 'GIF gönder';
            btn.addEventListener('click', () => sendGifMessage(url));

            const img = document.createElement('img');
            img.loading = 'lazy';
            img.src = preview;
            img.alt = 'gif';
            btn.appendChild(img);
            resultsEl.appendChild(btn);
        });
    } catch (e) {
        resultsEl.innerHTML = '<div style="grid-column:1/-1; opacity:.75; font-size:12px;">Bağlantı hatası.</div>';
    }
}

function sendGifMessage(url) {
    if (!socket || !currentRoom) return;
    if (!isSafeGifUrl(url)) {
        appendGameSystemLine('GIF URL güvenli değil.', 'warning');
        return;
    }

    const input = document.getElementById('game-chat-input');
    const raw = (input?.value || '').trim();
    const isTeamMessage = raw.startsWith('/p ');

    socket.emit('send-message', {
        gifUrl: url,
        isTeamMessage
    });
    closeGifPanel();
}

// index.html uses insertEmoji(...) from the emoji picker under the in-game chat
function insertEmoji(emoji) {
    if (typeof emoji !== 'string' || !emoji) return;
    soundManager.emojiClick();

    const input = document.getElementById('game-chat-input') || document.getElementById('chat-input');
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);

    input.value = before + emoji + after;
    const nextPos = start + emoji.length;
    try {
        input.setSelectionRange(nextPos, nextPos);
    } catch (_) {
        // ignore
    }
    input.focus();

    const picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.add('hidden');
}

// Reaction bar (quick emojis)
function toggleReactionBar() {
    const buttons = document.getElementById('reaction-buttons');
    if (!buttons) return;

    buttons.classList.toggle('hidden');

    const toggleBtn = document.querySelector('.reaction-toggle');
    if (toggleBtn) toggleBtn.classList.toggle('active', !buttons.classList.contains('hidden'));
}

function closeReactionBar() {
    const buttons = document.getElementById('reaction-buttons');
    if (buttons) buttons.classList.add('hidden');
    const toggleBtn = document.querySelector('.reaction-toggle');
    if (toggleBtn) toggleBtn.classList.remove('active');
}

function spawnReactionPopup(emoji) {
    const container = document.getElementById('reaction-popups');
    if (!container) return;

    const popup = document.createElement('div');
    popup.className = 'reaction-popup';
    popup.textContent = emoji;

    // Random position on screen (keep within bounds)
    const padding = 24;
    const approxSize = 80;
    const maxX = Math.max(padding, window.innerWidth - padding - approxSize);
    const maxY = Math.max(padding, window.innerHeight - padding - approxSize);
    const x = padding + Math.random() * Math.max(1, maxX - padding);
    const y = padding + Math.random() * Math.max(1, maxY - padding);

    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    container.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 1900);
}

function sendReaction(emoji) {
    if (!socket) return;
    soundManager.emojiClick();
    socket.emit('send-reaction', { emoji });
    closeReactionBar();
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

    maybePlayChatReceiveSfx(data);

    const messageElement = document.createElement('div');
    const messageClass = (data.isTeamMessage && data.team) ? `team team-${data.team.toLowerCase()}` : 'general';
    const isMyMessage = currentPlayer && data.playerId === currentPlayer.id;
    messageElement.className = `game-chat-message ${messageClass} ${isMyMessage ? 'my-message' : ''}`;

    const timestamp = new Date(data.timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Create message with team indicator
    let teamIndicator = '';
    if (data.isTeamMessage && data.team) {
        teamIndicator = data.team === 'RED' ? '🔴' : '🔵';
    }

    const safePlayer = escapeHtml(data.player);
    const safeText = escapeHtml(data.message);

    messageElement.setAttribute('data-timestamp', data.timestamp);
    messageElement.innerHTML = `
        <div class="msg-top">
            <span class="player ${isMyMessage ? 'my-player' : ''}">${escapeHtml(teamIndicator)} ${safePlayer}${data.system ? '' : ':'}</span>
            <span class="timestamp">${escapeHtml(timestamp)}</span>
        </div>
        <div class="msg-body"></div>
    `;

    const body = messageElement.querySelector('.msg-body');
    if (body) {
        body.textContent = data.message || '';
    }

    messagesContainer.appendChild(messageElement);
    
    // Optimize scroll with requestAnimationFrame
    requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
});

// Private messages (DenemeChat)
socket.on('private-message', (data) => {
    const container = document.getElementById('denemechat-messages');
    if (!container) return;

    const from = data?.fromName || 'Biri';
    const to = data?.toName || 'Sen';
    const text = String(data?.message || '').trim();
    if (!text) return;

    const isMine = !!(currentPlayer && data?.fromId && currentPlayer.id === data.fromId);
    const timestamp = new Date(data?.timestamp || Date.now()).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const el = document.createElement('div');
    el.className = `denemechat-message ${isMine ? 'team' : 'general'}`;
    el.innerHTML = `
        <span class="player">${isMine ? `Sen → ${to}` : `${from} → Sen`}:</span>
        <span class="text">${escapeHtml(text)}</span>
        <span class="timestamp">${timestamp}</span>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
});

socket.on('reaction', (data) => {
    if (!data || typeof data.emoji !== 'string') return;
    spawnReactionPopup(data.emoji);
});

socket.on('horn', (data) => {
    soundManager.horn();
    const name = data && data.playerName ? data.playerName : 'Bir oyuncu';
    appendGameSystemLine(`📯 ${name} korna çaldı`, 'info');
});

socket.on('horn-denied', (data) => {
    const retryMs = typeof data?.retryMs === 'number' ? data.retryMs : 3000;
    setHornButtonDisabled(true, retryMs);
    const reason = data?.reason;
    if (reason === 'locked') {
        showNotification('Korna kısa süreliğine kilitlendi (1 dk).', 'warning');
    } else if (reason === 'cooldown') {
        showNotification('Korna bekleme süresi: 3 sn', 'warning');
    } else {
        showNotification('Korna şu an kullanılamıyor', 'warning');
    }
});

function playFx(type) {
    const overlay = document.getElementById('fx-overlay');
    if (!overlay) return;

    const layer = document.createElement('div');
    layer.className = 'fx-layer';
    if (type === 'rain') layer.classList.add('fx-rain');
    else if (type === 'lightning') layer.classList.add('fx-lightning');
    else if (type === 'water') layer.classList.add('fx-water');
    else if (type === 'fire') layer.classList.add('fx-fire');
    else if (type === 'snow') layer.classList.add('fx-snow');
    else if (type === 'quake') layer.classList.add('fx-quake');
    else return;

    overlay.appendChild(layer);

    if (soundManager && soundManager.enabled) {
        if (type === 'lightning') soundManager.lightningStrike();
        else if (type === 'rain') soundManager.fxRain?.();
        else if (type === 'water') soundManager.fxWater?.();
        else if (type === 'fire') soundManager.fxFire?.();
        else if (type === 'snow') soundManager.fxSnow?.();
        else if (type === 'quake') soundManager.fxQuake?.();
    }

    if (type === 'quake') {
        document.body.classList.add('fx-shake');
        setTimeout(() => {
            document.body.classList.remove('fx-shake');
        }, 1000);
    }

    const ttl = type === 'lightning' ? 950
        : type === 'water' ? 1150
            : type === 'quake' ? 1200
                : type === 'fire' ? 1700
                    : type === 'snow' ? 2200
                        : 1850;
    setTimeout(() => {
        try { layer.remove(); } catch (_) { /* ignore */ }
    }, ttl);
}

socket.on('fx', (data) => {
    const type = data && typeof data.type === 'string' ? data.type : '';
    playFx(type);
});

// Card clicked event
socket.on('card-clicked', (data) => {
    const cardIndex = data && (Number.isInteger(data.cardIndex) ? data.cardIndex : data.index);
    if (!Number.isInteger(cardIndex)) return;

    const playerId = data.playerId || '';
    const playerName = data.playerName || data.player || '';
    const team = data.team || currentRoom?.currentTurn?.team;

    // If same player clicks a different card, remove their old marker
    const prev = lastSelectionByPlayerId.get(playerId);
    if (Number.isInteger(prev) && prev !== cardIndex) {
        const prevEl = document.querySelector(`.card[data-index="${prev}"]`);
        if (prevEl) {
            const old = prevEl.querySelector('.player-initial');
            if (old && old.dataset.playerId === playerId) old.remove();
            const btn = prevEl.querySelector('.reveal-btn');
            if (btn && btn.dataset.playerId === playerId) btn.remove();
            prevEl.classList.remove('selected');
        }
    }
    lastSelectionByPlayerId.set(playerId, cardIndex);

    const isMine = currentPlayer && playerId && currentPlayer.id === playerId;
    applySelectionUI(cardIndex, team, playerId, playerName, isMine);
});

// Board updated
socket.on('board-updated', (data) => {
    currentBoard = data.board;
    renderBoard(currentBoard);
    updateScores(currentBoard);
});

// Power card used
socket.on('power-card-used', (data) => {
    const playerName = data && (data.playerName || data.player) ? (data.playerName || data.player) : 'Bir oyuncu';
    const cardKey = data && (data.cardKey || data.card) ? (data.cardKey || data.card) : '';
    const def = POWER_CARD_CATALOG.find(c => c.key === cardKey);
    const cardName = def ? def.name : (cardKey || 'Güç Kartı');

    const team = data && data.team ? data.team : null;
    const teamPrefix = team === 'RED' ? '🔴' : team === 'BLUE' ? '🔵' : '⚡';

    let extra = '';
    const effect = data && data.effect ? data.effect : null;
    if (effect && effect.type === 'skip-turn' && effect.targetTeam) {
        extra = effect.targetTeam === 'RED'
            ? ' (🔴 Kırmızı 1 tur susturuldu)'
            : effect.targetTeam === 'BLUE'
                ? ' (🔵 Mavi 1 tur susturuldu)'
                : '';
    }

    if (effect && effect.type === 'uno-reverse' && effect.fromTeam && effect.toTeam) {
        const fromIcon = effect.fromTeam === 'RED' ? '🔴' : effect.fromTeam === 'BLUE' ? '🔵' : '⚡';
        const toIcon = effect.toTeam === 'RED' ? '🔴' : effect.toTeam === 'BLUE' ? '🔵' : '⚡';
        extra = ` (UNO Reverse: ${fromIcon} sıra çalındı → ${toIcon} sıraya geçti)`;
    }

    const variant = cardKey === 'neutral-flip'
        ? 'warning'
        : (team === 'RED' ? 'red' : team === 'BLUE' ? 'blue' : 'success');
    appendGameSystemLine(`${teamPrefix} ${playerName} ${cardName} kullandı!${extra}`, variant);
});

// Game finished
socket.on('game-finished', (data) => {
    displayGameFinished(data);
});

socket.on('room-closed', (data) => {
    const reason = data && data.reason ? data.reason : 'unknown';
    showNotification('Oda kapatıldı. Lobiye yönlendiriliyorsun. (' + reason + ')', 'warning');
    returnToLobby();
});

// New game
function newGame() {
    socket.emit('restart-game');
    window.__gameFinishedShown = false;
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
        gameOverElement.classList.add('hidden');
    }
}

// Back to team selection
function backToTeamSelection() {
    // Ask server to return entire room to team selection if host.
    // Even if server rejects, local UI fallback still helps.
    try {
        socket.emit('return-to-teams');
    } catch (_) {
        // ignore
    }

    const gameOverElement = document.getElementById('game-over');
    const gamePhaseElement = document.getElementById('game-phase');
    const teamSelectionPhase = document.getElementById('team-selection-phase');

    if (gameOverElement) gameOverElement.classList.add('hidden');
    window.__gameFinishedShown = false;
    if (gamePhaseElement) gamePhaseElement.classList.add('hidden');
    if (teamSelectionPhase) teamSelectionPhase.classList.remove('hidden');

    currentBoard = null;
    if (currentRoom) {
        currentRoom.clue = null;
        currentRoom.gameState = 'waiting';
        currentRoom.currentTurn = null;
        currentRoom.gameStarted = false;
        currentRoom.gameOver = false;
        currentRoom.winner = null;
        currentRoom.board = null;
        currentRoom.bombLocks = null;
        currentRoom.powerCardsEnabled = true; // Reset to default
    }
}

socket.on('returned-to-teams', (room) => {
    currentRoom = room;
    syncCurrentPlayerFromRoom(room);
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) gameOverElement.classList.add('hidden');
    window.__gameFinishedShown = false;
    const gamePhaseElement = document.getElementById('game-phase');
    const teamSelectionPhase = document.getElementById('team-selection-phase');
    if (gamePhaseElement) gamePhaseElement.classList.add('hidden');
    if (teamSelectionPhase) teamSelectionPhase.classList.remove('hidden');
});

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
                    usePowerCardFromModal(card, index, playerTeam);
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

// Use power card (legacy modal)
function usePowerCardFromModal(card, index, teamColor) {
    if (!socket || !currentRoom) return;

    if (!currentPlayer || !currentPlayer.team) {
        alert('Önce bir takım seçmelisin');
        return;
    }

    // Check if it's current team's turn
    const currentTurnTeam = currentRoom.currentTurn?.team;
    if (currentTurnTeam && currentPlayer.team !== currentTurnTeam) {
        alert('Güç kartını sadece kendi sıranızda kullanabilirsiniz!');
        return;
    }

    const key = (card && typeof card.key === 'string' && card.key.trim())
        ? card.key
        : (card && typeof card.id === 'string' && card.id.trim())
            ? card.id
            : '';

    if (!key) {
        showNotification('Geçersiz güç kartı', 'error');
        return;
    }

    // Send card key/id to server
    socket.emit('use-power-card', { cardKey: key });

    // Close modal
    togglePowerCardsModal();

    console.log(`${card?.name || card?.id || 'Güç kartı'} kullanılıyor...`);

    // Listen for success/error
    socket.once('power-card-error', (error) => {
        showNotification('Güç kartı hatası: ' + error, 'error');
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

// Toggle power save mode
function togglePowerSaveMode() {
    document.body.classList.toggle('power-save');
    const isPowerSave = document.body.classList.contains('power-save');
    localStorage.setItem('powerSaveMode', isPowerSave ? 'true' : 'false');

    const btn = document.getElementById('power-save-toggle');
    if (btn) {
        btn.classList.toggle('power-save-enabled', isPowerSave);
    }
}

// Toggle animation mode
function toggleAnimationMode() {
    document.body.classList.toggle('animations-disabled');
    const isAnimationsDisabled = document.body.classList.contains('animations-disabled');
    localStorage.setItem('animationsDisabled', isAnimationsDisabled ? 'true' : 'false');

    // Update slider
    const slider = document.getElementById('animation-slider');
    if (slider) {
        slider.checked = !isAnimationsDisabled;
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

    // If user turns sound back on after page load, try to unlock/resume again.
    if (soundManager.enabled) {
        soundManager.unlock();
    }
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
    // Default: animations disabled
    document.body.classList.add('animations-disabled');

    // Load dark mode preference (default to true for automatic dark mode)
    const savedDarkMode = localStorage.getItem('darkMode');
    const isDarkMode = savedDarkMode !== null ? savedDarkMode === 'true' : true; // Default to true
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('dark-mode-toggle');
        if (btn) btn.classList.add('dark-enabled');
    }
    // Save the default if not set
    if (savedDarkMode === null) {
        localStorage.setItem('darkMode', 'true');
    }

    // Load power save mode preference (default to true for better performance)
    const savedPowerSave = localStorage.getItem('powerSaveMode');
    const isPowerSave = savedPowerSave !== null ? savedPowerSave === 'true' : true; // Default to true
    if (isPowerSave) {
        document.body.classList.add('power-save');
        const btn = document.getElementById('power-save-toggle');
        if (btn) btn.classList.add('power-save-enabled');
    }
    // Save the default if not set
    if (savedPowerSave === null) {
        localStorage.setItem('powerSaveMode', 'true');
    }

    // Load animation preference
    const savedAnimationsDisabled = localStorage.getItem('animationsDisabled');
    if (savedAnimationsDisabled === 'false') {
        document.body.classList.remove('animations-disabled');
        const slider = document.getElementById('animation-slider');
        if (slider) slider.checked = true;
    } else {
        // Default is disabled, so add the class and update button
        const slider = document.getElementById('animation-slider');
        if (slider) slider.checked = false;
    }

    // Load background color preference
    const savedBackgroundColor = localStorage.getItem('backgroundColor');
    if (savedBackgroundColor) {
        applyBackgroundColor(savedBackgroundColor);
        const colorInput = document.getElementById('background-color');
        if (colorInput) colorInput.value = savedBackgroundColor;
    }

    // Add realtime background color change for game
    const gameColorInput = document.getElementById('game-background-color');
    if (gameColorInput) {
        gameColorInput.addEventListener('input', (e) => {
            applyBackgroundColor(e.target.value);
            localStorage.setItem('backgroundColor', e.target.value);
        });
        // Set current color
        const currentColor = localStorage.getItem('backgroundColor') || '#1e3a5f';
        gameColorInput.value = currentColor;
    }

    // Load sound preference (support both keys)
    const savedSound = localStorage.getItem('soundEnabled');
    const savedAudioEnabled = localStorage.getItem('audioEnabled');
    if (savedSound === 'false' || savedAudioEnabled === 'false') {
        soundManager.enabled = false;
        const btn = document.getElementById('sound-toggle');
        if (btn) {
            btn.classList.add('muted');
            btn.style.opacity = '0.5';
        }
    }

    // Load volume preference (support both keys)
    const savedVol = localStorage.getItem('soundVolume');
    const savedAudioVol = localStorage.getItem('audioVolume');
    const vol = savedVol ?? savedAudioVol;
    if (vol != null) {
        soundManager.masterVolume = clamp01(vol, 0.6);
    }

    applyAudioPrefsToUI();

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

    const denemeChatInput = document.getElementById('denemechat-input');
    if (denemeChatInput) {
        denemeChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendDenemeChatMessage();
            }
        });
    }

    // Unlock audio on user interaction (required by browsers).
    // Don't use `{ once: true }` because sound might be disabled at first,
    // and we still want to be able to unlock later when user enables it.
    const unlock = async () => {
        if (!soundManager) return;
        const ok = await soundManager.resumeAudio();
        if (ok) {
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('keydown', unlock);
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('mousedown', unlock);
            document.removeEventListener('click', unlock);
        }
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('mousedown', unlock, { passive: true });
    document.addEventListener('click', unlock, { passive: true });

    // Lightweight UI click SFX (buttons feel like a game)
    document.body.addEventListener('click', (e) => {
        if (!soundManager || !soundManager.enabled) return;
        const btn = e.target.closest('button');
        if (!btn) return;
        // Don't double-play for card confirm (it already plays reveal later)
        if (btn.classList.contains('reveal-btn')) return;
        soundManager.buttonClick();
    }, { capture: true });
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

    soundManager.messageSend();

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
    const input = document.getElementById('game-chat-input') || document.getElementById('chat-input');
    if (!input) return;
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

    maybePlayChatReceiveSfx(data);

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
