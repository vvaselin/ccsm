"""
VOICEVOX音声合成モジュール

/word と同時に呼び出され、単語の音声をwavで返す。
同じ単語はキャッシュして再合成を省略する。
"""

import httpx
from functools import lru_cache

VOICEVOX_URL = "http://localhost:50021"
DEFAULT_SPEAKER = 50  # ナースロボ＿タイプＴ 内緒話

# 読み上げスタイル設定
SPEED_SCALE = 0.8
PITCH_SCALE = 0.0
INTONATION_SCALE = 0.8
PRE_PHONEME_LENGTH = 0.1
POST_PHONEME_LENGTH = 0.2


async def synthesize(word: str, speaker: int = DEFAULT_SPEAKER) -> bytes:
    """単語をVOICEVOXで合成してwavバイト列を返す"""
    async with httpx.AsyncClient() as client:
        # audio_query
        query_res = await client.post(
            f"{VOICEVOX_URL}/audio_query",
            params={"text": word, "speaker": speaker},
            timeout=10.0,
        )
        query_res.raise_for_status()
        query = query_res.json()

        query["speedScale"] = SPEED_SCALE
        query["pitchScale"] = PITCH_SCALE
        query["intonationScale"] = INTONATION_SCALE
        query["volumeScale"] = 1.0     # 音量
        query["prePhonemeLength"] = PRE_PHONEME_LENGTH
        query["postPhonemeLength"] = POST_PHONEME_LENGTH

        # synthesis
        synth_res = await client.post(
            f"{VOICEVOX_URL}/synthesis",
            params={"speaker": speaker},
            json=query,
            timeout=30.0,
        )
        synth_res.raise_for_status()
        return synth_res.content


# 単語×スピーカーの組み合わせでキャッシュ（最大512エントリ）
# 同じ単語が再登場したとき再合成を省略できる
@lru_cache(maxsize=512)
def _cache_key(word: str, speaker: int) -> str:
    return f"{speaker}:{word}"


_audio_cache: dict[str, bytes] = {}


async def get_audio(word: str, speaker: int = DEFAULT_SPEAKER) -> bytes:
    key = _cache_key(word, speaker)
    if key not in _audio_cache:
        _audio_cache[key] = await synthesize(word, speaker)
    return _audio_cache[key]