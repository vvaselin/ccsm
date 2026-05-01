"""
単語選択ロジック（fastTextなし・マルチセッション対応版）

カテゴリグラフベースで次の単語を選ぶ。
  - 同カテゴリ内から選ぶ確率: SAME_CATEGORY_PROB
  - 直近 HISTORY_SIZE 語は除外
  - USED_MAX 語使ったらリセット
"""

import random
from src.vocab import CATEGORY_MAP, WORD_TO_CATEGORY
from src.session import SessionStore, SessionData

# --- 設定 ---
SAME_CATEGORY_PROB = 0.4

# 全語彙リスト（フォールバック用）
_all_words: list[str] = [w for words in CATEGORY_MAP.values() for w in words]
_category_names: list[str] = list(CATEGORY_MAP.keys())


def _pick(candidates: list[str], session: SessionData) -> str | None:
    """履歴・使用済みを避けてcandidatesからランダムに選ぶ"""
    # 直近履歴を優先的に除外、次に使用済みを除外
    not_recent = [w for w in candidates if not session.is_recent(w)]
    not_used   = [w for w in not_recent  if not session.is_used(w)]

    if not_used:
        return random.choice(not_used)
    if not_recent:
        return random.choice(not_recent)  # 使用済みでも履歴外なら許容
    return None


def _pick_from_category(cat: str, session: SessionData) -> str | None:
    return _pick(CATEGORY_MAP[cat], session)


def _pick_from_other_category(current_cat: str | None, session: SessionData) -> str | None:
    other_cats = [c for c in _category_names if c != current_cat]
    random.shuffle(other_cats)
    for cat in other_cats:
        w = _pick_from_category(cat, session)
        if w:
            return w
    return None


def pick_next(store: SessionStore, session_id: str, prev: str | None) -> str:
    """
    セッションごとに履歴を管理しながら次の単語を選ぶ。
    """
    session = store.get(session_id)
    result = None

    if prev is None:
        result = _pick(_all_words, session)
    else:
        current_cat = WORD_TO_CATEGORY.get(prev)

        if current_cat and random.random() < SAME_CATEGORY_PROB:
            result = _pick_from_category(current_cat, session)
            if not result:
                result = _pick_from_other_category(current_cat, session)
        else:
            result = _pick_from_other_category(current_cat, session)

    # 全部使い切ったらリセットして再選択
    if not result:
        session.used = set()
        result = _pick(_all_words, session) or random.choice(_all_words)

    session.add(result)
    store.save(session_id, session)
    return result