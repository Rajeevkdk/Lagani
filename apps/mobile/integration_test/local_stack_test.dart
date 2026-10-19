import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lagani/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native investor discovery reaches the real local API', (
    tester,
  ) async {
    await app.main();
    await tester.pumpAndSettle(const Duration(seconds: 1));
    final skip = find.text('Skip introduction');
    if (skip.evaluate().isNotEmpty) {
      await tester.tap(skip);
      await tester.pumpAndSettle(const Duration(seconds: 1));
    }
    await tester.tap(find.text('Explore').last);
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Simulation · No real money'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Paila Parcel Collective'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Paila Parcel Collective'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
