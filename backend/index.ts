import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// In-memory store for schedule JSON
let currentScheduleJson: string | null = null;

// Simple JSON validity check
const isValidJson = (text: string) => {
  try {
    const parsed = JSON.parse(text);
    // Basic check for required Bryntum fields
    return parsed && parsed.tasks && parsed.tasks.rows;
  } catch {
    return false;
  }
};

app.post('/schedule', async (req, res) => {
  const userPrompt = req.body.prompt;
  const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'assistants=v2'
  };

  try {
    // Include current schedule in prompt if available
    const effectivePrompt = currentScheduleJson
      ? `This is the current schedule JSON:\n${currentScheduleJson}\n\nNow, based on this schedule, ${userPrompt}`
      : userPrompt;

    const thread = await axios.post("https://api.openai.com/v1/threads", {}, { headers });

    await axios.post(
      `https://api.openai.com/v1/threads/${thread.data.id}/messages`,
      { role: "user", content: effectivePrompt },
      { headers }
    );

    const run = await axios.post(
      `https://api.openai.com/v1/threads/${thread.data.id}/runs`,
      { assistant_id: process.env.ASSISTANT_ID },
      { headers }
    );

    let status = "queued";
    while (["queued", "in_progress"].includes(status)) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const runStatus = await axios.get(
        `https://api.openai.com/v1/threads/${thread.data.id}/runs/${run.data.id}`,
        { headers }
      );
      status = runStatus.data.status;
    }

    const messages = await axios.get(
      `https://api.openai.com/v1/threads/${thread.data.id}/messages`,
      { headers }
    );

    const content = messages.data.data[0].content[0].text.value;

    // Try to extract JSON block from response if it's embedded
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
  res.json({ message: "Schedule reset" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
