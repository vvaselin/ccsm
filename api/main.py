from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from src.model import load_model, create_tagger
from src.filter import build_filtered_words
from src.sampler import get_random_words, get_far_words
import random

app = FastAPI()
# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- 起動時にロード ---
wv = load_model()
tagger = create_tagger()
filtered_words = build_filtered_words(wv, tagger)

@app.get("/word")
def get_word(prev: str | None = Query(None))-> dict:
    """
    前回の単語と類似度が高すぎない単語を返す
    """
    if prev:
        candidates = [
            w for w in filtered_words
            if wv.similarity(w, prev) < 0.1
        ]
        w = random.choice(candidates) if candidates else random.choice(filtered_words)
    else:
        w = random.choice(filtered_words)

    return {"word": w}
