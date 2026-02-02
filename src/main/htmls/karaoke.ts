import ejs from 'ejs';

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karaoke View</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @font-face {
      font-family: 'KaraokeCustom';
      src: url('/assets/custom-font.ttf') format('truetype');
      font-display: swap;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: black;
      overflow: hidden;
      font-family: 'KaraokeCustom', sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }

    #idle-video, #song-video, #idle-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: black;
      z-index: 0;
    }

    #song-video { z-index: 5; }
    #audio-loop { display: none; }

    #overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      pointer-events: none;
      color: white;
    }

    #idle-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      opacity: 0;
      transition: opacity 400ms ease;
    }

    #overlay-info {
      position: absolute;
      top: 1rem;
      left: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: white;
      opacity: 0;
      transition: opacity 400ms ease;
    }

    #overlay-info > div {
      background: rgba(0, 0, 0, 0.7);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      backdrop-filter: blur(4px);
    }

    .media-element {
      transition: opacity 400ms ease;
    }

    .ws-status {
      position: fixed;
      top: 0.5rem;
      right: 0.5rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ef4444;
      z-index: 999;
      transition: background-color 0.3s ease;
    }

    .ws-status.connected {
      background: #22c55e;
    }

    /* Flash Overlay for Playback Actions */
    #flash-overlay {
      position: absolute;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 300ms ease;
    }

    #flash-overlay.show {
      opacity: 1;
    }

    #flash-message {
      background: rgba(0, 0, 0, 0.85);
      color: white;
      font-size: 4rem;
      font-weight: bold;
      padding: 2rem 4rem;
      border-radius: 1.5rem;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  </style>
</head>
<body>
  <!-- WebSocket Status Indicator -->
  <div id="ws-status" class="ws-status"></div>

  <!-- Background Media -->
  <video id="idle-video" class="media-element" autoplay playsinline muted loop style="display: none; opacity: 0;"></video>
  <img id="idle-image" class="media-element" style="display: none; opacity: 0;" />

  <!-- Song Video -->
  <video id="song-video" class="media-element" autoplay playsinline style="display: none; opacity: 0;"></video>

  <!-- Background Audio Loop -->
  <audio id="audio-loop" loop></audio>

  <!-- Overlay -->
  <div id="overlay">
    <!-- Idle Screen Center -->
    <div id="idle-center">
      <div id="code-display" class="text-[10rem] font-bold leading-none tracking-wider"></div>
      <div id="status-text" class="text-4xl mt-6 font-semibold"></div>
      <div id="queue-list" class="text-2xl mt-8 opacity-80"></div>
    </div>

    <!-- Karaoke Overlay Info -->
    <div id="overlay-info">
      <div id="karaoke-code" class="text-3xl font-bold"></div>
      <div id="karaoke-status" class="text-xl"></div>
      <div id="karaoke-queue" class="text-lg opacity-90"></div>
    </div>
  </div>

  <!-- Flash Overlay for Playback Actions (Always on top) -->
  <div id="flash-overlay">
    <div id="flash-message"></div>
  </div>

  <script>
    (function() {
      'use strict';

      // ==================== CONFIGURATION ====================
      const CONFIG = {
        HOST_IP: '<%= IP %>',
        WS_PORT: '<%= PORT %>',
        API_PORT: 5151,
        FADE_DURATION: 400,
        AUDIO_FADE_IN: 800,
        AUDIO_FADE_OUT: 600,
        MAX_RECONNECT_ATTEMPTS: 20,
        RECONNECT_BASE_DELAY: 1000,
        RECONNECT_MAX_DELAY: 30000
      };

      // ==================== DOM ELEMENTS ====================
      const DOM = {
        idleVideo: document.getElementById('idle-video'),
        idleImage: document.getElementById('idle-image'),
        songVideo: document.getElementById('song-video'),
        audioLoop: document.getElementById('audio-loop'),
        idleCenter: document.getElementById('idle-center'),
        overlayInfo: document.getElementById('overlay-info'),
        codeDisplay: document.getElementById('code-display'),
        statusText: document.getElementById('status-text'),
        queueList: document.getElementById('queue-list'),
        karaokeCode: document.getElementById('karaoke-code'),
        karaokeStatus: document.getElementById('karaoke-status'),
        karaokeQueue: document.getElementById('karaoke-queue'),
        wsStatus: document.getElementById('ws-status'),
        flashOverlay: document.getElementById('flash-overlay'),
        flashMessage: document.getElementById('flash-message')
      };

      // ==================== STATE MANAGEMENT ====================
      const state = {
        current: 'idle',
        lastSongId: null,
        backgroundType: 'image',
        announceKeys: false,
        isTransitioning: false,
        reconnectAttempts: 0,
        reconnectDelay: CONFIG.RECONNECT_BASE_DELAY,
        wsConnected: false,
        audioIntervals: new Set(),
        pendingCallbacks: new Set(),
        skipSent: false
      };

      // ==================== UTILITY FUNCTIONS ====================
      function log(...args) {
        console.log('[KaraokeView]', ...args);
      }

      function warn(...args) {
        console.warn('[KaraokeView]', ...args);
      }

      function error(...args) {
        console.error('[KaraokeView]', ...args);
      }

      function safeSetContent(element, content) {
        if (element && typeof content !== 'undefined') {
          element.textContent = String(content);
        }
      }

      function clearAllIntervals() {
        state.audioIntervals.forEach(id => clearInterval(id));
        state.audioIntervals.clear();
      }

      function clearAllCallbacks() {
        state.pendingCallbacks.forEach(id => clearTimeout(id));
        state.pendingCallbacks.clear();
      }

      // ==================== WEBSOCKET MANAGEMENT ====================
      let ws = null;
      let reconnectTimeout = null;
      let heartbeatInterval = null;

      function updateWSStatus(connected) {
        state.wsConnected = connected;
        if (DOM.wsStatus) {
          DOM.wsStatus.classList.toggle('connected', connected);
        }
      }

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
        }, 30000); // Every 30 seconds
      }

      function stopHeartbeat() {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      }

      function connectWebSocket() {
        try {
          // Close existing connection
          if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            ws.close();
            ws = null;
          }

          log('Connecting to WebSocket...', \`ws://\${CONFIG.HOST_IP}:\${CONFIG.WS_PORT}\`);
          ws = new WebSocket(\`ws://\${CONFIG.HOST_IP}:\${CONFIG.WS_PORT}\`);

          ws.onopen = () => {
            log('✓ WebSocket connected');
            state.reconnectAttempts = 0;
            state.reconnectDelay = CONFIG.RECONNECT_BASE_DELAY;
            updateWSStatus(true);
            startHeartbeat();
          };

          ws.onclose = (event) => {
            log('✗ WebSocket disconnected', event.code, event.reason);
            updateWSStatus(false);
            stopHeartbeat();
            attemptReconnect();
          };

          ws.onerror = (err) => {
            error('WebSocket error:', err);
            updateWSStatus(false);
          };

          ws.onmessage = handleWebSocketMessage;

        } catch (err) {
          error('Failed to create WebSocket:', err);
          updateWSStatus(false);
          attemptReconnect();
        }
      }

      function attemptReconnect() {
        if (state.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
          error(\`Max reconnection attempts (\${CONFIG.MAX_RECONNECT_ATTEMPTS}) reached\`);
          return;
        }

        clearTimeout(reconnectTimeout);

        const delay = Math.min(
          state.reconnectDelay * Math.pow(1.5, state.reconnectAttempts),
          CONFIG.RECONNECT_MAX_DELAY
        );

        log(\`Reconnecting in \${delay}ms (attempt \${state.reconnectAttempts + 1}/\${CONFIG.MAX_RECONNECT_ATTEMPTS})\`);

        reconnectTimeout = setTimeout(() => {
          state.reconnectAttempts++;
          connectWebSocket();
        }, delay);
      }

      // ==================== FADE UTILITIES ====================
      function fadeIn(element, duration = CONFIG.FADE_DURATION, callback) {
        if (!element) return;

        element.style.display = element.tagName === 'DIV' ? 'flex' : '';
        element.style.opacity = '0';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            element.style.opacity = '1';

            if (callback) {
              const timeoutId = setTimeout(() => {
                state.pendingCallbacks.delete(timeoutId);
                callback();
              }, duration);
              state.pendingCallbacks.add(timeoutId);
            }
          });
        });
      }

      function fadeOut(element, duration = CONFIG.FADE_DURATION, callback) {
        if (!element) return;

        element.style.opacity = '0';

        const timeoutId = setTimeout(() => {
          state.pendingCallbacks.delete(timeoutId);
          element.style.display = 'none';
          if (callback) callback();
        }, duration);
        state.pendingCallbacks.add(timeoutId);
      }

      // ==================== AUDIO MANAGEMENT ====================
      function fadeAudioIn(audio, targetVolume = 0.5, duration = CONFIG.AUDIO_FADE_IN) {
        if (!audio) return;

        audio.volume = 0;
        audio.play().catch(err => warn('Audio play failed:', err));

        const steps = duration / 50;
        const increment = targetVolume / steps;
        let currentVolume = 0;

        const intervalId = setInterval(() => {
          currentVolume = Math.min(currentVolume + increment, targetVolume);
          audio.volume = currentVolume;

          if (currentVolume >= targetVolume) {
            clearInterval(intervalId);
            state.audioIntervals.delete(intervalId);
          }
        }, 50);

        state.audioIntervals.add(intervalId);
      }

      function fadeAudioOut(audio, duration = CONFIG.AUDIO_FADE_OUT) {
        if (!audio || audio.paused) return;

        const startVolume = audio.volume || 0.5;
        const steps = duration / 50;
        const decrement = startVolume / steps;
        let currentVolume = startVolume;

        const intervalId = setInterval(() => {
          currentVolume = Math.max(currentVolume - decrement, 0);
          audio.volume = currentVolume;

          if (currentVolume <= 0) {
            clearInterval(intervalId);
            state.audioIntervals.delete(intervalId);
            audio.pause();
          }
        }, 50);

        state.audioIntervals.add(intervalId);
      }

      function stopAudio(audio) {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      }

      // ==================== FLASH MESSAGE ====================
      let flashTimeout = null;
      let isPaused = false;

      function showFlashMessage(message, persistent = false) {
        if (!DOM.flashOverlay || !DOM.flashMessage) return;

        // Clear any existing timeout
        if (flashTimeout) {
          clearTimeout(flashTimeout);
          flashTimeout = null;
        }

        // Set message and show
        safeSetContent(DOM.flashMessage, message);
        DOM.flashOverlay.classList.add('show');

        // If persistent (like PAUSED), keep it visible
        if (persistent) {
          return;
        }

        // Hide after 1.5 seconds for non-persistent messages
        flashTimeout = setTimeout(() => {
          DOM.flashOverlay.classList.remove('show');
        }, 1500);
      }

      function hideFlashMessage() {
        if (flashTimeout) {
          clearTimeout(flashTimeout);
          flashTimeout = null;
        }
        if (DOM.flashOverlay) {
          DOM.flashOverlay.classList.remove('show');
        }
      }

      // ==================== TEXT-TO-SPEECH ====================
      let ttsTimeout = null;

      // Load voices once when available (important for Chrome/Edge)
      const voiceCache = {
        voices: [],
        loaded: false
      };

      function loadVoices() {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0 && !voiceCache.loaded) {
          voiceCache.voices = voices;
          voiceCache.loaded = true;

          // Optional: log available voices once for debugging
          // console.log("Available voices:", voices.map(v => \`\${v.name} (\${v.lang})\`));
        }
      }

      // Start loading voices (works even if already loaded)
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      loadVoices();  // Try immediately in case they're already available

      function announceDigit(digit) {
        if (!state.announceKeys || !digit) return;

        clearTimeout(ttsTimeout);

        ttsTimeout = setTimeout(() => {
          try {
            // Stop any ongoing speech immediately
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              window.speechSynthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(String(digit));
            utterance.rate = 1.2;
            utterance.volume = 1.5;
            utterance.lang = 'en-US';

            // ── Smart voice selection: prefer clearly female voices ──
            const voices = voiceCache.voices.length > 0 ? voiceCache.voices : window.speechSynthesis.getVoices();

            if (voices.length > 0) {
              // Strong female indicators first (works well in Edge + many Windows installs)
              let selectedVoice = voices.find(v =>
                v.lang.startsWith('en') &&
                /female|woman|girl|zira|jenny|aria|grace|sara|helen|karen|emma|amanda/i.test(v.name.toLowerCase())
              );

              // Fallback: any English female-sounding name
              if (!selectedVoice) {
                selectedVoice = voices.find(v =>
                  v.lang.startsWith('en') &&
                  /female|woman|zira|jenny|aria|grace|sara|helen|karen|emma|amanda|susan|nancy|linda|laura/i.test(v.name.toLowerCase())
                );
              }

              // Last resort: any en-US / en-GB voice that's not clearly male
              if (!selectedVoice) {
                selectedVoice = voices.find(v =>
                  v.lang.startsWith('en') && !/male|man|boy|fred|david|george/i.test(v.name.toLowerCase())
                );
              }

              // Ultimate fallback: best available English voice
              if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
              }

              if (selectedVoice) {
                utterance.voice = selectedVoice;
              }
            }

            window.speechSynthesis.speak(utterance);

          } catch (err) {
            console.warn('TTS error:', err);
          }
        }, 50);
      }

      // ==================== BACKGROUND MANAGEMENT ====================
      function hideBackground(type) {
        if (type === 'video' && DOM.idleVideo) {
          DOM.idleVideo.style.opacity = '0';
          setTimeout(() => {
            DOM.idleVideo.style.display = 'none';
            DOM.idleVideo.pause();
          }, CONFIG.FADE_DURATION);
        } else if (type === 'image' && DOM.idleImage) {
          DOM.idleImage.style.opacity = '0';
          setTimeout(() => {
            DOM.idleImage.style.display = 'none';
          }, CONFIG.FADE_DURATION);
        }
      }

      function showBackground(type) {
        if (type === 'video' && DOM.idleVideo) {
          hideBackground('image');

          if (!DOM.idleVideo.src) {
            DOM.idleVideo.src = '/media/background';
          }

          DOM.idleVideo.muted = true;
          DOM.idleVideo.loop = true;
          fadeIn(DOM.idleVideo, 600);
          DOM.idleVideo.play().catch(err => warn('Video play error:', err));

        } else if (type === 'image' && DOM.idleImage) {
          hideBackground('video');

          if (!DOM.idleImage.src) {
            DOM.idleImage.src = '/media/background';
          }

          fadeIn(DOM.idleImage, 600);
        }
      }

      // ==================== STATE TRANSITIONS ====================
      function enterIdle() {
        if (state.isTransitioning && state.current === 'idle') {
          log('Already in idle state, skipping transition');
          return;
        }

        log('Entering idle state, backgroundType:', state.backgroundType);
        state.isTransitioning = true;
        state.current = 'idle';

        // Show idle overlay
        fadeIn(DOM.idleCenter);

        // Hide karaoke overlay
        fadeOut(DOM.overlayInfo);

        // Stop and hide song video
        fadeOut(DOM.songVideo, CONFIG.FADE_DURATION, () => {
          if (DOM.songVideo) {
            DOM.songVideo.pause();
            DOM.songVideo.src = '';
            DOM.songVideo.currentTime = 0;
          }
          state.isTransitioning = false;
        });

        // Manage backgrounds
        if (state.backgroundType === 'video') {
          hideBackground('image');
          showBackground('video');
        } else {
          hideBackground('video');
          showBackground('image');
        }

        // Start background audio
        if (DOM.audioLoop && (DOM.audioLoop.paused || !DOM.audioLoop.src)) {
          DOM.audioLoop.src = '/media/looping';
          DOM.audioLoop.loop = true;
          fadeAudioIn(DOM.audioLoop, 0.5, CONFIG.AUDIO_FADE_IN);
        }
      }

      function showKaraoke(songData) {
        if (!songData || !songData.songId) {
          warn('Invalid song data:', songData);
          return;
        }

        state.skipSent = false;

        log('Showing karaoke, songId:', songData.songId);

        if (state.current === 'karaoke' && state.lastSongId === songData.songId) {
          log('Same song already playing, skipping');
          return;
        }

        state.isTransitioning = true;
        state.current = 'karaoke';
        state.lastSongId = songData.songId;

        // Update karaoke overlay
        safeSetContent(DOM.karaokeCode, '000000');
        safeSetContent(DOM.karaokeStatus, songData.status || 'Now Playing');
        safeSetContent(DOM.karaokeQueue,
          (songData.queue && songData.queue.length)
            ? 'Queue: ' + songData.queue.join(' → ')
            : 'Queue: Empty'
        );

        // Hide idle overlay
        fadeOut(DOM.idleCenter);

        // Show karaoke overlay
        fadeIn(DOM.overlayInfo);

        // Fade out looping audio
        if (DOM.audioLoop && !DOM.audioLoop.paused) {
          fadeAudioOut(DOM.audioLoop, CONFIG.AUDIO_FADE_OUT);
        }

        // Hide both backgrounds
        hideBackground('video');
        hideBackground('image');

        // Setup song video
        if (DOM.songVideo) {
          DOM.songVideo.onended = () => {
            if(state.skipSent) return;

            state.skipSent = true;
            log('Song ended, notifying server');
            fetch(\`http://\${CONFIG.HOST_IP}:\${CONFIG.API_PORT}/action\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'skip' })
            }).catch(err => error('Failed to notify song end:', err));
          };

          DOM.songVideo.onerror = (err) => {
            error('Song video error:', err);
            state.isTransitioning = false;
          };

          DOM.songVideo.src = '/media/' + songData.songId;
          DOM.songVideo.loop = false;
          DOM.songVideo.currentTime = 0;
          DOM.songVideo.muted = false;

          fadeIn(DOM.songVideo, 500, () => {
            state.isTransitioning = false;
          });

          DOM.songVideo.play().catch(err => warn('Song play error:', err));
        }
      }

      // ==================== DISPLAY UPDATES ====================
      function updateDisplays(data) {
        if (!data) return;

        const displayCode = String(data.code || '').padStart(6, '0');
        const queueText = (data.queue && data.queue.length)
          ? 'Queue: ' + data.queue.join(' → ')
          : 'Queue: Empty';

        // Update idle center
        safeSetContent(DOM.codeDisplay, displayCode);
        safeSetContent(DOM.statusText, data.status || 'Select A Song');
        safeSetContent(DOM.queueList, queueText);

        // Update karaoke overlay
        if (state.current === 'karaoke') {
          safeSetContent(DOM.karaokeCode, displayCode);
        }
        safeSetContent(DOM.karaokeQueue, queueText);
      }

      // ==================== WEBSOCKET MESSAGE HANDLER ====================
      function handleWebSocketMessage(event) {
        try {
          const data = JSON.parse(event.data);
          log('WS message:', data.type);

          if (data.type === 'state') {
            // Update configuration
            if (data.backgroundType) {
              state.backgroundType = data.backgroundType;
            }
            if (typeof data.announceKeys !== 'undefined') {
              state.announceKeys = data.announceKeys;
            }

            // Announce digit (non-blocking)
            if (data.lastDigit && data.announceKeys) {
              announceDigit(data.lastDigit);
            }

            // Update displays
            updateDisplays(data);

            // Handle state transitions
            if (data.state === 'idle') {
              if (state.current !== 'idle') {
                enterIdle();
              }
            } else if (data.state === 'karaoke' && data.songId) {
              showKaraoke(data);
            }

          } else if (data.type === 'songEnd') {
            log('Song end message received');
            state.lastSongId = null;

          } else if (data.type === 'playbackControl') {
            // Handle playback controls
            log('Playback control:', data.action);
            
            if (!DOM.songVideo) return;

            switch (data.action) {
              case 'pause':
                DOM.songVideo.pause();
                isPaused = true;
                showFlashMessage('⏸ PAUSED', true); // Persistent overlay
                break;

              case 'resume':
                DOM.songVideo.play().catch(err => warn('Resume failed:', err));
                isPaused = false;
                hideFlashMessage(); // Hide the persistent pause overlay
                showFlashMessage('▶ RESUMED'); // Show brief resume message
                break;

              case 'prev':
                // Restart song (fallback when no previous song available)
                DOM.songVideo.currentTime = 0;
                DOM.songVideo.play().catch(err => warn('Play failed:', err));
                showFlashMessage('⏮ PREVIOUS');
                break;

              case 'seekForward':
                DOM.songVideo.currentTime = Math.min(
                  DOM.songVideo.currentTime + (data.value || 5),
                  DOM.songVideo.duration
                );
                showFlashMessage('⏩ +5s');
                break;

              case 'seekBackward':
                DOM.songVideo.currentTime = Math.max(
                  DOM.songVideo.currentTime + (data.value || -5),
                  0
                );
                showFlashMessage('⏪ -5s');
                break;

              case 'setVolume':
                if (typeof data.value === 'number') {
                  DOM.songVideo.volume = Math.max(0, Math.min(1, data.value));
                  showFlashMessage(\`🔊 \${Math.round(data.value * 100)}%\`);
                }
                break;
            }

          } else if (data.type === 'pong') {
            // Heartbeat response
            log('Heartbeat acknowledged');
          }

        } catch (err) {
          error('WS message error:', err, event.data);
        }
      }

      // ==================== INITIALIZATION ====================
      async function fetchInitialState() {
        try {
          const response = await fetch(\`http://\${CONFIG.HOST_IP}:\${CONFIG.API_PORT}/action\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getState' })
          });
          const data = await response.json();
          if (data && data.backgroundType) {
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

      function initialize() {
        log('Initializing Karaoke View...');

        // Set initial content
        safeSetContent(DOM.codeDisplay, '000000');
        safeSetContent(DOM.statusText, 'Select A Song');
        safeSetContent(DOM.queueList, 'Queue: Empty');
        safeSetContent(DOM.karaokeCode, '000000');
        safeSetContent(DOM.karaokeStatus, '');
        safeSetContent(DOM.karaokeQueue, 'Queue: Empty');

        // Set initial visibility
        if (DOM.idleCenter) {
          DOM.idleCenter.style.display = 'flex';
          DOM.idleCenter.style.opacity = '1';
        }
        if (DOM.overlayInfo) {
          DOM.overlayInfo.style.display = 'none';
          DOM.overlayInfo.style.opacity = '0';
        }

        // Connect WebSocket
        connectWebSocket();

        // Fetch initial state, then enter idle with correct background
        fetchInitialState().then(() => {
          enterIdle();
        });

        log('Initialization complete');
      }

      // ==================== CLEANUP ====================
      window.addEventListener('beforeunload', () => {
        log('Cleaning up...');
        stopHeartbeat();
        clearAllIntervals();
        clearAllCallbacks();

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
  return ejs.render(template, data);
}
