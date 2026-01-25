import React, { useEffect, useState } from 'react';
import Settings from './Settings';
import icon from './assets/icon.png';

interface LanInfo {
  karaokeIP: string;
  karaokePort: number;
  remoteIP: string;
  remotePort: number;
  remoteQrCode: string; // base64 QR code image
}

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [lanInfo, setLanInfo] = useState<LanInfo | null>(null);
  const [karaokeOpened, setKaraokeOpened] = useState(false); // track if button was clicked

  // Fetch LAN IPs & ports from main process initially
  useEffect(() => {
    (async () => {
      const info: LanInfo = await (window as any).electronAPI.getLanInfo();
      setLanInfo(info);
    })();
  }, []);

  // Auto-update LAN info every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const info: LanInfo = await (window as any).electronAPI.getLanInfo();
      setLanInfo(info);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* APP ICON */}
            <img
              src={icon}
              alt="Virtual Karaoke Icon"
              className="
                w-14 h-14
                rounded-2xl
                shadow-lg
                ring-1 ring-white/10
              "
            />
            <h1 className="text-4xl font-extrabold tracking-wide">
              Virtual Karaoke
            </h1>
          </div>

          <span className="px-4 py-1 rounded-full text-sm bg-green-600">
            LIVE ON LAN
          </span>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LAN URLs Preview */}
          <div className="lg:col-span-2 bg-black rounded-xl border border-gray-700 overflow-hidden shadow-lg p-6 space-y-6">
            {lanInfo ? (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white">🎯 Karaoke URLs</h2>
                  <div className="text-sm text-gray-400 space-y-2">
                    <div>
                      Karaoke View:{' '}
                      <a
                        className="text-blue-400 underline"
                        href={`http://${lanInfo.karaokeIP}:${lanInfo.karaokePort}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        http://{lanInfo.karaokeIP}:{lanInfo.karaokePort}
                      </a>
                    </div>
                    <div>
                      Remote Control:{' '}
                      <a
                        className="text-blue-400 underline"
                        href={`http://${lanInfo.remoteIP}:${lanInfo.remotePort}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        http://{lanInfo.remoteIP}:{lanInfo.remotePort}
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Only one Karaoke View can be active at a time.
                  </p>
                  <p className="text-xs text-gray-500">
                    Access the remote controller via Chrome using the IP address,
                    or scan the QR code from the remote app.
                  </p>
                </div>

                {/* QR CODE SECTION */}
                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">📱 Remote Controller QR Code</h3>
                  <div className="flex flex-col items-center space-y-3">
                    <div className="bg-white p-4 rounded-lg shadow-xl">
                      <img
                        src={lanInfo.remoteQrCode}
                        alt="Remote Controller QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-center max-w-md">
                      Scan this QR code with the Remote app to connect to the remote controller
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col justify-center items-center text-gray-500 py-12">
                <span>Karaoke URLs loading…</span>
              </div>
            )}
          </div>

          {/* CONTROLS */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 space-y-6 shadow-lg">
            <h2 className="text-xl font-semibold">Controls</h2>

            <button
              className="w-full py-4 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
              onClick={() => setShowSettings(true)}
            >
              Open Settings
            </button>

            <button
              className={`w-full py-4 rounded-lg transition ${
                karaokeOpened
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              disabled={karaokeOpened}
              onClick={async () => {
                await (window as any).electronAPI.hostKaraokeView();
                setKaraokeOpened(true); // prevent multiple clicks
              }}
            >
              Open Karaoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
