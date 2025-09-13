# primetime_toolkit/chatbot.py
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '1'
import random
import numpy as np
import pickle
import json
import nltk
from flask import Blueprint, request
from keras.models import load_model
from nltk.stem import WordNetLemmatizer


chatbot_bp = Blueprint('chatbot', __name__)

model = None
intents = None
words = None
classes = None

def load_chatbot_assets():
    global model, intents, words, classes
    if None in (model, intents, words, classes):
        base_dir = os.path.dirname(__file__)
        model = load_model(os.path.join(base_dir, "chatbot_model.h5"))
        with open(os.path.join(base_dir, "intents.json")) as f:
            intents = json.load(f)
        words = pickle.load(open(os.path.join(base_dir, "words.pkl"), "rb"))
        classes = pickle.load(open(os.path.join(base_dir, "classes.pkl"), "rb"))


lemmatizer = WordNetLemmatizer()

@chatbot_bp.route("/get", methods=["POST"])
def chatbot_response():
    load_chatbot_assets()

    msg = request.form["msg"]
    if msg.startswith('my name is'):
        name = msg[11:]
        ints = predict_class(msg, model)
        res1 = getResponse(ints, intents)
        res = res1.replace("{n}", name)
    elif msg.startswith('hi my name is'):
        name = msg[14:]
        ints = predict_class(msg, model)
        res1 = getResponse(ints, intents)
        res = res1.replace("{n}", name)
    else:
        ints = predict_class(msg, model)
        res = getResponse(ints, intents)
    return res


def clean_up_sentence(sentence):
    sentence_words = nltk.word_tokenize(sentence)
    sentence_words = [lemmatizer.lemmatize(word.lower()) for word in sentence_words]
    return sentence_words

def bow(sentence, words, show_details=True):
    sentence_words = clean_up_sentence(sentence)
    bag = [0] * len(words)
    for s in sentence_words:
        for i, w in enumerate(words):
            if w == s:
                bag[i] = 1
    return np.array(bag)

def predict_class(sentence, model):
    p = bow(sentence, words, show_details=False)
    res = model.predict(np.array([p]))[0]
    ERROR_THRESHOLD = 0.25
    results = [[i, r] for i, r in enumerate(res) if r > ERROR_THRESHOLD]
    results.sort(key=lambda x: x[1], reverse=True)
    return [{"intent": classes[r[0]], "probability": str(r[1])} for r in results]

def getResponse(ints, intents_json):
    tag = ints[0]["intent"]
    for i in intents_json["intents"]:
        if i["tag"] == tag:
            return random.choice(i["responses"])
