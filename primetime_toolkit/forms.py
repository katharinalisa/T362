from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Email, Length, ValidationError
import re

def password_complexity(form, field):
    password = field.data
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        raise ValidationError('Password must include both letters and numbers.')
    
class RegisterForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired(), Length(min=2, max=150)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=8)])
