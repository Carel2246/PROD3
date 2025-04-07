import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';

const AddEditTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateData, setTemplateData] = useState({ id: '', name: '', price_each: '' });
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    task_number: '',
    description: '',
    setup_time: '',
    time_each: '',
    predecessors: '',
    resources: ''
  });
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ description: '', quantity: '', unit: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:5000/api/template');
        setTemplates(response.data);
        if (response.data.length > 0) {
          setSelectedTemplateId(response.data[0].id.toString());
          setTemplateData({
            id: response.data[0].id,
            name: response.data[0].name,
            price_each: response.data[0].price_each
          });
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
        setError('Failed to fetch templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  // Fetch tasks and materials when a template is selected
  const fetchTemplateDetails = async (templateId) => {
    if (!templateId || templateId === 'add') {
      setTasks([]);
      setMaterials([]);
      setTemplateData({ id: '', name: '', price_each: '' });
      return;
    }
    try {
      const [tasksResponse, materialsResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/template_task/${templateId}`).catch(err => {
          console.error('Error fetching tasks:', err);
          return { data: [] };
        }),
        axios.get(`http://localhost:5000/api/template_material/${templateId}`).catch(err => {
          console.error('Error fetching materials:', err);
          return { data: [] };
        })
      ]);
      setTasks(tasksResponse.data);
      setMaterials(materialsResponse.data);
      const template = templates.find(t => t.id === parseInt(templateId));
      if (template) {
        setTemplateData({
          id: template.id,
          name: template.name,
          price_each: template.price_each
        });
      }
    } catch (error) {
      console.error('Error fetching template details:', error);
      setError('Failed to fetch template details. Please try again.');
      setTasks([]);
      setMaterials([]);
    }
  };

  useEffect(() => {
    fetchTemplateDetails(selectedTemplateId);
  }, [selectedTemplateId]);

  // Format price in ZAR (e.g., "R 1 234,56")
  const formatPrice = (value) => {
    if (!value && value !== 0) return 'R 0,00';
    const num = parseFloat(value);
    return `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Handle price input change (remove "R" and format)
  const handlePriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9,.]/g, ''); // Allow numbers, commas, and dots
    setTemplateData({ ...templateData, price_each: value });
  };

  const handleAddTemplate = async () => {
    try {
      const price = parseFloat(templateData.price_each) || 0.0;
      const response = await axios.post('http://localhost:5000/api/template', {
        name: templateData.name,
        description: '',
        price_each: price
      });
      const newTemplate = { id: response.data.id, name: templateData.name, price_each: price };
      setTemplates([...templates, newTemplate]);
      setSelectedTemplateId(response.data.id.toString());
      setTemplateData({ id: response.data.id, name: templateData.name, price_each: price });
    } catch (error) {
      console.error('Error adding template:', error);
      setError('Failed to add template. Please try again.');
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      const price = parseFloat(templateData.price_each) || 0.0;
      await axios.put(`http://localhost:5000/api/template/${selectedTemplateId}`, {
        name: templateData.name,
        description: '',
        price_each: price
      });
      setTemplates(templates.map(t => (t.id === parseInt(selectedTemplateId) ? { ...t, name: templateData.name, price_each: price } : t)));
    } catch (error) {
      console.error('Error updating template:', error);
      setError('Failed to update template. Please try again.');
    }
  };

  const handleAddTask = async () => {
    try {
      const data = {
        template_id: selectedTemplateId,
        task_number: newTask.task_number,
        description: newTask.description,
        setup_time: parseInt(newTask.setup_time),
        time_each: parseFloat(newTask.time_each),
        predecessors: newTask.predecessors,
        resources: newTask.resources
      };
      const response = await axios.post('http://localhost:5000/api/template_task', data);
      setTasks([...tasks, { id: response.data.id, ...data }]);
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

  const handleAddMaterial = async () => {
    try {
      const data = {
        template_id: selectedTemplateId,
        description: newMaterial.description,
        quantity: parseFloat(newMaterial.quantity),
        unit: newMaterial.unit
      };
      const response = await axios.post('http://localhost:5000/api/template_material', data);
      setMaterials([...materials, { id: response.data.id, ...data }]);
      setNewMaterial({ description: '', quantity: '', unit: '' });
    } catch (error) {
      console.error('Error adding material:', error);
      setError('Failed to add material. Please try again.');
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Templates</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Template Form */}
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="templateId">
              <Form.Label>ID</Form.Label>
              <Form.Control
                type="text"
                value={templateData.id}
                disabled
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="templateName">
              <Form.Label>Name</Form.Label>
              {selectedTemplateId === '' ? (
                <Form.Control
                  type="text"
                  value={templateData.name}
                  onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                  placeholder="Enter template name"
                />
              ) : (
                <Form.Control
                  as="select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value === 'add' ? '' : e.target.value)}
                >
                  <option value="add">Add new template</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Form.Control>
              )}
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="priceEach">
              <Form.Label>Price Each (ZAR)</Form.Label>
              <Form.Control
                type="text"
                value={formatPrice(templateData.price_each)}
                onChange={handlePriceChange}
              />
            </Form.Group>
          </Col>
          <Col className="align-self-end">
            <Button
              variant="primary"
              onClick={selectedTemplateId === '' ? handleAddTemplate : handleUpdateTemplate}
              disabled={!templateData.name}
            >
              {selectedTemplateId === '' ? 'Add Template' : 'Update Template'}
            </Button>
          </Col>
        </Row>
      </Form>

      {/* Only show subforms if a template is selected */}
      {selectedTemplateId && selectedTemplateId !== 'add' && (
        <div>
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
                <Button
                  variant="primary"
                  onClick={handleAddTask}
                  disabled={!newTask.task_number || !newTask.description || !newTask.setup_time || !newTask.time_each}
                >
                  Add Task
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Template ID</th>
                <th>Task Number</th>
                <th>Description</th>
                <th>Setup Time</th>
                <th>Time Each</th>
                <th>Predecessors</th>
                <th>Resources</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.template_id}</td>
                  <td>{t.task_number}</td>
                  <td>{t.description}</td>
                  <td>{t.setup_time}</td>
                  <td>{t.time_each}</td>
                  <td>{t.predecessors}</td>
                  <td>{t.resources}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Materials Subform */}
          <h3 className="mt-4">Materials</h3>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="description">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMaterial.description}
                    onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
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
                <Button
                  variant="primary"
                  onClick={handleAddMaterial}
                  disabled={!newMaterial.description || !newMaterial.quantity || !newMaterial.unit}
                >
                  Add Material
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>{m.description}</td>
                  <td>{m.quantity}</td>
                  <td>{m.unit}</td>
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