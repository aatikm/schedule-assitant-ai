import './App.css';
import 'react-reflex/styles.css';

import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';

import ChatInput from './components/ChatInput';
import BryntumGanttComponent from './components/BryntumGantt';

function App() {
  return (
    <div className="App">
      <ReflexContainer orientation="vertical">
        <ReflexElement minSize={200} flex={0.3}>
          <div className="chat-pane">
            <ChatInput />
          </div>
        </ReflexElement>

        <ReflexSplitter />

        <ReflexElement minSize={400} flex={0.7}>
          <div className="gantt-pane">
            <BryntumGanttComponent />
          </div>
        </ReflexElement>
      </ReflexContainer>
    </div>
  );
}

export default App;
