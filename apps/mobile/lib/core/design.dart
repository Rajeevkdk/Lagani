import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'models.dart';
import 'state.dart';
import 'strings.dart';

const ink = Color(0xff22243a);
const purple = Color(0xff5c3df5);
const cream = Color(0xfffff8f0);
const accents = [
  Color(0xffffd166),
  Color(0xffbce9d8),
  Color(0xffc6b9ff),
  Color(0xffff8b73),
  Color(0xffb8dffc),
];
ThemeData laganiTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: purple, brightness: brightness)
      .copyWith(
        primary: dark ? const Color(0xffb8a8ff) : purple,
        onPrimary: dark ? ink : Colors.white,
        surface: dark ? const Color(0xff232536) : Colors.white,
        onSurface: dark ? const Color(0xfff5f2ff) : ink,
        error: dark ? const Color(0xffffb3be) : const Color(0xffb42336),
      );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'NotoSansDevanagari',
    scaffoldBackgroundColor: dark ? const Color(0xff171823) : cream,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xff171823) : cream,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .5)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      contentPadding: const EdgeInsets.all(18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 54),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      height: 80,
      indicatorColor: Color(0xffe5ddff),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        height: 1.3,
        letterSpacing: -1.0,
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        height: 1.3,
      ),
      titleLarge: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
      titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      bodyLarge: TextStyle(fontSize: 16, height: 1.65),
      bodyMedium: TextStyle(fontSize: 14, height: 1.6),
    ),
  );
}

Duration motionDuration(
  BuildContext context,
  WidgetRef ref, [
  int milliseconds = 250,
]) => Duration(
  milliseconds:
      ref.watch(appProvider).reduceMotion ||
          MediaQuery.disableAnimationsOf(context)
      ? 0
      : milliseconds,
);

class Brand extends StatelessWidget {
  const Brand({super.key});
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: purple,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.spa_rounded, color: Colors.white, size: 23),
      ),
      const SizedBox(width: 9),
      const Text(
        'lagani',
        style: TextStyle(
          fontSize: 27,
          fontWeight: FontWeight.w900,
          letterSpacing: -1,
        ),
      ),
    ],
  );
}

class SimulationPill extends ConsumerWidget {
  const SimulationPill({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    decoration: BoxDecoration(
      color: accents[0],
      borderRadius: BorderRadius.circular(24),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.science_outlined, size: 16, color: ink),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            tr(ref, 'simulation'),
            style: const TextStyle(
              color: ink,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.color, this.padding = 20});
  final Widget child;
  final Color? color;
  final double padding;
  @override
  Widget build(BuildContext context) => Card(
    color: color,
    child: Padding(padding: EdgeInsets.all(padding), child: child),
  );
}

class Heading extends ConsumerWidget {
  const Heading(this.label, {super.key, this.action, this.onTap});
  final String label;
  final String? action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.only(top: 26, bottom: 14),
    child: Row(
      children: [
        Expanded(
          child: Text(
            tr(ref, label),
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
        if (action != null) TextButton(onPressed: onTap, child: T(action!)),
      ],
    ),
  );
}

class Fact extends ConsumerWidget {
  const Fact(this.label, this.value, {super.key});
  final String label, value;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      spacing: 14,
      runSpacing: 4,
      children: [
        Text(
          tr(ref, label),
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
}

class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
    children: children,
  );
}

class MessageState extends ConsumerWidget {
  const MessageState({super.key, this.error, this.retry, this.empty = false});
  final Object? error;
  final VoidCallback? retry;
  final bool empty;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 140, child: StoryArt(seed: 2)),
        Text(
          tr(ref, empty ? 'empty' : 'error'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Text(
          empty ? tr(ref, 'emptyBody') : error.toString(),
          textAlign: TextAlign.center,
        ),
        if (retry != null)
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: FilledButton.icon(
              onPressed: retry,
              icon: const Icon(Icons.refresh),
              label: T('retry'),
            ),
          ),
      ],
    ),
  );
}

class LoadingCards extends ConsumerWidget {
  const LoadingCards({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Semantics(
    label: tr(ref, 'loading'),
    child: ListView(
      shrinkWrap: true,
      children: List.generate(
        3,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Container(
            height: 170,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(24),
            ),
          ),
        ),
      ),
    ),
  );
}

class SignInGate extends ConsumerWidget {
  const SignInGate({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      ref.watch(appProvider).signedIn
      ? child
      : PageBody(
          children: [
            const SizedBox(height: 40),
            const SizedBox(height: 210, child: StoryArt(seed: 3)),
            const T('accountRequired'),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => context.push('/auth'),
              child: const T('signIn'),
            ),
          ],
        );
}

void showError(BuildContext context, Object error) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(error.toString())));

/// Original vector illustration: joining leaves, hills, and fictional workshops.
class StoryArt extends StatelessWidget {
  const StoryArt({super.key, this.seed = 0});
  final int seed;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(painter: _StoryPainter(seed), size: Size.infinite),
  );
}

class _StoryPainter extends CustomPainter {
  _StoryPainter(this.seed);
  final int seed;
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 360;
    canvas.save();
    canvas.scale(s, size.height / 210);
    final p = Paint()..color = accents[seed % accents.length];
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, 0, 360, 210),
        const Radius.circular(23),
      ),
      p,
    );
    p.color = Colors.white.withValues(alpha: .4);
    canvas.drawCircle(const Offset(287, 45), 30, p);
    final hill = Path()
      ..moveTo(0, 185)
      ..quadraticBezierTo(80, 105, 170, 165)
      ..quadraticBezierTo(280, 110, 360, 163)
      ..lineTo(360, 210)
      ..lineTo(0, 210)
      ..close();
    p.color = ink.withValues(alpha: .10);
    canvas.drawPath(hill, p);
    p.color = const Color(0xfffdf8ec);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(95, 78, 155, 103),
        const Radius.circular(7),
      ),
      p,
    );
    p.color = ink;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(90, 65, 166, 29),
        const Radius.circular(7),
      ),
      p,
    );
    for (int i = 0; i < 6; i++) {
      p.color = i.isEven ? const Color(0xffff8b73) : const Color(0xfffdf8ec);
      canvas.drawRect(Rect.fromLTWH(94 + i * 26, 70, 24, 22), p);
    }
    p.color = purple;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(113, 116, 44, 65),
        const Radius.circular(4),
      ),
      p,
    );
    p.color = accents[4];
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(173, 112, 56, 43),
        const Radius.circular(4),
      ),
      p,
    );
    p
      ..color = ink
      ..strokeWidth = 3;
    canvas.drawLine(const Offset(201, 112), const Offset(201, 155), p);
    canvas.drawLine(const Offset(173, 133), const Offset(229, 133), p);
    p.color = const Color(0xff17644c);
    canvas.drawOval(const Rect.fromLTWH(46, 98, 30, 50), p);
    canvas.drawOval(const Rect.fromLTWH(64, 80, 28, 48), p);
    canvas.drawLine(const Offset(70, 117), const Offset(70, 183), p);
    p.color = const Color(0xffff8b73);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(52, 162, 37, 28),
        const Radius.circular(7),
      ),
      p,
    );
    p.color = purple;
    canvas.drawCircle(const Offset(285, 121), 13, p);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(272, 137, 29, 43),
        const Radius.circular(10),
      ),
      p,
    );
    p
      ..color = ink
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(280, 176), const Offset(275, 193), p);
    canvas.drawLine(const Offset(292, 176), const Offset(299, 193), p);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _StoryPainter oldDelegate) =>
      oldDelegate.seed != seed;
}

class BusinessCard extends ConsumerWidget {
  const BusinessCard(this.business, {super.key, this.index = 0});
  final Business business;
  final int index;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => context.push('/business/${business.id}'),
              child: Hero(
                tag: 'business-${business.id}',
                child: SizedBox(
                  height: 188,
                  width: double.infinity,
                  child: StoryArt(seed: index),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    children: [
                      Text(
                        business.sector.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '· ${business.location}',
                        style: const TextStyle(fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: () => context.push('/business/${business.id}'),
                    child: Text(
                      business.name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(business.tagline),
                  const SizedBox(height: 14),
                  if (business.round != null) ...[
                    Fact('target', money(business.round!['targetPaisa'])),
                    Text(
                      business.round!['status'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              context.push('/business/${business.id}'),
                          child: const T('view'),
                        ),
                      ),
                      IconButton(
                        tooltip: tr(ref, 'save'),
                        onPressed: () async {
                          if (!state.signedIn) {
                            context.push('/auth');
                            return;
                          }
                          try {
                            await ref
                                .read(appProvider.notifier)
                                .save(business.id);
                          } catch (e) {
                            if (context.mounted) showError(context, e);
                          }
                        },
                        icon: Icon(
                          state.saved.contains(business.id)
                              ? Icons.bookmark
                              : Icons.bookmark_outline,
                        ),
                      ),
                      IconButton(
                        tooltip: tr(ref, 'compareLimit'),
                        onPressed:
                            state.compared.length >= 3 &&
                                !state.compared.contains(business.id)
                            ? null
                            : () => ref
                                  .read(appProvider.notifier)
                                  .compare(business.id),
                        icon: Icon(
                          state.compared.contains(business.id)
                              ? Icons.check_circle
                              : Icons.compare_arrows,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
