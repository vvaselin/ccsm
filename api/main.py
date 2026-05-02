import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from src.word_picker import pick_next
from src.session import InMemorySessionStore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = InMemorySessionStore()

# GCS公開URL（環境変数で切り替え可能）
GCS_BASE_URL = os.environ.get("GCS_BASE_URL", "")
DEFAULT_SPEAKER = int(os.environ.get("DEFAULT_SPEAKER", "50"))

# ローカル音声キャッシュのルートディレクトリ
AUDIO_CACHE_DIR = Path(os.environ.get("AUDIO_CACHE_DIR", "audio_cache"))


def audio_url(word: str, speaker: int) -> str:
    """
    本番: https://storage.googleapis.com/cssm-audio/speaker_50/海.wav
    ローカル: /audio?word=海&speaker=50 （audio_cache/ から返す）
    """
    if GCS_BASE_URL:
        return f"{GCS_BASE_URL}/speaker_{speaker}/{word}.wav"
    return f"/audio?word={word}&speaker={speaker}"


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


# ローカル開発用: audio_cache/ から wav ファイルを返す
if not GCS_BASE_URL:
    from fastapi.responses import FileResponse

    @app.get("/audio")
    async def get_audio_cache(
        word: str = Query(...),
        speaker: int = Query(DEFAULT_SPEAKER),
    ):
        path = AUDIO_CACHE_DIR / f"speaker_{speaker}" / f"{word}.wav"
        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"音声ファイルが見つかりません: {path}",
            )
        return FileResponse(path, media_type="audio/wav")