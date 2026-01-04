import { useState } from 'react'
import { X, Mail, Folder, Music, Home, Network } from 'lucide-react'
import { motion } from 'framer-motion'

const CalendarCanvas = ({ onBack }: { onBack: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="text-2xl text-stone-800 font-serif">Tomorrow</div>
        <button onClick={onBack} className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-colors">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="space-y-0 flex-1">
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
            <span className="text-xs text-stone-400 w-4 tabular-nums font-mono">{event.time}</span>
            <span className="text-stone-800 text-lg font-serif">{event.title}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <div className="text-xs text-stone-400 uppercase tracking-widest mb-4 font-mono">Open</div>
        <div className="flex gap-2 flex-wrap">
          {['12:30', '3:30', '6:00'].map((time, i) => (
            <div
              key={i}
              className="px-3 py-2 border border-stone-200 text-xs text-stone-500 cursor-pointer hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all duration-200 font-mono"
            >
              {time}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

const WeatherCanvas = ({ onBack }: { onBack: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col"
    >
      <div className="flex justify-end mb-4">
        <button onClick={onBack} className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-colors">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-1">
          <span className="text-8xl font-light text-stone-800 tracking-tight font-serif">68°</span>
        </div>
        <div className="text-xs text-stone-400 uppercase tracking-widest mb-16 font-mono">Clear</div>

        <div className="flex gap-8">
          {[
            { day: 'Tu', temp: '72°' },
            { day: 'We', temp: '68°' },
            { day: 'Th', temp: '65°' },
            { day: 'Fr', temp: '70°' },
          ].map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-xs text-stone-300 font-mono">{d.day}</span>
              <span className="text-stone-600 font-serif">{d.temp}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

const NotesCanvas = ({ onBack }: { onBack: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="text-2xl text-stone-800 font-serif">Notes</div>
        <button onClick={onBack} className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-colors">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="space-y-4">
        {[
          { title: 'Project ideas', preview: 'Agent architecture, MCP servers...' },
          { title: 'Reading list', preview: 'Designing Data-Intensive Apps...' },
          { title: 'Weekly goals', preview: 'Ship v1, review PRs...' },
        ].map((note, i) => (
          <div key={i} className="py-4 border-b border-stone-100 cursor-pointer hover:pl-2 transition-all">
            <div className="text-stone-800 mb-1 font-serif">{note.title}</div>
            <div className="text-xs text-stone-400 truncate font-mono">{note.preview}</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

const ConnectionsCanvas = ({ onBack }: { onBack: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="text-xs text-stone-400 uppercase tracking-widest font-mono">Connected</div>
        <button onClick={onBack} className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-stone-500 transition-colors">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      <div className="space-y-0">
        {[
          { name: 'Google', services: 'Calendar · Mail · Drive' },
          { name: 'Spotify', services: 'Playback · Library' },
          { name: 'Home', services: 'Lights · Climate' },
        ].map((integration, i) => (
          <div key={i} className="group py-5 border-b border-stone-100 cursor-pointer hover:pl-2 transition-all duration-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg text-stone-800 font-serif">{integration.name}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <div className="text-xs text-stone-400 font-mono">{integration.services}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 py-4 text-sm text-stone-400 cursor-pointer hover:text-stone-700 transition-colors font-serif">
        + Connect new service
      </div>
    </motion.div>
  )
}

const AppSelector = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [hoveredApp, setHoveredApp] = useState<string | null>(null)

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
    { id: 'email', icon: <Mail className="h-6 w-6" strokeWidth={1.5} />, label: 'Email' },
    { id: 'files', icon: <Folder className="h-6 w-6" strokeWidth={1.5} />, label: 'Files' },
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
    { id: 'music', icon: <Music className="h-6 w-6" strokeWidth={1.5} />, label: 'Music' },
    { id: 'home', icon: <Home className="h-6 w-6" strokeWidth={1.5} />, label: 'Home' },
    { id: 'connections', icon: <Network className="h-6 w-6" strokeWidth={1.5} />, label: 'Settings' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
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
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-stone-500 whitespace-nowrap z-10 font-mono">
                  {app.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppsCanvas() {
  const [canvas, setCanvas] = useState<string | null>(null)

  const handleBack = () => setCanvas(null)

  const renderCanvas = () => {
    if (!canvas) {
      return <AppSelector onSelect={setCanvas} />
    }

    switch (canvas) {
      case 'calendar': return <CalendarCanvas key="calendar" onBack={handleBack} />
      case 'weather': return <WeatherCanvas key="weather" onBack={handleBack} />
      case 'connections': return <ConnectionsCanvas key="connections" onBack={handleBack} />
      case 'notes': return <NotesCanvas key="notes" onBack={handleBack} />
      default: return <AppSelector onSelect={setCanvas} />
    }
  }

  return (
    <div className="bg-white border-l border-stone-100 p-8 pt-16 w-80 h-full shrink-0">
      {renderCanvas()}
    </div>
  )
}
