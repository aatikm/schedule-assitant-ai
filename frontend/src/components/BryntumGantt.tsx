import React from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
// import '@bryntum/gantt/gantt.stockholm.css'; // or gantt.classic.css
import "./GantStyle.scss";
import { Grid, Model, Row } from '@bryntum/gantt';
const BryntumGanttComponent = (props:any) => {
  const { scheduleData } = props;
  const projectConfig = {
   "project": {
        "calendar": "general",
        "startDate": "2025-03-14",
        "hoursPerDay": 24,
        "daysPerWeek": 5,
        "daysPerMonth": 20
      },
    tasksData: scheduleData?.tasks.rows, 
    dependenciesData: [
      { fromTask: 2, toTask: 3 }
    ]
  };
  const onRowRender = (event: {source: Grid,
  row: Row,
  record: Model,
  recordIndex: number}) => {
      if (event.record.childLevel > -1) {
        const level = event.record.childLevel % 5;
        //@ts-ignore
      const isCritical = event.record.critical;
      // if (level === 0 && isCritical && showCritical) {
        if (level === 0 ) {
        event.row.cells.forEach((cell, index) => {
          if (
            index !== 0 &&
            cell.className !==
              "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
          )
            cell.className = cell.className + " task-depth-0";
        });
      }
        if (level === 1) {
          event.row.cells.forEach((cell, index) => {
            if (
              index !== 0 &&
              cell.className !==
                "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
            )
              cell.className = cell.className + " task-depth-1";
          });
          // row.addCls('task-depth-1');
        }

        if (level === 2) {
         event.row.cells.forEach((cell, index) => {
            if (
              index !== 0 &&
              cell.className !==
                "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
            )
              cell.className =  cell.className + " task-depth-2" ;
          });
          //  row.addCls('task-depth-2')
        }
        if (level === 3) {
          event.row.cells.forEach((cell, index) => {
            if (
              index !== 0 &&
              cell.className !==
                "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
            )
              cell.className =cell.className + " task-depth-3";
          });
          //  row.addCls('task-depth-3')
        }
        if (level === 4) {
          event.row.cells.forEach((cell, index) => {
            if (
              index !== 0 &&
              cell.className !==
                "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
            )
              cell.className =  cell.className + " task-depth-4";
          });
          //  row.addCls('task-depth-4')
        }
        if (level === 5) {
          event.row.cells.forEach((cell, index) => {
            if (
              index !== 0 &&
              cell.className !==
                "b-grid-cell b-timeaxis-cell b-widget-cell b-sch-timeaxis-cell"
            )
              cell.className =  cell.className + " task-depth-5";
          });
          //  row.addCls('task-depth-5')
        }
      }
  }


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
          {type: "startdate", field: "startDate", text: "Start Date", width: 150 },
          {type: "enddate", field: "endDate", text: "End Date", width: 150 },
          { type: "duration", field: "duration", text: "Duration", width: 100 },
        
          
        ]}
          onRenderRow={onRowRender}
      />
    </div>
  );
};

export default BryntumGanttComponent;
