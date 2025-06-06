import React, { useEffect, useState } from 'react';
import { Card, Button, Alert, ProgressBar } from 'react-bootstrap';

const TaskControl = () => {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [exitingTasks, setExitingTasks] = useState([]);
  const [sortByJob, setSortByJob] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/scheduled_tasks')
      .then(response => response.json())
      .then(data => {
        console.log('API Response:', data);
        if (data.error) {
          setError(data.error);
          setTasks([]);
        } else if (Array.isArray(data)) {
          setTasks(sortTasks(data, sortByJob));
          setTotalToday(data.length);
          setCompletedToday(0);
        } else {
          setError('Invalid data format from server');
          setTasks([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch Error:', err);
        setError(err.message);
        setTasks([]);
        setLoading(false);
      });
  }, [sortByJob]);

  const sortTasks = (tasks, byJob) => {
    return [...tasks].sort((a, b) => {
      if (byJob) {
        const jobCompare = a.job_number.localeCompare(b.job_number);
        return jobCompare || new Date(a.completion_date) - new Date(b.completion_date);
      }
      return new Date(a.completion_date) - new Date(b.completion_date);
    });
  };

  const toggleSort = () => setSortByJob(!sortByJob);

  const markTaskDone = (taskNumber) => {
    console.log(`Applying shrink animation to task: ${taskNumber}`);
    setExitingTasks([...exitingTasks, taskNumber]);
    setTimeout(() => {
      console.log(`Removing task: ${taskNumber} after animation`);
      fetch('http://localhost:5000/api/task/complete_task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_number: taskNumber })
      })
        .then(response => response.json())
        .then(data => {
          console.log(`Task ${taskNumber} completed, Success: ${data.success}`);
          if (data.success) {
            setTasks(tasks.filter(task => task.task_number !== taskNumber));
            setCompletedToday(completedToday + 1);
            setExitingTasks(exitingTasks.filter(id => id !== taskNumber));
          } else {
            setError(data.error);
            setExitingTasks(exitingTasks.filter(id => id !== taskNumber));
          }
        })
        .catch(err => {
          console.error('Complete Task Error:', err);
          setError(err.message);
          setExitingTasks(exitingTasks.filter(id => id !== taskNumber));
        });
    }, 800);
  };

  if (loading) return <div>Loading</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="task-control">
      <h2>Tasks</h2>
      <Button
        variant="primary"
        size="lg"
        onClick={toggleSort}
        className="task-sort-button mb-4"
      >
        {sortByJob ? 'Sort by Date' : 'Sort by Job'}
      </Button>
      <ProgressBar
        now={(completedToday / totalToday) * 100}
        label={`${completedToday}/${totalToday} completed today`}
        className="mb-4"
      />
      {tasks.length === 0 ? (
        <Alert variant="warning" className="mt-3">No tasks scheduled!</Alert>
      ) : (
        tasks.map(task => (
          <Card
            key={task.task_number}
            className={`mb-3 task-card ${exitingTasks.includes(task.task_number) ? 'task-card-exit' : ''}`}
          >
            <Card.Body>
              <Card.Title>{`${task.job_number} - ${task.customer} - ${task.job_description}`}</Card.Title>
              <Card.Text><strong>{task.task_description}</strong></Card.Text>
              <Card.Text>
                Due: {new Date(task.completion_date).toLocaleString('en-ZA', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Card.Text>
              {task.completed_at && (
                <Card.Text>
                  Completed: {new Date(task.completed_at).toLocaleString('en-ZA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Card.Text>
              )}
              <Button
                variant="success"
                size="lg"
                onClick={() => markTaskDone(task.task_number)}
                className="task-button"
                disabled={exitingTasks.includes(task.task_number)}
              >
                Mark Done
              </Button>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
};

export default TaskControl;