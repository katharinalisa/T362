from flask import Blueprint, render_template, request, redirect, session, url_for, flash, jsonify
from . import mail
from flask import current_app
from flask_mail import Mail, Message
from flask_login import login_required, current_user
from datetime import datetime
from werkzeug.utils import secure_filename
import os
import json
from primetime_toolkit.models import Assessment, IncomeLayer, LifeExpectancy, SpendingAllocation, db, Subscriber, Asset, Liability, Income, Expense, Subscription, FutureBudget, EpicExperience, DebtPaydown, EnoughCalculator
from sqlalchemy import func, case
from .excel_parser import parse_excel
import math
from .extension import limiter

views = Blueprint('views', __name__)


@views.route('/')
def home():
    return render_template('home.html')


@views.route('/dashboard', methods=['GET'])
def dashboard():
    return render_template('dashboard.html') 


# -------- spreadsheet option ---------------------------

@views.route('/dashboard-spreadsheet', methods=['GET'])
def dashboard_spreadsheet():
    upload_folder = current_app.config['UPLOAD_FOLDER']
    data = {}
    if os.path.exists(upload_folder):
        files = [os.path.join(upload_folder, f) for f in os.listdir(upload_folder) if allowed_file(f)]
        if files:
            latest_file = max(files, key=os.path.getmtime)
            data = parse_excel(latest_file)

    epic_years = data.get("epic").get("years", 10)
    epic_items = data.get("epic").get("items", [])
    
    epic_annual = sum(
        float(e.get("value", 0.0)) * (
            1 if str(e.get("frequency", "")).lower() == "once only" else
            epic_years if str(e.get("frequency", "")).lower() == "every year" else
            math.floor(epic_years / 2)
        )
        for e in epic_items if isinstance(e, dict)
    ) / max(epic_years, 1)
   
    post_epic_surplus = data.get("monthly_savings", 0) - epic_annual

    return render_template('dashboard-spreadsheet.html', 
        net_worth = data.get("net_worth", 0),
        assets_total = data.get("assets", {}).get("total", 0),
        liabilities_total = data.get("liabilities", {}).get("total", 0),
        income_annual = data.get("income", {}).get("total", 0),
        income_breakdown = data.get("income", {}).get("breakdown", ""),
        subs_annual = data.get("subscriptions", {}).get("total", 0),
        subs_breakdown = data.get("subscriptions", {}).get("breakdown", ""),
        expenses_annual = data.get("expenses", {}).get("total", 0),
        expense_buckets_sum = data.get("expenses", {}).get("buckets_sum", 0),
        surplus_annual = data.get("monthly_savings", 0),
        epic_annual=epic_annual,
        post_epic_surplus=post_epic_surplus,
    )





# ------- Web calculator option --------------------

@views.route('/dashboard-web-calculator')
@login_required
def dashboard_web_calculator():
    print("Current User :", current_user)
    user_id = current_user.id
    summary = get_calculator_summary(user_id)
    epic_years = session.get("epic_years", 10)
    epic_items = EpicExperience.query.filter_by(user_id=user_id, include=True).all()

    epic_annual = sum(
        e.amount * (
            1 if e.frequency == 'Once only' else
            epic_years if e.frequency == 'Every year' else
            math.floor(epic_years / 2)
        )
        for e in epic_items
    ) / epic_years

    post_epic_surplus = summary["surplus_annual"] - epic_annual

    return render_template('dashboard-web-calculator.html',
        net_worth=summary["net_worth"],
        assets_total=summary["assets_total"],
        liabilities_total=summary["liabilities_total"],
        income_annual=summary["income_annual"],
        income_breakdown=summary["income_breakdown"],
        subs_annual=summary["subs_annual"],
        expense_buckets_sum=summary["expense_buckets_sum"],
        expenses_annual=summary["expenses_annual"],
        surplus_annual=summary["surplus_annual"],
        surplus_monthly=summary["surplus_monthly"],
        actual_breakdown=summary["actual_breakdown"],
        budget_targets=summary["budget_targets"],
        subs_breakdown=summary["subs_breakdown"],
        epic_annual=epic_annual,
        post_epic_surplus=post_epic_surplus,
    )


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


@views.route("/eligibility-setup")
def eligibility_setup():
    return render_template("eligibility_setup.html")


# -------- Assessment ----------------------

@views.route('/assessment_intro')
def assessment_intro():
    return render_template('selftest/assessment_intro.html')


@views.route('/assessment1', methods=['GET', 'POST'])
@login_required
def assessment1():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id) if assessment_id else None

    if request.method == 'POST':
        try:
            assessment = Assessment(
                user_id=current_user.id,
                submitted_at=datetime.utcnow(),
                purpose_q1=int(request.form['purpose_q1']),
                purpose_q2=int(request.form['purpose_q2']),
                purpose_q3=int(request.form['purpose_q3']),
                purpose_q4=int(request.form['purpose_q4']),
            )
            db.session.add(assessment)
            db.session.commit()
            session['assessment_id'] = assessment.id
            return redirect(url_for('views.assessment2'))
        except (KeyError, TypeError, ValueError):
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment1'))

    return render_template('selftest/assessment/assessment1.html', assessment=assessment)



@views.route('/assessment2', methods=['GET', 'POST'])
@login_required
def assessment2():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id)

    if not assessment:
        flash("Assessment not found. Please restart.")
        return redirect(url_for('views.assessment_intro'))

    if request.method == 'POST':
        required_fields = ['spending_q1', 'spending_q2', 'spending_q3', 'spending_q4']
        missing = [f for f in required_fields if not request.form.get(f)]

        if missing:
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment2')) 

        try:
            assessment.spending_q1 = int(request.form['spending_q1'])
            assessment.spending_q2 = int(request.form['spending_q2'])
            assessment.spending_q3 = int(request.form['spending_q3'])
            assessment.spending_q4 = int(request.form['spending_q4'])

            db.session.commit()
            return redirect(url_for('views.assessment3'))
        except ValueError:
            flash("Invalid input. Please use numbers only.")
            return redirect(url_for('views.assessment2'))

    return render_template('selftest/assessment/assessment2.html')



@views.route('/assessment3', methods=['GET', 'POST'])
@login_required
def assessment3():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id)

    if request.method == 'POST':
        try:
            assessment.saving_q1 = int(request.form['saving_q1'])
            assessment.saving_q2 = int(request.form['saving_q2'])
            assessment.saving_q3 = int(request.form['saving_q3'])
            assessment.saving_q4 = int(request.form['saving_q4'])

            db.session.commit()
            return redirect(url_for('views.assessment4'))
        except (KeyError, TypeError, ValueError):
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment3'))

    return render_template('selftest/assessment/assessment3.html')



@views.route('/assessment4', methods=['GET', 'POST'])
@login_required
def assessment4():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id)

    if request.method == 'POST':
        try:
            assessment.debt_q1 = int(request.form['debt_q1'])
            assessment.debt_q2 = int(request.form['debt_q2'])
            assessment.debt_q3 = int(request.form['debt_q3'])
            assessment.debt_q4 = int(request.form['debt_q4'])

            db.session.commit()
            return redirect(url_for('views.assessment5'))
        except (KeyError, TypeError, ValueError):
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment4'))

    return render_template('selftest/assessment/assessment4.html')



@views.route('/assessment5', methods=['GET', 'POST'])
@login_required
def assessment5():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id)

    if request.method == 'POST':
        try:
            assessment.super_q1 = int(request.form['super_q1'])
            assessment.super_q2 = int(request.form['super_q2'])
            assessment.super_q3 = int(request.form['super_q3'])
            assessment.super_q4 = int(request.form['super_q4'])

            db.session.commit()
            return redirect(url_for('views.assessment6'))
        except (KeyError, TypeError, ValueError):
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment5'))

    return render_template('selftest/assessment/assessment5.html')



@views.route('/assessment6', methods=['GET', 'POST'])
@login_required
def assessment6():
    assessment_id = session.get('assessment_id')
    assessment = Assessment.query.get(assessment_id)

    if request.method == 'POST':
        try:
            assessment.protection_q1 = int(request.form['protection_q1'])
            assessment.protection_q2 = int(request.form['protection_q2'])
            assessment.protection_q3 = int(request.form['protection_q3'])
            assessment.protection_q4 = int(request.form['protection_q4'])

            db.session.commit()
            return redirect(url_for('views.submit_assessment'))
        except (KeyError, TypeError, ValueError):
            flash("Please answer all questions before continuing.")
            return redirect(url_for('views.assessment6'))

    return render_template('selftest/assessment/assessment6.html')



#------------------------------
# submit self assessment block
#-----------------------------

@views.route('/submit-assessment', methods=['GET', 'POST'])
@login_required
@limiter.limit("3 per minute", key_func=lambda: current_user.id)
def submit_assessment():
    assessment = Assessment.query.filter_by(user_id=current_user.id).order_by(Assessment.submitted_at.desc()).first()

    if not assessment:
        flash("It seems that your last assessment was incomplete. Please redo the assessment to receive accurate results.")
        return redirect(url_for('views.assessment_intro'))

    # Define categories
    categories = ["purpose", "spending", "saving", "debt", "super", "protection"]
    question_keys = [f"{cat}_q{i}" for cat in categories for i in range(1, 5)]
    status_thresholds = {"strong": 75, "moderate": 40}

    # Collect and validate answers
    raw_answers = {}
    total_score = 0
    max_total = len(question_keys) * 5

    for key in question_keys:
        val = getattr(assessment, key)
        raw_answers[key] = val
        if val is not None:
            total_score += val

    missing_fields = [k for k in question_keys if raw_answers.get(k) is None]
    if missing_fields:
        flash(f"Missing answers for: {', '.join(missing_fields)}")
        return redirect(url_for('views.assessment_intro'))

    total_percent = round((total_score / max_total) * 100) if max_total > 0 else 0

    # Calculate category scores
    category_scores = {}
    for cat in categories:
        cat_keys = [f"{cat}_q{i}" for i in range(1, 5)]
        cat_sum = sum(getattr(assessment, key) or 0 for key in cat_keys)
        max_cat_total = len(cat_keys) * 5
        cat_percent = round((cat_sum / max_cat_total) * 100) if max_cat_total > 0 else 0
        category_scores[cat] = cat_percent

    if total_percent <= 50:
        band = "Inactive"
    elif total_percent <= 89:
        band = "Reactive"
    else:
        band = "Proactive"

    # Update assessment record
    assessment.total_score = total_percent
    assessment.result_message = band
    assessment.category_scores = category_scores
    db.session.commit()


    category_names = {
        "purpose": "Purpose & Direction",
        "spending": "Spending & Cashflow",
        "saving": "Saving & Emergency",
        "debt": "Debt & Financial Stress",
        "super": "Superannuation & Retirement Readiness",
        "protection": "Protecting & Preparing"
    }

    key_strengths = [
        category_names[cat] for cat in categories if category_scores.get(cat, 0) >= status_thresholds["strong"]
    ]
    key_weaknesses = [
        category_names[cat] for cat in categories if category_scores.get(cat, 0) < status_thresholds["moderate"]
    ]

    return render_template(
        'selftest/self-summary.html',
        result_message=band,
        band=band,
        total_score=total_percent,
        category_scores=category_scores,
        key_strengths=key_strengths,
        key_weaknesses=key_weaknesses,
        status_thresholds=status_thresholds
    )


#-----------------------------------------
# Upload Excel spreadsheet

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'xls', 'xlsx'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@views.route('/upload-excel', methods=['POST'])
@login_required
@limiter.limit("3 per minute", key_func=lambda: current_user.id)
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
        return redirect(url_for('views.dashboard_spreadsheet'))

    flash("Invalid file format", "error")
    return redirect(request.url)



@views.route('/download_budget')
def download_budget():
    from flask import send_from_directory
    file_path = os.path.join(current_app.root_path, 'static', 'files')
    return send_from_directory(file_path, 'Budget_Template.xlsx', as_attachment=True)



# ---------------------------------------------------------------------
# Subscribe to newsletter block 

@views.route('/subscribe', methods=['POST'])
@limiter.limit("3 per minute", key_func=lambda: current_user.id)
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



#--------------------------
#--------Tracker-----------

@views.route('/tracker')
@login_required
def tracker():
    user_id = current_user.id

    life = LifeExpectancy.query.filter_by(user_id=user_id).first()
    assets = Asset.query.filter_by(user_id=user_id).all()
    liabilities = Liability.query.filter_by(user_id=user_id).all()
    income = Income.query.filter_by(user_id=user_id).all()
    expenses = Expense.query.filter_by(user_id=user_id).all()
    subscriptions = Subscription.query.filter_by(user_id=user_id).all()
    future_budget = FutureBudget.query.filter_by(user_id=user_id).all()
    epic = EpicExperience.query.filter_by(user_id=user_id).all()
    income_layers = IncomeLayer.query.filter_by(user_id=user_id).all()
    spending_allocation = SpendingAllocation.query.filter_by(user_id=user_id).all()


    assets_total = sum(a.amount for a in assets if a.amount)
    liabilities_total = sum(l.amount for l in liabilities if l.amount)
    income_total = sum(i.amount for i in income if i.amount and i.include)
    expenses_total = sum(e.amount for e in expenses if e.amount)
    subscriptions_total = sum(s.annual_amount for s in subscriptions if s.include)
    net_worth = assets_total - liabilities_total

    # merging subscriptions into expenses
    expenses_total += subscriptions_total

    completion_flags = {
        "life": life is not None,
        "assets": assets_total > 0,
        "liabilities": liabilities_total > 0,
        "income": income_total > 0,
        "expenses": expenses_total > 0,
        "subscriptions": subscriptions_total > 0,
        "future_budget": len(future_budget) > 0,
        "epic": len(epic) > 0,
        "income_layers": len(income_layers) > 0,
        "spending_allocation": len(spending_allocation) > 0,
        "summary": net_worth != 0
    }

    instructions = [
        {"title": "Life Expectancy", "description": "Use this estimator to determine your expected lifespan. Select your gender, input your age and the sheet will calculate your estimated years remaining and the approximate year you might reach that age using the benchmarks that were published in Prime Time: 27 Lessons for the New Midlife."},
        {"title": "Assets", "description": "List everything you own that has a saleable value: your home, superannuation, investments, rental properties, cash and lifestyle assets. Indicate whether to include each in your net‑worth totals."},
        {"title": "Liabilities & Savings", "description": "Record every debt (mortgage, loans, credit cards) and your savings or investment contributions. Include interest rates, terms and monthly repayments."},
        {"title": "Current Income", "description": "Enter all sources of take‑home income and specify how often they are paid. Tick “Include” to incorporate them in the budget calculations."},
        {"title": "Current Expenses", "description": "Itemise your spending by category and frequency. The sheet converts different payment frequencies into annual and weekly amounts and summarises essentials vs discretionary costs."},
        {"title": "Subscriptions", "description": "Track recurring services or direct debits. Specify the amount and frequency; the sheet calculates annual totals."},
        {"title": "Future Budget", "description": "Plan your cost of living for each life phase. Enter baseline living costs, one‑off costs per year and epic experiences per year along with the number of years you expect to spend in that phase."},
        {"title": "Epic & One-off", "description": "List specific one‑off costs and epic experiences. Select how often they occur (once, every year or every second year) and whether to include them; the sheet calculates the total cost by multiplying annual items by 10 years and every‑second‑year items by 5."},
        {"title": "Income Layers", "description": "Think about how different income sources will support you over time. Enter the age ranges for each layer (employment income, super pension, investment income, Age Pension, rental/business income and other) and the estimated annual amounts."},
        {"title": "Spending Allocation", "description": "Allocate your spending across categories (cost of living, lifestyle discretionary, saving & investing, health & care and other) for each phase. Compare your allocations against your future budget."},
        {"title": "Summary", "description": "See your big financial picture at a glance: the value of your home, assets (excluding home and super), super balance, liabilities, net worth, income, expenses and your annual and monthly surplus or deficit."},
        {"title": "Super Projection", "description": "Forecast how your superannuation might grow over time. Input your starting balance, expected annual return, annual contributions and the number of years; the sheet builds a year‑by‑year projection and chart."},
        {"title": "Debt Paydown", "description": "Estimate how long it will take to repay your debts. For each debt, enter the principal, interest rate and monthly payment; the sheet calculates the number of years to pay it off using Excel’s NPER function."},
        {"title": "Enough Calculator", "description": "Estimate the lump sum needed to fund your retirement. Use the annual spending from your Future Budget or input your own amount, set your net real return assumption, and adjust for the Age Pension or other income and any part‑time work. The sheet shows both a rule‑of‑thumb and an annuity‑based lump sum."}
    ]

    # Passing everything to the template
    return render_template(
        "calculators/tracker.html",
        instructions=instructions,
        completion_flags=completion_flags,
        data={
            "assets_total": assets_total,
            "liabilities_total": liabilities_total,
            "income_total": income_total,
            "expenses_total": expenses_total,
            "net_worth": net_worth
        }
    )



@views.route('/submit-tracker', methods=["POST"])
@limiter.limit("3 per minute")
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



@views.route('/reset-tracker', methods=['POST'])
@login_required
@limiter.limit("3 per minute", key_func=lambda: current_user.id)
def reset_tracker():
    user_id = current_user.id

    # Delete all data for the current user
    from .models import (
        LifeExpectancy, Asset, Liability, Income, Expense, Subscription,
        FutureBudget, EpicExperience, IncomeLayer, SpendingAllocation
    )

    try:
        for model in [LifeExpectancy, Asset, Liability, Income, Expense, Subscription,
                      FutureBudget, EpicExperience, IncomeLayer, SpendingAllocation]:
            model.query.filter_by(user_id=user_id).delete()

        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



#---------------------------------------------
# send email block

@views.route('/send-email', methods=['POST'])
@limiter.limit("3 per minute")
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
# ---------------- WEB CALCULATORs -----------------
#---------------------------------------------------


#-----------------------------------------------------
#------------ Life Expectancy ------------

@views.route('/life')
@login_required
def life():
    latest_estimate = LifeExpectancy.query.filter_by(user_id=current_user.id)\
        .order_by(LifeExpectancy.timestamp.desc())\
        .first()

    return render_template(
        'calculators/life_expectancy.html',
        life_expectancy=latest_estimate
    )


@views.route("/save-lifeexpectancy", methods=["POST"])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_life_expectancy():
    data = request.get_json()
    estimate = LifeExpectancy(
        user_id=current_user.id,
        gender=data["gender"],
        percentile=data["percentile"],
        current_age=int(data["current_age"]),
        expected_lifespan=int(data["expected_lifespan"]),
        years_remaining=int(data["years_remaining"]),
        estimated_year_of_death=int(data["estimated_year_of_death"])
    )
    db.session.add(estimate)
    db.session.commit()
    flash("Life expectancy saved successfully!", "success")
    return jsonify({'redirect': url_for('views.assets')})


#--------------------------------------------------
#--------- Assets -----------

@views.route('/assets')
@login_required
def assets():
    user_assets = Asset.query.filter_by(user_id=current_user.id).all()
    assets_data = [
        {
            "category": a.category,
            "description": a.description,
            "amount": a.amount,
            "owner": a.owner,
            "include": a.include
        }
        for a in user_assets
    ]
    return render_template('calculators/assets.html', assets_data=assets_data)


@views.route('/save-assets', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_assets():
    data = request.get_json()
    assets = data.get('assets', [])

    Asset.query.filter_by(user_id=current_user.id).delete()
    for a in assets:
        asset = Asset(
            user_id=current_user.id,
            category=a['category'],
            description=a['description'],
            amount=a['amount'],
            owner=a['owner'],
            include=a['include']
        )
        db.session.add(asset)
    db.session.commit()
    flash("Assets saved successfully!", "success")
    return jsonify({'redirect': url_for('views.liabilities')})



#-------------------------------------------------------
# ------- Liabilities --------

@views.route('/liabilities')
@login_required
def liabilities():
    user_liabilities = Liability.query.filter_by(user_id=current_user.id).all()
    liabilities_data = [
        {
            "category": l.category,
            "name": l.name,
            "amount": l.amount,
            "type": l.type,
            "monthly": l.monthly,
            "notes": l.notes
        }
        for l in user_liabilities
    ]
    return render_template('calculators/liabilities.html', liabilities_data=liabilities_data)

@views.route('/save-liabilities', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_liabilities():
    data = request.get_json()
    liabilities = data.get('liabilities', [])
    Liability.query.filter_by(user_id=current_user.id).delete()
    for l in liabilities:
        liability = Liability(
        user_id=current_user.id,
        category=l['category'],
        name=l['name'],
        amount=l['amount'],
        type=l['type'],
        monthly=l['monthly'],
        notes=l['notes']
    )
        db.session.add(liability)
    db.session.commit()
    flash("Liabilities saved successfully!", "success")
    return jsonify({'redirect': url_for('views.income')})


#------------------------------------------------------
# -------- Income --------

@views.route('/income')
@login_required
def income():
    user_incomes = Income.query.filter_by(user_id=current_user.id).all()
    income_data = [
        {
            "source": inc.source,
            "amount": inc.amount,
            "frequency": inc.frequency,
            "notes": inc.notes,
            "include": inc.include
        }
        for inc in user_incomes
    ]
    return render_template('calculators/income.html', income_data=income_data)


@views.route('/save-income', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_income():
    data = request.get_json() or {}
    incomes = data.get('incomes', [])
    Income.query.filter_by(user_id=current_user.id).delete()
    for i in incomes:
        db.session.add(Income(
            user_id=current_user.id,
            source=i.get('source', ''),
            amount=i.get('amount', 0),
            frequency=i.get('frequency', ''),
            notes=i.get('notes', ''),
            include=i.get('include', True)
        ))
    db.session.commit()
    print("Received incomes:", incomes)
    flash("Income saved successfully!", "success")
    # Next step in your flow → Expenses
    return jsonify({'redirect': url_for('views.expenses')})


#---------------------------------------------------
# ---- Expenses ----

@views.route('/expenses')
@login_required
def expenses():
    user_expenses = Expense.query.filter_by(user_id=current_user.id).all()
    expenses_data = [
        {
            "category": e.category,
            "item": e.item,
            "amount": e.amount,
            "frequency": e.frequency,
            "type": e.type
        }
        for e in user_expenses
    ]
    return render_template('calculators/expenses.html',
                           expenses_data=expenses_data or [])


@views.route('/save-expenses', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_expenses():
    try:
        data = request.get_json() or {}
        expenses = data.get('expenses', [])

        Expense.query.filter_by(user_id=current_user.id).delete()

        for e in expenses:
            expense = Expense(
                user_id=current_user.id,
                category=e.get("category", ""),
                item=e.get("item", ""),
                amount=float(e.get("amount") or 0),
                frequency=e.get("frequency", "monthly"),
                type=e.get("type", "Essential")
            )
            db.session.add(expense)

        db.session.commit()
        flash("Expenses saved successfully!", "success")
        return jsonify({'redirect': url_for('views.subscriptions')})

    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500



#---------------------------------------------------
# ------ Subscriptions ------

@views.route('/subscriptions')
@login_required
def subscriptions():
    rows = Subscription.query.filter_by(user_id=current_user.id).all()

    if not rows:
        # Inject one empty row if no data exists
        subscriptions_data = [{
            "name": "",
            "provider": "",
            "amount": 0,
            "frequency": "monthly",
            "include": True,
            "annual_amount": 0
        }]
    else:
        periods = {
            'weekly': 52,
            'fortnightly': 26,
            'monthly': 12,
            'quarterly': 4,
            'annually': 1
        }

        def as_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        subscriptions_data = [
            {
                "name": r.name,
                "provider": r.provider,
                "amount": r.amount,
                "frequency": r.frequency,
                "include": r.include,
                "annual_amount": as_float(r.amount) * periods.get(r.frequency.lower(), 0),
            } for r in rows
        ]

    return render_template('calculators/subscriptions.html',
                           subscriptions_data=subscriptions_data)



@views.route('/save-subscriptions', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_subscriptions():
    try:
        data = request.get_json(silent=True) or {}
        subs = data.get('subscriptions', [])


        Subscription.query.filter_by(user_id=current_user.id).delete()

        def as_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        for s in subs:
            frequency = (s.get('frequency', 'monthly') or 'monthly').lower()
            db.session.add(Subscription(
                user_id=current_user.id,
                name=s.get('name', ''),
                provider=s.get('provider', ''),
                amount=as_float(s.get('amount')),
                frequency=frequency,
                notes=s.get('notes', ''),
                include=bool(s.get('include', False)),
                annual_amount=as_float(s.get('annual_amount')),
            ))

        db.session.commit()
       
        return jsonify({'redirect': url_for('views.future_budget')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


#---------------------------------------------------
 # ---- Future Budget ----

@views.route('/future_budget')
@login_required
def future_budget():
    rows = FutureBudget.query.filter_by(user_id=current_user.id).all()
    future_budget_data = [
        {
            "phase": r.phase,
            "age_range": r.age_range,
            "years_in_phase": r.years_in_phase,
            "baseline_cost": r.baseline_cost,
            "oneoff_costs": r.oneoff_costs,
            "epic_experiences": r.epic_experiences,
            "total_annual_budget": r.total_annual_budget,
        } for r in rows
    ]
    return render_template('calculators/future_budget.html',
                           future_budget_data=future_budget_data or [])


@views.route('/save-future-budget', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_future_budget():
    try:
        data = request.get_json(silent=True) or {}
        budgets = data.get('budgets', [])

        FutureBudget.query.filter_by(user_id=current_user.id).delete()

        def as_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        def as_int(v):
            try:
                return int(v or 0)
            except (TypeError, ValueError):
                return 0

        for b in budgets:
            db.session.add(FutureBudget(
                user_id=current_user.id,
                phase=b.get('phase', ''),
                age_range=b.get('age_range', ''),
                years_in_phase=as_int(b.get('years_in_phase')),
                baseline_cost=as_float(b.get('baseline_cost')),
                oneoff_costs=as_float(b.get('oneoff_costs')),
                epic_experiences=as_float(b.get('epic_experiences')),
                total_annual_budget=as_float(b.get('total_annual_budget')),
            ))
        db.session.commit()
        flash("Future Budget saved successfully!", "success")

        return jsonify({'redirect': url_for('views.epic')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


    
#---------------------------------------------------
 # ---- Epic Retirement & One-Off Experiences ----

@views.route('/epic')
@login_required
def epic():
    rows = EpicExperience.query.filter_by(user_id=current_user.id).all()
    epic_data = [
        {
            "item": r.item,
            "amount": r.amount,
            "frequency": r.frequency,
            "include": r.include,
        } for r in rows
    ]
    epic_years = 10 
    return render_template('calculators/epic.html',
                           epic_data=epic_data or [],
                           epic_years=epic_years)



@views.route('/save-epic', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_epic():
    try:
        data = request.get_json()
        epic_items = data.get("items", [])
        epic_years = data.get("settings", {}).get("years", 10)

        EpicExperience.query.filter_by(user_id=current_user.id).delete()

        def as_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        for it in epic_items:
            db.session.add(EpicExperience(
                user_id=current_user.id,
                item=it.get('item', ''),
                amount=as_float(it.get('amount')),
                frequency=it.get('frequency') or 'Once only',
                include=bool(it.get('include', True)),
            ))
        db.session.commit()
        session["epic_years"] = epic_years
        flash('Epic experiences saved successfully!', 'success')
        return jsonify({'redirect': url_for('views.income_layers')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500




#---------------------------------------------------
#------------ Enough Calculator------------

@views.route('/enough_calculator')
@login_required
def enough_calculator():
    rows = EnoughCalculator.query.filter_by(user_id=current_user.id)\
        .order_by(EnoughCalculator.created_at.desc())\
        .all()
    latest = rows[0] if rows else None
    return render_template('calculators/enough_calculator.html',
                           enough=latest)

@views.route('/save-enough_calculator', methods=['POST'])
@login_required
def save_enough_calculator():
    try:
        payload = request.get_json(silent=True) or {}

        EnoughCalculator.query.filter_by(user_id=current_user.id).delete()

        ec = EnoughCalculator(
            user_id=current_user.id,
            use_future_budget=payload.get('use_future_budget', 'Yes'),
            manual_annual=float(payload.get('manual_annual') or 0),
            real_rate=float(payload.get('real_rate') or 0),
            years=int(payload.get('years') or 0),
            pension=float(payload.get('pension') or 0),
            part_time_income=float(payload.get('part_time_income') or 0),
            part_time_years=float(payload.get('part_time_years') or 0),
            shortfall=float(payload.get('shortfall') or 0),
            lump_sum_rule=float(payload.get('lump_sum_rule') or 0),
            lump_sum_annuity=float(payload.get('lump_sum_annuity') or 0),
        )
        db.session.add(ec)
        db.session.commit()
        flash("Enough Calculator data saved successfully!", "success")
        return jsonify({'redirect': url_for('views.summary')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e), 'redirect': url_for('views.summary')}), 200



#---------------------------------------------------
# ---- Income Layers ----

@views.route('/income_layers')
@login_required
def income_layers():
    rows = IncomeLayer.query.filter_by(user_id=current_user.id).all()
    layers_data = [
        {
            'id': r.id,
            'layer': r.layer,
            'description': r.description,
            'start_age': r.start_age,
            'end_age': r.end_age,
            'annual_amount': r.annual_amount
        } for r in rows
    ]
    return render_template('calculators/income_layers.html', layers=layers_data)

@views.route('/save-income_layers', methods=['POST'])
@login_required
def save_income_layers():
    try:
        payload = request.get_json(silent=True) or {}
        items = payload.get('items', [])


        IncomeLayer.query.filter_by(user_id=current_user.id).delete()

        for item in items:
            layer = IncomeLayer(
                user_id=current_user.id,
                layer=item.get('layer', ''),
                description=item.get('description', ''),
                start_age=item.get('start_age'),
                end_age=item.get('end_age'),
                annual_amount=item.get('annual_amount', 0.0)
            )
            db.session.add(layer)

        db.session.commit()
        return jsonify({'redirect': url_for('views.spending_allocation')})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


#---------------------------------------------------
# ---- Spending Allocation ----

@views.route('/spending_allocation')
@login_required
def spending_allocation():
    rows = SpendingAllocation.query.filter_by(user_id=current_user.id).all()
    spending_data = [
        {
            'id': r.id,
            'phase': r.phase,
            'cost_base': r.cost_base,
            'cost_life': r.cost_life,
            'cost_save': r.cost_save,
            'cost_health': r.cost_health,
            'cost_other': r.cost_other
        } for r in rows
    ]
    return render_template('calculators/spending_allocation.html', spending_data=spending_data)


@views.route('/save-spending', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_spending():
    try:
        payload = request.get_json(silent=True) or {}
        allocations = payload.get('allocations', [])

        SpendingAllocation.query.filter_by(user_id=current_user.id).delete()

        for item in allocations:
            row = SpendingAllocation(
                user_id=current_user.id,
                phase=item.get('phase', ''),
                cost_base=item.get('cost_base', 0.0),
                cost_life=item.get('cost_life', 0.0),
                cost_save=item.get('cost_save', 0.0),
                cost_health=item.get('cost_health', 0.0),
                cost_other=item.get('cost_other', 0.0),
            )
            db.session.add(row)

        db.session.commit()
        flash("Spending allocation saved successfully!", "success")
        return jsonify({'redirect': url_for('views.summary')})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



#---------------------------------------------------
# ---- Super Projection  ----

@views.route('/super_projection')
@login_required
def super_projection():
    return render_template('calculators/super_projection.html')

@views.route('/super')
@login_required
def super():
    return redirect(url_for('views.super_projection'))


#---------------------------------------------------
# ---- Debt Paydown  ----

@views.route('/debt_paydown')
@login_required
def debt_paydown():
    """Render the Debt Paydown Planner (kept under calculators/ to match others)."""
    return render_template('calculators/debt_paydown.html')


@views.route('/save-debt_paydown', methods=['POST'])
@login_required
@limiter.limit("5 per minute", key_func=lambda: current_user.id)
def save_debt_paydown():
    """Persist Debt Paydown rows for the current user, then go to Summary."""
    try:
        payload = request.get_json(silent=True) or {}
        debts = payload.get('debts', [])

        DebtPaydown.query.filter_by(user_id=current_user.id).delete()

        def f(v):
            try: return float(v or 0)
            except (TypeError, ValueError): return 0.0

        for d in debts:
            db.session.add(DebtPaydown(
                user_id=current_user.id,
                name=d.get('name', '') or d.get('debt_name', ''),
                principal=f(d.get('principal')),
                annual_interest_rate=f(d.get('annual_interest_rate')),
                monthly_payment=f(d.get('monthly_payment')),
                years_to_repay=(f(d.get('years_to_repay')) or None),
                include=bool(d.get('include', True)),
            ))

        db.session.commit()
        flash("Debt paydown data saved successfully!", "success")
        return jsonify({"redirect": url_for('views.enough_calculator')}), 200

    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e), "redirect": url_for('views.summary')}), 200
    


#------------------------------------------------
# ------------ Calculator Summary ---------------
#------------------------------------------------

@views.route('/summary')
@login_required
def summary():
    user_id = current_user.id
    summary = get_calculator_summary(user_id)
    return render_template('calculators/summary.html',
        net_worth=summary["net_worth"],
        assets_total=summary["assets_total"],
        liabilities_total=summary["liabilities_total"],
        income_annual=summary["income_annual"],
        income_breakdown=summary["income_breakdown"],
        subs_annual=summary["subs_annual"],
        expense_buckets_sum=summary["expense_buckets_sum"],
        epic_annual=summary["epic_annual"],
        expenses_annual=summary["expenses_annual"],
        surplus_annual=summary["surplus_annual"],
        surplus_monthly=summary["surplus_monthly"],
        actual_breakdown=summary["actual_breakdown"],
        budget_targets=summary["budget_targets"],
        subs_breakdown=summary["subs_breakdown"]
    )



# ---------- HELPER FUNCTION -----------

def get_calculator_summary(user_id):
    uid = current_user.id

    # ---------- Assets ----------
    assets_total = db.session.query(
        func.coalesce(func.sum(Asset.amount), 0.0)
    ).filter(Asset.user_id == uid, Asset.include == True).scalar()

    # ---------- Liabilities ----------
    liabilities_total = db.session.query(
        func.coalesce(func.sum(Liability.amount), 0.0)
    ).filter(Liability.user_id == uid).scalar()



    # ---------- Income: factor(frequency) ----------
    income_factor = case(
        (Income.frequency.ilike('weekly'),      52),
        (Income.frequency.ilike('fortnightly'), 26),
        (Income.frequency.ilike('monthly'),     12),
        (Income.frequency.ilike('quarterly'),    4),
        (Income.frequency.ilike('annually'),     1),
        else_=12
    )
    income_annual = db.session.query(
        func.coalesce(func.sum(func.coalesce(Income.amount, 0.0) * income_factor), 0.0)
    ).filter(Income.user_id == uid, Income.include == True).scalar()


    income_breakdown_rows = db.session.query(
        Income.source,
        func.coalesce(func.sum(func.coalesce(Income.amount, 0.0) * income_factor), 0.0)
    ).filter(Income.user_id == uid, Income.include == True).group_by(Income.source).all()
    income_breakdown = [
        {"label": src or 'Other', "value": float(total or 0.0)}
        for src, total in income_breakdown_rows
    ]

    # ---------- Subscriptions ------------
    sub_factor = case(
        (Subscription.frequency.ilike('weekly'),      52),
        (Subscription.frequency.ilike('fortnightly'), 26),
        (Subscription.frequency.ilike('monthly'),     12),
        (Subscription.frequency.ilike('quarterly'),    4),
        (Subscription.frequency.ilike('annually'),     1),
        else_=12
    )
    subs_fallback = func.coalesce(Subscription.amount, 0.0) * sub_factor
    subs_annual = db.session.query(
        func.coalesce(func.sum(
            case(
                (Subscription.annual_amount.isnot(None), Subscription.annual_amount),
                else_=subs_fallback
            )
        ), 0.0)
    ).filter(Subscription.user_id == uid, Subscription.include == True).scalar()


    subs_rows = db.session.query(
        Subscription.name,
        func.coalesce(
            case(
                (Subscription.annual_amount.isnot(None), Subscription.annual_amount),
                else_=Subscription.amount * sub_factor
            ), 0.0
        )
    ).filter(Subscription.user_id == user_id, Subscription.include == True).all()

    subs_breakdown = [
        {"label": name or "Unnamed", "value": float(amount or 0.0)}
        for name, amount in subs_rows
    ]

    
    # ---------- Expenses ----------
    expense_factor = case(
        (Expense.frequency.ilike('weekly'),      52),
        (Expense.frequency.ilike('fortnightly'), 26),
        (Expense.frequency.ilike('monthly'),     12),
        (Expense.frequency.ilike('quarterly'),    4),
        (Expense.frequency.ilike('annually'),     1),
        else_=12
    )
   
    expense_buckets_sum = db.session.query(
        func.coalesce(func.sum(func.coalesce(Expense.amount, 0.0) * expense_factor), 0.0)
    ).filter(Expense.user_id == uid).scalar()



    # ---------- Epic Experiences: across 10 years) ----------

    epic_years = 10
    epic_factor = case(
        (EpicExperience.frequency.ilike('weekly'),      52),
        (EpicExperience.frequency.ilike('fortnightly'), 26),
        (EpicExperience.frequency.ilike('monthly'),     12),
        (EpicExperience.frequency.ilike('quarterly'),    4),
        (EpicExperience.frequency.ilike('annually'),     1),
        (EpicExperience.frequency.ilike('once only'),    0), 
        else_=0
    )
    # regular epics (not one-off)
    epic_regular = db.session.query(
        func.coalesce(func.sum(func.coalesce(EpicExperience.amount, 0.0) * epic_factor), 0.0)
    ).filter(EpicExperience.user_id == uid, EpicExperience.include == True,
            ~EpicExperience.frequency.ilike('once only')).scalar()
    
    # One-offs across epic_years
    epic_oneoff = db.session.query(
        func.coalesce(func.sum(func.coalesce(EpicExperience.amount, 0.0)), 0.0)
    ).filter(EpicExperience.user_id == uid, EpicExperience.include == True,
            EpicExperience.frequency.ilike('once only')).scalar()
    epic_annual = (epic_regular or 0.0) + ( (epic_oneoff or 0.0) / float(epic_years or 1) )


    # ---------- Future Budget ----------
    fb_rows = FutureBudget.query.filter_by(user_id=uid).all()
    fb_baseline  = sum(float(r.baseline_cost or 0.0) for r in fb_rows)
    fb_oneoff    = sum(float(r.oneoff_costs or 0.0) for r in fb_rows)
    fb_epic      = sum(float(r.epic_experiences or 0.0) for r in fb_rows)
    fb_total     = sum(float(r.total_annual_budget or 0.0) for r in fb_rows)


    # ---------- Totals----------
    # subscription counts to Expenses 
    expenses_annual = (subs_annual or 0.0) + (expense_buckets_sum or 0.0) + (epic_annual or 0.0)
    net_worth       = (assets_total or 0.0) - (liabilities_total or 0.0)
    surplus_annual  = (income_annual or 0.0) - expenses_annual
    surplus_monthly = surplus_annual / 12.0

    actual_breakdown = [
        {"label": "Bills/Subscriptions", "value": float(subs_annual or 0.0)},
        {"label": "Expenses",             "value": float(expense_buckets_sum or 0.0)},
        {"label": "Epic Experiences",     "value": float(epic_annual or 0.0)},
    ]

    budget_targets = {
        "baseline": float(fb_baseline),
        "oneoff":   float(fb_oneoff),
        "epic":     float(fb_epic),
        "total":    float(fb_total),
    }

    print("Assets Total:", assets_total)
    print("Income Annual:", income_annual)
    print("Expenses Annual:", expenses_annual)
    print("Subscriptions Annual:", subs_annual)
    print("Epic Annual:", epic_annual)
    print("Future Budget Total:", fb_total)


    summary_payload = {
        "net_worth": float(net_worth or 0.0),
        "assets":{"total": float(assets_total or 0.0)},
        "liabilities":{"total": float(liabilities_total or 0.0)},
        "income":{"total": float(income_annual or 0.0)},
        "subscriptions":{"total": float(subs_annual or 0.0)},
        "expenses":{"total": float(expenses_annual or 0.0)}
    }

    session['summary_data'] = summary_payload
    return {
        "assets_total": assets_total,
        "liabilities_total": liabilities_total,
        "income_annual": income_annual,
        "income_breakdown": income_breakdown,
        "subs_annual": subs_annual,
        "subs_breakdown": subs_breakdown,
        "expense_buckets_sum": expense_buckets_sum,
        "epic_annual": epic_annual,
        "expenses_annual": expenses_annual,
        "net_worth": net_worth,
        "surplus_annual": surplus_annual,
        "surplus_monthly": surplus_monthly,
        "actual_breakdown": actual_breakdown,
        "budget_targets": budget_targets

    }
