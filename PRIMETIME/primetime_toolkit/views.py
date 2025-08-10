from flask import Blueprint, render_template, request, redirect, url_for
from .models import Assessment
from . import db

views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('index.html')

@views.route('/budget')
def budget():
    return render_template('budget.html')


@views.route('/self-assessment' , methods=['GET'])
def assessment():
    return render_template('assessment.html')


@views.route('/submit-assessment', methods=['POST'])
def submit_assessment():
    # q1, q2... etc. are the responses (yes/no) of users
    q1 = int(request.form.get('q1'))
    q2 = int(request.form.get('q2'))
    q3 = int(request.form.get('q3'))
    q4 = int(request.form.get('q4'))
    q5 = int(request.form.get('q5'))
    q6 = int(request.form.get('q6'))
    q7 = int(request.form.get('q7'))

    # This creates a new row in the Assessments table for a new user
    new_response = Assessment(
        q1=q1,
        q2=q2,
        q3=q3,
        q4=q4,
        q5=q5,
        q6=q6,
        q7=q7
    )

    # Adding new changes to database
    db.session.add(new_response)
    db.session.commit()

    # Calculate the total score
    total_score = q1 + q2 + q3 + q4 + q5 + q6 + q7

    def get_result_description(score):
        # Determine the result based on the total score
        if score >= 30:
            return "Excellent"
        elif score >= 20:
            return "Good"
        elif total_score >= 10:
            return "Needs Improvement"
        else:
            return "Poor"

    result = get_result_description(total_score)

    return render_template('summary-page.html', score=total_score, result=result)


@views.route('/summary-page')
def summary():
    return render_template('summary-page.html')