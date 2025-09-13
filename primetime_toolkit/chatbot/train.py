# primetime_toolkit/chatbot/train.py
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import random
import json
import pickle
import numpy as np
import nltk
from nltk.stem import WordNetLemmatizer
from keras.models import Sequential
from keras.layers import Dense, Dropout
from keras.optimizers import SGD

# Delete old training files before retraining
base_dir = os.path.dirname(__file__)

def train_chatbot():
    # Download necessary NLTK resources
    nltk.download('omw-1.4')
    nltk.download('punkt')
    nltk.download('punkt_tab')
    nltk.download('wordnet')

    # Prepare data containers
    vocab, tags, samples = [], [], []
    skip_tokens = ["?", "!"]

    # Load intent definitions
    with open(os.path.join(base_dir, "intents.json"), "r") as f:
        intent_data = json.load(f)

    # Tokenize and collect patterns
    for entry in intent_data["intents"]:
        for example in entry["patterns"]:
            tokens = nltk.word_tokenize(example)
            vocab.extend(tokens)
            samples.append((tokens, entry["tag"]))
            if entry["tag"] not in tags:
                tags.append(entry["tag"])

    # Lemmatize and sort vocabulary
    lemmatizer = WordNetLemmatizer()
    vocab = sorted(set(lemmatizer.lemmatize(token.lower()) for token in vocab if token not in skip_tokens))
    tags = sorted(set(tags))

    print(f"Sample count: {len(samples)}")
    print(f"Tag count: {len(tags)} - {tags}")
    print(f"Vocabulary size: {len(vocab)} - {vocab}")

    # Save processed vocabulary and tags
    with open(os.path.join(base_dir, "words.pkl"), "wb") as f:
        pickle.dump(vocab, f)
    with open(os.path.join(base_dir, "classes.pkl"), "wb") as f:
        pickle.dump(tags, f)

    # Prepare training data
    training_set = []
    empty_output = [0] * len(tags)
    for tokens, tag in samples:
        bag = [1 if word in [lemmatizer.lemmatize(t.lower()) for t in tokens] else 0 for word in vocab]
        output_row = empty_output[:]
        output_row[tags.index(tag)] = 1
        training_set.append([bag, output_row])

    random.shuffle(training_set)
    train_x = [item[0] for item in training_set]
    train_y = [item[1] for item in training_set]
    print("Training arrays prepared.")

    # Build neural network
    net = Sequential()
    net.add(Dense(128, input_shape=(len(train_x[0]),), activation="relu"))
    net.add(Dropout(0.5))
    net.add(Dense(64, activation="relu"))
    net.add(Dropout(0.5))
    net.add(Dense(len(train_y[0]), activation="softmax"))
    net.summary()

    # Compile and train
    optimizer = SGD(learning_rate=0.01, momentum=0.9, nesterov=True)
    net.compile(loss="categorical_crossentropy", optimizer=optimizer, metrics=["accuracy"])
    history = net.fit(np.array(train_x), np.array(train_y), epochs=200, batch_size=5, verbose=1)
    net.save(os.path.join(base_dir, "chatbot_model.h5"), history)
    print("Chatbot model trained and saved.")

if __name__ == "__main__":
    # Delete old training files before retraining
    base_dir = os.path.dirname(__file__)
    files_to_remove = [
        os.path.join(base_dir, "chatbot_model.h5"),
        os.path.join(base_dir, "words.pkl"),
        os.path.join(base_dir, "classes.pkl"),
    ]
    for f in files_to_remove:
        if os.path.exists(f):
            os.remove(f)
            print(f"Deleted old file: {f}")

    train_chatbot()
