from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from src.model import load_model, create_tagger
from src.filter import is_soft_noun, is_valid_response_word
import random
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

wv = load_model()
tagger = create_tagger()

# 起動時に一度だけフィルタをかけた安全な語彙を作る
# index_to_key は頻度順なので上位に絞るだけでノイズが大幅に減る
VOCAB_FREQ_CAP = 30_000

print("語彙フィルタリング中...")
filtered_words = [
    w for w in wv.index_to_key[:VOCAB_FREQ_CAP]
    if is_soft_noun(w, tagger)
]
print(f"フィルタ後語彙数: {len(filtered_words)}")


def _is_safe_prev(prev: str) -> bool:
    """prevが日本語の正常な単語かチェック"""
    if not prev:
        return False
    # 英字・数字・記号が混じっていたら無視
    if re.search(r'[A-Za-z0-9\[\]()/]', prev):
        return False
    # IPA文字・制御文字など非通常Unicode
    if re.search(r'[^\u3000-\u9fff\uff00-\uffef]', prev):
        return False
    # 長すぎる（複合語・ノイズ）
    if len(prev) > 10:
        return False
    return True


@app.get("/word")
def get_word(prev: str | None = Query(None)) -> dict:

    if not filtered_words:
        return {"word": "空"}

    # prevが怪しければ無視してランダム選択
    if not _is_safe_prev(prev):
        return {"word": random.choice(filtered_words)}

    try:
        candidates = wv.most_similar(prev, topn=100)

        filtered = []
        for w, score in candidates:
            # スコア範囲：近すぎず遠すぎず（認知シャッフル的には0.1〜0.35くらいが良い）
            if not (0.05 < score < 0.35):
                continue
            # 安全語彙に含まれているものだけ
            if w not in set(filtered_words):
                continue
            filtered.append(w)

        # フォールバックも filtered_words（安全語彙）から
        result = random.choice(filtered) if filtered else random.choice(filtered_words)

    except KeyError:
        result = random.choice(filtered_words)

    return {"word": result}