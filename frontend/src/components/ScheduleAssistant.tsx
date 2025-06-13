// src/components/ScheduleAssistant.tsx
import React, { useState } from 'react';
import axios from 'axios';
 
const ScheduleAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
 
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/schedule', { prompt });
      setResponse(res.data.scheduleJson);
      console.log()
    } catch (err) {
      console.error('Error calling schedule API', err);
      alert('Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };
 
  return (
<div className="p-4">
<h2 className="text-lg font-semibold mb-2">Schedule Assistant</h2>
<textarea
        className="w-full border rounded p-2 mb-2"
        rows={4}
        placeholder="Type your schedule prompt here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
<button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleSubmit}
        disabled={loading}
>
        {loading ? 'Generating...' : 'Generate Schedule'}
</button>
 
      {response && (
<div className="mt-4 p-3 border rounded bg-gray-50 whitespace-pre-wrap text-sm">
<strong>Response:</strong>
<pre>{response}</pre>
</div>
      )}
</div>
  );
};
 
export default ScheduleAssistant;