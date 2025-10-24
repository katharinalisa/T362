import os
from .extension import db, mail, login_manager, limiter, migrate
from datetime import timedelta
from flask_login import current_user
from flask import Flask, Blueprint, render_template, request, redirect, url_for, flash, session



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
    migrate.init_app(app, db)


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



    @app.after_request
    def set_security_headers(response):
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://code.jquery.com https://www.youtube.com; "
            "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; "
            "img-src 'self' data: https://i.ytimg.com; "
            "img-src 'self' data:; "
            "font-src 'self' https://cdn.jsdelivr.net; "
            "connect-src 'self' https://cdn.jsdelivr.net;"
        )

        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=()'
        return response


    @app.before_request
    def require_2fa():
        if current_user.is_authenticated and current_user.two_factor_secret:
            if not session.get('2fa_verified') and request.endpoint not in ['auth.verify_2fa', 'static']:
                return redirect(url_for('auth.verify_2fa'))



    @app.before_request
    def enforce_2fa():
        if current_user.is_authenticated and current_user.two_factor_secret:
            if not session.get('2fa_verified'):
                allowed_endpoints = [
                    'auth.verify_2fa',
                    'auth.skip_2fa',
                    'static',
                    'auth.logout',
                    'auth.verify_2fa',
                ]
                if request.endpoint not in allowed_endpoints:
                    return redirect(url_for('auth.verify_2fa'))


   
    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(error):
        return render_template('errors/500.html'), 500

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return render_template('errors/429.html'), 429


    return app
