import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Form, Row, Col, FormControl } from 'react-bootstrap';

const AddEditResourceGroups = () => {
  const [groups, setGroups] = useState([]);
  const [resources, setResources] = useState([]);
  const [newGroup, setNewGroup] = useState({ name: '', resource_ids: [] });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchResources();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/resource_group');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching resource groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/resource');
      setResources(response.data);
    } catch (error) {
      console.error('Error fetching resources:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/resource_group', {
        name: newGroup.name,
        resource_ids: newGroup.resource_ids
      });
      setGroups([...groups, { id: response.data.id, ...newGroup }]);
      setNewGroup({ name: '', resource_ids: [] });
    } catch (error) {
      console.error('Error adding resource group:', error);
    }
  };

  const handleEdit = (group) => {
    setEditingId(group.id);
    setNewGroup({ name: group.name, resource_ids: group.resource_ids });
  };

  const handleUpdate = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/resource_group/${id}`, {
        name: newGroup.name,
        resource_ids: newGroup.resource_ids
      });
      setGroups(groups.map(g => (g.id === id ? { id, ...newGroup } : g)));
      setEditingId(null);
      setNewGroup({ name: '', resource_ids: [] });
    } catch (error) {
      console.error('Error updating resource group:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/resource_group/${id}`);
      setGroups(groups.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting resource group:', error);
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Resource Groups</h2>
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="resources">
              <Form.Label>Resources</Form.Label>
              <FormControl
                as="select"
                multiple
                value={newGroup.resource_ids}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                  setNewGroup({ ...newGroup, resource_ids: selected });
                }}
              >
                {resources.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </FormControl>
            </Form.Group>
          </Col>
          <Col className="align-self-end">
            <Button
              variant="primary"
              onClick={editingId ? () => handleUpdate(editingId) : handleAdd}
              disabled={!newGroup.name}
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
            <th>Resources</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <tr key={group.id}>
              <td>{group.name}</td>
              <td>{group.resource_ids.map(id => resources.find(r => r.id === id)?.name).join(', ') || 'None'}</td>
              <td>
                <Button variant="warning" onClick={() => handleEdit(group)} className="me-2">Edit</Button>
                <Button variant="danger" onClick={() => handleDelete(group.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default AddEditResourceGroups;