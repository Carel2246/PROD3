import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import ScheduleTable from './components/ScheduleTable';
import WorkingHours from './components/WorkingHours';

function App() {
  return (
    <div>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#">Timely Scheduler</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link href="#schedule">Schedule</Nav.Link>
            <Nav.Link href="#hours">Working Hours</Nav.Link>
          </Nav>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <h2 id="schedule">Schedule</h2>
        <ScheduleTable />
        <h2 id="hours" className="mt-4">Working Hours</h2>
        <WorkingHours />
      </Container>
    </div>
  );
}

export default App;