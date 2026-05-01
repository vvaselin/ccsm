import base64
from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from src.model import load_model, create_tagger
from src.vocab import get_all_whitelist, MANUAL_ALIAS
from src.alias import load_or_build
from src.word_picker import pick_next
from src.speech import get_audio, DEFAULT_SPEAKER

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

print("語彙フィルタリング中...")
whitelist = get_all_whitelist()
wv_vocab = set(wv.index_to_key)

filtered_words, alias_map = load_or_build(wv, whitelist, MANUAL_ALIAS)
filtered_words_set = set(filtered_words)

print(f"  ホワイトリスト: {len(whitelist)}語")
print(f"  fastText収録済み: {len(filtered_words)}語")
print(f"  エイリアス: {len(alias_map)}語")


@app.get("/next")
async def get_next(
    prev: str | None = Query(None),
    speaker: int = Query(DEFAULT_SPEAKER),
) -> dict:
    """
    次の単語を選択し、音声合成してbase64で返す。
    単語選択 → 音声合成の順で処理。
    """
    word = pick_next(
        wv=wv,
        prev=prev,
        wv_vocab=wv_vocab,
        filtered_words=filtered_words,
        filtered_words_set=filtered_words_set,
        alias_map=alias_map,
    )
    audio_bytes = await get_audio(word, speaker)
    audio_b64 = base64.b64encode(audio_bytes).decode()

    return {"word": word, "audio": audio_b64}