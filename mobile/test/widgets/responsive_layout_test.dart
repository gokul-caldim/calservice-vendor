import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/presentation/auth_controller.dart';
import 'package:mobile/features/dashboard/presentation/widgets/brand_bar_title.dart';
import 'package:mobile/features/dashboard/presentation/widgets/greeting_header.dart';
import 'package:mobile/features/dashboard/presentation/widgets/today_overview_card.dart';
import 'package:mobile/features/documents/presentation/documents_screen.dart';
import 'package:mobile/features/jobs/domain/job.dart';
import 'package:mobile/features/jobs/domain/pre_service_status.dart';
import 'package:mobile/features/jobs/presentation/jobs_providers.dart';
import 'package:mobile/features/jobs/presentation/providers/pre_service_status_provider.dart';
import 'package:mobile/features/jobs/presentation/widgets/active_assignment_banner.dart';
import 'package:mobile/features/jobs/presentation/widgets/active_job_card.dart';
import 'package:mobile/features/jobs/presentation/widgets/arrival_checklist_section.dart';
import 'package:mobile/features/jobs/presentation/widgets/cash_collection_sheet.dart';
import 'package:mobile/features/jobs/presentation/widgets/offer_card.dart';
import 'package:mobile/features/jobs/presentation/widgets/worker_status_header.dart';
import 'package:mobile/features/locations/domain/saved_location.dart';
import 'package:mobile/features/locations/presentation/locations_providers.dart';
import 'package:mobile/features/locations/presentation/locations_screen.dart';
import 'package:mobile/features/performance/domain/performance_summary.dart';
import 'package:mobile/features/performance/presentation/performance_providers.dart';
import 'package:mobile/features/performance/presentation/performance_screen.dart';
import 'package:mobile/features/profile/domain/employee_profile.dart';
import 'package:mobile/features/profile/domain/shift_status.dart';
import 'package:mobile/features/profile/presentation/profile_providers.dart';

class FakeAuthController extends StateNotifier<AuthState> implements AuthController {
  FakeAuthController(AuthUser user) : super(AuthState.authenticated(user));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const phoneWidths = [
    ('Small Phone (320px)', 320.0, 640.0),
    ('Standard Phone (360px)', 360.0, 780.0),
    ('Large Phone (412px)', 412.0, 915.0),
    ('Wide Phone (480px)', 480.0, 854.0),
  ];

  const mockUser = AuthUser(
    id: 1,
    username: 'technician_mani',
    email: 'mani@calservices.com',
    firstName: 'Manikandan',
    lastName: 'Sundaram',
    role: 'employee',
    companyId: 1,
    companyName: 'CalServices Enterprise Solutions Group Ltd',
    isSuperuser: false,
    employeeId: 'EMP-9924-TECH',
    registrationStatus: 'approved',
  );

  final mockProfile = EmployeeProfile(
    employeeId: 'EMP-9924-TECH',
    firstName: 'Manikandan',
    lastName: 'Sundaram',
    email: 'manikandan.sundaram.enterprise@calservices.example.com',
    mobileNumber: '+91 98765 43210',
    phone: '+91 98765 43210',
    title: 'Senior HVAC & Refrigeration Field Engineer',
    companyName: 'CalServices Enterprise Solutions Group Ltd',
    department: 'Engineering Services',
    state: 'Tamil Nadu',
    country: 'India',
    isOnline: true,
    liveAvailability: 'online',
    registrationStatus: 'approved',
    approvedServices: const [],
    allRequestedServices: const [],
    controlledFields: const ControlledFieldsConfig(
      isLocked: false,
      lockedFields: [],
    ),
    documents: const [
      EmployeeDocument(
        title: 'Aadhaar Government Identification Document Card',
        category: 'identity_proof',
        status: 'approved',
        documentNumber: 'XXXX-XXXX-1234',
        fileUrl: 'https://example.com/doc.jpg',
      ),
    ],
  );

  final mockJob = Job(
    id: 42,
    requestId: 'SR-2026-987654',
    serviceTitle: 'Comprehensive Commercial Split AC Overhaul & Maintenance',
    status: 'assigned',
    customerName: 'Enterprise Customer Operations Manager',
    phone: '+91 91234 56789',
    address: 'Plot 42, Tech Park Boulevard, Sector 12, Phase 3, Industrial Area',
    latitude: 12.9716,
    longitude: 77.5946,
    distanceKm: 8.4,
    totalAmount: 3450.0,
    offerExpiresAt: DateTime.now().add(const Duration(minutes: 5)),
    cancellationDeadline: DateTime.now().add(const Duration(minutes: 10)),
    paymentMethod: 'CASH',
    paymentStatus: 'cash_pending',
    isOffer: false,
    isAcceptedByCurrentEmployee: true,
    isAssignedToCurrentEmployee: true,
    canCancel: true,
  );

  const mockLocations = [
    SavedLocation(
      id: 1,
      label: 'work',
      name: 'Central Service Depot & Warehouse Hub',
      address: 'Building 4, Sector 7, Outer Ring Road Expressway',
      locality: 'Whitefield Technology Hub',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560066',
      latitude: 12.9716,
      longitude: 77.5946,
      isDefault: true,
    ),
  ];

  final mockPerformance = PerformanceSummary(
    hasData: true,
    metrics: const PerformanceMetrics(
      jobsCompleted: 142,
      totalJobsAssigned: 150,
      completionRate: 94.7,
      averageRating: 4.9,
      csatScore: 96.2,
      issueResolutionRate: 98.1,
      feedbackSubmissionsCount: 128,
    ),
    ratingDistribution: const {5: 110, 4: 14, 3: 3, 2: 1, 1: 0},
    feedbacks: [
      JobFeedback(
        id: 1,
        job: 42,
        requestId: 'SR-2026-987654',
        rating: 5,
        review: 'Prompt arrival, exceptional technical precision, and thorough diagnostics performed.',
        customerName: 'Mr. Rajesh Kumar',
        serviceTitle: 'Commercial HVAC Multi-Unit Servicing',
        createdAt: DateTime.now(),
      ),
    ],
  );

  group('Multi-Screen Responsive Layout Tests', () {
    for (final (label, width, height) in phoneWidths) {
      testWidgets('HomeScreen & Headers adapt without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authControllerProvider.overrideWith((ref) => FakeAuthController(mockUser)),
              employeeProfileProvider.overrideWith((ref) => Future.value(mockProfile)),
              shiftStatusProvider.overrideWith(
                (ref) => Future.value(
                  const ShiftStatus(
                    isClockedIn: true,
                    shiftStatus: 'clocked_in',
                    hasActiveJob: true,
                  ),
                ),
              ),
              activeJobsProvider.overrideWith((ref) => Future.value([mockJob])),
              completedJobsProvider.overrideWith((ref) => Future.value([])),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: Scaffold(
                appBar: AppBar(
                  title: BrandBarTitle(companyName: mockUser.companyName),
                ),
                body: ListView(
                  children: [
                    const GreetingHeader(),
                    const TodayOverviewCard(activeCount: 1, completedCount: 14),
                    const WorkerStatusHeader(),
                    ActiveAssignmentBanner(job: mockJob),
                    ActiveJobCard(job: mockJob),
                    OfferCard(job: mockJob),
                  ],
                ),
              ),
            ),
          ),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        final exc = tester.takeException();
        if (exc != null) {
          debugPrint('HomeScreen Exception on $label: $exc');
        }
        expect(exc, isNull);
        expect(find.byType(BrandBarTitle), findsOneWidget);
        expect(find.byType(GreetingHeader), findsOneWidget);
        expect(find.byType(WorkerStatusHeader), findsOneWidget);
      });

      testWidgets('JobsScreen & OfferCard adapt without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authControllerProvider.overrideWith((ref) => FakeAuthController(mockUser)),
              employeeProfileProvider.overrideWith((ref) => Future.value(mockProfile)),
              activeJobsProvider.overrideWith((ref) => Future.value([mockJob])),
              completedJobsProvider.overrideWith((ref) => Future.value([])),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: Scaffold(
                body: ListView(
                  children: [
                    const WorkerStatusHeader(),
                    OfferCard(job: mockJob),
                    ActiveJobCard(job: mockJob),
                  ],
                ),
              ),
            ),
          ),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        final exc = tester.takeException();
        if (exc != null) {
          debugPrint('JobsScreen Exception on $label: $exc');
        }
        expect(exc, isNull);
        expect(find.byType(OfferCard), findsOneWidget);
      });

      testWidgets('ArrivalChecklistSection adapts without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        final controller = StreamController<PreServiceStatus>();
        addTearDown(() => controller.close());
        controller.add(
          const PreServiceStatus(
            geofencePassed: true,
            otpVerified: false,
            presencePhoto: false,
            appliancePhoto: false,
            workAreaPhoto: false,
            isComplete: false,
          ),
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              activeJobsProvider.overrideWith((ref) => Future.value([mockJob])),
              preServiceStatusProvider(mockJob.id).overrideWith((ref) => controller.stream),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: Scaffold(
                body: ListView(
                  children: [
                    ArrivalChecklistSection(job: mockJob),
                  ],
                ),
              ),
            ),
          ),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        final exc = tester.takeException();
        if (exc != null) {
          debugPrint('ArrivalChecklistSection Exception on $label: $exc');
        }
        expect(exc, isNull);
        expect(find.byType(ArrivalChecklistSection), findsOneWidget);
      });

      testWidgets('LocationsScreen & Form adapt without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              savedLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: const LocationsScreen(),
            ),
          ),
        );

        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('My Saved Locations'), findsWidgets);

        // Tap Add Location to test form layout responsiveness
        await tester.tap(find.text('Add Location'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Add New Location'), findsWidgets);
        expect(find.text('Save Location'), findsOneWidget);
      });

      testWidgets('DocumentsScreen adapts without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              employeeProfileProvider.overrideWith((ref) => Future.value(mockProfile)),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: const DocumentsScreen(),
            ),
          ),
        );

        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Documents'), findsOneWidget);
      });

      testWidgets('PerformanceScreen adapts without overflow on $label', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              performanceProvider.overrideWith((ref) => Future.value(mockPerformance)),
            ],
            child: MaterialApp(
              theme: ThemeData.light(useMaterial3: true),
              home: const PerformanceScreen(),
            ),
          ),
        );

        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Performance'), findsOneWidget);
        expect(find.text('JOBS COMPLETED'), findsOneWidget);
      });
    }

    testWidgets('Accessibility: Large font scale (1.5x) on Small Phone (320px) produces zero overflow', (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 640 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      addTearDown(() => tester.view.resetDevicePixelRatio());

      final controller = StreamController<PreServiceStatus>();
      addTearDown(() => controller.close());
      controller.add(
        const PreServiceStatus(
          geofencePassed: true,
          otpVerified: true,
          presencePhoto: true,
          appliancePhoto: true,
          workAreaPhoto: true,
          isComplete: true,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith((ref) => FakeAuthController(mockUser)),
            employeeProfileProvider.overrideWith((ref) => Future.value(mockProfile)),
            activeJobsProvider.overrideWith((ref) => Future.value([mockJob])),
            completedJobsProvider.overrideWith((ref) => Future.value([])),
            preServiceStatusProvider(mockJob.id).overrideWith((ref) => controller.stream),
          ],
          child: MaterialApp(
            theme: ThemeData.light(useMaterial3: true),
            home: MediaQuery(
              data: const MediaQueryData(
                textScaler: TextScaler.linear(1.5),
              ),
              child: Scaffold(
                appBar: AppBar(
                  title: BrandBarTitle(companyName: mockUser.companyName),
                ),
                body: ListView(
                  children: [
                    const GreetingHeader(),
                    const WorkerStatusHeader(),
                    OfferCard(job: mockJob),
                    ActiveAssignmentBanner(job: mockJob),
                    ArrivalChecklistSection(job: mockJob),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      final exc = tester.takeException();
      if (exc != null) {
        debugPrint('Accessibility Exception: $exc');
      }
      expect(exc, isNull);
      expect(find.byType(WorkerStatusHeader), findsOneWidget);
    });

    testWidgets('CashCollectionSheet adapts on 320px screen without overflow', (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 640 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      addTearDown(() => tester.view.resetDevicePixelRatio());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith((ref) => FakeAuthController(mockUser)),
          ],
          child: MaterialApp(
            theme: ThemeData.light(useMaterial3: true),
            home: Scaffold(
              body: CashCollectionSheet(job: mockJob),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('CONFIRM CASH RECEIVED'), findsOneWidget);
    });
  });
}
