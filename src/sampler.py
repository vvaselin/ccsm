import random

def get_random_words(words, n=5):
    if len(words) < n:
        return words
    return random.sample(words, n)

def get_far_words(wv, words, n=5, threshold=0.2):
    result = []
    while len(result) < n:
        w = random.choice(words)

        if all(wv.similarity(w, r) < threshold for r in result):
            result.append(w)
    return result