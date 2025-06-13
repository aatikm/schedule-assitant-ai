import React from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import '@bryntum/gantt/gantt.stockholm.css'; // or gantt.classic.css

const BryntumGanttComponent = () => {
  const projectConfig = {
    startDate: new Date(2024, 0, 1),
    tasksData: [
      { id: 1, name: 'Project', expanded: true },
      { id: 2, name: 'Task 1', startDate: '2024-01-01', duration: 5, parentId: 1 },
      { id: 3, name: 'Task 2', startDate: '2024-01-06', duration: 3, parentId: 1 }
    ],
    dependenciesData: [
      { fromTask: 2, toTask: 3 }
    ]
  };

  return (
    <div style={{ height: '100vh' }}>
      <BryntumGantt
        project={projectConfig}
        columns={[
          { type: 'name', field: 'name', text: 'Task Name', width: 250 }
        ]}
      />
    </div>
  );
};

export default BryntumGanttComponent;
