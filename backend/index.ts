import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
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

app.post('/schedule', async (req, res) => {
  const userPrompt = req.body.prompt;
  const headers = {
    'api-key': process.env.OPENAI_API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    const effectivePrompt = currentScheduleJson
      ? `This is the current schedule JSON:\n${currentScheduleJson}\n\nNow, based on this schedule, ${userPrompt}`
      : userPrompt;

    const endpoint = `https://sivac-m74yevap-eastus2.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;

    const requestBody = {
      messages: [
        { role: "system", content: "You are a helpful assistant for scheduling." },
        { role: "user", content: effectivePrompt }
      ],
      max_tokens: 1024,
      temperature: 0.7
    };

    const response = await axios.post(endpoint, requestBody, { headers });
    const content = response.data.choices[0].message.content;

    // Extract JSON block
    const match = content.match(/```json\n([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
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

app.post('/reset-schedule', (req, res) => {
  currentScheduleJson = null;
  currentThreadId = null; // RESET thread as well
  res.json({ message: "Schedule reset" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
 
