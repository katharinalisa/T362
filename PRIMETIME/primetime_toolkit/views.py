from flask import Blueprint, render_template

views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('index.html')

@views.route('/budget')
def budget():
    return render_template('budget.html')


@views.route('/self-assessment')
def assessment():
    return render_template('assessment.html')


@views.route('/summary-page')
def summary():
    return render_template('summary-page.html')