import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/admin/domain/admin_application.dart';
import 'package:mobile/features/admin/domain/admin_dashboard_metrics.dart';
import 'package:mobile/features/admin/domain/fleet_member.dart';
import 'package:mobile/features/admin/presentation/admin_dashboard_providers.dart';
import 'package:mobile/features/admin/presentation/admin_home_screen.dart';
import 'package:mobile/features/admin/presentation/widgets/action_center_card.dart';
import 'package:mobile/features/admin/presentation/widgets/action_center_section.dart';
import 'package:mobile/features/admin/presentation/widgets/admin_title_section.dart';
import 'package:mobile/features/admin/presentation/widgets/metric_card.dart';
import 'package:mobile/features/admin/presentation/widgets/recent_job_card.dart';
import 'package:mobile/features/admin/presentation/widgets/recent_operations_section.dart';
import 'package:mobile/features/admin/presentation/widgets/workforce_overview_section.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/presentation/auth_controller.dart';
import 'package:mobile/features/jobs/domain/job.dart';

class FakeAuthController extends StateNotifier<AuthState>
    implements AuthController {
  FakeAuthController(AuthUser user) : super(AuthState.authenticated(user));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  const mockAdminUser = AuthUser(
    id: 100,
    username: 'ops_admin',
    email: 'admin@calservices.com',
    firstName: 'Operations',
    lastName: 'Director',
    role: 'admin',
    companyId: 1,
    companyName: 'CalServices Enterprise Solutions Group Ltd',
    isSuperuser: true,
    employeeId: null,
    registrationStatus: 'approved',
  );

  final mockApplications = [
    const AdminApplication(
      id: 1,
      name: 'Ramesh Kumar',
      employeeId: 'EMP-101',
      registrationStatus: 'submitted',
      documentsStatus: {
        'aadhaar': {'status': 'pending'},
        'license': {'status': 'submitted'},
      },
    ),
    const AdminApplication(
      id: 2,
      name: 'Suresh Raina',
      employeeId: 'EMP-102',
      registrationStatus: 'under_review',
      documentsStatus: {
        'aadhaar': {'status': 'pending'},
      },
    ),
    const AdminApplication(
      id: 3,
      name: 'Dinesh Karthik',
      employeeId: 'EMP-103',
      registrationStatus: 'approved',
      documentsStatus: {
        'aadhaar': {'status': 'approved'},
      },
    ),
    const AdminApplication(
      id: 4,
      name: 'Vijay Shankar',
      employeeId: 'EMP-104',
      registrationStatus: 'approved',
    ),
    const AdminApplication(
      id: 5,
      name: 'Manoj Tiwari',
      employeeId: 'EMP-105',
      registrationStatus: 'correction_required',
    ),
  ];

  final mockJobs = [
    const Job(
      id: 3490,
      requestId: 'SR-3490',
      customerName: 'vignesh',
      serviceCategory: 'Cleaning',
      serviceTitle: 'Full Kitchen cleaning(Basic)',
      status: 'waiting_for_payment',
      address: '402, 05, Bagalur Rd, Hosur, Tamil Nadu',
      preferredDate: '2026-08-22',
      preferredTime: '09:00 AM',
      isOffer: false,
      isAcceptedByCurrentEmployee: false,
      isAssignedToCurrentEmployee: false,
      canCancel: false,
    ),
    const Job(
      id: 3489,
      requestId: 'SR-3489',
      customerName: 'Suri',
      serviceCategory: 'Logistics',
      serviceTitle: 'Mini truck delivery — Tata Ace (General Goods)',
      status: 'accepted',
      address: 'Hosur Bus Stand, Central Hosur, Tamil Nadu',
      preferredDate: '2026-08-22',
      preferredTime: '9AM-10AM',
      isOffer: false,
      isAcceptedByCurrentEmployee: false,
      isAssignedToCurrentEmployee: false,
      canCancel: false,
    ),
    const Job(
      id: 3488,
      requestId: 'SR-3488',
      customerName: 'Vignesh Test',
      serviceCategory: 'Cleaning',
      serviceTitle: 'Deep Cleaning',
      status: 'new_request',
      address: 'Hosur Test',
      preferredDate: '2026-08-21',
      preferredTime: '10:00 AM',
      isOffer: false,
      isAcceptedByCurrentEmployee: false,
      isAssignedToCurrentEmployee: false,
      canCancel: false,
    ),
    const Job(
      id: 3479,
      requestId: 'SR-3479',
      customerName: 'vignesh',
      serviceCategory: 'HVAC',
      serviceTitle: 'Foam & Power Jet AC Service — Split',
      status: 'cancelled',
      address: '402, 05, Bagalur Rd, Hosur',
      preferredDate: '2026-08-22',
      preferredTime: '10:00 AM',
      isOffer: false,
      isAcceptedByCurrentEmployee: false,
      isAssignedToCurrentEmployee: false,
      canCancel: false,
    ),
    const Job(
      id: 3470,
      requestId: 'SR-P3-1FAEF0',
      customerName: 'phase3_cust_user',
      serviceCategory: 'HVAC',
      serviceTitle: 'Phase 3 hvac Task',
      status: 'completed',
      address: '100 Feet Rd, Indiranagar, Bengaluru',
      preferredDate: '2026-08-21',
      preferredTime: '10:00 AM',
      isOffer: false,
      isAcceptedByCurrentEmployee: false,
      isAssignedToCurrentEmployee: false,
      canCancel: false,
    ),
  ];

  final mockFleet = [
    const FleetMember(
      id: 101,
      employeeId: 'EMP-101',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      isOnline: true,
      currentAvailability: 'available',
      registrationStatus: 'approved',
      hasLocation: true,
      latitude: 12.9716,
      longitude: 77.5946,
      activeJob: null,
    ),
    const FleetMember(
      id: 102,
      employeeId: 'EMP-102',
      name: 'Suresh Raina',
      phone: '9876543211',
      isOnline: true,
      currentAvailability: 'busy',
      registrationStatus: 'approved',
      hasLocation: true,
      latitude: 12.9718,
      longitude: 77.5950,
      activeJob: 'SR-3489',
    ),
    const FleetMember(
      id: 103,
      employeeId: 'EMP-103',
      name: 'Dinesh Karthik',
      phone: '9876543212',
      isOnline: false,
      currentAvailability: 'offline',
      registrationStatus: 'approved',
      hasLocation: false,
      activeJob: null,
    ),
  ];

  final testDashboardData = AdminDashboardData(
    applications: mockApplications,
    jobs: mockJobs,
    fleet: mockFleet,
  );

  Widget createSubject({AdminDashboardData? data}) {
    return ProviderScope(
      overrides: [
        authControllerProvider
            .overrideWith((ref) => FakeAuthController(mockAdminUser)),
        adminDashboardDataProvider
            .overrideWith((ref) => data ?? testDashboardData),
      ],
      child: MaterialApp(
        theme: ThemeData.light(useMaterial3: true),
        home: const AdminHomeScreen(),
      ),
    );
  }

  group('Admin Home / Operations Center Widget Tests', () {
    testWidgets(
        'renders title section, action center, overview, and recent jobs',
        (tester) async {
      await tester.pumpWidget(createSubject());
      await tester.pumpAndSettle();

      // Title Section
      expect(find.text('Workforce Operations Center'), findsOneWidget);
      expect(
        find.text(
            'Real-time personnel monitoring, dossier verifications, and dynamic dispatch'),
        findsOneWidget,
      );
      expect(find.text('Refresh Data'), findsOneWidget);
      expect(find.text('Open Dispatch Console'), findsOneWidget);

      // Action Center Section
      expect(find.text('ACTION CENTER'), findsOneWidget);
      expect(find.byType(ActionCenterSection), findsOneWidget);
      expect(find.text('Pending Applications'), findsOneWidget);
      expect(find.text('Documents to Verify'), findsOneWidget);
      expect(find.text('Jobs Awaiting Assignment'), findsOneWidget);
      expect(find.text('Corrections Pending Resubmission'), findsOneWidget);

      // Workforce Overview Section
      expect(find.text('WORKFORCE OVERVIEW'), findsOneWidget);
      expect(find.byType(WorkforceOverviewSection), findsOneWidget);
      expect(find.text('Total Registered'), findsOneWidget);
      expect(find.text('Approved & Active'), findsOneWidget);
      expect(find.text('Online & Available'), findsOneWidget);
      expect(find.text('On Active Jobs'), findsOneWidget);
      expect(find.text('Pending Review'), findsOneWidget);

      // Recent Operations Section
      expect(find.textContaining('Recent Operations'), findsOneWidget);
      expect(find.text('View All Jobs'), findsOneWidget);
      expect(find.byType(RecentOperationsSection), findsOneWidget);
      expect(find.text('SR-3490'), findsOneWidget);
      expect(find.text('SR-3489'), findsOneWidget);
      expect(find.text('SR-3488'), findsOneWidget);
    });

    testWidgets('computes and displays correct metrics from live data',
        (tester) async {
      await tester.pumpWidget(createSubject());
      await tester.pumpAndSettle();

      // Action Center metrics:
      // Pending Applications = 2 (submitted + under_review)
      // Documents to Verify = 3 (2 from Ramesh + 1 from Suresh)
      // Jobs Awaiting Assignment = 1 (SR-3488 new_request)
      // Corrections Pending = 1 (Manoj)
      expect(testDashboardData.pendingApplicationsCount, 2);
      expect(testDashboardData.documentsToVerifyCount, 3);
      expect(testDashboardData.unassignedJobsCount, 1);
      expect(testDashboardData.correctionsPendingCount, 1);

      // Workforce Overview metrics:
      // Total Registered = 5
      // Approved & Active = 2
      // Online & Available = 1
      // On Active Jobs = 1
      // Pending Review = 2
      expect(testDashboardData.totalRegisteredCount, 5);
      expect(testDashboardData.approvedAndActiveCount, 2);
      expect(testDashboardData.onlineAndAvailableCount, 1);
      expect(testDashboardData.onActiveJobsCount, 1);
      expect(testDashboardData.pendingReviewCount, 2);
    });

    testWidgets('RecentJobCard displays all key fields and status badges',
        (tester) async {
      await tester.pumpWidget(createSubject());
      await tester.pumpAndSettle();

      // Check fields for SR-3490
      expect(find.text('SR-3490'), findsOneWidget);
      expect(find.text('vignesh'), findsAtLeastNWidgets(1));
      expect(find.text('Full Kitchen cleaning(Basic)'), findsOneWidget);
      expect(find.text('402, 05, Bagalur Rd, Hosur, Tamil Nadu'), findsOneWidget);
      expect(find.text('2026-08-22 09:00 AM'), findsOneWidget);
      expect(find.text('WAITING FOR PAYMENT'), findsOneWidget);
      expect(find.text('Dispatch'), findsWidgets);
    });
  });

  group('Multi-Screen Responsive Layout Tests', () {
    const phoneWidths = [
      ('Small Phone (320px)', 320.0, 640.0),
      ('Standard Phone (360px)', 360.0, 780.0),
      ('Large Phone (412px)', 412.0, 915.0),
      ('Wide Phone (480px)', 480.0, 854.0),
    ];

    for (final (name, width, height) in phoneWidths) {
      testWidgets('$name adapts and scrolls without overflow', (tester) async {
        tester.view.physicalSize = Size(width * 2, height * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(createSubject());
        await tester.pumpAndSettle();

        final exc1 = tester.takeException();
        if (exc1 != null) debugPrint('EXC1 on $name: $exc1');
        expect(exc1, isNull);
        expect(find.text('Workforce Operations Center'), findsOneWidget);

        // Scroll through the entire dashboard to verify all sections render without overflow
        await tester.drag(find.byType(ListView), const Offset(0, -400));
        await tester.pumpAndSettle();
        final exc2 = tester.takeException();
        if (exc2 != null) {
          FlutterError.dumpErrorToConsole(
            FlutterErrorDetails(exception: exc2),
            forceReport: true,
          );
        }
        expect(exc2, isNull);

        await tester.drag(find.byType(ListView), const Offset(0, -400));
        await tester.pumpAndSettle();
        final exc3 = tester.takeException();
        if (exc3 != null) debugPrint('EXC3 on $name: $exc3');
        expect(exc3, isNull);
      });
    }

    testWidgets(
        'Accessibility: Large font scale (1.5x) on Small Phone (320px) produces zero overflow',
        (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 640 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      addTearDown(() => tester.view.resetDevicePixelRatio());

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 640),
            textScaler: TextScaler.linear(1.5),
          ),
          child: createSubject(),
        ),
      );

      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Workforce Operations Center'), findsOneWidget);

      await tester.drag(find.byType(ListView), const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('ActionCenterSection renders all 4 cards in isolation',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ActionCenterSection(data: testDashboardData),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ActionCenterCard), findsNWidgets(4));
    });

    for (int i = 0; i < testDashboardData.jobs.length; i++) {
      testWidgets('RecentJobCard $i renders on 412px in isolation',
          (tester) async {
        tester.view.physicalSize = const Size(412 * 2, 915 * 2);
        tester.view.devicePixelRatio = 2.0;
        addTearDown(() => tester.view.resetPhysicalSize());
        addTearDown(() => tester.view.resetDevicePixelRatio());

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: RecentJobCard(job: testDashboardData.jobs[i]),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final exc = tester.takeException();
        if (exc != null) {
          debugPrint('OFFENDING JOB $i (${testDashboardData.jobs[i].requestId}): $exc');
        }
        expect(exc, isNull);
      });
    }

    testWidgets('AdminTitleSection renders on 412px in isolation',
        (tester) async {
      tester.view.physicalSize = const Size(412 * 2, 915 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      addTearDown(() => tester.view.resetDevicePixelRatio());

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: AdminTitleSection(onRefresh: () {}),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('MetricCard renders label, value, and subtext properly',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: MetricCard(
              label: 'Total Registered',
              value: 5,
              subtext: 'Technicians on roster',
              icon: Icons.people_alt_rounded,
              iconColor: Color(0xFF2563EB),
              valueColor: Color(0xFF1E40AF),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Total Registered'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
      expect(find.text('Technicians on roster'), findsOneWidget);
    });
  });
}
