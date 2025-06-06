import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Row, Col, Table } from 'react-bootstrap';
import ReactFlow, { Background, Controls, Handle } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

// Custom Node Component (shared or included for completeness)
const CustomNode = ({ data, id }) => {
  return (
    <div
      style={{
        background: data.completed ? '#28a745' : '#fff',
        color: data.completed ? '#fff' : '#000',
        border: '1px solid #222',
        width: 200,
        height: 60,
        borderRadius: 5,
        padding: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '20%' }}
        id={`${id}-left-top`}
      />
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '50%' }}
        id={`${id}-left-middle`}
      />
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '80%' }}
        id={`${id}-left-bottom`}
      />
      <div>{data.label}</div>
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '20%' }}
        id={`${id}-right-top`}
      />
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '50%' }}
        id={`${id}-right-middle`}
      />
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '80%' }}
        id={`${id}-right-bottom`}
      />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

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
  const [editTask, setEditTask] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ description: '', quantity: '', unit: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [flowchartElements, setFlowchartElements] = useState({ nodes: [], edges: [] });

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
      setFlowchartElements({ nodes: [], edges: [] });
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

  // Generate flowchart for tasks
  useEffect(() => {
    if (tasks.length === 0) {
      setFlowchartElements({ nodes: [], edges: [] });
      return;
    }

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({ rankdir: 'LR' });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 200;
    const nodeHeight = 60;

    tasks.forEach(task => {
      dagreGraph.setNode(task.task_number, { width: nodeWidth, height: nodeHeight });
    });

    tasks.forEach(task => {
      if (task.predecessors) {
        const predecessorList = task.predecessors.split(',').map(p => p.trim());
        predecessorList.forEach(predecessor => {
          if (tasks.some(t => t.task_number === predecessor)) {
            dagreGraph.setEdge(predecessor, task.task_number);
          }
        });
      }
    });

    dagre.layout(dagreGraph);

    const nodes = tasks.map(task => {
      const nodeWithPosition = dagreGraph.node(task.task_number);
      return {
        id: task.task_number,
        type: 'custom',
        data: {
          label: `${task.task_number} - ${task.description}`,
          completed: false // Templates don't track completion
        },
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2
        }
      };
    });

    const edges = [];
    const sourceHandleCounts = new Map();
    const targetHandleCounts = new Map();

    tasks.forEach(task => {
      ['right-top', 'right-middle', 'right-bottom'].forEach(handle => {
        sourceHandleCounts.set(`${task.task_number}-${handle}`, 0);
      });
      ['left-top', 'left-middle', 'left-bottom'].forEach(handle => {
        targetHandleCounts.set(`${task.task_number}-${handle}`, 0);
      });
    });

    tasks.forEach(task => {
      if (task.predecessors) {
        const predecessorList = task.predecessors.split(',').map(p => p.trim());
        predecessorList.forEach(predecessor => {
          if (tasks.some(t => t.task_number === predecessor)) {
            const sourceHandles = [
              `${predecessor}-right-top`,
              `${predecessor}-right-middle`,
              `${predecessor}-right-bottom`
            ];
            const targetHandles = [
              `${task.task_number}-left-top`,
              `${task.task_number}-left-middle`,
              `${task.task_number}-left-bottom`
            ];

            let minSourceCount = Infinity;
            let selectedSourceHandle = sourceHandles[0];
            sourceHandles.forEach(handle => {
              const count = sourceHandleCounts.get(handle);
              if (count < minSourceCount) {
                minSourceCount = count;
                selectedSourceHandle = handle;
              }
            });

            let minTargetCount = Infinity;
            let selectedTargetHandle = targetHandles[0];
            targetHandles.forEach(handle => {
              const count = targetHandleCounts.get(handle);
              if (count < minTargetCount) {
                minTargetCount = count;
                selectedTargetHandle = handle;
              }
            });

            sourceHandleCounts.set(selectedSourceHandle, minSourceCount + 1);
            targetHandleCounts.set(selectedTargetHandle, minTargetCount + 1);

            edges.push({
              id: `e-${predecessor}-${task.task_number}`,
              source: predecessor,
              target: task.task_number,
              sourceHandle: selectedSourceHandle,
              targetHandle: selectedTargetHandle,
              type: 'bezier',
              style: { stroke: '#000', strokeWidth: 2 }
            });
          }
        });
      }
    });

    setFlowchartElements({ nodes, edges });
  }, [tasks]);

  // Format price in ZAR (e.g., "R 1 234,56")
  const formatPrice = (value) => {
    if (!value && value !== 0) return 'R 0,00';
    const num = parseFloat(value);
    return `R ${num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Handle price input change (remove "R" and format)
  const handlePriceChange = (e) => {
    const value = e.target.value.replace(/[^0-9,.]/g, '');
    setTemplateData({ ...templateData, price_each: value });
  };

  const handleEditTask = (task) => {
    setEditTask({ ...task });
  };

  const handleEditTaskChange = (e) => {
    const { name, value } = e.target;
    setEditTask({ ...editTask, [name]: value });
  };

  const handleSaveTask = async () => {
    try {
      await axios.put(`http://localhost:5000/api/template_task/${editTask.id}`, editTask);
      setTasks(tasks.map(t => (t.id === editTask.id ? editTask : t)));
      setEditTask(null);
      setError(null);
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`http://localhost:5000/api/template_task/${taskId}`);
      setTasks(tasks.filter(t => t.id !== taskId));
      setError(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task. Please try again.');
    }
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
                  {editTask && editTask.id === t.id ? (
                    <>
                      <td><Form.Control type="text" name="task_number" value={editTask.task_number} onChange={handleEditTaskChange} /></td>
                      <td><Form.Control type="text" name="description" value={editTask.description} onChange={handleEditTaskChange} /></td>
                      <td><Form.Control type="number" name="setup_time" value={editTask.setup_time} onChange={handleEditTaskChange} /></td>
                      <td><Form.Control type="number" step="0.01" name="time_each" value={editTask.time_each} onChange={handleEditTaskChange} /></td>
                      <td><Form.Control type="text" name="predecessors" value={editTask.predecessors} onChange={handleEditTaskChange} /></td>
                      <td><Form.Control type="text" name="resources" value={editTask.resources} onChange={handleEditTaskChange} /></td>
                      <td>
                        <Button variant="success" size="sm" onClick={handleSaveTask} className="me-2">Save</Button>
                        <Button variant="secondary" size="sm" onClick={() => setEditTask(null)}>Cancel</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{t.task_number}</td>
                      <td>{t.description}</td>
                      <td>{t.setup_time}</td>
                      <td>{t.time_each}</td>
                      <td>{t.predecessors}</td>
                      <td>{t.resources}</td>
                      <td>
                        <Button variant="info" size="sm" onClick={() => handleEditTask(t)} className="me-2">Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteTask(t.id)}>Delete</Button>
                      </td>
                    </>
                  )}
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

          {/* Task Flowchart */}
          <h3 className="mt-4">Task Flowchart</h3>
          {flowchartElements.nodes.length > 0 ? (
            <div style={{ height: '600px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <ReactFlow
                nodes={flowchartElements.nodes}
                edges={flowchartElements.edges}
                nodeTypes={nodeTypes}
                fitView
                style={{ width: '100%', height: '100%' }}
                defaultEdgeOptions={{ type: 'bezier', style: { stroke: '#000', strokeWidth: 2 } }}
              >
                <Background />
                <Controls />
              </ReactFlow>
            </div>
          ) : (
            <p>No tasks available to display in the flowchart.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AddEditTemplates;