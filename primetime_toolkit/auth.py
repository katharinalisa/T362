from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from werkzeug.security import check_password_hash
from . import db
from .models import User
from flask_login import login_user, current_user, logout_user, login_required
from email_validator import validate_email, EmailNotValidError
from .forms import RegisterForm
from .extension import limiter, mail
from werkzeug.security import generate_password_hash
import pyotp
import qrcode
import io
import base64
from flask_mail import Message
from .utils import generate_email_otp



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

        hashed_password = generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)
        new_user = User(name=name, email=email, pword=hashed_password)

        try:
            db.session.add(new_user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Registration failed: {e}") 
            flash('Something went wrong. Please try again.', 'error')
            return redirect(url_for('auth.register'))


        secret = pyotp.random_base32()
        new_user.two_factor_secret = secret
        db.session.commit()

        otp_uri = pyotp.TOTP(secret).provisioning_uri(
            name=new_user.email, issuer_name="PrimeTime Toolkit"
        )

        img = qrcode.make(otp_uri)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')


        flash('Account created successfully!','success')
        return render_template('verify_2fa.html', qr_code=img_b64)
    return render_template('register.html', form=form)




#---------------------------------------
#------------ TWO FACTOR ---------------
#---------------------------------------


#---------- HELPER FUNCTION ------------


def send_email_otp(user):
    otp = generate_email_otp()
    session['email_otp'] = otp

    msg = Message("Your PrimeTime Two-Factor Authentication Code",
                  sender="support@primetimetoolkit.com.au",
                  recipients=[user.email])
    msg.body = f"Your verification code is: {otp}"

    try:
        mail.send(msg)
        print("Email sent successfully.")
        flash('A verification code has been sent to your email.', 'info')
    except Exception as e:
        print(f"Email failed to send: {e}")
        flash('Failed to send email. Please try again later.', 'danger')





@auth.route('/verify-2fa', methods=['GET', 'POST'])
@login_required
def verify_2fa():
    user = current_user
    method = request.args.get('method', 'qr') 

    if method == 'qr':
        if not user.two_factor_secret:
            secret = pyotp.random_base32()
            user.two_factor_secret = secret
            db.session.commit()

        otp_uri = pyotp.TOTP(user.two_factor_secret).provisioning_uri(
            name=user.email, issuer_name="PrimeTime Toolkit"
        )
        img = qrcode.make(otp_uri)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

        if request.method == 'POST':
            code = request.form['code']
            totp = pyotp.TOTP(user.two_factor_secret)
            if totp.verify(code):
                session['2fa_verified'] = True
                flash('Two-Factor Authentication successful!', 'success')
                return redirect(url_for('views.home'))
            else:
                flash('Invalid code. Please try again.', 'danger')

        return render_template('verify_2fa.html', method='qr', qr_code=img_b64)

    elif method == 'email':
        if request.method == 'GET':
            if 'email_otp' not in session:
                send_email_otp(user)


        if request.method == 'POST':
            code = request.form['code']
            if code == session.get('email_otp'):
                session['2fa_verified'] = True
                flash('Email verification successful!', 'success')
                return redirect(url_for('views.home'))
            else:
                flash('Invalid code. Please try again.', 'danger')

        return render_template('verify_2fa.html', method='email')



@auth.route('/resend-email-otp')
@login_required
def resend_email_otp():
    send_email_otp(current_user)
    return redirect(url_for('auth.verify_2fa', method='email'))



# -------- OTHER ---------

@auth.route('/profile')
def profile():
    return render_template('profile.html', user=current_user)



@auth.route('/logout')
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('views.home'))
