"""
単語選択ロジック

- prevの安全性チェック
- most_similar / similar_by_vector による候補収集
- エイリアス解決
- 重複回避（_used_words）
"""

import random
import re


_used_words: set[str] = set()
_USED_WORDS_MAX = 200


def _is_safe_prev(prev: str | None) -> bool:
    """prevが日本語の正常な単語かチェック"""
    if not prev:
        return False
    if re.search(r'[A-Za-z0-9\[\]()/]', prev):
        return False
    if re.search(r'[^\u3000-\u9fff\uff00-\uffef]', prev):
        return False
    if len(prev) > 10:
        return False
    return True


def _pick_unused(candidates: list[str]) -> str | None:
    """未使用の単語をcandidatesからランダムに選ぶ"""
    unused = [w for w in candidates if w not in _used_words]
    return random.choice(unused) if unused else None


def pick_next(
    wv,
    prev: str | None,
    wv_vocab: set[str],
    filtered_words: list[str],
    filtered_words_set: set[str],
    alias_map: dict[str, str],
) -> str:
    """
    prevをもとに次の単語を選んで返す。
    使用済み単語は避け、200語たまったらリセット。
    """
    global _used_words

    if len(_used_words) >= _USED_WORDS_MAX:
        _used_words = set()

    if not _is_safe_prev(prev):
        result = _pick_unused(filtered_words) or random.choice(filtered_words)
        _used_words.add(result)
        return result

    try:
        if prev in wv_vocab:
            raw_candidates = wv.most_similar(prev, topn=200)
        else:
            vec = wv.get_vector(prev, norm=True)
            raw_candidates = wv.similar_by_vector(vec, topn=200)

        seen: set[str] = set()
        resolved: list[str] = []
        for w, score in raw_candidates:
            if not (0.05 < score < 0.4):
                continue
            target = alias_map.get(w, w)
            if target in filtered_words_set and target not in seen:
                resolved.append(target)
                seen.add(target)

        result = (
            _pick_unused(resolved)
            or _pick_unused(filtered_words)
            or random.choice(filtered_words)
        )

    except Exception:
        result = _pick_unused(filtered_words) or random.choice(filtered_words)

    _used_words.add(result)
    return result