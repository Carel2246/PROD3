import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Form, Row, Col } from 'react-bootstrap';

const AddEditCalendar = () => {
  const [calendar, setCalendar] = useState([]);
  const [newEntry, setNewEntry] = useState({ weekday: '', start_time: '', end_time: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const dayNames = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday'
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/calendar');
      setCalendar(response.data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/calendar', newEntry);
      setCalendar([...calendar, { id: response.data.id, ...newEntry }]);
      setNewEntry({ weekday: '', start_time: '', end_time: '' });
    } catch (error) {
      console.error('Error adding calendar entry:', error);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setNewEntry({ weekday: entry.weekday, start_time: entry.start_time, end_time: entry.end_time });
  };

  const handleUpdate = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/calendar/${id}`, newEntry);
      setCalendar(calendar.map(entry => (entry.id === id ? { id, ...newEntry } : entry)));
      setEditingId(null);
      setNewEntry({ weekday: '', start_time: '', end_time: '' });
    } catch (error) {
      console.error('Error updating calendar entry:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/calendar/${id}`);
      setCalendar(calendar.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error deleting calendar entry:', error);
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Calendar</h2>
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="weekday">
              <Form.Label>Weekday</Form.Label>
              <Form.Control
                as="select"
                value={newEntry.weekday}
                onChange={(e) => setNewEntry({ ...newEntry, weekday: parseInt(e.target.value) })}
              >
                <option value="">Select a day</option>
                {Object.entries(dayNames).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="start_time">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="time"
                value={newEntry.start_time}
                onChange={(e) => setNewEntry({ ...newEntry, start_time: e.target.value })}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="end_time">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="time"
                value={newEntry.end_time}
                onChange={(e) => setNewEntry({ ...newEntry, end_time: e.target.value })}
              />
            </Form.Group>
          </Col>
          <Col className="align-self-end">
            <Button
              variant="primary"
              onClick={editingId ? () => handleUpdate(editingId) : handleAdd}
              disabled={!newEntry.weekday || !newEntry.start_time || !newEntry.end_time}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Col>
        </Row>
      </Form>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Weekday</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {calendar.map(entry => (
            <tr key={entry.id}>
              <td>{dayNames[entry.weekday]}</td>
              <td>{entry.start_time}</td>
              <td>{entry.end_time}</td>
              <td>
                <Button variant="warning" onClick={() => handleEdit(entry)} className="me-2">Edit</Button>
                <Button variant="danger" onClick={() => handleDelete(entry.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default AddEditCalendar;