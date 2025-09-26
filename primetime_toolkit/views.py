from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from . import mail
from flask import current_app
from flask_mail import Mail, Message
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
import json
from primetime_toolkit.models import db, Subscriber, Asset, Liability, Income, Expense, Subscription, FutureBudget, EpicExperience
from sqlalchemy import func, case
from .excel_parser import parse_excel

views = Blueprint('views', __name__)

@views.route('/')
def home():
    return render_template('home.html')

@views.route('/dashboard')
def dashboard():
    '''username = current_user.username
    if not username:
        flash("Please log in first", "error")
        return redirect(url_for("auth.login"))'''
    
    upload_folder = current_app.config['UPLOAD_FOLDER']
    data = {}

    if os.path.exists(upload_folder):
        files = [os.path.join(upload_folder, f) for f in os.listdir(upload_folder) if allowed_file(f)]
        if files:
            latest_file = max(files, key=os.path.getmtime)
            data = parse_excel(latest_file)

    return render_template('dashboard.html', data=data)

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

@views.route('/assessment_intro')
def assessment_intro():
    return render_template('selftest/assessment_intro.html')


@views.route('/assessment1')
def assessment1():
    return render_template('selftest/assessment/assessment1.html')

@views.route('/assessment2', methods=['GET', 'POST'])
def assessment2():
    return render_template('selftest/assessment/assessment2.html')

@views.route('/assessment3', methods=['GET', 'POST'])
def assessment3():
    return render_template('selftest/assessment/assessment3.html')

@views.route('/assessment4', methods=['GET', 'POST'])
def assessment4():
    return render_template('selftest/assessment/assessment4.html')

@views.route('/assessment5', methods=['GET', 'POST'])
def assessment5():
    return render_template('selftest/assessment/assessment5.html')

@views.route('/assessment6', methods=['GET', 'POST'])
def assessment6():
    return render_template('selftest/assessment/assessment6.html')

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
    """Process 24 Likert questions (1–5 each), produce 0–120 total,
    and classify as Inactive / Reactive / Proactive."""
    TOTAL_QUESTIONS = 24

    total_score = 0
    for i in range(1, TOTAL_QUESTIONS + 1):
        answer = request.form.get(f'q{i}')
        if answer:
            try:
                total_score += int(answer)
            except ValueError:
                pass

    # Map total_score (0–120) to bands
    if total_score <= 50:
        band = "Inactive"
    elif total_score <= 90:
        band = "Reactive"
    else:
        band = "Proactive"

    result_message = f"You are classified as {band}."

    return render_template(
        'selftest/summary.html',
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

#------------------------------------------------------
# Assets block

# views.py
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
    return render_template('diagnostic/assets.html', assets_data=assets_data)


@views.route('/save-assets', methods=['POST'])
@login_required
def save_assets():
    data = request.get_json()
    assets = data.get('assets', [])
    # Delete old assets for this user first
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
# ---- Liabilities ----
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
    return render_template('diagnostic/liabilities.html', liabilities_data=liabilities_data)

@views.route('/save-liabilities', methods=['POST'])
@login_required
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
# ---- Income ----
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
    return render_template('diagnostic/income.html', income_data=income_data)


@views.route('/save-income', methods=['POST'])
@login_required
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
            "phase": e.phase,
            "baseline": e.baseline,
            "lifestyle": e.lifestyle,
            "saving_investing": e.saving_investing,
            "health_care": e.health_care,
            "other": e.other,
            "total_spending": e.total_spending,
            "budgeted_amount": e.budgeted_amount,
            "surplus_deficit": e.surplus_deficit,
        }
        for e in user_expenses
    ]
    return render_template('diagnostic/expenses.html',
                           expenses_data=expenses_data or [])


@views.route('/save-expenses', methods=['POST'])
@login_required
def save_expenses():
    try:
        data = request.get_json() or {}
        expenses = data.get('expenses', [])

        # Clear old ones
        Expense.query.filter_by(user_id=current_user.id).delete()

        for e in expenses:
            db.session.add(Expense(
                user_id=current_user.id,
                phase=e.get("phase", ""),
                baseline=float(e.get("baseline") or 0),
                lifestyle=float(e.get("lifestyle") or 0),
                saving_investing=float(e.get("saving_investing") or 0),
                health_care=float(e.get("health_care") or 0),
                other=float(e.get("other") or 0),
                total_spending=float(e.get("total_spending") or 0),
                budgeted_amount=float(e.get("budgeted_amount") or 0),
                surplus_deficit=float(e.get("surplus_deficit") or 0),
            ))

        db.session.commit()
        flash("Expenses saved successfully!", "success")
        # Next step in flow → Subscriptions
        return jsonify({'redirect': url_for('views.subscriptions')})

    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    




#---------------------------------------------------
# ---- Subscriptions ----
@views.route('/subscriptions')
@login_required
def subscriptions():
    rows = Subscription.query.filter_by(user_id=current_user.id).all()
    subscriptions_data = [
        {
            "name": r.name,
            "amount": r.amount,
            "frequency": r.frequency,
            "notes": r.notes,
            "include": r.include,
            "annual_amount": r.annual_amount,
        } for r in rows
    ]
    return render_template('diagnostic/subscriptions.html',
                           subscriptions_data=subscriptions_data or [])


@views.route('/save-subscriptions', methods=['POST'])
@login_required
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
            db.session.add(Subscription(
                user_id=current_user.id,
                name=s.get('name', ''),
                amount=as_float(s.get('amount')),
                frequency=s.get('frequency', '') or 'monthly',
                notes=s.get('notes', ''),
                include=bool(s.get('include', False)),
                annual_amount=as_float(s.get('annual_amount')),
            ))
        db.session.commit()
        # chain to Future Budget
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
    return render_template('diagnostic/future_budget.html',
                           future_budget_data=future_budget_data or [])


@views.route('/save-future-budget', methods=['POST'])
@login_required
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
        # end of chain, stay on same page or redirect to Epic if needed
        return jsonify({'redirect': url_for('views.epic')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


    
#---------------------------------------------------
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
    epic_years = 10  # adjust if you persist years separately
    return render_template('diagnostic/epic.html',
                           epic_data=epic_data or [],
                           epic_years=epic_years)

@views.route('/save-epic', methods=['POST'])
@login_required
def save_epic():
    try:
        payload = request.get_json(silent=True) or {}
        items = payload.get('items', [])
        # settings = payload.get('settings', {})  # contains {"years": N} if you decide to persist it

        EpicExperience.query.filter_by(user_id=current_user.id).delete()

        def as_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        for it in items:
            db.session.add(EpicExperience(
                user_id=current_user.id,
                item=it.get('item', ''),
                amount=as_float(it.get('amount')),
                frequency=it.get('frequency') or 'Once only',
                include=bool(it.get('include', True)),
            ))
        db.session.commit()
        flash('Epic experiences saved successfully!', 'success')
        # after Epic, your flow goes to Spending Allocation
        return jsonify({'redirect': url_for('views.spending')})
    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
#---------------------------------------------------



@views.route('/life')
def life():
    return render_template('diagnostic/life_expectancy.html')



@views.route('/calculator')                
def calculator():                           
    return render_template('diagnostic/calculator.html')






@views.route('/income_layers')
def income_layers():
    return render_template('diagnostic/income_layers.html')

@views.route('/spending')
def spending():
    return render_template('diagnostic/spending_allocation.html')


@views.route('/super')
def super():
    return render_template('diagnostic/super_projection.html')




@views.route('/summary')
@login_required
def summary():
    uid = current_user.id

    # ---------- Assets (included only) ----------
    assets_total = db.session.query(
        func.coalesce(func.sum(Asset.amount), 0.0)
    ).filter(Asset.user_id == uid, Asset.include == True).scalar()

    # ---------- Liabilities ----------
    liabilities_total = db.session.query(
        func.coalesce(func.sum(Liability.amount), 0.0)
    ).filter(Liability.user_id == uid).scalar()

    # ---------- Income: annualise amount * factor(frequency) ----------
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

    # Income breakdown by source (for donut chart)
    income_breakdown_rows = db.session.query(
        Income.source,
        func.coalesce(func.sum(func.coalesce(Income.amount, 0.0) * income_factor), 0.0)
    ).filter(Income.user_id == uid, Income.include == True).group_by(Income.source).all()
    income_breakdown = [
        {"label": src or 'Other', "value": float(total or 0.0)}
        for src, total in income_breakdown_rows
    ]

    # ---------- Subscriptions: prefer stored annual_amount, else amount * factor ----------
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

    # ---------- Spending Allocation (Expense buckets) ----------
    expense_buckets_sum = db.session.query(
        func.coalesce(func.sum(
            func.coalesce(Expense.baseline, 0.0) +
            func.coalesce(Expense.lifestyle, 0.0) +
            func.coalesce(Expense.saving_investing, 0.0) +
            func.coalesce(Expense.health_care, 0.0) +
            func.coalesce(Expense.other, 0.0)
        ), 0.0)
    ).filter(Expense.user_id == uid).scalar()

    # ---------- Epic Experiences: annualise (spread 'Once only' across 10 years) ----------
    # You can later persist years; using 10 as default to match /epic view.
    epic_years = 10
    epic_factor = case(
        (EpicExperience.frequency.ilike('weekly'),      52),
        (EpicExperience.frequency.ilike('fortnightly'), 26),
        (EpicExperience.frequency.ilike('monthly'),     12),
        (EpicExperience.frequency.ilike('quarterly'),    4),
        (EpicExperience.frequency.ilike('annually'),     1),
        (EpicExperience.frequency.ilike('once only'),    0),  # handled below
        else_=0
    )
    # Regular epics (not one-off)
    epic_regular = db.session.query(
        func.coalesce(func.sum(func.coalesce(EpicExperience.amount, 0.0) * epic_factor), 0.0)
    ).filter(EpicExperience.user_id == uid, EpicExperience.include == True,
             ~EpicExperience.frequency.ilike('once only')).scalar()
    # One-off epics spread across epic_years
    epic_oneoff = db.session.query(
        func.coalesce(func.sum(func.coalesce(EpicExperience.amount, 0.0)), 0.0)
    ).filter(EpicExperience.user_id == uid, EpicExperience.include == True,
             EpicExperience.frequency.ilike('once only')).scalar()
    epic_annual = (epic_regular or 0.0) + ( (epic_oneoff or 0.0) / float(epic_years or 1) )

    # ---------- Future Budget (targets) ----------
    fb_rows = FutureBudget.query.filter_by(user_id=uid).all()
    fb_baseline  = sum(float(r.baseline_cost or 0.0) for r in fb_rows)
    fb_oneoff    = sum(float(r.oneoff_costs or 0.0) for r in fb_rows)
    fb_epic      = sum(float(r.epic_experiences or 0.0) for r in fb_rows)
    fb_total     = sum(float(r.total_annual_budget or 0.0) for r in fb_rows)

    # ---------- Totals & KPIs ----------
    # Treat Subscriptions as recurring bills; Expense buckets cover other living costs; Epics are separate
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

    return render_template(
        'diagnostic/summary.html',
        # Point-in-time
        net_worth=float(net_worth or 0.0),
        assets_total=float(assets_total or 0.0),
        liabilities_total=float(liabilities_total or 0.0),
        # Inflows
        income_annual=float(income_annual or 0.0),
        income_breakdown=income_breakdown,
        # Outflows (actuals)
        subs_annual=float(subs_annual or 0.0),
        expense_buckets_sum=float(expense_buckets_sum or 0.0),
        epic_annual=float(epic_annual or 0.0),
        expenses_annual=float(expenses_annual or 0.0),
        actual_breakdown=actual_breakdown,
        # Budgets (targets)
        budget_targets=budget_targets,
        # Surplus
        surplus_annual=float(surplus_annual or 0.0),
        surplus_monthly=float(surplus_monthly or 0.0)
    )