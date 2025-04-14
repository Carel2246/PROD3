import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import Home from './pages/Home';
import ProductionSchedule from './pages/ProductionSchedule';
import ListSchedule from './pages/ListSchedule';
import DeliverySchedule from './pages/DeliverySchedule';
import GanttChart from './pages/GanttChart';
import CashFlowProjection from './pages/CashFlowProjection';
import AddEditJobs from './pages/AddEditJobs';
import ReviewJobs from './pages/ReviewJobs';
import RawJobsData from './pages/RawJobsData';
import RawTaskData from './pages/RawTaskData';
import AddEditCalendar from './pages/AddEditCalendar';
import AddEditHolidays from './pages/AddEditHolidays';
import AddEditResources from './pages/AddEditResources';
import AddEditResourceGroups from './pages/AddEditResourceGroups';
import AddEditTemplates from './pages/AddEditTemplates';

function App() {
  return (
    <Router>
      <div>
        <Navbar bg="dark" variant="dark" expand="lg" fixed="top">
          <Container>
            <Navbar.Brand as={Link} to="/">Timely Scheduler</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/">Home</Nav.Link>
                <NavDropdown title="Reports" id="reports-dropdown">
                  <NavDropdown.Item as={Link} to="/reports/production-schedule">Production Schedule</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/reports/list-schedule">List Schedule</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/reports/delivery-schedule">Delivery Schedule</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/reports/gantt-chart">Gantt Chart</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/reports/cash-flow-projection">Cash Flow Projection</NavDropdown.Item>
                </NavDropdown>
                <NavDropdown title="Job Management" id="job-management-dropdown">
                  <NavDropdown.Item as={Link} to="/job-management/add-edit-jobs">Add/Edit Jobs</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/job-management/review-jobs">Review Jobs</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/job-management/raw-jobs-data">Raw Jobs Data</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/job-management/raw-task-data">Raw Task Data</NavDropdown.Item>
                </NavDropdown>
                <NavDropdown title="Setup" id="setup-dropdown">
                  <NavDropdown.Item as={Link} to="/setup/add-edit-calendar">Add/Edit Calendar</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/setup/add-edit-holidays">Add/Edit Off days</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/setup/add-edit-resources">Add/Edit Resources</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/setup/add-edit-resource-groups">Add/Edit Resource Groups</NavDropdown.Item>
                  <NavDropdown.Item as={Link} to="/setup/add-edit-templates">Add/Edit Templates</NavDropdown.Item>
                </NavDropdown>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
        <div style={{ paddingTop: '70px' }}>
          <Container>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/reports/production-schedule" element={<ProductionSchedule />} />
              <Route path="/reports/list-schedule" element={<ListSchedule />} />
              <Route path="/reports/delivery-schedule" element={<DeliverySchedule />} />
              <Route path="/reports/gantt-chart" element={<GanttChart />} />
              <Route path="/reports/cash-flow-projection" element={<CashFlowProjection />} />
              <Route path="/job-management/add-edit-jobs" element={<AddEditJobs />} />
              <Route path="/job-management/review-jobs" element={<ReviewJobs />} />
              <Route path="/job-management/raw-jobs-data" element={<RawJobsData />} />
              <Route path="/job-management/raw-task-data" element={<RawTaskData />} />
              <Route path="/setup/add-edit-calendar" element={<AddEditCalendar />} />
              <Route path="/setup/add-edit-holidays" element={<AddEditHolidays />} />
              <Route path="/setup/add-edit-resources" element={<AddEditResources />} />
              <Route path="/setup/add-edit-resource-groups" element={<AddEditResourceGroups />} />
              <Route path="/setup/add-edit-templates" element={<AddEditTemplates />} />
            </Routes>
          </Container>
        </div>
      </div>
    </Router>
  );
}

export default App;