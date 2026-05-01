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


def _parse_single_node(word: str, tagger):
    """単語をMeCabで解析し、1トークンに分割された場合のみそのfeatureを返す。
    複数トークンに分割された場合（=辞書にない複合語など）はNoneを返す。"""
    nodes = []
    node = tagger.parseToNode(word)
    while node:
        if node.surface:  # BOS/EOSノードを除く
            nodes.append(node)
        node = node.next
    if len(nodes) != 1:
        return None
    return nodes[0].feature.split(",")


def is_soft_noun(word: str, tagger) -> bool:
    """認知シャッフル用の「ゆるい名詞」判定（unidic_lite対応）"""

    if len(word) <= 1 or len(word) > 8:
        return False

    if not _VALID_JP.match(word):
        return False

    if word in BLACKLIST:
        return False

    # カタカナのみの単語は長さで制限（ユーロクリニーク等を除外）
    if _KATAKANA_ONLY.match(word) and len(word) > _MAX_KATAKANA_LEN:
        return False

    # 複数トークンに分割された単語は辞書未登録の複合語なので弾く
    # 例：「日本経済新聞社」→「日本」「経済」「新聞」「社」に分割
    features = _parse_single_node(word, tagger)
    if features is None:
        return False

    # unidic_lite features:
    #   [0]=品詞, [1]=品詞細分類1, [2]=品詞細分類2, [3]=品詞細分類3
    if features[0] != "名詞":
        return False

    # 副詞可能（故・直ち等）は文脈によって副詞になる＝イメージしにくい
    if len(features) > 2 and features[2] == "副詞可能":
        return False

    # 固有名詞・数・接尾・非自立を除外
    if any(f in _NOUN_BLACKLIST_SUBTYPES for f in features[1:4]):
        return False

    return True


# 具体的な動作をイメージしにくい機能動詞
_VERB_BLACKLIST = {
    "する", "なる", "できる", "ある", "いる", "もつ", "おく",
    "くる", "いく", "もらう", "あげる", "くれる", "おもう",
    "いう", "みる", "きく", "しる", "わかる", "つける",
}


def is_imageable_verb(word: str, tagger) -> bool:
    """具体的な動作動詞かどうかを判定（unidic_lite対応、終止形のみ）"""

    if len(word) <= 1 or len(word) > 6:
        return False

    if not _VALID_JP.match(word):
        return False

    if word in _VERB_BLACKLIST:
        return False

    # unidic_lite features:
    #   [0]=品詞, [1]=品詞細分類1, [4]=活用型, [5]=活用形
    features = _parse_single_node(word, tagger)
    if features is None:
        return False

    if features[0] != "動詞":
        return False

    # unidic_liteでは features[1]=="一般" が自立動詞
    if len(features) > 1 and features[1] != "一般":
        return False

    # 終止形-一般 = 基本形（辞書形）
    if len(features) > 5 and features[5] == "終止形-一般":
        return True

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