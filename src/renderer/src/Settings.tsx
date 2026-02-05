import React, { useEffect, useState } from 'react';
import icon from './assets/icon.png';

interface SettingsProps {
  onBack: () => void;
}

const clampPort = (value: number) => Math.min(65535, Math.max(1024, value || 0));

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<any>({
    backgroundPath: '',
    idleMode: 'image',
    idleVideoFiles: [] as string[],
    loopingMusic: false,
    musicFiles: [] as string[],
    customFont: '',
    viewMode: 'fullscreen',
    windowSize: { width: 1920, height: 1080 },
    lanPort: 4545,
    searchPath: '',
    announceKeys: false,
    remotePort: 4646,
  });

  const [ytCookieExists, setYtCookieExists] = useState(false);
  const [ytCookieExpiry, setYtCookieExpiry] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Load saved settings
    (window as any).electronAPI.loadSettings().then((saved: any) => {
      setSettings((prev: any) => ({ ...prev, ...saved }));
    });

    // Check cookie status
    checkYtCookie();
  }, []);

  const checkYtCookie = async () => {
    const status = await (window as any).electronAPI.getYtCookieStatus();
    setYtCookieExists(status.exists);
    setYtCookieExpiry(status.expiry);
  };

  const update = (key: string, value: any) =>
    setSettings((s: any) => ({ ...s, [key]: value }));

  const save = () => {
    const payload = {
      ...settings,
      lanPort: clampPort(settings.lanPort),
      remotePort: clampPort(settings.remotePort),
    };
    (window as any).electronAPI.saveSettings(payload);
    onBack();
  };

  const resetSettings = async () => {
    const confirmed = confirm(
      'Are you sure you want to reset all settings to default values?\n\nThis action cannot be undone.'
    );
    
    if (confirmed) {
      const result = await (window as any).electronAPI.resetSettings();
      if (result) {
        alert('Settings have been reset. The application will restart.');
      }
    }
  };

  const pickFile = async (filters: { name: string; extensions: string[] }[], multi = false) => {
    const paths = await (window as any).electronAPI.openFileDialog({
      properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
      filters,
    });
    return paths || [];
  };

  const pickDirectory = async () => {
    const folder = await (window as any).electronAPI.openDirectoryDialog();
    return folder || '';
  };

  const loginYouTube = async () => {
    setIsLoggingIn(true);
    try {
      const result = await (window as any).electronAPI.loginYouTube();
      if (result.success) {
        await checkYtCookie();
        alert('YouTube login successful! Cookies saved.');
      } else {
        alert('YouTube login failed: ' + result.error);
      }
    } catch (error) {
      alert('YouTube login error: ' + error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const deleteYtCookie = async () => {
    if (confirm('Are you sure you want to delete YouTube cookies?')) {
      await (window as any).electronAPI.deleteYtCookie();
      await checkYtCookie();
      alert('YouTube cookies deleted.');
    }
  };

  // Media management helpers
  const moveItem = (list: string[], index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newList.length) return list;
    
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    return newList;
  };

  const removeItem = (list: string[], index: number) => {
    return list.filter((_, i) => i !== index);
  };

  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <img
            src={icon}
            alt="Virtual Karaoke"
            className="
              w-16 h-16
              rounded-2xl
              shadow-lg
              ring-1 ring-white/10
            "
          />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        
        {/* VISUAL */}
        <Section title="Visual">
          <div>
            <label className="block mb-2">Idle Mode</label>
            <select
              value={settings.idleMode}
              onChange={(e) => update('idleMode', e.target.value)}
              className="bg-gray-800 p-2 rounded w-48"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          
          {settings.idleMode === 'image' && (
            <div className="mt-4">
              <label className="block mb-2">Idle Background Image</label>
              <div className="space-y-2">
                <button
                  className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                  onClick={async () => {
                    const paths = await pickFile([{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]);
                    if (paths.length) update('backgroundPath', paths[0]);
                  }}
                >
                  Select Image
                </button>
                {settings.backgroundPath && (
                  <div className="flex items-center gap-2 bg-gray-800 p-3 rounded">
                    <span className="flex-1 text-sm truncate">{getFileName(settings.backgroundPath)}</span>
                    <button
                      onClick={() => update('backgroundPath', '')}
                      className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700 transition"
                      title="Remove image"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {settings.idleMode === 'video' && (
            <div className="mt-4">
              <label className="block mb-3 font-semibold">Idle Looping Videos</label>
              <button
                className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition mb-3"
                onClick={async () => {
                  const paths = await pickFile([{ name: 'Videos', extensions: ['mp4'] }], true);
                  if (paths.length) update('idleVideoFiles', [...settings.idleVideoFiles, ...paths]);
                }}
              >
                + Add Videos ({settings.idleVideoFiles.length})
              </button>
              
              {settings.idleVideoFiles.length > 0 && (
                <div className="space-y-2 bg-gray-800 p-4 rounded-lg">
                  {settings.idleVideoFiles.map((videoPath: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-700 p-3 rounded">
                      <span className="text-gray-400 font-mono text-sm w-8">{index + 1}.</span>
                      <span className="flex-1 text-sm truncate" title={videoPath}>
                        {getFileName(videoPath)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => update('idleVideoFiles', moveItem(settings.idleVideoFiles, index, 'up'))}
                          disabled={index === 0}
                          className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => update('idleVideoFiles', moveItem(settings.idleVideoFiles, index, 'down'))}
                          disabled={index === settings.idleVideoFiles.length - 1}
                          className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          title="Move down"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => update('idleVideoFiles', removeItem(settings.idleVideoFiles, index))}
                          className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-700 transition"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      if (confirm('Remove all videos?')) {
                        update('idleVideoFiles', []);
                      }
                    }}
                    className="w-full px-3 py-2 bg-red-600 rounded text-sm hover:bg-red-700 transition mt-2"
                  >
                    Clear All Videos
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-4">
            <label className="block mb-2">Custom Font</label>
            <div className="space-y-2">
              <button
                className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                onClick={async () => {
                  const paths = await pickFile([{ name: 'Fonts', extensions: ['ttf'] }]);
                  if (paths.length) update('customFont', paths[0]);
                }}
              >
                Select Font
              </button>
              {settings.customFont && (
                <div className="flex items-center gap-2 bg-gray-800 p-3 rounded">
                  <span className="flex-1 text-sm truncate">{getFileName(settings.customFont)}</span>
                  <button
                    onClick={() => update('customFont', '')}
                    className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700 transition"
                    title="Remove font"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>
        
        {/* AUDIO */}
        <Section title="Audio">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.loopingMusic}
              onChange={(e) => update('loopingMusic', e.target.checked)}
            />
            Loop Idle Music
          </label>
          
          <div className="mt-4">
            <label className="block mb-3 font-semibold">Idle Music Playlist</label>
            <button
              className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition mb-3"
              onClick={async () => {
                const paths = await pickFile([{ name: 'Audio', extensions: ['mp3', 'wav'] }], true);
                if (paths.length) update('musicFiles', [...settings.musicFiles, ...paths]);
              }}
            >
              + Add Songs ({settings.musicFiles.length})
            </button>
            
            {settings.musicFiles.length > 0 && (
              <div className="space-y-2 bg-gray-800 p-4 rounded-lg">
                {settings.musicFiles.map((musicPath: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-700 p-3 rounded">
                    <span className="text-gray-400 font-mono text-sm w-8">{index + 1}.</span>
                    <span className="flex-1 text-sm truncate" title={musicPath}>
                      {getFileName(musicPath)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => update('musicFiles', moveItem(settings.musicFiles, index, 'up'))}
                        disabled={index === 0}
                        className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => update('musicFiles', moveItem(settings.musicFiles, index, 'down'))}
                        disabled={index === settings.musicFiles.length - 1}
                        className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Move down"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => update('musicFiles', removeItem(settings.musicFiles, index))}
                        className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-700 transition"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    if (confirm('Remove all songs?')) {
                      update('musicFiles', []);
                    }
                  }}
                  className="w-full px-3 py-2 bg-red-600 rounded text-sm hover:bg-red-700 transition mt-2"
                >
                  Clear All Songs
                </button>
              </div>
            )}
          </div>
          
          <label className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={settings.announceKeys}
              onChange={(e) => update('announceKeys', e.target.checked)}
            />
            Announce Key Presses
          </label>
        </Section>
        
        {/* WINDOW */}
        <Section title="Window">
          <label className="block mb-2">Karaoke View Mode</label>
          <select
            value={settings.viewMode}
            onChange={(e) => update('viewMode', e.target.value)}
            className="bg-gray-800 p-2 rounded w-48"
          >
            <option value="fullscreen">Fullscreen</option>
            <option value="borderless">Borderless</option>
            <option value="windowed">Windowed</option>
          </select>
          {settings.viewMode === 'windowed' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                className="bg-gray-800 p-2 rounded w-28"
                value={settings.windowSize.width}
                onChange={(e) =>
                  update('windowSize', { ...settings.windowSize, width: +e.target.value })
                }
              />
              <input
                type="number"
                className="bg-gray-800 p-2 rounded w-28"
                value={settings.windowSize.height}
                onChange={(e) =>
                  update('windowSize', { ...settings.windowSize, height: +e.target.value })
                }
              />
            </div>
          )}
        </Section>
        
        {/* NETWORK */}
        <Section title="Network">
          <div>
            <label className="block mb-1">Karaoke View Port</label>
            <input
              type="number"
              className="bg-gray-800 p-2 rounded w-32"
              value={settings.lanPort}
              onChange={(e) => update('lanPort', +e.target.value)}
            />
          </div>
          <div className="mt-2">
            <label className="block mb-1">Remote Controller Port</label>
            <input
              type="number"
              className="bg-gray-800 p-2 rounded w-32"
              value={settings.remotePort}
              onChange={(e) => update('remotePort', +e.target.value)}
            />
          </div>
          <div className="mt-2">
            <label className="block mb-1">Karaoke MP4 Search Folder</label>
            <button
              className="px-4 py-2 bg-blue-500 rounded"
              onClick={async () => {
                const folder = await pickDirectory();
                if (folder) update('searchPath', folder);
              }}
            >
              Select Folder {settings.searchPath ? `(Selected: ${settings.searchPath})` : ''}
            </button>
          </div>
        </Section>
        
        {/* YOUTUBE AUTHENTICATION */}
        <Section title="YouTube Authentication">
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Login to YouTube to download age-restricted and members-only content.
            </p>
            {ytCookieExists ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">Logged in to YouTube</span>
                </div>
                {ytCookieExpiry && (
                  <p className="text-sm text-gray-400">
                    Cookie expires: {new Date(ytCookieExpiry).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={deleteYtCookie}
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                >
                  Delete Cookies
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>Not logged in</span>
                </div>
                <button
                  onClick={loginYouTube}
                  disabled={isLoggingIn}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? 'Logging in...' : 'Login to YouTube'}
                </button>
              </div>
            )}
          </div>
        </Section>
        
        {/* ACTIONS */}
        <div className="flex gap-4 pt-6 pb-8">
          <button
            onClick={save}
            className="px-8 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition"
          >
            Save
          </button>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={resetSettings}
            className="px-8 py-3 bg-red-600 rounded-lg hover:bg-red-700 transition ml-auto"
          >
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

// Reusable Section Component
const Section = ({ title, children }: any) => (
  <div className="bg-gray-800 rounded-xl p-6 space-y-4 border border-gray-700">
    <h2 className="text-xl font-semibold">{title}</h2>
    {children}
  </div>
);
