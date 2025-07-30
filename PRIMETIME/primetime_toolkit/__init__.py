from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy() 

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'our-secret'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///primetime.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    from .auth import auth
    from .views import views

    app.register_blueprint(auth, url_prefix='/auth')
    app.register_blueprint(views, url_prefix='/')

    return app
