"""
generate_audio.py

vocab.py の全語彙 × 指定スピーカーの音声を事前生成し、
Cloud Storage にアップロードする。
phrases.py のセリフも同様に生成する。

使い方:
  # 全語彙・全セリフを全スピーカー分生成
  uv run generate_audio.py

  # 未生成ファイルだけ生成（差分更新）
  uv run generate_audio.py --only-missing

  # ローカル保存のみ（GCSアップロードしない）
  uv run generate_audio.py --local-only

  # スピーカーを絞る
  uv run generate_audio.py --speakers 50 47 48

  # 語彙のみ / セリフのみ
  uv run generate_audio.py --vocab-only
  uv run generate_audio.py --phrases-only

環境変数:
  GCS_BUCKET  ... アップロード先バケット名（例: cssm-audio）
  VOICEVOX_URL ... VOICEVOXのURL（デフォルト: http://localhost:50021）
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

import httpx

# --- 設定 ---
VOICEVOX_URL = os.environ.get("VOICEVOX_URL", "http://localhost:50021")
GCS_BUCKET   = os.environ.get("GCS_BUCKET", "cssm-audio")
OUTPUT_DIR   = Path("audio_cache")  # ローカル保存先

# 生成対象スピーカー（デフォルト）
DEFAULT_SPEAKERS = [
    19,   # 九州そら ささやき
    22,   # ずんだもん ささやき
    31,   # No.7 読み聞かせ
    36,   # 四国めたん ささやき
    45,   # 櫻歌ミコ ロリ
    50,   # ナースロボ＿タイプＴ 内緒話
    105,  # ユーレイちゃん ささやき
    117,  # あんこもん ささやき
    125,  # 暁記ミタマ ささやき
]

# 読み上げスタイル（語彙用）
SPEED_SCALE       = 0.8
PITCH_SCALE       = 0.0
INTONATION_SCALE  = 0.8
PRE_PHONEME_LEN   = 0.1
POST_PHONEME_LEN  = 0.2

# 読み上げスタイル（セリフ用：少しゆっくり・間を多めに）
PHRASE_SPEED_SCALE      = 0.75
PHRASE_INTONATION_SCALE = 0.7
PHRASE_PRE_PHONEME_LEN  = 0.2
PHRASE_POST_PHONEME_LEN = 0.4

# 同時リクエスト数（VOICEVOXが重いので絞る）
CONCURRENCY = 3


def local_path(speaker: int, word: str, is_phrase: bool = False) -> Path:
    """ローカルのファイルパス"""
    if is_phrase:
        return OUTPUT_DIR / "phrases" / f"speaker_{speaker}" / f"{word}.wav"
    return OUTPUT_DIR / f"speaker_{speaker}" / f"{word}.wav"


def gcs_path(speaker: int, word: str, is_phrase: bool = False) -> str:
    """GCS上のオブジェクトパス"""
    if is_phrase:
        return f"phrases/speaker_{speaker}/{word}.wav"
    return f"speaker_{speaker}/{word}.wav"


async def synthesize(
    client: httpx.AsyncClient,
    text: str,
    speaker: int,
    is_phrase: bool = False,
) -> bytes:
    """VOICEVOXで音声合成してwavバイト列を返す"""
    query_res = await client.post(
        f"{VOICEVOX_URL}/audio_query",
        params={"text": text, "speaker": speaker},
        timeout=15.0,
    )
    query_res.raise_for_status()
    query = query_res.json()

    if is_phrase:
        query["speedScale"]       = PHRASE_SPEED_SCALE
        query["pitchScale"]       = PITCH_SCALE
        query["intonationScale"]  = PHRASE_INTONATION_SCALE
        query["volumeScale"]      = 1.0
        query["prePhonemeLength"] = PHRASE_PRE_PHONEME_LEN
        query["postPhonemeLength"]= PHRASE_POST_PHONEME_LEN
    else:
        query["speedScale"]       = SPEED_SCALE
        query["pitchScale"]       = PITCH_SCALE
        query["intonationScale"]  = INTONATION_SCALE
        query["volumeScale"]      = 1.0
        query["prePhonemeLength"] = PRE_PHONEME_LEN
        query["postPhonemeLength"]= POST_PHONEME_LEN

    synth_res = await client.post(
        f"{VOICEVOX_URL}/synthesis",
        params={"speaker": speaker},
        json=query,
        timeout=30.0,
    )
    synth_res.raise_for_status()
    return synth_res.content


def upload_to_gcs(local_file: Path, gcs_object: str, bucket: str) -> None:
    """gsutilでGCSにアップロード"""
    import subprocess
    dest = f"gs://{bucket}/{gcs_object}"
    result = subprocess.run(
        ["gsutil", "-q", "cp", str(local_file), dest],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"gsutil失敗: {result.stderr}")


async def process_item(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    text: str,
    speaker: int,
    only_missing: bool,
    local_only: bool,
    bucket: str,
    is_phrase: bool = False,
) -> tuple[str, str]:
    """1テキストを処理して (text, status) を返す"""
    lpath = local_path(speaker, text, is_phrase)
    gpath = gcs_path(speaker, text, is_phrase)

    if only_missing and lpath.exists():
        return text, "skip"

    async with sem:
        try:
            wav = await synthesize(client, text, speaker, is_phrase)
        except Exception as e:
            return text, f"error: {e}"

    lpath.parent.mkdir(parents=True, exist_ok=True)
    lpath.write_bytes(wav)

    if not local_only:
        try:
            upload_to_gcs(lpath, gpath, bucket)
        except Exception as e:
            return text, f"upload_error: {e}"

    return text, "ok"


async def run(
    speakers: list[int],
    only_missing: bool,
    local_only: bool,
    bucket: str,
    vocab_only: bool,
    phrases_only: bool,
) -> None:
    sys.path.insert(0, str(Path(__file__).parent))
    from src.vocab import get_all_whitelist
    from src.phrases import get_phrases_for_speaker

    words = sorted(get_all_whitelist()) if not phrases_only else []

    print(f"VOICEVOX: {VOICEVOX_URL}")
    if not local_only:
        print(f"GCS: gs://{bucket}/")
    print()

    sem = asyncio.Semaphore(CONCURRENCY)
    ok = skip = err = 0

    async with httpx.AsyncClient() as client:
        for speaker in speakers:
            print(f"── スピーカー {speaker} ──")

            # 語彙
            if words:
                print(f"  [語彙] {len(words)}語")
                tasks = [
                    process_item(sem, client, w, speaker, only_missing, local_only, bucket, is_phrase=False)
                    for w in words
                ]
                for text, status in await asyncio.gather(*tasks):
                    if status == "ok":      ok   += 1; print(f"    ✓ {text}")
                    elif status == "skip":  skip += 1
                    else:                   err  += 1; print(f"    ✗ {text}: {status}", file=sys.stderr)

            # セリフ：このスピーカーのスタイルに対応するものだけ
            if not vocab_only:
                phrases = sorted(get_phrases_for_speaker(speaker))
                print(f"  [セリフ] {len(phrases)}件")
                tasks = [
                    process_item(sem, client, p, speaker, only_missing, local_only, bucket, is_phrase=True)
                    for p in phrases
                ]
                for text, status in await asyncio.gather(*tasks):
                    if status == "ok":      ok   += 1; print(f"    ✓ {text}")
                    elif status == "skip":  skip += 1
                    else:                   err  += 1; print(f"    ✗ {text}: {status}", file=sys.stderr)

    print()
    print(f"完了: {ok}件生成, {skip}件スキップ, {err}件エラー")
    if err > 0:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="VOICEVOX音声一括生成")
    parser.add_argument(
        "--speakers", type=int, nargs="+",
        default=DEFAULT_SPEAKERS,
        help="生成するスピーカーID（スペース区切りで複数指定可）"
    )
    parser.add_argument(
        "--only-missing", action="store_true",
        help="ローカルに存在しないファイルだけ生成する"
    )
    parser.add_argument(
        "--local-only", action="store_true",
        help="GCSにアップロードせずローカル保存のみ"
    )
    parser.add_argument(
        "--bucket", default=GCS_BUCKET,
        help=f"GCSバケット名（デフォルト: {GCS_BUCKET}）"
    )
    parser.add_argument(
        "--vocab-only", action="store_true",
        help="語彙のみ生成（セリフをスキップ）"
    )
    parser.add_argument(
        "--phrases-only", action="store_true",
        help="セリフのみ生成（語彙をスキップ）"
    )
    args = parser.parse_args()

    asyncio.run(run(
        speakers=args.speakers,
        only_missing=args.only_missing,
        local_only=args.local_only,
        bucket=args.bucket,
        vocab_only=args.vocab_only,
        phrases_only=args.phrases_only,
    ))


if __name__ == "__main__":
    main()