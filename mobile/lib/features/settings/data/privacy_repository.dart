import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'privacy_api.dart';

class PrivacyRepository {
  PrivacyRepository(this._api);

  final PrivacyApi _api;

  /// The backend returns the data dossier as a plain JSON response (no file
  /// headers) — the web app builds a Blob and triggers a browser download.
  /// On Android there's no equivalent, so this writes the JSON to a temp
  /// file and hands it to the native share sheet (save to Files, email,
  /// etc.), which is the standard way to deliver a generated file on
  /// Android.
  Future<void> exportAndShareData({required String username}) async {
    final data = await _api.exportData();
    final pretty = const JsonEncoder.withIndent('  ').convert(data);

    final dir = await getTemporaryDirectory();
    final safeUsername = username.isEmpty ? 'employee' : username;
    final file = File('${dir.path}/workforce-dossier-export-$safeUsername.json');
    await file.writeAsString(pretty);

    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'application/json')],
        subject: 'CalServices Workforce Data Export',
      ),
    );
  }

  /// Returns the confirmation message from the backend.
  Future<String> deactivateAccount({required String password, String reason = ''}) async {
    final json = await _api.deactivateAccount(password: password, reason: reason);
    return json['message'] as String? ??
        'Your Workforce account has been safely deactivated.';
  }
}

final privacyRepositoryProvider = Provider<PrivacyRepository>((ref) {
  return PrivacyRepository(ref.watch(privacyApiProvider));
});
