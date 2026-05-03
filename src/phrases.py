"""
phrases.py
口調スタイル別セリフの管理

phrases.json からテンプレートを読み込み、
スピーカーIDに対応するセリフをランダムに返す。
"""

import json
import random
from pathlib import Path

# スピーカーID → 口調スタイル
SPEAKER_STYLE: dict[int, str] = {
    19:  "formal",    # 九州そら
    22:  "noda",      # ずんだもん
    31:  "default",   # No.7
    36:  "ojosama",   # 四国めたん
    45:  "loli",      # 櫻歌ミコ
    50:  "default",   # ナースロボ
    105: "loli",      # ユーレイ
    117: "mon",       # あんこもん
    125: "formal",    # 暁記ミタマ
}

_PHRASES_PATH = Path(__file__).parent.parent / "phrases.json"
_cache: dict | None = None


def _load() -> dict:
    global _cache
    if _cache is None:
        _cache = json.loads(_PHRASES_PATH.read_text(encoding="utf-8"))
    return _cache


def get_phrase(phrase_type: str, speaker_id: int) -> str:
    """
    phrase_type: "start" | "stop" | "relax"
    speaker_id: VOICEVOXのスピーカーID
    """
    data  = _load()
    style = SPEAKER_STYLE.get(speaker_id, "default")

    candidates = data.get(phrase_type, {}).get(style)
    if not candidates:
        candidates = data.get(phrase_type, {}).get("default", [])
    if not candidates:
        raise ValueError(f"セリフが見つかりません: type={phrase_type}, style={style}")

    return random.choice(candidates)


def get_phrases_for_speaker(speaker_id: int) -> set[str]:
    """指定スピーカーのスタイルに対応するセリフのみ返す"""
    data  = _load()
    style = SPEAKER_STYLE.get(speaker_id, "default")
    result: set[str] = set()
    for phrase_type, styles in data.items():
        if phrase_type.startswith("_"):
            continue
        candidates = styles.get(style) or styles.get("default", [])
        result.update(candidates)
    return result


def get_all_phrases() -> set[str]:
    """generate_audio.py が使用：全スタイル×全typeのセリフを重複なく返す"""
    data = _load()
    result: set[str] = set()
    for phrase_type, styles in data.items():
        if phrase_type.startswith("_"):
            continue
        for phrases in styles.values():
            result.update(phrases)
    return result