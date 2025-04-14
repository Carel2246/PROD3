from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os
import logging

# Load env
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)
CORS(app)

# DB config
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError("DATABASE_URL is not set")
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Build path
build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))

# ✅ Handle /static/* directly from build folder
@app.route('/static/<path:filename>')
def serve_static(filename):
    logger.info(f"[serve_static] Serving static file: {filename}")
    static_dir = os.path.join(build_dir, 'static')
    return send_from_directory(static_dir, filename)

# Other static files (manifest, logo, etc)
@app.route('/<path:path>')
def serve_react_files(path):
    logger.info(f"[serve_react_files] Requested path: {path}")
    if path.startswith('static/'):
        return serve_static(path.replace('static/', '', 1))
    full_path = os.path.join(build_dir, path)
    if os.path.exists(full_path):
        logger.info(f"[serve_react_files] Found file, serving: {full_path}")
        return send_from_directory(build_dir, path)
    logger.info("[serve_react_files] Fallback to index.html")
    return send_from_directory(build_dir, 'index.html')

# Serve /
@app.route('/')
def serve_index():
    logger.info("[serve_index] Serving index.html")
    return send_from_directory(build_dir, 'index.html')

# Load routes
from routes import *
