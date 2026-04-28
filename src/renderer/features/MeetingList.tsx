import React, { useState, useEffect } from 'react'

interface Meeting {
  id: string
  title: string
  date: string
  status: string
}

interface MeetingListProps {
  onSelectMeeting: (id: string) => void
  isProcessing?: boolean
  theme?: 'dark' | 'white'
}

// --- 專業 SVG 圖示 ---
const Icons = {
  Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
}

export function MeetingList({ onSelectMeeting, isProcessing, theme = 'dark' }: MeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => { loadMeetings(search) }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const loadMeetings = async (keyword?: string) => {
    setLoading(true)
    try {
      // @ts-ignore
      const data = await window.electron.ipcRenderer.invoke('get-meetings', { search: keyword })
      setMeetings(data)
    } catch (err) { console.error('Failed to load meetings:', err) }
    finally { setLoading(false) }
  }

  const deleteMeeting = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('確定要刪除這筆會議紀錄嗎？')) {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('delete-meeting', id)
      if (result.success) { loadMeetings() }
    }
  }

  const filteredMeetings = meetings.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className={`h-full flex items-center justify-center font-black animate-pulse tracking-[0.2em] transition-colors ${theme === 'dark' ? 'bg-[#020617] text-slate-800' : 'bg-slate-50 text-slate-300'}`}>LOADING VAULT...</div>

  return (
    <div className={`w-full h-full flex flex-col space-y-4 overflow-x-hidden p-4 transition-colors ${theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className={`text-xl font-black tracking-tight leading-none uppercase italic transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Archive <span className="text-amber-500">Vault</span></h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">Meeting Records</p>
        </div>
        <div className="flex space-x-2">
          <input 
            type="text" 
            placeholder="Search records..." 
            className={`px-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-amber-500 transition-all w-48 shadow-sm ${theme === 'dark' ? 'bg-black/40 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {filteredMeetings.map((meeting) => (
          <div 
            key={meeting.id}
            onClick={() => onSelectMeeting(meeting.id)}
            className={`group p-4 rounded-[24px] border shadow-sm hover:border-amber-500/30 transition-all cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}
          >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-amber-600 group-hover:text-white ${theme === 'dark' ? 'bg-black/20 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                <Icons.Calendar />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-black text-sm truncate group-hover:text-amber-400 transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{meeting.title}</h3>
                <div className="flex items-center space-x-3 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-500">{new Date(meeting.date).toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                    meeting.status === 'completed' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                    meeting.status === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  }`}>
                    {meeting.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                disabled={isProcessing}
                onClick={(e) => deleteMeeting(e, meeting.id)}
                className={`p-2.5 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all ${isProcessing ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`}
                title="刪除"
              >
                <Icons.Trash />
              </button>
              <div className={`transition-all group-hover:text-amber-500 group-hover:translate-x-1 ${theme === 'dark' ? 'text-slate-800' : 'text-slate-200'}`}>
                <Icons.ChevronRight />
              </div>
            </div>
          </div>
        ))}

        {filteredMeetings.length === 0 && (
          <div className={`text-center py-20 rounded-[32px] border-2 border-dashed animate-in fade-in ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white border-slate-100'}`}>
            <p className="text-slate-500 text-sm font-black uppercase tracking-widest">No Records Found</p>
          </div>
        )}
      </div>
    </div>
  )
}
