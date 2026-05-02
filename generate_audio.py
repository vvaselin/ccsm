"""
generate_audio.py

vocab.py の全語彙 × 指定スピーカーの音声を事前生成し、
Cloud Storage にアップロードする。

使い方:
  # 全語彙を全スピーカー分生成
  uv run generate_audio.py

  # 未生成ファイルだけ生成（差分更新）
  uv run generate_audio.py --only-missing

  # ローカル保存のみ（GCSアップロードしない）
  uv run generate_audio.py --local-only

  # スピーカーを絞る
  uv run generate_audio.py --speakers 50 47 48

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

# 読み上げスタイル
SPEED_SCALE       = 0.8
PITCH_SCALE       = 0.0
INTONATION_SCALE  = 0.8
PRE_PHONEME_LEN   = 0.1
POST_PHONEME_LEN  = 0.2

# 同時リクエスト数（VOICEVOXが重いので絞る）
CONCURRENCY = 3


def gcs_path(speaker: int, word: str) -> str:
    """GCS上のオブジェクトパス"""
    return f"speaker_{speaker}/{word}.wav"


def local_path(speaker: int, word: str) -> Path:
    """ローカルのファイルパス"""
    return OUTPUT_DIR / f"speaker_{speaker}" / f"{word}.wav"


async def synthesize(client: httpx.AsyncClient, word: str, speaker: int) -> bytes:
    """VOICEVOXで音声合成してwavバイト列を返す"""
    query_res = await client.post(
        f"{VOICEVOX_URL}/audio_query",
        params={"text": word, "speaker": speaker},
        timeout=15.0,
    )
    query_res.raise_for_status()
    query = query_res.json()

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


async def process_word(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    word: str,
    speaker: int,
    only_missing: bool,
    local_only: bool,
    bucket: str,
) -> tuple[str, str]:
    """1語を処理して (word, status) を返す"""
    lpath = local_path(speaker, word)
    gpath = gcs_path(speaker, word)

    # --only-missing: ローカルに既にあればスキップ
    if only_missing and lpath.exists():
        return word, "skip"

    async with sem:
        try:
            wav = await synthesize(client, word, speaker)
        except Exception as e:
            return word, f"error: {e}"

    # ローカル保存
    lpath.parent.mkdir(parents=True, exist_ok=True)
    lpath.write_bytes(wav)

    # GCSアップロード
    if not local_only:
        try:
            upload_to_gcs(lpath, gpath, bucket)
        except Exception as e:
            return word, f"upload_error: {e}"

    return word, "ok"


async def run(
    speakers: list[int],
    only_missing: bool,
    local_only: bool,
    bucket: str,
) -> None:
    # vocab から全語彙を取得
    sys.path.insert(0, str(Path(__file__).parent))
    from src.vocab import get_all_whitelist
    words = sorted(get_all_whitelist())

    total = len(words) * len(speakers)
    print(f"対象: {len(words)}語 × {len(speakers)}スピーカー = {total}ファイル")
    print(f"VOICEVOX: {VOICEVOX_URL}")
    if not local_only:
        print(f"GCS: gs://{bucket}/")
    print()

    sem = asyncio.Semaphore(CONCURRENCY)
    ok = skip = err = 0

    async with httpx.AsyncClient() as client:
        for speaker in speakers:
            print(f"── スピーカー {speaker} ──")
            tasks = [
                process_word(sem, client, word, speaker, only_missing, local_only, bucket)
                for word in words
            ]
            results = await asyncio.gather(*tasks)
            for word, status in results:
                if status == "ok":
                    ok += 1
                    print(f"  ✓ {word}")
                elif status == "skip":
                    skip += 1
                else:
                    err += 1
                    print(f"  ✗ {word}: {status}", file=sys.stderr)

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
    args = parser.parse_args()

    asyncio.run(run(
        speakers=args.speakers,
        only_missing=args.only_missing,
        local_only=args.local_only,
        bucket=args.bucket,
    ))


if __name__ == "__main__":
    main()