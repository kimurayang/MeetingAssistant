export function exportToMarkdown(meeting: any, segments: any[], summary: any) {
  let content = `# 會議紀錄: ${meeting.title}\n`
  content += `日期: ${new Date(meeting.date).toLocaleString()}\n\n`
  
  if (summary) {
    content += `## 會議摘要\n${summary.overview}\n\n`
    content += `## 決策事項\n${summary.decisions.map((d: string) => `- ${d}`).join('\n')}\n\n`
    content += `## 待辦事項\n${summary.actionItems.map((a: string) => `- ${a}`).join('\n')}\n\n`
  }
  
  content += `## 詳細逐字稿\n`
  segments.forEach(s => {
    content += `**${s.speaker}**: ${s.content}\n\n`
  })
  
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${meeting.title}.md`
  a.click()
}

export function exportToText(meeting: any, segments: any[]) {
  let content = `會議紀錄: ${meeting.title}\n`
  content += `日期: ${new Date(meeting.date).toLocaleString()}\n\n`
  
  segments.forEach(s => {
    content += `[${s.speaker}]: ${s.content}\n`
  })
  
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${meeting.title}.txt`
  a.click()
}
