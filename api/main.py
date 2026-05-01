import base64
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from src.speech import get_audio, DEFAULT_SPEAKER
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

# Redis に切り替えるときはここだけ変える
# store = RedisSessionStore(os.environ["REDIS_URL"])
store = InMemorySessionStore()


@app.get("/next")
async def get_next(
    session_id: str = Query(...),
    prev: str | None = Query(None),
    speaker: int = Query(DEFAULT_SPEAKER),
) -> dict:
    word = pick_next(store, session_id, prev)
    audio_bytes = await get_audio(word, speaker)
    audio_b64 = base64.b64encode(audio_bytes).decode()
    return {"word": word, "audio": audio_b64}