import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Form, Row, Col } from 'react-bootstrap';

const AddEditResources = () => {
  const [resources, setResources] = useState([]);
  const [newResource, setNewResource] = useState({ name: '', type: 'H' }); // Default to 'H' (human)
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/resource');
      setResources(response.data);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/resource', { name: newResource.name, type: newResource.type });
      setResources([...resources, { id: response.data.id, ...newResource }]);
      setNewResource({ name: '', type: 'H' });
    } catch (error) {
      console.error('Error adding resource:', error);
    }
  };

  const handleEdit = (resource) => {
    setEditingId(resource.id);
    setNewResource({ name: resource.name, type: resource.type });
  };

  const handleUpdate = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/resource/${id}`, { name: newResource.name, type: newResource.type });
      setResources(resources.map(r => (r.id === id ? { id, ...newResource } : r)));
      setEditingId(null);
      setNewResource({ name: '', type: 'H' });
    } catch (error) {
      console.error('Error updating resource:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/resource/${id}`);
      setResources(resources.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting resource:', error);
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Resources</h2>
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="type">
              <Form.Label>Type</Form.Label>
              <Form.Control
                as="select"
                value={newResource.type}
                onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
              >
                <option value="H">Human</option>
                <option value="M">Machine</option>
              </Form.Control>
            </Form.Group>
          </Col>
          <Col className="align-self-end">
            <Button
              variant="primary"
              onClick={editingId ? () => handleUpdate(editingId) : handleAdd}
              disabled={!newResource.name}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Col>
        </Row>
      </Form>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map(resource => (
            <tr key={resource.id}>
              <td>{resource.name}</td>
              <td>{resource.type === 'H' ? 'Human' : 'Machine'}</td>
              <td>
                <Button variant="warning" onClick={() => handleEdit(resource)} className="me-2">Edit</Button>
                <Button variant="danger" onClick={() => handleDelete(resource.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default AddEditResources;