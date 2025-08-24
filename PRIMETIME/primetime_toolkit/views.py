from flask import Blueprint, render_template, request, redirect, url_for, flash
from . import mail
from flask import current_app
from flask_mail import Mail, Message
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
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


#--------------------------------------------------------------------------
# Upload Excel spreadsheet

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'xls', 'xlsx'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@views.route('/upload-excel', methods=['POST'])
def upload_excel():
    if 'budget_file' not in request.files:
        flash("No file part", "error")
        return redirect(request.url)

    file = request.files['budget_file']
    if file.filename == '':
        flash("No selected file", "error")
        return redirect(request.url)

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True) 
        file.save(os.path.join(upload_folder, filename))
        flash("File uploaded successfully", "success")
        return redirect(url_for('views.budget'))

    flash("Invalid file format", "error")
    return redirect(request.url)


# ---------------------------------------------------------------------
# Subscribe to newsletter block 

@views.route('/subscribe', methods=['POST'])
def subscribe():
    if current_user.is_authenticated:
        email = getattr(current_user, 'email', None)
        name = getattr(current_user, 'name', 'there')
    else:
        email = request.form.get('email')
        name = 'there'

    if not email:
        flash("No email address provided.", "error")
        return redirect(url_for('views.home'))

    msg = Message("Welcome to Bec Wilson's Newsletter!",
                  sender='ka.gremer@gmail.com',
                  recipients=[email])
    msg.body = (
        f"Hi {name},\n\nThanks for subscribing to Bec Wilson's Newsletter! "
        "You will now receive updates on new events, webinars and information about Bec's recently published work.\n\n"
        "Kind regards,\nThe Prime Time Customer Service"
    )

    try:
        mail.send(msg)
        flash(f"Hooray! {email} has been subscribed to our Newsletter!", "success")
    except Exception as e:
        flash(f"Subscription failed: {str(e)}", "error")

    return redirect(url_for('views.home'))


#--------------------------------------------------------
# start of submit assignment block

@views.route('/submit-assessment', methods=['POST'])
def submit_assessment():
    """Process 20 Likert questions (1–5 each), produce 0–100 total,
    and classify as Beginner / Progressing / Confident."""
    TOTAL_QUESTIONS = 20

    total_score = 0
    for i in range(1, TOTAL_QUESTIONS + 1):
        answer = request.form.get(f'q{i}')
        if answer:
            try:
                total_score += int(answer)
            except ValueError:
                pass

    # Map total_score (0–100) to bands
    if total_score <= 39:
        band = "Inactive"
    elif total_score <= 69:
        band = "Reactive"
    else:
        band = "Proactive"

    result_message = f"You are classified as {band}."

    return render_template(
        'summary.html',
        result_message=result_message,
        band=band,
        total_score=total_score,
    )

#-------------------------------------------


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


#---------------------------------------------
# send email block

@views.route('/send-email', methods=['POST'])
@login_required
def send_email():
    user_email = getattr(current_user, 'email', None)
    user_name = getattr(current_user, 'name', 'there')

    if not user_email:
        flash("No email address found for the current user.", "error")
        return redirect(url_for('views.home'))

    msg = Message('Your PDF summary is ready! - PrimeTime Toolkit',
                  sender='ka.gremer@gmail.com',
                  recipients=[user_email])
    msg.body = (
        f"Hi {user_name}!\n\nThis is an automated email. "
        "We are currently working on the process of generating automatic PDF summaries to be sent over email.\n\n"
        "Warm regards,\nThe Prime Time Customer Service"
    )

    try:
        mail.send(msg)
        flash(f"Email sent to {user_email}!", "success")
    except Exception as e:
        flash(f"Failed to send email: {str(e)}", "error")

    return redirect(url_for('views.home'))


#---------------------------------------------------


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