from app import db

class Schedule(db.Model):
    __tablename__ = 'schedule'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_number = db.Column(db.String, nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    resources_used = db.Column(db.String, nullable=False)

class Calendar(db.Model):
    __tablename__ = 'calendar'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    weekday = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

class Resource(db.Model):
    __tablename__ = 'resource'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(1), nullable=False, default='H')  # 'H' for humans, 'M' for machines

class ResourceGroup(db.Model):
    __tablename__ = 'resource_group'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False)

class ResourceGroupAssociation(db.Model):
    __tablename__ = 'resource_group_association'
    resource_id = db.Column(db.Integer, db.ForeignKey('resource.id'), primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('resource_group.id'), primary_key=True)
    resource = db.relationship('Resource', backref='group_associations')
    group = db.relationship('ResourceGroup', backref='resource_associations')

class Template(db.Model):
    __tablename__ = 'template'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255))

class TemplateMaterial(db.Model):
    __tablename__ = 'template_material'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    template_id = db.Column(db.Integer, db.ForeignKey('template.id'), nullable=False)
    material_name = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(50), nullable=False)
    template = db.relationship('Template', backref='materials')

class TemplateTask(db.Model):
    __tablename__ = 'template_task'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    template_id = db.Column(db.Integer, db.ForeignKey('template.id'), nullable=False)
    task_number = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    setup_time = db.Column(db.Integer, nullable=False)
    time_each = db.Column(db.Float, nullable=False)
    predecessors = db.Column(db.String(255))
    resources = db.Column(db.String(255))
    template = db.relationship('Template', backref='tasks')