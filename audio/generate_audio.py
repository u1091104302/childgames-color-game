#!/usr/bin/env python3
"""
generate_audio.py — 生成預錄語音檔腳本

使用 edge-tts 生成台灣女聲中文語音檔案

安裝依賴：
    pip install edge-tts

使用方式：
    python generate_audio.py

生成位置：
    audio/ 資料夾

語音選項（edge-tts）：
    - zh-TW-HsiaoChenNeural (女聲，微軟曉晨)
    - zh-TW-YunJheNeural (男聲)
    - zh-TW-HsiangWeiNeural (女聲)
"""

import asyncio
import json
import os
import edge_tts

# ============================================
# 設定
# ============================================

VOICE = "zh-TW-HsiaoChenNeural"  # 微軟曉晨（台灣女聲）
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
RATE = "-10%"  # 稍微放慢，適合幼兒
VOLUME = "+0%"  # 標準音量
PITCH = "+0Hz"  # 標準音調

# ============================================
# 語音腳本
# ============================================

AUDIO_SCRIPTS = {
    # 歡迎
    "welcome": "歡迎來到顏色小冒險！我們開始吧！",
    "level1_start": "第一關開始囉！看看哪一個顏色在哪里？",
    "level2_start": "第二關開始囉！動物寶寶喜歡什麼顏色呢？",
    "level3_start": "第三關開始囉！點點正確的顏色泡泡吧！",
    
    # 問題（顏色）
    "question_red": "紅色在哪里？快找到紅色吧！",
    "question_yellow": "黃色在哪里？快找到黃色吧！",
    "question_blue": "藍色在哪里？快找到藍色吧！",
    "question_green": "綠色在哪里？快找到綠色吧！",
    "question_orange": "橘色在哪里？快找到橘色吧！",
    "question_purple": "紫色在哪里？快找到紫色吧！",
    "question_pink": "粉紅色在哪里？快找到粉紅色吧！",
    "question_skyblue": "天藍色在哪里？快找到天藍色吧！",
    "question_brown": "棕色在哪里？快找到棕色吧！",
    "question_gray": "灰色在哪里？快找到灰色吧！",
    "question_teal": "青綠色在哪里？快找到青綠色吧！",
    "question_lavender": "淡紫色在哪里？快找到淡紫色吧！",
    
    # 答對鼓勵
    "correct_1": "太棒了！你找到顏色啦！",
    "correct_2": "你好厲害！顏色找對了！",
    "correct_3": "真聰明！繼續加油！",
    "correct_4": "好厲害！你是顏色小達人！",
    "correct_5": "太棒了！顏色顏色，我喜歡！",
    
    # 答錯引導
    "wrong_1": "再試試看，你可以的！",
    "wrong_2": "嗯嗯，再找一次吧！",
    "wrong_3": "沒關係，再找一次！",
    
    # 關卡完成
    "level_clear": "這一關完成啦！你超棒的！",
    "complete": "你完成所有關卡啦！顏色小達人！",
    "time_up": "時間到了！你今天很努力喔！我們下次再玩吧！",
    
    # 時間提醒
    "time_reminder_5": "我們已經玩了五分鐘，還有十分鐘喔！",
    "time_reminder_10": "已經玩了十分鐘，還有五分鐘喔！",
    "time_warning_2": "還有兩分鐘，再完成最後幾題吧！"
}

# ============================================
# 生成函式
# ============================================

async def generate_one(key, text):
    """生成單一語音檔"""
    filename = f"{key}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    print(f"正在生成: {key} ({text[:20]}...)")
    
    communicate = edge_tts.Communicate(
        text, 
        VOICE, 
        rate=RATE, 
        volume=VOLUME,
        pitch=PITCH
    )
    
    await communicate.save(filepath)
    print(f"  ✓ 完成: {filename}")

async def main():
    """生成所有語音檔"""
    print(f"🎙️  開始生成語音檔...")
    print(f"語音: {VOICE}")
    print(f"輸出目錄: {OUTPUT_DIR}")
    print()
    
    tasks = []
    for key, text in AUDIO_SCRIPTS.items():
        tasks.append(generate_one(key, text))
    
    # 並行生成（限制數量避免 overload）
    for i in range(0, len(tasks), 5):
        batch = tasks[i:i+5]
        await asyncio.gather(*batch)
        await asyncio.sleep(0.5)  # 稍微延遲避免速率限制
    
    print(f"\n✅ 完成！共生成 {len(AUDIO_SCRIPTS)} 個語音檔")
    print(f"請將 audio/ 資料夾連同遊戲一起複製到手機")

if __name__ == "__main__":
    # 檢查依賴
    try:
        import edge_tts
    except ImportError:
        print("❌ 請先安裝 edge-tts:")
        print("   pip install edge-tts")
        exit(1)
    
    asyncio.run(main())
