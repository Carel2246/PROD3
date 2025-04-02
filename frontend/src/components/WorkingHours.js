import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ListGroup } from 'react-bootstrap';

const WorkingHours = () => {
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(false);

  // Map weekday numbers to day names
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
    setLoading(true);
    axios.get('http://localhost:5000/api/working_hours')
      .then(response => {
        setHours(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching hours:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>;

  return (
    <ListGroup>
      {hours.map(item => (
        <ListGroup.Item key={item.weekday}>
          {dayNames[item.weekday]}: {item.start_time}–{item.end_time}
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default WorkingHours;