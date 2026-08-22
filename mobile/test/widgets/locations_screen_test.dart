import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/locations/domain/saved_location.dart';
import 'package:mobile/features/locations/presentation/locations_providers.dart';
import 'package:mobile/features/locations/presentation/locations_screen.dart';

void main() {
  group('LocationsScreen Widget Tests', () {
    final testLocations = [
      const SavedLocation(
        id: 1,
        label: 'home',
        name: 'Primary Home Residence',
        address: '42 Blossom Boulevard',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        latitude: 12.9716,
        longitude: 77.5946,
        isDefault: true,
      ),
      const SavedLocation(
        id: 2,
        label: 'work',
        name: 'Central Maintenance Hub',
        address: 'Sector 5, Industrial Estate',
        locality: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        latitude: 12.9698,
        longitude: 77.7500,
        isDefault: false,
      ),
    ];

    testWidgets('renders saved locations list with default badge and actions', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            savedLocationsProvider.overrideWith((ref) => Future.value(testLocations)),
          ],
          child: const MaterialApp(
            home: LocationsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Header
      expect(find.text('My Saved Locations'), findsNWidgets(2));
      expect(find.text('Add Location'), findsOneWidget);

      // Verify Location 1 (Default)
      expect(find.text('Primary Home Residence'), findsOneWidget);
      expect(find.text('DEFAULT'), findsOneWidget);
      expect(find.textContaining('42 Blossom Boulevard, Indiranagar, Bengaluru'), findsOneWidget);
      expect(find.textContaining('12.97160, 77.59460'), findsOneWidget);

      // Verify Location 2 (Non-Default with Set as Default button)
      expect(find.text('Central Maintenance Hub'), findsOneWidget);
      expect(find.text('Set as Default'), findsOneWidget);
      expect(find.text('Directions'), findsNWidgets(2));
    });

    testWidgets('renders empty state when no saved locations exist', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            savedLocationsProvider.overrideWith((ref) => Future.value(const [])),
          ],
          child: const MaterialApp(
            home: LocationsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No saved locations yet'), findsOneWidget);
      expect(
        find.text('Click "Add Location" to save your home, work, or any frequently visited place.'),
        findsOneWidget,
      );
    });

    testWidgets('switches to add location form on Add Location tap with interactive map', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            savedLocationsProvider.overrideWith((ref) => Future.value(testLocations)),
          ],
          child: const MaterialApp(
            home: LocationsScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.text('Add Location'));
      await tester.pumpAndSettle();

      expect(find.text('Add New Location'), findsNWidgets(2));
      expect(find.text('Select a position on the map, then fill in the details below.'), findsOneWidget);
      expect(find.text('Select Location on Map'), findsOneWidget);
      expect(find.text('Use Current Location'), findsOneWidget);
      expect(find.text('Location Details'), findsOneWidget);
      expect(find.text('Label'), findsOneWidget);
      expect(find.text('Location Name '), findsOneWidget);
      expect(find.text('Full Address'), findsOneWidget);
      expect(find.text('Area / Locality'), findsOneWidget);
      expect(find.text('City'), findsOneWidget);
      expect(find.text('State'), findsOneWidget);
      expect(find.text('Pincode'), findsOneWidget);
      expect(find.text('Landmark (optional)'), findsOneWidget);
      expect(find.text('Set as my default location'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Save Location'), findsOneWidget);
    });
  });
}
