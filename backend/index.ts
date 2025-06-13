import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// 👇 Paste your /schedule route here:
app.post('/schedule', async (req, res) => {
  const userPrompt = req.body.prompt;
  const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'assistants=v1'
  };

  try {
    const thread = await axios.post("https://api.openai.com/v1/threads", {}, { headers });

    await axios.post(`https://api.openai.com/v1/threads/${thread.data.id}/messages`, {
      role: "user",
      content: userPrompt
    }, { headers });

    const run = await axios.post(`https://api.openai.com/v1/threads/${thread.data.id}/runs`, {
      assistant_id: process.env.ASSISTANT_ID
    }, { headers });

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

    res.json({ scheduleJson: content });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Assistant request failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
