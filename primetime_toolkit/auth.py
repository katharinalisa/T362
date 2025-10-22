from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from werkzeug.security import check_password_hash
from . import db
from .models import User
from flask_login import login_user, current_user, logout_user
from email_validator import validate_email, EmailNotValidError
from .forms import RegisterForm
from .extension import limiter



auth = Blueprint('auth', __name__)

@auth.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
   
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.pword, password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('views.home'))
        else:
            flash('Invalid credentials', 'danger')

    return render_template('login.html')




@auth.route('/register', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        name = form.name.data.strip()
        password = form.password.data

        try:
            valid = validate_email(email)
            email = valid.email
        except EmailNotValidError:
            flash('Invalid email format.', 'error')
            return redirect(url_for('auth.register'))

        
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Email already registered!', 'error')
            return redirect(url_for('auth.register'))

        new_user = User(name=name, email=email, password=password)
        try:
            db.session.add(new_user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            flash('Something went wrong. Please try again.', 'error')
            return redirect(url_for('auth.register'))

        flash('Account created successfully!','success')
        return redirect(url_for('auth.login'))
    return render_template('register.html', form=form)



@auth.route('/profile')
def profile():
    return render_template('profile.html', user=current_user)

@auth.route('/logout')
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('views.home'))
