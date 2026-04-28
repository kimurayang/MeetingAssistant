import React, { useState, useEffect } from 'react'

interface ActionItem {
  id: string
  meetingId: string
  meetingTitle: string
  date: string
  content: string
  status: 'pending' | 'completed'
  priority: 'high' | 'medium' | 'low'
  meeting?: { title: string, date: string }
}

export function ActionDashboard({ onNavigateToMeeting, theme = 'dark' }: { onNavigateToMeeting: (id: string) => void, theme?: 'dark' | 'white' }) {
  const [actions, setActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadActions()
  }, [])

  const loadActions = async () => {
    setLoading(true)
    try {
      // @ts-ignore
      const data = await window.electron.ipcRenderer.invoke('get-all-action-items')
      setActions(data)
    } catch (err) {
      console.error('Failed to load actions:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('toggle-action-status', { actionId: id, status: newStatus })
    if (res.success) {
      setActions(actions.map(a => a.id === id ? { ...a, status: newStatus as any } : a))
    }
  }

  const updatePriority = async (id: string, priority: string) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('update-action-priority', { actionId: id, priority })
    if (res.success) {
      setActions(actions.map(a => a.id === id ? { ...a, priority: priority as any } : a))
    }
  }

  const deleteItem = async (id: string) => {
    if (!window.confirm('確定要刪除此項待辦事項嗎？')) return
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('delete-action-item', id)
    if (res.success) {
      setActions(actions.filter(a => a.id !== id))
    }
  }

  const filteredActions = actions.filter(a => 
    a.content.toLowerCase().includes(filter.toLowerCase()) || 
    (a.meeting?.title || '').toLowerCase().includes(filter.toLowerCase())
  )

  const priorityColors = {
    high: 'bg-rose-50 text-rose-600 border-rose-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    low: 'bg-slate-50 text-slate-500 border-slate-100'
  }

  const darkPriorityColors = {
    high: 'bg-rose-900/30 text-rose-400 border-rose-800/30',
    medium: 'bg-amber-900/30 text-amber-400 border-amber-800/30',
    low: 'bg-slate-800/30 text-slate-400 border-slate-700/30'
  }

  if (loading) return <div className={`p-20 text-center font-black animate-pulse italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>正在彙整全案待辦事項...</div>

  return (
    <div className={`h-full flex flex-col space-y-6 animate-in fade-in duration-500 pb-10 transition-colors ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
      {/* 標題與搜尋 */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end p-8 rounded-3xl shadow-sm border gap-4 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="space-y-1">
          <h2 className={`text-3xl font-black tracking-tight flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <span className="mr-3">🎯</span> 任務執行中心
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center md:text-left">Action Items Dashboard</p>
        </div>
        
        <div className={`flex items-center border-2 rounded-2xl px-4 py-2 w-full md:w-80 focus-within:border-amber-400 focus-within:bg-transparent transition-all shadow-inner ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
          <span className="mr-2 opacity-30 text-lg">🔍</span>
          <input 
            type="text" 
            placeholder="搜尋任務內容或會議..." 
            className={`bg-transparent outline-none text-sm font-bold w-full ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* 任務清單 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {filteredActions.length === 0 ? (
          <div className={`h-64 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed text-slate-500 space-y-4 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            <span className="text-5xl">🏝️</span>
            <p className="font-black italic">目前沒有任何待辦事項</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredActions.map((item) => (
              <div 
                key={item.id}
                className={`group rounded-3xl border p-6 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between relative overflow-hidden ${theme === 'dark' ? 'bg-[#1e293b]/50 border-white/5 text-slate-200' : 'bg-white border-slate-200 text-slate-800'} ${item.status === 'completed' ? 'opacity-40' : 'hover:border-amber-500/30 hover:shadow-amber-500/10'}`}
              >
                {/* 完成時的橫線 */}
                {item.status === 'completed' && <div className={`absolute top-1/2 left-6 right-6 h-0.5 -rotate-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>}

                <div className="space-y-4">
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex gap-2">
                      <select 
                        className={`text-[9px] font-black px-2 py-1 rounded-lg border cursor-pointer outline-none transition-colors ${theme === 'dark' ? darkPriorityColors[item.priority] : priorityColors[item.priority]}`}
                        value={item.priority}
                        onChange={(e) => updatePriority(item.id, e.target.value)}
                      >
                        <option value="high">高優先</option>
                        <option value="medium">中優先</option>
                        <option value="low">低優先</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className={`transition-colors ${theme === 'dark' ? 'text-slate-600 hover:text-rose-400' : 'text-slate-300 hover:text-rose-500'}`}
                    >
                      <span className="text-xs">🗑️</span>
                    </button>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <button 
                      onClick={() => toggleStatus(item.id, item.status)}
                      className={`mt-1 w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.status === 'completed' ? 'bg-amber-600 border-amber-600' : theme === 'dark' ? 'bg-black/40 border-slate-700 hover:border-amber-400' : 'bg-white border-slate-200 hover:border-amber-400'}`}
                    >
                      {item.status === 'completed' && <span className="text-white text-[10px] font-black">✓</span>}
                    </button>
                    <p className={`text-base font-bold leading-relaxed transition-all ${item.status === 'completed' ? 'text-slate-500' : theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                      {item.content}
                    </p>
                  </div>
                </div>

                <div className={`mt-8 pt-4 border-t flex justify-between items-center ${theme === 'dark' ? 'border-white/5' : 'border-slate-50'}`}>
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-xs">🎙️</span>
                    <span className={`text-[10px] font-black truncate max-w-[120px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{item.meeting?.title || '未知會議'}</span>
                  </div>
                  <button 
                    onClick={() => onNavigateToMeeting(item.meetingId)}
                    className="text-[10px] font-black text-amber-600 hover:underline"
                  >
                    查看會議 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部統計 */}
      <div className={`rounded-2xl p-4 flex justify-between items-center shadow-xl transition-colors ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white'}`}>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 font-black text-lg">{filteredActions.filter(a => a.status === 'pending').length}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">待處理</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center space-x-2">
            <span className="text-emerald-400 font-black text-lg">{filteredActions.filter(a => a.status === 'completed').length}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">已完成</span>
          </div>
        </div>
        <button onClick={loadActions} className="text-[10px] font-black bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all">重新整理資料</button>
      </div>
    </div>
  )
}
