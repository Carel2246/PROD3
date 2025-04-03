from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
import logging
from flask_cors import CORS


# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the database connection to Azure PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Temporary test route to verify database connection
@app.route('/test-db')
def test_db():
    # Import Schedule here to avoid circular import
    from models import Schedule
    try:
        result = db.session.query(Schedule).first()
        if result:
            return f"Database connection successful! First record: {result.task_number}"
        else:
            return "Database connection successful! No records found in schedule table."
    except Exception as e:
        return f"Database connection failed: {str(e)}"

# Import routes after app and db are initialized to avoid circular imports
from routes import *

# Log successful startup
logger.info("Flask app started successfully")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)