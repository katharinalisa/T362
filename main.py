import os
from primetime_toolkit.chatbot.train import train_chatbot

model_path = os.path.join(os.path.dirname(__file__), "primetime_toolkit", "chatbot", "chatbot_model.h5")
words_path = os.path.join(os.path.dirname(__file__), "primetime_toolkit", "chatbot", "words.pkl")
classes_path = os.path.join(os.path.dirname(__file__), "primetime_toolkit", "chatbot", "classes.pkl")

if not all(os.path.exists(p) for p in [model_path, words_path, classes_path]):
    print("Chatbot files missing. Training chatbot model...")
    train_chatbot()
else:
    print("Chatbot files found. Skipping training.")

from primetime_toolkit import create_app
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)