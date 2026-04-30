import re


def is_clean_noun(word, tagger):
    # 記号
    if re.search(r'[\[\]()/]', word):
        return False

    # 数字
    if re.search(r'\d', word):
        return False

    # 英字
    if re.search(r'[A-Za-z]', word):
        return False

    # 長さ
    if len(word) <= 1:
        return False

    node = tagger.parseToNode(word)

    while node:
        features = node.feature.split(",")

        if features[0] == "名詞":
            if "普通名詞" in features:
                return True

        node = node.next

    return False


def build_filtered_words(wv, tagger):
    return [w for w in wv.index_to_key if is_clean_noun(w, tagger)]