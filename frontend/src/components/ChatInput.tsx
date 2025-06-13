import React, { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, Paper } from '@mui/material';
import axios from 'axios';
import { BryntumGantt } from '@bryntum/gantt-react';
//import '@bryntum/gantt/gantt.stockholm.css';
 
 
const ChatInput: React.FC = () => {
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [response, setResponse] = useState<string>('');  // still keep string for display
  const [scheduleData, setScheduleData] = useState<any>(null); // this is parsed JSON for Bryntum
  const [loading, setLoading] = useState<boolean>(false);
 
  const handleSubmit = async () => {
    if (!userPrompt.trim()) return;
 
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/generate-schedule', { prompt: userPrompt });
      setResponse(JSON.stringify(res.data, null, 2)); // for displaying raw response
      setScheduleData(res.data); // actual parsed JSON for Bryntum
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error generating schedule');
      setScheduleData(null);
    }
    setLoading(false);
  };
 
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f4f6f8',
        padding: 2,
        flexDirection: 'column'
      }}
    >
      <Paper
        sx={{
          width: '100%',
          maxWidth: 600,
          padding: 3,
          borderRadius: 2,
          boxShadow: 3,
          backgroundColor: 'white',
        }}
      >
        <Typography variant="h5" gutterBottom align="center">
          Construction Schedule Chatbot
        </Typography>
 
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            fullWidth
            label="Describe your construction scheduling"
            variant="outlined"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            multiline
            rows={4}
            sx={{
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{
              alignSelf: 'flex-end',
              borderRadius: 2,
              paddingX: 3,
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0',
              },
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
          </Button>
        </Box>
 
        {response && (
          <Paper
            sx={{
              marginTop: 4,
              padding: 2,
              backgroundColor: '#f5f5f5',
              borderRadius: 2,
              boxShadow: 1,
            }}
          >
            <Typography variant="h6">GPT Generated Schedule:</Typography>
            <pre>{response}</pre>
          </Paper>
        )}
      </Paper>
 
      {scheduleData && (
        <Box sx={{ marginTop: 4, width: '100%', height: '600px', maxWidth: '1200px' }}>
          <BryntumGantt
            project={{
              startDate: new Date().toISOString().split('T')[0], // today's date
              tasksData: scheduleData.tasksData
            }}
          />
        </Box>
      )}
    </Box>
  );
};
 
export default ChatInput;