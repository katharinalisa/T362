<<<<<<< HEAD
from . import db

class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q1 = db.Column(db.String(10))
    q2 = db.Column(db.String(10))
    q3 = db.Column(db.String(10))
    q4 = db.Column(db.String(10))
    q5 = db.Column(db.String(10))
    q6 = db.Column(db.String(10))
    q7 = db.Column(db.String(10))

class Users(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    FirstName = db.Column(db.String(35))
    LastName = db.Column(db.String(35))
    Age = db.Column(db.Integer)
    Address = db.Column(db.String(90))
=======
from . import db

class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q1 = db.Column(db.String(10))
    q2 = db.Column(db.String(10))
    q3 = db.Column(db.String(10))
    q4 = db.Column(db.String(10))
    q5 = db.Column(db.String(10))
    q6 = db.Column(db.String(10))
    q7 = db.Column(db.String(10))
>>>>>>> f5299313a038d289890686694e2a9375109334ad
