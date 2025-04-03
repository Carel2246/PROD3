from app import app, db, logger
from models import Schedule, Calendar, Resource, ResourceGroup, ResourceGroupAssociation, Template, TemplateMaterial, TemplateTask
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
            'description': t.description
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
            description=data.get('description', '')
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
            'material_name': m.material_name,
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
            material_name=data['material_name'],
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
        material.material_name = data['material_name']
        material.quantity = data['quantity']
        material.unit = data['unit']
        db.session.commit()
        logger.info(f"Updated template material with id {id}")
        return jsonify({'message': 'Template material updated successfully'})
    except Exception as e:
        logger.error(f"Error updating template material: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/template_material/<int:id>', methods=['DELETE'], endpoint='delete_template_material')
def delete_template_material(id):
    try:
        material = TemplateMaterial.query.get_or_404(id)
        db.session.delete(material)
        db.session.commit()
        logger.info(f"Deleted template material with id {id}")
        return jsonify({'message': 'Template material deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting template material: {str(e)}")
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