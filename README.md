# 🎤 Virtual Karaoke

A open-source desktop karaoke application built with Electron, React, and TypeScript. Host karaoke performances on your local network with a dedicated control interface and remote client access.

---

## 📋 Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [First Run Setup](#first-run-setup)
- [How to Use](#how-to-use)
  - [Main Interface](#main-interface)
  - [Settings Configuration](#settings-configuration)
  - [Hosting a Karaoke Session](#hosting-a-karaoke-session)
  - [Remote Control](#remote-control)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings Guide](#settings-guide)
- [Network Configuration](#network-configuration)
- [Troubleshooting](#troubleshooting)
- [Building the Remote Controller App](#building-the-remote-controller-app)
- [For Developers](#for-developers)

---

## ✨ Features

- **🎵 MP4 Karaoke Support**: Play karaoke songs in MP4 format with built-in video display
- **🖥️ Dual Interface**: Separate display window for performers and control panel for operators
- **📱 Remote Control**: Connect remote clients over your local network to queue, manage, and even download songs
- **📲 QR Code Connection**: Instantly connect remote devices by scanning a QR code
- **🎨 Customizable Idle Screen**: Set custom background images or looping videos when no song is playing
- **🎧 Background Music**: Set looping background music to play during idle periods
- **🎯 Song Database**: Automatic song detection and management with searchable interface
- **⚙️ Advanced Settings**: Customize fonts, display modes, window sizes, and network ports
- **📡 WebSocket-Based Communication**: Real-time updates between control panel and remote clients

---

## 🚀 Getting Started

### Installation

1. **Download the latest release** for your platform from the [Releases page](https://github.com/merasugd/virt-karaoke/releases)
2. **Install the application**:
   - **Windows**: Run the `.exe` installer
   - **macOS**: Open the `.dmg` and drag the app to Applications
   - **Linux**: Use the `.AppImage` and run
3. Launch **Virtual Karaoke** from your applications menu

> The app is pre-packaged; no Node.js or FFmpeg installation is required.

> Some native binaries (e.g., FFmpeg, YTDLP, 7zip, etc.) will be installed the first time you launch the app.

### First Run Setup

On your first launch, Virtual Karaoke will:

1. **Ask for your songs directory** – select the folder containing your MP4 karaoke files
2. **Scan your songs** – the app automatically detects all MP4 files in the directory and nested folders
3. **Initialize settings** – default settings are created; you can customize them later
4. **Show the main interface** – ready to start hosting!

> **Tip**: Songs must follow the filename format:
> ```
> (Title) - (Artist).mp4
> ```
> Example: `Bohemian Rhapsody - Queen.mp4`

---

## 📖 How to Use

### Main Interface Window
#### **Header & Status**
- Displays the app name and current hosting status
- Shows LAN IP and port information when hosting is active
- **QR Code Display**: Scan to quickly connect remote devices

#### **Hosting Controls**
- **Host Karaoke Button**: Start a karaoke session
  - Opens a full-screen display window
  - Shows the video and lyrics of the current song
  - Displays idle screen/background music when queue is empty

#### **Settings Button**
- Opens the settings panel for customization
- All changes are saved automatically


---

### Settings Configuration

#### **Visual Settings**

**Idle Mode**
- **Image**: Display a static background while idle
- **Video**: Display looping video files while idle

**Idle Background Image**: Browse and select your preferred image

**Idle Looping Videos**: Import MP4 videos to rotate during idle

**Custom Font**: Load a TrueType font (`.ttf`) for karaoke display

**View Mode**
- Fullscreen
- Windowed
- Borderless

**Window Size**
- Set custom width and height (default: 1920×1080)

#### **Audio Settings**

**Loop Idle Music**
- Enable/disable background music during idle periods
- Add MP3/WAV files for background music rotation

**Announce Keys**
- Announce actions with Text-To-Speech

#### **Network Settings**

**LAN Port** (Karaoke display)
- Default: `4545`

**Remote Port** (Remote control)
- Default: `4646`

#### **Song Directory**

**Search Path**
- Folder containing MP4 karaoke files
- MP4 filenames **must follow**: `(Title) - (Artist).mp4`

---

### Hosting a Karaoke Session

1. Ensure your songs are in the configured directory
2. Connect your display monitor
3. Click **"Open Karaoke"**
4. Idle screen appears if no song is queued
5. Search and queue songs from the control panel
6. Song videos display on the karaoke window
7. Song progress shows in the control panel
8. Click **Advanced** and **Shutdown** on remote to stop the karaoke.

---

### Remote Control

Remote Control allows other devices to queue and download songs from the karaoke system. There are two ways to access the remote control interface.

---

#### **Connecting to Remote Control**

**Option 1: Web Browser (Any Device)**

1. **Start hosting** on the main karaoke application
2. **Find the connection details** displayed on the main interface:
   - LAN IP address (e.g., `192.168.1.100`)
   - Remote Port (default: `4646`)
3. **On your remote device** (phone, tablet, or laptop):
   - Open any web browser (Chrome, Safari, Firefox, etc.)
   - Enter the URL: `http://[IP_ADDRESS]:[PORT]`
   - Example: `http://192.168.1.100:4646`
4. **Wait for connection** - a green status indicator appears when connected

**Option 2: Android Remote Controller App**

A dedicated **Remote Controller for Virtual Karaoke** Android app is available for an enhanced mobile experience with QR code scanning.

**Installation**:
- Download the APK from the [Releases page](https://github.com/merasugd/virt-karaoke/releases)
- Or build from source (see [Building the Remote Controller App](#building-the-remote-controller-app))

**Connecting via QR Code** (Fastest Method):
1. Install and open the Remote Controller app on your Android device
2. Tap **"Scan QR Code"**
3. On the main karaoke interface, a QR code is displayed when hosting is active
4. Point your camera at the QR code
5. The app will automatically connect to the karaoke system

**Connecting Manually**:
1. Open the Remote Controller app
2. Enter the IP address (e.g., `192.168.1.100`)
3. Enter the port number (default: `4646`)
4. Tap **"Connect"**

**Connection Indicators**:
- 🔴 **Red dot** = Disconnected
- 🟡 **Yellow dot** = Connecting
- 🟢 **Green dot** = Connected and ready

---

#### **Using the Remote Control Interface**

The remote control has four main tabs:

##### **1. Remote Tab (Main Control)**

This is your primary control panel for queuing songs.

**Current Code Display**: Shows the 6-digit code you're entering (e.g., `000123`)

**Number Pad**:
- Tap digits `0-9` to build a song code
- Each song has a unique 6-digit ID
- Codes are displayed with leading zeros (e.g., `000042`)

**Control Buttons**:
- **← Delete**: Remove the last digit entered
- **Enter Song**: Queue the current code to play
- **Skip Current Song**: Skip the currently playing song

**Queue Display**: Shows upcoming songs in order (e.g., "Queue: 000123 → 000456 → 000789")

**Keyboard Shortcuts** (Web Browser Only):
- Press `0-9` keys to enter digits
- Press `Backspace` or `Delete` to remove last digit
- Press `Enter` to queue the song

**Workflow**:
1. Look up a song code (from the Songs tab or songbook)
2. Enter the 6-digit code using the number pad
3. Press **Enter Song** to add it to the queue
4. The song will play when it's next in line

##### **2. Songs Tab (Browse & Search)**

Browse and search all available karaoke songs.

**Search Bar**:
- Type to search by song title or artist name
- Results update as you type
- Searches both title and artist fields

**Sorting Options**:
- **Title (A→Z / Z→A)**: Alphabetical by song title
- **Artist (A→Z / Z→A)**: Alphabetical by artist name
- **Song ID (Low→High / High→Low)**: Numerical by song code

**Filter by Letter**:
- Use the dropdown or letter buttons to filter by first letter
- Click **All** to show all songs
- Click **#** for songs starting with numbers

**Song List**:
- Songs are grouped by first letter
- Each entry shows:
  - **Song ID** (6-digit code in yellow)
  - **Title** (large white text)
  - **Artist** (smaller gray text)
- **Tap any song** to:
  - Auto-fill its code in the Remote tab
  - Automatically switch to the Remote tab
  - Ready to press "Enter Song"

**Pagination**:
- Use `«` `‹` `›` `»` buttons to navigate pages
- Shows 50 songs per page
- Jump to specific page using the page number input

**Song Count**: Displayed at bottom (e.g., "1,234 song(s) total")

##### **3. Download Tab (Get New Songs)**

Download additional karaoke songs from online sources.

**Two Sub-Tabs**:

**Search Sub-Tab**:
- **Search Bar**: Type song title or artist to find downloadable songs
- **Search Results**: Shows matching songs from external sources
- **Tap a song** to see download confirmation dialog
- **Confirm download** to start

**Active Downloads Section**:
- Shows real-time progress of ongoing downloads
- Progress bar with percentage
- Status indicators:
  - 🔍 **Searching...**: Looking for the video
  - ⬇️ **Downloading...**: Download in progress
  - ✅ **Complete**: Download finished
  - ❌ **Error**: Download failed
- Completed downloads appear in Songs tab after 5 seconds

**Downloaded Sub-Tab**:
- View all songs you've downloaded
- Each entry shows title, artist, and filename
- **🗑️ Delete button**: Remove downloaded songs
- **🔄 Refresh button**: Update the list
- Downloaded songs automatically appear in the main song list

**Download Workflow**:
1. Switch to **Download** tab
2. In **Search** sub-tab, type a song name
3. Browse results and tap desired song
4. Confirm download in popup
5. Monitor progress in **Active Downloads**
6. Once complete, switch to **Downloaded** sub-tab to verify
7. Find the new song in the **Songs** tab

##### **4. Advanced Tab (System Controls)**

**⚠️ Danger Zone**

**System Shutdown**:
- Completely shuts down the karaoke system
- Stops all playback immediately
- Closes all connections
- Exits the application
- **Requires confirmation** before executing

**Connection Info**:
- Displays current host IP address
- Shows WebSocket port (for real-time updates)
- Shows API port (for commands)
- Useful for troubleshooting connection issues

---

#### **Remote Control Features Summary**

✅ **What You CAN Do**:
- Search and browse all available songs
- Queue songs by entering 6-digit codes
- Queue songs by tapping them in the Songs list
- View the current queue and upcoming songs
- Download new karaoke songs from online sources
- View and manage downloaded songs
- Delete downloaded songs you no longer want
- Skip the currently playing song
- Shut down the entire karaoke system (Advanced tab)

❌ **What You CANNOT Do**:
- Adjust playback volume (uses system volume of the device viewing the karaoke display, no playback volume)
- Pause or resume songs (songs play through or skip)
- Reorder queue after songs are added
- Remove specific songs from the queue

---

#### **Tips for Best Experience**

1. **Keep devices on same network**: Ensure your remote device and karaoke system are on the same Wi-Fi/LAN
2. **Use QR code for fastest setup**: Android app QR scan is quickest connection method
3. **Watch the status dot**: Green = connected and working, Red = connection lost
4. **Use Songs tab for discovery**: Browse and search before queuing
5. **Download during idle time**: Download new songs when karaoke isn't active
6. **Multiple remotes work**: Multiple people can connect and queue songs simultaneously
7. **Bookmark the URL**: Save the web interface URL for easy reconnection

---

#### **Troubleshooting Remote Connection**

**"Cannot connect" or red status dot**:
- Verify karaoke hosting is active
- Confirm both devices are on same network
- Check firewall settings (port 4646 must be open)
- Try entering IP address manually instead of QR code
- Restart the karaoke application

**"Songs not loading"**:
- Wait a few seconds for initial sync
- Check WebSocket connection (status dot should be green)
- Refresh the browser page
- Clear browser cache

**"Download fails"**:
- Ensure internet connection is active on karaoke system
- Check if song name is spelled correctly
- Try different search terms
- Some songs may not be available online

**"QR code won't scan"** (Android app):
- Ensure camera permissions are granted to the app
- Make sure QR code is fully visible and not blurry
- Try manual connection instead
- Check lighting conditions

**"Entered code but nothing happens"**:
- Verify the song code exists (check Songs tab)
- Ensure you pressed "Enter Song" button
- Check queue display to confirm song was added
- Wait for current song to finish playing

---

## 🌐 Network Configuration

- Ensure remote devices are on the same LAN
- Open firewall ports if necessary
- Only local network connections are supported

---

## 🐛 Troubleshooting

- **App won't start**: Verify songs directory exists; check ports 4545 & 4646
- **Songs not found**: Ensure filenames follow `(Title) - (Artist).mp4`
- **Remote not connecting**: Confirm LAN IP and ports; devices on same network
- **QR code not scanning**: Ensure the Android app has camera permissions
- **Videos freeze**: Check MP4 format, resolution, or re-encode with H.264

---

## 📱 Building the Remote Controller App

The Remote Controller for Virtual Karaoke is a Flutter application located in `remote_app/source/`. While we provide pre-built APK files for Android, you can build the app for other platforms yourself.

### Prerequisites

- [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.0 or higher)
- Platform-specific requirements (see below)
- Git

### Setup

1. **Navigate to the app directory**:
   ```bash
   cd remote_app/source
   ```

2. **Install dependencies**:
   ```bash
   flutter pub get
   ```

### Building for Android

**Requirements**:
- Android Studio or VS Code with Flutter extensions
- Android SDK (API level 21 or higher)

**Build APK**:
```bash
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk`

**Build App Bundle (for Play Store)**:
```bash
flutter build appbundle --release
```

**Install on connected device**:
```bash
flutter install
```

### Building for iOS

**Requirements**:
- macOS with Xcode installed
- Apple Developer account (for device deployment)
- CocoaPods

**Build IPA**:
```bash
flutter build ios --release
```

**Run on connected device**:
```bash
flutter run --release
```

> **Note**: Code signing required for physical devices. Configure in Xcode.

### Building for Windows

**Requirements**:
- Windows 10 or higher
- Visual Studio 2022 with C++ development tools

**Build executable**:
```bash
flutter build windows --release
```
Output: `build/windows/runner/Release/`

### Building for macOS

**Requirements**:
- macOS with Xcode installed
- CocoaPods

**Build app**:
```bash
flutter build macos --release
```
Output: `build/macos/Build/Products/Release/`

### Building for Linux

**Requirements**:
- Linux with development libraries:
  ```bash
  sudo apt-get install clang cmake ninja-build pkg-config libgtk-3-dev
  ```

**Build executable**:
```bash
flutter build linux --release
```
Output: `build/linux/x64/release/bundle/`

### Building for Web

**Build web app**:
```bash
flutter build web --release
```
Output: `build/web/`

Deploy the `build/web/` directory to any web server.

### Development Mode

Run the app in development with hot-reload:
```bash
flutter run
```

Select your target device when prompted.

### Testing

Run tests:
```bash
flutter test
```

### Troubleshooting

- **Dependencies not installing**: Run `flutter clean` then `flutter pub get`
- **Build errors**: Ensure Flutter SDK is up to date with `flutter upgrade`
- **Platform issues**: Check [Flutter platform setup guides](https://flutter.dev/docs/get-started/install)

For more details on the Android app architecture and features, see `remote_app/source/README.md`.

---

## 💻 For Developers

### Development Setup

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- Git

#### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/merasugd/virt-karaoke.git
   cd virt-karaoke
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

   This will start both the Electron app and the development server with hot-reload enabled.

### Available Scripts

- **`npm run dev`** - Start development server with hot-reload
- **`npm run build`** - Build for production
- **`npm run lint`** - Run ESLint
- **`npm run format`** - Format code with Prettier

### Building for Production

#### Windows
```bash
npm run build:win
```

#### macOS
```bash
npm run build:mac
```

#### Linux
```bash
npm run build:linux
```

Built applications will be in the `dist/` directory.

### Technology Stack

- **Frontend**: React 19 + TypeScript
- **Desktop Framework**: Electron
- **Build Tool**: Vite
- **Styling**: CSS Modules / Tailwind CSS
- **Communication**: WebSocket (ws library) and Inter-Process Communication (IPC)
- **Video Playback**: HTML5 Video API

### Key Components

- **Main Process** (`src/main/`): Handles window management, file system operations, and all server handlers.
- **Renderer Process** (`src/renderer/`): React UI for control panel and karaoke display
- **Preload Scripts** (`src/preload/`): Secure IPC bridge between main and renderer

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for type safety
- Write meaningful commit messages
- Add comments for complex logic

### Debugging

**Main Process**:
```bash
npm run dev
# Then attach debugger to the main process (port 9229)
```

**Renderer Process**:
- Open DevTools in the Electron window: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)

### License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

---

**Happy singing! 🎤🎵**
