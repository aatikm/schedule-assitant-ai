import React from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import '@bryntum/gantt/gantt.stockholm.css'; // or gantt.classic.css

const BryntumGanttComponent = (props:any) => {
  const { scheduleData } = props;
  const projectConfig = {
    startDate: new Date(2024, 0, 1),
    tasksData: scheduleData,
    dependenciesData: [{ fromTask: 2, toTask: 3 }],
  };

  return (
    <div
      style={{
        height: "inherit",
        border: "1px solid #ccc",
        marginBottom: "1rem",
      }}
    >
      <BryntumGantt
        project={projectConfig}
        columns={[
          { type: "name", field: "name", text: "Task Name", width: 250 },
        ]}
      />
    </div>
  );
};

export default BryntumGanttComponent;
