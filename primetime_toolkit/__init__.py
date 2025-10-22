import os
from flask import Flask
from .extension import db, mail, login_manager
from datetime import timedelta
from .extension import limiter



def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'our-secret'
    app.config['SESSION_COOKIE_HTTPONLY'] = True 
    app.config['SESSION_COOKIE_SECURE'] = True 
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///primetime.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'uploads')

    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = 'ka.gremer@gmail.com'
    app.config['MAIL_PASSWORD'] = 'ioof gbxq cali qgow'

    app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=7)
    login_manager.session_protection = "strong" 


    db.init_app(app)
    mail.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    limiter.init_app(app)


    from .models import User
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    from .auth import auth
    from .views import views
    from .chatbot.chatbot import chatbot_bp



    app.register_blueprint(auth, url_prefix='/auth')
    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(chatbot_bp, url_prefix='/chatbot')

    return app
