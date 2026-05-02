import os
from fastapi import FastAPI, Query
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
GCS_BASE_URL = os.environ.get(
    "GCS_BASE_URL",
    "http://localhost:50021",  # ローカル開発時はVOICEVOXに直接フォールバック
)
DEFAULT_SPEAKER = int(os.environ.get("DEFAULT_SPEAKER", "50"))


def audio_url(word: str, speaker: int) -> str:
    """
    本番: https://storage.googleapis.com/cssm-audio/speaker_50/海.wav
    ローカル: VOICEVOXのsynthesisエンドポイントへのURL（フロントからは直接叩けないのでプロキシ）
    """
    if GCS_BASE_URL.startswith("http://localhost"):
        # ローカル開発用: /audio プロキシエンドポイントを使う
        return f"/audio?word={word}&speaker={speaker}"
    return f"{GCS_BASE_URL}/speaker_{speaker}/{word}.wav"


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


# ローカル開発用: VOICEVOXをプロキシして音声を返す
if not os.environ.get("GCS_BASE_URL"):
    import base64
    import httpx

    VOICEVOX_URL = os.environ.get("VOICEVOX_URL", "http://localhost:50021")
    SPEED_SCALE = 0.8
    INTONATION_SCALE = 0.8

    @app.get("/audio")
    async def get_audio_proxy(
        word: str = Query(...),
        speaker: int = Query(DEFAULT_SPEAKER),
    ):
        from fastapi.responses import Response
        async with httpx.AsyncClient() as client:
            q = await client.post(
                f"{VOICEVOX_URL}/audio_query",
                params={"text": word, "speaker": speaker},
                timeout=10.0,
            )
            q.raise_for_status()
            query = q.json()
            query["speedScale"] = SPEED_SCALE
            query["intonationScale"] = INTONATION_SCALE

            s = await client.post(
                f"{VOICEVOX_URL}/synthesis",
                params={"speaker": speaker},
                json=query,
                timeout=30.0,
            )
            s.raise_for_status()
        return Response(content=s.content, media_type="audio/wav")