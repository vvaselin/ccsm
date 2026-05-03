import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from src.word_picker import pick_next
from src.session import InMemorySessionStore
from src.phrases import get_phrase

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = InMemorySessionStore()

GCS_BASE_URL    = os.environ.get("GCS_BASE_URL", "")
DEFAULT_SPEAKER = int(os.environ.get("DEFAULT_SPEAKER", "50"))
AUDIO_CACHE_DIR = Path(os.environ.get("AUDIO_CACHE_DIR", "audio_cache"))


def audio_url(word: str, speaker: int) -> str:
    if GCS_BASE_URL:
        return f"{GCS_BASE_URL}/speaker_{speaker}/{word}.wav"
    return f"/audio?word={word}&speaker={speaker}"


def phrase_url(phrase: str, speaker: int) -> str:
    if GCS_BASE_URL:
        return f"{GCS_BASE_URL}/phrases/speaker_{speaker}/{phrase}.wav"
    return f"/phrase-audio?phrase={phrase}&speaker={speaker}"


@app.get("/next")
async def get_next(
    session_id: str = Query(...),
    prev: str | None = Query(None),
    speaker: int = Query(DEFAULT_SPEAKER),
) -> dict:
    word = pick_next(store, session_id, prev)
    return {
        "word": word,
        "audio_url": audio_url(word, speaker),
    }


@app.get("/phrase")
async def get_phrase_endpoint(
    type: str = Query(...),  # start / stop / relax
    speaker: int = Query(DEFAULT_SPEAKER),
) -> dict:
    try:
        phrase = get_phrase(type, speaker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "phrase": phrase,
        "audio_url": phrase_url(phrase, speaker),
    }


# ローカル開発用
if not GCS_BASE_URL:
    from fastapi.responses import FileResponse

    @app.get("/audio")
    async def get_audio_cache(
        word: str = Query(...),
        speaker: int = Query(DEFAULT_SPEAKER),
    ):
        path = AUDIO_CACHE_DIR / f"speaker_{speaker}" / f"{word}.wav"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"音声ファイルが見つかりません: {path}")
        return FileResponse(path, media_type="audio/wav")

    @app.get("/phrase-audio")
    async def get_phrase_audio_cache(
        phrase: str = Query(...),
        speaker: int = Query(DEFAULT_SPEAKER),
    ):
        path = AUDIO_CACHE_DIR / "phrases" / f"speaker_{speaker}" / f"{phrase}.wav"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"セリフ音声ファイルが見つかりません: {path}")
        return FileResponse(path, media_type="audio/wav")