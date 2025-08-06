from flask import Blueprint, render_template, request, redirect, url_for, flash
from .models import Assessment
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


@views.route('/self-assessment' , methods=['GET'])
def assessment():
    return render_template('assessment.html')


@views.route('/submit-assessment', methods=['POST'])
def submit_assessment():
    # q1, q2... etc. are the responses (yes/no) of users
    q1 = request.form.get('q1')
    q2 = request.form.get('q2')
    q3 = request.form.get('q3')
    q4 = request.form.get('q4')
    q5 = request.form.get('q5')
    q6 = request.form.get('q6')
    q7 = request.form.get('q7')

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
