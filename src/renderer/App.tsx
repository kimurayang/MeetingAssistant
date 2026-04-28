import React, { useState, lazy, Suspense } from 'react'
import { useAudioRecorder } from './hooks/useAudioRecorder'

// 🟢 [Optimization] 使用 React.lazy 進行代碼分割，消除切換延遲
const Settings = lazy(() => import('./features/Settings').then(m => ({ default: m.Settings })))
const MeetingList = lazy(() => import('./features/MeetingList').then(m => ({ default: m.MeetingList })))
const TranscriptEditor = lazy(() => import('./features/TranscriptEditor').then(m => ({ default: m.TranscriptEditor })))

// --- 專業 SVG 圖示組件 ---
const Icons = {
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  Film: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 7h4"/><path d="M3 12h18"/><path d="M3 17h4"/><path d="M17 17h4"/><path d="M17 7h4"/></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 5.586 3 3 0 1 0 5.83 1.361V17.5a2 2 0 0 1 4 0v.342a3 3 0 1 0 5.83-1.361 4 4 0 0 0 .52-5.586 4 4 0 0 0-2.526-5.77A3 3 0 1 0 12 5Z"/><path d="M9 13a4.5 4 0 0 0 3-4"/><path d="M15 13a4.5 4 0 0 1-3-4"/><path d="M12 13V8"/></svg>,
  Rocket: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.95.12-3.5-.5-4.5l-2.5 1.5Z"/><path d="M11.5 4.5 9 7c-1.31 1.31-1.4 3.47-.2 4.81l2.89 2.89c1.34 1.2 3.5 1.11 4.81-.2l2.5-2.5c1.1-1.1 1.4-3.5 1.4-3.5s-2.4.3-3.5 1.4l-2.5 2.5"/><path d="m9 11 3 3"/><path d="M15 5c1.4-1.4 4-2 4-2s-.6 2.6-2 4"/></svg>,
  Zap: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.5a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-10Z"/><path d="m14 11.5 3 3"/><path d="m4 11.5-3 3"/></svg>
}

function App() {
  const [view, setView] = useState('home')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const { isRecording, recordingTime, audioData, startRecording, stopRecording } = useAudioRecorder()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStatus, setProcessStatus] = useState({ progress: 0, message: '' })
  const [recordMode, setRecordMode] = useState<'mic' | 'system'>('system')
  const [autoProcess, setAutoProcess] = useState(false)
  const [sidecarStatus, setSidecarStatus] = useState<string>('unknown')
  const [techQuote, setTechQuote] = useState('Initializing AI Core...')
  const [theme, setTheme] = useState<'dark' | 'white'>('dark')

  const [externalSource, setExternalSource] = useState<{ path?: string, url?: string, title?: string } | null>(null)
  
  // 🛡️ [Fix] 使用 Ref 管理計時器，防止組件卸載後的 setState 警告
  const resetTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    // 載入設定中的主題
    window.electron.ipcRenderer.invoke('get-config').then((conf) => {
      if (conf?.theme) setTheme(conf.theme)
    })
  }, [])

  React.useEffect(() => {
    if (isProcessing) {
      const quotes = ["Analyzing spectral density...", "Contextualizing technical entities...", "Mapping semantic hierarchies...", "Refining Chinese syntax..."]
      let idx = 0
      const timer = setInterval(() => { setTechQuote(quotes[idx % quotes.length]); idx++ }, 2500)
      return () => clearInterval(timer)
    }
  }, [isProcessing])

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await window.electron.ipcRenderer.invoke('get-sidecar-status')
        if (status) setSidecarStatus(status)
      } catch (err) { console.error('[App] Status Error:', err) }
    }
    fetchStatus()
    const pollInterval = setInterval(fetchStatus, 5000)
    
    // 🛡️ [Standardized Listener]：使用 Preload 回傳的取消函數
    const unsubscribe = window.electron.ipcRenderer.on('processing-progress', (data: any) => {
      if (data) {
        setProcessStatus({
          progress: Number(data.progress ?? 0),
          message: data.message ?? 'AI 分析中...'
        })
        setIsProcessing(true) // 確保狀態同步開啟
      }
    })

    return () => { 
      clearInterval(pollInterval); 
      if (typeof unsubscribe === 'function') unsubscribe();
      // 🛡️ 清理重置計時器
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    }
  }, [])

  const handleSaveAudio = async (blob: Blob) => {
    const buffer = await blob.arrayBuffer()
    const title = `${recordMode === 'system' ? '線上會議' : '現場錄音'} ${new Date().toLocaleString()}`
    try {
      setIsProcessing(true)
      setProcessStatus({ progress: 2, message: '正在儲存錄音檔...' })
      const result = await window.electron.ipcRenderer.invoke('save-audio', { buffer, title })
      if (result.success) { 
        if (autoProcess) {
          // 儲存成功後，直接觸發分析流程
          await handleStartProcess(result.meetingId, result.audioPath || '', ['stt', 'llm'], 'auto');
        } else {
          // 僅儲存，不自動分析
          setSelectedMeetingId(result.meetingId);
          setIsProcessing(false);
          setProcessStatus({ progress: 0, message: '' });
        }
        setView('detail');
      } else { 
        alert('儲存失敗: ' + result.error); 
        setIsProcessing(false);
      }
    } catch (err: any) {
      alert('發生錯誤: ' + err.message);
      setIsProcessing(false);
    }
  }

  const handleStartRecording = (mode: 'mic' | 'system') => {
    setRecordMode(mode);
    startRecording(mode, handleSaveAudio);
  }

  const handleStartProcess = async (meetingId: string, audioPath: string, tasks: string[] = ['stt', 'llm'], summaryMode: string = 'auto') => {    try {
      setIsProcessing(true)
      setProcessStatus({ progress: 5, message: 'Initializing Engine...' })
      const result = await window.electron.ipcRenderer.invoke('process-meeting', { meetingId, audioPath, tasks, summaryMode })
      if (result.success) { 
        setSelectedMeetingId(meetingId); 
        setView('detail'); 
      } else { 
        if (result.error !== '任務已取消') alert('AI 處理失敗: ' + result.error); 
      }
    } catch (err) { 
      alert('處理出錯'); 
    } finally { 
      // 🛡️ 統一狀態收束
      setIsProcessing(false); 
      
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setProcessStatus({ progress: 0, message: '' });
        resetTimerRef.current = null;
      }, 1500); // 給予稍微長一點的時間讓使用者看清楚 100%
    }
  }

  const handleSelectFile = async () => {
    const filePath = await window.electron.ipcRenderer.invoke('select-media-file')
    if (filePath) setExternalSource({ path: filePath, title: filePath.split(/[\\/]/).pop() })
  }

  const handleConfirmExternal = async (tasks: string[] = ['stt', 'llm']) => {
    if (!externalSource) return
    try {
      setIsProcessing(true)
      const title = externalSource.title || '任務'
      const pathOrUrl = externalSource.path || externalSource.url || ''
      const regResult = await window.electron.ipcRenderer.invoke('register-external-file', { filePath: pathOrUrl, title: `${title}` })
      if (regResult.success) { 
        await handleStartProcess(regResult.meetingId, pathOrUrl, tasks); 
        setExternalSource(null); 
      } else { 
        setIsProcessing(false); 
      }
    } catch (err) { setIsProcessing(false); }
  }

  const handleTextSummary = async (mode: string = 'document') => {
    const filePath = await window.electron.ipcRenderer.invoke('select-text-file')
    if (!filePath) return
    try {
      setIsProcessing(true)
      const regResult = await window.electron.ipcRenderer.invoke('register-external-file', { filePath, title: `文件摘要：${filePath.split(/[\\/]/).pop()}` })
      if (regResult.success) {
        await handleStartProcess(regResult.meetingId, filePath, ['llm'], mode)
      }
    } catch (err) { } finally { setIsProcessing(false); }
  }

  const handleSelectMeeting = (meetingId: string) => { setSelectedMeetingId(meetingId); setView('detail'); }
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const handleCancel = async () => {
    if (!selectedMeetingId && view !== 'detail') {
      // 如果是在首頁發起的外部檔案處理，可能需要從狀態中獲取目前的 meetingId
      // 這裡簡化為發送取消請求，後端會根據 activeJobs 處理
    }
    const targetId = selectedMeetingId || '';
    const res = await window.electron.ipcRenderer.invoke('cancel-processing', { meetingId: targetId });
    if (res.success) {
      setTechQuote('正在優雅停止 AI 任務...');
    }
  }

  const handleForceReset = async () => {
    if (confirm('警告：強制重置將直接終止 AI 引擎進程，所有未完成的分析進度將遺失。確定執行？')) {
      await window.electron.ipcRenderer.invoke('force-reset-engine');
      setIsProcessing(false);
      setProcessStatus({ progress: 0, message: '' });
      alert('引擎已重試，請稍候片刻等待系統恢復。');
    }
  }

  return (
    <div className={`flex flex-col h-screen font-sans selection:bg-amber-500/30 overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      {/* --- Header --- */}
      <header className={`p-3 border-b flex justify-between items-center z-40 shadow-2xl transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(217,119,6,0.3)]">
            <div className="w-4 h-4 bg-white rounded-sm"></div>
          </div>
          <h1 className={`text-xl font-black tracking-tighter uppercase italic ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Vox<span className="text-amber-500">Note</span></h1>
        </div>
        <nav className={`flex space-x-1 p-1 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
          {['home', 'history', 'settings'].map(v => (
            <button 
              key={v} 
              onClick={() => setView(v)} 
              disabled={isProcessing && v === 'settings'} 
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-amber-600 text-white shadow-lg' : theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} disabled:opacity-30`}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* --- 任務處理面板 --- */}
        {isProcessing && (
          <div className={`absolute bottom-4 left-4 right-4 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between animate-in slide-in-from-bottom-4 duration-500 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`}>
            <div className="flex items-center space-x-4 flex-1">
              <div className="w-12 h-12 relative flex-none">
                <div className={`absolute inset-0 border-[3px] rounded-full ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}></div>
                <div className="absolute inset-0 border-[3px] border-amber-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] text-amber-500">{processStatus.progress}%</div>
              </div>
              <div className="overflow-hidden">
                <p className="text-amber-400 text-[10px] font-black tracking-widest uppercase truncate">{techQuote}</p>
                <p className={`text-[9px] font-bold truncate mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{processStatus.message}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <button 
                onClick={handleCancel}
                className={`px-4 py-2 border rounded-xl font-black text-[10px] transition-all uppercase tracking-widest ${theme === 'dark' ? 'bg-slate-800 border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-900/40' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
              >
                🛑 停止分析
              </button>
            </div>
          </div>
        )}

        {/* --- View Content --- */}
        <div className={`h-full overflow-hidden p-4 transition-colors ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-amber-500 animate-pulse font-black text-[10px] uppercase tracking-widest">Loading Dynamic Interface...</div>}>
            {view === 'home' && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-700">
                  <div className="grid grid-cols-3 gap-4">
                    
                    {/* 1. Live Record */}
                    <section className={`rounded-[24px] border p-6 flex flex-col items-center justify-between text-center min-h-[400px] hover:border-amber-500/30 transition-all group shadow-xl ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
                      <div className="space-y-4">
                        <div className="bg-amber-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto text-white shadow-lg group-hover:scale-110 transition-transform"><Icons.Mic /></div>
                        <div>
                          <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>即時錄製</h3>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Live AI Capture</p>
                        </div>
                        <div className="h-12 flex flex-col items-center justify-center space-y-1">
                          {!isRecording && (
                            <div 
                              className="flex items-center space-x-2 mb-1 cursor-pointer group/toggle" 
                              onClick={() => setAutoProcess(!autoProcess)}
                            >
                              <div className={`w-3.5 h-3.5 rounded border border-amber-500/50 flex items-center justify-center transition-all ${autoProcess ? 'bg-amber-600 border-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.4)]' : 'bg-transparent'}`}>
                                {autoProcess && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${autoProcess ? 'text-amber-500' : 'text-slate-500 group-hover/toggle:text-slate-400'}`}>錄音結束自動執行 AI 摘要</span>
                            </div>
                          )}
                          {isRecording && (
                            <div className="flex items-center space-x-1">{Array.from(audioData).slice(0, 10).map((v, i) => <div key={i} className="w-1 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" style={{ height: `${Math.max(20, (v/255)*100)}%` }} />)}</div>
                          )}
                        </div>
                      </div>
                      <div className="w-full space-y-3">
                        {!isRecording && <p className="text-[11px] text-slate-500 font-medium mb-1">支援麥克風與系統音效</p>}
                        {!isRecording ? (
                          <div className="flex flex-col gap-2">
                            <button disabled={isProcessing} onClick={() => startRecording('mic', handleSaveAudio)} className={`w-full py-3 rounded-xl font-black text-xs transition-all disabled:opacity-20 hover:bg-amber-600 hover:text-white ${theme === 'dark' ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}>現場錄製</button>
                            <button disabled={isProcessing} onClick={() => startRecording('system', handleSaveAudio)} className={`w-full py-3 rounded-xl font-black text-xs transition-all disabled:opacity-20 hover:bg-amber-600 hover:text-white ${theme === 'dark' ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}>系統錄製</button>
                          </div>
                        ) : <button onClick={stopRecording} className="w-full py-4 bg-red-600 text-white rounded-xl font-black text-sm shadow-xl animate-pulse">結束並分析</button>}
                      </div>
                    </section>

                    {/* 2. Import */}
                    <section className={`rounded-[24px] border p-6 flex flex-col items-center justify-between text-center min-h-[400px] hover:border-amber-500/30 transition-all group shadow-xl ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
                      <div className="space-y-4 w-full">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto transition-colors ${theme === 'dark' ? 'bg-slate-800 text-slate-400 group-hover:text-amber-400' : 'bg-slate-100 text-slate-500 group-hover:text-amber-600'}`}><Icons.Film /></div>
                        <div>
                          <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>檔案匯入</h3>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Universal Import</p>
                        </div>
                        <div onClick={isProcessing ? undefined : handleSelectFile} className={`p-3 border-2 border-dashed rounded-xl transition-all ${isProcessing ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:bg-amber-500/5'} ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                          <p className="text-[10px] font-black text-slate-500 truncate">{externalSource?.path ? externalSource.title : '選取本地影音'}</p>
                        </div>
                        <div className={`p-2 rounded-xl flex items-center gap-2 border transition-colors ${isProcessing ? 'opacity-20' : ''} ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                          <Icons.Rocket /><input disabled={isProcessing} type="text" placeholder="YouTube URL" className="bg-transparent outline-none text-[10px] font-bold placeholder:text-slate-400 w-full" value={externalSource?.url || ''} onChange={e => setExternalSource({ url: e.target.value, title: '網路影片' })} />
                        </div>
                      </div>
                      <div className="w-full space-y-2">
                        <button disabled={!externalSource || isProcessing} onClick={() => handleConfirmExternal()} className="w-full py-3 bg-amber-600 text-white rounded-xl font-black text-xs disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg shadow-amber-900/20">智能分析</button>
                      </div>
                    </section>

                    {/* 3. Text AI */}
                    <section className={`rounded-[24px] border p-6 flex flex-col items-center justify-between text-center min-h-[400px] hover:border-amber-500/30 transition-all group relative overflow-hidden shadow-xl ${theme === 'dark' ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                      <div className="space-y-4 w-full relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto shadow-xl group-hover:rotate-12 transition-transform ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}><Icons.Brain /></div>
                        <div>
                          <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>智慧摘要</h3>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Text Intelligence</p>
                        </div>
                        <ul className={`text-left space-y-2 text-[10px] font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-amber-500"></div> 解析商務與技術洞察</li>
                          <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-amber-500"></div> 支援 TXT, PDF, DOCX</li>
                        </ul>
                      </div>
                      <button disabled={isProcessing} onClick={() => handleTextSummary('universal')} className={`w-full py-4 rounded-xl font-black text-xs transition-all shadow-xl z-10 disabled:opacity-20 hover:bg-amber-600 hover:text-white ${theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}>開始文本分析</button>
                    </section>
                  </div>
                </div>
              </div>
            )}

            {view === 'history' && <div className="h-full animate-in slide-in-from-right-4 duration-500"><MeetingList onSelectMeeting={handleSelectMeeting} isProcessing={isProcessing} theme={theme} /></div>}
            {view === 'settings' && <div className="h-full animate-in fade-in duration-500"><Settings onThemeChange={setTheme} theme={theme} /></div>}
            {view === 'detail' && selectedMeetingId && <div className="h-full animate-in zoom-in-95 duration-300"><TranscriptEditor meetingId={selectedMeetingId} onBack={() => {setSelectedMeetingId(null); setView('history');}} onStartProcess={handleStartProcess} isProcessing={isProcessing} theme={theme} /></div>}
          </Suspense>
        </div>
      </main>

      <footer className={`p-2 border-t flex justify-between px-6 items-center text-[9px] font-black tracking-[0.2em] transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5 text-slate-600' : 'bg-white border-slate-200 text-slate-400'}`}>
        <div>VOXNOTE // STEALTH AMBER v1.0</div>
        <div className={`flex items-center space-x-3 px-3 py-1 rounded-full border transition-colors ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${sidecarStatus === 'healthy' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : sidecarStatus === 'starting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className={sidecarStatus === 'healthy' ? 'text-amber-500' : 'text-yellow-600'}>{sidecarStatus === 'healthy' ? 'SYSTEM READY' : 'STARTING...'}</span>
        </div>
      </footer>
    </div>
  )
}

export default App
