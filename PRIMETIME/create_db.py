from primetime_toolkit import create_app, db
from primetime_toolkit.models import Assessment

app = create_app()

with app.app_context():
    db.create_all()
    print("Database created!")