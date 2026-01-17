import React, { useState, useEffect } from 'react';
import { WelcomePage } from './components/WelcomePage';
import { MLPipeline } from './components/MLPipeline';

function App() {
  const [currentView, setCurrentView] = useState<'welcome' | 'pipeline'>('welcome');
  const [sessionData, setSessionData] = useState<any>(null);

  // Restore session on page refresh
  useEffect(() => {
    const savedView = localStorage.getItem('GroveML-current-view');
    const savedSession = localStorage.getItem('GroveML-session-data');
    
    if (savedView === 'pipeline' && savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setCurrentView('pipeline');
        setSessionData(parsedSession);
      } catch (error) {
        console.error('Error parsing saved session:', error);
        // Clear corrupted data
        localStorage.removeItem('GroveML-current-view');
        localStorage.removeItem('GroveML-session-data');
      }
    }
  }, []);

  const handleGetStarted = () => {
    setCurrentView('pipeline');
    localStorage.setItem('GroveML-current-view', 'pipeline');
  };

  const handleBack = () => {
    setCurrentView('welcome');
    localStorage.removeItem('GroveML-current-view');
    localStorage.removeItem('GroveML-session-data');
    setSessionData(null);
  };

  const handleSessionUpdate = (data: any) => {
    setSessionData(data);
    if (data && Object.keys(data).length > 0) {
      localStorage.setItem('GroveML-session-data', JSON.stringify(data));
    }
  };

  return (
    <div className="min-h-screen">
      {currentView === 'welcome' ? (
        <WelcomePage onGetStarted={handleGetStarted} />
      ) : (
        <MLPipeline 
          onBack={handleBack} 
          initialSessionData={sessionData}
          onSessionUpdate={handleSessionUpdate}
        />
      )}
    </div>
  );
}

export default App;