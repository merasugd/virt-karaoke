# 📜 Changelog
All notable changes to **Virtual Karaoke** will be documented in this file.
This project follows **[Semantic Versioning](__https://semver.org/__)**
and the **[Keep a Changelog](__https://keepachangelog.com/__)** format.

---

## [1.1.2] - 2026-02-02

### 🐛 Fixed
- **Idle Video**: The issue was just adding multiple inputs to FFmpeg without telling it how to combine them. FFmpeg needed explicit concatenation instructions.

---

## [1.1.1] - 2026-02-02

### 🐛 Fixed
- **Flash overlay persistence**: Fixed issue where PAUSED overlay would linger on screen when transitioning to idle state
- **State cleanup**: Improved cleanup of flash messages and pause state when songs are skipped or ended
- **Visual feedback**: Flash overlays now properly hide when entering idle mode or starting new songs

---

## [1.1.0] - 2026-02-02

### 🎮 Added - Playback Controls
- **Full playback control system** for real-time song manipulation
  - Pause/Resume currently playing songs
  - Skip to next song in queue
  - Previous song (replay from queue history)
  - Seek forward/backward (±5 seconds)
  - Adjustable playback volume (0-100%)
- **New Controller tab** in Remote interface with 3 sub-sections:
  - **Remote**: Traditional 6-digit code entry system
  - **Playback**: Real-time playback controls with visual feedback
  - **Queue**: View current queue and recently played songs
- **Visual feedback** on Karaoke display for all playback actions
  - On-screen overlays showing current action (⏸ PAUSED, ▶ RESUMED, ⏩ +5s, etc.)
  - Persistent pause overlay that stays visible until resumed
  - Brief flash messages for other actions

### 🎵 Added - Queue History Management
- **Queue history tracking** system storing last 100 played songs
  - Full song metadata preserved (title, artist, code, timestamp)
  - "Recently Played" section in Queue sub-tab
  - Previous song functionality uses history for accurate replay
- Queue history persists across app restarts
- Automatic cleanup keeps only most recent 100 entries

### 🔐 Added - YouTube Authentication System
- **YouTube login integration** for downloading restricted content
  - Age-restricted video downloads
  - Members-only content access
  - Region-locked content support
- **Cookie management system** using Netscape cookie format
  - Automatic cookie extraction from YouTube login
  - Cookie expiration tracking and validation
  - Manual cookie deletion option
- **New Settings section**: "YouTube Authentication"
  - One-click login through embedded browser window
  - Cookie status display with expiration date
  - Session count indicator

### ⚙️ Added - JavaScript Runtime Management for yt-dlp
- **Automatic runtime detection and installation system**
  - Support for multiple JavaScript runtimes: Node.js, Deno, Bun
  - Automatic download and installation if no system runtime found
  - Runtime version checking and updates every 3 days
- **Intelligent runtime selection**:
  - Prefers system-installed runtimes when available
  - Falls back to bundled runtime installation
  - Caches resolved runtime to avoid repeated checks
- **Progress tracking** during runtime downloads
- **Required for YouTube downloads**: Enables signature decryption for yt-dlp

### 🔧 Improved - Download System
- **Enhanced download reliability**
  - Better error handling and validation
  - File existence verification after download
  - Empty file detection and cleanup
  - Multiple file format support (MP4, WebM, MKV)
  - Automatic file format detection and fallback
- **Improved filename handling**
  - ASCII character restriction for better compatibility
  - Automatic sanitization of special characters
  - Consistent filename formatting with underscores
- **Better progress tracking**
  - More accurate download progress updates
  - File size validation
  - Download completion verification
- **Cookie integration** for authenticated downloads
  - Automatic cookie file usage when available
  - Seamless integration with YouTube login system
- **Enhanced error messages**
  - Clear guidance when JavaScript runtime is missing
  - Specific messages for 403 Forbidden errors
  - Instructions for resolving common download issues

### 🔧 Improved - User Experience
- **Reorganized remote interface**
  - Tabbed controller section for better organization
  - Clearer separation between remote control, playback, and queue management
  - Improved navigation with sub-tabs
- **Better network interface handling**
  - Fixed potential crash when network interfaces are undefined
  - More robust IPv4 address detection
  - Improved error handling for network operations

### 🐛 Fixed
- **Download validation**: Fixed issue where downloads could appear successful but produce empty or corrupted files
- **File system sync**: Added wait time after downloads to ensure file system operations complete
- **Filename compatibility**: Fixed issues with special characters in downloaded filenames
- **Network interface crash**: Fixed potential crash when network interfaces return undefined values
- **Quit confirmation**: Fixed issue where programmatic shutdown would show unnecessary confirmation dialog
- **Cookie expiration**: Automatic cleanup of expired YouTube authentication cookies

### 🔒 Security
- **Cookie storage**: Secure storage of YouTube authentication cookies in Netscape format
- **Session validation**: Automatic validation and cleanup of expired authentication sessions

### 📝 Technical Improvements
- **State management**: Enhanced app state with queue history tracking and persistence
- **WebSocket communication**: Added new message types for playback control commands
- **API endpoints**: New routes for playback control operations (pause, resume, prev, seek, volume)
- **Code organization**: Separated runtime management into dedicated module (`deno/index.ts`)
- **Type safety**: Improved TypeScript definitions for runtime and playback control systems
- **Logging**: Enhanced logging for download operations, runtime detection, and cookie management

---

## [1.0.1] - 2026-01-25

### Fixed
- Fixed progress tracking issues during song downloads
- Fixed extraction issues when installing or processing downloaded assets
- Improved stability of native binary setup on first launch

### Improved
- More reliable handling of background tasks (download & extract)
- Minor internal performance optimizations

### Build
- Updated build workflow for faster and more stable release generation

---

## [1.0.0] - 2026-01-25

### 🎉 Initial Stable Release
First public release of **Virtual Karaoke**.

### Added
- Electron-based desktop karaoke application
- MP4 karaoke video playback with dedicated display window
- Dual-window architecture:
  - Karaoke display window (performer view)
  - Control panel window (operator view)
- Remote control system accessible via:
  - Web browser (LAN)
  - Android Remote Controller app
- QR code–based instant connection for remote devices
- Automatic song scanning and indexing from user-selected directory
- 6-digit song code system for fast queuing
- Song browsing, searching, filtering, and sorting
- Idle screen customization:
  - Static background images
  - Looping idle videos
- Background idle music support
- Real-time communication using WebSockets
- Download manager for fetching new karaoke songs online
- Multi-client remote support (multiple users can queue songs)
- Advanced system controls (shutdown, connection info)
- Persistent settings with automatic saving

### Settings
- Visual customization (fonts, display modes, window sizes)
- Audio configuration (idle music, announcements)
- Network configuration (LAN & remote ports)
- Song directory management

### Platform Support
- Windows
- macOS
- Linux

---

**Happy singing! 🎤🎶**
