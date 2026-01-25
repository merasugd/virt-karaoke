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

  useEffect(() => {
    // Load saved settings
    (window as any).electronAPI.loadSettings().then((saved: any) => {
      setSettings((prev: any) => ({ ...prev, ...saved }));
    });
  }, []);

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
              <button
                className="px-4 py-2 bg-blue-500 rounded"
                onClick={async () => {
                  const paths = await pickFile([{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]);
                  if (paths.length) update('backgroundPath', paths[0]);
                }}
              >
                Select Image {settings.backgroundPath ? `(Selected: ${settings.backgroundPath})` : ''}
              </button>
            </div>
          )}
          {settings.idleMode === 'video' && (
            <div className="mt-4">
              <label className="block mb-2">Idle Looping Videos</label>
              <button
                className="px-4 py-2 bg-blue-500 rounded"
                onClick={async () => {
                  const paths = await pickFile([{ name: 'Videos', extensions: ['mp4'] }], true);
                  if (paths.length) update('idleVideoFiles', [...settings.idleVideoFiles, ...paths]);
                }}
              >
                Import Videos {settings.idleVideoFiles.length ? `(${settings.idleVideoFiles.length})` : ''}
              </button>
            </div>
          )}
          <div>
            <label className="block mb-2 mt-4">Custom Font</label>
            <button
              className="px-4 py-2 bg-blue-500 rounded"
              onClick={async () => {
                const paths = await pickFile([{ name: 'Fonts', extensions: ['ttf'] }]);
                if (paths.length) update('customFont', paths[0]);
              }}
            >
              Select Font {settings.customFont ? `(Selected: ${settings.customFont})` : ''}
            </button>
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
          <div className="mt-2">
            <button
              className="px-4 py-2 bg-blue-500 rounded"
              onClick={async () => {
                const paths = await pickFile([{ name: 'Audio', extensions: ['mp3', 'wav'] }], true);
                if (paths.length) update('musicFiles', [...settings.musicFiles, ...paths]);
              }}
            >
              Import Songs {settings.musicFiles.length ? `(${settings.musicFiles.length})` : ''}
            </button>
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
        {/* ACTIONS */}
        <div className="flex gap-4 pt-6">
          <button
            onClick={save}
            className="px-8 py-3 bg-green-600 rounded-lg hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            Cancel
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
