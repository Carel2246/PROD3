import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Alert, Form, Button } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Define styles for centering table contents
const tableStyles = {
  // Style for th and td to center content
  centeredCell: {
    textAlign: 'center', // Horizontal centering
    verticalAlign: 'middle', // Vertical centering (alternative to flexbox for simpler cases)
    padding: '10px', // Ensure enough padding for visibility
  },
  // Style for the div inside td to handle multiline content
  cellContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center', // Center horizontally within the div
    justifyContent: 'center', // Center vertically within the div
    minHeight: '50px', // Ensure cells have a minimum height for consistent appearance
    width: '100%',
    height: '100%',
  },
};

const ProductionSchedule = () => {
  const [scheduleData, setScheduleData] = useState([]);
  const [blockedJobs, setBlockedJobs] = useState([]);
  const [humanResources, setHumanResources] = useState([]);
  const [dateRange, setDateRange] = useState([]);
  const [daysToShow, setDaysToShow] = useState(14); // Default to 14 days
  const [earliestDate, setEarliestDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resources, setResources] = useState([]); // Store all resources with their types

  // Function to generate a date range starting from the earliest date
  const generateDateRange = (startDate, days) => {
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Function to format date as "Day, dd/mm" (e.g., "Mon, 07/04")
  const formatDateWithDay = (date) => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = daysOfWeek[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${dayName}, ${day}/${month}`;
  };

  // Function to get the date string (yyyy-mm-dd) for comparison
  const getDateString = (date) => {
    return date.toISOString().split('T')[0]; // e.g., "2025-04-07"
  };

  // Function to format the current date as DDMMYYYY for the file name
  const formatDateForFileName = () => {
    const today = new Date('2025-04-07'); // Current date (April 7, 2025)
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}${month}${year}`; // e.g., "07042025"
  };

  // Fetch schedule data, blocked jobs, resources, and process everything
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

        // Step 2: Fetch all resources to determine their types
        const resourcesResponse = await axios.get('http://localhost:5000/api/resource');
        const allResources = resourcesResponse.data;
        setResources(allResources);

        // Step 3: Fetch schedule data
        const scheduleResponse = await axios.get('http://localhost:5000/api/schedule');
        const schedule = scheduleResponse.data;

        if (schedule.length === 0) {
          setEarliestDate(new Date()); // Fallback to today if no schedule entries
          setScheduleData([]);
          setHumanResources([]);
          return;
        }

        // Step 4: Find the earliest start date
        const startDates = schedule.map(entry => new Date(entry.start_time));
        const earliest = new Date(Math.min(...startDates));
        setEarliestDate(earliest);

        // Step 5: Extract human resources (only type 'H')
        const allResourceNames = new Set();
        schedule.forEach(entry => {
          if (entry.resources_used && typeof entry.resources_used === 'string') {
            const resourceNames = entry.resources_used.split(',').map(r => r.trim());
            resourceNames.forEach(name => allResourceNames.add(name));
          }
        });

        // Filter for human resources (type 'H') with case-insensitive comparison
        const humanResourceNames = Array.from(allResourceNames)
          .filter(name => {
            const resource = allResources.find(r => r.name.toLowerCase() === name.toLowerCase());
            if (!resource) {
              console.warn(`Resource not found in resources table: ${name}`);
              return false;
            }
            return resource.type === 'H';
          })
          .sort();
        console.log('Human Resources:', humanResourceNames); // Debug log
        setHumanResources(humanResourceNames);

        // Step 6: Map tasks to human resources and dates, including job and task descriptions
        const processedDataPromises = schedule.map(async (entry) => {
          try {
            // Fetch the task to get the job_id and task description
            const taskResponse = await axios.get(`http://localhost:5000/api/task/by_task_number/${entry.task_number}`);
            const task = taskResponse.data;

            if (!task || !task.job_id) {
              return {
                task_number: entry.task_number,
                end_date: getDateString(new Date(entry.end_time)),
                human_resources: [],
                display_text: 'Unknown Task',
                isLate: false,
              };
            }

            // Fetch the job to get the job description and promised_date
            const jobResponse = await axios.get(`http://localhost:5000/api/job/${task.job_id}`);
            const job = jobResponse.data;

            const displayText = job && task.description
              ? `${job.description} - ${task.description}`
              : 'Unknown Task';

            // Determine if the task is late (promised_date < end_time)
            const endTime = new Date(entry.end_time);
            const promisedDate = job.promised_date ? new Date(job.promised_date) : null;
            const isLate = promisedDate && endTime > promisedDate;

            // Identify human resources for this task (only type 'H') with case-insensitive comparison
            const humanResourcesForTask = [];
            if (entry.resources_used && typeof entry.resources_used === 'string') {
              const resourceNames = entry.resources_used.split(',').map(r => r.trim());
              resourceNames.forEach(name => {
                const resource = allResources.find(r => r.name.toLowerCase() === name.toLowerCase());
                if (!resource) {
                  console.warn(`Resource not found in resources table for task ${entry.task_number}: ${name}`);
                } else if (resource.type === 'H') {
                  humanResourcesForTask.push(name);
                }
              });
            }

            return {
              task_number: entry.task_number,
              end_date: getDateString(new Date(entry.end_time)),
              human_resources: humanResourcesForTask,
              display_text: displayText,
              isLate: isLate,
            };
          } catch (err) {
            console.error(`Error processing schedule entry for task ${entry.task_number}:`, err);
            return {
              task_number: entry.task_number,
              end_date: getDateString(new Date(entry.end_time)),
              human_resources: [],
              display_text: 'Unknown Task',
              isLate: false,
            };
          }
        });

        const processedData = await Promise.all(processedDataPromises);
        setScheduleData(processedData);
      } catch (err) {
        console.error('Error fetching production schedule data:', err);
        setError('Failed to load production schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update the date range whenever daysToShow or earliestDate changes
  useEffect(() => {
    if (earliestDate) {
      const dates = generateDateRange(earliestDate, daysToShow);
      setDateRange(dates);
    }
  }, [earliestDate, daysToShow]);

  // Build a map of tasks for each human resource and date
  const taskMap = {};
  humanResources.forEach(resource => {
    taskMap[resource] = {};
    dateRange.forEach(date => {
      taskMap[resource][getDateString(date)] = [];
    });
  });

  // Populate the task map with display text and isLate flag
  scheduleData.forEach(entry => {
    const { display_text, end_date, human_resources, isLate } = entry;
    human_resources.forEach(resource => {
      if (taskMap[resource] && taskMap[resource][end_date]) {
        taskMap[resource][end_date].push({ text: display_text, isLate });
      }
    });
  });

  // Handle changes to the daysToShow input
  const handleDaysChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (value > 0) {
      setDaysToShow(value);
    }
  };

  // Export the schedule to Excel
  const exportToExcel = () => {
    // Prepare the data for Excel
    const headers = ['Human Resource', ...dateRange.map(date => formatDateWithDay(date))];
    const rows = humanResources.map(resource => {
      const row = [resource];
      dateRange.forEach(date => {
        const dateString = getDateString(date);
        const tasks = taskMap[resource][dateString] || [];
        const cellContent = tasks.map(task => task.text).join('\n');
        row.push(cellContent);
      });
      return row;
    });

    // Create a worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    const colWidths = headers.map((_, i) => ({
      wch: i === 0 ? 20 : 30,
    }));
    ws['!cols'] = colWidths;

    // Set page layout for A4 landscape
    ws['!pageSetup'] = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 0,
    };

    // Apply styles: wrap text for all cells, bold for headers and first column
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) continue; // Skip empty cells

        // Ensure the cell has a style object
        ws[cellRef].s = ws[cellRef].s || {};

        // Wrap text for all cells
        ws[cellRef].s.alignment = { wrapText: true };

        // Bold for first row (headers) and first column (resources)
        if (R === 0 || C === 0) {
          ws[cellRef].s.font = { bold: true };
        }

        // Center the text in Excel (optional, for consistency with the UI)
        ws[cellRef].s.alignment = {
          ...ws[cellRef].s.alignment,
          horizontal: 'center',
          vertical: 'center',
        };
      }
    }

    // Create a workbook and add the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Schedule');

    // Generate the Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Create a blob and trigger download
    const fileName = `Produksieskedule ${formatDateForFileName()}.xlsx`;
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, fileName);
  };

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
      <h2>Production Schedule</h2>

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

      {/* Days to Show Input and Export Button */}
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <Form.Group controlId="daysToShow">
          <Form.Label>Number of Days to Display:</Form.Label>
          <Form.Control
            type="number"
            value={daysToShow}
            onChange={handleDaysChange}
            min="1"
            style={{ width: '100px', display: 'inline-block', marginLeft: '10px' }}
          />
        </Form.Group>
        <Button variant="primary" onClick={exportToExcel}>
          Export to Excel
        </Button>
      </div>

      {/* Schedule Table */}
      <h4>Schedule</h4>
      {humanResources.length > 0 && dateRange.length > 0 ? (
        <Table
          striped
          bordered
          hover
          responsive
          style={{
            // Optional: Center the entire table on the page if needed
            margin: '0 auto',
            width: '100%',
          }}
        >
          <thead>
            <tr>
              <th style={tableStyles.centeredCell}></th> {/* Blank top-left cell */}
              {dateRange.map(date => (
                <th key={getDateString(date)} style={tableStyles.centeredCell}>
                  {formatDateWithDay(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {humanResources.map(resource => (
              <tr key={resource}>
                <td style={tableStyles.centeredCell}>{resource}</td>
                {dateRange.map(date => {
                  const dateString = getDateString(date);
                  const tasks = taskMap[resource][dateString] || [];
                  return (
                    <td key={dateString} style={tableStyles.centeredCell}>
                      {tasks.length > 0 ? (
                        <div style={tableStyles.cellContent}>
                          {tasks.map((task, index) => (
                            <div
                              key={index}
                              style={{ color: task.isLate ? 'red' : 'inherit' }}
                            >
                              {task.text}
                              {index < tasks.length - 1 && <br />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '' // Empty cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p>No production schedule data available.</p>
      )}
    </div>
  );
};

export default ProductionSchedule;