/**
 * game.js — 顏色小冒險遊戲邏輯
 * 
 * 功能：
 * 1. 三關狀態機（找顏色/配對顏色/顏色小球）
 * 2. 題目生成（隨機顏色與位置）
 * 3. 15 分鐘遊玩上限計時
 * 4. 觸控互動與慶祝動畫
 * 5. 暫停/恢復（頁面隱藏時）
 */

// ============================================
// 音效單例
// ============================================

const SFX = new SoundSynthesizer();

// ============================================
// 遊戲狀態
// ============================================

const GameState = {
    start: 'start',
    playing: 'playing',
    levelClear: 'levelClear',
    complete: 'complete',
    timeUp: 'timeUp'
};

const GameLevels = {
    level1: 'level1',
    level2: 'level2',
    level3: 'level3'
};

const Game = {
    // 狀態
    state: GameState.start,
    currentLevel: 1,
    currentQuestion: 0,
    questionsPerLevel: 10,
    
    // 計時器
    totalSeconds: 900, // 15 分鐘
    remainingSeconds: 900,
    timerInterval: null,
    lastReminder: 0, // 上次提醒的時間點
    
    // 遊戲數據
    colors: ['red', 'yellow', 'blue', 'green', 'orange', 'purple', 'pink', 'skyblue', 'brown', 'gray', 'teal', 'lavender'],
    correctColor: null,
    correctIndex: 0,
    isLocked: false, // 防止連點
    
    // 當前問句（用於重播）
    currentSpeechText: '',
    
    // 元素引用
    elements: {}
};

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 獲取元素
    Game.elements = {
        startScreen: document.getElementById('startScreen'),
        gameScreen: document.getElementById('gameScreen'),
        levelClearScreen: document.getElementById('levelClearScreen'),
        completeScreen: document.getElementById('completeScreen'),
        timeupScreen: document.getElementById('timeupScreen'),
        timerDisplay: document.getElementById('timerDisplay'),
        timerValue: document.getElementById('timerValue'),
        startBtn: document.getElementById('startBtn'),
        nextBtn: document.getElementById('nextBtn'),
        restartBtn: document.getElementById('restartBtn'),
        timeupRestartBtn: document.getElementById('timeupRestartBtn'),
        gameMascot: document.getElementById('gameMascot'),
        speechBubble: document.getElementById('speechBubble'),
        speechText: document.getElementById('speechText'),
        gameArea: document.getElementById('gameArea'),
        level1: document.getElementById('level1'),
        level2: document.getElementById('level2'),
        level3: document.getElementById('level3'),
        charGrid: document.getElementById('charGrid'),
        targetEmoji: document.getElementById('targetEmoji'),
        targetSpeech: document.getElementById('targetSpeech'),
        balloonRow: document.getElementById('balloonRow'),
        bubbleGrid: document.getElementById('bubbleGrid'),
        confettiLayer: document.getElementById('confettiLayer'),
        replayBtn: document.getElementById('replayBtn')
    };

    // 綁定事件
    Game.elements.startBtn.addEventListener('pointerdown', Game.startGame);
    Game.elements.nextBtn.addEventListener('pointerdown', Game.nextLevel);
    Game.elements.restartBtn.addEventListener('pointerdown', Game.restart);
    Game.elements.timeupRestartBtn.addEventListener('pointerdown', Game.restart);

    // 重聽按鈕：重複播放目前關卡的問句
    if (Game.elements.replayBtn) {
        Game.elements.replayBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (Game.state === GameState.playing && Game.currentSpeechText) {
                speak(Game.currentSpeechText, { interrupt: true, preKey: Game.currentPreKey });
            }
        });
    }

    // 頁面隱藏時暫停
    document.addEventListener('visibilitychange', Game.handleVisibilityChange);
});

// ============================================
// 遊戲流程
// ============================================

/**
 * 開始遊戲
 */
Game.startGame = function() {
    Game.state = GameState.playing;
    Game.currentLevel = 1;
    Game.currentQuestion = 0;
    Game.remainingSeconds = Game.totalSeconds;
    Game.lastReminder = 0;
    Game.isLocked = false;

    // 顯示遊戲畫面
    Game.showScreen('gameScreen');
    Game.elements.timerDisplay.hidden = false;
    Game.updateTimerDisplay();

    // 啟動計時器
    Game.startTimer();

    // 初始化音效
    SFX.init();

    // 嘗試解鎖音訊（觸碰後允許播放）
    try {
        const unlockAudio = new Audio('audio/welcome.mp3');
        unlockAudio.volume = 0.001; // 幾乎聽不到
        unlockAudio.play().then(() => {
            unlockAudio.pause();
            unlockAudio.currentTime = 0;
        }).catch(e => console.warn('Audio unlock failed:', e));
    } catch(e) {}

    // 開始遊戲
    Game.startLevel(1);
};

/**
 * 開始某關
 */
Game.startLevel = function(level) {
    Game.currentLevel = level;
    Game.currentQuestion = 0;
    Game.isLocked = false;

    // 顯示對應關卡
    Game.showLevel(level);

    // 選擇本關吉祥物
    const mascot = pickRandom(AnimalPool);
    Game.elements.gameMascot.textContent = mascot.emoji;

    // 生成第一題
    Game.generateQuestion();
};

/**
 * 生成題目
 */
Game.generateQuestion = function() {
    if (Game.currentQuestion >= Game.questionsPerLevel) {
        Game.levelComplete();
        return;
    }

    // 隨機選擇顏色（避免重複）
    const shuffled = [...Game.colors].sort(() => Math.random() - 0.5);
    const numColors = Math.min(3 + Math.floor(Game.currentLevel / 2), shuffled.length);
    const availableColors = shuffled.slice(0, numColors);

    // 隨機選正確顏色
    Game.correctColor = availableColors[Math.floor(Math.random() * availableColors.length)];
    Game.correctIndex = availableColors.indexOf(Game.correctColor);

    // 隨機動物
    const animal = pickRandom(AnimalPool);

    // 根據關卡生成畫面
    switch (Game.currentLevel) {
        case 1:
            Game.generateLevel1(availableColors, animal);
            break;
        case 2:
            Game.generateLevel2(availableColors, animal);
            break;
        case 3:
            Game.generateLevel3(availableColors, animal);
            break;
    }
};

/**
 * Level 1: 找顏色 - 顯示動物卡片
 */
Game.generateLevel1 = function(colors, animal) {
    const grid = Game.elements.charGrid;
    grid.innerHTML = '';

    colors.forEach((color, index) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.dataset.color = color;
        card.dataset.index = index;
        card.style.backgroundColor = Game.getColorHex(color);
        card.textContent = animal.emoji;
        
        card.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            Game.handleAnswer(index, card);
        });
        
        grid.appendChild(card);
    });

    // 播放問題語音（明確指定預錄音檔 key，避免文字匹配錯誤）
    const colorSpeech = ColorSpeech[Game.correctColor];
    const questionText = `${animal.name}，${colorSpeech}在哪里？快找到${colorSpeech}吧！`;
    Game.currentSpeechText = questionText;
    Game.currentPreKey = 'question_' + Game.correctColor;
    speak(questionText, { preKey: Game.currentPreKey });
};

/**
 * Level 2: 配對顏色 - 動物說話 + 氣球
 */
Game.generateLevel2 = function(colors, animal) {
    const row = Game.elements.balloonRow;
    row.innerHTML = '';

    // 顯示動物說話
    Game.elements.targetEmoji.textContent = animal.emoji;
    const colorSpeech = ColorSpeech[Game.correctColor];
    Game.elements.targetSpeech.textContent = `我喜歡${colorSpeech}！`;
    Game.elements.targetSpeech.style.color = Game.getColorHex(Game.correctColor);

    // 生成氣球
    colors.forEach((color, index) => {
        const balloon = document.createElement('div');
        balloon.className = 'balloon';
        balloon.dataset.color = color;
        balloon.dataset.index = index;
        balloon.style.backgroundColor = Game.getColorHex(color);
        balloon.textContent = '🎈';
        
        balloon.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            Game.handleAnswer(index, balloon);
        });
        
        row.appendChild(balloon);
    });

    // 播放問題語音（明確指定 key）
    const questionText2 = `${animal.name}說：我喜歡${colorSpeech}！哪一個氣球是${colorSpeech}的？`;
    Game.currentSpeechText = questionText2;
    Game.currentPreKey = 'question_' + Game.correctColor;
    speak(questionText2, { preKey: Game.currentPreKey });
};

/**
 * Level 3: 顏色小球 - 泡泡網格
 */
Game.generateLevel3 = function(colors, animal) {
    const grid = Game.elements.bubbleGrid;
    grid.innerHTML = '';

    // 生成 6-8 個泡泡
    const numBubbles = 6 + Math.floor(Math.random() * 3);
    const bubbleColors = [];
    
    // 確保正確顏色在網格內
    const correctBubbleIndex = Game.correctIndex % numBubbles;
    
    for (let i = 0; i < numBubbles; i++) {
        let color;
        if (i === correctBubbleIndex) {
            // 在正確位置放正確顏色
            color = Game.correctColor;
        } else {
            color = colors[Math.floor(Math.random() * colors.length)];
        }
        bubbleColors.push(color);
    }
    
    // 更新正確索引為泡泡網格中的位置
    Game.correctIndex = correctBubbleIndex;

    // 隨機重排但保持正確顏色位置
    bubbleColors.forEach((color, index) => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.dataset.color = color;
        bubble.dataset.index = index;
        bubble.style.backgroundColor = Game.getColorHex(color);
        bubble.textContent = animal.emoji;
        
        bubble.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            Game.handleAnswer(index, bubble);
        });
        
        grid.appendChild(bubble);
    });

    // 播放問題語音（明確指定 key）
    const colorSpeech = ColorSpeech[Game.correctColor];
    const questionText3 = `點點${colorSpeech}泡泡！哪一個泡泡是${colorSpeech}的？`;
    Game.currentSpeechText = questionText3;
    Game.currentPreKey = 'question_' + Game.correctColor;
    speak(questionText3, { preKey: Game.currentPreKey });
};

/**
 * 處理答案
 */
Game.handleAnswer = function(index, element) {
    if (Game.isLocked) return;

    if (index === Game.correctIndex) {
        Game.handleCorrect(element);
    } else {
        Game.handleWrong(element);
    }
};

/**
 * 答對處理
 */
Game.handleCorrect = function(element) {
    Game.isLocked = true;
    
    // 視覺效果
    element.classList.add('correct');
    
    // Level 3 泡泡破裂動畫
    if (element.classList.contains('bubble')) {
        element.classList.add('pop');
    }
    
    // 音效
    SFX.playCorrect();
    
    // 慶祝動畫
    Game.spawnConfetti();
    
    // 語音鼓勵
    const encouragement = pickRandom(EncouragementPool.correct);
    speak(encouragement);
    
    // 下一題
    setTimeout(() => {
        Game.currentQuestion++;
        Game.isLocked = false;
        element.classList.remove('correct', 'pop');
        Game.generateQuestion();
    }, 2000);
};

/**
 * 答錯處理（溫柔引導，不懲罰）
 */
Game.handleWrong = function(element) {
    element.classList.add('wrong');
    SFX.playWrong();
    
    // 柔和鼓勵
    const encouragement = pickRandom(EncouragementPool.wrong);
    speak(encouragement);
    
    setTimeout(() => {
        element.classList.remove('wrong');
    }, 600);
};

/**
 * 關卡完成
 */
Game.levelComplete = function() {
    Game.state = GameState.levelClear;
    Game.showScreen('levelClearScreen');
    
    SFX.playCelebration();
    Game.spawnConfetti(50);
    
    const message = pickRandom(EncouragementPool.levelClear);
    speak(message, { preKey: 'level_clear' });
};

/**
 * 下一關
 */
Game.nextLevel = function() {
    if (Game.currentLevel < 3) {
        Game.currentLevel++;
        Game.state = GameState.playing;
        Game.showScreen('gameScreen');
        Game.startLevel(Game.currentLevel);
    } else {
        Game.gameComplete();
    }
};

/**
 * 遊戲完成
 */
Game.gameComplete = function() {
    Game.state = GameState.complete;
    Game.stopTimer();
    Game.showScreen('completeScreen');
    
    SFX.playCelebration();
    Game.spawnConfetti(80);
    
    const message = pickRandom(EncouragementPool.complete);
    speak(message, { preKey: 'complete' });
};

/**
 * 時間到
 */
Game.timeUp = function() {
    Game.state = GameState.timeUp;
    Game.stopTimer();
    Game.showScreen('timeupScreen');
    
    SFX.playTimeUp();
    
    const message = pickRandom(EncouragementPool.timeUp);
    speak(message, { preKey: 'time_up' });
};

/**
 * 重新開始
 */
Game.restart = function() {
    Game.showScreen('startScreen');
    Game.state = GameState.start;
    Game.elements.timerDisplay.hidden = true;
    TTS.cancel();
    if (typeof PreAudio !== 'undefined') PreAudio.stop();
};

// ============================================
// 計時器邏輯
// ============================================

/**
 * 啟動計時器
 */
Game.startTimer = function() {
    Game.timerInterval = setInterval(() => {
        Game.remainingSeconds--;
        Game.updateTimerDisplay();
        
        // 每 5 分鐘提醒（依實際剩餘時間選擇正確語音）
        const elapsed = Game.totalSeconds - Game.remainingSeconds;
        if (elapsed > 0 && elapsed % 300 === 0 && elapsed !== Game.lastReminder) {
            Game.lastReminder = elapsed;
            const remainMin = Math.ceil(Game.remainingSeconds / 60);
            let message, preKey;
            if (remainMin >= 10) {
                message = '我們已經玩了五分鐘，還有十分鐘喔！';
                preKey = 'time_reminder_5';
            } else {
                message = '已經玩了十分鐘，還有五分鐘喔！';
                preKey = 'time_reminder_10';
            }
            speak(message, { interrupt: true, preKey });
        }
        
        // 剩 2 分鐘預警
        if (Game.remainingSeconds === 120) {
            speak('還有兩分鐘，再完成最後幾題吧！', { interrupt: true, preKey: 'time_warning_2' });
        }
        
        // 時間到
        if (Game.remainingSeconds <= 0) {
            Game.timeUp();
        }
    }, 1000);
};

/**
 * 停止計時器
 */
Game.stopTimer = function() {
    if (Game.timerInterval) {
        clearInterval(Game.timerInterval);
        Game.timerInterval = null;
    }
};

/**
 * 更新計時器顯示
 */
Game.updateTimerDisplay = function() {
    const minutes = Math.floor(Game.remainingSeconds / 60);
    const seconds = Game.remainingSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    Game.elements.timerValue.textContent = timeStr;
    
    // 最後 2 分鐘變色警告
    if (Game.remainingSeconds <= 120) {
        Game.elements.timerDisplay.style.color = '#FF6B6B';
    } else {
        Game.elements.timerDisplay.style.color = '';
    }
};

// ============================================
// 頁面隱藏處理
// ============================================

/**
 * 處理頁面可見性變更
 */
Game.handleVisibilityChange = function() {
    if (document.hidden) {
        // 隱藏時暫停
        if (Game.timerInterval) {
            clearInterval(Game.timerInterval);
            Game.timerInterval = null;
        }
        TTS.pause();
    } else {
        // 顯示時恢復
        if (Game.state === GameState.playing && !Game.timerInterval) {
            Game.startTimer();
        }
        TTS.resume();
    }
};

// ============================================
// 輔助函式
// ============================================

/**
 * 顯示對應畫面
 */
Game.showScreen = function(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
};

/**
 * 顯示對應關卡
 */
Game.showLevel = function(level) {
    document.querySelectorAll('.level').forEach(l => l.classList.remove('active'));
    Game.elements[`level${level}`].classList.add('active');
};

/**
 * 生成彩帶
 */
Game.spawnConfetti = function(count = 30) {
    const colors = ['#FF6B6B', '#FFE66D', '#6BC7FF', '#98FB98', '#FFB6C1', '#E6B3FF'];
    const layer = Game.elements.confettiLayer;
    
    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (1.5 + Math.random()) + 's';
        layer.appendChild(confetti);
        
        // 移除已完成的彩帶
        setTimeout(() => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 2500);
    }
};

/**
 * 顏色名稱轉 HEX
 */
Game.getColorHex = function(colorName) {
    const hexMap = {
        red: '#FF6B6B',
        yellow: '#FFE66D',
        blue: '#6BC7FF',
        green: '#98FB98',
        orange: '#FFD59E',
        purple: '#E6B3FF',
        pink: '#FFB6C1',
        skyblue: '#B3E5FF',
        brown: '#D4A574',
        gray: '#D3D3D3',
        teal: '#5FD3BF',
        lavender: '#C8A2FF',
        cyan: '#00FFFF',
        white: '#FFFFFF',
        black: '#000000'
    };
    return hexMap[colorName] || '#CCCCCC';
};

// 暴露到全域（方便除錯）
window.Game = Game;
window.TTS = TTS;
window.SFX = SFX;
window.SoundSynthesizer = SoundSynthesizer;
window.PreAudio = PreAudio;
window.EncouragementPool = EncouragementPool;
window.ColorSpeech = ColorSpeech;
window.AnimalPool = AnimalPool;
window.speak = speak;
