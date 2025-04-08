import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart } from 'react-google-charts';
import { Alert, Spinner } from 'react-bootstrap';

const GanttChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        // Map tasks to jobs
        const jobTasksMap = {};

        for (const entry of scheduleData) {
          // Fetch task details to get the associated job
          const taskResponse = await axios.get(`http://localhost:5000/api/task/by_task_number/${entry.task_number}`);
          const task = taskResponse.data;

          if (!task || !task.job_id) continue;

          const jobId = task.job_id;
          const job = jobsData.find(j => j.id === jobId);
          if (!job) continue;

          // Initialize job entry if not exists
          if (!jobTasksMap[jobId]) {
            jobTasksMap[jobId] = {
              job: job,
              tasks: [],
              earliestStart: null,
              latestEnd: null,
            };
          }

          // Add task to the job
          const startTime = new Date(entry.start_time);
          const endTime = new Date(entry.end_time);

          jobTasksMap[jobId].tasks.push({
            id: entry.id,
            taskNumber: entry.task_number,
            description: task.description,
            start: startTime,
            end: endTime,
          });

          // Update earliest start and latest end for the job
          if (!jobTasksMap[jobId].earliestStart || startTime < jobTasksMap[jobId].earliestStart) {
            jobTasksMap[jobId].earliestStart = startTime;
          }
          if (!jobTasksMap[jobId].latestEnd || endTime > jobTasksMap[jobId].latestEnd) {
            jobTasksMap[jobId].latestEnd = endTime;
          }
        }

        // Convert jobTasksMap to Gantt chart data
        const ganttRows = [];
        const jobsArray = Object.entries(jobTasksMap)
          .map(([jobId, data]) => ({
            jobId,
            jobNumber: data.job.job_number,
            ...data,
          }))
          .sort((a, b) => a.jobNumber.localeCompare(b.jobNumber)); // Sort by job_number

        jobsArray.forEach((jobEntry) => {
          const jobId = jobEntry.jobId;
          const job = jobEntry.job;

          // Add the job as a summary row
          ganttRows.push([
            `job-${jobId}`,
            `${job.job_number}: ${job.description}`,
            new Date(jobEntry.earliestStart),
            new Date(jobEntry.latestEnd),
            null, // Duration (null since we're using start/end dates)
            100, // Percent complete
            null, // Dependencies
            'job', // Custom column for styling
          ]);

          // Add each task as a separate row
          jobEntry.tasks.forEach((task) => {
            ganttRows.push([
              `task-${task.id}`,
              `  ${task.taskNumber}: ${task.description}`, // Indent task name
              new Date(task.start),
              new Date(task.end),
              null,
              100,
              null,
              'task', // Custom column for styling
            ]);
          });
        });

        // Prepare data for Google Charts Gantt
        const data = [
          [
            { type: 'string', label: 'Task ID' },
            { type: 'string', label: 'Task Name' },
            { type: 'date', label: 'Start Date' },
            { type: 'date', label: 'End Date' },
            { type: 'number', label: 'Duration' },
            { type: 'number', label: 'Percent Complete' },
            { type: 'string', label: 'Dependencies' },
            { type: 'string', label: 'Type' }, // Custom column for styling
          ],
          ...ganttRows,
        ];

        setChartData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load Gantt chart. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Gantt Chart of Scheduled Jobs and Tasks</h2>

      {/* Error Message */}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Loading Spinner */}
      {loading ? (
        <div className="text-center my-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p>Loading Gantt chart...</p>
        </div>
      ) : (
        <>
          {chartData.length > 1 ? (
            <Chart
              chartType="Gantt"
              width="100%"
              height={`${chartData.length * 40}px`} // Adjust height based on number of rows
              data={chartData}
              options={{
                height: chartData.length * 40,
                gantt: {
                  trackHeight: 30,
                  labelStyle: {
                    fontSize: 14,
                  },
                  criticalPathEnabled: false, // Disable critical path (no dependencies)
                  palette: [
                    {
                      color: '#4a90e2', // Job bars (blue)
                      dark: '#2b5e91',
                      light: '#a3cffa',
                    },
                    {
                      color: '#50b848', // Task bars (green)
                      dark: '#388e3c',
                      light: '#a5d6a7',
                    },
                  ],
                  barCornerRadius: 3,
                  arrow: {
                    angle: 45,
                    width: 2,
                    color: 'gray',
                    radius: 0,
                  },
                },
                hAxis: {
                  format: 'dd/MM/yyyy', // Date format on x-axis
                },
              }}
              chartEvents={[
                {
                  eventName: 'ready',
                  callback: ({ chartWrapper }) => {
                    const chart = chartWrapper.getChart();
                    chart.container.addEventListener('click', (e) => {
                      const selection = chart.getSelection();
                      if (selection.length > 0) {
                        const row = selection[0].row;
                        const type = chartData[row + 1][7]; // 'Type' column
                        const taskName = chartData[row + 1][1];
                        console.log(`Clicked on ${type}: ${taskName}`);
                      }
                    });
                  },
                },
              ]}
            />
          ) : (
            <Alert variant="info">No scheduled tasks available to display.</Alert>
          )}
        </>
      )}
    </div>
  );
};

export default GanttChart;