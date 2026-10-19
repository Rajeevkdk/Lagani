import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/design.dart';
import 'core/state.dart';
import 'core/strings.dart';
import 'features/discover.dart';
import 'features/invest.dart';
import 'features/account.dart';
import 'features/owner.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  await loadTranslations();
  runApp(
    ProviderScope(
      overrides: [prefsProvider.overrideWithValue(prefs)],
      child: const LaganiApp(),
    ),
  );
}

final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    routes: [
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.uri.path, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          GoRoute(path: '/explore', builder: (_, _) => const ExploreScreen()),
          GoRoute(
            path: '/portfolio',
            builder: (_, _) => const PortfolioScreen(),
          ),
          GoRoute(path: '/activity', builder: (_, _) => const ActivityScreen()),
          GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
        ],
      ),
      GoRoute(
        path: '/business/:id',
        builder: (_, state) =>
            BusinessDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/report/:id',
        builder: (_, state) => ReportScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/invest/:id',
        builder: (_, state) => InvestScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(path: '/compare', builder: (_, _) => const CompareScreen()),
      GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
      GoRoute(path: '/inbox', builder: (_, _) => const InboxScreen()),
      GoRoute(path: '/learn', builder: (_, _) => const LearningScreen()),
      GoRoute(path: '/owner', builder: (_, _) => const OwnerScreen()),
      GoRoute(
        path: '/owner/:id',
        builder: (_, state) => OwnerEditScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(path: '/privacy', builder: (_, _) => const PrivacyScreen()),
    ],
  ),
);

class LaganiApp extends ConsumerStatefulWidget {
  const LaganiApp({super.key});
  @override
  ConsumerState<LaganiApp> createState() => _LaganiAppState();
}

class _LaganiAppState extends ConsumerState<LaganiApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(appProvider.notifier).restore());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    return MaterialApp.router(
      title: 'Lagani',
      debugShowCheckedModeBanner: false,
      theme: laganiTheme(Brightness.light),
      darkTheme: laganiTheme(Brightness.dark),
      themeMode: state.theme == 'light'
          ? ThemeMode.light
          : state.theme == 'dark'
          ? ThemeMode.dark
          : ThemeMode.system,
      themeAnimationDuration: Duration(
        milliseconds: state.reduceMotion ? 0 : 200,
      ),
      locale: Locale(state.language),
      supportedLocales: const [Locale('en'), Locale('ne')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: ref.watch(routerProvider),
    );
  }
}

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child, required this.location});
  final Widget child;
  final String location;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paths = ['/', '/explore', '/portfolio', '/activity', '/profile'];
    final labels = ['home', 'explore', 'portfolio', 'activity', 'profile'];
    final icons = [
      Icons.home_outlined,
      Icons.explore_outlined,
      Icons.pie_chart_outline,
      Icons.receipt_long_outlined,
      Icons.person_outline,
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Brand(),
        actions: [
          IconButton(
            tooltip: tr(ref, 'inbox'),
            onPressed: () => context.push('/inbox'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: child,
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: paths.indexOf(location).clamp(0, 4),
        onDestinationSelected: (index) => context.go(paths[index]),
        destinations: [
          for (var i = 0; i < paths.length; i++)
            NavigationDestination(
              icon: Icon(icons[i]),
              label: tr(ref, labels[i]),
            ),
        ],
      ),
    );
  }
}
