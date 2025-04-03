import React from 'react';
import ScheduleTable from '../components/ScheduleTable';
import WorkingHours from '../components/WorkingHours';

const Home = () => {
  return (
    <div>
      <h2>Home</h2>
      <h3>Schedule</h3>
      <ScheduleTable />
      <h3 className="mt-4">Working Hours</h3>
      <WorkingHours />
    </div>
  );
};

export default Home;