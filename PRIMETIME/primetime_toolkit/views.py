from flask import Blueprint, render_template, request, redirect, url_for, flash
#from .models import Assessment
from . import db
import os
import json

views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('index.html')

@views.route('/budget')
def budget():
    return render_template('budget.html')


@views.route('/assessment' , methods=['GET'])
def assessment():
    return render_template('assessment.html')


@views.route('/submit-assessment', methods=['POST'])
def submit_assessment():
    total_score = 0
    answered = 0

    for i in range(1, 21):  # or 7 if we’re only using 7 now
        answer = request.form.get(f'q{i}')
        if answer:
            total_score += int(answer)
            answered += 1

    if answered == 0:
        result_message = "No responses were submitted."
    else:
        average = total_score / answered
        if average >= 4:
            result_message = "You are classified as Proactive."
        elif average >= 2.5:
            result_message = "You are classified as Reactive."
        else:
            result_message = "You are classified as Inactive."

    return render_template("summary.html", result_message=result_message)

    # # This creates a new row in the Assessments table for a new user
    # new_response = Assessment(
    #     q1=q1,
    #     q2=q2,
    #     q3=q3,
    #     q4=q4,
    #     q5=q5,
    #     q6=q6,
    #     q7=q7
    # )

    # Adding new changes to database
    # db.session.add(new_response)
    # db.session.commit()

    #After user submits the form, he will be redirected to views.py
    return redirect(url_for('views.summary'))

@views.route('/summary-page')
def summary():
    return "Form submitted!"

@views.route('/tracker')
def tracker():
    return render_template('diagnostic/tracker.html')

@views.route('/submit-tracker', methods=["POST"])
def submit_tracker():
    data = {
        "year": request.form.get("year"),
        "month": request.form.get("month"),
        "total_assets": request.form.get("total_assets"),
        "total_liabilities": request.form.get("total_liabilities"),
        "net_worth": request.form.get("net_worth"),
        "notes": request.form.get("notes")
    }

    save_path = os.path.join("primetime_toolkit", "data")
    os.makedirs(save_path, exist_ok=True)

    filename = f"{data['month']}_{data['year']}.json"
    with open(os.path.join(save_path, filename), "w") as f:
        json.dump(data, f, indent=2)

    flash("Net Worth Tracker saved successfully!", "success")
    return redirect(url_for("views.tracker"))
