import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  AlertTriangle,
  Settings,
  Bell,
  X,
  Edit2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ClassSchedule, TodoItem } from './types';
import { playBeep, stopBeep } from './utils/audio';
import { LocalNotifications } from '@capacitor/local-notifications';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update the clock every second for the timer
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [schedules, setSchedules] = useState<ClassSchedule[]>(() => {
    try {
      const saved = localStorage.getItem('faculty_schedules');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('localStorage not accessible', e);
      return [];
    }
  });
  
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('faculty_todos');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('localStorage not accessible', e);
      return [];
    }
  });

  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSchedule | null>(null);
  const [todoInput, setTodoInput] = useState('');
  const [showAlert, setShowAlert] = useState<{msg: string} | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<'recurring' | 'specific'>('recurring');

  useEffect(() => {
    if (editingClass) {
      setSessionType(editingClass.date ? 'specific' : 'recurring');
    } else {
      setSessionType('recurring');
    }
  }, [editingClass, isAddingClass]);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('faculty_schedules', JSON.stringify(schedules));
    } catch (e) {
      console.warn('localStorage not accessible', e);
    }
    updateLocalNotifications(schedules);
  }, [schedules]);

  const updateLocalNotifications = async (currentSchedules: ClassSchedule[]) => {
    try {
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') {
        const p = await LocalNotifications.requestPermissions();
        if (p.display !== 'granted') return;
      }

      await LocalNotifications.createChannel({
        id: 'faculty_alerts_v2',
        name: 'Faculty Alerts',
        description: 'Reminders for upcoming classes',
        importance: 5, // 5 = MAX (Heads-up + Sound)
        visibility: 1, // 1 = PUBLIC
        sound: 'beep.wav',
      });

      await LocalNotifications.cancel({ notifications: (await LocalNotifications.getPending()).notifications });

      let notifId = 1;
      const notifsToSchedule = [];

      for (const schedule of currentSchedules) {
        const [h, m] = schedule.startTime.split(':').map(Number);
        
        if (schedule.date) {
          const [year, month, day] = schedule.date.split('-').map(Number);
          const classDate = new Date(year, month - 1, day, h, m, 0, 0);
          
          // Reminder 20 mins before
          const reminderDate20 = new Date(classDate.getTime() - 20 * 60000);
          if (reminderDate20 > new Date()) {
            notifsToSchedule.push({
              id: notifId++,
              title: 'Upcoming Session in 20m',
              body: `Class "${schedule.className}" in Room ${schedule.roomNumber} starts at ${schedule.startTime}`,
              schedule: { at: reminderDate20, allowWhileIdle: true },
              sound: 'beep.wav',
              channelId: 'faculty_alerts_v2'
            });
          }

          // Reminder 10 mins before
          const reminderDate10 = new Date(classDate.getTime() - 10 * 60000);
          if (reminderDate10 > new Date()) {
            notifsToSchedule.push({
              id: notifId++,
              title: 'Upcoming Session in 10m',
              body: `Class "${schedule.className}" in Room ${schedule.roomNumber} starts at ${schedule.startTime}`,
              schedule: { at: reminderDate10, allowWhileIdle: true },
              sound: 'beep.wav',
              channelId: 'faculty_alerts_v2'
            });
          }
        } else {
          // Recurring
          for (const day of schedule.days) {
            const weekday = DAY_NAMES.indexOf(day) + 1; // 1-7 for Capacitor (Sun=1...Sat=7) usually. 
            // Wait, JS getDay() is Sun=0...Sat=6. Capacitor weekday is Sun=1...Sat=7.
            // So weekday = DAY_NAMES.indexOf(day) + 1 is exactly correct for Capacitor plugin.
            
            // 20 mins before
            let notifHr20 = h;
            let notifMin20 = m - 20;
            let notifWeekday20 = weekday;
            if (notifMin20 < 0) {
              notifMin20 += 60;
              notifHr20 -= 1;
              if (notifHr20 < 0) {
                notifHr20 += 24;
                notifWeekday20 = notifWeekday20 - 1;
                if (notifWeekday20 < 1) notifWeekday20 = 7;
              }
            }

            notifsToSchedule.push({
              id: notifId++,
              title: 'Upcoming Session in 20m',
              body: `Class "${schedule.className}" in Room ${schedule.roomNumber} starts at ${schedule.startTime}`,
              schedule: { on: { weekday: notifWeekday20, hour: notifHr20, minute: notifMin20, second: 0 }, allowWhileIdle: true },
              sound: 'beep.wav',
              channelId: 'faculty_alerts_v2'
            });

            // 10 mins before
            let notifHr10 = h;
            let notifMin10 = m - 10;
            let notifWeekday10 = weekday;
            if (notifMin10 < 0) {
              notifMin10 += 60;
              notifHr10 -= 1;
              if (notifHr10 < 0) {
                notifHr10 += 24;
                notifWeekday10 = notifWeekday10 - 1;
                if (notifWeekday10 < 1) notifWeekday10 = 7;
              }
            }

            notifsToSchedule.push({
              id: notifId++,
              title: 'Upcoming Session in 10m',
              body: `Class "${schedule.className}" in Room ${schedule.roomNumber} starts at ${schedule.startTime}`,
              schedule: { on: { weekday: notifWeekday10, hour: notifHr10, minute: notifMin10, second: 0 }, allowWhileIdle: true },
              sound: 'beep.wav',
              channelId: 'faculty_alerts_v2'
            });
          }
        }
      }

      if (notifsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notifsToSchedule });
      }
    } catch (e) {
      console.warn('LocalNotifications not accessible', e);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('faculty_todos', JSON.stringify(todos));
    } catch (e) {
      console.warn('localStorage not accessible', e);
    }
  }, [todos]);

  // --- Alert Engine ---
  useEffect(() => {
    const currentDay = DAY_NAMES[currentTime.getDay()];
    const currentDateStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
    
    schedules.forEach(schedule => {
      let isToday = false;
      if (schedule.date) {
        if (schedule.date === currentDateStr) isToday = true;
      } else {
        if (schedule.days.includes(currentDay)) isToday = true;
      }
      
      if (!isToday) return;

      const [sHour, sMin] = schedule.startTime.split(':').map(Number);
      const scheduleTotalMins = sHour * 60 + sMin;
      const nowTotalMins = currentTime.getHours() * 60 + currentTime.getMinutes();
      const diff = scheduleTotalMins - nowTotalMins;

      // 20 min before: 10 sec beep + alert
      if (diff === 20 && currentTime.getSeconds() === 0) {
        playBeep(10);
        setShowAlert({ msg: `Class "${schedule.className}" in Room ${schedule.roomNumber} starts in 20 minutes!` });
      }

      // 10 min before: 30 sec beep
      if (diff === 10 && currentTime.getSeconds() === 0) {
        playBeep(30);
      }
    });
  }, [currentTime, schedules]);

  // --- Handlers ---
  const addOrUpdateClass = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const classes: ClassSchedule = {
      id: editingClass?.id || crypto.randomUUID(),
      className: formData.get('className') as string,
      roomNumber: formData.get('roomNumber') as string,
      startTime: formData.get('startTime') as string,
      days: sessionType === 'recurring' ? Array.from(formData.getAll('days')) as string[] : [],
      date: sessionType === 'specific' ? formData.get('date') as string : undefined,
    };

    if (editingClass) {
      setSchedules(prev => prev.map(s => s.id === editingClass.id ? classes : s));
      setEditingClass(null);
    } else {
      setSchedules(prev => [...prev, classes]);
      setIsAddingClass(false);
    }
  };

  const deleteClass = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoInput.trim()) return;
    const newTodo: TodoItem = {
      id: crypto.randomUUID(),
      text: todoInput.trim(),
      completed: false
    };
    setTodos(prev => [...prev, newTodo]);
    setTodoInput('');
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  // --- Derived State ---
  const currentDayStr = DAY_NAMES[currentTime.getDay()];
  const currentDateStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  
  const todaySchedules = useMemo(() => {
     return schedules.filter(s => {
       if (s.date) return s.date === currentDateStr;
       return s.days.includes(currentDayStr);
     }).map(s => {
        const [h, m] = s.startTime.split(':').map(Number);
        return { ...s, totalMins: h * 60 + m };
     }).sort((a, b) => a.totalMins - b.totalMins);
  }, [schedules, currentDayStr, currentDateStr]);

  const MathMax = Math.max;
  const nowTotalMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const remainingToday = todaySchedules.filter(s => s.totalMins > nowTotalMins).length;

  const nextClass = useMemo(() => {
    let target = null;
    if (selectedClassId) {
      target = schedules.find(s => s.id === selectedClassId) || null;
    }
    if (!target) {
      target = todaySchedules.find(s => s.totalMins > nowTotalMins) || null;
    }
    if (!target) return null;

    let bestDate: Date | null = null;
    const [h, m] = target.startTime.split(':').map(Number);
    let minDiffMs = Infinity;

    if (target.date) {
      const [year, month, day] = target.date.split('-').map(Number);
      const cand = new Date(year, month - 1, day, h, m, 0, 0);
      const diffMs = cand.getTime() - currentTime.getTime();
      if (diffMs > 0 && diffMs < minDiffMs) {
        minDiffMs = diffMs;
        bestDate = cand;
      }
    } else {
      target.days.forEach(day => {
        let diffDays = DAY_NAMES.indexOf(day) - currentTime.getDay();
        if (diffDays < 0) diffDays += 7;
        else if (diffDays === 0 && (h * 60 + m <= currentTime.getHours() * 60 + currentTime.getMinutes())) {
          diffDays += 7;
        }
        const cand = new Date(currentTime);
        cand.setDate(cand.getDate() + diffDays);
        cand.setHours(h, m, 0, 0);
        const diffMs = cand.getTime() - currentTime.getTime();
        if (diffMs < minDiffMs) {
          minDiffMs = diffMs;
          bestDate = cand;
        }
      });
    }

    if (!bestDate) return null;
    const diffSecs = Math.floor((bestDate.getTime() - currentTime.getTime()) / 1000);
    return { ...target, diffSecs, targetDate: bestDate };
  }, [schedules, selectedClassId, currentTime, todaySchedules, nowTotalMins]);

  const dateString = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'todo'>('home');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans flex flex-col relative max-w-md mx-auto shadow-2xl overflow-hidden bg-white sm:border-x sm:border-slate-200">
      {isOffline && (
        <div className="bg-amber-100 text-amber-800 text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2 z-50">
          <AlertTriangle size={14} /> You are exploring in offline mode
        </div>
      )}
      {/* Header Section */}
      <header className="px-6 pt-10 pb-4 bg-white z-10 shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Faculty Flow</h1>
        <p className="text-slate-500 font-medium text-sm mt-1">{dateString}</p>
        <div className="absolute top-10 right-6 flex items-center gap-3">
           <button onClick={() => playBeep(2)} className="text-slate-400 hover:text-indigo-600">
             <Bell size={20} strokeWidth={2.5} />
           </button>
        </div>
      </header>

      {/* Main Scrollable Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-5 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pt-4"
            >
              {/* Timer Card */}
              <div className="bg-slate-900 rounded-[2rem] p-6 shadow-xl relative overflow-hidden flex flex-col items-center">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/30 blur-[40px] rounded-full"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/30 blur-[40px] rounded-full"></div>
                
                <span className="px-3 py-1 bg-white/10 text-white rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10 mb-6 z-10 flex items-center gap-2">
                  {nextClass ? (selectedClassId ? 'Focused Session' : 'Next Session') : 'No Sessions Left'}
                  {selectedClassId && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedClassId(null); }} className="hover:text-indigo-200">
                      <X size={12} />
                    </button>
                  )}
                </span>

                <div className="relative w-48 h-48 flex flex-col items-center justify-center z-10">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="transparent" />
                    <circle 
                      cx="50%" cy="50%" r="45%" 
                      stroke="currentColor" strokeWidth="12" fill="transparent" 
                      className={`transition-all duration-1000 ease-linear ${!nextClass ? 'text-slate-500' : 'text-indigo-400'}`}
                      strokeDasharray="690" 
                      strokeDashoffset={nextClass ? 690 * (1 - MathMax(0, Math.min(1, nextClass.diffSecs / 3600))) : 690}
                      strokeLinecap="round"
                    />
                  </svg>
                  {nextClass ? (
                    <>
                      <span className="font-black text-white tabular-nums tracking-tighter" style={{ fontSize: nextClass.diffSecs >= 3600 ? '2rem' : '2.5rem' }}>
                        {(() => {
                          const diffSecs = nextClass.diffSecs;
                          if (diffSecs <= 0) return "00:00";
                          const h = Math.floor(diffSecs / 3600);
                          const m = Math.floor((diffSecs % 3600) / 60);
                          const s = diffSecs % 60;
                          if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                          return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                        })()}
                      </span>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Countdown</span>
                    </>
                  ) : (
                    <span className="text-3xl font-black text-white/30">--:--</span>
                  )}
                </div>

                {nextClass && (
                  <div className="mt-8 text-center z-10">
                    <h2 className="text-xl font-bold text-white leading-tight">{nextClass.className}</h2>
                    <p className="text-indigo-300 font-medium mt-1">
                      Room {nextClass.roomNumber} • {nextClass.targetDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric'})} at {nextClass.startTime}
                    </p>
                  </div>
                )}
              </div>

              {/* Date Section */}
              <div className="bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Today</p>
                   <p className="text-xl font-black text-slate-800 tracking-tight">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})}</p>
                </div>
                <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner shrink-0">
                  {currentTime.getDate()}
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-[1.5rem] p-5 border border-indigo-100/50 flex flex-col justify-between">
                  <Calendar className="text-indigo-600 mb-3" size={24} />
                  <p className="text-3xl font-black text-slate-800">{remainingToday}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Left Today</p>
                </div>
                <div className="bg-emerald-50 rounded-[1.5rem] p-5 border border-emerald-100/50 flex flex-col justify-between" onClick={() => setActiveTab('todo')}>
                  <CheckCircle2 className="text-emerald-600 mb-3" size={24} />
                  <p className="text-3xl font-black text-slate-800">{todos.filter(t => !t.completed).length}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Open Tasks</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div 
              key="schedule"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 pt-2 pb-20"
            >
              <div className="flex justify-between items-center mb-2 px-1">
                 <h2 className="text-lg font-bold text-slate-800">Your Sessions</h2>
                 <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">{schedules.length} Total</span>
              </div>
              
              {schedules.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No sessions scheduled.</p>
                </div>
              ) : (
                schedules.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((s) => (
                  <div key={s.id} onClick={() => { setSelectedClassId(s.id); setActiveTab('home'); }} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
                    <div className="absolute top-0 right-0 p-4 flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditingClass(s); }} className="text-slate-400 hover:text-indigo-600 bg-slate-50 p-2 rounded-xl">
                        <Edit2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                    
                    <span className="text-indigo-600 font-black text-lg mb-1">{s.startTime}</span>
                    <h3 className="font-bold text-slate-800 text-lg mb-2 pr-12">{s.className}</h3>
                    <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mb-4">
                      <MapPin size={14} className="shrink-0 text-slate-400" /> Room {s.roomNumber}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <span key={day} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                          s.days.includes(day) ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {day[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'todo' && (
            <motion.div 
              key="todo"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 pt-2"
            >
              <form onSubmit={addTodo} className="flex gap-2 mb-6">
                <input 
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  placeholder="New task..."
                  className="flex-1 bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
                />
                <button 
                  type="submit" 
                  disabled={!todoInput.trim()} 
                  className="bg-slate-900 text-white w-14 rounded-2xl flex items-center justify-center shadow-lg disabled:opacity-50"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              </form>

              <div className="space-y-3">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm group">
                    <button onClick={() => toggleTodo(todo.id)} className="w-6 h-6 flex-shrink-0">
                      {todo.completed ? (
                        <div className="w-full h-full bg-emerald-500 rounded-lg flex items-center justify-center">
                          <Check size={14} className="text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-full h-full border-2 border-slate-300 rounded-lg"></div>
                      )}
                    </button>
                    <span className={`text-sm font-semibold flex-1 transition-all ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {todo.text}
                    </span>
                    <button onClick={() => deleteTodo(todo.id)} className="text-slate-300 hover:text-red-500 p-2 -mr-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button (Only on Schedule Tab) */}
      <AnimatePresence>
        {activeTab === 'schedule' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => setIsAddingClass(true)}
            className="absolute bottom-24 right-5 w-14 h-14 bg-indigo-600 text-white rounded-[1.2rem] shadow-xl shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-20"
          >
            <Plus size={24} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 pb-8 sm:pb-4 flex justify-between items-center z-30">
         <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400'}`}>
           <Clock size={24} />
           <span className="text-[10px] font-bold">Home</span>
         </button>
         <button onClick={() => setActiveTab('schedule')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'schedule' ? 'text-indigo-600' : 'text-slate-400'}`}>
           <Calendar size={24} />
           <span className="text-[10px] font-bold">Schedule</span>
         </button>
         <button onClick={() => setActiveTab('todo')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'todo' ? 'text-indigo-600' : 'text-slate-400'}`}>
           <CheckCircle2 size={24} />
           <span className="text-[10px] font-bold">Tasks</span>
         </button>
      </nav>

      {/* Modals & Overlays */}
      {/* Class Modal */}
      <AnimatePresence>
        {(isAddingClass || editingClass) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pt-8 shadow-2xl relative overflow-y-auto max-h-[90vh]"
            >
              {/* iOS style drag handle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden"></div>

              <button 
                onClick={() => { setIsAddingClass(false); setEditingClass(null); }}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
              
              <h3 className="text-2xl font-black mb-6 text-slate-900 pr-10 leading-tight">
                {editingClass ? 'Edit Session' : 'New Session'}
              </h3>

              <form onSubmit={addOrUpdateClass} className="space-y-4 relative z-10 pb-8 sm:pb-0">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Session Title</label>
                  <input 
                    name="className"
                    required
                    defaultValue={editingClass?.className}
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all font-semibold text-slate-900 text-lg"
                    placeholder="e.g. Adv. Calculus"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Room / Loc</label>
                    <input 
                      name="roomNumber"
                      required
                      defaultValue={editingClass?.roomNumber}
                      className="w-full border-2 border-slate-200 bg-slate-50 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all font-semibold text-slate-900 text-lg"
                      placeholder="e.g. 402-B"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                    <input 
                      name="startTime"
                      type="time"
                      required
                      defaultValue={editingClass?.startTime}
                      className="w-full border-2 border-slate-200 bg-slate-50 rounded-2xl px-4 py-3.5 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all font-semibold text-slate-900 text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setSessionType('recurring')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${sessionType === 'recurring' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Recurring
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSessionType('specific')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${sessionType === 'specific' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Specific Date
                    </button>
                  </div>
                </div>

                {sessionType === 'recurring' ? (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 block">Recurrence</label>
                    <div className="flex flex-wrap gap-2 w-full justify-between">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <label key={day} className="flex items-center flex-1 min-w-[30%]">
                          <input 
                            type="checkbox" 
                            name="days" 
                            value={day} 
                            className="hidden peer"
                            defaultChecked={editingClass?.days?.includes(day)}
                          />
                          <span className="w-full h-11 flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white cursor-pointer transition-all text-sm font-bold shadow-sm peer-checked:shadow-indigo-200">
                            {day}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 block">Date</label>
                    <input 
                      name="date"
                      type="date"
                      required={sessionType === 'specific'}
                      defaultValue={editingClass?.date}
                      className="w-full border-2 border-slate-200 bg-slate-50 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all font-semibold text-slate-900 text-lg"
                    />
                  </div>
                )}

                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20 text-lg flex justify-center items-center gap-2"
                  >
                    {editingClass ? 'Update Session' : 'Save Session'}
                  </button>
                </div>
              </form>

              {/* Delete inside edit modal */}
              {editingClass && (
                <button 
                  type="button"
                  onClick={() => {
                    deleteClass(editingClass.id);
                    setEditingClass(null);
                  }}
                  className="w-full mt-2 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors text-sm flex justify-center items-center gap-2"
                >
                  <Trash2 size={16} /> Delete this session completely
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pop-up Alert */}
      <AnimatePresence>
        {showAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-400 to-orange-400"></div>
              
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 mt-2 relative">
                <div className="absolute inset-0 rounded-full border-4 border-rose-500 animate-ping opacity-20"></div>
                <AlertTriangle size={40} strokeWidth={2.5} />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Session Alert!</h2>
              <p className="text-slate-600 mb-8 font-medium text-base leading-snug">{showAlert.msg}</p>
              
              <button 
                onClick={() => { setShowAlert(null); stopBeep(); }}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-rose-500 transition-all flex items-center justify-center gap-2 text-base active:scale-95"
              >
                Acknowledge Alert
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
