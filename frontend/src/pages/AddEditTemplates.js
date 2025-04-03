import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';

const AddEditTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '' });
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ material_name: '', quantity: '', unit: '' });
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    task_number: '',
    description: '',
    setup_time: '',
    time_each: '',
    predecessors: '',
    resources: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/api/template');
      setTemplates(response.data);
      if (response.data.length > 0) setSelectedTemplateId(response.data[0].id);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to fetch templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateDetails = async (templateId) => {
    if (!templateId) {
      setMaterials([]);
      setTasks([]);
      setNewTemplate({ name: '', description: '' });
      return;
    }
    try {
      const [materialsResponse, tasksResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/template_material/${templateId}`),
        axios.get(`http://localhost:5000/api/template_task/${templateId}`)
      ]);
      setMaterials(materialsResponse.data);
      setTasks(tasksResponse.data);
      const template = templates.find(t => t.id === parseInt(templateId));
      if (template) {
        setNewTemplate({ name: template.name, description: template.description });
      } else {
        setNewTemplate({ name: '', description: '' });
      }
    } catch (error) {
      console.error('Error fetching template details:', error);
      if (error.response && error.response.status === 404) {
        setMaterials([]);
        setTasks([]);
        setError(`Template with ID ${templateId} not found.`);
      } else {
        setError('Failed to fetch template details. Please try again.');
      }
    }
  };

  useEffect(() => {
    fetchTemplateDetails(selectedTemplateId);
  }, [selectedTemplateId, templates]);

  const handleAddTemplate = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/template', newTemplate);
      setTemplates([...templates, { id: response.data.id, ...newTemplate }]);
      setSelectedTemplateId(response.data.id);
      setNewTemplate({ name: '', description: '' });
    } catch (error) {
      console.error('Error adding template:', error);
      setError('Failed to add template. Please try again.');
    }
  };

  const handleUpdateTemplate = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/template/${id}`, newTemplate);
      setTemplates(templates.map(t => (t.id === id ? { id, ...newTemplate } : t)));
    } catch (error) {
      console.error('Error updating template:', error);
      setError('Failed to update template. Please try again.');
    }
  };

  const handleAddMaterial = async () => {
    try {
      const data = { ...newMaterial, template_id: selectedTemplateId, quantity: parseFloat(newMaterial.quantity) };
      const response = await axios.post('http://localhost:5000/api/template_material', data);
      setMaterials([...materials, { id: response.data.id, ...newMaterial, template_id: selectedTemplateId, quantity: parseFloat(newMaterial.quantity) }]);
      setNewMaterial({ material_name: '', quantity: '', unit: '' });
    } catch (error) {
      console.error('Error adding material:', error);
      setError('Failed to add material. Please try again.');
    }
  };

  const handleUpdateMaterial = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/template_material/${id}`, {
        ...newMaterial,
        quantity: parseFloat(newMaterial.quantity),
        template_id: selectedTemplateId
      });
      setMaterials(materials.map(m => (m.id === id ? { id, ...newMaterial, quantity: parseFloat(newMaterial.quantity) } : m)));
      setNewMaterial({ material_name: '', quantity: '', unit: '' });
    } catch (error) {
      console.error('Error updating material:', error);
      setError('Failed to update material. Please try again.');
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/template_material/${id}`);
      setMaterials(materials.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting material:', error);
      setError('Failed to delete material. Please try again.');
    }
  };

  const handleAddTask = async () => {
    try {
      const data = {
        ...newTask,
        template_id: selectedTemplateId,
        setup_time: parseInt(newTask.setup_time),
        time_each: parseFloat(newTask.time_each)
      };
      const response = await axios.post('http://localhost:5000/api/template_task', data);
      setTasks([...tasks, { id: response.data.id, ...newTask, template_id: selectedTemplateId, setup_time: parseInt(newTask.setup_time), time_each: parseFloat(newTask.time_each) }]);
      setNewTask({
        task_number: '',
        description: '',
        setup_time: '',
        time_each: '',
        predecessors: '',
        resources: ''
      });
    } catch (error) {
      console.error('Error adding task:', error);
      setError('Failed to add task. Please try again.');
    }
  };

  const handleUpdateTask = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/template_task/${id}`, {
        ...newTask,
        template_id: selectedTemplateId,
        setup_time: parseInt(newTask.setup_time),
        time_each: parseFloat(newTask.time_each)
      });
      setTasks(tasks.map(t => (t.id === id ? { id, ...newTask, setup_time: parseInt(newTask.setup_time), time_each: parseFloat(newTask.time_each) } : t)));
      setNewTask({
        task_number: '',
        description: '',
        setup_time: '',
        time_each: '',
        predecessors: '',
        resources: ''
      });
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/template_task/${id}`);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task. Please try again.');
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Templates</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="templateSelect">
              <Form.Label>Select Template</Form.Label>
              <Form.Control
                as="select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value === 'add' ? '' : e.target.value)}
              >
                <option value="add">Add New</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
        </Row>
      </Form>

      {(!selectedTemplateId || selectedTemplateId === '') && (
        <Form className="mb-4">
          <Row>
            <Col>
              <Form.Group controlId="templateName">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group controlId="templateDescription">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  type="text"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col className="align-self-end">
              <Button variant="primary" onClick={handleAddTemplate} disabled={!newTemplate.name}>
                Add Template
              </Button>
            </Col>
          </Row>
        </Form>
      )}

      {selectedTemplateId && selectedTemplateId !== 'add' && (
        <div>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="editTemplateName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="editTemplateDescription">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col className="align-self-end">
                <Button variant="primary" onClick={() => handleUpdateTemplate(selectedTemplateId)} disabled={!newTemplate.name}>
                  Update Template
                </Button>
              </Col>
            </Row>
          </Form>

          {/* Materials Subform */}
          <h3 className="mt-4">Materials</h3>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="materialName">
                  <Form.Label>Material Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMaterial.material_name}
                    onChange={(e) => setNewMaterial({ ...newMaterial, material_name: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="quantity">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="unit">
                  <Form.Label>Unit</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col className="align-self-end">
                <Button variant="primary" onClick={handleAddMaterial} disabled={!newMaterial.material_name || !newMaterial.quantity || !newMaterial.unit}>
                  Add Material
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Material Name</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td>{m.material_name}</td>
                  <td>{m.quantity}</td>
                  <td>{m.unit}</td>
                  <td>
                    <Button variant="warning" onClick={() => setNewMaterial(m)} className="me-2">Edit</Button>
                    <Button variant="danger" onClick={() => handleDeleteMaterial(m.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Tasks Subform */}
          <h3 className="mt-4">Tasks</h3>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="taskNumber">
                  <Form.Label>Task Number</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTask.task_number}
                    onChange={(e) => setNewTask({ ...newTask, task_number: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="description">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="setupTime">
                  <Form.Label>Setup Time</Form.Label>
                  <Form.Control
                    type="number"
                    value={newTask.setup_time}
                    onChange={(e) => setNewTask({ ...newTask, setup_time: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="timeEach">
                  <Form.Label>Time Each</Form.Label>
                  <Form.Control
                    type="number"
                    value={newTask.time_each}
                    onChange={(e) => setNewTask({ ...newTask, time_each: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="predecessors">
                  <Form.Label>Predecessors</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTask.predecessors}
                    onChange={(e) => setNewTask({ ...newTask, predecessors: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="resources">
                  <Form.Label>Resources</Form.Label>
                  <Form.Control
                    type="text"
                    value={newTask.resources}
                    onChange={(e) => setNewTask({ ...newTask, resources: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col className="align-self-end">
                <Button variant="primary" onClick={handleAddTask} disabled={!newTask.task_number || !newTask.description || !newTask.setup_time || !newTask.time_each}>
                  Add Task
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Task Number</th>
                <th>Description</th>
                <th>Setup Time</th>
                <th>Time Each</th>
                <th>Predecessors</th>
                <th>Resources</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>{t.task_number}</td>
                  <td>{t.description}</td>
                  <td>{t.setup_time}</td>
                  <td>{t.time_each}</td>
                  <td>{t.predecessors}</td>
                  <td>{t.resources}</td>
                  <td>
                    <Button variant="warning" onClick={() => setNewTask(t)} className="me-2">Edit</Button>
                    <Button variant="danger" onClick={() => handleDeleteTask(t.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AddEditTemplates;