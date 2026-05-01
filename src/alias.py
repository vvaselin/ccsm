"""
エイリアスマップの構築・キャッシュ管理

- fastText未収録語をサブワードベクトルで自動マッピング
- 手動エイリアス（MANUAL_ALIAS）と自動エイリアスをマージ
- 結果をJSONキャッシュに保存し、再起動時の再計算を省略
"""

import json
import hashlib
from pathlib import Path

CACHE_PATH = Path("cache/vocab_cache.json")


def _whitelist_hash(whitelist: set[str], manual: dict) -> str:
    wl_str = ",".join(sorted(whitelist))
    alias_str = ",".join(f"{k}:{v}" for k, v in sorted(manual.items()))
    return hashlib.md5((wl_str + alias_str).encode()).hexdigest()


def _build_auto_alias(
    wv,
    missing_words: list[str],
    filtered_words_set: set[str],
) -> dict[str, str]:
    """fastTextのサブワードベクトルで未収録語をマッピング"""
    alias: dict[str, str] = {}
    for word in missing_words:
        try:
            vec = wv.get_vector(word, norm=True)
            for neighbor, score in wv.similar_by_vector(vec, topn=50):
                if score < 0.3:
                    break
                if neighbor in filtered_words_set:
                    alias[word] = neighbor
                    break
        except Exception:
            pass
    return alias


def load_or_build(
    wv,
    whitelist: set[str],
    manual_alias: dict[str, str],
) -> tuple[list[str], dict[str, str]]:
    """
    filtered_words と alias_map を返す。
    キャッシュが有効なら読み込み、無効なら再構築して保存。
    """
    wv_vocab = set(wv.index_to_key)
    filtered_words = [w for w in whitelist if w in wv_vocab]
    filtered_words_set = set(filtered_words)

    all_missing = [
        w for w in (whitelist | set(manual_alias.keys()))
        if w not in wv_vocab
    ]
    current_hash = _whitelist_hash(whitelist, manual_alias)

    # キャッシュ読み込み試行
    if CACHE_PATH.exists():
        try:
            cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if cache.get("hash") == current_hash:
                auto_alias = cache["auto_alias"]
                merged = {**auto_alias, **manual_alias}
                print(f"  キャッシュ読み込み済み（自動: {len(auto_alias)}語 / 手動: {len(manual_alias)}語）")
                return filtered_words, merged
            print("  語彙変更を検知 → キャッシュ再構築")
        except Exception as e:
            print(f"  キャッシュ読み込み失敗: {e} → 再構築")

    # 自動エイリアス構築
    auto_missing = [w for w in all_missing if w not in manual_alias]
    print(f"  自動エイリアス構築中（{len(auto_missing)}語）...")
    auto_alias = _build_auto_alias(wv, auto_missing, filtered_words_set)

    # キャッシュ保存
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps(
            {"hash": current_hash, "auto_alias": auto_alias},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"  自動エイリアス: {len(auto_alias)}語マッピング済み")
    for src, dst in list(auto_alias.items())[:5]:
        print(f"    {src} → {dst}")

    merged = {**auto_alias, **manual_alias}
    print(f"  手動エイリアス: {len(manual_alias)}語 / 合計: {len(merged)}語")
    return filtered_words, merged