import React, { useState, useEffect } from 'react'

// --- 專業 SVG 圖示 ---
const Icons = {
  Folder: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>,
  Key: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3L15.5 7.5z"/></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 6 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 5.586 3 3 0 1 0 5.83 1.361V17.5a2 2 0 0 1 4 0v.342a3 3 0 1 0 5.83-1.361 4 4 0 0 0 .52-5.586 4 4 0 0 0-2.526-5.77A3 3 0 1 0 12 5Z"/></svg>,
  Save: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Palette: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H17c2.8 0 5-2.2 5-5 0-4.4-4.5-8-10-8Z"/></svg>
}

interface SettingsProps {
  onThemeChange?: (theme: 'dark' | 'white') => void
}

export function Settings({ onThemeChange, theme: globalTheme }: { onThemeChange?: (theme: 'dark' | 'white') => void, theme?: 'dark' | 'white' }) {
  const [config, setConfig] = useState({
    modelSize: 'base', device: 'cpu', hfToken: '', recordingsPath: '',
    isCollaborative: true, logicModelPath: '', polishModelPath: '',
    customTerms: '', llmDevice: 'cpu', theme: 'dark'
  })

  // 🛡️ 優先使用全域主題
  const theme = globalTheme || config.theme || 'dark'

  useEffect(() => {
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-config').then((data) => {
      const fullData = { ...data, isCollaborative: true, theme: data.theme || 'dark' }
      setConfig(fullData)
    })
  }, [])

  const handleSave = async () => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('save-config', { ...config, isCollaborative: true })
    alert('設定已儲存')
  }

  const handleThemeChange = (newTheme: 'dark' | 'white') => {
    setConfig({ ...config, theme: newTheme })
    if (onThemeChange) onThemeChange(newTheme)
  }

  const selectDirectory = async () => {
    // @ts-ignore
    const path = await window.electron.ipcRenderer.invoke('select-directory')
    if (path) setConfig({ ...config, recordingsPath: path })
  }

  const selectModel = async (type: 'logic' | 'polish') => {
    const title = type === 'logic' ? '選擇分析模型 (Logic)' : '選擇潤色模型 (Polish)'
    // @ts-ignore
    const path = await window.electron.ipcRenderer.invoke('select-llm-model', title)
    if (path) {
      if (type === 'logic') setConfig({ ...config, logicModelPath: path })
      else setConfig({ ...config, polishModelPath: path })
    }
  }

  return (
    <div className={`h-full w-full flex flex-col p-3 space-y-3 animate-in fade-in duration-500 overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      
      <div className="flex justify-between items-center px-1">
        <h2 className={`text-xs font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Engine Configuration</h2>
        <button onClick={handleSave} className="px-4 py-1.5 bg-amber-600 text-white rounded-xl font-black text-[10px] hover:bg-amber-700 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center gap-2 active:scale-95">
          <Icons.Save /> <span>儲存設定</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
        
        {/* Left: System Base */}
        <div className="space-y-3">
          <section className={`p-4 rounded-[20px] border shadow-sm space-y-3 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 text-slate-500">
              <Icons.Folder /> <span className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Storage</span>
            </div>
            <div className="space-y-1">
              <p className={`text-[9px] font-bold truncate p-1.5 rounded-lg border italic ${theme === 'dark' ? 'bg-black/20 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>{config.recordingsPath || '預設路徑'}</p>
              <button onClick={selectDirectory} className={`w-full py-1.5 rounded-lg font-black text-[9px] hover:bg-amber-600 hover:text-white transition-all uppercase ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>變更路徑</button>
            </div>
          </section>

          <section className={`p-4 rounded-[20px] border shadow-sm space-y-2 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 text-slate-500">
              <Icons.Palette /> <span className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Appearance</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-1.5 rounded-lg font-black text-[9px] transition-all uppercase border ${theme === 'dark' ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>Dark Mode</button>
              <button onClick={() => handleThemeChange('white')} className={`flex-1 py-1.5 rounded-lg font-black text-[9px] transition-all uppercase border ${theme === 'white' ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>White Mode</button>
            </div>
          </section>

          <section className={`p-4 rounded-[20px] border shadow-sm space-y-2 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 text-slate-500">
              <Icons.Key /> <span className={`text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>模型授權 (Auth)</span>
            </div>
            <input type="password" placeholder="HuggingFace Token (用於講者辨識)" className={`w-full border rounded-xl px-2 py-1.5 text-[9px] font-bold outline-none focus:border-amber-500 transition-colors ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} value={config.hfToken} onChange={(e) => setConfig({ ...config, hfToken: e.target.value })} />
          </section>
        </div>

        {/* Center: STT Core */}
        <section className={`p-4 rounded-[24px] border shadow-xl flex flex-col space-y-3 min-h-0 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center gap-2 border-b pb-2 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
            <div className="bg-amber-600 w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-lg scale-90"><Icons.Mic /></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Transcription</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-slate-500 uppercase">模型規模</label>
              <select className={`w-full border rounded-lg px-2 py-1 text-[9px] font-bold outline-none cursor-pointer focus:border-amber-500 ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} value={config.modelSize} onChange={(e) => setConfig({ ...config, modelSize: e.target.value })}>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="tiny">Tiny (極速)</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="base">Base (平衡)</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="small">Small (精準)</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="medium">Medium (推薦)</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="large-v3-turbo">Large-Turbo</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-slate-500 uppercase">運算裝置</label>
              <select className={`w-full border rounded-lg px-2 py-1 text-[9px] font-bold outline-none cursor-pointer focus:border-amber-500 ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} value={config.device} onChange={(e) => setConfig({ ...config, device: e.target.value })}>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="cpu">CPU (穩定)</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-slate-900'}`} value="cuda">NVIDIA GPU</option>
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 space-y-0.5">
            <label className="text-[8px] font-black text-slate-500 uppercase">專業術語 (Terms)</label>
            <textarea className={`w-full flex-1 border rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none focus:border-amber-500 resize-none ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} placeholder="K8s, PRD..." value={config.customTerms || ''} onChange={(e) => setConfig({ ...config, customTerms: e.target.value })} />
          </div>
        </section>

        {/* Right: AI Intelligence */}
        <section className={`p-4 rounded-[24px] shadow-2xl flex flex-col space-y-3 relative overflow-hidden border min-h-0 transition-colors ${theme === 'dark' ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
          <div className="absolute top-0 right-0 w-20 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className={`flex items-center gap-2 border-b pb-2 relative z-10 ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-xl scale-90 ${theme === 'dark' ? 'bg-white text-black' : 'bg-amber-600 text-white'}`}><Icons.Brain /></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>AI Expert</span>
          </div>

          <div className="space-y-3 flex-1 relative z-10 min-h-0">
            <div className="space-y-1">
              <div className="flex justify-between items-center"><label className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Logic Model</label><button onClick={() => selectModel('logic')} className="text-[8px] font-black text-amber-600 hover:text-amber-500 underline underline-offset-2 transition-colors">選取</button></div>
              <div className={`border rounded-lg p-1.5 text-[8px] font-mono truncate ${theme === 'dark' ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>{config.logicModelPath ? config.logicModelPath.split(/[\\/]/).pop() : '尚未設定'}</div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center"><label className={`text-[8px] font-black uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Polish Model</label><button onClick={() => selectModel('polish')} className="text-[8px] font-black text-amber-600 hover:text-amber-500 underline underline-offset-2 transition-colors">選取</button></div>
              <div className={`border rounded-lg p-1.5 text-[8px] font-mono truncate ${theme === 'dark' ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>{config.polishModelPath ? config.polishModelPath.split(/[\\/]/).pop() : '尚未設定'}</div>
            </div>
            <div className="space-y-1">
              <label className={`text-[8px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Device</label>
              <select className={`w-full border rounded-lg px-2 py-1 text-[9px] font-black outline-none cursor-pointer focus:border-amber-500 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} value={config.llmDevice || 'cpu'} onChange={(e) => setConfig({ ...config, llmDevice: e.target.value })}>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-black'}`} value="cpu">CPU 模式</option>
                <option className={`${theme === 'white' ? 'bg-white text-slate-900' : 'bg-black'}`} value="cuda">GPU 加速</option>
              </select>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
