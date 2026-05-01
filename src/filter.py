import re

BLACKLIST = {
    "政治", "選挙", "戦争", "政府", "法律",
    "経済", "政策", "システム", "アルゴリズム",
    "殺人", "暴力", "犯罪", "死亡", "事件",
}

# ひらがな・カタカナ・漢字のみ
_VALID_JP = re.compile(r'^[\u3040-\u9fff\u30a0-\u30ff]+$')

# カタカナのみの単語（外来語・固有名詞が多い）
_KATAKANA_ONLY = re.compile(r'^[\u30a0-\u30ff]+$')

# MeCab の品詞詳細で弾くサブカテゴリ
_NOUN_BLACKLIST_SUBTYPES = {
    "固有名詞",   # 人名・地名・組織名など
    "数",         # 一・二・三…
    "接尾",       # ～さ、～み など単体では意味が弱い
    "非自立",     # こと・もの など機能語的名詞
}

# 許可するカタカナ語の最大文字数（長いほど固有名詞っぽい）
_MAX_KATAKANA_LEN = 5


def is_soft_noun(word: str, tagger) -> bool:
    """認知シャッフル用の「ゆるい名詞」判定"""

    if len(word) <= 1 or len(word) > 8:
        return False

    if not _VALID_JP.match(word):
        return False

    if word in BLACKLIST:
        return False

    # カタカナのみの単語は長さで制限（ユーロクリニーク等を除外）
    if _KATAKANA_ONLY.match(word) and len(word) > _MAX_KATAKANA_LEN:
        return False

    node = tagger.parseToNode(word)
    while node:
        features = node.feature.split(",")
        if features[0] == "名詞":
            # サブカテゴリが不適切なら弾く
            if any(f in _NOUN_BLACKLIST_SUBTYPES for f in features[1:]):
                node = node.next
                continue
            return True
        node = node.next

    return False


def is_valid_response_word(word: str) -> bool:
    """APIレスポンスとして返す前の最終チェック"""
    if not word:
        return False
    if not _VALID_JP.match(word):
        return False
    if len(word) <= 1 or len(word) > 10:
        return False
    if word in BLACKLIST:
        return False
    return True


def is_clean_noun(word, tagger):
    """より厳密な普通名詞チェック（必要に応じて）"""
    if re.search(r'[\[\]()/\dA-Za-z]', word):
        return False
    if len(word) <= 1:
        return False
    if not _VALID_JP.match(word):
        return False

    node = tagger.parseToNode(word)
    while node:
        features = node.feature.split(",")
        if features[0] == "名詞" and "普通名詞" in features:
            return True
        node = node.next

    return False


def is_japanese(word: str) -> bool:
    return bool(_VALID_JP.match(word))


def build_filtered_words(wv, tagger):
    return [w for w in wv.index_to_key if is_soft_noun(w, tagger)]