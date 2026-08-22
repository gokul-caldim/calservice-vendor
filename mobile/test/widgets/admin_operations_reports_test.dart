import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/admin/domain/admin_dashboard_metrics.dart';
import 'package:mobile/features/admin/domain/admin_report_data.dart';
import 'package:mobile/features/admin/domain/admin_scope_extension.dart';
import 'package:mobile/features/admin/domain/admin_service_request_item.dart';
import 'package:mobile/features/admin/domain/eligible_technician.dart';
import 'package:mobile/features/admin/domain/fleet_member.dart';
import 'package:mobile/features/admin/domain/job_timeline_data.dart';
import 'package:mobile/features/admin/domain/work_location.dart';
import 'package:mobile/features/admin/presentation/admin_dashboard_providers.dart';
import 'package:mobile/features/admin/presentation/dispatch/admin_dispatch_screen.dart';
import 'package:mobile/features/admin/presentation/reports/admin_reports_screen.dart';
import 'package:mobile/features/jobs/domain/job.dart';

final List<Job> mockJobs = [
  Job(
    id: 3510,
    requestId: 'PA3510',
    customerName: 'Rahul Verma',
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
    customerName: 'Sneha Rao',
    serviceCategory: 'Cleaning',
    serviceTitle: 'Deep Kitchen Cleaning',
    status: 'completed',
    address: '45 Koramangala, Bangalore',
    totalAmount: 999.0,
    paymentMethod: 'ONLINE',
    paymentStatus: 'completed',
    preferredDate: '2026-08-21',
    createdAt: DateTime.parse('2026-08-21T08:30:00Z'),
    isOffer: false,
    isAcceptedByCurrentEmployee: false,
    isAssignedToCurrentEmployee: true,
    canCancel: false,
  ),
];

final List<FleetMember> mockFleet = [
  const FleetMember(
    id: 10,
    employeeId: 'EMP-P3-001',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    isOnline: true,
    currentAvailability: 'available',
    registrationStatus: 'approved',
    latitude: 12.9716,
    longitude: 77.5946,
    hasLocation: true,
    locationStatus: 'Live GPS reported',
  ),
  const FleetMember(
    id: 11,
    employeeId: 'EMP-P3-002',
    name: 'Amit Patel',
    phone: '+919876543211',
    isOnline: true,
    currentAvailability: 'busy',
    registrationStatus: 'approved',
    activeJob: 'PA3509',
    latitude: 12.9352,
    longitude: 77.6245,
    hasLocation: true,
    locationStatus: 'Live GPS reported',
  ),
  const FleetMember(
    id: 12,
    employeeId: 'EMP-P3-003',
    name: 'Vikram Singh',
    phone: '+919876543212',
    isOnline: false,
    currentAvailability: 'off_duty',
    registrationStatus: 'approved',
    hasLocation: false,
    locationStatus: 'No GPS data',
  ),
];

final mockDashboardData = AdminDashboardData(
  fleet: mockFleet,
  jobs: mockJobs,
);

final List<EligibleTechnician> mockCandidates = [
  const EligibleTechnician(
    id: 10,
    employeeId: 'EMP-P3-001',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    distanceKm: 2.34,
    distanceBand: '2-5km',
    gpsFreshness: 'LIVE',
    score: 95.0,
    isOnline: true,
    currentAvailability: 'available',
    registrationStatus: 'approved',
    isDispatchReady: true,
    ineligibilityReason: '',
    gateAudit: [
      GateAuditItem(gate: 'schedule', name: 'Schedule', passed: true),
      GateAuditItem(gate: 'location', name: 'Location', passed: true),
      GateAuditItem(gate: 'skills', name: 'Skills', passed: true),
    ],
  ),
];

final List<AdminScopeExtension> mockExtensions = [
  const AdminScopeExtension(
    id: 101,
    jobId: 3510,
    requestId: 'PA3510',
    title: 'Additional piping required',
    reason: 'Corroded valve replacement necessary for safety.',
    additionalLaborCost: 350.0,
    additionalMaterialsCost: 450.0,
    requestedAmount: 800.0,
    isCritical: true,
    requiresSpecialist: false,
    status: 'PENDING',
  ),
];

final List<AdminServiceRequestItem> mockServices = [
  const AdminServiceRequestItem(
    employeeId: 10,
    employeeName: 'Rahul Sharma',
    employeeCode: 'EMP-P3-001',
    serviceId: 5,
    serviceName: 'Industrial Electrical Diagnostics',
    requestType: 'add',
  ),
];

final List<WorkLocation> mockLocations = [
  const WorkLocation(
    id: 1,
    name: 'Bangalore Central Hub',
    address: 'MG Road, Bangalore',
    lat: 12.9716,
    lng: 77.5946,
    geofenceRadius: 500,
    geofenceType: 'circle',
    isActive: true,
  ),
];

final mockTimelineData = JobTimelineData(
  jobId: 3510,
  requestId: 'PA3510',
  events: [
    JobTimelineEvent(
      title: 'Booking Created',
      description: 'Customer booked Painting Home Service.',
      actor: 'Customer',
      timestamp: DateTime.parse('2026-08-21T09:00:00Z'),
      eventType: 'BOOKING_CREATED',
    ),
    JobTimelineEvent(
      title: 'Auto-Dispatch Evaluated',
      description: 'Found 1 eligible technician within 20km.',
      actor: 'Geo-Dispatch Engine',
      timestamp: DateTime.parse('2026-08-21T09:01:00Z'),
      eventType: 'DISPATCH_EVALUATED',
    ),
  ],
);

final mockEmployeeReport = AdminReportData(
  reportType: 'employee',
  totalRecords: 2,
  rows: [
    {
      'employee_id': 'EMP-001',
      'name': 'Rahul Sharma',
      'role': 'Electrician',
      'status': 'active',
      'attendance_today': 'Clocked In',
    },
    {
      'employee_id': 'EMP-002',
      'name': 'Amit Patel',
      'role': 'Plumber',
      'status': 'active',
      'attendance_today': 'On Job',
    },
  ],
);

Widget buildTestWidget(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: child,
    ),
  );
}

void main() {
  setUp(() {
    AppColors.configure(brightness: Brightness.light, highContrast: false);
  });

  group('AdminDispatchScreen Operations & Telemetry Tests', () {
    testWidgets('Renders all 4 metrics and tab bar with 5 sections', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
            adminJobTimelineProvider(3510).overrideWith((ref) => Future.value(mockTimelineData)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Metric Strip
      expect(find.text('Dynamic Dispatch & Fleet Operations'), findsOneWidget);
      expect(find.text('Total Fleet'), findsOneWidget);
      expect(find.text('Online & Ready'), findsOneWidget);
      expect(find.text('Offline Fleet'), findsOneWidget);
      expect(find.text('Active Bookings'), findsOneWidget);

      // Tab Bar
      expect(find.text('Dispatch Monitor'), findsOneWidget);
      expect(find.text('Live Fleet (3)'), findsOneWidget);
      expect(find.text('Scope Extensions (1)'), findsOneWidget);
      expect(find.text('Service Requests (1)'), findsOneWidget);
      expect(find.text('Work Locations (1)'), findsOneWidget);

      // Tab 0 Content: Dispatch Monitor
      expect(find.text('1. Customer Service Requests (2)'), findsOneWidget);
      expect(find.text('PA3510'), findsOneWidget);
      expect(find.text('Autonomous Dispatch Active'), findsOneWidget);
      expect(find.text('20 KM Geographic Dispatch Active: Candidate pool evaluated across a 20 km circular radius using geodesic Haversine calculation and 9-Gate qualification.'), findsOneWidget);
      expect(find.text('EMP-P3-001'), findsOneWidget);
      expect(find.text('2.3 km away'), findsOneWidget);
      expect(find.text('Dispatch Offer'), findsOneWidget);
    });

    testWidgets('Opens Job Timeline bottom sheet and renders audit events', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
            adminJobTimelineProvider(3510).overrideWith((ref) => Future.value(mockTimelineData)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('View Timeline'));
      await tester.pumpAndSettle();

      expect(find.text('Timeline — #PA3510'), findsOneWidget);
      expect(find.text('Booking Created'), findsOneWidget);
      expect(find.text('Auto-Dispatch Evaluated'), findsOneWidget);
      expect(find.text('Actor: Customer'), findsOneWidget);
      expect(find.text('Actor: Geo-Dispatch Engine'), findsOneWidget);
    });

    testWidgets('Switches to Tab 1 (Live Fleet Telemetry)', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(initialTabIndex: 1),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Real-Time GPS Telemetry Radar'), findsOneWidget);
      expect(find.text('2/3 GPS Active'), findsOneWidget);
      expect(find.text('Rahul Sharma'), findsOneWidget);
      expect(find.text('Amit Patel'), findsOneWidget);
      expect(find.text('Active Job: PA3509'), findsOneWidget);
    });

    testWidgets('Switches to Tab 2 (Scope Extensions) and renders approve/reject actions', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(initialTabIndex: 2),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Scope Extensions (1)'), findsNWidgets(2)); // Tab & header
      expect(find.text('Job #PA3510'), findsOneWidget);
      expect(find.text('CRITICAL'), findsOneWidget);
      expect(find.text('Additional piping required'), findsOneWidget);
      expect(find.text('Total Requested: ₹800.00'), findsOneWidget);
      expect(find.text('Approve'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);
    });

    testWidgets('Switches to Tab 3 (Service Requests) and renders requests', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(initialTabIndex: 3),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Service Requests (1)'), findsNWidgets(2));
      expect(find.text('AUTHORIZATION'), findsOneWidget);
      expect(find.text('Service: Industrial Electrical Diagnostics (ID #5)'), findsOneWidget);
    });

    testWidgets('Switches to Tab 4 (Work Locations) and renders company locations', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(initialTabIndex: 4),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Company Work Locations'), findsOneWidget);
      expect(find.text('Add Location'), findsOneWidget);
      expect(find.text('Bangalore Central Hub'), findsOneWidget);
      expect(find.text('MG Road, Bangalore'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
    });
  });

  group('AdminReportsScreen Enterprise Reporting Tests', () {
    testWidgets('Renders reporting suite, report tabs, and employee rows', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminReportsScreen(),
          overrides: [
            adminReportProvider(const AdminReportParams(type: 'employee')).overrideWith(
              (ref) => Future.value(mockEmployeeReport),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Workforce Enterprise Reporting Suite'), findsOneWidget);
      expect(find.text('Export CSV'), findsOneWidget);
      expect(find.text('Employee Roster'), findsOneWidget);
      expect(find.text('Field Jobs'), findsOneWidget);
      expect(find.text('Payroll Summary'), findsOneWidget);
      expect(find.text('Compliance Records'), findsOneWidget);
      expect(find.text('Query Filters'), findsOneWidget);
      expect(find.text('Apply Query'), findsOneWidget);

      expect(find.text('EMPLOYEE REPORT (2 RECORDS)'), findsOneWidget);
      expect(find.text('Rahul Sharma (EMP-001)'), findsOneWidget);
      expect(find.text('Amit Patel (EMP-002)'), findsOneWidget);
    });

    testWidgets('Renders empty state when report returns 0 rows', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      const emptyReport = AdminReportData(
        reportType: 'payroll',
        totalRecords: 0,
        rows: [],
      );

      await tester.pumpWidget(
        buildTestWidget(
          const AdminReportsScreen(),
          overrides: [
            adminReportProvider(const AdminReportParams(type: 'employee')).overrideWith(
              (ref) => Future.value(emptyReport),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No Matching Records'), findsOneWidget);
      expect(find.text('No records found matching this query filter.'), findsOneWidget);
    });
  });

  group('Responsive & Overflow Checks', () {
    testWidgets('Operations screen has no RenderFlex overflow on narrow 320px width', (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        buildTestWidget(
          const AdminDispatchScreen(),
          overrides: [
            adminDashboardDataProvider.overrideWith((ref) => Future.value(mockDashboardData)),
            adminFleetListProvider.overrideWith((ref) => Future.value(mockFleet)),
            adminEligibleTechniciansProvider(3510).overrideWith((ref) => Future.value(mockCandidates)),
            adminPendingExtensionsProvider.overrideWith((ref) => Future.value(mockExtensions)),
            adminPendingServicesProvider.overrideWith((ref) => Future.value(mockServices)),
            adminLocationsProvider.overrideWith((ref) => Future.value(mockLocations)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Dynamic Dispatch & Fleet Operations'), findsOneWidget);
    });

    testWidgets('Reports screen has no RenderFlex overflow at 1.5x font scale', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminReportProvider(const AdminReportParams(type: 'employee')).overrideWith(
              (ref) => Future.value(mockEmployeeReport),
            ),
          ],
          child: const MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
              child: AdminReportsScreen(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Workforce Enterprise Reporting Suite'), findsOneWidget);
    });
  });
}
