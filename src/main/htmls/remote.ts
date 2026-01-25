import ejs from 'ejs';

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karaoke Remote Controller</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * {
      -webkit-tap-highlight-color: transparent;
    }

    body {
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      height: 100vh;
      overflow: hidden;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-height: 100vh;
    }

    .content-area {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .tab-active {
      border-bottom-color: rgb(209 213 219);
      color: white;
      font-weight: 600;
    }

    .tab-inactive {
      border-bottom-color: transparent;
      color: rgb(156 163 175);
    }

    #current-code-display {
      font-size: 2rem;
      letter-spacing: 0.5rem;
      text-align: center;
      margin-bottom: 1rem;
      font-weight: bold;
      font-variant-numeric: tabular-nums;
    }

    /* Tab animations */
    .tab-content {
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .tab-hidden {
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
      position: absolute;
      width: 100%;
      visibility: hidden;
    }

    .tab-visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
      position: relative;
      visibility: visible;
    }

    /* Button press feedback */
    button:active {
      transform: scale(0.95);
    }

    button {
      transition: all 0.15s ease;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading spinner */
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 0.8s linear infinite;
      display: inline-block;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Status indicator */
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 0.5rem;
      transition: background-color 0.3s ease;
    }

    .status-dot.connected {
      background-color: #22c55e;
      box-shadow: 0 0 8px #22c55e;
    }

    .status-dot.disconnected {
      background-color: #ef4444;
    }

    .status-dot.connecting {
      background-color: #eab308;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Search input focus */
    #search-query:focus,
    #download-search-query:focus {
      outline: none;
      ring: 2px;
      ring-color: rgb(59 130 246);
    }

    /* Queue display */
    #queue-display {
      font-size: 0.875rem;
      color: rgb(156 163 175);
      text-align: center;
      margin-bottom: 0.5rem;
      min-height: 1.25rem;
    }

    /* Modal/Dialog */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .modal-overlay.show {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-content {
      background: rgb(31 41 55);
      border-radius: 1rem;
      padding: 2rem;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      transform: scale(0.9);
      transition: transform 0.3s ease;
    }

    .modal-overlay.show .modal-content {
      transform: scale(1);
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 1rem;
      color: #ef4444;
    }

    .modal-message {
      margin-bottom: 1.5rem;
      color: rgb(209 213 219);
      line-height: 1.5;
    }

    .modal-buttons {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    /* Songbook Styles */
    .songbook-container {
      font-size: 0.8125rem;
      line-height: 1.4;
      max-height: 400px;
      overflow-y: auto;
    }

    .song-section {
      margin-bottom: 1rem;
    }

    .section-header {
      position: sticky;
      top: 0;
      background: rgb(31 41 55);
      padding: 0.5rem 0.75rem;
      font-weight: bold;
      font-size: 1rem;
      color: #60a5fa;
      border-bottom: 2px solid rgb(55 65 81);
      z-index: 10;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .song-item {
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgb(55 65 81);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .song-item:hover {
      background: rgb(55 65 81);
    }

    .song-item:active {
      background: rgb(75 85 99);
    }

    .song-id {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #fbbf24;
      min-width: 3.5rem;
      font-size: 0.75rem;
      flex-shrink: 0;
    }

    .song-info {
      flex: 1;
      min-width: 0;
      padding: 0 0.5rem;
    }

    .song-title {
      font-weight: 600;
      color: rgb(243 244 246);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.125rem;
    }

    .song-artist {
      color: rgb(156 163 175);
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .delete-btn {
      padding: 0.375rem 0.75rem;
      background: rgb(185 28 28);
      color: white;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s ease;
      flex-shrink: 0;
      margin-left: 0.5rem;
    }

    .delete-btn:hover {
      background: rgb(220 38 38);
    }

    .delete-btn:active {
      background: rgb(153 27 27);
    }

    /* Letter navigation */
    .letter-nav-btn {
      padding: 0.375rem 0.625rem;
      background: rgb(55 65 81);
      color: rgb(156 163 175);
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }

    .letter-nav-btn:hover {
      background: rgb(75 85 99);
      color: white;
    }

    .letter-nav-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #60a5fa;
    }

    /* Pagination */
    .pagination-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: rgb(31 41 55);
      border-top: 1px solid rgb(55 65 81);
    }

    .page-btn {
      padding: 0.5rem 0.75rem;
      background: rgb(55 65 81);
      color: rgb(209 213 219);
      border-radius: 0.5rem;
      font-size: 0.875rem;
      min-width: 2.5rem;
      transition: all 0.15s ease;
    }

    .page-btn:hover:not(:disabled) {
      background: rgb(75 85 99);
    }

    .page-btn.active {
      background: #3b82f6;
      color: white;
    }

    .page-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* Download Progress */
    .download-item {
      background: rgb(55 65 81);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .download-title {
      font-weight: 600;
      color: rgb(243 244 246);
      margin-bottom: 0.25rem;
    }

    .download-artist {
      font-size: 0.875rem;
      color: rgb(156 163 175);
      margin-bottom: 0.5rem;
    }

    .progress-bar {
      width: 100%;
      height: 0.5rem;
      background: rgb(31 41 55);
      border-radius: 0.25rem;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      transition: width 0.3s ease;
    }

    .download-status {
      font-size: 0.75rem;
      color: rgb(156 163 175);
      display: flex;
      justify-content: space-between;
    }

    /* Scrollbar styling */
    .songbook-container::-webkit-scrollbar,
    .content-area::-webkit-scrollbar {
      width: 8px;
    }

    .songbook-container::-webkit-scrollbar-track,
    .content-area::-webkit-scrollbar-track {
      background: rgb(31 41 55);
      border-radius: 4px;
    }

    .songbook-container::-webkit-scrollbar-thumb,
    .content-area::-webkit-scrollbar-thumb {
      background: rgb(75 85 99);
      border-radius: 4px;
    }

    .songbook-container::-webkit-scrollbar-thumb:hover,
    .content-area::-webkit-scrollbar-thumb:hover {
      background: rgb(107 114 128);
    }
  </style>
</head>

<body class="bg-gray-900 text-gray-200">
  <div class="app-container">
    <!-- Header (fixed) -->
    <div class="p-4 pb-0">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-3xl font-bold text-center flex-1">🎤 Karaoke Remote</h1>
        <div class="flex items-center">
          <span class="status-dot" id="status-dot"></span>
        </div>
      </div>

      <!-- Code Display -->
      <div id="current-code-display">000000</div>

      <!-- Queue Display -->
      <div id="queue-display"></div>

      <!-- Status Message -->
      <div id="status-message" class="text-center text-sm text-gray-400 mb-4 min-h-[20px]"></div>

      <!-- TABS -->
      <div class="flex mb-6 border-b border-gray-700">
        <button id="tab-remote" class="flex-1 py-3 font-semibold tab-active transition-colors">Remote</button>
        <button id="tab-songlist" class="flex-1 py-3 font-semibold tab-inactive transition-colors">Songs</button>
        <button id="tab-download" class="flex-1 py-3 font-semibold tab-inactive transition-colors">Download</button>
        <button id="tab-advanced" class="flex-1 py-3 font-semibold tab-inactive transition-colors">Advanced</button>
      </div>
    </div>

    <!-- Content Area (scrollable) -->
    <div class="content-area px-4 pb-8">
      <!-- REMOTE TAB -->
      <div id="remote-tab" class="tab-content tab-visible">
        <div class="grid grid-cols-3 gap-4 mb-6">
          <% for (let i = 1; i <= 9; i++) { %>
            <button
              class="px-5 py-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-3xl font-bold rounded-lg"
              data-digit="<%= i %>"
              onclick="sendDigit('<%= i %>')">
              <%= i %>
            </button>
          <% } %>

          <button
            class="px-5 py-6 bg-red-800 hover:bg-red-700 active:bg-red-600 text-3xl font-bold rounded-lg col-span-2"
            onclick="deleteDigit()">
            ← Delete
          </button>

          <button
            class="px-5 py-6 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-3xl font-bold rounded-lg"
            data-digit="0"
            onclick="sendDigit('0')">
            0
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <button
            id="btn-enter"
            class="py-4 bg-green-700 hover:bg-green-600 active:bg-green-500 text-xl font-semibold rounded-lg"
            onclick="enterSong()">
            Enter Song
          </button>

          <button
            id="btn-skip"
            class="py-4 bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-500 text-xl font-semibold rounded-lg"
            onclick="skipSong()">
            Skip Current Song
          </button>
        </div>
      </div>

      <!-- SONG LIST TAB -->
      <div id="songlist-tab" class="tab-content tab-hidden flex flex-col">
        <!-- Search Bar -->
        <div class="relative mb-3">
          <input
            id="search-query"
            type="text"
            placeholder="Search by title or artist..."
            class="w-full bg-gray-800 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div id="search-spinner" class="absolute right-3 top-1/2 -translate-y-1/2 hidden">
            <div class="spinner"></div>
          </div>
        </div>

        <!-- Sort and Filter Options -->
        <div class="flex gap-2 mb-3 flex-wrap">
          <select id="sort-by" class="bg-gray-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="title-asc">Title (A→Z)</option>
            <option value="title-desc">Title (Z→A)</option>
            <option value="artist-asc">Artist (A→Z)</option>
            <option value="artist-desc">Artist (Z→A)</option>
            <option value="id-asc">Song ID (Low→High)</option>
            <option value="id-desc">Song ID (High→Low)</option>
          </select>

          <select id="filter-letter" class="bg-gray-800 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Letters</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
            <option value="H">H</option>
            <option value="I">I</option>
            <option value="J">J</option>
            <option value="K">K</option>
            <option value="L">L</option>
            <option value="M">M</option>
            <option value="N">N</option>
            <option value="O">O</option>
            <option value="P">P</option>
            <option value="Q">Q</option>
            <option value="R">R</option>
            <option value="S">S</option>
            <option value="T">T</option>
            <option value="U">U</option>
            <option value="V">V</option>
            <option value="W">W</option>
            <option value="X">X</option>
            <option value="Y">Y</option>
            <option value="Z">Z</option>
            <option value="0-9">#</option>
          </select>

          <input
            id="page-jump"
            type="number"
            min="1"
            placeholder="Page"
            class="bg-gray-800 px-3 py-2 rounded-lg text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>

        <!-- Letter Navigation -->
        <div id="letter-nav" class="flex flex-wrap gap-1 mb-3 justify-center">
          <button class="letter-nav-btn active" data-letter="">All</button>
          <button class="letter-nav-btn" data-letter="A">A</button>
          <button class="letter-nav-btn" data-letter="B">B</button>
          <button class="letter-nav-btn" data-letter="C">C</button>
          <button class="letter-nav-btn" data-letter="D">D</button>
          <button class="letter-nav-btn" data-letter="E">E</button>
          <button class="letter-nav-btn" data-letter="F">F</button>
          <button class="letter-nav-btn" data-letter="G">G</button>
          <button class="letter-nav-btn" data-letter="H">H</button>
          <button class="letter-nav-btn" data-letter="I">I</button>
          <button class="letter-nav-btn" data-letter="J">J</button>
          <button class="letter-nav-btn" data-letter="K">K</button>
          <button class="letter-nav-btn" data-letter="L">L</button>
          <button class="letter-nav-btn" data-letter="M">M</button>
          <button class="letter-nav-btn" data-letter="N">N</button>
          <button class="letter-nav-btn" data-letter="O">O</button>
          <button class="letter-nav-btn" data-letter="P">P</button>
          <button class="letter-nav-btn" data-letter="Q">Q</button>
          <button class="letter-nav-btn" data-letter="R">R</button>
          <button class="letter-nav-btn" data-letter="S">S</button>
          <button class="letter-nav-btn" data-letter="T">T</button>
          <button class="letter-nav-btn" data-letter="U">U</button>
          <button class="letter-nav-btn" data-letter="V">V</button>
          <button class="letter-nav-btn" data-letter="W">W</button>
          <button class="letter-nav-btn" data-letter="X">X</button>
          <button class="letter-nav-btn" data-letter="Y">Y</button>
          <button class="letter-nav-btn" data-letter="Z">Z</button>
          <button class="letter-nav-btn" data-letter="0-9">#</button>
        </div>

        <!-- Song List -->
        <div id="song-list" class="bg-gray-800 rounded-lg songbook-container mb-3">
          <div class="p-3 text-gray-400 text-sm">Loading songs...</div>
        </div>

        <!-- Pagination Controls -->
        <div class="pagination-controls">
          <button id="btn-first-page" class="page-btn" onclick="goToPage(1)">«</button>
          <button id="btn-prev-page" class="page-btn" onclick="goToPrevPage()">‹</button>
          <span id="page-info" class="text-sm text-gray-400">Page 1 of 1</span>
          <button id="btn-next-page" class="page-btn" onclick="goToNextPage()">›</button>
          <button id="btn-last-page" class="page-btn" onclick="goToLastPage()">»</button>
        </div>

        <!-- Song Count -->
        <div id="song-count" class="text-center text-xs text-gray-400 mt-2"></div>
      </div>

      <!-- DOWNLOAD TAB -->
      <div id="download-tab" class="tab-content tab-hidden flex flex-col">
        <!-- Download Sub-Tabs -->
        <div class="flex mb-4 border-b border-gray-700">
          <button id="download-subtab-search" class="flex-1 py-2.5 text-sm font-semibold tab-active transition-colors">Search</button>
          <button id="download-subtab-downloaded" class="flex-1 py-2.5 text-sm font-semibold tab-inactive transition-colors">Downloaded</button>
        </div>

        <!-- SEARCH SUB-TAB -->
        <div id="download-search-section" class="flex flex-col">
          <div class="bg-gray-800 rounded-lg p-6 mb-4">
            <h2 class="text-xl font-bold mb-4 text-blue-400">📥 Download Songs</h2>

            <!-- Search Bar -->
            <div class="relative mb-3">
              <input
                id="download-search-query"
                type="text"
                placeholder="Search for songs to download..."
                class="w-full bg-gray-700 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <div id="download-search-spinner" class="absolute right-3 top-1/2 -translate-y-1/2 hidden">
                <div class="spinner"></div>
              </div>
            </div>

            <!-- Search Results -->
            <div id="download-search-results" class="bg-gray-900 rounded-lg songbook-container mb-3" style="max-height: 300px;">
              <div class="p-3 text-gray-400 text-sm text-center">Search for songs above</div>
            </div>

            <!-- Pagination -->
            <div class="pagination-controls mb-4">
              <button id="btn-download-first-page" class="page-btn" onclick="goToDownloadPage(1)">«</button>
              <button id="btn-download-prev-page" class="page-btn" onclick="goToDownloadPrevPage()">‹</button>
              <span id="download-page-info" class="text-sm text-gray-400">Page 1 of 1</span>
              <button id="btn-download-next-page" class="page-btn" onclick="goToDownloadNextPage()">›</button>
              <button id="btn-download-last-page" class="page-btn" onclick="goToDownloadLastPage()">»</button>
            </div>
          </div>

          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="font-semibold mb-3 text-gray-300">Active Downloads</h3>
            <div id="downloads-list" class="space-y-3">
              <div class="text-sm text-gray-400 text-center py-4">No active downloads</div>
            </div>
          </div>
        </div>

        <!-- DOWNLOADED SUB-TAB -->
        <div id="download-downloaded-section" class="flex flex-col tab-hidden">
          <div class="bg-gray-800 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-green-400">✅ Downloaded Songs</h2>
              <button
                id="btn-refresh-downloaded"
                class="px-4 py-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-500 text-sm font-semibold rounded-lg"
                onclick="refreshDownloadedSongs()">
                🔄 Refresh
              </button>
            </div>

            <!-- Downloaded Songs List -->
            <div id="downloaded-songs-list" class="bg-gray-900 rounded-lg songbook-container" style="max-height: 400px;">
              <div class="p-3 text-gray-400 text-sm text-center">Loading downloaded songs...</div>
            </div>

            <!-- Downloaded Songs Count -->
            <div id="downloaded-count" class="text-center text-xs text-gray-400 mt-3"></div>
          </div>
        </div>
      </div>

      <!-- ADVANCED TAB -->
      <div id="advanced-tab" class="tab-content tab-hidden flex flex-col gap-4">
        <div class="bg-gray-800 rounded-lg p-6">
          <h2 class="text-xl font-bold mb-4 text-red-400">⚠️ Danger Zone</h2>

          <div class="mb-6">
            <h3 class="font-semibold mb-2 text-gray-300">System Shutdown</h3>
            <p class="text-sm text-gray-400 mb-4">
              This will completely shut down the karaoke system. All active sessions will be terminated.
            </p>
            <button
              id="btn-shutdown"
              class="w-full py-4 bg-red-700 hover:bg-red-600 active:bg-red-500 text-xl font-semibold rounded-lg"
              onclick="confirmShutdown()">
              🔌 Shutdown System
            </button>
          </div>

          <div class="border-t border-gray-700 pt-6">
            <h3 class="font-semibold mb-2 text-gray-300">Connection Info</h3>
            <div class="text-sm text-gray-400 space-y-1">
              <p>Host: <%= IP %></p>
              <p>WebSocket Port: <%= WS_PORT %></p>
              <p>API Port: 5151</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Modal (Shutdown) -->
  <div id="shutdown-modal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-title">⚠️ Confirm Shutdown</div>
      <div class="modal-message">
        Are you sure you want to shut down the karaoke system?
        <br><br>
        This will:
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>Stop all playback</li>
          <li>Close all connections</li>
          <li>Exit the application</li>
        </ul>
      </div>
      <div class="modal-buttons">
        <button
          class="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold"
          onclick="hideShutdownModal()">
          Cancel
        </button>
        <button
          class="px-6 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-semibold"
          onclick="executeShutdown()">
          Shutdown
        </button>
      </div>
    </div>
  </div>

  <!-- Download Confirmation Modal -->
  <div id="download-confirm-modal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-title" style="color: #3b82f6;">📥 Confirm Download</div>
      <div class="modal-message">
        <div id="download-confirm-title" class="font-bold text-lg mb-1"></div>
        <div id="download-confirm-artist" class="text-gray-400 mb-3"></div>
        <p>Do you want to download this song?</p>
      </div>
      <div class="modal-buttons">
        <button
          class="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold"
          onclick="hideDownloadConfirmModal()">
          Cancel
        </button>
        <button
          class="px-6 py-3 bg-blue-700 hover:bg-blue-600 rounded-lg font-semibold"
          onclick="confirmDownload()">
          Download
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div id="delete-confirm-modal" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-title">🗑️ Confirm Delete</div>
      <div class="modal-message">
        <div id="delete-confirm-title" class="font-bold text-lg mb-1"></div>
        <div id="delete-confirm-artist" class="text-gray-400 mb-3"></div>
        <p>Are you sure you want to delete this downloaded song?</p>
        <p class="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
      </div>
      <div class="modal-buttons">
        <button
          class="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold"
          onclick="hideDeleteConfirmModal()">
          Cancel
        </button>
        <button
          class="px-6 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-semibold"
          onclick="confirmDelete()">
          Delete
        </button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';

      // ==================== CONFIGURATION ====================
      const CONFIG = {
        HOST_IP: '<%= IP %>',
        WS_PORT: '<%= WS_PORT %>',
        API_URL: 'http://<%= IP %>:5151/action',
        QUERY_URL: 'http://<%= IP %>:5151/query-song',
        SHUTDOWN_URL: 'http://<%= IP %>:5151/shutdown',
        DOWNLOADED_LIST_URL: 'http://<%= IP %>:5151/downloaded-songs',
        DELETE_SONG_URL: 'http://<%= IP %>:5151/delete-song',
        DIGIT_DEBOUNCE_MS: 150,
        SEARCH_DEBOUNCE_MS: 500,  // Increased from 300ms to 500ms
        DOWNLOAD_SEARCH_DEBOUNCE_MS: 800,  // Longer debounce for external API
        REQUEST_TIMEOUT_MS: 15000,  // Increased from 5000ms to 15000ms
        DOWNLOAD_SEARCH_TIMEOUT_MS: 30000,  // 30 seconds for download search
        MAX_CODE_LENGTH: 6,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        MAX_RECONNECT_ATTEMPTS: 20,
        RECONNECT_BASE_DELAY: 1000,
        RECONNECT_MAX_DELAY: 30000,
        SONGS_PER_PAGE: 50,
        DOWNLOAD_RESULTS_PER_PAGE: 20,
        MIN_SEARCH_CHARS: 2  // Minimum characters before searching
      };

      // ==================== STATE ====================
      const state = {
        localCode: '',
        serverCode: '',
        queue: [],
        currentState: 'idle',
        isConnected: false,
        wsConnected: false,
        isProcessing: false,
        lastDigitPress: { digit: null, time: 0 },
        searchTimeout: null,
        lastSearchQuery: '',
        songCache: [],
        allSongs: [],
        filteredSongs: [],
        reconnectAttempts: 0,
        reconnectDelay: CONFIG.RECONNECT_BASE_DELAY,
        currentSort: 'title-asc',
        currentFilter: '',
        currentPage: 1,
        totalPages: 1,
        downloads: {},
        downloadSearchResults: [],
        downloadSearchQuery: '',
        downloadSearchTimeout: null,
        downloadCurrentPage: 1,
        downloadTotalPages: 1,
        pendingDownload: null,
        downloadedSongs: [],
        pendingDelete: null,
        isSearching: false,  // Track if song search is in progress
        isDownloadSearching: false,  // Track if download search is in progress
        lastDownloadSearchQuery: '',  // Track last download search to avoid duplicates
        downloadSearchAbortController: null  // For cancelling download searches
      };

      // ==================== DOM ELEMENTS ====================
      const DOM = {
        codeDisplay: document.getElementById('current-code-display'),
        queueDisplay: document.getElementById('queue-display'),
        statusMessage: document.getElementById('status-message'),
        statusDot: document.getElementById('status-dot'),
        searchQuery: document.getElementById('search-query'),
        searchSpinner: document.getElementById('search-spinner'),
        songList: document.getElementById('song-list'),
        songCount: document.getElementById('song-count'),
        btnEnter: document.getElementById('btn-enter'),
        btnSkip: document.getElementById('btn-skip'),
        btnShutdown: document.getElementById('btn-shutdown'),
        remoteTab: document.getElementById('remote-tab'),
        songlistTab: document.getElementById('songlist-tab'),
        downloadTab: document.getElementById('download-tab'),
        advancedTab: document.getElementById('advanced-tab'),
        tabRemote: document.getElementById('tab-remote'),
        tabSonglist: document.getElementById('tab-songlist'),
        tabDownload: document.getElementById('tab-download'),
        tabAdvanced: document.getElementById('tab-advanced'),
        shutdownModal: document.getElementById('shutdown-modal'),
        sortBy: document.getElementById('sort-by'),
        filterLetter: document.getElementById('filter-letter'),
        letterNav: document.getElementById('letter-nav'),
        pageInfo: document.getElementById('page-info'),
        btnFirstPage: document.getElementById('btn-first-page'),
        btnPrevPage: document.getElementById('btn-prev-page'),
        btnNextPage: document.getElementById('btn-next-page'),
        btnLastPage: document.getElementById('btn-last-page'),
        pageJump: document.getElementById('page-jump'),
        downloadsList: document.getElementById('downloads-list'),
        downloadSearchQuery: document.getElementById('download-search-query'),
        downloadSearchSpinner: document.getElementById('download-search-spinner'),
        downloadSearchResults: document.getElementById('download-search-results'),
        downloadPageInfo: document.getElementById('download-page-info'),
        btnDownloadFirstPage: document.getElementById('btn-download-first-page'),
        btnDownloadPrevPage: document.getElementById('btn-download-prev-page'),
        btnDownloadNextPage: document.getElementById('btn-download-next-page'),
        btnDownloadLastPage: document.getElementById('btn-download-last-page'),
        downloadConfirmModal: document.getElementById('download-confirm-modal'),
        downloadConfirmTitle: document.getElementById('download-confirm-title'),
        downloadConfirmArtist: document.getElementById('download-confirm-artist'),
        downloadSubtabSearch: document.getElementById('download-subtab-search'),
        downloadSubtabDownloaded: document.getElementById('download-subtab-downloaded'),
        downloadSearchSection: document.getElementById('download-search-section'),
        downloadDownloadedSection: document.getElementById('download-downloaded-section'),
        downloadedSongsList: document.getElementById('downloaded-songs-list'),
        downloadedCount: document.getElementById('downloaded-count'),
        btnRefreshDownloaded: document.getElementById('btn-refresh-downloaded'),
        deleteConfirmModal: document.getElementById('delete-confirm-modal'),
        deleteConfirmTitle: document.getElementById('delete-confirm-title'),
        deleteConfirmArtist: document.getElementById('delete-confirm-artist')
      };

      // ==================== UTILITY FUNCTIONS ====================
      function log(...args) {
        console.log('[RemoteController]', ...args);
      }

      function warn(...args) {
        console.warn('[RemoteController]', ...args);
      }

      function error(...args) {
        console.error('[RemoteController]', ...args);
      }

      function updateConnectionStatus(connected, connecting = false) {
        state.isConnected = connected;

        if (DOM.statusDot) {
          DOM.statusDot.classList.toggle('connected', connected && !connecting);
          DOM.statusDot.classList.toggle('disconnected', !connected && !connecting);
          DOM.statusDot.classList.toggle('connecting', connecting);
        }
      }

      function showStatus(message, duration = 3000) {
        if (!DOM.statusMessage) return;

        DOM.statusMessage.textContent = message;
        DOM.statusMessage.style.opacity = '1';

        setTimeout(() => {
          DOM.statusMessage.style.opacity = '0';
        }, duration);
      }

      function updateCodeDisplay(code) {
        if (DOM.codeDisplay) {
          DOM.codeDisplay.textContent = String(code).padStart(CONFIG.MAX_CODE_LENGTH, '0');
        }
      }

      function updateQueueDisplay(queue) {
        if (!DOM.queueDisplay) return;

        if (queue && queue.length > 0) {
          DOM.queueDisplay.textContent = 'Queue: ' + queue.join(' → ');
        } else {
          DOM.queueDisplay.textContent = 'Queue: Empty';
        }
      }

      function setProcessing(processing) {
        state.isProcessing = processing;

        // Disable/enable all buttons
        document.querySelectorAll('button[data-digit], #btn-enter, #btn-skip').forEach(btn => {
          btn.disabled = processing || !state.wsConnected;
        });
      }

      function getFirstLetter(text) {
        const char = (text || '').trim().charAt(0).toUpperCase();
        return /[A-Z]/.test(char) ? char : '0-9';
      }

      // ==================== MODAL FUNCTIONS ====================
      function showShutdownModal() {
        if (DOM.shutdownModal) {
          DOM.shutdownModal.classList.add('show');
        }
      }

      function hideShutdownModal() {
        if (DOM.shutdownModal) {
          DOM.shutdownModal.classList.remove('show');
        }
      }

      function showDownloadConfirmModal(title, artist) {
        if (DOM.downloadConfirmModal) {
          DOM.downloadConfirmTitle.textContent = title;
          DOM.downloadConfirmArtist.textContent = artist;
          DOM.downloadConfirmModal.classList.add('show');
        }
      }

      function hideDownloadConfirmModal() {
        if (DOM.downloadConfirmModal) {
          DOM.downloadConfirmModal.classList.remove('show');
          state.pendingDownload = null;
        }
      }

      function showDeleteConfirmModal(title, artist, filename) {
        if (DOM.deleteConfirmModal) {
          DOM.deleteConfirmTitle.textContent = title;
          DOM.deleteConfirmArtist.textContent = artist;
          state.pendingDelete = { title, artist, filename };
          DOM.deleteConfirmModal.classList.add('show');
        }
      }

      function hideDeleteConfirmModal() {
        if (DOM.deleteConfirmModal) {
          DOM.deleteConfirmModal.classList.remove('show');
          state.pendingDelete = null;
        }
      }

      function confirmShutdown() {
        if (!state.wsConnected) {
          showStatus('Not connected to server. Cannot shutdown.', 3000);
          return;
        }
        showShutdownModal();
      }

      async function executeShutdown() {
        if (!state.wsConnected) {
          hideShutdownModal();
          showStatus('Not connected to server', 3000);
          return;
        }

        hideShutdownModal();

        log('Initiating system shutdown...');
        showStatus('Shutting down system...', 5000);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

          const response = await fetch(CONFIG.SHUTDOWN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            log('Shutdown command sent successfully');
            showStatus('System shutdown initiated. This page will close soon.', 10000);

            setTimeout(() => {
              window.close();
            }, 3000);
          } else {
            throw new Error(\`HTTP error! status: \${response.status}\`);
          }

        } catch (err) {
          error('Shutdown failed:', err);
          showStatus('Failed to shutdown system. Check connection.', 5000);
        }
      }

      async function confirmDownload() {
        if (!state.pendingDownload) {
          hideDownloadConfirmModal();
          error('confirmDownload called with no pendingDownload');
          return;
        }

        const { title, artist } = state.pendingDownload;

        hideDownloadConfirmModal();

        if (!title || !artist) {
          showStatus('Missing download information', 3000);
          error('Download failed: incomplete data in pendingDownload', state.pendingDownload);
          return;
        }

        log('Confirming download for:', { title, artist });
        await startDownload(title, artist);
      }

      async function confirmDelete() {
        if (!state.pendingDelete) {
          hideDeleteConfirmModal();
          return;
        }

        const { filename, title } = state.pendingDelete;

        hideDeleteConfirmModal();

        if (!filename) {
          showStatus('No filename provided for deletion', 3000);
          error('Delete failed: no filename in pendingDelete', state.pendingDelete);
          return;
        }

        log('Confirming deletion for:', { title, filename });
        await deleteSong(filename);
      }

      // Make modal functions global
      window.confirmShutdown = confirmShutdown;
      window.hideShutdownModal = hideShutdownModal;
      window.executeShutdown = executeShutdown;
      window.hideDownloadConfirmModal = hideDownloadConfirmModal;
      window.confirmDownload = confirmDownload;
      window.hideDeleteConfirmModal = hideDeleteConfirmModal;
      window.confirmDelete = confirmDelete;

      // ==================== WEBSOCKET MANAGEMENT ====================
      let ws = null;
      let reconnectTimeout = null;
      let heartbeatInterval = null;

      function startHeartbeat() {
        stopHeartbeat();
        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (err) {
              warn('Heartbeat failed:', err);
            }
          }
        }, 30000);
      }

      function stopHeartbeat() {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      }

      function connectWebSocket() {
        try {
          if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            ws.close();
            ws = null;
          }

          log('Connecting to WebSocket...', \`ws://\${CONFIG.HOST_IP}:\${CONFIG.WS_PORT}\`);
          updateConnectionStatus(false, true);

          ws = new WebSocket(\`ws://\${CONFIG.HOST_IP}:\${CONFIG.WS_PORT}\`);

          fetchInitialState();

          ws.onopen = () => {
            log('✓ WebSocket connected');
            state.reconnectAttempts = 0;
            state.reconnectDelay = CONFIG.RECONNECT_BASE_DELAY;
            state.wsConnected = true;
            updateConnectionStatus(true, false);
            setProcessing(false);
            startHeartbeat();
            showStatus('Connected to karaoke system', 2000);
          };

          ws.onclose = (event) => {
            log('✗ WebSocket disconnected', event.code, event.reason);
            state.wsConnected = false;
            updateConnectionStatus(false, false);
            setProcessing(true);
            stopHeartbeat();
            attemptReconnect();
          };

          ws.onerror = (err) => {
            error('WebSocket error:', err);
            state.wsConnected = false;
            updateConnectionStatus(false, false);
          };

          ws.onmessage = handleWebSocketMessage;

        } catch (err) {
          error('Failed to create WebSocket:', err);
          state.wsConnected = false;
          updateConnectionStatus(false, false);
          attemptReconnect();
        }
      }

      function attemptReconnect() {
        if (state.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
          error(\`Max reconnection attempts (\${CONFIG.MAX_RECONNECT_ATTEMPTS}) reached\`);
          showStatus('Connection lost. Please refresh the page.', 10000);
          return;
        }

        clearTimeout(reconnectTimeout);

        const delay = Math.min(
          state.reconnectDelay * Math.pow(1.5, state.reconnectAttempts),
          CONFIG.RECONNECT_MAX_DELAY
        );

        log(\`Reconnecting in \${delay}ms (attempt \${state.reconnectAttempts + 1}/\${CONFIG.MAX_RECONNECT_ATTEMPTS})\`);
        showStatus(\`Reconnecting in \${Math.round(delay/1000)}s...\`, delay);

        reconnectTimeout = setTimeout(() => {
          state.reconnectAttempts++;
          connectWebSocket();
        }, delay);
      }

      function handleWebSocketMessage(event) {
        try {
          const data = JSON.parse(event.data);
          log('WS message:', data.type);

          if (data.type === 'state') {
            if (typeof data.code !== 'undefined') {
              state.serverCode = String(data.code || '');
              state.localCode = state.serverCode;
              updateCodeDisplay(state.serverCode);
            }

            if (data.queue) {
              state.queue = data.queue;
              updateQueueDisplay(state.queue);
            }

            if (data.state) {
              state.currentState = data.state;
            }

          } else if (data.type === 'downloadProgress') {
            updateDownloadProgress(data);
          } else if (data.type === 'downloadComplete') {
            handleDownloadComplete(data);
          } else if (data.type === 'downloadError') {
            handleDownloadError(data);
          } else if (data.type === 'pong') {
            log('Heartbeat acknowledged');
          }

        } catch (err) {
          error('WS message error:', err, event.data);
        }
      }

      // ==================== API FUNCTIONS ====================
      async function sendActionWithRetry(action, extra = {}, attempts = 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

          const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...extra }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
          }

          const data = await response.json();
          return data;

        } catch (err) {
          error('Action failed:', action, err.message);

          if (attempts < CONFIG.RETRY_ATTEMPTS) {
            warn(\`Retrying... (attempt \${attempts + 1}/\${CONFIG.RETRY_ATTEMPTS})\`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return sendActionWithRetry(action, extra, attempts + 1);
          }

          showStatus('Action failed. WebSocket will sync state.', 3000);
          return null;
        }
      }

      async function sendAction(action, extra = {}) {
        return sendActionWithRetry(action, extra, 0);
      }

      // ==================== DIGIT INPUT ====================
      async function sendDigit(digit) {
        if (!state.wsConnected) {
          showStatus('Not connected to server', 2000);
          return;
        }

        const now = Date.now();

        if (digit === state.lastDigitPress.digit &&
            now - state.lastDigitPress.time < CONFIG.DIGIT_DEBOUNCE_MS) {
          log('Debounced digit:', digit);
          return;
        }

        state.lastDigitPress = { digit, time: now };

        setProcessing(true);

        const response = await sendAction('digit', { digit: String(digit) });

        setProcessing(false);

        if (response && response.ok) {
          showStatus('Digit added: ' + digit, 1000);
        } else {
          state.localCode = state.serverCode;
          updateCodeDisplay(state.serverCode);
          showStatus('Failed to send digit', 2000);
        }
      }

      async function deleteDigit() {
        if (!state.wsConnected) {
          showStatus('Not connected to server', 2000);
          return;
        }

        if (state.localCode.length === 0) {
          showStatus('Code is already empty');
          return;
        }

        state.localCode = state.localCode.slice(0, -1);
        updateCodeDisplay(state.localCode);

        setProcessing(true);

        const response = await sendAction('delete');

        setProcessing(false);

        if (response && response.ok) {
          showStatus('Digit removed', 1000);
        } else {
          state.localCode = state.serverCode;
          updateCodeDisplay(state.serverCode);
          showStatus('Failed to delete digit', 2000);
        }
      }

      async function enterSong() {
        if (!state.wsConnected) {
          showStatus('Not connected to server', 2000);
          return;
        }

        if (state.localCode.length === 0) {
          showStatus('Please enter a song code first');
          return;
        }

        const songCode = state.localCode;

        setProcessing(true);

        const response = await sendAction('enter');

        setProcessing(false);

        if (response && response.ok) {
          showStatus(\`Song \${songCode} queued!\`, 2000);
        } else {
          showStatus('Failed to queue song', 2000);
        }
      }

      async function skipSong() {
        if (!state.wsConnected) {
          showStatus('Not connected to server', 2000);
          return;
        }

        setProcessing(true);

        const response = await sendAction('skip');

        setProcessing(false);

        if (response && response.ok) {
          showStatus('Song skipped', 2000);
        } else {
          showStatus('Failed to skip song', 2000);
        }
      }

      // ==================== SONG SORTING & FILTERING ====================
      function sortSongs(songs, sortBy) {
        const sorted = [...songs];

        switch (sortBy) {
          case 'title-asc':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case 'title-desc':
            sorted.sort((a, b) => b.title.localeCompare(a.title));
            break;
          case 'artist-asc':
            sorted.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
          case 'artist-desc':
            sorted.sort((a, b) => b.artist.localeCompare(a.artist));
            break;
          case 'id-asc':
            sorted.sort((a, b) => Number(a.id) - Number(b.id));
            break;
          case 'id-desc':
            sorted.sort((a, b) => Number(b.id) - Number(a.id));
            break;
        }

        return sorted;
      }

      function filterSongsByLetter(songs, letter) {
        if (!letter) return songs;

        return songs.filter(song => {
          const firstChar = getFirstLetter(song.title);
          if (letter === '0-9') {
            return firstChar === '0-9';
          }
          return firstChar === letter;
        });
      }

      function groupSongsByLetter(songs) {
        const groups = {};

        songs.forEach(song => {
          const letter = getFirstLetter(song.title);
          if (!groups[letter]) {
            groups[letter] = [];
          }
          groups[letter].push(song);
        });

        return groups;
      }

      function renderSongList(songs) {
        if (!DOM.songList) return;

        DOM.songList.innerHTML = '';

        if (songs.length === 0) {
          DOM.songList.innerHTML = '<div class="p-3 text-gray-400 text-sm">No songs found</div>';
          if (DOM.songCount) DOM.songCount.textContent = '';
          return;
        }

        if (DOM.songCount) {
          DOM.songCount.textContent = \`\${songs.length} song(s) total\`;
        }

        const grouped = groupSongsByLetter(songs);
        const letters = Object.keys(grouped).sort((a, b) => {
          if (a === '0-9') return 1;
          if (b === '0-9') return -1;
          return a.localeCompare(b);
        });

        const fragment = document.createDocumentFragment();

        letters.forEach(letter => {
          const section = document.createElement('div');
          section.className = 'song-section';

          const header = document.createElement('div');
          header.className = 'section-header';
          header.textContent = letter;
          section.appendChild(header);

          grouped[letter].forEach(song => {
            const item = document.createElement('div');
            item.className = 'song-item';

            const songId = document.createElement('div');
            songId.className = 'song-id';
            songId.textContent = String(song.id || '').padStart(6, '0');

            const songInfo = document.createElement('div');
            songInfo.className = 'song-info';

            const songTitle = document.createElement('div');
            songTitle.className = 'song-title';
            songTitle.textContent = song.title || 'Unknown Title';

            const songArtist = document.createElement('div');
            songArtist.className = 'song-artist';
            songArtist.textContent = song.artist || 'Unknown Artist';

            songInfo.appendChild(songTitle);
            songInfo.appendChild(songArtist);

            item.appendChild(songId);
            item.appendChild(songInfo);

            item.onclick = () => {
              if (song.id) {
                log('Selected song:', song.title, song.id);

                const songIdStr = String(song.id).padStart(6, '0');

                // Clear current code first
                state.localCode = '';
                updateCodeDisplay('');

                // Send full code at once
                setTimeout(async () => {
                  for (let i = 0; i < songIdStr.length; i++) {
                    await sendDigit(songIdStr[i]);
                  }

                  setTimeout(() => {
                    switchTab(DOM.remoteTab, [DOM.songlistTab, DOM.downloadTab, DOM.advancedTab],
                              DOM.tabRemote, [DOM.tabSonglist, DOM.tabDownload, DOM.tabAdvanced]);
                  }, 200);
                }, 100);
              }
            };

            section.appendChild(item);
          });

          fragment.appendChild(section);
        });

        DOM.songList.appendChild(fragment);
      }

      function updateSongList() {
        let songs = state.allSongs;

        // Apply search filter
        if (state.lastSearchQuery) {
          const query = state.lastSearchQuery.toLowerCase();
          songs = songs.filter(song =>
            song.title.toLowerCase().includes(query) ||
            song.artist.toLowerCase().includes(query)
          );
        }

        // Apply letter filter
        songs = filterSongsByLetter(songs, state.currentFilter);

        // Apply sorting
        songs = sortSongs(songs, state.currentSort);

        state.filteredSongs = songs;
        state.totalPages = Math.ceil(songs.length / CONFIG.SONGS_PER_PAGE);

        // Reset to page 1 if current page is out of bounds
        if (state.currentPage > state.totalPages && state.totalPages > 0) {
          state.currentPage = 1;
        }

        updatePaginationControls();
        renderCurrentPage();
      }

      function renderCurrentPage() {
        const start = (state.currentPage - 1) * CONFIG.SONGS_PER_PAGE;
        const end = start + CONFIG.SONGS_PER_PAGE;
        const pageSongs = state.filteredSongs.slice(start, end);

        renderSongList(pageSongs);
      }

      function updatePaginationControls() {
        if (DOM.pageInfo) {
          DOM.pageInfo.textContent = \`Page \${state.currentPage} of \${state.totalPages || 1}\`;
        }

        if (DOM.btnFirstPage) DOM.btnFirstPage.disabled = state.currentPage === 1;
        if (DOM.btnPrevPage) DOM.btnPrevPage.disabled = state.currentPage === 1;
        if (DOM.btnNextPage) DOM.btnNextPage.disabled = state.currentPage >= state.totalPages;
        if (DOM.btnLastPage) DOM.btnLastPage.disabled = state.currentPage >= state.totalPages;
      }

      function goToPage(page) {
        if (page < 1 || page > state.totalPages) return;
        state.currentPage = page;
        updateSongList();
      }

      function goToPrevPage() {
        if (state.currentPage > 1) {
          goToPage(state.currentPage - 1);
        }
      }

      function goToNextPage() {
        if (state.currentPage < state.totalPages) {
          goToPage(state.currentPage + 1);
        }
      }

      function goToLastPage() {
        goToPage(state.totalPages);
      }

      window.goToPage = goToPage;
      window.goToPrevPage = goToPrevPage;
      window.goToNextPage = goToNextPage;
      window.goToLastPage = goToLastPage;

      // ==================== SONG SEARCH ====================
      function showSearchSpinner(show) {
        if (DOM.searchSpinner) {
          DOM.searchSpinner.style.display = show ? 'block' : 'none';
        }
      }

      async function searchSongs(query) {
        clearTimeout(state.searchTimeout);

        state.searchTimeout = setTimeout(async () => {
          const trimmedQuery = query.trim();

          // If we already have songs cached, just filter locally (fast)
          if (state.allSongs.length > 0) {
            log('Filtering local songs for:', trimmedQuery);
            state.lastSearchQuery = trimmedQuery;
            state.currentPage = 1;
            updateSongList();
            return;
          }

          // Only fetch from server once to populate the cache
          if (state.isSearching) {
            log('Search already in progress, skipping');
            return;
          }

          log('Fetching all songs from server (one-time load)...');
          state.isSearching = true;
          showSearchSpinner(true);

          try {
            const response = await sendAction('search', { query: '' });

            if (!response || response.type !== 'songList' ||
                !Array.isArray(response.songs) || response.songs.length === 0) {
              DOM.songList.innerHTML = '<div class="p-3 text-gray-400 text-sm">No songs found</div>';
              if (DOM.songCount) DOM.songCount.textContent = '';
              return;
            }

            state.allSongs = response.songs;
            state.lastSearchQuery = trimmedQuery;
            state.currentPage = 1;
            log(\`Loaded \${response.songs.length} songs into cache\`);
            updateSongList();

          } catch (err) {
            error('Failed to load songs:', err);
            DOM.songList.innerHTML = '<div class="p-3 text-red-400 text-sm">Failed to load songs. Please try again.</div>';
          } finally {
            showSearchSpinner(false);
            state.isSearching = false;
          }

        }, CONFIG.SEARCH_DEBOUNCE_MS);
      }

      // Refresh song list by fetching from server
      async function refreshSongList() {
        log('Refreshing song list after download...');

        showSearchSpinner(true);

        const response = await sendAction('search', { query: '' });

        showSearchSpinner(false);

        if (response && response.type === 'songList' && Array.isArray(response.songs)) {
          state.allSongs = response.songs;
          updateSongList();
          log('Song list refreshed, total songs:', response.songs.length);
        }
      }

      // ==================== DOWNLOAD SEARCH ====================
      function showDownloadSearchSpinner(show) {
        if (DOM.downloadSearchSpinner) {
          DOM.downloadSearchSpinner.style.display = show ? 'block' : 'none';
        }
      }

      async function searchDownloadSongs(query) {
        // Cancel any pending timeout
        clearTimeout(state.downloadSearchTimeout);

        // Cancel any ongoing search request
        if (state.downloadSearchAbortController) {
          state.downloadSearchAbortController.abort();
          state.downloadSearchAbortController = null;
        }

        state.downloadSearchTimeout = setTimeout(async () => {
          const trimmedQuery = query.trim();

          // Clear results if query is empty
          if (!trimmedQuery) {
            DOM.downloadSearchResults.innerHTML = '<div class="p-3 text-gray-400 text-sm text-center">Search for songs above</div>';
            state.downloadSearchResults = [];
            state.downloadTotalPages = 0;
            updateDownloadPaginationControls();
            return;
          }

          // Minimum character requirement
          if (trimmedQuery.length < CONFIG.MIN_SEARCH_CHARS) {
            DOM.downloadSearchResults.innerHTML = \`<div class="p-3 text-gray-400 text-sm text-center">Type at least \${CONFIG.MIN_SEARCH_CHARS} characters to search</div>\`;
            return;
          }

          // Don't search if already searching the same query
          if (state.isDownloadSearching && trimmedQuery === state.lastDownloadSearchQuery) {
            log('Same download search already in progress, skipping');
            return;
          }

          // Don't search if we already have results for this exact query
          if (trimmedQuery === state.lastDownloadSearchQuery && state.downloadSearchResults.length > 0) {
            log('Using cached download search results for:', trimmedQuery);
            return;
          }

          log('Searching for download:', trimmedQuery);
          state.isDownloadSearching = true;
          state.lastDownloadSearchQuery = trimmedQuery;
          showDownloadSearchSpinner(true);

          try {
            state.downloadSearchAbortController = new AbortController();
            const timeoutId = setTimeout(() => {
              if (state.downloadSearchAbortController) {
                state.downloadSearchAbortController.abort();
              }
            }, CONFIG.DOWNLOAD_SEARCH_TIMEOUT_MS);

            const response = await fetch(CONFIG.QUERY_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: trimmedQuery }),
              signal: state.downloadSearchAbortController.signal
            });

            clearTimeout(timeoutId);
            state.downloadSearchAbortController = null;

            if (!response.ok) {
              throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
              DOM.downloadSearchResults.innerHTML = '<div class="p-3 text-gray-400 text-sm text-center">No results found</div>';
              state.downloadSearchResults = [];
              state.downloadTotalPages = 0;
              updateDownloadPaginationControls();
              return;
            }

            state.downloadSearchResults = data.results;
            state.downloadSearchQuery = trimmedQuery;
            state.downloadCurrentPage = 1;
            state.downloadTotalPages = Math.ceil(data.results.length / CONFIG.DOWNLOAD_RESULTS_PER_PAGE);

            log(\`Found \${data.results.length} download results\`);
            renderDownloadSearchResults();
            updateDownloadPaginationControls();

          } catch (err) {
            if (err.name === 'AbortError') {
              log('Download search was cancelled');
              // Don't show error message if user is still typing
              return;
            } else {
              error('Download search failed:', err);
              DOM.downloadSearchResults.innerHTML = '<div class="p-3 text-red-400 text-sm text-center">Search failed. Please try again.</div>';
            }
          } finally {
            showDownloadSearchSpinner(false);
            state.isDownloadSearching = false;
            state.downloadSearchAbortController = null;
          }

        }, CONFIG.DOWNLOAD_SEARCH_DEBOUNCE_MS);
      }

      function renderDownloadSearchResults() {
        if (!DOM.downloadSearchResults) return;

        DOM.downloadSearchResults.innerHTML = '';

        if (state.downloadSearchResults.length === 0) {
          DOM.downloadSearchResults.innerHTML = '<div class="p-3 text-gray-400 text-sm text-center">No results found</div>';
          return;
        }

        const start = (state.downloadCurrentPage - 1) * CONFIG.DOWNLOAD_RESULTS_PER_PAGE;
        const end = start + CONFIG.DOWNLOAD_RESULTS_PER_PAGE;
        const pageResults = state.downloadSearchResults.slice(start, end);

        const fragment = document.createDocumentFragment();

        pageResults.forEach(result => {
          const item = document.createElement('div');
          item.className = 'song-item';

          const songInfo = document.createElement('div');
          songInfo.className = 'song-info';
          songInfo.style.paddingLeft = '0';

          const songTitle = document.createElement('div');
          songTitle.className = 'song-title';
          songTitle.textContent = result.title || 'Unknown Title';

          const songArtist = document.createElement('div');
          songArtist.className = 'song-artist';
          songArtist.textContent = result.artist || 'Unknown Artist';

          songInfo.appendChild(songTitle);
          songInfo.appendChild(songArtist);
          item.appendChild(songInfo);

          item.onclick = () => {
            log('Selected download song:', result.title, result.artist);
            state.pendingDownload = {
              title: result.title,
              artist: result.artist
            };
            showDownloadConfirmModal(result.title, result.artist);
          };

          fragment.appendChild(item);
        });

        DOM.downloadSearchResults.appendChild(fragment);
      }

      function updateDownloadPaginationControls() {
        if (DOM.downloadPageInfo) {
          DOM.downloadPageInfo.textContent = \`Page \${state.downloadCurrentPage} of \${state.downloadTotalPages || 1}\`;
        }

        if (DOM.btnDownloadFirstPage) DOM.btnDownloadFirstPage.disabled = state.downloadCurrentPage === 1;
        if (DOM.btnDownloadPrevPage) DOM.btnDownloadPrevPage.disabled = state.downloadCurrentPage === 1;
        if (DOM.btnDownloadNextPage) DOM.btnDownloadNextPage.disabled = state.downloadCurrentPage >= state.downloadTotalPages;
        if (DOM.btnDownloadLastPage) DOM.btnDownloadLastPage.disabled = state.downloadCurrentPage >= state.downloadTotalPages;
      }

      function goToDownloadPage(page) {
        if (page < 1 || page > state.downloadTotalPages) return;
        state.downloadCurrentPage = page;
        renderDownloadSearchResults();
        updateDownloadPaginationControls();
      }

      function goToDownloadPrevPage() {
        if (state.downloadCurrentPage > 1) {
          goToDownloadPage(state.downloadCurrentPage - 1);
        }
      }

      function goToDownloadNextPage() {
        if (state.downloadCurrentPage < state.downloadTotalPages) {
          goToDownloadPage(state.downloadCurrentPage + 1);
        }
      }

      function goToDownloadLastPage() {
        goToDownloadPage(state.downloadTotalPages);
      }

      window.goToDownloadPage = goToDownloadPage;
      window.goToDownloadPrevPage = goToDownloadPrevPage;
      window.goToDownloadNextPage = goToDownloadNextPage;
      window.goToDownloadLastPage = goToDownloadLastPage;

      // ==================== DOWNLOAD MANAGEMENT ====================
      async function startDownload(title, artist) {
        if (!state.wsConnected) {
          showStatus('Not connected to server', 2000);
          error('Cannot start download: not connected to WebSocket');
          return;
        }

        log('Starting download:', { title, artist });

        const downloadId = Date.now().toString();

        state.downloads[downloadId] = {
          id: downloadId,
          title,
          artist,
          progress: 0,
          status: 'searching'
        };

        renderDownloadsList();

        try {
          const response = await sendAction('download', {
            downloadId,
            title,
            artist
          });

          log('Download action response:', response);

          if (!response || !response.ok) {
            throw new Error(response?.error || 'Failed to start download');
          }

          showStatus('Download started: ' + title, 2000);
          log('Download started successfully for:', title);

        } catch (err) {
          error('Download start failed:', err);
          state.downloads[downloadId].status = 'error';
          state.downloads[downloadId].error = err.message || 'Failed to start download';
          renderDownloadsList();
          showStatus('Download failed: ' + err.message, 3000);
        }
      }

      function updateDownloadProgress(data) {
        const { downloadId, progress, status, videoTitle } = data;

        log('Download progress update:', { downloadId, progress, status, videoTitle });

        if (state.downloads[downloadId]) {
          state.downloads[downloadId].progress = progress || 0;
          state.downloads[downloadId].status = status || 'downloading';
          if (videoTitle) {
            state.downloads[downloadId].videoTitle = videoTitle;
          }
          renderDownloadsList();
        } else {
          warn('Received progress for unknown download:', downloadId);
        }
      }

      function handleDownloadComplete(data) {
        const { downloadId, filename } = data;

        log('Download complete:', { downloadId, filename });

        if (state.downloads[downloadId]) {
          state.downloads[downloadId].status = 'complete';
          state.downloads[downloadId].progress = 100;
          state.downloads[downloadId].filename = filename;
          renderDownloadsList();

          showStatus(\`Download complete: \${state.downloads[downloadId].title}\`, 3000);

          // Refresh song list to include newly downloaded song
          log('Refreshing song list after download completion');
          refreshSongList();

          // Refresh downloaded songs list
          log('Refreshing downloaded songs list');
          refreshDownloadedSongs();

          // Remove from list after 5 seconds
          setTimeout(() => {
            log('Removing completed download from active list:', downloadId);
            delete state.downloads[downloadId];
            renderDownloadsList();
          }, 5000);
        } else {
          warn('Received completion for unknown download:', downloadId);
        }
      }

      function handleDownloadError(data) {
        const { downloadId, error: errorMsg } = data;

        error('Download error:', { downloadId, error: errorMsg });

        if (state.downloads[downloadId]) {
          state.downloads[downloadId].status = 'error';
          state.downloads[downloadId].error = errorMsg || 'Unknown error';
          renderDownloadsList();

          showStatus(\`Download failed: \${errorMsg}\`, 5000);
        } else {
          warn('Received error for unknown download:', downloadId);
        }
      }

      function renderDownloadsList() {
        if (!DOM.downloadsList) return;

        const downloads = Object.values(state.downloads);

        if (downloads.length === 0) {
          DOM.downloadsList.innerHTML = '<div class="text-sm text-gray-400 text-center py-4">No active downloads</div>';
          return;
        }

        DOM.downloadsList.innerHTML = '';

        downloads.forEach(download => {
          const item = document.createElement('div');
          item.className = 'download-item';

          const title = document.createElement('div');
          title.className = 'download-title';
          title.textContent = download.videoTitle || download.title;

          const artist = document.createElement('div');
          artist.className = 'download-artist';
          artist.textContent = download.artist;

          const progressBar = document.createElement('div');
          progressBar.className = 'progress-bar';

          const progressFill = document.createElement('div');
          progressFill.className = 'progress-fill';
          progressFill.style.width = \`\${download.progress}%\`;

          progressBar.appendChild(progressFill);

          const status = document.createElement('div');
          status.className = 'download-status';

          const statusText = document.createElement('span');
          const statusMessages = {
            searching: '🔍 Searching...',
            downloading: '⬇️ Downloading...',
            complete: '✅ Complete',
            error: '❌ Error'
          };
          statusText.textContent = statusMessages[download.status] || download.status;

          const progressText = document.createElement('span');
          progressText.textContent = \`\${Math.round(download.progress)}%\`;

          status.appendChild(statusText);
          status.appendChild(progressText);

          if (download.error) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'text-xs text-red-400 mt-2';
            errorMsg.textContent = download.error;
            item.appendChild(title);
            item.appendChild(artist);
            item.appendChild(errorMsg);
          } else {
            item.appendChild(title);
            item.appendChild(artist);
            item.appendChild(progressBar);
            item.appendChild(status);
          }

          DOM.downloadsList.appendChild(item);
        });
      }

      window.startDownload = startDownload;

      // ==================== DOWNLOADED SONGS MANAGEMENT ====================
      async function fetchDownloadedSongs() {
        try {
          log('Fetching downloaded songs...');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

          const response = await fetch(CONFIG.DOWNLOADED_LIST_URL, {
            method: 'GET',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
          }

          const data = await response.json();

          if (data.songs && Array.isArray(data.songs)) {
            state.downloadedSongs = data.songs;
            renderDownloadedSongs();
          }

        } catch (err) {
          error('Failed to fetch downloaded songs:', err);
          if (DOM.downloadedSongsList) {
            DOM.downloadedSongsList.innerHTML = '<div class="p-3 text-red-400 text-sm text-center">Failed to load downloaded songs</div>';
          }
        }
      }

      function renderDownloadedSongs() {
        if (!DOM.downloadedSongsList) return;

        DOM.downloadedSongsList.innerHTML = '';

        if (state.downloadedSongs.length === 0) {
          DOM.downloadedSongsList.innerHTML = '<div class="p-3 text-gray-400 text-sm text-center">No downloaded songs yet</div>';
          if (DOM.downloadedCount) DOM.downloadedCount.textContent = '';
          return;
        }

        if (DOM.downloadedCount) {
          DOM.downloadedCount.textContent = \`\${state.downloadedSongs.length} downloaded song(s)\`;
        }

        const fragment = document.createDocumentFragment();

        state.downloadedSongs.forEach(song => {
          const item = document.createElement('div');
          item.className = 'song-item';
          item.style.paddingLeft = '0.75rem';

          const songInfo = document.createElement('div');
          songInfo.className = 'song-info';
          songInfo.style.paddingLeft = '0';

          const songTitle = document.createElement('div');
          songTitle.className = 'song-title';
          songTitle.textContent = song.title || 'Unknown Title';

          const songArtist = document.createElement('div');
          songArtist.className = 'song-artist';
          songArtist.textContent = song.artist || 'Unknown Artist';

          const songFilename = document.createElement('div');
          songFilename.className = 'song-artist';
          songFilename.textContent = song.filename || '';

          songInfo.appendChild(songTitle);
          songInfo.appendChild(songArtist);
          if (song.filename) {
            songInfo.appendChild(songFilename);
          }

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn';
          deleteBtn.textContent = '🗑️ Delete';

          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            log('Delete button clicked for:', {
              title: song.title,
              artist: song.artist,
              filename: song.filename
            });

            if (!song.filename) {
              error('No filename available for song:', song);
              showStatus('Cannot delete: no filename', 3000);
              return;
            }

            showDeleteConfirmModal(song.title, song.artist, song.filename);
          };

          item.appendChild(songInfo);
          item.appendChild(deleteBtn);

          fragment.appendChild(item);
        });

        DOM.downloadedSongsList.appendChild(fragment);
      }

      async function deleteSong(filename) {
        if (!filename) {
          error('deleteSong called with no filename');
          showStatus('Cannot delete: no filename provided', 3000);
          return;
        }

        try {
          log('Deleting song:', filename);
          showStatus('Deleting song...', 2000);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

          const response = await fetch(CONFIG.DELETE_SONG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
          }

          const data = await response.json();
          log('Delete response:', data);

          if (data.ok) {
            showStatus('Song deleted successfully', 2000);

            // Refresh both lists
            await refreshDownloadedSongs();
            await refreshSongList();
          } else {
            throw new Error(data.error || 'Delete failed');
          }

        } catch (err) {
          error('Failed to delete song:', err);
          showStatus('Failed to delete song: ' + err.message, 3000);
        }
      }

      async function refreshDownloadedSongs() {
        log('Refreshing downloaded songs...');
        await fetchDownloadedSongs();
      }

      window.refreshDownloadedSongs = refreshDownloadedSongs;

      // ==================== TAB SWITCHING ====================
      function switchTab(showTab, hideTabs, btnShow, btnHides) {
        if (!showTab || !btnShow) return;

        const hideTabsArray = Array.isArray(hideTabs) ? hideTabs : [hideTabs];
        hideTabsArray.forEach(tab => {
          if (tab) {
            tab.classList.remove('tab-visible');
            tab.classList.add('tab-hidden');
          }
        });

        showTab.classList.remove('tab-hidden');
        showTab.classList.add('tab-visible');

        const btnHidesArray = Array.isArray(btnHides) ? btnHides : [btnHides];
        btnHidesArray.forEach(btn => {
          if (btn) {
            btn.classList.add('tab-inactive');
            btn.classList.remove('tab-active');
          }
        });

        btnShow.classList.add('tab-active');
        btnShow.classList.remove('tab-inactive');

        if (showTab === DOM.songlistTab && state.allSongs.length === 0) {
          searchSongs('');
        }

        if (showTab === DOM.downloadTab) {
          // Show search sub-tab by default
          switchDownloadSubTab(DOM.downloadSearchSection, DOM.downloadDownloadedSection,
                                DOM.downloadSubtabSearch, DOM.downloadSubtabDownloaded);
        }
      }

      function switchDownloadSubTab(showSection, hideSection, btnShow, btnHide) {
        if (!showSection || !btnShow) return;

        hideSection.classList.remove('tab-visible');
        hideSection.classList.add('tab-hidden');

        showSection.classList.remove('tab-hidden');
        showSection.classList.add('tab-visible');

        btnHide.classList.add('tab-inactive');
        btnHide.classList.remove('tab-active');

        btnShow.classList.add('tab-active');
        btnShow.classList.remove('tab-inactive');

        if (showSection === DOM.downloadDownloadedSection) {
          fetchDownloadedSongs();
        }
      }

      // ==================== EVENT LISTENERS ====================
      function setupEventListeners() {
        // Tab switching
        if (DOM.tabRemote) {
          DOM.tabRemote.onclick = () =>
            switchTab(DOM.remoteTab, [DOM.songlistTab, DOM.downloadTab, DOM.advancedTab],
                      DOM.tabRemote, [DOM.tabSonglist, DOM.tabDownload, DOM.tabAdvanced]);
        }

        if (DOM.tabSonglist) {
          DOM.tabSonglist.onclick = () =>
            switchTab(DOM.songlistTab, [DOM.remoteTab, DOM.downloadTab, DOM.advancedTab],
                      DOM.tabSonglist, [DOM.tabRemote, DOM.tabDownload, DOM.tabAdvanced]);
        }

        if (DOM.tabDownload) {
          DOM.tabDownload.onclick = () =>
            switchTab(DOM.downloadTab, [DOM.remoteTab, DOM.songlistTab, DOM.advancedTab],
                      DOM.tabDownload, [DOM.tabRemote, DOM.tabSonglist, DOM.tabAdvanced]);
        }

        if (DOM.tabAdvanced) {
          DOM.tabAdvanced.onclick = () =>
            switchTab(DOM.advancedTab, [DOM.remoteTab, DOM.songlistTab, DOM.downloadTab],
                      DOM.tabAdvanced, [DOM.tabRemote, DOM.tabSonglist, DOM.tabDownload]);
        }

        // Download sub-tab switching
        if (DOM.downloadSubtabSearch) {
          DOM.downloadSubtabSearch.onclick = () =>
            switchDownloadSubTab(DOM.downloadSearchSection, DOM.downloadDownloadedSection,
                                  DOM.downloadSubtabSearch, DOM.downloadSubtabDownloaded);
        }

        if (DOM.downloadSubtabDownloaded) {
          DOM.downloadSubtabDownloaded.onclick = () =>
            switchDownloadSubTab(DOM.downloadDownloadedSection, DOM.downloadSearchSection,
                                  DOM.downloadSubtabDownloaded, DOM.downloadSubtabSearch);
        }

        // Search input - debounced search
        if (DOM.searchQuery) {
          DOM.searchQuery.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // If we have cached songs, update filter immediately (fast)
            if (state.allSongs.length > 0) {
              state.lastSearchQuery = query;
              state.currentPage = 1;
              updateSongList();
            } else {
              // Otherwise, trigger the debounced server fetch
              searchSongs(query);
            }
          });
        }

        // Download search input
        if (DOM.downloadSearchQuery) {
          DOM.downloadSearchQuery.addEventListener('input', (e) => {
            searchDownloadSongs(e.target.value);
          });
        }

        // Sort dropdown
        if (DOM.sortBy) {
          DOM.sortBy.addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            state.currentPage = 1;
            updateSongList();
          });
        }

        // Filter dropdown
        if (DOM.filterLetter) {
          DOM.filterLetter.addEventListener('change', (e) => {
            state.currentFilter = e.target.value;
            state.currentPage = 1;
            updateSongList();

            // Update letter nav buttons
            document.querySelectorAll('.letter-nav-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.letter === e.target.value);
            });
          });
        }

        // Letter navigation buttons
        if (DOM.letterNav) {
          DOM.letterNav.addEventListener('click', (e) => {
            if (e.target.classList.contains('letter-nav-btn')) {
              const letter = e.target.dataset.letter;
              state.currentFilter = letter;
              state.currentPage = 1;

              if (DOM.filterLetter) {
                DOM.filterLetter.value = letter;
              }

              document.querySelectorAll('.letter-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.letter === letter);
              });

              updateSongList();
            }
          });
        }

        // Page jump input
        if (DOM.pageJump) {
          DOM.pageJump.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const page = parseInt(e.target.value);
              if (!isNaN(page)) {
                goToPage(page);
                e.target.value = '';
              }
            }
          });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          if (DOM.remoteTab && !DOM.remoteTab.classList.contains('tab-visible')) {
            return;
          }

          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            sendDigit(e.key);
          }

          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            deleteDigit();
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            enterSong();
          }
        });

        // Modal backdrop click to close
        if (DOM.shutdownModal) {
          DOM.shutdownModal.addEventListener('click', (e) => {
            if (e.target === DOM.shutdownModal) {
              hideShutdownModal();
            }
          });
        }

        if (DOM.downloadConfirmModal) {
          DOM.downloadConfirmModal.addEventListener('click', (e) => {
            if (e.target === DOM.downloadConfirmModal) {
              hideDownloadConfirmModal();
            }
          });
        }

        if (DOM.deleteConfirmModal) {
          DOM.deleteConfirmModal.addEventListener('click', (e) => {
            if (e.target === DOM.deleteConfirmModal) {
              hideDeleteConfirmModal();
            }
          });
        }
      }

      // ==================== INITIALIZATION ====================
      async function fetchInitialState() {
        try {
          const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getState' })
          });

          if (!response.ok) {
            throw new Error(\`HTTP \${response.status}\`);
          }

          const data = await response.json();
          log('Initial state received:', data);

          // ---- APPLY STATE ----
          if (typeof data.code === 'string') {
            state.serverCode = data.code;
            state.localCode = data.code.replace(/^0+/, '');
            updateCodeDisplay(state.serverCode);
          }

          if (Array.isArray(data.queue)) {
            state.queue = data.queue;
            updateQueueDisplay(state.queue);
          }

          if (typeof data.state === 'string') {
            state.currentState = data.state;
          }

          if (typeof data.backgroundType !== 'undefined') {
            state.backgroundType = data.backgroundType;
          }

          if (typeof data.announceKeys !== 'undefined') {
            state.announceKeys = data.announceKeys;
          }

          return data;

        } catch (err) {
          warn('Failed to fetch initial state:', err);
          return null;
        }
      }

      // ==================== INITIALIZATION ====================
      function initialize() {
        log('Initializing Remote Controller...');

        updateCodeDisplay('');
        updateQueueDisplay([]);
        updateConnectionStatus(false, false);

        setupEventListeners();

        window.sendDigit = sendDigit;
        window.deleteDigit = deleteDigit;
        window.enterSong = enterSong;
        window.skipSong = skipSong;

        connectWebSocket();

        log('Initialization complete');
      }

      // ==================== CLEANUP ====================
      window.addEventListener('beforeunload', () => {
        log('Cleaning up...');
        stopHeartbeat();

        if (ws) {
          ws.close();
        }
      });

      // ==================== START ====================
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
      } else {
        initialize();
      }

    })();
  </script>
</body>
</html>`;

export default function render(data: { IP: string; PORT: string }): string {
  return ejs.render(template, { IP: data.IP, WS_PORT: data.PORT });
}
