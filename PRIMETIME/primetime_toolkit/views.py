from flask import Blueprint, render_template, request, redirect, url_for, flash
#from .models import Assessment
from . import db
import os
import json

views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('home.html')

@views.route('/budget')
def budget():
    return render_template('budget.html')

@views.route('/superannuation')
def superannuation():
    return render_template('superannuation.html')

# Learning Hub
@views.route('/learning-hub')
def learninghub():
    return render_template('learninghub.html')

@views.route('/learning-hub/workshops')
def workshops():
    return render_template('learning_hub/workshops.html')

@views.route('/learning-hub/webinars')
def webinars():
    return render_template('learning_hub/webinars.html')

@views.route('/assessment' , methods=['GET'])
def assessment():
    return render_template('assessment.html')

@views.route("/eligibility-setup")
def eligibility_setup():
    return render_template("eligibility_setup.html")

#---------------------------
# start of one block
@views.route('/submit-assessment', methods=['POST'])
def submit_assessment():
    """Process 20 Likert questions (1–5 each), produce 0–100 total,
    and classify as Beginner / Progressing / Confident."""
    TOTAL_QUESTIONS = 20  # set to 7 if only 7 questions are on the page for now

    total_score = 0
    for i in range(1, TOTAL_QUESTIONS + 1):
        answer = request.form.get(f'q{i}')
        if answer:
            try:
                total_score += int(answer)
            except ValueError:
                # ignore bad input
                pass

    # Map total_score (0–100) to bands
    if total_score <= 39:
        band = "Beginner"
    elif total_score <= 69:
        band = "Progressing"
    else:
        band = "Confident"

    result_message = f"You are classified as {band}."

    return render_template(
        'summary.html',
        result_message=result_message,
        band=band,
        total_score=total_score,
    )

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




@views.route('/expenses')
def expenses():
    return render_template('diagnostic/expenses.html')

@views.route('/income')
def income():
    return render_template('diagnostic/income.html')

@views.route('/assets')
def assets():
    return render_template('diagnostic/assets.html')

@views.route('/liabilities')
def liabilities():
    return render_template('diagnostic/liabilities.html')