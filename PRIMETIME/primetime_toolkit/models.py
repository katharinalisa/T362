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
=======
from . import db

class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    q1 = db.Column(db.Integer)
    q2 = db.Column(db.Integer)
    q3 = db.Column(db.Integer)
    q4 = db.Column(db.Integer)
    q5 = db.Column(db.Integer)
    q6 = db.Column(db.Integer)
    q7 = db.Column(db.Integer)
>>>>>>> ff88854546e97d6e240cd8c57bec40424859159a
