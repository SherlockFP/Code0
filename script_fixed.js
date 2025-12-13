// AGENT0 Game
const socket = io();

// Create animated background particles on page load
function initBackgroundParticles() {
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'bg-particle';
        const size = Math.random() * 200 + 80;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        particle.style.animationDelay = (i * 1.5) + 's';
        particle.style.animationDuration = (6 + Math.random() * 4) + 's';
        document.body.appendChild(particle);
    }
}

document.addEventListener('DOMContentLoaded', initBackgroundParticles);

// Web Audio API for Sound Effects
let audioContext = null;
let audioEnabled = localStorage.getItem('audioEnabled') !== 'false';
let currentVolume = parseFloat(localStorage.getItem('audioVolume') || '0.6');

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Sound generation functions
function playTone(freq, duration, type = 'sine', attackTime = 0.01, releaseTime = 0.1) {
    if (!audioEnabled) return;
    
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = type;
        osc.frequency.value = freq;
        
        // Attack-Release envelope
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(currentVolume * 0.4, now + attackTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration - releaseTime);
        
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.warn('playTone error:', e);
    }
}

function playChord(frequencies, duration, attackTime = 0.05, releaseTime = 0.2) {
    if (!audioEnabled) return;
    
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;
        
        frequencies.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(currentVolume * 0.25, now + attackTime);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration - releaseTime);
            
            osc.start(now);
            osc.stop(now + duration);
        });
    } catch (e) {
        console.warn('playChord error:', e);
    }
}

function playNoise(duration, frequency = 3000) {
    if (!audioEnabled) return;
    
    try {
        const ctx = initAudioContext();
        const now = ctx.currentTime;
        
        // Buffer with noise
        const bufferSize = ctx.sampleRate * duration;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        
        noise.buffer = noiseBuffer;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        filter.type = 'highpass';
        filter.frequency.value = frequency;
        
        gain.gain.setValueAtTime(currentVolume * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        noise.start(now);
        noise.stop(now + duration);
    } catch (e) {
        console.warn('playNoise error:', e);
    }
}

// Ses efekt paketi
const soundEffects = {
    click: () => {
        playTone(800, 0.1, 'sine', 0.01, 0.05);
    },
    hover: () => {
        playTone(600, 0.08, 'sine', 0.01, 0.03);
    },
    cardFlip: () => {
        playTone(440, 0.15, 'triangle', 0.01, 0.08);
        setTimeout(() => playTone(660, 0.1, 'triangle', 0.01, 0.06), 75);
    },
    reveal: () => {
        playChord([523, 659, 784], 0.4, 0.05, 0.2); // C-E-G chord
    },
    correct: () => {
        // BaÅŸarÄ± sesi
        playTone(523, 0.15, 'sine', 0.02, 0.1); // C
        setTimeout(() => playTone(659, 0.15, 'sine', 0.02, 0.1), 150); // E
        setTimeout(() => playTone(784, 0.3, 'sine', 0.02, 0.15), 300); // G
    },
    wrong: () => {
        // Hata sesi (buzzer)
        playNoise(0.3, 200);
    },
    assassin: () => {
        // Dramatik hit sesi
        playTone(100, 0.3, 'sine', 0.01, 0.2);
        playNoise(0.2, 2000);
    },
    gameStart: () => {
        // Oyun baÅŸlama sesi
        playChord([392, 523, 659], 0.5, 0.05, 0.3); // G-C-E
    },
    powerCard: () => {
        // BÃ¼yÃ¼ sesi
        playTone(800, 0.1, 'sine', 0.01, 0.05);
        setTimeout(() => playTone(1200, 0.15, 'sine', 0.01, 0.08), 100);
        setTimeout(() => playTone(1600, 0.2, 'sine', 0.01, 0.1), 180);
    },
    lightning: () => {
        // Elektrik sesi
        playNoise(0.05, 4000);
        setTimeout(() => playNoise(0.08, 5000), 100);
        setTimeout(() => playTone(2000, 0.1, 'sine', 0.01, 0.05), 200);
    },
    notification: () => {
        // Bildirim sesi
        playTone(880, 0.12, 'sine', 0.01, 0.05);
        setTimeout(() => playTone(1100, 0.15, 'sine', 0.01, 0.08), 120);
    }
};

let audioEnabled_old = localStorage.getItem('audioEnabled') !== 'false';
let currentVolume_old = parseFloat(localStorage.getItem('audioVolume') || '0.6');


// Hover-select visual option (controls whether pointer proximity produces a strong visual select)
let hoverSelectEnabled = true;

function toggleHoverSelect() {
    hoverSelectEnabled = !hoverSelectEnabled;
    const btn = document.getElementById('hover-select-toggle');
    if (btn) {
        btn.classList.toggle('active', hoverSelectEnabled);
    }
}

function applyAudioPrefs() {
    // Initialize audio context
    if (audioEnabled) {
        initAudioContext();
    }
    
    const toggleBtn = document.getElementById('audio-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = audioEnabled ? 'ðŸ”Š' : 'ðŸ”‡';
    }
    const volumeInput = document.getElementById('audio-volume');
    if (volumeInput) {
        volumeInput.value = currentVolume;
    }
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    localStorage.setItem('audioEnabled', audioEnabled);
    applyAudioPrefs();
}

function setAudioVolume(value) {
    currentVolume = parseFloat(value);
    localStorage.setItem('audioVolume', currentVolume);
    applyAudioPrefs();
}

function startBackgroundMusic() {
    if (!audioEnabled) return;
    applyAudioPrefs();
    // Background music devre dÄ±ÅŸÄ± - Web Audio sesi daha sade
    return;
}

function playSfx(name) {
    if (!audioEnabled) return;
    if (soundEffects[name]) {
        try {
            soundEffects[name]();
        } catch (err) {
            console.warn('[audio] sfx play failed', name, err);
        }
    }
}

function playSound(name) {
    playSfx(name);
}

// Cursor Wave Effect
let waveRippleTimeout;
document.addEventListener('mousemove', (e) => {
    clearTimeout(waveRippleTimeout);
    
    waveRippleTimeout = setTimeout(() => {
        // Her 200ms de bir ripple oluÅŸtur
        const ripple = document.createElement('div');
        ripple.className = 'wave-ripple';
        ripple.style.left = e.clientX + 'px';
        ripple.style.top = e.clientY + 'px';
        document.body.appendChild(ripple);
        
        // Animasyon tamamlanÄ±nca kaldÄ±r
        setTimeout(() => ripple.remove(), 800);
    }, 200);
});

// Apply audio prefs on DOM ready so UI reflects current state
document.addEventListener('DOMContentLoaded', () => {
    try { applyAudioPrefs(); } catch (e) { console.warn('applyAudioPrefs failed', e); }
});

// Codenames Game - Word sets by category
const wordSets = {
    genel: [
        'ELMA', 'KAPI', 'GÃ–L', 'YILDIZ', 'KÄ°TAP',
        'MASA', 'KALE', 'AÄžAÃ‡', 'DENIZ', 'GÃœNEÅž',
        'AY', 'KÃ–PRÃœ', 'KUTU', 'KUPA', 'SAAT',
        'YÃœZÃœK', 'KEDI', 'KÃ–PEK', 'ARABA', 'UÃ‡AK',
        'BALIK', 'KUÅž', 'SU', 'ATEÅž', 'TOPRAK'
    ],
    hayvanlar: [
        'ASLAN', 'KAPLAN', 'AYACIK', 'KURT', 'FOX',
        'TAVÅžAN', 'SINCAP', 'KIRPI', 'GELINCIK', 'AY AYI',
        'PENGUEN', 'BAYKUÅž', 'KARTAL', 'ÅžAHIN', 'YEÅžILBAÅž',
        'PAPAÄžAN', 'Ã–SÃœ', 'KENGURULÄ±', 'DEVE', 'ZÃœRAFA',
        'FÄ°L', 'RHINOSEROS', 'SUAYGIRI', 'ZEBRA', 'ANTILOP',
        'Ã‡ITA', 'PUMASÄ±', 'BOA', 'KOBRA', 'TIMSAH',
        'KÃ–PEKBALIGI', 'WHALEFISH', 'CRAB', 'OCTOPUS', 'SQUID'
    ],
    Ã¼lkeler: [
        'TÃœRKIYE', 'FRANSA', 'Ä°TALYA', 'Ä°SPANYA', 'ALMANYA',
        'Ä°NGÄ°LTERE', 'RUSYA', 'Ã‡INA', 'JAPONYA', 'KORE',
        'HINDISTAN', 'BRAZÄ°LYA', 'ARJANTIN', 'KANADA', 'AVUSTRALYA',
        'MEKSIKA', 'EGÄ°PT', 'MISIR', 'SUUDI ARABISTAN', 'DUBAI',
        'TAYLAND', 'VÄ°ETNAM', 'FÄ°LÄ°PÄ°NLER', 'ENDONESYA', 'MÄ°SIR'
    ],
    yemekler: [
        'PIZZA', 'BURGER', 'PASTA', 'PILAV', 'KÃ–FTELÄ°',
        'DÃ–NER', 'KEBAP', 'TATLISI', 'BAKLAVA', 'HELVASÄ±',
        'PASTA', 'KEKE', 'TART', 'DONUT', 'KRUVASAN',
        'EKMEK', 'SIMIT', 'SAÃ‡', 'LAVAÅžÄ±', 'MANTI',
        'Ã‡ORBA', 'MERCIMEK', 'Ä°SKEMBE', 'ÅžEHRIYE', 'TARHANA'
    ],
    spor: [
        'FUTBOL', 'BASKETBOL', 'VOLEYBOL', 'TENÄ°S', 'BADMINTON',
        'YÃœZME', 'DALGIÃ‡', 'KOÅžU', 'ATLETÄ°ZM', 'GÃœREÅž',
        'BOKS', 'JÄ°DO', 'KARATE', 'GYMNASTÄ°K', 'AKROBAT',
        'DÃ–NEREYEKLEME', 'HANDBALLÄ±', 'SOFTBOL', 'HOKEY', 'GOLF'
    ],
    teknoloji: [
        'TELEFON', 'BÄ°LGÄ°SAYAR', 'LAPTOP', 'TABLET', 'SMARTWATCH',
        'DRONE', 'ROBOT', 'REZÄ°L', 'INTERNET', 'WÄ°FÄ°',
        'KABLOSUZ', 'SENSOR', 'KAMERA', 'MÄ°KROFON', 'HOPARLÃ–R',
        'ÅžARJ', 'BATARYA', 'GÃœNEÅž PANELÄ°', 'TURBIN', 'PANEL'
    ],
    renk: [
        'KIRMIZI', 'MAVI', 'YEÅžÄ°L', 'SARI', 'SÄ°YAH',
        'BEYAZ', 'PEMBE', 'MOR', 'TURUNCU', 'GÃœMÃœÅž',
        'ALTIN', 'BAKIR', 'BRONZ', 'YEÅžIL TÃœRÃ¼', 'AÃ‡IK MAVÄ°',
        'LACIVERT', 'AÃ‡IK YEÅžIL', 'ZEYTIN', 'KOYUN PEMBESI', 'AÃ‡IK GRÄ°'
    ]
};

// Default word set
let currentWordSet = 'genel';
let words = wordSets[currentWordSet];
