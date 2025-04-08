import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns'; // Date adapter for Chart.js
import { Table, ListGroup, Alert, Spinner, Form } from 'react-bootstrap';

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

const CashFlowProjection = () => {
  const [schedule, setSchedule] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [blockedJobs, setBlockedJobs] = useState([]);
  const [graphData, setGraphData] = useState({ labels: [], datasets: [] });
  const [tableData, setTableData] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [maxEndDate, setMaxEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobCompletionDates, setJobCompletionDates] = useState({}); // Add state for jobCompletionDates
  const [jobDetails, setJobDetails] = useState({}); // Add state for jobDetails

  // Fetch data and initialize the graph
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch schedule
        const scheduleResponse = await axios.get('http://localhost:5000/api/schedule');
        const scheduleData = scheduleResponse.data;

        // Fetch all jobs
        const jobsResponse = await axios.get('http://localhost:5000/api/job');
        const jobsData = jobsResponse.data;

        // Fetch blocked jobs
        const blockedJobsResponse = await axios.get('http://localhost:5000/api/job', {
          params: { include_blocked: true },
        });
        const allJobs = blockedJobsResponse.data;
        const blockedJobsData = allJobs.filter(job => job.blocked);

        // Map tasks to jobs and calculate completion dates and values
        const tempJobCompletionDates = {};
        const tempJobDetails = {};

        for (const entry of scheduleData) {
          const taskResponse = await axios.get(`http://localhost:5000/api/task/by_task_number/${entry.task_number}`);
          const task = taskResponse.data;

          if (!task || !task.job_id) continue;

          const jobId = task.job_id;
          const endTime = new Date(entry.end_time);

          // Track the latest end time for each job
          if (!tempJobCompletionDates[jobId] || endTime > new Date(tempJobCompletionDates[jobId])) {
            tempJobCompletionDates[jobId] = endTime;
          }

          // Store job details for easy lookup
          if (!tempJobDetails[jobId]) {
            const job = jobsData.find(j => j.id === jobId);
            if (job) {
              const value = (job.price_each || 0) * (job.quantity || 1);
              tempJobDetails[jobId] = {
                job_number: job.job_number,
                description: job.description,
                customer: job.customer,
                value: value,
              };
            }
          }
        }

        // Find the latest completion date for the default end date
        const completionDates = Object.values(tempJobCompletionDates);
        const latestDate = completionDates.length > 0 ? new Date(Math.max(...completionDates)) : new Date();
        const defaultEndDate = latestDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // Process data for the graph and table
        processData(tempJobCompletionDates, tempJobDetails, defaultEndDate);

        // Store in state
        setJobCompletionDates(tempJobCompletionDates);
        setJobDetails(tempJobDetails);
        setSchedule(scheduleData);
        setJobs(jobsData);
        setBlockedJobs(blockedJobsData);
        setEndDate(defaultEndDate);
        setMaxEndDate(defaultEndDate);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load cash flow projection. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Process data for the graph and table based on the selected end date
  const processData = (jobCompletionDates, jobDetails, selectedEndDate) => {
    // Sort jobs by completion date
    const jobEntries = Object.entries(jobCompletionDates)
      .map(([jobId, completionDate]) => ({
        jobId,
        completionDate: new Date(completionDate),
        ...jobDetails[jobId],
      }))
      .sort((a, b) => a.completionDate - b.completionDate);

    // Filter jobs up to the selected end date
    const endDateObj = new Date(selectedEndDate);
    const filteredJobs = jobEntries.filter(job => job.completionDate <= endDateObj);

    if (filteredJobs.length === 0) {
      setGraphData({
        labels: [],
        datasets: [
          {
            label: 'Cumulative Value (R)',
            data: [],
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: false,
          },
        ],
      });
      setTableData([]);
      return;
    }

    // Determine the date range for the graph
    const startDate = new Date(Math.min(...filteredJobs.map(job => job.completionDate)));
    const dates = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDateObj) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate cumulative values
    const cumulativeValues = [];
    let cumulativeValue = 0;
    const tableRows = [];

    for (const date of dates) {
      const jobsOnDate = filteredJobs.filter(
        job => job.completionDate.toDateString() === date.toDateString()
      );

      if (jobsOnDate.length > 0) {
        jobsOnDate.forEach(job => {
          cumulativeValue += job.value;
          const dateStr = job.completionDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
          }).replace(/\//g, '/');
          tableRows.push({
            date: dateStr,
            job: `${job.job_number} ${job.description} - ${job.customer}`,
            value: job.value.toFixed(2),
            cumulativeValue: cumulativeValue.toFixed(2),
          });
        });
      }

      cumulativeValues.push({
        x: new Date(date),
        y: cumulativeValue,
      });
    }

    // Prepare data for Chart.js
    const chartData = {
      datasets: [
        {
          label: 'Cumulative Value (R)',
          data: cumulativeValues,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: false,
          tension: 0.1,
        },
      ],
    };

    setGraphData(chartData);
    setTableData(tableRows);
  };

  // Handle end date change
  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    setEndDate(newEndDate);

    // Reprocess data with the new end date
    processData(
      Object.fromEntries(
        Object.entries(jobCompletionDates).map(([jobId, date]) => [jobId, new Date(date)])
      ),
      jobDetails,
      newEndDate
    );
  };

  return (
    <div className="container mt-4">
      <h2>Cash Flow Projection</h2>

      {/* End Date Picker */}
      <Form.Group className="mb-3" style={{ maxWidth: '200px' }}>
        <Form.Label>End Date</Form.Label>
        <Form.Control
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          max={maxEndDate}
        />
      </Form.Group>

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
          <p>Loading cash flow projection...</p>
        </div>
      ) : (
        <>
          {/* Line Graph */}
          <div className="mb-4">
            {graphData.datasets && graphData.datasets.length > 0 ? (
              <Line
                data={graphData}
                options={{
                  responsive: true,
                  scales: {
                    x: {
                      type: 'time',
                      time: {
                        unit: 'day',
                        displayFormats: {
                          day: 'dd/MM',
                        },
                      },
                      title: {
                        display: true,
                        text: 'Date',
                      },
                    },
                    y: {
                      title: {
                        display: true,
                        text: 'Cumulative Value (R)',
                      },
                      beginAtZero: true,
                    },
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => `R${context.parsed.y.toFixed(2)}`,
                      },
                    },
                  },
                }}
              />
            ) : (
              <Alert variant="info">No data available for the selected date range.</Alert>
            )}
          </div>

          {/* Data Table */}
          <h4>Data Table</h4>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Date</th>
                <th>Job</th>
                <th>Value (R)</th>
                <th>Cumulative Value (R)</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length > 0 ? (
                tableData.map((row, index) => (
                  <tr key={index}>
                    <td>{row.date}</td>
                    <td>{row.job}</td>
                    <td>{row.value}</td>
                    <td>{row.cumulativeValue}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">
                    No scheduled jobs available.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
};

export default CashFlowProjection;