from . import db
from werkzeug.security import generate_password_hash
from datetime import datetime
from flask_login import UserMixin


class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Purpose & direction
    purpose_q1 = db.Column(db.Integer, nullable=True)
    purpose_q2 = db.Column(db.Integer, nullable=True)
    purpose_q3 = db.Column(db.Integer, nullable=True)
    purpose_q4 = db.Column(db.Integer, nullable=True)

    
    # Spending & cashflow
    spending_q1 = db.Column(db.Integer, nullable=True)
    spending_q2 = db.Column(db.Integer, nullable=True)
    spending_q3 = db.Column(db.Integer, nullable=True)
    spending_q4 = db.Column(db.Integer, nullable=True)


    # Saving & emergency
    saving_q1 = db.Column(db.Integer, nullable=True)
    saving_q2 = db.Column(db.Integer, nullable=True)
    saving_q3 = db.Column(db.Integer, nullable=True)
    saving_q4 = db.Column(db.Integer, nullable=True)


    # Debt & confidence
    debt_q1 = db.Column(db.Integer, nullable=True)
    debt_q2 = db.Column(db.Integer, nullable=True)
    debt_q3 = db.Column(db.Integer, nullable=True)
    debt_q4 = db.Column(db.Integer, nullable=True)


    # Superannuation
    super_q1 = db.Column(db.Integer, nullable=True)
    super_q2 = db.Column(db.Integer, nullable=True)
    super_q3 = db.Column(db.Integer, nullable=True)
    super_q4 = db.Column(db.Integer, nullable=True)


    # Protection & planning
    protection_q1 = db.Column(db.Integer, nullable=True)
    protection_q2 = db.Column(db.Integer, nullable=True)
    protection_q3 = db.Column(db.Integer, nullable=True)
    protection_q4 = db.Column(db.Integer, nullable=True)


    total_score = db.Column(db.Integer)
    result_message = db.Column(db.String(20))
    category_scores = db.Column(db.JSON) 

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)



class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False, unique=True)
    pword = db.Column(db.String(200), nullable=False)
    two_factor_secret = db.Column(db.String(16), nullable=True)
    is_2fa_enabled = db.Column(db.Boolean, default=False)

    def __init__(self, name, email, pword):
        self.name = name
        self.email = email
        self.pword = pword


    
class Subscriber(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120))



class LifeExpectancy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    gender = db.Column(db.String(16), nullable=False)
    percentile = db.Column(db.String(32), nullable=False)
    current_age = db.Column(db.Integer, nullable=False)
    expected_lifespan = db.Column(db.Integer, nullable=False)
    years_remaining = db.Column(db.Integer, nullable=False)
    estimated_year_of_death = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, server_default=db.func.now())



class Asset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(64))
    description = db.Column(db.String(128))
    amount = db.Column(db.Float)
    owner = db.Column(db.String(64))
    include = db.Column(db.Boolean, default=True)



class Liability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(64))
    name = db.Column(db.String(128))
    amount = db.Column(db.Float)
    type = db.Column(db.String(64))
    monthly = db.Column(db.Float)
    notes = db.Column(db.String(128))


class Income(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    source = db.Column(db.String(128))
    amount = db.Column(db.Float)
    frequency = db.Column(db.String(32))
    notes = db.Column(db.String(128))
    include = db.Column(db.Boolean, default=True)


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(64))
    item = db.Column(db.String(128))
    amount = db.Column(db.Float)
    frequency = db.Column(db.String(32))
    type = db.Column(db.String(32))
    timestamp = db.Column(db.DateTime, server_default=db.func.now())



class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)    
    provider = db.Column(db.String(120))
    amount = db.Column(db.Float, default=0.0)          
    frequency = db.Column(db.String(32), default='monthly') 
    notes = db.Column(db.String(200), default='')
    include = db.Column(db.Boolean, default=True)

    annual_amount = db.Column(db.Float, default=0.0)


class FutureBudget(db.Model):
    __tablename__ = 'future_budget'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    phase = db.Column(db.String(120), nullable=False)
    age_range = db.Column(db.String(64))                 
    years_in_phase = db.Column(db.Integer, default=0)

    baseline_cost = db.Column(db.Float, default=0.0)
    oneoff_costs = db.Column(db.Float, default=0.0)
    epic_experiences = db.Column(db.Float, default=0.0)
    total_annual_budget = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



class EpicExperience(db.Model):
    __tablename__ = 'epic_experiences'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    epic_years = 10

    item = db.Column(db.String(160), nullable=False)        
    amount = db.Column(db.Float, default=0.0)               
    frequency = db.Column(db.String(32), default='Once only')
    include = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

#--------


class IncomeLayer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    layer = db.Column(db.String(64))
    description = db.Column(db.String(128))
    start_age = db.Column(db.Integer)
    end_age = db.Column(db.Integer)
    annual_amount = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, server_default=db.func.now())


class SpendingAllocation(db.Model):
    __tablename__ = 'spending_allocation'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # e.g. Lifestyle, Set up, etc...
    phase = db.Column(db.String(120), nullable=False)

    cost_base   = db.Column(db.Float, default=0.0) 
    cost_life   = db.Column(db.Float, default=0.0) 
    cost_save   = db.Column(db.Float, default=0.0)
    cost_health = db.Column(db.Float, default=0.0)
    cost_other  = db.Column(db.Float, default=0.0) 

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def total_spending(self) -> float:
        return (self.cost_base or 0) + (self.cost_life or 0) + (self.cost_save or 0) + (self.cost_health or 0) + (self.cost_other or 0)



#----------------------------------------------
# Debt Paydown Calculator

class DebtPaydown(db.Model):
    __tablename__ = 'debt_paydown'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, index=True, nullable=False)

    name = db.Column(db.String(120), default='')
    principal = db.Column(db.Float, default=0.0)                 # starting balance
    annual_interest_rate = db.Column(db.Float, default=0.0) 
    monthly_payment = db.Column(db.Float, default=0.0)
    years_to_repay = db.Column(db.Float)
    include = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class EnoughCalculator(db.Model):
    __tablename__ = 'enough_calculator'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)

    # inputs
    use_future_budget = db.Column(db.String(8), nullable=False, default='Yes')  # yes or no
    manual_annual     = db.Column(db.Float, default=0.0)                        # if use_future_budget == no
    real_rate         = db.Column(db.Float, default=0.0)                        # % real per year
    years             = db.Column(db.Integer, default=0)                        # retirement duration
    pension           = db.Column(db.Float, default=0.0)                        # $/year
    part_time_income  = db.Column(db.Float, default=0.0)                        # $/year
    part_time_years   = db.Column(db.Float, default=0.0)                        # years of part-time work

    # optional outputs (what was shown to the user)
    shortfall         = db.Column(db.Float, default=0.0)
    lump_sum_rule     = db.Column(db.Float, default=0.0)
    lump_sum_annuity  = db.Column(db.Float, default=0.0)

    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at        = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
