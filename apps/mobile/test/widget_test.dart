import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lagani/core/api.dart';
import 'package:lagani/core/models.dart';
import 'package:lagani/core/state.dart';
import 'package:lagani/core/strings.dart';
import 'package:lagani/core/design.dart';
import 'package:lagani/features/invest.dart';
import 'package:lagani/main.dart';

class WidgetApi extends ApiClient {
  int confirmations = 0;
  @override
  Future<Json> request(String path, {String method = 'GET', Json? body}) async {
    if (path == '/businesses') return {'items': <Json>[]};
    if (path == '/saved') return {'businessIds': <String>[]};
    if (path == '/me') {
      return {
        'id': 'user',
        'name': 'Demo adult',
        'adultConfirmed': true,
        'termsAccepted': true,
        'availablePaisa': '50000000',
        'preferences': {'language': 'en', 'theme': 'light'},
      };
    }
    if (path == '/businesses/demo') {
      return {
        'id': 'demo',
        'name': 'Fictional Seed Workshop',
        'round': {'id': 'round', 'status': 'open'},
      };
    }
    if (path == '/rounds/round/quote') {
      return {
        'id': 'quote',
        'shares': '10000',
        'amountPaisa': '10000000',
        'ownershipPercent': '1.000000',
        'feesPaisa': '0',
        'termsVersion': '1',
        'expiresAt': '2026-10-19T00:00:00Z',
        'availablePaisa': '50000000',
      };
    }
    if (path == '/commitments') {
      confirmations++;
      return {
        'id': 'commitment',
        'amountPaisa': '10000000',
        'shares': '10000',
        'status': 'committed',
        'termsVersion': '1',
      };
    }
    return {'items': <Json>[], 'holdings': <Json>[], 'commitments': <Json>[]};
  }
}

Future<ProviderContainer> bootstrap(
  WidgetTester tester, {
  String language = 'en',
  String theme = 'light',
  bool introSeen = true,
}) async {
  SharedPreferences.setMockInitialValues({
    'introSeen': introSeen,
    'language': language,
    'theme': theme,
    'reduceMotion': true,
  });
  FlutterSecureStorage.setMockInitialValues({});
  await tester.runAsync(loadTranslations);
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      prefsProvider.overrideWithValue(prefs),
      apiProvider.overrideWithValue(WidgetApi()),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const LaganiApp()),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  test('English and Nepali localization resources have identical keys', () {
    final en =
        jsonDecode(File('assets/l10n/en.json').readAsStringSync()) as Map;
    final ne =
        jsonDecode(File('assets/l10n/ne.json').readAsStringSync()) as Map;
    expect(ne.keys.toSet(), en.keys.toSet());
    expect(ne.values.every((v) => v.toString().isNotEmpty), isTrue);
  });
  testWidgets('first use is immediately skippable and persists', (
    tester,
  ) async {
    final container = await bootstrap(tester, introSeen: false);
    await tester.tap(find.text('Skip introduction'));
    await tester.pumpAndSettle();
    expect(container.read(appProvider).introSeen, isTrue);
    expect(container.read(prefsProvider).getBool('introSeen'), isTrue);
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    expect(tester.takeException(), isNull);
  });
  testWidgets('guest sees five destinations and sign-in gate', (tester) async {
    await bootstrap(tester);
    await tester.tap(find.text('Portfolio').last);
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsOneWidget);
    expect(
      find.text('Sign in to save, simulate, or manage your account.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Nepali dark theme at 200 percent text has no layout exceptions',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 2;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await bootstrap(tester, language: 'ne', theme: 'dark', introSeen: false);
      expect(find.text('परिचय छोड्नुहोस्'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'server quote requires two unchecked acknowledgments and submits once',
    (tester) async {
      final container = await bootstrap(tester);
      await container.read(appProvider.notifier).refreshUser();
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: laganiTheme(Brightness.light),
            home: const InvestScreen(id: 'demo'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Get server quote'));
      await tester.pumpAndSettle();
      expect(find.text('NPR 100,000.00'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byWidgetPredicate(
          (w) =>
              w is CheckboxListTile &&
              w.title is T &&
              (w.title as T).keyName == 'riskAck',
        ),
        250,
        scrollable: find
            .descendant(
              of: find.byType(PageBody),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      expect(find.byType(CheckboxListTile), findsNWidgets(2));
      for (final tile in tester.widgetList<CheckboxListTile>(
        find.byType(CheckboxListTile),
      )) {
        expect(tile.value, isFalse);
      }
      final confirm = find.widgetWithText(FilledButton, 'Confirm simulation');
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.ensureVisible(find.byType(CheckboxListTile).first);
      await tester.tap(find.byType(CheckboxListTile).first);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(CheckboxListTile).last);
      await tester.tap(find.byType(CheckboxListTile).last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(confirm);
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect((container.read(apiProvider) as WidgetApi).confirmations, 1);
      expect(find.text('Simulation receipt · nonbinding'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
