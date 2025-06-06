import React, { useEffect, useState } from 'react';
import { ListGroup } from 'react-bootstrap';

const BlockedJobs = () => {
  const [blockedJobs, setBlockedJobs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/job?include_blocked=true')
      .then(response => response.text()) // Get raw text
      .then(text => {
        console.log('BlockedJobs raw response:', text.substring(0, 100));
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Invalid JSON response');
        setBlockedJobs(data.filter(job => job.blocked));
      })
      .catch(err => {
        console.error('BlockedJobs fetch error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading blocked jobs...</div>;
  if (error) return <div className="text-danger">Error: {error}</div>;
  if (!blockedJobs.length) return <div>No blocked jobs.</div>;

  return (
    <ListGroup>
      {blockedJobs.map(job => (
        <ListGroup.Item key={job.job_number}>{job.job_number}: {job.description}</ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default BlockedJobs;