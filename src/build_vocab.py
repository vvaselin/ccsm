"""
scripts/build_vocab.py

vocab.py の CATEGORY_MAP と WORD_TO_CATEGORY を
frontend/public/vocab.json に書き出す。

語彙を追加・変更したあとに実行する：
  uv run scripts/build_vocab.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.vocab import CATEGORY_MAP, WORD_TO_CATEGORY

OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "public" / "vocab.json"

def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "categoryMap":    {cat: words for cat, words in CATEGORY_MAP.items()},
        "wordToCategory": WORD_TO_CATEGORY,
    }

    OUTPUT_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    total = sum(len(v) for v in CATEGORY_MAP.values())
    print(f"✓ {total}語 / {len(CATEGORY_MAP)}カテゴリ → {OUTPUT_PATH}")

if __name__ == "__main__":
    main()