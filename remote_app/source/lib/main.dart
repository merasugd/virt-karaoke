import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';

void main() {
  runApp(const RemoteControllerApp());
}

class RemoteControllerApp extends StatelessWidget {
  const RemoteControllerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Remote Control',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: ThemeMode.system,
      home: const InputScreen(),
    );
  }
}

// QR Code validation result
class QRValidationResult {
  final bool isValid;
  final String? ip;
  final String? port;
  final String? signature;
  final String errorMessage;

  QRValidationResult.success({
    required this.ip,
    required this.port,
    required this.signature,
  })  : isValid = true,
        errorMessage = '';

  QRValidationResult.error(this.errorMessage)
      : isValid = false,
        ip = null,
        port = null,
        signature = null;
}

class InputScreen extends StatefulWidget {
  const InputScreen({super.key});

  @override
  State<InputScreen> createState() => _InputScreenState();
}

class _InputScreenState extends State<InputScreen> {
  final TextEditingController _ipController = TextEditingController();
  final TextEditingController _portController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = true;
  bool _isConnecting = false;

  @override
  void initState() {
    super.initState();
    _loadSavedCredentials();
  }

  Future<void> _loadSavedCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedIp = prefs.getString('ip') ?? '';
      final savedPort = prefs.getString('port') ?? '';
      
      if (mounted) {
        setState(() {
          _ipController.text = savedIp;
          _portController.text = savedPort;
          _isLoading = false;
        });

        // Auto-connect if credentials exist
        if (savedIp.isNotEmpty && savedPort.isNotEmpty) {
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) {
            _connect();
          }
        }
      }
    } catch (e) {
      debugPrint('Error loading credentials: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _saveCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('ip', _ipController.text.trim());
      await prefs.setString('port', _portController.text.trim());
    } catch (e) {
      debugPrint('Error saving credentials: $e');
    }
  }

  bool _validateIP(String ip) {
    final parts = ip.split('.');
    if (parts.length != 4) return false;
    
    for (var part in parts) {
      final num = int.tryParse(part);
      if (num == null || num < 0 || num > 255) return false;
    }
    return true;
  }

  Future<bool> _validateConnection(String ip, String port) async {
    try {
      final url = Uri.parse('http://$ip:$port/');
      final response = await http.get(url).timeout(
        const Duration(seconds: 5),
      );
      return response.statusCode >= 200 && response.statusCode < 400;
    } catch (e) {
      debugPrint('Connection validation error: $e');
      return false;
    }
  }

  void _connect() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final ip = _ipController.text.trim();
    final port = _portController.text.trim();

    setState(() {
      _isConnecting = true;
    });

    final isConnectable = await _validateConnection(ip, port);
    
    if (mounted) {
      setState(() {
        _isConnecting = false;
      });

      if (!isConnectable) {
        _showErrorDialog(
          'Connection Failed',
          'Unable to connect to http://$ip:$port/\n\n'
          'Please check:\n'
          '• IP address is correct\n'
          '• Port number is correct\n'
          '• Remote Control Server is running\n'
          '• You are on the same network',
        );
        return;
      }

      await _saveCredentials();

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => WebViewScreen(ip: ip, port: port),
        ),
      );
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade700,
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'OK',
          textColor: Colors.white,
          onPressed: () {},
        ),
      ),
    );
  }

  void _showErrorDialog(String title, String message) {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.error_outline, color: Colors.red, size: 48),
        title: Text(title),
        content: Text(message),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _openQRScanner() async {
    try {
      // Check camera permission
      final status = await Permission.camera.request();
      
      if (!mounted) return;
      
      if (status.isDenied) {
        _showErrorDialog(
          'Camera Permission Required',
          'Camera permission is needed to scan QR codes.\n\n'
          'Please grant camera permission to use this feature.',
        );
        return;
      }
      
      if (status.isPermanentlyDenied) {
        final openSettings = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            icon: const Icon(Icons.camera_alt_outlined, size: 48),
            title: const Text('Camera Permission Required'),
            content: const Text(
              'Camera permission is permanently denied.\n\n'
              'Please enable camera permission in app settings to scan QR codes.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Open Settings'),
              ),
            ],
          ),
        );
        
        if (openSettings == true && mounted) {
          await openAppSettings();
        }
        return;
      }
      
      if (!status.isGranted) {
        return;
      }

      // Permission granted, open scanner
      if (!mounted) return;
      
      final result = await Navigator.of(context).push<QRValidationResult>(
        MaterialPageRoute(
          builder: (context) => const QRScannerScreen(),
        ),
      );

      if (result != null && mounted) {
        if (result.isValid) {
          setState(() {
            _ipController.text = result.ip!;
            _portController.text = result.port!;
          });
          
          _connect();
        } else {
          _showErrorDialog('Invalid QR Code', result.errorMessage);
        }
      }
    } catch (e) {
      debugPrint('Error opening QR scanner: $e');
      if (mounted) {
        _showErrorDialog('Error', 'Failed to open QR scanner: ${e.toString()}');
      }
    }
  }

  Future<void> _clearCredentials() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Saved Connection'),
        content: const Text('Are you sure you want to clear the saved IP and port?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('ip');
      await prefs.remove('port');
      
      if (mounted) {
        setState(() {
          _ipController.clear();
          _portController.clear();
        });
        
        _showError('Credentials cleared');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading...'),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Remote Control'),
        centerTitle: true,
        actions: [
          if (_ipController.text.isNotEmpty || _portController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              tooltip: 'Clear saved credentials',
              onPressed: _clearCredentials,
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),
                Icon(
                  Icons.settings_remote,
                  size: 100,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  'Virtual Karaoke Remote',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Connect to your Virtual Karaoke Instance',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 48),
                TextFormField(
                  controller: _ipController,
                  decoration: const InputDecoration(
                    labelText: 'IP Address',
                    hintText: '192.168.1.100',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.computer),
                    helperText: 'Enter the IP address of your Virtual Karaoke Instance',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter an IP address';
                    }
                    if (!_validateIP(value.trim())) {
                      return 'Please enter a valid IP address';
                    }
                    return null;
                  },
                  textInputAction: TextInputAction.next,
                  enabled: !_isConnecting,
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _portController,
                  decoration: const InputDecoration(
                    labelText: 'Port',
                    hintText: '4646',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.router),
                    helperText: 'Enter the port number',
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter a port number';
                    }
                    final port = int.tryParse(value.trim());
                    if (port == null || port < 1 || port > 65535) {
                      return 'Please enter a valid port (1-65535)';
                    }
                    return null;
                  },
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _connect(),
                  enabled: !_isConnecting,
                ),
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: _isConnecting ? null : _connect,
                  icon: _isConnecting 
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.play_arrow),
                  label: Text(_isConnecting ? 'Connecting...' : 'Connect'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _isConnecting ? null : _openQRScanner,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Scan QR Code'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.info_outline,
                              size: 20,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Quick Tips',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildTipItem('Find your IP in Virtual Karaoke Window'),
                        _buildTipItem('Default port is usually 4646'),
                        _buildTipItem('Use QR code for quick & secure setup'),
                        _buildTipItem('QR code must be from Virtual Karaoke'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTipItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(fontSize: 16)),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _ipController.dispose();
    _portController.dispose();
    super.dispose();
  }
}

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  bool _scanned = false;
  bool _torchEnabled = false;
  bool _isValidating = false;
  MobileScannerController? _cameraController;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
  }

  void _initializeCamera() {
    try {
      _cameraController = MobileScannerController(
        detectionSpeed: DetectionSpeed.noDuplicates,
        facing: CameraFacing.back,
      );
      _cameraController?.start();
    } catch (e) {
      debugPrint('Error initializing camera: $e');
    }
  }

  Future<QRValidationResult> _validateQRCode(String qrData) async {
    if (mounted) {
      setState(() {
        _isValidating = true;
      });
    }

    try {
      // Parse QR code JSON
      final Map<String, dynamic> data;
      try {
        data = jsonDecode(qrData);
      } catch (e) {
        return QRValidationResult.error(
          'Invalid QR Code Format\n\n'
          'The QR code is not in the correct JSON format.\n'
          'Please use a QR code generated by Virtual Karaoke.'
        );
      }

      // Check for required fields
      final ip = data['ip']?.toString();
      final port = data['port']?.toString();
      final qrSignature = data['signature']?.toString();

      if (ip == null || ip.isEmpty) {
        return QRValidationResult.error(
          'Missing IP Address\n\n'
          'The QR code does not contain an IP address.\n'
          'Please generate a new QR code from Virtual Karaoke.'
        );
      }

      if (port == null || port.isEmpty) {
        return QRValidationResult.error(
          'Missing Port Number\n\n'
          'The QR code does not contain a port number.\n'
          'Please generate a new QR code from Virtual Karaoke.'
        );
      }

      if (qrSignature == null || qrSignature.isEmpty) {
        return QRValidationResult.error(
          'Missing Signature\n\n'
          'This QR code does not contain a Virtual Karaoke signature.\n'
          'Please use only QR codes generated by Virtual Karaoke for security.'
        );
      }

      // Validate IP format
      if (!_validateIP(ip)) {
        return QRValidationResult.error(
          'Invalid IP Address\n\n'
          'The IP address "$ip" in the QR code is not valid.\n'
          'Please generate a new QR code from Virtual Karaoke.'
        );
      }

      // Validate port number
      final portNum = int.tryParse(port);
      if (portNum == null || portNum < 1 || portNum > 65535) {
        return QRValidationResult.error(
          'Invalid Port Number\n\n'
          'The port "$port" in the QR code is not valid.\n'
          'Please generate a new QR code from Virtual Karaoke.'
        );
      }

      // Fetch signature from VK system
      String serverSignature;
      try {
        final sigUrl = Uri.parse('http://$ip:5151/sig');
        final response = await http.get(sigUrl).timeout(
          const Duration(seconds: 5),
        );

        if (response.statusCode != 200) {
          return QRValidationResult.error(
            'Cannot Verify Signature\n\n'
            'Unable to connect to Virtual Karaoke at $ip:5151\n\n'
            'Error: HTTP ${response.statusCode}\n\n'
            'Please check:\n'
            '• Virtual Karaoke is running\n'
            '• You are on the same network\n'
            '• Firewall allows connection'
          );
        }

        serverSignature = response.body.trim();
      } catch (e) {
        return QRValidationResult.error(
          'Connection Failed\n\n'
          'Unable to connect to Virtual Karaoke at $ip:5151\n\n'
          'Error: ${e.toString()}\n\n'
          'Please check:\n'
          '• Remote Control Server is running\n'
          '• IP address is correct\n'
          '• You are on the same network\n'
          '• Firewall allows connection'
        );
      }

      // Validate signature
      if (serverSignature != qrSignature) {
        return QRValidationResult.error(
          'Invalid Signature\n\n'
          'The QR code signature does not match the Virtual Karaoke system.\n\n'
          'This could mean:\n'
          '• QR code is outdated\n'
          '• Wrong Virtual Karaoke Instance\n'
          '• QR code was tampered with\n\n'
          'Please generate a new QR code from the correct Virtual Karaoke Instance.'
        );
      }

      // All validations passed!
      return QRValidationResult.success(
        ip: ip,
        port: port,
        signature: qrSignature,
      );

    } finally {
      if (mounted) {
        setState(() {
          _isValidating = false;
        });
      }
    }
  }

  bool _validateIP(String ip) {
    final parts = ip.split('.');
    if (parts.length != 4) return false;
    
    for (var part in parts) {
      final num = int.tryParse(part);
      if (num == null || num < 0 || num > 255) return false;
    }
    return true;
  }

  void _handleBarcode(BarcodeCapture capture) async {
    if (_scanned || _isValidating) return;

    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final String? code = barcode.rawValue;
      if (code != null) {
        setState(() {
          _scanned = true;
        });

        // Haptic feedback
        HapticFeedback.mediumImpact();

        _cameraController?.stop();

        // Validate QR code
        final result = await _validateQRCode(code);

        if (mounted) {
          Navigator.of(context).pop(result);
        }
        return;
      }
    }
  }

  void _toggleTorch() {
    setState(() {
      _torchEnabled = !_torchEnabled;
    });
    _cameraController?.toggleTorch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(
              _torchEnabled ? Icons.flash_on : Icons.flash_off,
              color: _torchEnabled ? Colors.yellow : Colors.white,
            ),
            onPressed: _toggleTorch,
            tooltip: 'Toggle flash',
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_android),
            onPressed: () => _cameraController?.switchCamera(),
            tooltip: 'Switch camera',
          ),
        ],
      ),
      body: _cameraController == null
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : Stack(
              children: [
                MobileScanner(
                  controller: _cameraController!,
                  onDetect: _handleBarcode,
                ),
                // Scanning frame overlay
                CustomPaint(
                  painter: ScannerOverlayPainter(),
                  child: const SizedBox.expand(),
                ),
                // Center frame
                Center(
                  child: Container(
                    width: 300,
                    height: 300,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: _isValidating ? Colors.orange : Colors.blue,
                        width: 3,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Stack(
                      children: [
                        _buildCornerAccent(Alignment.topLeft),
                        _buildCornerAccent(Alignment.topRight),
                        _buildCornerAccent(Alignment.bottomLeft),
                        _buildCornerAccent(Alignment.bottomRight),
                      ],
                    ),
                  ),
                ),
                // Instructions
                Positioned(
                  bottom: 100,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: _isValidating ? Colors.orange : Colors.blue, 
                          width: 1,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_isValidating) ...[
                            const SizedBox(
                              width: 32,
                              height: 32,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: Colors.orange,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Validating QR Code...',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ] else ...[
                            const Icon(Icons.qr_code_scanner, color: Colors.white, size: 32),
                            const SizedBox(height: 8),
                            const Text(
                              'Scan Virtual Karaoke QR Code',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'QR must include signature',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildCornerAccent(Alignment alignment) {
    return Align(
      alignment: alignment,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          border: Border(
            top: alignment.y < 0
                ? BorderSide(
                    color: _isValidating ? Colors.orange : Colors.blue, 
                    width: 4,
                  )
                : BorderSide.none,
            bottom: alignment.y > 0
                ? BorderSide(
                    color: _isValidating ? Colors.orange : Colors.blue, 
                    width: 4,
                  )
                : BorderSide.none,
            left: alignment.x < 0
                ? BorderSide(
                    color: _isValidating ? Colors.orange : Colors.blue, 
                    width: 4,
                  )
                : BorderSide.none,
            right: alignment.x > 0
                ? BorderSide(
                    color: _isValidating ? Colors.orange : Colors.blue, 
                    width: 4,
                  )
                : BorderSide.none,
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }
}

// Custom painter for scanner overlay
class ScannerOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final centerRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: 300,
      height: 300,
    );

    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(centerRect, const Radius.circular(16)))
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class WebViewScreen extends StatefulWidget {
  final String ip;
  final String port;

  const WebViewScreen({super.key, required this.ip, required this.port});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _errorMessage;
  bool _showControls = false;

  @override
  void initState() {
    super.initState();
    _initializeWebView();
  }

  void _initializeWebView() {
    try {
      // Keep system UI visible to avoid notch/camera cutout
      SystemChrome.setEnabledSystemUIMode(
        SystemUiMode.edgeToEdge,
        overlays: [SystemUiOverlay.top, SystemUiOverlay.bottom],
      );

      final url = 'http://${widget.ip}:${widget.port}/';
      
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.black)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (String url) {
              if (mounted) {
                setState(() {
                  _isLoading = true;
                  _errorMessage = null;
                });
              }
            },
            onPageFinished: (String url) {
              if (mounted) {
                setState(() {
                  _isLoading = false;
                });
              }
            },
            onWebResourceError: (WebResourceError error) {
              if (mounted) {
                setState(() {
                  _isLoading = false;
                  _errorMessage = 'Cannot load Remote Control\n\n${error.description}';
                });
              }
            },
          ),
        )
        ..loadRequest(Uri.parse(url));
    } catch (e) {
      debugPrint('Error initializing WebView: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to initialize: ${e.toString()}';
        });
      }
    }
  }

  void _reconnect() async {
    await SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => const InputScreen(),
        ),
      );
    }
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) async {
        await SystemChrome.setEnabledSystemUIMode(
          SystemUiMode.manual,
          overlays: SystemUiOverlay.values,
        );
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: _showControls ? AppBar(
          backgroundColor: Colors.black87,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _reconnect,
            tooltip: 'Disconnect',
          ),
          title: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Virtual Karaoke',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
              Text(
                '${widget.ip}:${widget.port}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal),
              ),
            ],
          ),
          centerTitle: true,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => _controller.reload(),
              tooltip: 'Reload',
            ),
          ],
        ) : null,
        body: GestureDetector(
          onLongPress: _toggleControls,
          child: SafeArea(
            // Don't apply SafeArea when controls are showing (AppBar handles it)
            top: !_showControls,
            bottom: true,
            child: Stack(
              children: [
                WebViewWidget(controller: _controller),
                
                // Loading indicator
                if (_isLoading)
                  Container(
                    color: Colors.black,
                    child: const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: 16),
                          Text(
                            'Connecting to Virtual Karaoke...',
                            style: TextStyle(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                
                // Error message
                if (_errorMessage != null)
                  Container(
                    color: Colors.black,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.error_outline,
                              size: 64,
                              color: Colors.red,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 16,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'http://${widget.ip}:${widget.port}/',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.white.withValues(alpha: 0.7),
                              ),
                            ),
                            const SizedBox(height: 24),
                            FilledButton.icon(
                              onPressed: _reconnect,
                              icon: const Icon(Icons.settings),
                              label: const Text('Change Connection'),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _isLoading = true;
                                  _errorMessage = null;
                                });
                                _controller.reload();
                              },
                              icon: const Icon(Icons.replay),
                              label: const Text('Retry Connection'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                
                // Hint text when controls are hidden
                if (!_showControls && !_isLoading && _errorMessage == null)
                  Positioned(
                    top: 8,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Text(
                          'Long press to show controls',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    super.dispose();
  }
}