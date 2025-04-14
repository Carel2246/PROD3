from flask import Flask, send_from_directory, abort
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

# Configure database
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError("DATABASE_URL is not set in environment.")
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Path to built React frontend
build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))
static_dir = os.path.join(build_dir, 'static')

# Serve React static files
@app.route('/static/<path:filename>')
def serve_static(filename):
    logger.info(f"[serve_static] Serving static file: {filename}")
    return send_from_directory(static_dir, filename)

# Serve React top-level files (e.g., manifest.json, logo192.png)
@app.route('/<path:path>')
def serve_file_or_index(path):
    full_path = os.path.join(build_dir, path)
    logger.info(f"[serve_file_or_index] Requested path: {path}")
    if os.path.exists(full_path) and os.path.isfile(full_path):
        logger.info(f"[serve_file_or_index] Serving file: {full_path}")
        return send_from_directory(build_dir, path)
    logger.info(f"[serve_file_or_index] Falling back to index.html")
    return send_from_directory(build_dir, 'index.html')

# Serve root path
@app.route('/')
def serve_root():
    logger.info("[serve_root] Serving index.html")
    return send_from_directory(build_dir, 'index.html')

# Load your API routes
from routes import *
