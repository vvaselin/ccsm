from gensim.models import KeyedVectors
import MeCab
import unidic_lite
import os


def load_model(path="model/small.kv"):
    return KeyedVectors.load(path)


def create_tagger():
    dicdir = os.path.abspath(unidic_lite.DICDIR)
    return MeCab.Tagger(f'-r nul -d "{dicdir}"')