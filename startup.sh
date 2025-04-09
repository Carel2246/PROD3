#!/bin/bash

# Log for debugging
echo "Running startup.sh"

# Install Python dependencies
pip install -r backend/requirements.txt

# Run the Flask app with Gunicorn
cd backend
gunicorn app:app --bind=0.0.0.0:$PORT
