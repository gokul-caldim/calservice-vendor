import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/admin/domain/admin_dashboard_metrics.dart';
import 'package:mobile/features/admin/domain/eligible_technician.dart';
import 'package:mobile/features/admin/domain/fleet_member.dart';
import 'package:mobile/features/admin/presentation/admin_dashboard_providers.dart';
import 'package:mobile/features/admin/presentation/dispatch/admin_dispatch_screen.dart';
import 'package:mobile/features/admin/presentation/jobs/admin_jobs_screen.dart';
import 'package:mobile/features/jobs/domain/job.dart';

final mockJobs = [
  Job(
    id: 3510,
    requestId: 'PA3510',
    customerName: 'Test Customer',
    serviceCategory: 'Painting',
    serviceTitle: 'Painting Home Service',
    status: 'confirmed',
    address: '123 Hosur Main Rd, Bangalore',
    totalAmount: 451.0,
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    preferredDate: '2026-08-21',
    preferredTime: '10:00 AM - 12:00 PM',
    createdAt: DateTime.parse('2026-08-21T09:00:00Z'),
    isOffer: false,
    isAcceptedByCurrentEmployee: false,
    isAssignedToCurrentEmployee: false,
    canCancel: true,
  ),
  Job(
    id: 3509,
    requestId: 'PA3509',
    customerName: 'Test Customer',
    serviceCategory: 'Painting',
    serviceTitle: 'Painting Site Inspection',
    status: 'completed',
    address: '45 Koramangala 4th Block, Bangalore',
    totalAmount: 49.0,
    paymentMethod: 'COD',
    paymentStatus: 'completed',
    preferredDate: '2026-08-21',
    createdAt: DateTime.parse('2026-08-21T08:30:00Z'),
    isOffer: false,
    isAcceptedByCurrentEmployee: false,
    isAssignedToCurrentEmployee: true,
    canCancel: false,
  ),
  Job(
    id: 3504,
    requestId: 'GT3504',
    customerName: 'Thejjaa',
    serviceCategory: 'Logistics',
    serviceTitle: 'Mini truck delivery — 3 Wheeler (General Goods)',
    status: 'unassigned',
    address: '78 Indiranagar 100ft Rd, Bangalore',
    totalAmount: 160.0,
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    preferredDate: '2026-08-22',
    preferredTime: '9AM-10AM',
    createdAt: DateTime.parse('2026-08-22T06:00:00Z'),
    isOffer: false,
    isAcceptedByCurrentEmployee: false,
    isAssignedToCurrentEmployee: false,
    canCancel: true,
  ),
  Job(
    id: 3498,
    requestId: 'SR-3498',
    customerName: 'vignesh',
    serviceCategory: 'Cleaning',
    serviceTitle: 'Full Kitchen cleaning(Basic) with deep degreasing and sanitize',
    status: 'waiting_for_payment',
    address: '99 Electronic City Phase 1, Near Metro Station, Bangalore',
    totalAmount: 1459.0,
    paymentMethod: 'COD',
    paymentStatus: 'waiting_for_payment',
    preferredDate: '2026-08-22',
    preferredTime: '02:00 PM',
    createdAt: DateTime.parse('2026-08-22T05:30:00Z'),
    isOffer: false,
    isAcceptedByCurrentEmployee: false,
    isAssignedToCurrentEmployee: false,
    canCancel: true,
  ),
];

final mockFleet = [
  const FleetMember(
    id: 10,
    employeeId: 'EMP-P3-001',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    isOnline: true,
    currentAvailability: 'available',
    registrationStatus: 'approved',
    hasLocation: true,
    latitude: 12.9716,
    longitude: 77.5946,
    locationStatus: 'Available',
  ),
  const FleetMember(
    id: 11,
    employeeId: 'EMP-P3-002',
    name: 'Amit Patel',
    phone: '+919876543211',
    isOnline: true,
    currentAvailability: 'busy',
    registrationStatus: 'approved',
    hasLocation: true,
    latitude: 12.9352,
    longitude: 77.6245,
    activeJob: 'PA3509',
    locationStatus: 'On Job',
  ),
  const FleetMember(
    id: 12,
    employeeId: 'EMP-P3-003',
    name: 'Vikram Singh',
    phone: '+919876543212',
    isOnline: false,
    currentAvailability: 'offline',
    registrationStatus: 'approved',
    hasLocation: false,
    locationStatus: 'Location unavailable',
  ),
];

final mockCandidates = [
  const EligibleTechnician(
    id: 10,
    employeeId: 'EMP-P3-001',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    latitude: 12.9716,
    longitude: 77.5946,
    isOnline: true,
    currentAvailability: 'available',
    registrationStatus: 'approved',
    approvedServices: ['Painting Home Service', 'Site Inspection'],
    isDispatchReady: true,
    distanceKm: 2.34,
    distanceBand: '0-5km',
    score: 95.0,
    gpsFreshness: 'FRESH',
  ),
  const EligibleTechnician(
    id: 11,
    employeeId: 'EMP-P3-002',
    name: 'Amit Patel',
    phone: '+919876543211',
    isOnline: true,
    currentAvailability: 'busy',
    registrationStatus: 'approved',
    approvedServices: ['Painting Home Service'],
    isDispatchReady: false,
    ineligibilityReason: 'Technician is busy on active job PA3509',
    distanceKm: 5.12,
    distanceBand: '5-10km',
    score: 70.0,
  ),
];

final mockDashboardData = AdminDashboardData(
  jobs: mockJobs,
  fleet: mockFleet,
);

void main() {
  setUp(() {
    AppColors.configure(brightness: Brightness.light, highContrast: false);
  });

  Widget buildTestableWidget(Widget child, {List<Override> overrides = const []}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: child,
      ),
    );
  }

  group('Admin Jobs Module Tests', () {
    testWidgets('AdminJobsScreen renders title, filter chips, and real job cards', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminJobsScreen(),
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(mockJobs)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Customer Jobs & Field Work Orders'), findsOneWidget);
      expect(find.text('PA3510'), findsOneWidget);
      expect(find.text('PA3509'), findsOneWidget);
      expect(find.text('GT3504'), findsOneWidget);
      expect(find.text('SR-3498'), findsOneWidget);

      // Verify customer names & services
      expect(find.text('Test Customer'), findsNWidgets(2));
      expect(find.text('Thejjaa'), findsOneWidget);
      expect(find.text('vignesh'), findsOneWidget);
      expect(find.text('Painting Home Service'), findsOneWidget);

      // Verify payment details formatting
      expect(find.text('₹451.00 COD (pending)'), findsOneWidget);
      expect(find.text('₹160.00 COD (pending)'), findsOneWidget);
      expect(find.text('₹1459.00 COD (waiting for payment)'), findsOneWidget);

      // Verify status filter chips
      expect(find.text('All Statuses'), findsOneWidget);
      expect(find.text('Assigned / Queued'), findsOneWidget);
      expect(find.text('Accepted'), findsOneWidget);
      expect(find.text('On The Way'), findsOneWidget);
      expect(find.text('In Progress'), findsOneWidget);
      expect(find.text('Completed'), findsWidgets);
    });

    testWidgets('AdminJobsScreen filters list by status chips and search query', (tester) async {
      tester.view.physicalSize = const Size(1200, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminJobsScreen(),
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(mockJobs)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Completed' filter chip (the InkWell containing text 'Completed')
      final completedChipFinder = find.widgetWithText(InkWell, 'Completed');
      await tester.ensureVisible(completedChipFinder);
      await tester.tap(completedChipFinder);
      await tester.pumpAndSettle();

      expect(find.text('PA3509'), findsOneWidget);
      expect(find.text('PA3510'), findsNothing);
      expect(find.text('GT3504'), findsNothing);

      // Tap 'All Statuses'
      final allStatusesChipFinder = find.widgetWithText(InkWell, 'All Statuses');
      await tester.ensureVisible(allStatusesChipFinder);
      await tester.tap(allStatusesChipFinder);
      await tester.pumpAndSettle();

      // Search by Customer name 'Thejjaa'
      await tester.enterText(find.byType(TextField), 'Thejjaa');
      await tester.pumpAndSettle();

      expect(find.text('GT3504'), findsOneWidget);
      expect(find.text('PA3510'), findsNothing);
      expect(find.text('PA3509'), findsNothing);
    });

    testWidgets('AdminJobsScreen pagination works correctly', (tester) async {
      tester.view.physicalSize = const Size(1200, 3500);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      // Create a list with 15 jobs to trigger pagination
      final largeJobList = List.generate(
        15,
        (i) => Job(
          id: 4000 + i,
          requestId: 'SR-400$i',
          customerName: 'Customer $i',
          serviceTitle: 'Service $i',
          status: 'confirmed',
          address: 'Address $i',
          isOffer: false,
          isAcceptedByCurrentEmployee: false,
          isAssignedToCurrentEmployee: false,
          canCancel: false,
        ),
      );

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminJobsScreen(),
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(largeJobList)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Showing 1 to 12 of 15 records'), findsOneWidget);
      expect(find.text('Page 1 of 2 (15)'), findsOneWidget);
      expect(find.text('SR-4000'), findsOneWidget);
      expect(find.text('SR-40011'), findsOneWidget);

      // Next Page
      final nextButtonFinder = find.widgetWithText(OutlinedButton, 'Next');
      await tester.tap(nextButtonFinder);
      await tester.pumpAndSettle();

      expect(find.text('Showing 13 to 15 of 15 records'), findsOneWidget);
      expect(find.text('Page 2 of 2 (15)'), findsOneWidget);
      expect(find.text('SR-40014'), findsOneWidget);
    });
  });

  group('Admin Dispatch Module Tests', () {
    testWidgets('AdminDispatchScreen renders metrics, requests, telemetry, and candidate matching', (tester) async {
      tester.view.physicalSize = const Size(800, 2500);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminDispatchScreen(),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Dynamic Dispatch & Fleet Operations'), findsOneWidget);
      expect(find.text('Refresh Fleet Data'), findsOneWidget);

      // Verify Metrics
      expect(find.text('Total Fleet'), findsOneWidget);
      expect(find.text('Online & Ready'), findsWidgets);
      expect(find.text('Offline Fleet'), findsOneWidget);
      expect(find.text('Active Bookings'), findsOneWidget);
      expect(find.text('3'), findsOneWidget); // Total Fleet Count

      // Verify Service Requests Section
      expect(find.text('1. Customer Service Requests (4)'), findsOneWidget);
      expect(find.text('PA3510'), findsOneWidget);
      expect(find.text('GT3504'), findsOneWidget);
      expect(find.text('SR-3498'), findsOneWidget);

      // Select a job to trigger candidate matching
      await tester.tap(find.text('PA3510'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Inspecting Job: PA3510'), findsOneWidget);

      // Verify Eligible candidates
      expect(find.text('2.3 km away'), findsOneWidget);
      expect(find.text('Score: 95.0'), findsOneWidget);
      expect(find.text('✓ Qualified'), findsOneWidget);
      expect(find.text('Ineligible'), findsOneWidget);
      expect(find.text('Dispatch Offer'), findsOneWidget);
    });

    testWidgets('AdminDispatchScreen pre-selects job from route parameter', (tester) async {
      tester.view.physicalSize = const Size(800, 2500);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminDispatchScreen(jobId: '3510'),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Pre-selected job should immediately update Inspecting Job
      expect(find.textContaining('Inspecting Job: PA3510'), findsOneWidget);
      expect(find.text('Score: 95.0'), findsOneWidget);
    });

    testWidgets('AdminDispatchScreen assignment confirmation dialog pops up', (tester) async {
      tester.view.physicalSize = const Size(800, 2500);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminDispatchScreen(jobId: '3510'),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Tap Dispatch Offer on first candidate
      await tester.tap(find.text('Dispatch Offer').first);
      await tester.pumpAndSettle();

      expect(find.text('Confirm Dispatch Offer'), findsOneWidget);
      expect(find.text('Dispatch job offer PA3510 to Rahul Sharma?'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      // Dismiss dialog
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(find.text('Confirm Dispatch Offer'), findsNothing);
    });
  });

  group('Jobs -> Dispatch Navigation Flow & Responsiveness', () {
    testWidgets('Tapping Dispatch navigates to Dispatch screen with selected job', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final router = GoRouter(
        initialLocation: '/admin/jobs',
        routes: [
          GoRoute(
            path: '/admin/jobs',
            builder: (context, state) => const AdminJobsScreen(),
          ),
          GoRoute(
            path: '/admin/dispatch',
            builder: (context, state) {
              final jobId = state.uri.queryParameters['jobId'] ?? state.uri.queryParameters['job_id'];
              return AdminDispatchScreen(jobId: jobId);
            },
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(mockJobs)),
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
          ],
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('PA3510'), findsOneWidget);

      // Tap Dispatch on the first job (PA3510)
      await tester.tap(find.text('Dispatch').first);
      await tester.pumpAndSettle();

      // Should have navigated to Dispatch with PA3510 selected
      expect(find.text('Dynamic Dispatch & Fleet Operations'), findsOneWidget);
      expect(find.textContaining('Inspecting Job: PA3510'), findsOneWidget);
    });

    testWidgets('Responsive Layout at narrow width (320px) has no RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestableWidget(
          const AdminJobsScreen(),
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(mockJobs)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PA3510'), findsOneWidget);
    });

    testWidgets('Responsive Layout at 1.5x font scale has no RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminJobsListProvider(null).overrideWith((ref) => Future.value(mockJobs)),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
              child: const AdminJobsScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PA3510'), findsOneWidget);
    });
  });
}
