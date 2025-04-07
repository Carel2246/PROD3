from app import app, db, logger
from datetime import datetime
from models import Schedule, Calendar, Resource, ResourceGroup, ResourceGroupAssociation, Template, TemplateMaterial, TemplateTask, Job, Task, Material
from flask import jsonify, request

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

# Calendar Endpoints
@app.route('/api/calendar', methods=['GET'], endpoint='get_calendar')
def get_calendar():
    try:
        logger.info("Fetching calendar data")
        calendar = Calendar.query.all()
        return jsonify([{
            'id': c.id,
            'weekday': c.weekday,
            'start_time': c.start_time.strftime('%H:%M'),
            'end_time': c.end_time.strftime('%H:%M')
        } for c in calendar])
    except Exception as e:
        logger.error(f"Error fetching calendar: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/calendar', methods=['POST'], endpoint='add_calendar')
def add_calendar():
    try:
        data = request.get_json()
        new_entry = Calendar(
            weekday=data['weekday'],
            start_time=data['start_time'],
            end_time=data['end_time']
        )
        db.session.add(new_entry)
        db.session.commit()
        logger.info("Added new calendar entry")
        return jsonify({'message': 'Calendar entry added successfully', 'id': new_entry.id}), 201
    except Exception as e:
        logger.error(f"Error adding calendar entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/calendar/<int:id>', methods=['PUT'], endpoint='update_calendar')
def update_calendar(id):
    try:
        data = request.get_json()
        entry = Calendar.query.get_or_404(id)
        entry.weekday = data['weekday']
        entry.start_time = data['start_time']
        entry.end_time = data['end_time']
        db.session.commit()
        logger.info(f"Updated calendar entry with id {id}")
        return jsonify({'message': 'Calendar entry updated successfully'})
    except Exception as e:
        logger.error(f"Error updating calendar entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/calendar/<int:id>', methods=['DELETE'], endpoint='delete_calendar')
def delete_calendar(id):
    try:
        entry = Calendar.query.get_or_404(id)
        db.session.delete(entry)
        db.session.commit()
        logger.info(f"Deleted calendar entry with id {id}")
        return jsonify({'message': 'Calendar entry deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting calendar entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Resource Endpoints
@app.route('/api/resource', methods=['GET'], endpoint='get_resources')
def get_resources():
    try:
        logger.info("Fetching resource data")
        resources = Resource.query.all()
        return jsonify([{
            'id': r.id,
            'name': r.name,
            'type': r.type
        } for r in resources])
    except Exception as e:
        logger.error(f"Error fetching resources: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource', methods=['POST'], endpoint='add_resource')
def add_resource():
    try:
        data = request.get_json()
        new_resource = Resource(name=data['name'], type=data['type'])
        db.session.add(new_resource)
        db.session.commit()
        logger.info("Added new resource")
        return jsonify({'message': 'Resource added successfully', 'id': new_resource.id}), 201
    except Exception as e:
        logger.error(f"Error adding resource: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource/<int:id>', methods=['PUT'], endpoint='update_resource')
def update_resource(id):
    try:
        data = request.get_json()
        resource = Resource.query.get_or_404(id)
        resource.name = data['name']
        resource.type = data['type']
        db.session.commit()
        logger.info(f"Updated resource with id {id}")
        return jsonify({'message': 'Resource updated successfully'})
    except Exception as e:
        logger.error(f"Error updating resource: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource/<int:id>', methods=['DELETE'], endpoint='delete_resource')
def delete_resource(id):
    try:
        resource = Resource.query.get_or_404(id)
        db.session.delete(resource)
        db.session.commit()
        logger.info(f"Deleted resource with id {id}")
        return jsonify({'message': 'Resource deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting resource: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Resource Group Endpoints
@app.route('/api/resource_group', methods=['GET'], endpoint='get_resource_groups')
def get_resource_groups():
    try:
        logger.info("Fetching resource group data")
        groups = ResourceGroup.query.all()
        return jsonify([{
            'id': g.id,
            'name': g.name,
            'resource_ids': [assoc.resource_id for assoc in g.resource_associations]
        } for g in groups])
    except Exception as e:
        logger.error(f"Error fetching resource groups: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource_group', methods=['POST'], endpoint='add_resource_group')
def add_resource_group():
    try:
        data = request.get_json()
        new_group = ResourceGroup(name=data['name'])
        db.session.add(new_group)
        db.session.commit()
        logger.info("Added new resource group")
        return jsonify({'message': 'Resource group added successfully', 'id': new_group.id}), 201
    except Exception as e:
        logger.error(f"Error adding resource group: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource_group/<int:id>', methods=['PUT'], endpoint='update_resource_group')
def update_resource_group(id):
    try:
        data = request.get_json()
        group = ResourceGroup.query.get_or_404(id)
        group.name = data['name']
        # Update associated resources
        ResourceGroupAssociation.query.filter_by(group_id=id).delete()
        for resource_id in data.get('resource_ids', []):
            assoc = ResourceGroupAssociation(resource_id=resource_id, group_id=id)
            db.session.add(assoc)
        db.session.commit()
        logger.info(f"Updated resource group with id {id}")
        return jsonify({'message': 'Resource group updated successfully'})
    except Exception as e:
        logger.error(f"Error updating resource group: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource_group/<int:id>', methods=['DELETE'], endpoint='delete_resource_group')
def delete_resource_group(id):
    try:
        group = ResourceGroup.query.get_or_404(id)
        db.session.delete(group)
        db.session.commit()
        logger.info(f"Deleted resource group with id {id}")
        return jsonify({'message': 'Resource group deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting resource group: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Template Endpoints
@app.route('/api/template', methods=['GET'], endpoint='get_templates')
def get_templates():
    try:
        logger.info("Fetching template data")
        templates = Template.query.all()
        return jsonify([{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'price_each': t.price_each
        } for t in templates])
    except Exception as e:
        logger.error(f"Error fetching templates: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template', methods=['POST'], endpoint='add_template')
def add_template():
    try:
        data = request.get_json()
        new_template = Template(
            name=data['name'],
            description=data.get('description', ''),
            price_each=data.get('price_each', 0.0)
        )
        db.session.add(new_template)
        db.session.commit()
        logger.info("Added new template")
        return jsonify({'message': 'Template added successfully', 'id': new_template.id}), 201
    except Exception as e:
        logger.error(f"Error adding template: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template/<int:id>', methods=['PUT'], endpoint='update_template')
def update_template(id):
    try:
        data = request.get_json()
        template = Template.query.get_or_404(id)
        template.name = data['name']
        template.description = data.get('description', '')
        template.price_each = data.get('price_each', 0.0)  # Added price_each
        db.session.commit()
        logger.info(f"Updated template with id {id}")
        return jsonify({'message': 'Template updated successfully'})
    except Exception as e:
        logger.error(f"Error updating template: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template/<int:id>', methods=['DELETE'], endpoint='delete_template')
def delete_template(id):
    try:
        template = Template.query.get_or_404(id)
        db.session.delete(template)
        db.session.commit()
        logger.info(f"Deleted template with id {id}")
        return jsonify({'message': 'Template deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Template Materials Endpoints
@app.route('/api/template_material/<int:template_id>', methods=['GET'], endpoint='get_template_materials')
def get_template_materials(template_id):
    try:
        logger.info(f"Fetching materials for template {template_id}")
        # Verify the template exists
        template = Template.query.get(template_id)
        if not template:
            logger.warning(f"Template with id {template_id} not found")
            return jsonify({'error': 'Template not found'}), 404

        materials = TemplateMaterial.query.filter_by(template_id=template_id).all()
        return jsonify([{
            'id': m.id,
            'template_id': m.template_id,
            'description': m.description,  # Changed from material_name to description
            'quantity': m.quantity,
            'unit': m.unit
        } for m in materials])
    except Exception as e:
        logger.error(f"Error fetching template materials: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_material', methods=['POST'], endpoint='add_template_material')
def add_template_material():
    try:
        data = request.get_json()
        new_material = TemplateMaterial(
            template_id=data['template_id'],
            description=data['description'],  # Changed from material_name to description
            quantity=data['quantity'],
            unit=data['unit']
        )
        db.session.add(new_material)
        db.session.commit()
        logger.info("Added new template material")
        return jsonify({'message': 'Template material added successfully', 'id': new_material.id}), 201
    except Exception as e:
        logger.error(f"Error adding template material: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_material/<int:id>', methods=['PUT'], endpoint='update_template_material')
def update_template_material(id):
    try:
        data = request.get_json()
        material = TemplateMaterial.query.get_or_404(id)
        material.description = data['description']  # Changed from material_name to description
        material.quantity = data['quantity']
        material.unit = data['unit']
        db.session.commit()
        logger.info(f"Updated template material with id {id}")
        return jsonify({'message': 'Template material updated successfully'})
    except Exception as e:
        logger.error(f"Error updating template material: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Template Tasks Endpoints
@app.route('/api/template_task/<int:template_id>', methods=['GET'], endpoint='get_template_tasks')
def get_template_tasks(template_id):
    try:
        logger.info(f"Fetching tasks for template {template_id}")
        # Verify the template exists
        template = Template.query.get(template_id)
        if not template:
            logger.warning(f"Template with id {template_id} not found")
            return jsonify({'error': 'Template not found'}), 404

        tasks = TemplateTask.query.filter_by(template_id=template_id).all()
        return jsonify([{
            'id': t.id,
            'template_id': t.template_id,
            'task_number': t.task_number,
            'description': t.description,
            'setup_time': t.setup_time,
            'time_each': t.time_each,
            'predecessors': t.predecessors,
            'resources': t.resources
        } for t in tasks])
    except Exception as e:
        logger.error(f"Error fetching template tasks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_task', methods=['POST'], endpoint='add_template_task')
def add_template_task():
    try:
        data = request.get_json()
        new_task = TemplateTask(
            template_id=data['template_id'],
            task_number=data['task_number'],
            description=data['description'],
            setup_time=data['setup_time'],
            time_each=data['time_each'],
            predecessors=data.get('predecessors', ''),
            resources=data.get('resources', '')
        )
        db.session.add(new_task)
        db.session.commit()
        logger.info("Added new template task")
        return jsonify({'message': 'Template task added successfully', 'id': new_task.id}), 201
    except Exception as e:
        logger.error(f"Error adding template task: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_task/<int:id>', methods=['PUT'], endpoint='update_template_task')
def update_template_task(id):
    try:
        data = request.get_json()
        task = TemplateTask.query.get_or_404(id)
        task.task_number = data['task_number']
        task.description = data['description']
        task.setup_time = data['setup_time']
        task.time_each = data['time_each']
        task.predecessors = data.get('predecessors', '')
        task.resources = data.get('resources', '')
        db.session.commit()
        logger.info(f"Updated template task with id {id}")
        return jsonify({'message': 'Template task updated successfully'})
    except Exception as e:
        logger.error(f"Error updating template task: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_task/<int:id>', methods=['DELETE'], endpoint='delete_template_task')
def delete_template_task(id):
    try:
        task = TemplateTask.query.get_or_404(id)
        db.session.delete(task)
        db.session.commit()
        logger.info(f"Deleted template task with id {id}")
        return jsonify({'message': 'Template task deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting template task: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Job Endpoints
@app.route('/api/job/<int:id>', methods=['GET', 'PUT', 'DELETE'], endpoint='manage_job')
def manage_job(id):
    if request.method == 'GET':
        try:
            logger.info(f"Fetching job with id {id}")
            job = Job.query.get_or_404(id)
            return jsonify({
                'id': job.id,
                'job_number': job.job_number,
                'description': job.description,
                'order_date': job.order_date.isoformat() if job.order_date else None,
                'promised_date': job.promised_date.isoformat() if job.promised_date else None,
                'quantity': job.quantity,
                'price_each': job.price_each,
                'customer': job.customer,
                'completed': job.completed,
                'blocked': job.blocked
            })
        except Exception as e:
            logger.error(f"Error fetching job: {str(e)}")
            return jsonify({'error': str(e)}), 404

    elif request.method == 'PUT':
        try:
            data = request.get_json()
            job = Job.query.get_or_404(id)
            old_job_number = job.job_number
            new_job_number = data['job_number']

            # Check if the new job_number already exists (excluding the current job)
            existing_job = Job.query.filter(Job.job_number == new_job_number, Job.id != id).first()
            if existing_job:
                logger.error(f"Job number {new_job_number} already exists for another job (ID: {existing_job.id})")
                return jsonify({'error': f"Job number '{new_job_number}' already exists."}), 400

            # Update the job_number in related Task and Material records first
            if old_job_number != new_job_number:
                # Update tasks
                tasks = Task.query.filter_by(job_number=old_job_number).all()
                for task in tasks:
                    task.job_number = new_job_number
                # Update materials
                materials = Material.query.filter_by(job_number=old_job_number).all()
                for material in materials:
                    material.job_number = new_job_number

            # Now update the job
            job.job_number = new_job_number
            job.description = data['description']
            job.order_date = datetime.fromisoformat(data['order_date']) if data['order_date'] else None
            job.promised_date = datetime.fromisoformat(data['promised_date']) if data['promised_date'] else None
            job.quantity = data['quantity']
            job.price_each = data['price_each']
            job.customer = data['customer']
            job.completed = data['completed']
            job.blocked = data['blocked']

            db.session.commit()
            logger.info(f"Updated job with id {id}")
            return jsonify({'message': 'Job updated successfully'})
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating job: {str(e)}")
            return jsonify({'error': f"Failed to update job: {str(e)}"}), 500

    elif request.method == 'DELETE':
        try:
            job = Job.query.get_or_404(id)
            # Delete associated tasks
            Task.query.filter_by(job_number=job.job_number).delete()
            # Delete associated materials
            Material.query.filter_by(job_number=job.job_number).delete()
            # Delete the job
            db.session.delete(job)
            db.session.commit()
            logger.info(f"Deleted job with id {id} and its associated tasks and materials")
            return jsonify({'message': 'Job and associated records deleted successfully'})
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting job: {str(e)}")
            return jsonify({'error': f"Failed to delete job: {str(e)}"}), 500

@app.route('/api/job', methods=['GET'], endpoint='get_jobs')
def get_jobs():
    try:
        logger.info("Fetching job data")
        # Get query parameters for filtering
        include_completed = request.args.get('include_completed', 'false').lower() == 'true'
        include_blocked = request.args.get('include_blocked', 'false').lower() == 'true'

        query = Job.query
        if not include_completed:
            query = query.filter_by(completed=False)
        if not include_blocked:
            query = query.filter_by(blocked=False)

        jobs = query.all()
        return jsonify([{
            'id': j.id,
            'job_number': j.job_number,
            'description': j.description,
            'order_date': j.order_date.isoformat() if j.order_date else None,
            'promised_date': j.promised_date.isoformat() if j.promised_date else None,
            'quantity': j.quantity,
            'price_each': j.price_each,
            'customer': j.customer,
            'completed': j.completed,
            'blocked': j.blocked
        } for j in jobs])
    except Exception as e:
        logger.error(f"Error fetching jobs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/job', methods=['POST'], endpoint='add_job')
def add_job():
    try:
        data = request.get_json()
        new_job = Job(
            job_number=data['job_number'],
            description=data['description'],
            order_date=datetime.fromisoformat(data['order_date']) if data['order_date'] else None,
            promised_date=datetime.fromisoformat(data['promised_date']) if data['promised_date'] else None,
            quantity=data['quantity'],
            price_each=data['price_each'],
            customer=data['customer'],
            completed=data['completed'],
            blocked=data['blocked']
        )
        db.session.add(new_job)
        db.session.commit()
        logger.info("Added new job")
        return jsonify({'message': 'Job added successfully', 'id': new_job.id}), 201
    except Exception as e:
        logger.error(f"Error adding job: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Task Endpoints
@app.route('/api/task', methods=['GET'], endpoint='get_tasks')
def get_tasks():
    try:
        logger.info("Fetching task data")
        tasks = Task.query.join(Job, Task.job_number == Job.job_number).all()
        return jsonify([{
            'id': t.id,
            'task_number': t.task_number,
            'job_number': t.job_number,
            'job_description': t.job.description,  # Added job description
            'description': t.description,
            'setup_time': t.setup_time,
            'time_each': t.time_each,
            'predecessors': t.predecessors,
            'resources': t.resources,
            'completed': t.completed
        } for t in tasks])
    except Exception as e:
        logger.error(f"Error fetching tasks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/task/<int:id>', methods=['PUT'], endpoint='update_task')
def update_task(id):
    try:
        data = request.get_json()
        task = Task.query.get_or_404(id)
        task.task_number = data['task_number']
        task.job_number = data['job_number']
        task.description = data['description']
        task.setup_time = data['setup_time']
        task.time_each = data['time_each']
        task.predecessors = data['predecessors']
        task.resources = data['resources']
        task.completed = data['completed']
        db.session.commit()
        logger.info(f"Updated task with id {id}")
        return jsonify({'message': 'Task updated successfully'})
    except Exception as e:
        logger.error(f"Error updating task: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/task/by_job/<job_number>', methods=['GET'], endpoint='get_tasks_by_job')
def get_tasks_by_job(job_number):
    try:
        logger.info(f"Fetching tasks for job {job_number}")
        tasks = Task.query.filter_by(job_number=job_number).all()
        return jsonify([{
            'id': t.id,
            'task_number': t.task_number,
            'job_number': t.job_number,
            'description': t.description,
            'setup_time': t.setup_time,
            'time_each': t.time_each,
            'predecessors': t.predecessors,
            'resources': t.resources,
            'completed': t.completed
        } for t in tasks])
    except Exception as e:
        logger.error(f"Error fetching tasks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/task', methods=['POST'], endpoint='add_task')
def add_task():
    try:
        data = request.get_json()
        new_task = Task(
            task_number=data['task_number'],
            job_number=data['job_number'],
            description=data['description'],
            setup_time=data['setup_time'],
            time_each=data['time_each'],
            predecessors=data['predecessors'],
            resources=data['resources'],
            completed=data['completed']
        )
        db.session.add(new_task)
        db.session.commit()
        logger.info("Added new task")
        return jsonify({'message': 'Task added successfully', 'id': new_task.id}), 201
    except Exception as e:
        logger.error(f"Error adding task: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/task/<int:id>', methods=['PUT', 'DELETE'], endpoint='manage_task')
def manage_task(id):
    if request.method == 'PUT':
        try:
            data = request.get_json()
            task = Task.query.get_or_404(id)
            task.task_number = data['task_number']
            task.job_number = data['job_number']
            task.description = data['description']
            task.setup_time = data['setup_time']
            task.time_each = data['time_each']
            task.predecessors = data['predecessors']
            task.resources = data['resources']
            task.completed = data['completed']
            db.session.commit()
            logger.info(f"Updated task with id {id}")
            return jsonify({'message': 'Task updated successfully'})
        except Exception as e:
            logger.error(f"Error updating task: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            task = Task.query.get_or_404(id)
            db.session.delete(task)
            db.session.commit()
            logger.info(f"Deleted task with id {id}")
            return jsonify({'message': 'Task deleted successfully'})
        except Exception as e:
            logger.error(f"Error deleting task: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
# Material Endpoints
@app.route('/api/material/by_job/<job_number>', methods=['GET'], endpoint='get_materials_by_job')
def get_materials_by_job(job_number):
    try:
        logger.info(f"Fetching materials for job {job_number}")
        materials = Material.query.filter_by(job_number=job_number).all()
        return jsonify([{
            'id': m.id,
            'job_number': m.job_number,
            'description': m.description,
            'quantity': m.quantity,
            'unit': m.unit
        } for m in materials])
    except Exception as e:
        logger.error(f"Error fetching materials: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/material', methods=['POST'], endpoint='add_material')
def add_material():
    try:
        data = request.get_json()
        new_material = Material(
            job_number=data['job_number'],
            description=data['description'],
            quantity=data['quantity'],
            unit=data['unit']
        )
        db.session.add(new_material)
        db.session.commit()
        logger.info("Added new material")
        return jsonify({'message': 'Material added successfully', 'id': new_material.id}), 201
    except Exception as e:
        logger.error(f"Error adding material: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/material/<int:id>', methods=['PUT', 'DELETE'], endpoint='manage_material')
def manage_material(id):
    if request.method == 'PUT':
        try:
            data = request.get_json()
            material = Material.query.get_or_404(id)
            material.job_number = data['job_number']
            material.description = data['description']
            material.quantity = data['quantity']
            material.unit = data['unit']
            db.session.commit()
            logger.info(f"Updated material with id {id}")
            return jsonify({'message': 'Material updated successfully'})
        except Exception as e:
            logger.error(f"Error updating material: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            material = Material.query.get_or_404(id)
            db.session.delete(material)
            db.session.commit()
            logger.info(f"Deleted material with id {id}")
            return jsonify({'message': 'Material deleted successfully'})
        except Exception as e:
            logger.error(f"Error deleting material: {str(e)}")
            return jsonify({'error': str(e)}), 500