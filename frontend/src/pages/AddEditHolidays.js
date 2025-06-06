import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Form, Row, Col, FormCheck } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AddEditHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({
    date: null,
    start_time: '',
    end_time: '',
    resources: [],
    isFullHoliday: true
  });
  const [resources, setResources] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHolidays();
    fetchResources();
  }, []);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/holidays');
      setHolidays(response.data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
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

  // Format date to YYYY-MM-DD in local time
  const formatLocalDate = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAdd = async () => {
    try {
      const holidayData = {
        date: formatLocalDate(newHoliday.date),
        start_time: newHoliday.isFullHoliday ? null : newHoliday.start_time || null,
        end_time: newHoliday.isFullHoliday ? null : newHoliday.end_time || null,
        resources: newHoliday.isFullHoliday ? [] : newHoliday.resources
      };
      const response = await axios.post('http://localhost:5000/api/holidays', holidayData);
      setHolidays([...holidays, { id: response.data.id, ...holidayData }]);
      resetForm();
    } catch (error) {
      console.error('Error adding holiday:', error);
    }
  };

  const handleEdit = (holiday) => {
    setEditingId(holiday.id);
    setNewHoliday({
      date: holiday.date ? new Date(holiday.date) : null,
      start_time: holiday.start_time || '',
      end_time: holiday.end_time || '',
      resources: holiday.resources || [],
      isFullHoliday: !holiday.start_time && !holiday.end_time
    });
  };

  const handleUpdate = async (id) => {
    try {
      const holidayData = {
        date: formatLocalDate(newHoliday.date),
        start_time: newHoliday.isFullHoliday ? null : newHoliday.start_time || null,
        end_time: newHoliday.isFullHoliday ? null : newHoliday.end_time || null,
        resources: newHoliday.isFullHoliday ? [] : newHoliday.resources
      };
      await axios.put(`http://localhost:5000/api/holidays/${id}`, holidayData);
      setHolidays(holidays.map(h => (h.id === id ? { id, ...holidayData } : h)));
      resetForm();
      setEditingId(null);
    } catch (error) {
      console.error('Error updating holiday:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/holidays/${id}`);
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (error) {
      console.error('Error deleting holiday:', error);
    }
  };

  const resetForm = () => {
    setNewHoliday({
      date: null,
      start_time: '',
      end_time: '',
      resources: [],
      isFullHoliday: true
    });
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Add/Edit Off Days</h2>
      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="date">
              <Form.Label>Date</Form.Label>
              <DatePicker
                selected={newHoliday.date}
                onChange={(date) => setNewHoliday({ ...newHoliday, date })}
                dateFormat="yyyy-MM-dd"
                className="form-control"
                placeholderText="Select a date"
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="isFullHoliday">
              <Form.Label>Full Day Off</Form.Label>
              <FormCheck
                type="checkbox"
                checked={newHoliday.isFullHoliday}
                onChange={(e) => setNewHoliday({ ...newHoliday, isFullHoliday: e.target.checked })}
                label="No working hours"
              />
            </Form.Group>
          </Col>
          {!newHoliday.isFullHoliday && (
            <>
              <Col>
                <Form.Group controlId="start_time">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={newHoliday.start_time}
                    onChange={(e) => setNewHoliday({ ...newHoliday, start_time: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="end_time">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={newHoliday.end_time}
                    onChange={(e) => setNewHoliday({ ...newHoliday, end_time: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="resources">
                  <Form.Label>Resources</Form.Label>
                  <Form.Control
                    as="select"
                    multiple
                    value={newHoliday.resources}
                    onChange={(e) =>
                      setNewHoliday({
                        ...newHoliday,
                        resources: Array.from(e.target.selectedOptions, option => parseInt(option.value))
                      })
                    }
                  >
                    {resources.map(resource => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
            </>
          )}
          <Col className="align-self-end">
            <Button
              variant="primary"
              onClick={editingId ? () => handleUpdate(editingId) : handleAdd}
              disabled={!newHoliday.date || (!newHoliday.isFullHoliday && (!newHoliday.start_time || !newHoliday.end_time))}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Col>
        </Row>
      </Form>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weekday</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Resources</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {holidays.map(holiday => (
            <tr key={holiday.id}>
              <td>{holiday.date}</td>
              <td>{new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' })}</td>
              <td>{holiday.start_time || 'N/A'}</td>
              <td>{holiday.end_time || 'N/A'}</td>
              <td>{holiday.resources.length > 0 ? holiday.resources.map(id => resources.find(r => r.id === id)?.name || id).join(', ') : 'All'}</td>
              <td>
                <Button variant="warning" onClick={() => handleEdit(holiday)} className="me-2">
                  Edit
                </Button>
                <Button variant="danger" onClick={() => handleDelete(holiday.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default AddEditHolidays;