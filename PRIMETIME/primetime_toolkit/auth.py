from flask import Blueprint, render_template, request, redirect, url_for, flash

auth = Blueprint('auth', __name__)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Handle login logic here
        email = request.form['email']
        password = request.form['password']
        # Normally you'd check credentials here
        flash('Logged in successfully!', 'success')
        return redirect(url_for('views.home'))
    return render_template('login.html')

@auth.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        # Handle registration logic here
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        # Normally you'd save the user here
        flash('Account created successfully!', 'success')
        return redirect(url_for('auth.login'))
    return render_template('register.html')
