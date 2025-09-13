from primetime_toolkit import create_app, db
from primetime_toolkit.models import Assessment,User
from primetime_toolkit.chatbot import chatbot_bp


app = create_app()

with app.app_context():
    db.create_all()
    print("Database created!")