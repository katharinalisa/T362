from flask import Blueprint, render_template

views = Blueprint('views', __name__)
print("__name__ : ",__name__)

@views.route('/')
def home():
    return render_template('index.html')

@views.route('/budget')
def budget():
    return render_template('budget.html')

@views.route('/category')
def category():
    return render_template('category.html')

@views.route('/category/financial')
def financial():
    return render_template('/diagnostic/financial.html')

@views.route('/category/careertransition')
def financial():
    return render_template('/diagnostic/careertransition.html')

