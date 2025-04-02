import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table } from 'react-bootstrap';

const ScheduleTable = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/api/schedule')
      .then(response => {
        setSchedule(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching schedule:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <Table striped bordered hover responsive>
      <thead>
        <tr>
          <th>Task Number</th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Resources Used</th>
        </tr>
      </thead>
      <tbody>
        {schedule.map(item => (
          <tr key={item.task_number}>
            <td>{item.task_number}</td>
            <td>{new Date(item.start_time).toLocaleString()}</td>
            <td>{new Date(item.end_time).toLocaleString()}</td>
            <td>{item.resources_used}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default ScheduleTable;