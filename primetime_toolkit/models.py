from . import db
from werkzeug.security import generate_password_hash
from datetime import datetime
from flask_login import UserMixin


class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q1 = db.Column(db.Integer, nullable=False)
    q2 = db.Column(db.Integer, nullable=False)
    q3 = db.Column(db.Integer, nullable=False)
    q4 = db.Column(db.Integer, nullable=False)
    q5 = db.Column(db.Integer, nullable=False)
    q6 = db.Column(db.Integer, nullable=False)
    q7 = db.Column(db.Integer, nullable=False)


    def __init__(self, q1, q2, q3, q4, q5, q6, q7):
        self.q1 = q1
        self.q2 = q2
        self.q3 = q3
        self.q4 = q4
        self.q5 = q5
        self.q6 = q6
        self.q7 = q7

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False, unique=True)
    pword = db.Column(db.String(200), nullable=False)

    def __init__(self, name, email, password):
        self.name = name
        self.email = email
        self.pword = generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)


    
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

    # e.g., "Lifestyle", "Set-up", "Part-timing", etc.
    phase = db.Column(db.String(120), nullable=False)

    # Buckets (per-annum amounts)
    cost_base   = db.Column(db.Float, default=0.0)   # Cost of living baseline
    cost_life   = db.Column(db.Float, default=0.0)   # Lifestyle discretionary
    cost_save   = db.Column(db.Float, default=0.0)   # Saving & investing
    cost_health = db.Column(db.Float, default=0.0)   # Health & care
    cost_other  = db.Column(db.Float, default=0.0)   # Other

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def total_spending(self) -> float:
        return (self.cost_base or 0) + (self.cost_life or 0) + (self.cost_save or 0) + (self.cost_health or 0) + (self.cost_other or 0)
