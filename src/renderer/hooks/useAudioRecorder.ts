import { useState, useRef, useCallback } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0))
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyzer = useRef<AnalyserNode | null>(null)
  const dataArray = useRef<Uint8Array | null>(null)
  const animationFrame = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async (mode: 'mic' | 'system' = 'mic', onStopCallback?: (blob: Blob) => void) => {
    try {
      let combinedStream: MediaStream
      
      if (mode === 'system') {
        // 1. 獲取螢幕分享流（包含影像與系統音訊）
        const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true, 
          audio: true
        })
        
        // 2. 檢查是否有音訊軌
        const systemAudioTracks = displayStream.getAudioTracks()
        if (systemAudioTracks.length === 0) {
          displayStream.getTracks().forEach(t => t.stop())
          alert('請務必勾選「分享系統音效」才能錄製會議聲音！')
          return
        }

        // 3. 為了避免影像處理錯誤，我們只取音訊軌，並建立一個純音訊流
        // 同時可以把麥克風也混進來 (選配，目前先只取系統音)
        combinedStream = new MediaStream([systemAudioTracks[0]])
        
        // 4. 立即停止不需要的影像軌，節省資源並避免 log 噴錯
        displayStream.getVideoTracks().forEach(t => t.stop())
      } else {
        // 一般麥克風錄音
        combinedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }

      streamRef.current = combinedStream
      
      // 使用瀏覽器支援的音訊格式
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/ogg;codecs=opus'
        
      mediaRecorder.current = new MediaRecorder(combinedStream, { mimeType })
      
      if (!audioContext.current || audioContext.current.state === 'closed') {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume()
      }

      const source = audioContext.current.createMediaStreamSource(combinedStream)
      analyzer.current = audioContext.current.createAnalyser()
      analyzer.current.fftSize = 64
      source.connect(analyzer.current)
      dataArray.current = new Uint8Array(analyzer.current.frequencyBinCount)

      const updateFrequencyData = () => {
        if (analyzer.current && dataArray.current) {
          analyzer.current.getByteFrequencyData(dataArray.current)
          setAudioData(new Uint8Array(dataArray.current))
          animationFrame.current = requestAnimationFrame(updateFrequencyData)
        }
      }
      updateFrequencyData()

      const chunks: Blob[] = []
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.current.onstop = () => {
        // 注意：雖然副檔名我們在後端給 .wav，但內容其實是 webm/opus
        // 現代的 FFmpeg (Faster-Whisper 底層) 是可以識別並處理的
        const blob = new Blob(chunks, { type: mimeType })
        if (onStopCallback) onStopCallback(blob)
        console.log('Recording stopped. Total size:', blob.size)
      }

      mediaRecorder.current.start(1000) // 每秒觸發一次 dataavailable 確保資料寫入
      setIsRecording(true)
      setRecordingTime(0)
      timerInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      alert('無法啟動錄音，請檢查權限或是否取消了分享。')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      setIsRecording(false)
      
      if (timerInterval.current) clearInterval(timerInterval.current)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      setAudioData(new Uint8Array(0))
    }
  }, [isRecording])

  return {
    isRecording,
    recordingTime,
    audioData,
    startRecording,
    stopRecording
  }
}
