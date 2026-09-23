/**
 * audio.js — 台語女聲 TTS 排隊系統 + Web Audio 音效合成
 * 
 * 核心功能：
 * 1. 使用 Web Speech API 播放 zh-TW 台語女聲
 * 2. 語音排隊避免重疊
 * 3. Web Audio API 合成可愛音效（無外部檔案）
 * 4. 鼓勵語音隨機池
 */

// ============================================
// TTS 系統
// ============================================

const TTS = {
    voices: [],
    preferredVoice: null,
    isSpeaking: false,
    queue: [],
    speechRate: 0.9,
    speechVolume: 1.0,

    /**
     * 初始化語音
     */
    init() {
        if (!('speechSynthesis' in window)) {
            console.warn('TTS not supported on this device');
            return;
        }

        this.voices = window.speechSynthesis.getVoices();
        
        // iOS 上 voices 是異步載入的
        window.speechSynthesis.onvoiceschanged = () => {
            this.voices = window.speechSynthesis.getVoices();
            this.findPreferredVoice();
        };

        this.findPreferredVoice();
    },

    /**
     * 尋找台灣女聲
     * 優先順序：
     * 1. Google 國語臺灣（女聲感較好）
     * 2. Microsoft Yaoyao（微軟女聲）
     * 3. Microsoft Hsin-Yun（微軟女聲）
     * 4. 任何 zh-TW 且包含 female/女 的語音
     * 5. 任何 zh-TW 語音
     */
    findPreferredVoice() {
        const zhTWVoices = this.voices.filter(v => 
            v.lang === 'zh-TW' || v.lang === 'zh_TW' || v.lang === 'zh-Hant-TW' || v.lang === 'zh-Hant_TW'
        );

        // 優先選女聲
        const femaleVoices = zhTWVoices.filter(v => {
            const name = v.name.toLowerCase();
            return name.includes('female') || name.includes('女') || 
                   name.includes('yaoyao') || name.includes('hsin') ||
                   name.includes('google 國語臺灣');
        });

        if (femaleVoices.length > 0) {
            this.preferredVoice = femaleVoices[0];
        } else if (zhTWVoices.length > 0) {
            this.preferredVoice = zhTWVoices[0];
        } else {
            // 退回 zh-CN 或預設
            const zhCNVoices = this.voices.filter(v => 
                v.lang === 'zh-CN' || v.lang === 'zh_CN'
            );
            this.preferredVoice = zhCNVoices[0] || null;
        }

        console.log('Selected voice:', this.preferredVoice?.name || 'default');
    },

    /**
     * 播放語音
     * @param {string} text - 要播放的文字
     * @param {boolean} interrupt - 是否中斷目前播放
     */
    speak(text, interrupt = false) {
        if (!('speechSynthesis' in window)) return;

        if (interrupt) {
            window.speechSynthesis.cancel();
            this.queue = [];
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = this.speechRate;
        utterance.volume = this.speechVolume;

        if (this.preferredVoice) {
            utterance.voice = this.preferredVoice;
        }

        utterance.onend = () => {
            this.isSpeaking = false;
            this.processQueue();
        };

        utterance.onerror = () => {
            this.isSpeaking = false;
            this.processQueue();
        };

        if (this.isSpeaking || window.speechSynthesis.speaking) {
            this.queue.push(utterance);
        } else {
            this.isSpeaking = true;
            window.speechSynthesis.speak(utterance);
        }

        // 看門狗：某些瀏覽器 onend 可能不觸發，逾時強制推進佇列避免卡死
        clearTimeout(this._watchdog);
        const estimate = Math.max(2500, text.length * 400);
        this._watchdog = setTimeout(() => {
            if (this.isSpeaking) {
                try { window.speechSynthesis.cancel(); } catch(e) {}
                this.isSpeaking = false;
                this.processQueue();
            }
        }, estimate + 2000);
    },

    /**
     * 處理語音排隊
     */
    processQueue() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next.onend = () => {
                this.isSpeaking = false;
                this.processQueue();
            };
            next.onerror = () => {
                this.isSpeaking = false;
                this.processQueue();
            };
            this.isSpeaking = true;
            window.speechSynthesis.speak(next);

            // 看門狗：同 speak()，避免 onend 未觸發時卡佇列
            clearTimeout(this._watchdog);
            const est = Math.max(2500, (next.text || '').length * 400);
            this._watchdog = setTimeout(() => {
                if (this.isSpeaking) {
                    try { window.speechSynthesis.cancel(); } catch(e) {}
                    this.isSpeaking = false;
                    this.processQueue();
                }
            }, est + 2000);
        }
    },

    /**
     * 清除所有語音
     */
    cancel() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            this.queue = [];
            this.isSpeaking = false;
        }
    },

    /**
     * 暫停語音
     */
    pause() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.pause();
        }
    },

    /**
     * 恢復語音
     */
    resume() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.resume();
        }
    }
};

// ============================================
// Web Audio 音效合成器
// ============================================

class SoundSynthesizer {
    constructor() {
        this.audioCtx = null;
        this.enabled = true;
    }

    init() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                this.enabled = false;
                return;
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * 播放「叮~」正確音效
     */
    playCorrect() {
        if (!this.enabled || !this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        // 清脆上滑音
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, this.audioCtx.currentTime + 0.1); // C6
        osc.frequency.exponentialRampToValueAtTime(1568, this.audioCtx.currentTime + 0.2); // E6

        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.4);
    }

    /**
     * 播放「唔~」錯誤音效（柔和不刺耳）
     */
    playWrong() {
        if (!this.enabled || !this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        // 低頻短音，不刺耳
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, this.audioCtx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.3);
    }

    /**
     * 播放慶祝琶音
     */
    playCelebration() {
        if (!this.enabled || !this.audioCtx) return;

        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, D5, E5, C6
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.1);

            gain.gain.setValueAtTime(0, this.audioCtx.currentTime + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.25, this.audioCtx.currentTime + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + i * 0.1 + 0.3);

            osc.start(this.audioCtx.currentTime + i * 0.1);
            osc.stop(this.audioCtx.currentTime + i * 0.1 + 0.3);
        });
    }

    /**
     * 播放時間到音效
     */
    playTimeUp() {
        if (!this.enabled || !this.audioCtx) return;

        const notes = [392, 349.23, 329.63]; // G4, F4, E4
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.3);

            gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime + i * 0.3);
            gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + i * 0.3 + 0.5);

            osc.start(this.audioCtx.currentTime + i * 0.3);
            osc.stop(this.audioCtx.currentTime + i * 0.3 + 0.5);
        });
    }
}

// ============================================
// 鼓勵語音池
// ============================================

const EncouragementPool = {
    correct: [
        '太棒了！你找到顏色啦！',
        '你好厲害！顏色找對了！',
        '真聰明！繼續加油！',
        '好厲害！你是顏色小達人！',
        '答對了！你超棒的！',
        '太棒了！顏色顏色，我喜歡！',
        '你真棒！繼續找顏色吧！',
        '好聰明！顏色找得又對又快！',
        '厲害！顏色小明星！',
        '太厲害了！你是顏色小博士！'
    ],
    
    wrong: [
        '再試試看，你可以的！',
        '嗯嗯，再找一次吧！',
        '沒關係，再找一次！',
        '加油！你可以找到的！',
        '顏色就在那里，再試試！'
    ],

    levelClear: [
        '這一關完成啦！你超棒的！',
        '太厲害了！我們繼續吧！',
        '好聰明！下一關來了！',
        '顏色小達人！繼續加油！'
    ],

    complete: [
        '你完成所有關卡啦！顏色小達人！',
        '太棒了！你是最棒的顏色小達人！',
        '恭喜你！顏色小冒險完成啦！'
    ],

    timeUp: [
        '時間到了！你今天很努力喔！',
        '我們下次再玩吧！晚安！',
        '顏色小冒險結束啦！下次見！'
    ],

    timeRemain: [
        '我們已經玩了五分鐘，還有十分鐘喔！',
        '已經玩了十分鐘，還有五分鐘喔！',
        '還有兩分鐘，再完成最後幾題吧！'
    ]
};

/**
 * 隨機從語音池中選一個
 */
function pickRandom(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================
// 統一語音播放函式（支援預錄檔與 Web Speech API）
// ============================================

/**
 * 統一語音播放函式
 * 優先使用預錄語音（穩定、離線），否則使用 Web Speech API
 * @param {string} text - 要播放的文字（TTS 用）
 * @param {boolean|object} opts - true 表示中斷；或 {interrupt, preKey} 指定預錄音檔
 */
function speak(text, opts = {}) {
    let interrupt = false;
    let preKey = null;
    if (typeof opts === 'boolean') {
        interrupt = opts;
    } else {
        interrupt = !!opts.interrupt;
        preKey = opts.preKey || null;
    }

    // 0. 中斷時先停止所有音源
    if (interrupt) {
        TTS.cancel();
        if (typeof PreAudio !== 'undefined' && PreAudio.enabled) {
            PreAudio.stop();
        }
    }
    
    // 1. 嘗試使用預錄語音檔（尚未被瀏覽器阻止時）
    if (typeof PreAudio !== 'undefined' && PreAudio.enabled && !PreAudio._blocked) {
        // 優先用呼叫者明確指定的 key（準確），否則靠文字推斷（備援）
        const key = preKey || findPreRecordedKey(text);
        if (key) {
            if (preKey || PreAudio.manifest[key]) {
                PreAudio._pendingText = text;
                const ok = PreAudio.play(key);
                if (ok) {
                    return; // 預錄語音已接受（播放或排隊）
                }
            }
            // manifest 缺檔 → 繼續往下用 TTS
        }
    }
    
    // 2. 備援：使用 Web Speech API
    TTS.speak(text, false);
}

/**
 * 根據文字內容查找對應的預錄語音 key
 */
function findPreRecordedKey(text) {
    // 顏色問題映射
    // ⚠️ 重要：必須按名稱長度「由長到短」匹配！
    // 否則「粉紅色」會被「紅色」先命中、「天藍色」會被「藍色」先命中
    const colorMap = {
        '粉紅色': 'question_pink',
        '天藍色': 'question_skyblue',
        '青綠色': 'question_teal',
        '淡紫色': 'question_lavender',
        '紅色': 'question_red',
        '黃色': 'question_yellow',
        '藍色': 'question_blue',
        '綠色': 'question_green',
        '橘色': 'question_orange',
        '紫色': 'question_purple',
        '棕色': 'question_brown',
        '灰色': 'question_gray'
    };
    
    // 依顏色名稱長度排序（長的優先），避免子字串誤匹配
    const sortedEntries = Object.entries(colorMap).sort((a, b) => b[0].length - a[0].length);
    
    for (const [color, key] of sortedEntries) {
        if (text.includes(color) && (text.includes('在哪里') || text.includes('點點') || text.includes('喜歡'))) {
            return key;
        }
    }
    
    // 歡迎訊息
    if (text.includes('歡迎')) return 'welcome';
    
    // 關卡開始
    if (text.includes('第一關')) return 'level1_start';
    if (text.includes('第二關')) return 'level2_start';
    if (text.includes('第三關')) return 'level3_start';
    
    // 時間相關（先於鼓勵檢查，避免「完成」等字誤匹配）
    if (text.includes('時間到了')) return 'time_up';
    if (text.includes('還有十分鐘') || text.includes('還有10分鐘')) return 'time_reminder_5';
    if (text.includes('還有五分鐘') || text.includes('還有5分鐘')) return 'time_reminder_10';
    if (text.includes('還有兩分鐘') || text.includes('還有2分鐘')) return 'time_warning_2';
    
    // 遊戲完成（先於關卡完成與鼓勵）
    if (text.includes('所有關卡') || text.includes('冒險完成')) return 'complete';
    
    // 關卡完成
    if (text.includes('完成')) return 'level_clear';
    
    // 答對鼓勵 - 檢查所有鼓勵池中的關鍵詞
    const correctKeywords = [
        '太棒了', '好厲害', '真聰明', '你好厲害', '繼續加油',
        '答對了', '你真棒', '好聰明', '厲害', '太厲害', '顏色小達人'
    ];
    if (correctKeywords.some(p => text.includes(p))) {
        return 'correct_' + (Math.floor(Math.random() * 5) + 1);
    }
    
    // 答錯引導 - 檢查所有引導池中的關鍵詞
    const wrongKeywords = [
        '再試試', '沒關係', '再找一次', '加油', '你可以'
    ];
    if (wrongKeywords.some(p => text.includes(p))) {
        return 'wrong_' + (Math.floor(Math.random() * 3) + 1);
    }
    
    return null;
}

// ============================================
// 顏色名稱與語音對照
// ============================================

const ColorSpeech = {
    red: '紅色',
    yellow: '黃色',
    blue: '藍色',
    green: '綠色',
    orange: '橘色',
    purple: '紫色',
    pink: '粉紅色',
    skyblue: '天藍色',
    brown: '棕色',
    gray: '灰色',
    teal: '青綠色',
    lavender: '淡紫色',
    cyan: '青色',
    white: '白色',
    black: '黑色'
};

const ColorEmoji = {
    red: '🔴',
    yellow: '🟡',
    blue: '🔵',
    green: '🟢',
    orange: '🟠',
    purple: '🟣',
    pink: '🌸',
    skyblue: '🩵',
    brown: '🟤',
    gray: '⚪',
    teal: '🩶',
    lavender: '💜',
    cyan: '🩶',
    white: '⚪',
    black: '⚫'
};

// ============================================
// 動物角色池
// ============================================

const AnimalPool = [
    { emoji: '🐶', name: '小狗' },
    { emoji: '🐰', name: '小兔' },
    { emoji: '🦁', name: '小獅' },
    { emoji: '🐼', name: '熊貓' },
    { emoji: '🐥', name: '小雞' },
    { emoji: '🦊', name: '狐狸' },
    { emoji: '🐱', name: '貓咪' },
    { emoji: '🐹', name: '倉鼠' },
    { emoji: '🦄', name: '独角兽' },
    { emoji: '🐸', name: '青蛙' },
    { emoji: '🐨', name: '考拉' },
    { emoji: '🐷', name: '小豬' },
    { emoji: '🐮', name: '小牛' },
    { emoji: '🐵', name: '猴子' },
    { emoji: '🦋', name: '蝴蝶' },
    { emoji: '🐢', name: '烏龜' },
    { emoji: '🐬', name: '海豚' },
    { emoji: '🦀', name: '螃蟹' },
    { emoji: '🐙', name: '烏賊' },
    { emoji: '🦕', name: '恐龍' }
];

// ============================================
// 預錄語音系統（離線模式）
// ============================================

/**
 * 使用預錄 MP3 檔案播放語音
 * 優點：無需依賴手機語音包，語音品質穩定、速度快
 */
class PreRecordedAudio {
    constructor() {
        this.enabled = false;
        this.audioCache = new Map();
        this.currentAudio = null;
        this.queue = [];
        this.isPlaying = false;
        this._blocked = false;     // 自動播放是否被瀏覽器阻止
        this._pendingText = null;  // 記錄原始文字供 TTS 備援
        this._hintElement = null;
    }

    /**
     * 檢查是否有預錄語音檔案
     */
    checkAvailability() {
        return fetch('audio/manifest.json')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    this.enabled = true;
                    this.manifest = data;
                    console.log('Pre-recorded audio available:', Object.keys(data).length, 'clips');
                }
                return this.enabled;
            })
            .catch(() => false);
    }

    /**
     * 播放預錄語音
     * @param {string} key - 語音檔案的 key（如 'red', 'correct_1'）
     */
    play(key) {
        if (!this.enabled || !this.manifest || !this.manifest[key]) {
            return false; // 讓呼叫者用 Web Speech API 備援
        }

        const audioUrl = this.manifest[key];
        
        if (!this.audioCache.has(key)) {
            const audio = new Audio(audioUrl);
            audio.preload = 'auto'; // 預載
            this.audioCache.set(key, audio);
        }

        if (this.isPlaying) {
            this.queue.push(key);
            return true;
        }

        const audio = this.audioCache.get(key);
        this.isPlaying = true;
        this.currentAudio = audio; // 記錄供 stop() 使用
        this._lastKey = key;
        
        // 嘗試播放，處理自動播放政策
        audio.currentTime = 0;
        audio.onended = () => {
            this.isPlaying = false;
            this.processQueue();
        };
        audio.onerror = () => {
            this.isPlaying = false;
        };
        audio.play().then(() => {
            console.log('Playing pre-recorded:', key);
        }).catch(e => {
            console.warn('Audio autoplay blocked:', e);
            // 自動播放被阻止：標記狀態、顯示提示、並用 TTS 備援播放原始文字
            this._blocked = true;
            this.isPlaying = false;
            this.queue = [];
            this._showHint();
            if (this._pendingText) {
                TTS.speak(this._pendingText);
            }
        });

        return true;
    }

    /**
     * 顯示可點擊的語音啟動提示
     */
    _showHint() {
        if (this._hintElement) return;
        
        const hint = document.createElement('div');
        hint.id = 'audioHint';
        hint.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); color: white; padding: 15px 25px;
            border-radius: 25px; font-size: 18px; z-index: 1000;
            font-weight: bold; text-align: center; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;
        hint.innerHTML = '👆 點擊這裡啟動語音！';
        
        hint.onclick = () => {
            hint.remove();
            this._hintElement = null;
            this._blocked = false; // 用戶互動後重置阻止狀態
            // 重新播放目前的問句（重複說明要找什麼顏色）
            if (typeof Game !== 'undefined' && Game.currentSpeechText) {
                speak(Game.currentSpeechText, { preKey: Game.currentPreKey || null });
            }
        };
        
        this._hintElement = hint;
        document.body.appendChild(hint);
        
        // 5秒後自動移除
        setTimeout(() => {
            if (hint.parentNode) {
                hint.remove();
                this._hintElement = null;
            }
        }, 5000);
    }

    /**
     * 處理語音排隊
     */
    processQueue() {
        if (this.queue.length > 0) {
            const nextKey = this.queue.shift();
            this.play(nextKey);
        }
    }

    /**
     * 停止目前播放
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        this.isPlaying = false;
        this.queue = [];
        this._blocked = false; // 使用者互動後重試預錄語音
    }
}

const PreAudio = new PreRecordedAudio();

// ============================================
// 語音偵測與提示
// ============================================

/**
 * 檢查中文語音可用性
 */
function checkChineseVoice() {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        
        const chineseVoices = voices.filter(v => 
            v.lang.includes('zh') || v.lang.includes('TW') || v.lang.includes('CN')
        );

        const twVoices = chineseVoices.filter(v => 
            v.lang.includes('TW') || v.lang.includes('Hant') || v.name.includes('國語臺灣')
        );

        resolve({
            hasAnyChinese: chineseVoices.length > 0,
            hasTW: twVoices.length > 0,
            voices: chineseVoices.map(v => ({ name: v.name, lang: v.lang }))
        });
    });
}

/**
 * 顯示語音設定提示
 */
function showVoiceSetupInstructions() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; border-radius: 20px; padding: 30px;
        max-width: 400px; text-align: center;
    `;
    
    content.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 20px;">🗣️</div>
        <h2 style="color: #5A4FCF; margin-bottom: 15px;">需要安裝中文語音</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            遊戲需要中文語音才能正常運作。<br>
            請先安裝中文語音包：
        </p>
        <div style="background: #f0f0f0; padding: 15px; border-radius: 10px; text-align: left; margin-bottom: 20px; font-size: 14px;">
            <strong>Android 手機：</strong><br>
            1. 設定 → 輔助使用 → 語言與輸入<br>
            2. 語音轉換 → 下載語音<br>
            3. 選擇「中文（繁體）」→ 下載<br><br>
            <strong>iPhone：</strong><br>
            1. 設定 → 輔助使用 → 語音輸出<br>
            2. 語音轉換 → 下載「中文（繁體）」
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
            style="background: #FF6B9D; color: white; border: none; padding: 15px 30px; 
                   border-radius: 25px; font-size: 18px; cursor: pointer; width: 100%;">
            我設定好了
        </button>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // 檢查預錄語音
    const hasPreRecorded = await PreAudio.checkAvailability();
    
    if (hasPreRecorded) {
        console.log('Using pre-recorded audio mode');
    } else {
        // 檢查 Web Speech API
        TTS.init();
        
        // 檢查中文語音可用性
        const voiceStatus = await checkChineseVoice();
        console.log('Voice status:', voiceStatus);
        
        if (!voiceStatus.hasAnyChinese && !hasPreRecorded) {
            console.warn('No Chinese voice available');
            // 顯示提示，但不妨礙遊戲繼續
            setTimeout(() => {
                showVoiceSetupInstructions();
            }, 500);
        }
    }
    
    console.log('Audio system initialized');
});

// 第一次使用者互動時啟動 AudioContext（由 game.js 中的 SFX 實例處理）
