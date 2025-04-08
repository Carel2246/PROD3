import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, ListGroup, Alert, Spinner } from 'react-bootstrap';

const DeliverySchedule = () => {
  const [schedule, setSchedule] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [blockedJobs, setBlockedJobs] = useState([]);
  const [workingHours, setWorkingHours] = useState([]);
  const [deliveryTable, setDeliveryTable] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  // Fetch all necessary data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true); // Set loading to true at the start

        // Fetch schedule
        const scheduleResponse = await axios.get('http://localhost:5000/api/schedule');
        const scheduleData = scheduleResponse.data;

        // Fetch working hours
        const workingHoursResponse = await axios.get('http://localhost:5000/api/working_hours');
        const workingHoursData = workingHoursResponse.data;

        // Fetch all jobs
        const jobsResponse = await axios.get('http://localhost:5000/api/job');
        const jobsData = jobsResponse.data;

        // Fetch blocked jobs
        const blockedJobsResponse = await axios.get('http://localhost:5000/api/job', {
          params: { include_blocked: true },
        });
        const allJobs = blockedJobsResponse.data;
        const blockedJobsData = allJobs.filter(job => job.blocked);

        // Map tasks to jobs
        const jobCompletionDates = {};
        const jobDetails = {};

        for (const entry of scheduleData) {
          // Fetch task details to get the associated job
          const taskResponse = await axios.get(`http://localhost:5000/api/task/by_task_number/${entry.task_number}`);
          const task = taskResponse.data;

          if (!task || !task.job_id) continue;

          const jobId = task.job_id;
          const endTime = new Date(entry.end_time);

          // Track the latest end time for each job
          if (!jobCompletionDates[jobId] || endTime > new Date(jobCompletionDates[jobId])) {
            jobCompletionDates[jobId] = endTime;
          }

          // Store job details for easy lookup
          if (!jobDetails[jobId]) {
            const job = jobsData.find(j => j.id === jobId);
            if (job) {
              jobDetails[jobId] = {
                job_number: job.job_number,
                description: job.description,
                customer: job.customer,
                promised_date: job.promised_date ? new Date(job.promised_date) : null,
              };
            }
          }
        }

        // Calculate delivery dates and build the table
        const deliveryMap = {};
        // Update weekdayMap to match JavaScript's getDay() (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const weekdayMap = {
          0: 'Sun',
          1: 'Mon',
          2: 'Tue',
          3: 'Wed',
          4: 'Thu',
          5: 'Fri',
          6: 'Sat',
        };

        // Determine working days (Monday to Friday)
        const workingDays = new Set();
        workingHoursData.forEach(day => {
          const weekdayNum = day.weekday; // 1 = Monday, 7 = Sunday
          // Map backend weekday to JavaScript getDay() numbering
          const jsWeekday = weekdayNum === 7 ? 0 : weekdayNum; // 1 -> 1 (Mon), ..., 6 -> 6 (Sat), 7 -> 0 (Sun)
          if (day.start_time !== day.end_time) { // If start and end times are different, it's a working day
            workingDays.add(jsWeekday);
          }
        });

        for (const [jobId, completionDate] of Object.entries(jobCompletionDates)) {
          // Find the next working day after completion
          let deliveryDate = new Date(completionDate);
          let attempts = 0;
          const maxAttempts = 365; // Prevent infinite loops

          while (attempts < maxAttempts) {
            deliveryDate.setDate(deliveryDate.getDate() + 1);
            const weekday = deliveryDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            if (workingDays.has(weekday)) {
              break;
            }
            attempts++;
          }

          if (attempts >= maxAttempts) {
            console.warn(`Could not find a working day for job ${jobId} within ${maxAttempts} days. Using completion date.`);
            deliveryDate = new Date(completionDate);
          }

          // Format the date as "Mon 07/04"
          const dayName = weekdayMap[deliveryDate.getDay()];
          const day = String(deliveryDate.getDate()).padStart(2, '0');
          const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
          const dateKey = `${dayName} ${day}/${month}`;

          // Get job details
          const job = jobDetails[jobId];
          if (!job) continue;

          // Check if the job is late
          const promisedDate = job.promised_date;
          const isLate = promisedDate && deliveryDate > promisedDate;

          // Format the job string
          let jobString = `${job.job_number} ${job.description} - ${job.customer}`;
          if (isLate) {
            const promisedDay = String(promisedDate.getDate()).padStart(2, '0');
            const promisedMonth = String(promisedDate.getMonth() + 1).padStart(2, '0');
            jobString += ` (Promised: ${promisedDay}/${promisedMonth})`;
          }

          // Add to delivery map
          if (!deliveryMap[dateKey]) {
            deliveryMap[dateKey] = [];
          }
          deliveryMap[dateKey].push({ jobString, isLate });
        }

        // Convert deliveryMap to table rows, sorted by date
        const tableRows = Object.entries(deliveryMap)
          .map(([date, jobs]) => ({
            date,
            jobs,
            // Parse date for sorting (e.g., "Mon 07/04" -> Date object)
            sortDate: parseDateForSorting(date),
          }))
          .sort((a, b) => a.sortDate - b.sortDate);

        setSchedule(scheduleData);
        setJobs(jobsData);
        setBlockedJobs(blockedJobsData);
        setWorkingHours(workingHoursData);
        setDeliveryTable(tableRows);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load delivery schedule. Please try again.');
      } finally {
        setLoading(false); // Set loading to false when done
      }
    };

    fetchData();
  }, []);

  // Helper function to parse "Mon 07/04" into a Date object for sorting
  const parseDateForSorting = (dateStr) => {
    const [_, dayMonth] = dateStr.split(' '); // e.g., "Mon 07/04" -> ["Mon", "07/04"]
    const [day, month] = dayMonth.split('/').map(Number); // e.g., "07/04" -> [7, 4]
    const year = new Date().getFullYear(); // Assume current year for simplicity
    return new Date(year, month - 1, day); // Months are 0-based in JavaScript
  };

  return (
    <div className="container mt-4">
      <h2>Delivery Schedule</h2>

      {/* Blocked Jobs List */}
      {blockedJobs.length > 0 && (
        <div className="mb-4">
          <h4>Blocked Jobs</h4>
          <ListGroup>
            {blockedJobs.map(job => (
              <ListGroup.Item key={job.id}>
                {`${job.job_number} ${job.description} - ${job.customer}`}
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      )}

      {/* Error Message */}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Loading Spinner */}
      {loading ? (
        <div className="text-center my-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p>Loading delivery schedule...</p>
        </div>
      ) : (
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Date</th>
              <th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {deliveryTable.length > 0 ? (
              deliveryTable.map((row, index) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td>
                    {row.jobs.map((job, idx) => (
                      <div key={idx} style={{ color: job.isLate ? 'red' : 'inherit' }}>
                        {job.jobString}
                      </div>
                    ))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="text-center">
                  No scheduled jobs available.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default DeliverySchedule;