import React, { useEffect, useState } from 'react';
import { Table } from 'react-bootstrap';
import BlockedJobs from '../components/BlockedJobs';

const Home = () => {
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [summary, setSummary] = useState({ makespan: 0, total_rand_days_late: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatRand = (value) => `R ${Math.round(value).toLocaleString('en-ZA')}`;

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:5000/api/scheduled_jobs')
        .then(response => response.text())
        .then(text => {
          console.log('ScheduledJobs raw response:', text.substring(0, 100));
          return JSON.parse(text);
        })
        .then(data => setScheduledJobs(data)),
      fetch('http://localhost:5000/api/schedule_summary')
        .then(response => response.text())
        .then(text => {
          console.log('ScheduleSummary raw response:', text.substring(0, 100));
          return JSON.parse(text);
        })
        .then(data => setSummary(data))
    ])
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Home</h2>
      <h3>Blocked Jobs</h3>
      <BlockedJobs />
      <h3 className="mt-4">Scheduled Jobs</h3>
      {error && <div className="text-danger">Error: {error}</div>}
      {loading ? (
        <div>Loading scheduled jobs...</div>
      ) : (
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Job Number</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Job Value (ZAR)</th>
              <th>Completion Date</th>
              <th>Days Late</th>
            </tr>
          </thead>
          <tbody>
            {scheduledJobs.length ? (
              scheduledJobs.map(job => (
                <tr key={job.job_number}>
                  <td>{job.job_number}</td>
                  <td>{job.description}</td>
                  <td>{job.quantity}</td>
                  <td>{formatRand(job.job_value)}</td>
                  <td>{job.completion_date || 'Not scheduled'}</td>
                  <td>{job.days_late ?? 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No scheduled jobs.</td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
      <h3 className="mt-4">Schedule Summary</h3>
      {loading ? (
        <div>Loading summary...</div>
      ) : (
        <p>
          Total Makespan: {summary.makespan.toFixed(2)} days<br />
          Total Rand-Days Late: {formatRand(summary.total_rand_days_late)} ZAR-days
        </p>
      )}
    </div>
  );
};

export default Home;