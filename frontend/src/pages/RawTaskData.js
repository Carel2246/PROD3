import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Form } from 'react-bootstrap';

const RawTasksData = () => {
  const [tasks, setTasks] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editedTasks, setEditedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/api/task');
      setTasks(response.data);
      setEditedTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditModeToggle = () => {
    setEditMode(!editMode);
    if (!editMode) {
      setEditedTasks([...tasks]); // Create a copy for editing
    }
  };

  const handleInputChange = (index, field, value) => {
    const updatedTasks = [...editedTasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setEditedTasks(updatedTasks);
  };

  const handleSaveChanges = async () => {
    try {
      for (const task of editedTasks) {
        await axios.put(`http://localhost:5000/api/task/${task.id}`, task);
      }
      setTasks([...editedTasks]);
      setEditMode(false);
      setError(null);
    } catch (error) {
      console.error('Error saving changes:', error);
      setError('Failed to save changes. Please try again.');
    }
  };

  const handleDiscardChanges = () => {
    setEditedTasks([...tasks]);
    setEditMode(false);
    setError(null);
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Raw Tasks Data</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="mb-3">
        {!editMode ? (
          <Button variant="primary" onClick={handleEditModeToggle}>
            Edit mode
          </Button>
        ) : (
          <>
            <Button variant="success" onClick={handleSaveChanges} className="me-2">
              Save changes
            </Button>
            <Button variant="danger" onClick={handleDiscardChanges}>
              Discard changes
            </Button>
          </>
        )}
      </div>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Task Number</th>
            <th>Job Number</th>
            <th>Job Description</th>
            <th>Description</th>
            <th>Setup Time</th>
            <th>Time Each</th>
            <th>Predecessors</th>
            <th>Resources</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {editedTasks.map((task, index) => (
            <tr key={task.id}>
              <td>
                {editMode ? (
                  <Form.Control
                    type="text"
                    value={task.task_number}
                    onChange={(e) => handleInputChange(index, 'task_number', e.target.value)}
                  />
                ) : (
                  task.task_number
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="text"
                    value={task.job_number}
                    onChange={(e) => handleInputChange(index, 'job_number', e.target.value)}
                  />
                ) : (
                  task.job_number
                )}
              </td>
              <td>
                {task.job_description}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="text"
                    value={task.description}
                    onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                  />
                ) : (
                  task.description
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="number"
                    value={task.setup_time}
                    onChange={(e) => handleInputChange(index, 'setup_time', parseInt(e.target.value))}
                  />
                ) : (
                  task.setup_time
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={task.time_each}
                    onChange={(e) => handleInputChange(index, 'time_each', parseFloat(e.target.value))}
                  />
                ) : (
                  task.time_each
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="text"
                    value={task.predecessors}
                    onChange={(e) => handleInputChange(index, 'predecessors', e.target.value)}
                  />
                ) : (
                  task.predecessors
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Control
                    type="text"
                    value={task.resources}
                    onChange={(e) => handleInputChange(index, 'resources', e.target.value)}
                  />
                ) : (
                  task.resources
                )}
              </td>
              <td>
                {editMode ? (
                  <Form.Check
                    type="checkbox"
                    checked={task.completed}
                    onChange={(e) => handleInputChange(index, 'completed', e.target.checked)}
                  />
                ) : (
                  <Form.Check type="checkbox" checked={task.completed} disabled />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default RawTasksData;