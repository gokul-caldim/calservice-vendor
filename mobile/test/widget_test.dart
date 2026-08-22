import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';

void main() {
  testWidgets('App starts at the splash screen, then routes to login when signed out', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: App()));

    expect(find.text('Verifying session...'), findsOneWidget);

    // Session restore reads from flutter_secure_storage, a real platform
    // channel call — tester.pump() alone advances a fake clock and never
    // lets that real Future resolve, so runAsync is needed here.
    await tester.runAsync(() async {
      await Future.delayed(const Duration(milliseconds: 300));
    });
    await tester.pump();
    await tester.pump();
    await tester.pump();

    expect(find.text('Employee Sign In'), findsOneWidget);
  });
}
