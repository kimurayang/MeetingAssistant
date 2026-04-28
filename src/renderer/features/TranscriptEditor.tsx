import React, { useState, useEffect, useRef } from 'react'

// --- 安全渲染輔助組件 ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-20 flex flex-col items-center justify-center text-center bg-[#020617] h-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-black text-white mb-2">渲染發生衝突</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-md">資料格式可能不符合預期，導致介面無法顯示。請嘗試點擊「重新分析」以修復資料。</p>
          <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 bg-amber-600 text-white rounded-xl font-bold">重新整理頁面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Speaker { id: string; label: string; displayName: string; }
interface Segment { id: number; startTime: number; endTime: number; speakerId: string; content: string; speaker?: Speaker; }
interface MeetingDetails {
  id: string; title: string; date: string; audioPath: string; status: string;
  segments: Segment[]; summary?: { highlights: string; mode: string; }; speakers: Speaker[];
}

export function TranscriptEditor({ meetingId, onBack, onStartProcess, isProcessing: globalIsProcessing }: { 
  meetingId: string, 
  onBack: () => void,
  onStartProcess?: (id: string, path: string, tasks: string[], mode: string) => Promise<void>,
  isProcessing?: boolean
}) {
  return (
    <ErrorBoundary>
      <TranscriptEditorContent 
        meetingId={meetingId} 
        onBack={onBack} 
        onStartProcess={onStartProcess}
        isProcessing={globalIsProcessing}
      />
    </ErrorBoundary>
  )
}

function TranscriptEditorContent({ meetingId, onBack, onStartProcess, isProcessing: globalIsProcessing }: { 
  meetingId: string, 
  onBack: () => void,
  onStartProcess?: (id: string, path: string, tasks: string[], mode: string) => Promise<void>,
  isProcessing?: boolean
}) {
  const [details, setDetails] = useState<MeetingDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript')
  const [localIsProcessing, setLocalIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState({ percent: 0, message: '' })
  const [theme, setTheme] = useState<'dark' | 'white'>('dark')

  const isProcessing = globalIsProcessing || localIsProcessing;

  useEffect(() => {
    loadDetails()
    // 🛡️ 獲取主題
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-config').then(c => { if(c.theme) setTheme(c.theme) })

    const unsubscribe = window.electron.ipcRenderer.on('processing-progress', (_: any, data: any) => {
      if (data && data.meetingId === meetingId) {
        setProgress({ percent: data.progress || 0, message: data.message || '分析中...' })
        if (data.progress === 100) { setTimeout(() => loadDetails(), 1000) }
      }
    })
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [meetingId])

  const loadDetails = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-meeting-details', meetingId)
      if (data) { setDetails(data); }
    } catch (err) { console.error('Details Load Error:', err); }
  }

  const handleProcess = async (tasks?: string[]) => {
    if (isExporting || isProcessing) return
    if (onStartProcess && details) {
      await onStartProcess(meetingId, details.audioPath, tasks || ['stt', 'llm'], details.summary?.mode || 'auto');
      await loadDetails();
      return;
    }
    
    // Fallback if prop not provided
    setLocalIsProcessing(true)
    setProgress({ percent: 0, message: '發送請求中...' })
    try {
      const result = await window.electron.ipcRenderer.invoke('process-meeting', { meetingId, audioPath: details?.audioPath, tasks })
      if (result?.success) { await loadDetails(); }
      else if (result && result.error !== '任務已取消') { alert('分析失敗：' + result.error); }
    } catch (err) { alert('連線後端引擎失敗。'); }
    finally { setLocalIsProcessing(false); }
  }

  const handleExport = async (type: 'pdf-transcript' | 'pdf-analysis') => {
    if (!details || isExporting || isProcessing) return
    setIsExporting(true)
    try {
      const summaryData = details.summary?.highlights ? JSON.parse(details.summary.highlights) : null
      const result = await window.electron.ipcRenderer.invoke('export-meeting', { 
        meetingId: details.id, type, title: details.title, segments: details.segments || [], summary: summaryData
      })
      if (result?.success) { console.log(`Export success: ${result.path}`) }
      else if (result?.error !== 'User canceled') { alert('匯出失敗：' + (result?.error || '未知錯誤')) }
    } catch (e) { alert('資料格式錯誤，無法匯出。'); }
    finally { setIsExporting(false) }
  }

  if (!details) return <div className={`h-full flex items-center justify-center font-black animate-pulse tracking-[0.3em] transition-colors ${theme === 'dark' ? 'bg-[#020617] text-slate-700' : 'bg-slate-50 text-slate-300'}`}>LOADING ENGINE...</div>

  const safeMap = (arr: any, callback: (item: any, index: number) => React.ReactNode) => {
    if (!Array.isArray(arr)) return null;
    return arr.map(callback);
  }

  return (
    <div className={`h-full flex flex-col font-sans selection:bg-amber-500/30 transition-colors ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'} ${isExporting ? 'cursor-wait pointer-events-none opacity-80' : ''}`}>
      {isExporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
          <p className="font-black text-xs text-amber-500 uppercase tracking-widest">Saving Intelligence Report...</p>
        </div>
      )}

      {/* Header */}
      <div className={`flex-none p-3 px-6 border-b flex justify-between items-center sticky top-0 z-30 shadow-xl transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-slate-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div className="flex items-center gap-4">
            <h1 className={`text-base font-black tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{details.title || '無標題'}</h1>
            <div className={`h-4 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}></div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none italic">
              Processed: {details.date ? new Date(details.date).toLocaleString() : 'Pending'}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          {isProcessing ? (
            <div className="flex items-center space-x-3 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 scale-90">
              <span className="text-[9px] font-black text-amber-500 animate-pulse uppercase">{progress.message}</span>
              <div className="w-20 h-1 bg-amber-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" style={{ width: `${progress.percent}%` }}></div>
              </div>
            </div>
          ) : (
            <button disabled={isExporting} onClick={() => handleProcess()} className="px-5 py-2 bg-amber-600 text-white rounded-xl font-black text-[10px] hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/20 uppercase tracking-widest active:scale-95">重新分析</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex-none px-12 pt-3 border-b flex space-x-12 relative z-20 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
        {['transcript', 'summary'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-amber-500' : 'text-slate-500'}`}>
            {tab === 'transcript' ? '逐字稿紀錄' : 'AI 專家摘要'}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-t-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'transcript' ? (
          <div className={`h-full overflow-y-auto p-8 space-y-4 custom-scrollbar ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50/50'}`}>
            <div className="max-w-4xl mx-auto space-y-6">
              {safeMap(details.segments, (seg, idx) => (
                <div key={seg.id || idx} className="group animate-in fade-in slide-in-from-left-4">
                  <div className="flex items-center space-x-4 mb-1">
                    <div className={`px-2 py-0.5 rounded text-[9px] font-black group-hover:bg-amber-600 group-hover:text-white transition-all uppercase ${theme === 'dark' ? 'bg-white/5 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>{seg.speaker?.displayName || '未知'}</div>
                    <span className="text-[8px] font-bold text-slate-400">{Math.floor((seg.startTime || 0) / 60)}:{(seg.startTime % 60).toFixed(0).padStart(2, '0')}</span>
                  </div>
                  <div className={`pl-4 border-l group-hover:border-amber-500/30 transition-all ${theme === 'dark' ? 'border-white/5 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                    <p className="leading-relaxed font-medium text-sm">{seg.content || '(無內容)'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`h-full overflow-y-auto p-8 bg-transparent custom-scrollbar`}>
            {(() => {
              const highlights = details.summary?.highlights
              if (!highlights) return <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-sm tracking-widest uppercase">Report Pending...</div>
              let summary: any = null
              try { summary = JSON.parse(highlights); } catch (e) { return <div className="p-12 text-amber-500 font-black text-center uppercase tracking-widest">Parsing Error // Re-analyze Required</div> }

              return (
                <div className="max-w-5xl mx-auto space-y-6 pb-10">
                  <section className="grid grid-cols-3 gap-3">
                    {['主題', '與會', '時間'].map((label, idx) => {
                      const vals = [summary.basic_info?.subject, summary.basic_info?.participants, summary.basic_info?.time]
                      return (
                        <div key={idx} className={`p-3 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                          <p className={`font-black text-xs mt-0.5 truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{vals[idx] || 'N/A'}</p>
                        </div>
                      )
                    })}
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-1">02 / Agenda</h3>
                    <div className={`rounded-2xl p-5 border space-y-2 transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                      {safeMap(summary.agenda, (item, i) => <div key={i} className={`flex font-bold text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}><span className="text-amber-500/50 mr-3">0{i+1}</span>{item}</div>)}
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-1">03 / Key Content</h3>
                    <div className={`border rounded-2xl p-5 space-y-3 transition-colors ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-100'}`}>
                      {safeMap(summary.key_content, (item, i) => (
                        <div key={i} className="flex items-start gap-4 group">
                          <div className="w-1 h-5 bg-amber-500 rounded-full flex-none mt-0.5 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                          <p className={`leading-relaxed font-black text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-[9px] font-black text-emerald-500 uppercase tracking-widest px-1">04 / Decisions</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {safeMap(summary.decisions, (item, i) => <div key={i} className={`p-3 border rounded-xl font-black text-xs flex gap-3 ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}><span className="text-emerald-500">✔</span>{item}</div>)}
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-1">05 / Tasks</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {safeMap(summary.action_items, (item, i) => (
                        <div key={i} className={`border rounded-2xl p-4 text-xs font-black hover:border-amber-500/50 transition-all flex items-center gap-3 group cursor-pointer ${theme === 'dark' ? 'bg-[#0F172A] border-white/5 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                          <div className="w-4 h-4 rounded-md border-2 border-white/10 flex-none flex items-center justify-center group-hover:border-amber-500/50">
                             <div className="w-1.5 h-1.5 bg-amber-500 rounded-full opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(245,158,11,0.8)] transition-all"></div>
                          </div>
                          {item}
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-20">
                    {[
                      { label: '追蹤類', color: 'bg-amber-700', data: summary.discussion?.tracking, style: theme === 'dark' ? 'italic border-amber-500/20 text-slate-400' : 'italic border-amber-200 text-slate-500' },
                      { label: '亮點', color: 'bg-amber-600', data: summary.discussion?.interesting, style: theme === 'dark' ? 'font-black border-amber-500/40 text-slate-200' : 'font-black border-amber-300 text-slate-800' },
                      { label: '回溯類', color: 'bg-slate-800', data: summary.discussion?.retrospective, style: theme === 'dark' ? 'text-slate-500 border-white/10' : 'text-slate-400 border-slate-200' }
                    ].map((sec, idx) => (
                        <div key={idx} className={`border rounded-2xl p-5 flex flex-col space-y-4 transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                          <div className={`${sec.color} text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest w-fit shadow-lg`}>{sec.label}</div>
                          <div className="flex-1 space-y-2">
                            {safeMap(sec.data, (t, i) => <p key={i} className={`text-[11px] leading-relaxed border-l-2 pl-3 ${sec.style}`}>「{t}」</p>)}
                          </div>
                        </div>
                    ))}
                  </section>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      <div className={`flex-none p-4 border-t flex justify-between items-center shadow-2xl relative z-20 px-12 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border transition-colors ${theme === 'dark' ? 'bg-black/40 text-slate-600 border-white/5' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>TRON SECURE v5.0</span>
        <div className="flex gap-2">
          <button disabled={isExporting || isProcessing} onClick={() => handleExport('pdf-transcript')} className="px-8 py-2 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-700 transition-all active:scale-95">📄 逐字稿</button>
          <button disabled={isExporting || isProcessing} onClick={() => handleExport('pdf-analysis')} className="px-8 py-2 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-700 transition-all active:scale-95">🧠 專家報告</button>
        </div>
      </div>
    </div>
  )
}
