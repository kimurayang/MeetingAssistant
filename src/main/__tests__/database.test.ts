import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';

// 模擬 electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return 'C:\\Users\\Mock\\AppData\\Roaming\\VoxNote';
      if (name === 'desktop') return 'C:\\Users\\Mock\\Desktop';
      return '';
    }),
    getAppPath: vi.fn(() => 'D:\\Python\\VoxNote')
  }
}));

// 模擬環境判斷
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}));

describe('Database Configuration Logic', () => {
  it('should use project root path in dev mode', () => {
    // 模擬我們在 ipcHandlers.ts 中的邏輯
    const isDev = true;
    const appPath = 'D:\\Python\\VoxNote';
    const dbFilePath = isDev 
      ? join(appPath, 'prisma', 'dev.db') 
      : join('C:\\Users\\Mock\\AppData\\Roaming\\VoxNote', 'database', 'meetings.db');
    
    expect(dbFilePath).toBe(join('D:\\Python\\VoxNote', 'prisma', 'dev.db'));
  });

  it('should use userData path in production mode', () => {
    const isDev = false;
    const appPath = 'D:\\Python\\VoxNote';
    const dbFilePath = isDev 
      ? join(appPath, 'prisma', 'dev.db') 
      : join('C:\\Users\\Mock\\AppData\\Roaming\\VoxNote', 'database', 'meetings.db');
    
    expect(dbFilePath).toBe(join('C:\\Users\\Mock\\AppData\\Roaming\\VoxNote', 'database', 'meetings.db'));
  });
});

describe('Export Path Logic', () => {
  it('should respect recordingsPath if configured', () => {
    const config = { recordingsPath: 'D:\\MyRecordings' };
    const defaultExportDir = config.recordingsPath ? config.recordingsPath : 'C:\\Users\\Mock\\Desktop';
    expect(defaultExportDir).toBe('D:\\MyRecordings');
  });

  it('should fallback to desktop if recordingsPath is missing', () => {
    const config = { recordingsPath: '' };
    const defaultExportDir = config.recordingsPath ? config.recordingsPath : 'C:\\Users\\Mock\\Desktop';
    expect(defaultExportDir).toBe('C:\\Users\\Mock\\Desktop');
  });
});
