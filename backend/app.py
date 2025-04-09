from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Serve React static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))
    static_dir = os.path.join(build_dir, 'static')

    if path.startswith('static/'):
        return send_from_directory(static_dir, path[len('static/'):])

    # Serve favicon or other static files
    full_path = os.path.join(build_dir, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(build_dir, path)

    # All other routes should return index.html (for React Router)
    return send_from_directory(build_dir, 'index.html')

# Import routes (do this after app initialization to avoid circular imports)
from routes import *
