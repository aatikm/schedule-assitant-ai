import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// In-memory store
let currentScheduleJson: string | null = null;
let currentThreadId: string | null = null; // NEW: thread memory

// JSON validity check
const isValidJson = (text: string) => {
  try {
    const parsed = JSON.parse(text);
    return parsed && parsed.tasks && parsed.tasks.rows;
  } catch {
    return false;
  }
};

app.post("/schedule", async (req, res) => {
  const userPrompt = req.body.prompt;
  const headers = {
    "api-key": process.env.OPENAI_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    const effectivePrompt = currentScheduleJson
      ? `This is the current schedule JSON:\n${currentScheduleJson}\n\nNow, based on this schedule, ${userPrompt}`
      : userPrompt;

    const endpoint = `https://sivac-m74yevap-eastus2.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

    const requestBody = {
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for scheduling.",
        },
        { role: "user", content: effectivePrompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };

    const response = await axios.post(endpoint, requestBody, { headers });
    const content = response.data.choices[0].message.content;

    // Extract JSON block
    const match =
      content.match(/```json\n([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
    const jsonText = match ? match[1] : null;

    if (jsonText && isValidJson(jsonText)) {
      currentScheduleJson = jsonText;
      console.log("✅ JSON schedule updated");
    } else {
      console.log("⚠️ No valid JSON found. Schedule remains unchanged.");
    }

    res.json({ scheduleJson: content });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Assistant request failed" });
  }
});

app.post("/reset-schedule", (req, res) => {
  currentScheduleJson = null;
  currentThreadId = null; // RESET thread as well
  res.json({ message: "Schedule reset" });
});

app.post("/llm-project-query", async (req: any, res: any) => {
  const { projectNumber, token, prompt } = req.body;

  const tools = [
    {
      type: "function",
      function: {
        name: "get_project_schedule",
        description:
          "Fetch the schedule data from P6 API using project number and token",
        parameters: {
          type: "object",
          properties: {
            projectNumber: {
              type: "string",
              description:
                "The project number or ID to fetch schedule data for",
            },
            token: {
              type: "string",
              description: "The token to authenticate against the P6 API",
            },
          },
          required: ["projectNumber", "token"],
          additionalProperties: false,
        },
      },
    },
  ];

  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant. Use the tool to get schedule data before answering.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const endpoint = `https://sivac-m74yevap-eastus2.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

  try {
    const response = await axios.post(
      endpoint,
      {
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          "api-key": process.env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const assistantMessage = response.data.choices[0].message;
    console.log(
      "🔍 Tool Call Result:",
      JSON.stringify(assistantMessage, null, 2)
    );

    // Step 2a: Check for tool call
    const toolCalls = assistantMessage.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      const { name } = toolCall.function;
      const {id : tool_call_id} = toolCall
      // const parsedArgs = JSON.parse(args);

      if (name === "get_project_schedule") {
        try {
          const path = `${process.env.P6_API_URL}/p6-activites?baselineId=${projectNumber}`;

          const apiResp = await axios.get(path, {
            headers: {
              accept: "application/json;odata=verbose",
              "Content-Transfer-Encoding": "application/gzip",
              Authorization: `Bearer ${token}`,
            },
          });

          const { tasks, dependencies, calendars, project } = apiResp.data;
          
          const toolResponseMessage = {
            role: "tool",
            tool_call_id: tool_call_id,
            content: JSON.stringify(apiResp.data),
          };

          const finalResponse = await axios.post(
            endpoint,
            {
              messages: [...messages, assistantMessage, toolResponseMessage],
              temperature: 0.7,
              max_tokens: 1500,
            },
            {
              headers: {
                "api-key": process.env.OPENAI_API_KEY,
                "Content-Type": "application/json",
              },
            }
          );

          const finalAnswer = finalResponse.data.choices[0].message;
          return res.json({ answer: finalAnswer.content });
        } catch (toolErr: any) {
          console.error(
            "❌ Tool API call failed:",
            toolErr.response?.data || toolErr.message
          );
          return res.status(500).json({ error: "Tool execution failed" });
        }
      }
    }

    res.json({ assistantMessage });
  } catch (err: any) {
    console.error("❌ LLM Request failed:", err.response?.data || err.message);
    res.status(500).json({ error: "LLM call failed" });
  }
});

// LLM extracts filter, server filters activity data, then feeds response

// function matchCondition(fieldValue: string, operator: any, value: string) {
//   if (typeof fieldValue !== "string") return false;
//   switch (operator) {
//     case "equals": return fieldValue === value;
//     case "startsWith": return fieldValue.startsWith(value);
//     case "contains": return fieldValue.includes(value);
//     default: return false;
//   }
// }

// function filterTaskTree(task: any, fieldPath: any, operator: any, value: string) {
//   const matches: any[] = [];
//   const getFieldValue = (obj: any, path: any[]) => path.reduce((acc, key) => acc?.[key], obj);

//   const recurse = (node: { children: any[]; }) => {
//     const fieldValue = getFieldValue(node, fieldPath);
//     if (matchCondition(fieldValue, operator, value)) {
//       matches.push(node);
//     }
//     if (Array.isArray(node?.children)) {
//       node.children.forEach(recurse);
//     }
//   };

//   recurse(task);
//   return matches;
// }

// app.post("/llm-project-query", async (req: any, res: any) => {
//   const { projectNumber, token, prompt } = req.body;

//   const tools = [
//     {
//       type: "function",
//       function: {
//         name: "get_project_schedule",
//         description: "Fetch the schedule data from P6 API using project number and token",
//         parameters: {
//           type: "object",
//           properties: {
//             projectNumber: {
//               type: "string",
//               description: "The project number or ID to fetch schedule data for"
//             },
//             token: {
//               type: "string",
//               description: "The token to authenticate against the P6 API"
//             }
//           },
//           // required: ["projectNumber", "token"],
//           additionalProperties: false
//         }
//       }
//     },
//     {
//       type: "function",
//       function: {
//         name: "filter_activity_data",
//         description: "Specify how to filter the P6 activity data.",
//         parameters: {
//           type: "object",
//           properties: {
//             entity: { type: "string", enum: ["tasks"] },
//             field: { type: "string" },
//             operator: { type: "string", enum: ["equals", "startsWith", "contains"] },
//             value: { type: "string" }
//           },
//           required: ["entity", "field", "operator", "value"]
//         }
//       }
//     }
//   ];

//   const messages = [
//     {
//       role: "system",
//       content: "You are a helpful assistant. Use tools to retrieve and filter project schedule data as needed."
//     },
//     {
//       role: "user",
//       content: prompt
//     }
//   ];

//   const endpoint = `https://sivac-m74yevap-eastus2.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

//   try {
//     const response = await axios.post(endpoint, {
//       messages,
//       tools,
//       tool_choice: "auto",
//       temperature: 0.7,
//       max_tokens: 1000
//     }, {
//       headers: {
//         "api-key": process.env.OPENAI_API_KEY,
//         "Content-Type": "application/json"
//       }
//     });

//     const assistantMessage = response.data.choices[0].message;
//     const toolCalls = assistantMessage.tool_calls;

// if (toolCalls?.length > 0) {
//   const scheduleCall = toolCalls.find((t: { function: { name: string; }; }) => t.function.name === "get_project_schedule");

//   if (scheduleCall) {
//     // const { projectNumber } = JSON.parse(scheduleCall.function.arguments);

//     const path = `${process.env.P6_API_URL}/p6-activites?baselineId=${projectNumber}`;
//     const scheduleResp = await axios.get(path, {
//       headers: {
//         accept: "application/json;odata=verbose",
//         "Content-Transfer-Encoding": "application/gzip",
//         Authorization: `Bearer ${token}`
//       }
//     });

//     const scheduleData = scheduleResp.data;

//     // Send tool response for project schedule
//     const scheduleToolMessage = {
//       role: "tool",
//       tool_call_id: scheduleCall.id,
//       content: JSON.stringify({ success: true }) // don't pass full data!
//     };

//     const secondResp = await axios.post(endpoint, {
//       messages: [...messages, assistantMessage, scheduleToolMessage],
//       tools,
//       tool_choice: "auto"
//     }, {
//       headers: {
//         "api-key": process.env.OPENAI_API_KEY,
//         "Content-Type": "application/json"
//       }
//     });

//     const secondMsg = secondResp.data.choices[0].message;
//     const secondToolCalls = secondMsg.tool_calls;
//     const filterCall = secondToolCalls?.find((t: { function: { name: string; }; }) => t.function.name === "filter_activity_data");

//     if (filterCall) {
//       const { field, operator, value } = JSON.parse(filterCall.function.arguments);
//       const fieldPath = field.split(".");
//       const filteredTasks = filterTaskTree(scheduleData.tasks, fieldPath, operator, value);

//       const filteredSubset = {
//         ...scheduleData,
//         tasks: {
//           ...scheduleData.tasks,
//           rows: filteredTasks
//         }
//       };

//       const filterToolMessage = {
//         role: "tool",
//         tool_call_id: filterCall.id,
//         content: JSON.stringify(filteredSubset)
//       };

//       const finalResp = await axios.post(endpoint, {
//         messages: [...messages, assistantMessage, scheduleToolMessage, secondMsg, filterToolMessage],
//         temperature: 0.7,
//         max_tokens: 1500
//       }, {
//         headers: {
//           "api-key": process.env.OPENAI_API_KEY,
//           "Content-Type": "application/json"
//         }
//       });

//       return res.json({ answer: finalResp.data.choices[0].message.content });
//     }

//     // fallback if no filter tool was called
//     return res.json({ answer: secondMsg.content });
//   }
// }

//     return res.json({ answer: assistantMessage.content });
//   } catch (err: any) {
//     console.error("❌ LLM Request failed:", err.response?.data || err.message);
//     res.status(500).json({ error: "LLM call failed" });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
