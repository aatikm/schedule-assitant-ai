import './App.css';
import 'react-reflex/styles.css';

import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';

import ChatInput from './components/ChatInput';
import BryntumGanttComponent from './components/BryntumGantt';
import { useState } from 'react';
import axios from 'axios';


function App() {
   const [messages, setMessages] = useState<{ type: 'user' | 'bot'; text: string }[]>([]);
    const [scheduleData, setScheduleData] = useState<any>(null);
     const [loading, setLoading] = useState(false);
       const [userPrompt, setUserPrompt] = useState('');
    const handleSubmit = async () => {
    if (!userPrompt.trim()) return;

    const prompt = userPrompt.trim();
    setMessages([...messages, { type: 'user', text: prompt }]);
    setUserPrompt('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/schedule', { prompt });
      const botMessage = JSON.stringify(res.data, null, 2);
      setMessages((prev: any) => [...prev, { type: 'bot', text: botMessage }]);
     
      const match = res.data.scheduleJson.match(/```json\n([\s\S]*?)```/);
if (match) {
  try {
    const parsed = JSON.parse(match[1]);
 setScheduleData(parsed);
    console.log(parsed); // Use this for Bryntum Gantt etc.
  } catch (err) {
    console.error('Invalid JSON:', err);
  }
} else {
  console.error('No JSON block found');
}
    } catch (err) {
      setMessages(prev => [...prev, { type: 'bot', text: 'Error generating schedule.' }]);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="App">
      <ReflexContainer orientation="vertical">
        <ReflexElement minSize={200} flex={0.3}>
          <div className="chat-pane" style={{ overflow: "hidden" }}>
            <ChatInput
              messages={messages}
              loading={loading}
              userPrompt={userPrompt}
              handleSubmit={handleSubmit}
              setUserPrompt={setUserPrompt}
            />
          </div>
        </ReflexElement>

        <ReflexSplitter />

        <ReflexElement minSize={400} flex={0.7}>
          <div className="gantt-pane">
            <BryntumGanttComponent scheduleData={scheduleData} />
          </div>
        </ReflexElement>
      </ReflexContainer>
    </div>
  );
}

export default App;
