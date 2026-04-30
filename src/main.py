from fastapi import FastAPI
from src.model import load_model, create_tagger
from src.filter import build_filtered_words
from src.sampler import get_random_words, get_far_words

app = FastAPI()
def main():
    print("loading model...")
    wv = load_model()

    print("initializing MeCab...")
    tagger = create_tagger()

    print("filtering vocabulary...")
    filtered_words = build_filtered_words(wv, tagger)
    print(f"filtered vocab size: {len(filtered_words)}")

    print(get_random_words(filtered_words))
    print(get_far_words(wv, filtered_words))


if __name__ == "__main__":
    main()