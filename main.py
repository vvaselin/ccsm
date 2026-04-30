import random
import re
from gensim.models import KeyedVectors
import MeCab
import unidic_lite
import os

# --- 初期化 ---
wv = KeyedVectors.load("model/small.kv")

dicdir = os.path.abspath(unidic_lite.DICDIR)

tagger = MeCab.Tagger(
    f'-r nul -d "{dicdir}"'
)

# --- フィルタ ---
def is_clean_noun(word):
    if re.search(r'[\[\]()/]', word):
        return False

    if re.search(r'\d', word):
        return False
    
    if re.search(r'[A-Za-z]', word):
        return False
    
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

# --- 事前にフィルタ済み語彙を作る（超重要） ---
print("filtering vocabulary...")
filtered_words = [w for w in wv.index_to_key if is_clean_noun(w)]
print(f"filtered vocab size: {len(filtered_words)}")

# --- ランダム抽出 ---
def get_random_words(n=5):
    if len(filtered_words) < n:
        return filtered_words
    return random.sample(filtered_words, n)


# --- 意味的に離れた単語 ---
def get_far_words(n=5, threshold=0.2):
    result = []

    while len(result) < n:
        w = random.choice(filtered_words)

        if all(wv.similarity(w, r) < threshold for r in result):
            result.append(w)

    return result


# --- 実行 ---
print(get_random_words())
print(get_far_words())