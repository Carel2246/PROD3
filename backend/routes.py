from app import app, db, logger
from models import Schedule, Calendar
from flask import jsonify

@app.route('/')
def home():
    return "Timely Scheduler Backend"

@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    try:
        logger.info("Fetching schedule data")
        schedules = Schedule.query.all()
        return jsonify([{
            'task_number': s.task_number,
            'start_time': s.start_time.isoformat(),
            'end_time': s.end_time.isoformat(),
            'resources_used': s.resources_used
        } for s in schedules])
    except Exception as e:
        logger.error(f"Error fetching schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/working_hours', methods=['GET'])
def get_working_hours():
    try:
        logger.info("Fetching working hours")
        hours = Calendar.query.all()
        return jsonify([{
            'weekday': h.weekday,
            'start_time': h.start_time.strftime('%H:%M'),
            'end_time': h.end_time.strftime('%H:%M')
        } for h in hours])
    except Exception as e:
        logger.error(f"Error fetching working hours: {str(e)}")
        return jsonify({'error': str(e)}), 500