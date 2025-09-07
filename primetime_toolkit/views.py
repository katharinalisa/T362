from flask import Blueprint, render_template, request, redirect, url_for, flash
from . import mail
from flask import current_app
from flask_mail import Mail, Message
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
import json
from primetime_toolkit.models import db, Subscriber


views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('home.html')

@views.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

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
        return redirect(url_for('views.dashboard'))

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
    
    if not Subscriber.query.filter_by(email=email).first():
        new_subscriber = Subscriber(email=email, name=name)
        db.session.add(new_subscriber)
        db.session.commit()

    msg = Message(
        "Welcome to Bec Wilson's Newsletter!",
        sender='ka.gremer@gmail.com',
        recipients=[email]
    )

    # Plain text fallback
    msg.body = (
        f"Hi {name},\n\n"
        "Thanks for subscribing to Bec Wilson's Newsletter!\n"
        "You'll receive updates on new events, webinars, and information about Bec's work.\n\n"
        "Explore more:\n"
        "Learning Hub: https://yourdomain.com/learning-hub\n"
        "Prime Time Toolkit: https://yourdomain.com/\n\n"
        "Best regards,\nThe Prime Time Toolkit Service"
    )

    # HTML version
    msg.html = f"""
    <div style="font-family:'Poppins',Arial,sans-serif; background:#f7fafc; padding:32px;">
      <h2 style="color:#1a7f8c;">Welcome to Bec Wilson's Newsletter!</h2>
      <p>Hi {name},</p>
      <p>
        <strong>Thank you for subscribing!</strong> We're excited to have you join our community of Australians planning smarter for retirement.
      </p>
      <ul style="margin:18px 0 18px 0; padding-left:18px;">
        <li>Get updates on new events, webinars, and exclusive articles.</li>
        <li>Receive practical tips and tools for your financial journey.</li>
        <li>Be the first to know about new releases from Bec Wilson.</li>
      </ul>
      <p>
        <a href="https://yourdomain.com/learning-hub" style="color:#1a7f8c; text-decoration:underline;">Visit the Learning Hub</a> for articles, podcasts, and more.<br>
        <a href="https://yourdomain.com/" style="color:#1a7f8c; text-decoration:underline;">Explore the Prime Time Toolkit</a> to get started.
      </p>
      <hr style="margin:24px 0;">
      <p style="color:#555;">Warm regards,<br>
      The Prime Time Toolkit Service</p>
    </div>
    """

    try:
        mail.send(msg)
        flash(f"Hooray! {email} has been subscribed to our Newsletter!", "success")
    except Exception as e:
        flash(f"Subscription failed: {str(e)}", "error")

    return redirect(url_for('views.home'))


#--------------------------------------------------------
# submit self assessment block

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
def send_email():
    user_email = request.form.get('email')
    user_name = getattr(current_user, 'name', 'there')

    msg = Message(
        'You have received our Excel spreadsheet! - PrimeTime Toolkit',
        sender='ka.gremer@gmail.com',
        recipients=[user_email]
    )
    msg.body = (
        f"Hi {user_name}!\n\n"
        "Thank you for using our service! Please find attached our Prime Time Toolkit spreadsheet.\n\n"
        "Best regards,\nThe Prime Time Toolkit Service"
    )

    # Path to the spreadsheet file
    file_path = os.path.join(
        current_app.root_path,
        'static',
        'files',
        'Prime_Time_Big_Financial_Picture_T362_QUT.xlsx'
    )

    try:
        with open(file_path, 'rb') as fp:
            msg.attach(
                "Prime_Time_Big_Financial_Picture_T362_QUT.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fp.read()
            )
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

@views.route('/life')
def life():
    return render_template('diagnostic/life_expectancy.html')

@views.route('/future_budget')
def future_budget():
    return render_template('diagnostic/future_budget.html')

@views.route('/calculator')                
def calculator():                           
    return render_template('diagnostic/calculator.html')


@views.route('/epic')                  
def epic():
    return render_template('diagnostic/epic.html')
