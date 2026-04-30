from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI()

# Nuxt(ポート3000)からのアクセスを許可する設定 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/word")
async def get_word():
    # 本来はここで Word2Vec を使って単語を選ぶ
    words = ["りんご", "ゴリラ", "ラッパ", "パセリ"]
    selected_word = random.choice(words)
    
    return {
        "word": selected_word,
        "audio_url": f"[https://example.com/audio/](https://example.com/audio/){selected_word}.mp3" # 後でVOICEVOXに置き換え
    }