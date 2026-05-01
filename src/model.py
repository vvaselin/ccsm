from gensim.models.fasttext import load_facebook_model
import MeCab
import unidic_lite
import os


def load_model(path="model/cc.ja.300.bin"):
    model = load_facebook_model(path)
    return model.wv


def create_tagger():
    dicdir = os.path.abspath(unidic_lite.DICDIR)
    return MeCab.Tagger(f'-r nul -d "{dicdir}"')