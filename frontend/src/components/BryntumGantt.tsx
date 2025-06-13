import React from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import '@bryntum/gantt/gantt.stockholm.css'; // or gantt.classic.css

const BryntumGanttComponent = () => {
  const projectConfig = {
    startDate: new Date(2024, 0, 1),
    tasksData: [
      
    {
        "id": 1,
        "name": "Design",
        "startDate": "2025-06-17",
        "duration": 3,
        "predecessors": [],
        "durationUnit": "d"
    },
    {
        "id": 2,
        "name": "Development",
        "duration": 5,
        "predecessors": [
            {
                "from": 1,
                "type": 2
            }
        ],
        "startDate": "2025-06-20",
        "durationUnit": "d"
    },
    {
        "id": 3,
        "name": "Testing",
        "duration": 2,
        "predecessors": [
            {
                "from": 2,
                "type": 2
            }
        ],
        "startDate": "2025-06-25",
        "durationUnit": "d"
    },
    {
        "id": 4,
        "name": "Deployment",
        "duration": 1,
        "predecessors": [
            {
                "from": 3,
                "type": 2
            }
        ],
        "startDate": "2025-06-27",
        "durationUnit": "d"
    }
]
    ,
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
