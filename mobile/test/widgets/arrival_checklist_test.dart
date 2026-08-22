import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/jobs/domain/job.dart';
import 'package:mobile/features/jobs/domain/pre_service_status.dart';
import 'package:mobile/features/jobs/presentation/providers/pre_service_status_provider.dart';
import 'package:mobile/features/jobs/presentation/widgets/arrival_checklist_section.dart';

void main() {
  group('ArrivalChecklistSection', () {
    final testJob = Job(
      id: 101,
      requestId: 'REQ-101',
      status: 'accepted',
      isOffer: false,
      isAcceptedByCurrentEmployee: true,
      isAssignedToCurrentEmployee: true,
      canCancel: true,
    );

    testWidgets('shows locked Step 2 when geofence is not passed', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            preServiceStatusProvider(101).overrideWith(
              (ref) => Stream.value(PreServiceStatus.initial),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ArrivalChecklistSection(job: testJob),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('ARRIVAL & VERIFICATION CHECKLIST'), findsOneWidget);
      expect(find.text('1. Location Verification (Geofence ≤250m)'), findsOneWidget);
      expect(find.text('Verify Arrival Now'), findsOneWidget);
      expect(find.text('🔒 UNLOCKS ON ARRIVAL'), findsOneWidget);
      expect(find.text('CLOCK IN & START WORK'), findsNothing);
    });

    testWidgets('shows unlocked OTP and photo upload slots when geofence passed', (
      WidgetTester tester,
    ) async {
      final arrivedStatus = PreServiceStatus(
        geofencePassed: true,
        otpVerified: false,
        presencePhoto: false,
        appliancePhoto: false,
        workAreaPhoto: false,
        isComplete: false,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            preServiceStatusProvider(101).overrideWith(
              (ref) => Stream.value(arrivedStatus),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ArrivalChecklistSection(job: testJob),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Arrival verified! You are inside the authorized 250m customer site geofence.'), findsOneWidget);
      expect(find.text('2. Required Pre-Service Evidence'), findsOneWidget);
      expect(find.text('Customer Work Start OTP'), findsOneWidget);
      expect(find.text('Verify OTP'), findsOneWidget);
      expect(find.text('Resend'), findsOneWidget);
      expect(find.text('Before Face Selfie (Technician Identity)'), findsOneWidget);
      expect(find.text('Before Product / Appliance Photo'), findsOneWidget);
      expect(find.text('Before Work-Area Photo'), findsOneWidget);
      expect(find.text('CLOCK IN & START WORK'), findsNothing);
    });

    testWidgets('shows CLOCK IN & START WORK when is_complete is true', (WidgetTester tester) async {
      final completeStatus = PreServiceStatus(
        geofencePassed: true,
        otpVerified: true,
        presencePhoto: true,
        appliancePhoto: true,
        workAreaPhoto: true,
        isComplete: true,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            preServiceStatusProvider(101).overrideWith(
              (ref) => Stream.value(completeStatus),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ArrivalChecklistSection(job: testJob),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Pre-Service Verification Complete!'), findsOneWidget);
      expect(find.text('CLOCK IN & START WORK'), findsOneWidget);
    });
  });
}
