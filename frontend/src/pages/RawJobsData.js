import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Form, Button, Row, Col } from 'react-bootstrap';

const RawJobsData = () => {
  const [jobs, setJobs] = useState([]);
  const [editJob, setEditJob] = useState(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, [includeCompleted, includeBlocked]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/api/job', {
        params: {
          include_completed: includeCompleted,
          include_blocked: includeBlocked
        }
      });
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Failed to fetch jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditJob = (job) => {
    setEditJob({ ...job });
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditJob({
      ...editJob,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSaveJob = async () => {
    try {
      await axios.put(`http://localhost:5000/api/job/${editJob.id}`, editJob);
      setJobs(jobs.map(j => (j.id === editJob.id ? editJob : j)));
      setEditJob(null);
      setError(null);
    } catch (error) {
      console.error('Error updating job:', error);
      setError('Failed to update job. Please try again.');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job and its associated tasks and materials?')) {
      try {
        await axios.delete(`http://localhost:5000/api/job/${jobId}`);
        setJobs(jobs.filter(j => j.id !== jobId));
        setError(null);
      } catch (error) {
        console.error('Error deleting job:', error);
        setError('Failed to delete job. Please try again.');
      }
    }
  };

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <div>
      <h2>Raw Jobs Data</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filters */}
      <Form className="mb-4">
        <Row>
          <Col md={4} className="d-flex align-items-end">
            <Form.Group controlId="include_completed" className="me-3">
              <Form.Check
                type="checkbox"
                label="Include completed jobs"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
              />
            </Form.Group>
            <Form.Group controlId="include_blocked">
              <Form.Check
                type="checkbox"
                label="Include blocked jobs"
                checked={includeBlocked}
                onChange={(e) => setIncludeBlocked(e.target.checked)}
              />
            </Form.Group>
          </Col>
        </Row>
      </Form>

      {/* Jobs Table */}
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Job Number</th>
            <th>Description</th>
            <th>Order Date</th>
            <th>Promised Date</th>
            <th>Quantity</th>
            <th>Price Each (ZAR)</th>
            <th>Customer</th>
            <th>Completed</th>
            <th>Blocked</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id}>
              {editJob && editJob.id === job.id ? (
                <>
                  <td>{job.id}</td>
                  <td>
                    <Form.Control
                      type="text"
                      name="job_number"
                      value={editJob.job_number}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      name="description"
                      value={editJob.description}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="date"
                      name="order_date"
                      value={editJob.order_date ? editJob.order_date.split('T')[0] : ''}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="date"
                      name="promised_date"
                      value={editJob.promised_date ? editJob.promised_date.split('T')[0] : ''}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="quantity"
                      value={editJob.quantity}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      step="0.01"
                      name="price_each"
                      value={editJob.price_each}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      name="customer"
                      value={editJob.customer}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Check
                      type="checkbox"
                      name="completed"
                      checked={editJob.completed}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Form.Check
                      type="checkbox"
                      name="blocked"
                      checked={editJob.blocked}
                      onChange={handleEditChange}
                    />
                  </td>
                  <td>
                    <Button variant="success" size="sm" onClick={handleSaveJob} className="me-2">
                      Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditJob(null)} className="me-2">
                      Cancel
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td>{job.id}</td>
                  <td>{job.job_number}</td>
                  <td>{job.description}</td>
                  <td>{job.order_date ? new Date(job.order_date).toISOString().split('T')[0] : ''}</td>
                  <td>{job.promised_date ? new Date(job.promised_date).toISOString().split('T')[0] : ''}</td>
                  <td>{job.quantity}</td>
                  <td>{job.price_each}</td>
                  <td>{job.customer}</td>
                  <td>
                    <Form.Check type="checkbox" checked={job.completed} disabled />
                  </td>
                  <td>
                    <Form.Check type="checkbox" checked={job.blocked} disabled />
                  </td>
                  <td>
                    <Button variant="info" size="sm" onClick={() => handleEditJob(job)} className="me-2">
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteJob(job.id)}>
                      Delete
                    </Button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default RawJobsData;