from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os
import logging

if __name__ == '__main__' or not globals().get('app'):
    load_dotenv()
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    app = Flask(__name__)
    CORS(app)

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL') or 'raise RuntimeError("DATABASE_URL not set")'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db = SQLAlchemy(app)

    build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'frontend'))

    @app.route('/static/<path:filename>', endpoint='serve_static')
    def serve_static(filename):
        logger.info(f"Serving static file: {filename}")
        return send_from_directory(os.path.join(build_dir, 'static'), filename)

    @app.route('/<path:path>')
    def serve_react_files(path):
        logger.debug(f"Requested path: {path}")
        if path.startswith('api/'):
            logger.error(f"API path {path} not found")
            return jsonify({'error': 'API endpoint not found'}), 404
        if path.startswith('static/'):
            return serve_static(path.replace('static/', '', 1))
        full_path = os.path.join(build_dir, path)
        if os.path.exists(full_path):
            logger.info(f"Serving file: {full_path}")
            return send_from_directory(build_dir, path)
        logger.info("Falling back to index.html")
        return send_from_directory(build_dir, 'index.html')

    @app.route('/')
    def serve_index():
        logger.info("Serving index.html")
        return send_from_directory(build_dir, 'index.html')

    # Import routes after app setup
    from routes import *

if __name__ == '__main__':
    app.run(debug=True, port=5000)