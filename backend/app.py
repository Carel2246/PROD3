from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os
import logging

# Load environment variables from .env if present
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Database configuration
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError("DATABASE_URL is not set in environment.")
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# React static file serving
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))
    static_dir = os.path.join(build_dir, 'static')

    logger.info(f"[serve_react] Incoming path: {path}")
    logger.info(f"[serve_react] build_dir: {build_dir}")
    logger.info(f"[serve_react] static_dir: {static_dir}")

    # Serve static files under /static
    if path.startswith('static/'):
        subpath = path[7:]  # remove 'static/' prefix
        file_path = os.path.join(static_dir, subpath)
        logger.info(f"[serve_react] Serving from static: {file_path}")
        if os.path.exists(file_path):
            return send_from_directory(static_dir, subpath)
        else:
            logger.warning(f"[serve_react] Static file not found: {file_path}")

    # Serve top-level files (manifest.json, logo, etc.)
    full_path = os.path.join(build_dir, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        logger.info(f"[serve_react] Serving top-level file: {full_path}")
        return send_from_directory(build_dir, path)

    # Fallback for React Router
    logger.info("[serve_react] Falling back to index.html")
    return send_from_directory(build_dir, 'index.html')

# Import API routes
from routes import *
