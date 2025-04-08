import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Form, Button, Row, Col, Table, Modal } from 'react-bootstrap';
import ReactFlow, { Background, Controls, Handle } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

// Custom Node Component with Multiple Handles
const CustomNode = ({ data, id }) => {
  return (
    <div
      style={{
        background: data.completed ? '#28a745' : '#fff',
        color: data.completed ? '#fff' : '#000',
        border: '1px solid #222',
        width: 200,
        height: 60,
        borderRadius: 5,
        padding: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {/* Handles on the left for incoming edges */}
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '20%' }}
        id={`${id}-left-top`}
      />
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '50%' }}
        id={`${id}-left-middle`}
      />
      <Handle
        type="target"
        position="left"
        style={{ background: '#FF000000', width: 1, height: 1, top: '80%' }}
        id={`${id}-left-bottom`}
      />
      <div>{data.label}</div>
      {/* Handles on the right for outgoing edges */}
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '20%' }}
        id={`${id}-right-top`}
      />
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '50%' }}
        id={`${id}-right-middle`}
      />
      <Handle
        type="source"
        position="right"
        style={{ background: '#FF000000', width: 1, height: 1, top: '80%' }}
        id={`${id}-right-bottom`}
      />
    </div>
  );
};

// Define node types
const nodeTypes = {
  custom: CustomNode,
};

const AddEditJobs = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobData, setJobData] = useState({
    id: '',
    job_number: '',
    description: '',
    order_date: '',
    promised_date: '',
    quantity: '',
    price_each: '',
    customer: '',
    completed: false,
    blocked: false,
  });
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    task_sequence: '',
    description: '',
    setup_time: '',
    time_each: '',
    predecessors: '',
    resources: '',
    completed: false,
  });
  const [editTask, setEditTask] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({
    description: '',
    quantity: '',
    unit: '',
  });
  const [editMaterial, setEditMaterial] = useState(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateJobNumber, setTemplateJobNumber] = useState('');
  const [showCopyJobModal, setShowCopyJobModal] = useState(false);
  const [selectedCopyJobId, setSelectedCopyJobId] = useState('');
  const [copyJobNumber, setCopyJobNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [error, setError] = useState(null);
  const [flowchartElements, setFlowchartElements] = useState({ nodes: [], edges: [] });

  const checkAndUpdateJobCompletion = async (jobId, tasks) => {
    if (!jobId || !tasks || tasks.length === 0) return;
  
    // Check if all tasks are completed
    const allTasksCompleted = tasks.every(task => task.completed);
  
    if (allTasksCompleted && !jobData.completed) {
      try {
        // Update the job's completed status to true
        await axios.put(`http://localhost:5000/api/job/${jobId}`, {
          ...jobData,
          completed: true,
        });
        // Update the local jobData state to reflect the change
        setJobData(prev => ({ ...prev, completed: true }));
        // Refresh the jobs list to reflect the updated status
        fetchJobs();
        fetchAllJobs();
      } catch (error) {
        console.error('Error updating job completion status:', error);
        setError('Failed to update job completion status. Please try again.');
      }
    }
  };

  const sortTasksBySequence = (tasks) => {
    return [...tasks].sort((a, b) => {
      // Extract the sequence from task_number (e.g., "25001-1" -> "1")
      const sequenceA = parseInt(a.task_number.split('-')[1], 10);
      const sequenceB = parseInt(b.task_number.split('-')[1], 10);
      return sequenceA - sequenceB;
    });
  };

  useEffect(() => {
    fetchJobs();
    fetchAllJobs();
    fetchTemplates();
  }, [includeCompleted, includeBlocked]);

  useEffect(() => {
    if (id) {
      setSelectedJobId(id);
      fetchJob(id);
      fetchTasks(id);
      fetchMaterials(id);
    }
  }, [id]);

  useEffect(() => {
    if (selectedJobId && selectedJobId !== 'add' && selectedJobId !== 'template' && selectedJobId !== 'copy') {
      fetchJob(selectedJobId);
      fetchTasks(selectedJobId);
      fetchMaterials(selectedJobId);
    } else if (selectedJobId === 'add') {
      setJobData({
        id: '',
        job_number: '',
        description: '',
        order_date: '',
        promised_date: '',
        quantity: '',
        price_each: '',
        customer: '',
        completed: false,
        blocked: false,
      });
      setTasks([]);
      setMaterials([]);
      setFlowchartElements({ nodes: [], edges: [] });
    } else if (selectedJobId === 'template') {
      setShowTemplateModal(true);
    } else if (selectedJobId === 'copy') {
      setShowCopyJobModal(true);
    }
  }, [selectedJobId, jobs]);

  useEffect(() => {
    if (tasks.length === 0) {
      setFlowchartElements({ nodes: [], edges: [] });
      return;
    }

    // Initialize Dagre graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({ rankdir: 'LR' }); // Left-to-right layout
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Define node dimensions
    const nodeWidth = 200;
    const nodeHeight = 60;

    // Add nodes to Dagre graph
    tasks.forEach(task => {
      dagreGraph.setNode(task.task_number, { width: nodeWidth, height: nodeHeight });
    });

    // Add edges to Dagre graph
    tasks.forEach(task => {
      if (task.predecessors) {
        const predecessorList = task.predecessors.split(',').map(p => p.trim());
        predecessorList.forEach(predecessor => {
          if (tasks.some(t => t.task_number === predecessor)) {
            dagreGraph.setEdge(predecessor, task.task_number);
          }
        });
      }
    });

    // Run Dagre layout
    dagre.layout(dagreGraph);

    // Create React Flow nodes with positions from Dagre
    const nodes = tasks.map(task => {
      const nodeWithPosition = dagreGraph.node(task.task_number);
      return {
        id: task.task_number,
        type: 'custom', // Use the custom node type
        data: {
          label: `${task.task_number} - ${task.description}`,
          completed: task.completed,
        },
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
      };
    });

    // Distribute edges across handles to minimize connections per handle
    const edges = [];
    const sourceHandleCounts = new Map(); // Track number of edges per source handle
    const targetHandleCounts = new Map(); // Track number of edges per target handle

    // Initialize handle counts for each node
    tasks.forEach(task => {
      ['right-top', 'right-middle', 'right-bottom'].forEach(handle => {
        sourceHandleCounts.set(`${task.task_number}-${handle}`, 0);
      });
      ['left-top', 'left-middle', 'left-bottom'].forEach(handle => {
        targetHandleCounts.set(`${task.task_number}-${handle}`, 0);
      });
    });

    tasks.forEach(task => {
      if (task.predecessors) {
        const predecessorList = task.predecessors.split(',').map(p => p.trim());
        predecessorList.forEach(predecessor => {
          if (tasks.some(t => t.task_number === predecessor)) {
            // Available source handles for the predecessor
            const sourceHandles = [
              `${predecessor}-right-top`,
              `${predecessor}-right-middle`,
              `${predecessor}-right-bottom`,
            ];
            // Available target handles for the task
            const targetHandles = [
              `${task.task_number}-left-top`,
              `${task.task_number}-left-middle`,
              `${task.task_number}-left-bottom`,
            ];

            // Find the source handle with the fewest connections
            let minSourceCount = Infinity;
            let selectedSourceHandle = sourceHandles[0];
            sourceHandles.forEach(handle => {
              const count = sourceHandleCounts.get(handle);
              if (count < minSourceCount) {
                minSourceCount = count;
                selectedSourceHandle = handle;
              }
            });

            // Find the target handle with the fewest connections
            let minTargetCount = Infinity;
            let selectedTargetHandle = targetHandles[0];
            targetHandles.forEach(handle => {
              const count = targetHandleCounts.get(handle);
              if (count < minTargetCount) {
                minTargetCount = count;
                selectedTargetHandle = handle;
              }
            });

            // Increment the counts for the selected handles
            sourceHandleCounts.set(selectedSourceHandle, minSourceCount + 1);
            targetHandleCounts.set(selectedTargetHandle, minTargetCount + 1);

            // Create the edge
            edges.push({
              id: `e-${predecessor}-${task.task_number}`,
              source: predecessor,
              target: task.task_number,
              sourceHandle: selectedSourceHandle,
              targetHandle: selectedTargetHandle,
              type: 'bezier', // Use bezier for curved lines
              style: { stroke: '#000', strokeWidth: 2 }, // Solid black line
            });
          }
        });
      }
    });

    setFlowchartElements({ nodes, edges });
  }, [tasks]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/api/job', {
        params: {
          include_completed: includeCompleted,
          include_blocked: includeBlocked,
        },
      });
      // Sort jobs by job_number
      const sortedJobs = [...response.data].sort((a, b) =>
        a.job_number.localeCompare(b.job_number, undefined, { numeric: true, sensitivity: 'base' })
      );
      setJobs(sortedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Failed to fetch jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllJobs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/job', {
        params: {
          include_completed: true,
          include_blocked: true,
        },
      });
      setAllJobs(response.data);
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      setError('Failed to fetch all jobs. Please try again.');
    }
  };

  const fetchJob = async (jobId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/job/${jobId}`);
      setJobData({
        ...response.data,
        order_date: response.data.order_date ? response.data.order_date.split('T')[0] : '',
        promised_date: response.data.promised_date ? response.data.promised_date.split('T')[0] : '',
      });
    } catch (error) {
      console.error('Error fetching job:', error);
      setError('Failed to fetch job. Please try again.');
    }
  };

  const fetchTasks = async (jobId) => {
    const job = jobs.find((j) => j.id === parseInt(jobId));
    if (!job) return;
    try {
      const response = await axios.get(`http://localhost:5000/api/task/by_job/${job.job_number}`);
      const sortedTasks = sortTasksBySequence(response.data); // Sort by sequence
      setTasks(sortedTasks);
      // Check if all tasks are completed and update the job
      await checkAndUpdateJobCompletion(jobId, sortedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks. Please try again.');
    }
  };

  const fetchMaterials = async (jobId) => {
    const job = jobs.find((j) => j.id === parseInt(jobId));
    if (!job) return;
    try {
      const response = await axios.get(`http://localhost:5000/api/material/by_job/${job.job_number}`);
      setMaterials(response.data);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setError('Failed to fetch materials. Please try again.');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/template');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to fetch templates. Please try again.');
    }
  };

  const handleJobChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJobData({
      ...jobData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleTaskChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewTask({
      ...newTask,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleEditTaskChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditTask({
      ...editTask,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleMaterialChange = (e) => {
    const { name, value } = e.target;
    setNewMaterial({
      ...newMaterial,
      [name]: value,
    });
  };

  const handleEditMaterialChange = (e) => {
    const { name, value } = e.target;
    setEditMaterial({
      ...editMaterial,
      [name]: value,
    });
  };

  const handleSaveJob = async () => {
    try {
      if (selectedJobId && selectedJobId !== 'add' && selectedJobId !== 'template' && selectedJobId !== 'copy') {
        await axios.put(`http://localhost:5000/api/job/${selectedJobId}`, jobData);
        await fetchJob(selectedJobId);
        const updatedTasks = await fetchTasks(selectedJobId); // This will trigger checkAndUpdateJobCompletion
        await fetchMaterials(selectedJobId);
        // Explicitly check again in case fetchTasks fails
        await checkAndUpdateJobCompletion(selectedJobId, tasks);
      } else if (selectedJobId === 'add' || selectedJobId === 'template' || selectedJobId === 'copy') {
        const response = await axios.post('http://localhost:5000/api/job', jobData);
        setSelectedJobId(response.data.id);
        setJobData({ ...jobData, id: response.data.id });
        await fetchTasks(response.data.id); // This will trigger checkAndUpdateJobCompletion
        await fetchMaterials(response.data.id);
        // Explicitly check again in case fetchTasks fails
        await checkAndUpdateJobCompletion(response.data.id, tasks);
      }
      fetchJobs();
      fetchAllJobs();
      setError(null);
    } catch (error) {
      console.error('Error saving job:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save job. Please try again.';
      setError(errorMessage);
    }
  };

  const handleAddTask = async () => {
    if (!jobData.job_number || !newTask.task_sequence) {
      setError('Job Number and Task Sequence are required to add a task.');
      return;
    }
    try {
      const taskNumber = `${jobData.job_number}-${newTask.task_sequence}`;
      const taskData = {
        task_number: taskNumber,
        job_number: jobData.job_number,
        description: newTask.description,
        setup_time: parseInt(newTask.setup_time) || 0,
        time_each: parseFloat(newTask.time_each) || 0,
        predecessors: newTask.predecessors,
        resources: newTask.resources,
        completed: newTask.completed,
      };
      const response = await axios.post('http://localhost:5000/api/task', taskData);
      const updatedTasks = sortTasksBySequence([...tasks, { id: response.data.id, ...taskData }]); // Sort after adding
      setTasks(updatedTasks);
      setNewTask({
        task_sequence: '',
        description: '',
        setup_time: '',
        time_each: '',
        predecessors: '',
        resources: '',
        completed: false,
      });
      // Check if all tasks are completed and update the job
      await checkAndUpdateJobCompletion(selectedJobId, updatedTasks);
      setError(null);
    } catch (error) {
      console.error('Error adding task:', error);
      setError('Failed to add task. Please try again.');
    }
  };

  const handleEditTask = (task) => {
    setEditTask({ ...task });
  };

  const handleSaveTask = async () => {
    try {
      await axios.put(`http://localhost:5000/api/task/${editTask.id}`, editTask);
      const updatedTasks = sortTasksBySequence(
        tasks.map((t) => (t.id === editTask.id ? editTask : t))
      ); // Sort after updating
      setTasks(updatedTasks);
      setEditTask(null);
      // Check if all tasks are completed and update the job
      await checkAndUpdateJobCompletion(selectedJobId, updatedTasks);
      setError(null);
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`http://localhost:5000/api/task/${taskId}`);
      const updatedTasks = sortTasksBySequence(
        tasks.filter((t) => t.id !== taskId)
      ); // Sort after deleting
      setTasks(updatedTasks);
      // Check if all tasks are completed and update the job
      await checkAndUpdateJobCompletion(selectedJobId, updatedTasks);
      setError(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task. Please try again.');
    }
  };

  const handleAddMaterial = async () => {
    if (!jobData.job_number) {
      setError('Job Number is required to add a material.');
      return;
    }
    try {
      const materialData = {
        job_number: jobData.job_number,
        description: newMaterial.description,
        quantity: parseFloat(newMaterial.quantity) || 0,
        unit: newMaterial.unit,
      };
      const response = await axios.post('http://localhost:5000/api/material', materialData);
      setMaterials([...materials, { id: response.data.id, ...materialData }]);
      setNewMaterial({
        description: '',
        quantity: '',
        unit: '',
      });
      setError(null);
    } catch (error) {
      console.error('Error adding material:', error);
      setError('Failed to add material. Please try again.');
    }
  };

  const handleEditMaterial = (material) => {
    setEditMaterial({ ...material });
  };

  const handleSaveMaterial = async () => {
    try {
      await axios.put(`http://localhost:5000/api/material/${editMaterial.id}`, editMaterial);
      setMaterials(materials.map((m) => (m.id === editMaterial.id ? editMaterial : m)));
      setEditMaterial(null);
      setError(null);
    } catch (error) {
      console.error('Error updating material:', error);
      setError('Failed to update material. Please try again.');
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    try {
      await axios.delete(`http://localhost:5000/api/material/${materialId}`);
      setMaterials(materials.filter((m) => m.id !== materialId));
      setError(null);
    } catch (error) {
      console.error('Error deleting material:', error);
      setError('Failed to delete material. Please try again.');
    }
  };

  const handleTemplateSelect = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template.');
      return;
    }
    if (!templateJobNumber) {
      setError('Please enter a job number.');
      return;
    }
  
    setIsCreatingJob(true);
    try {
      const jobsResponse = await axios.get('http://localhost:5000/api/job');
      const existingJob = jobsResponse.data.find((job) => job.job_number === templateJobNumber);
      if (existingJob) {
        setError(`Job number '${templateJobNumber}' already exists. Please choose a different job number.`);
        setIsCreatingJob(false);
        return;
      }
  
      const templateResponse = await axios.get('http://localhost:5000/api/template');
      const template = templateResponse.data.find((t) => t.id === parseInt(selectedTemplateId));
      if (!template) {
        setError('Template not found.');
        setIsCreatingJob(false);
        return;
      }
  
      const newJobData = {
        job_number: templateJobNumber,
        description: template.description,
        order_date: new Date().toISOString().split('T')[0],
        promised_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        quantity: 1,
        price_each: template.price_each,
        customer: '',
        completed: false,
        blocked: false,
      };
      const createJobResponse = await axios.post('http://localhost:5000/api/job', newJobData);
      const newJobId = createJobResponse.data.id;
  
      const templateTasksResponse = await axios.get(
        `http://localhost:5000/api/template_task/${selectedTemplateId}`
      );
      const templateMaterialsResponse = await axios.get(
        `http://localhost:5000/api/template_material/${selectedTemplateId}`
      );
  
      const newTasks = [];
      for (const [index, t] of templateTasksResponse.data.entries()) {
        const taskNumber = `${newJobData.job_number}-${index + 1}`;
        let transformedPredecessors = '';
        if (t.predecessors) {
          const predecessorSequences = t.predecessors.split(',').map((seq) => seq.trim());
          const newPredecessors = predecessorSequences.map((seq) => `${newJobData.job_number}-${seq}`);
          transformedPredecessors = newPredecessors.join(', ');
        }
  
        const taskData = {
          task_number: taskNumber,
          job_number: newJobData.job_number,
          description: t.description,
          setup_time: t.setup_time,
          time_each: t.time_each,
          predecessors: transformedPredecessors,
          resources: t.resources,
          completed: false,
        };
        const response = await axios.post('http://localhost:5000/api/task', taskData);
        newTasks.push({ id: response.data.id, ...taskData });
      }
  
      const newMaterials = [];
      for (const m of templateMaterialsResponse.data) {
        const materialData = {
          job_number: newJobData.job_number,
          description: m.description,
          quantity: m.quantity,
          unit: m.unit,
        };
        const response = await axios.post('http://localhost:5000/api/material', materialData);
        newMaterials.push({ id: response.data.id, ...materialData });
      }
  
      setJobData({
        ...newJobData,
        id: newJobId,
        order_date: newJobData.order_date,
        promised_date: newJobData.promised_date,
      });
      const sortedTasks = sortTasksBySequence(newTasks); // Sort tasks by sequence
      setTasks(sortedTasks);
      setMaterials(newMaterials);
      setSelectedJobId(newJobId);
      setShowTemplateModal(false);
      setTemplateJobNumber('');
      setError(null);
    } catch (error) {
      console.error('Error creating job from template:', error);
      const errorMessage =
        error.response?.data?.error || 'Failed to create job from template. Please try again.';
      setError(errorMessage);
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleCopyJobSelect = async () => {
    if (!selectedCopyJobId) {
      setError('Please select a job to copy.');
      return;
    }
    if (!copyJobNumber) {
      setError('Please enter a job number.');
      return;
    }
  
    setIsCreatingJob(true);
    try {
      const jobsResponse = await axios.get('http://localhost:5000/api/job');
      const existingJob = jobsResponse.data.find((job) => job.job_number === copyJobNumber);
      if (existingJob) {
        setError(`Job number '${copyJobNumber}' already exists. Please choose a different job number.`);
        setIsCreatingJob(false);
        return;
      }
  
      const jobToCopyResponse = await axios.get(`http://localhost:5000/api/job/${selectedCopyJobId}`);
      const jobToCopy = jobToCopyResponse.data;
      if (!jobToCopy) {
        setError('Job not found.');
        setIsCreatingJob(false);
        return;
      }
  
      const newJobData = {
        job_number: copyJobNumber,
        description: jobToCopy.description,
        order_date: new Date().toISOString().split('T')[0],
        promised_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        quantity: jobToCopy.quantity,
        price_each: jobToCopy.price_each,
        customer: jobToCopy.customer,
        completed: false,
        blocked: false,
      };
      const createJobResponse = await axios.post('http://localhost:5000/api/job', newJobData);
      const newJobId = createJobResponse.data.id;
  
      const tasksToCopyResponse = await axios.get(
        `http://localhost:5000/api/task/by_job/${jobToCopy.job_number}`
      );
      const materialsToCopyResponse = await axios.get(
        `http://localhost:5000/api/material/by_job/${jobToCopy.job_number}`
      );
  
      const newTasks = [];
      for (const t of tasksToCopyResponse.data) {
        const taskSequence = t.task_number.split('-')[1];
        const newTaskNumber = `${newJobData.job_number}-${taskSequence}`;
        const taskData = {
          task_number: newTaskNumber,
          job_number: newJobData.job_number,
          description: t.description,
          setup_time: t.setup_time,
          time_each: t.time_each,
          predecessors: t.predecessors
            ? t.predecessors.replace(/\d+-\d+/g, (match) => {
                const sequence = match.split('-')[1];
                return `${newJobData.job_number}-${sequence}`;
              })
            : '',
          resources: t.resources,
          completed: false, // Set to false for all tasks in the new job
        };
        const response = await axios.post('http://localhost:5000/api/task', taskData);
        newTasks.push({ id: response.data.id, ...taskData });
      }
  
      const newMaterials = [];
      for (const m of materialsToCopyResponse.data) {
        const materialData = {
          job_number: newJobData.job_number,
          description: m.description,
          quantity: m.quantity,
          unit: m.unit,
        };
        const response = await axios.post('http://localhost:5000/api/material', materialData);
        newMaterials.push({ id: response.data.id, ...materialData });
      }
  
      setJobData({
        ...newJobData,
        id: newJobId,
        order_date: newJobData.order_date,
        promised_date: newJobData.promised_date,
      });
      const sortedTasks = sortTasksBySequence(newTasks); // Sort tasks by sequence
      setTasks(sortedTasks);
      setMaterials(newMaterials);
      setSelectedJobId(newJobId);
      setShowCopyJobModal(false);
      setCopyJobNumber('');
      setSelectedCopyJobId('');
      setError(null);
    } catch (error) {
      console.error('Error copying job:', error);
      const errorMessage = error.response?.data?.error || 'Failed to copy job. Please try again.';
      setError(errorMessage);
    } finally {
      setIsCreatingJob(false);
    }
  };

  if (loading) {
    return (
      <div className="spinner-border" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      <h2>Add/Edit Jobs</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <Form className="mb-4">
        <Row>
          <Col md={4}>
            <Form.Group controlId="job_number">
              <Form.Label>Job Number</Form.Label>
              <Form.Control
                as="select"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="add">Add new job</option>
                <option value="template">Add from template</option>
                <option value="copy">Copy previous job</option>
                {[...jobs] // Create a copy of the jobs array
                  .sort((a, b) =>
                    a.job_number.localeCompare(b.job_number, undefined, { numeric: true, sensitivity: 'base' })
                  ) // Sort by job_number
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {`${job.job_number} - ${job.description} - ${job.customer}`}
                    </option>
                  ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={4} className="d-flex align-items-end">
            <Form.Group controlId="include_completed" className="me-3">
              <Form.Check
                type="checkbox"
                label="Include completed jobs"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
              />
            </Form.Group>
            <Form.Group controlId="include_blocked">
              <Form.Check
                type="checkbox"
                label="Include blocked jobs"
                checked={includeBlocked}
                onChange={(e) => setIncludeBlocked(e.target.checked)}
              />
            </Form.Group>
          </Col>
        </Row>
      </Form>

      <Form className="mb-4">
        <Row>
          <Col>
            <Form.Group controlId="id">
              <Form.Label>ID</Form.Label>
              <Form.Control type="text" name="id" value={jobData.id} disabled />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="job_number_input">
              <Form.Label>Job Number</Form.Label>
              <Form.Control
                type="text"
                name="job_number"
                value={jobData.job_number}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="description">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={jobData.description}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col>
            <Form.Group controlId="order_date">
              <Form.Label>Order Date</Form.Label>
              <Form.Control
                type="date"
                name="order_date"
                value={jobData.order_date}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="promised_date">
              <Form.Label>Promised Date</Form.Label>
              <Form.Control
                type="date"
                name="promised_date"
                value={jobData.promised_date}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="quantity">
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                type="number"
                name="quantity"
                value={jobData.quantity}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col>
            <Form.Group controlId="price_each">
              <Form.Label>Price Each (ZAR)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="price_each"
                value={jobData.price_each}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="customer">
              <Form.Label>Customer</Form.Label>
              <Form.Control
                type="text"
                name="customer"
                value={jobData.customer}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col>
            <Form.Group controlId="completed">
              <Form.Check
                type="checkbox"
                label="Completed"
                name="completed"
                checked={jobData.completed}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="blocked">
              <Form.Check
                type="checkbox"
                label="Blocked"
                name="blocked"
                checked={jobData.blocked}
                onChange={handleJobChange}
              />
            </Form.Group>
          </Col>
          <Col className="align-self-end">
            <Button variant="primary" onClick={handleSaveJob}>
              Save Job
            </Button>
          </Col>
        </Row>
      </Form>

      {selectedJobId && selectedJobId !== 'template' && selectedJobId !== 'copy' && (
        <>
          <h3 className="mt-4">Tasks</h3>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="task_sequence">
                  <Form.Label>Task Sequence</Form.Label>
                  <Form.Control
                    type="number"
                    name="task_sequence"
                    value={newTask.task_sequence}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="description">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    type="text"
                    name="description"
                    value={newTask.description}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="setup_time">
                  <Form.Label>Setup Time</Form.Label>
                  <Form.Control
                    type="number"
                    name="setup_time"
                    value={newTask.setup_time}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="time_each">
                  <Form.Label>Time Each</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    name="time_each"
                    value={newTask.time_each}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="predecessors">
                  <Form.Label>Predecessors</Form.Label>
                  <Form.Control
                    type="text"
                    name="predecessors"
                    value={newTask.predecessors}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="resources">
                  <Form.Label>Resources</Form.Label>
                  <Form.Control
                    type="text"
                    name="resources"
                    value={newTask.resources}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="completed">
                  <Form.Label>Completed</Form.Label>
                  <Form.Check
                    type="checkbox"
                    name="completed"
                    checked={newTask.completed}
                    onChange={handleTaskChange}
                  />
                </Form.Group>
              </Col>
              <Col className="align-self-end">
                <Button
                  variant="primary"
                  onClick={handleAddTask}
                  disabled={
                    !newTask.task_sequence ||
                    !newTask.description ||
                    !newTask.setup_time ||
                    !newTask.time_each
                  }
                >
                  Add Task
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Task Number</th>
                <th>Description</th>
                <th>Setup Time</th>
                <th>Time Each</th>
                <th>Predecessors</th>
                <th>Resources</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  {editTask && editTask.id === t.id ? (
                    <>
                      <td>
                        <Form.Control
                          type="text"
                          name="task_number"
                          value={editTask.task_number}
                          onChange={handleEditTaskChange}
                          disabled
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="description"
                          value={editTask.description}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          name="setup_time"
                          value={editTask.setup_time}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          name="time_each"
                          value={editTask.time_each}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="predecessors"
                          value={editTask.predecessors}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="resources"
                          value={editTask.resources}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Form.Check
                          type="checkbox"
                          name="completed"
                          checked={editTask.completed}
                          onChange={handleEditTaskChange}
                        />
                      </td>
                      <td>
                        <Button variant="success" size="sm" onClick={handleSaveTask} className="me-2">
                          Save
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setEditTask(null)}>
                          Cancel
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{t.task_number}</td>
                      <td>{t.description}</td>
                      <td>{t.setup_time}</td>
                      <td>{t.time_each}</td>
                      <td>{t.predecessors}</td>
                      <td>{t.resources}</td>
                      <td>
                        <Form.Check type="checkbox" checked={t.completed} disabled />
                      </td>
                      <td>
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleEditTask(t)}
                          className="me-2"
                        >
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteTask(t.id)}>
                          Delete
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          <h3 className="mt-4">Materials</h3>
          <Form className="mb-4">
            <Row>
              <Col>
                <Form.Group controlId="description">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    type="text"
                    name="description"
                    value={newMaterial.description}
                    onChange={handleMaterialChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="quantity">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    name="quantity"
                    value={newMaterial.quantity}
                    onChange={handleMaterialChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="unit">
                  <Form.Label>Unit</Form.Label>
                  <Form.Control
                    type="text"
                    name="unit"
                    value={newMaterial.unit}
                    onChange={handleMaterialChange}
                  />
                </Form.Group>
              </Col>
              <Col className="align-self-end">
                <Button
                  variant="primary"
                  onClick={handleAddMaterial}
                  disabled={
                    !newMaterial.description || !newMaterial.quantity || !newMaterial.unit
                  }
                >
                  Add Material
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  {editMaterial && editMaterial.id === m.id ? (
                    <>
                      <td>{m.id}</td>
                      <td>
                        <Form.Control
                          type="text"
                          name="description"
                          value={editMaterial.description}
                          onChange={handleEditMaterialChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          name="quantity"
                          value={editMaterial.quantity}
                          onChange={handleEditMaterialChange}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="unit"
                          value={editMaterial.unit}
                          onChange={handleEditMaterialChange}
                        />
                      </td>
                      <td>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={handleSaveMaterial}
                          className="me-2"
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditMaterial(null)}
                        >
                          Cancel
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{m.id}</td>
                      <td>{m.description}</td>
                      <td>{m.quantity}</td>
                      <td>{m.unit}</td>
                      <td>
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleEditMaterial(m)}
                          className="me-2"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteMaterial(m.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          <h3 className="mt-4">Task Flowchart</h3>
          {flowchartElements.nodes.length > 0 ? (
            <div style={{ height: '600px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <ReactFlow
                nodes={flowchartElements.nodes}
                edges={flowchartElements.edges}
                nodeTypes={nodeTypes}
                fitView
                style={{ width: '100%', height: '100%' }}
                defaultEdgeOptions={{ type: 'bezier', style: { stroke: '#000', strokeWidth: 2 } }}
              >
                <Background />
                <Controls />
              </ReactFlow>
            </div>
          ) : (
            <p>No tasks available to display in the flowchart.</p>
          )}
        </>
      )}

      <Modal show={showTemplateModal} onHide={() => setShowTemplateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Job from Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isCreatingJob ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Creating job...</span>
              </div>
              <p>Creating job from template...</p>
            </div>
          ) : (
            <>
              <Form.Group controlId="template_select" className="mb-3">
                <Form.Label>Select Template</Form.Label>
                <Form.Control
                  as="select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">-- Select a template --</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
              <Form.Group controlId="template_job_number">
                <Form.Label>Job Number</Form.Label>
                <Form.Control
                  type="text"
                  value={templateJobNumber}
                  onChange={(e) => setTemplateJobNumber(e.target.value)}
                  placeholder="Enter job number"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowTemplateModal(false);
              setTemplateJobNumber('');
            }}
            disabled={isCreatingJob}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleTemplateSelect} disabled={isCreatingJob}>
            Create Job from Template
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCopyJobModal} onHide={() => setShowCopyJobModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Copy Previous Job</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isCreatingJob ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Copying job...</span>
              </div>
              <p>Copying job...</p>
            </div>
          ) : (
            <>
              <Form.Group controlId="copy_job_select" className="mb-3">
                <Form.Label>Select Job to Copy</Form.Label>
                <Form.Control
                  as="select"
                  value={selectedCopyJobId}
                  onChange={(e) => setSelectedCopyJobId(e.target.value)}
                >
                  <option value="">-- Select a job --</option>
                  {allJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {`${job.job_number} - ${job.description} - ${job.customer}`}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
              <Form.Group controlId="copy_job_number">
                <Form.Label>New Job Number</Form.Label>
                <Form.Control
                  type="text"
                  value={copyJobNumber}
                  onChange={(e) => setCopyJobNumber(e.target.value)}
                  placeholder="Enter new job number"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowCopyJobModal(false);
              setCopyJobNumber('');
              setSelectedCopyJobId('');
            }}
            disabled={isCreatingJob}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCopyJobSelect} disabled={isCreatingJob}>
            Copy Job
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AddEditJobs;