import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'state.dart';

final translations = <String, Map<String, dynamic>>{};
Future<void> loadTranslations() async {
  for (final language in ['en', 'ne']) {
    translations[language] =
        jsonDecode(await rootBundle.loadString('assets/l10n/$language.json'))
            as Map<String, dynamic>;
  }
}

String tr(WidgetRef ref, String key) =>
    translations[ref.watch(appProvider).language]?[key]?.toString() ??
    translations['en']?[key]?.toString() ??
    key;

class T extends ConsumerWidget {
  const T(this.keyName, {super.key, this.style});
  final String keyName;
  final TextStyle? style;
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      Text(tr(ref, keyName), style: style);
}
