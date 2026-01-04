import React, { useState, useEffect } from 'react';

const CalendarCanvas = ({ onBack, expanded }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);
  
  return (
    <div className={`h-full flex flex-col transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="text-2xl text-stone-800" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Tomorrow</div>
        <div 
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center cursor-pointer text-stone-300 hover:text-stone-500 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </div>
      </div>
      <div className={`space-y-0 flex-1 ${expanded ? 'grid grid-cols-2 gap-8' : ''}`}>
        {[
          { time: '9', title: 'Morning focus', subtle: true },
          { time: '11', title: 'Call with Sarah', subtle: false },
          { time: '2', title: 'Design review', subtle: false },
          { time: '5', title: 'Gym', subtle: true },
        ].map((event, i) => (
          <div 
            key={i} 
            className={`group flex items-baseline gap-6 py-5 cursor-pointer border-b border-stone-100 transition-all duration-300 hover:pl-2 ${event.subtle ? 'opacity-35' : ''}`}
          >
            <span className="text-xs text-stone-400 w-4 tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>{event.time}</span>
            <span className="text-stone-800 text-lg" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{event.title}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <div className="text-xs text-stone-400 uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace" }}>Open</div>
        <div className="flex gap-2 flex-wrap">
          {['12:30', '3:30', '6:00'].map((time, i) => (
            <div 
              key={i} 
              className="px-3 py-2 border border-stone-200 text-sm text-stone-500 cursor-pointer hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all duration-200"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem' }}
            >
              {time}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WeatherCanvas = ({ onBack }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);
  
  return (
    <div className={`h-full flex flex-col transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-end mb-4">
        <div 
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center cursor-pointer text-stone-300 hover:text-stone-500 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-1">
          <span className="text-8xl font-light text-stone-800 tracking-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>68°</span>
        </div>
        <div className="text-xs text-stone-400 uppercase tracking-widest mb-16" style={{ fontFamily: "'DM Mono', monospace" }}>Clear</div>
        
        <div className="flex gap-8">
          {[
            { day: 'Tu', temp: '72°' },
            { day: 'We', temp: '68°' },
            { day: 'Th', temp: '65°' },
            { day: 'Fr', temp: '70°' },
          ].map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-xs text-stone-300" style={{ fontFamily: "'DM Mono', monospace" }}>{d.day}</span>
              <span className="text-stone-600" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{d.temp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ConnectionsCanvas = ({ onBack }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);
  
  return (
    <div className={`h-full flex flex-col transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="text-xs text-stone-400 uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace" }}>Connected</div>
        <div 
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center cursor-pointer text-stone-300 hover:text-stone-500 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </div>
      </div>
      <div className="space-y-0">
        {[
          { name: 'Google', services: 'Calendar · Mail · Drive' },
          { name: 'Spotify', services: 'Playback · Library' },
          { name: 'Home', services: 'Lights · Climate' },
        ].map((integration, i) => (
          <div 
            key={i} 
            className="group py-5 border-b border-stone-100 cursor-pointer hover:pl-2 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg text-stone-800" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{integration.name}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <div className="text-xs text-stone-400" style={{ fontFamily: "'DM Mono', monospace" }}>
              {integration.services}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 py-4 text-sm text-stone-400 cursor-pointer hover:text-stone-700 transition-colors" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        + Connect new service
      </div>
    </div>
  );
};

const NotesCanvas = ({ onBack }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);
  
  return (
    <div className={`h-full flex flex-col transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="text-2xl text-stone-800" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Notes</div>
        <div 
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center cursor-pointer text-stone-300 hover:text-stone-500 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </div>
      </div>
      <div className="space-y-4">
        {[
          { title: 'Project ideas', preview: 'Agent architecture, MCP servers...' },
          { title: 'Reading list', preview: 'Designing Data-Intensive Apps...' },
          { title: 'Weekly goals', preview: 'Ship v1, review PRs...' },
        ].map((note, i) => (
          <div key={i} className="py-4 border-b border-stone-100 cursor-pointer hover:pl-2 transition-all">
            <div className="text-stone-800 mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{note.title}</div>
            <div className="text-xs text-stone-400 truncate" style={{ fontFamily: "'DM Mono', monospace" }}>{note.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ToolCall = ({ tool }) => {
  const isComplete = tool.result !== undefined;
  
  return (
    <div className="py-1 flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isComplete ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
      <span className="text-sm text-stone-400" style={{ fontFamily: "'DM Mono', monospace" }}>
        {tool.name}
      </span>
      <span className="text-sm text-stone-300">›</span>
      <span className="text-sm text-stone-500" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        {tool.input}
      </span>
    </div>
  );
};

const ToolLog = ({ tools }) => {
  if (!tools || tools.length === 0) return null;
  
  return (
    <div>
      {tools.map((tool, i) => (
        <ToolCall key={i} tool={tool} />
      ))}
    </div>
  );
};

const AppSelector = ({ onSelect, expanded }) => {
  const [hoveredApp, setHoveredApp] = useState(null);
  
  const apps = [
    { id: 'calendar', icon: (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(9)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-current" />)}
      </div>
    ), label: 'Calendar' },
    { id: 'weather', icon: (
      <div className="w-7 h-7 rounded-full border-2 border-current" />
    ), label: 'Weather' },
    { id: 'notes', icon: (
      <div className="space-y-1.5">
        <div className="w-6 h-0.5 bg-current rounded" />
        <div className="w-4 h-0.5 bg-current rounded" />
        <div className="w-5 h-0.5 bg-current rounded" />
      </div>
    ), label: 'Notes' },
    { id: 'email', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ), label: 'Email' },
    { id: 'files', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ), label: 'Files' },
    { id: 'tasks', icon: (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 border border-current rounded-sm" />
          <div className="w-4 h-0.5 bg-current rounded" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 border border-current rounded-sm" />
          <div className="w-3 h-0.5 bg-current rounded" />
        </div>
      </div>
    ), label: 'Tasks' },
    { id: 'music', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="18" r="3" />
        <circle cx="18" cy="15" r="3" />
        <path d="M18 15V4l-10 3v11" />
      </svg>
    ), label: 'Music' },
    { id: 'home', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" />
      </svg>
    ), label: 'Home' },
    { id: 'connections', icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
        <path d="M12 7v4M10 12l-4 5M14 12l4 5" />
      </svg>
    ), label: 'Settings' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className={`grid gap-2 ${expanded ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {apps.map((app) => (
            <div
              key={app.id}
              onClick={() => onSelect(app.id)}
              onMouseEnter={() => setHoveredApp(app.id)}
              onMouseLeave={() => setHoveredApp(null)}
              className="relative aspect-square flex items-center justify-center cursor-pointer rounded-xl hover:bg-stone-100 transition-all duration-200 text-stone-400 hover:text-stone-700"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                {app.icon}
              </div>
              
              {hoveredApp === app.id && (
                <div 
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-stone-500 whitespace-nowrap z-10"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {app.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function AssistantUI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [canvas, setCanvas] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const getResponseData = (query) => {
    const q = query.toLowerCase();
    
    if (q.includes('weather')) {
      return {
        content: "Clear all week. Wednesday might turn.",
        canvas: 'weather',
        tools: [{ 
          name: 'weather',
          input: '7 day forecast',
          result: 'Clear through Tuesday, clouds Wednesday, clearing Thursday'
        }]
      };
    } else if (q.includes('connect') || q.includes('integration') || q.includes('settings')) {
      return { content: "Your current setup.", canvas: 'connections', tools: [] };
    } else if (q.includes('calendar') || q.includes('schedule') || q.includes('tomorrow') || q.includes('week') || q.includes('busy')) {
      return {
        content: "Here's how it looks.",
        canvas: 'calendar',
        tools: [{ 
          name: 'calendar',
          input: 'tomorrow',
          result: ['9:00 — Morning focus', '11:00 — Call with Sarah', '2:00 — Design review', '5:00 — Gym']
        }]
      };
    } else if (q.includes('note')) {
      return { content: "Your notes.", canvas: 'notes', tools: [] };
    } else if (q.includes('email') || q.includes('mail')) {
      return {
        content: "You have 3 unread. One from Sarah about the design review.",
        canvas: null,
        tools: [
          { name: 'email', input: 'unread messages', result: ['Sarah — Design review prep', 'GitHub — PR merged', 'Stripe — Weekly summary'] }, 
          { name: 'search', input: 'priority:high', result: "Sarah's email flagged as time-sensitive" }
        ]
      };
    } else if (q.includes('research') || q.includes('find') || q.includes('search')) {
      return {
        content: "Let me look into that.",
        canvas: null,
        tools: [{ name: 'web_search', input: q, result: 'Found 4 relevant sources' }]
      };
    } else {
      return { content: "Got it.", canvas: null, tools: [] };
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const query = input;
    const newMessages = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setIsThinking(true);
    setInput('');
    
    const responseData = getResponseData(query);
    
    if (responseData.tools.length === 0) {
      // No tools, just respond
      setTimeout(() => {
        setMessages([...newMessages, { role: 'assistant', content: responseData.content, tools: [] }]);
        setCanvas(responseData.canvas);
        setIsThinking(false);
      }, 400);
      return;
    }

    // Simulate streaming tool calls
    const toolsWithoutResults = responseData.tools.map(t => ({ name: t.name, input: t.input }));
    
    // Step 1: Show first tool call (no result yet)
    setTimeout(() => {
      setIsThinking(false);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: '', 
        tools: [toolsWithoutResults[0]]
      }]);
    }, 300);

    // Step 2+: Add results, then next tool calls
    let delay = 800;
    responseData.tools.forEach((tool, i) => {
      // Add result for current tool
      setTimeout(() => {
        const toolsUpToNow = responseData.tools.slice(0, i + 1);
        const hasMoreTools = i < responseData.tools.length - 1;
        
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: '', 
          tools: hasMoreTools 
            ? [...toolsUpToNow, { name: responseData.tools[i + 1].name, input: responseData.tools[i + 1].input }]
            : toolsUpToNow
        }]);
      }, delay);
      delay += 600;
    });

    // Final step: Add assistant text
    setTimeout(() => {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: responseData.content, 
        tools: responseData.tools
      }]);
      setCanvas(responseData.canvas);
    }, delay);
  };

  const handleManualSelect = (appId) => {
    setCanvas(appId);
  };

  const handleBack = () => {
    setCanvas(null);
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const renderCanvas = () => {
    if (!canvas) {
      return <AppSelector onSelect={handleManualSelect} expanded={expanded} />;
    }
    
    switch (canvas) {
      case 'calendar': return <CalendarCanvas key="calendar" onBack={handleBack} expanded={expanded} />;
      case 'weather': return <WeatherCanvas key="weather" onBack={handleBack} />;
      case 'connections': return <ConnectionsCanvas key="connections" onBack={handleBack} />;
      case 'notes': return <NotesCanvas key="notes" onBack={handleBack} />;
      default: return <AppSelector onSelect={handleManualSelect} expanded={expanded} />;
    }
  };

  return (
    <div className="h-screen w-full bg-neutral-50 flex">
      
      {/* Conversation */}
      <div className={`flex flex-col transition-all duration-500 ${expanded ? 'w-80' : 'flex-1'}`}>
        {/* Messages */}
        <div className="flex-1 overflow-auto px-8 pt-16 pb-8">
          {messages.length === 0 ? (
            <div className="h-full flex items-center">
              <div className="text-stone-300 text-2xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                What do you need?
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'assistant' && msg.tools && msg.tools.length > 0 && <ToolLog tools={msg.tools} />}
                  {msg.content && (
                    <div 
                      className={`${msg.role === 'user' ? 'text-stone-500' : 'text-stone-800'} ${msg.tools && msg.tools.length > 0 ? 'mt-3' : ''}`}
                      style={{ 
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: msg.role === 'user' ? '1rem' : '1.25rem',
                        lineHeight: '1.7',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" />
                  <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="px-8 pb-10">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything"
            className="w-full bg-transparent border-b border-stone-200 py-3 text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors text-lg"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          />
        </div>
      </div>
      
      {/* Canvas */}
      <div className={`bg-white border-l border-stone-100 p-8 pt-16 transition-all duration-500 ${expanded ? 'flex-1' : 'w-80'}`}>
        {/* Expand/collapse button */}
        <div className="flex justify-end mb-6">
          <div 
            onClick={toggleExpand}
            className="w-6 h-6 flex items-center justify-center cursor-pointer text-stone-300 hover:text-stone-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              {expanded ? (
                <>
                  <path d="M9 1v4h4M5 13v-4H1M9 5L13 1M5 9L1 13" />
                </>
              ) : (
                <>
                  <path d="M13 5V1h-4M1 9v4h4M13 1L9 5M1 13l4-4" />
                </>
              )}
            </svg>
          </div>
        </div>
        {renderCanvas()}
      </div>
    </div>
  );
}