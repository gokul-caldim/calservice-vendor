import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Lets the API client tell the rest of the app "the session just died"
/// (token refresh failed) without the networking layer having to import
/// the auth feature directly.
class AuthEvents {
  final _controller = StreamController<void>.broadcast();

  Stream<void> get onSessionExpired => _controller.stream;

  void notifySessionExpired() => _controller.add(null);

  void dispose() => _controller.close();
}

final authEventsProvider = Provider<AuthEvents>((ref) {
  final events = AuthEvents();
  ref.onDispose(events.dispose);
  return events;
});
