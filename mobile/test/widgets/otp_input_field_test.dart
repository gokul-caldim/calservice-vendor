import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/shared/widgets/otp_input_field.dart';

void main() {
  group('OtpInputField', () {
    testWidgets('renders 6 text fields by default', (WidgetTester tester) async {
      String enteredOtp = '';
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpInputField(
              onChanged: (val) => enteredOtp = val,
            ),
          ),
        ),
      );

      final textFields = find.byType(TextField);
      expect(textFields, findsNWidgets(6));

      await tester.enterText(textFields.at(0), '1');
      await tester.pump();
      expect(enteredOtp, equals('1'));

      await tester.enterText(textFields.at(1), '2');
      await tester.pump();
      expect(enteredOtp, equals('12'));
    });
  });
}
