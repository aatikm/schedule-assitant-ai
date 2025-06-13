import React, { useState } from 'react';
import { Box, TextField, IconButton, CircularProgress, Typography, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import axios from 'axios';
import { BryntumGantt } from '@bryntum/gantt-react';
type ChatInputProps = {
  messages: { type: 'user' | 'bot'; text: string }[];
  loading: boolean;
  userPrompt: string;
  handleSubmit: () => Promise<void>;
  setUserPrompt: React.Dispatch<React.SetStateAction<string>>;
};
const ChatInput = (props:ChatInputProps) => {
  const { messages,handleSubmit,userPrompt, loading, setUserPrompt } = props;

  
 

  

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Typography variant="h6" align="center" mb={2}>
        AI-Powered Construction Scheduler
      </Typography>

      {/* Chat area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          background: "#f5f5f5",
          padding: 2,
          borderRadius: 2,
          mb: 2,
          border: "1px solid #ccc",
        }}
      >
        {messages.map(
          (
            msg: {
              type: string;
              text:
                | string
                | number
                | bigint
                | boolean
                | React.ReactElement<
                    unknown,
                    string | React.JSXElementConstructor<any>
                  >
                | Iterable<React.ReactNode>
                | React.ReactPortal
                | Promise<
                    | string
                    | number
                    | bigint
                    | boolean
                    | React.ReactPortal
                    | React.ReactElement<
                        unknown,
                        string | React.JSXElementConstructor<any>
                      >
                    | Iterable<React.ReactNode>
                    | null
                    | undefined
                  >
                | null
                | undefined;
            },
            index: React.Key | null | undefined
          ) => (
            <Box
              key={index}
              sx={{
                display: "flex",
                justifyContent: msg.type === "user" ? "flex-end" : "flex-start",
                mb: 1,
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  maxWidth: "75%",
                  p: 1.5,
                  backgroundColor: msg.type === "user" ? "#1976d2" : "#e0e0e0",
                  color: msg.type === "user" ? "white" : "black",
                  borderRadius: 2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.text}
              </Paper>
            </Box>
          )
        )}
        {loading && (
          <Box display="flex" justifyContent="flex-start" pl={1}>
            <CircularProgress size={20} />
          </Box>
        )}
      </Box>

      {/* Input bar */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
        }}
      >
        <TextField
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          fullWidth
          multiline
          maxRows={4}
          placeholder="Type your construction request..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <IconButton onClick={handleSubmit} disabled={loading}>
          <SendIcon color="primary" />
        </IconButton>
      </Box>

      {/* Gantt chart */}
      {/* {scheduleData && (
        <Box sx={{ marginTop: 4, width: '100%', height: '600px' }}>
          <BryntumGantt
            project={{
              startDate: new Date().toISOString().split('T')[0],
              tasksData: scheduleData.tasksData
            }}
          />
        </Box>
      )} */}
    </Box>
  );
};

export default ChatInput;
