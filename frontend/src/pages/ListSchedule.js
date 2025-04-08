import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Alert } from 'react-bootstrap';

const ListSchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [blockedJobs, setBlockedJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to format date as dd/mm, hh:mm
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0'); // Get day and pad with leading zero
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Get month (0-11, so +1) and pad
    const hours = String(date.getHours()).padStart(2, '0'); // Get hours and pad
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Get minutes and pad
    return `${day}/${month}, ${hours}:${minutes}`;
  };

  // Fetch blocked jobs and schedule data when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch blocked jobs
        const blockedJobsResponse = await axios.get('http://localhost:5000/api/job', {
          params: { include_blocked: true },
        });
        const blockedJobsData = blockedJobsResponse.data.filter(job => job.blocked);
        setBlockedJobs(blockedJobsData);

        // Step 2: Fetch schedule data from the schedule table
        const scheduleResponse = await axios.get('http://localhost:5000/api/schedule');
        let scheduleData = scheduleResponse.data;

        // Step 3: Enhance schedule data with job and task information
        const enhancedSchedulePromises = scheduleData.map(async (entry) => {
          try {
            // Fetch the task to get the job_number, job_id, and description
            const taskResponse = await axios.get(`http://localhost:5000/api/task/by_task_number/${entry.task_number}`);
            const task = taskResponse.data;

            if (!task || !task.job_id) {
              return {
                ...entry,
                job: 'Unknown Job',
                task_description: 'N/A',
                people: 'N/A',
                machines: 'N/A',
              };
            }

            // Fetch the job to get job_number and description
            const jobResponse = await axios.get(`http://localhost:5000/api/job/${task.job_id}`);
            const job = jobResponse.data;

            // Parse resources_used into people and machines
            let people = 'N/A';
            let machines = 'N/A';
            if (entry.resources_used && typeof entry.resources_used === 'string') {
              const resources = entry.resources_used.split(',').map(r => r.trim());
              people = resources.filter(r => !r.toLowerCase().includes('machine')).join(', ') || 'None';
              machines = resources.filter(r => r.toLowerCase().includes('machine')).join(', ') || 'None';
            }

            return {
              ...entry,
              job: job ? `${job.job_number} - ${job.description}` : 'Unknown Job',
              task_description: task.description || 'N/A',
              people,
              machines,
            };
          } catch (err) {
            console.error(`Error processing schedule entry for task ${entry.task_number}:`, err);
            return {
              ...entry,
              job: 'Unknown Job',
              task_description: 'N/A',
              people: 'N/A',
              machines: 'N/A',
            };
          }
        });

        const enhancedSchedule = await Promise.all(enhancedSchedulePromises);

        // Step 4: Sort by start_time
        enhancedSchedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        setSchedule(enhancedSchedule);
      } catch (err) {
        console.error('Error fetching schedule data:', err);
        setError('Failed to load schedule. Please try again.');
      } finally {
        setLoading(false);
        }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Current Schedule</h2>

      {/* Blocked Jobs Section */}
      <div className="mb-4">
        <h4>Blocked Jobs</h4>
        {error && <Alert variant="danger">{error}</Alert>}
        {blockedJobs.length > 0 ? (
          <ul>
            {blockedJobs.map(job => (
              <li key={job.id}>
                {job.job_number} - {job.description}
              </li>
            ))}
          </ul>
        ) : (
          <p>No jobs are currently blocked.</p>
        )}
      </div>

      {/* Schedule Table */}
      <h4>Schedule</h4>
      {schedule.length > 0 ? (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Job</th>
              <th>Task Number</th>
              <th>Task Description</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>People</th>
              <th>Machines</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(entry => (
              <tr key={entry.id}>
                <td>{entry.job}</td>
                <td>{entry.task_number}</td>
                <td>{entry.task_description}</td>
                <td>{formatDateTime(entry.start_time)}</td>
                <td>{formatDateTime(entry.end_time)}</td>
                <td>{entry.people}</td>
                <td>{entry.machines}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p>No schedule entries available.</p>
      )}
    </div>
  );
};

export default ListSchedule;