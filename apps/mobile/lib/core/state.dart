import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'models.dart';

final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError(),
);
final apiProvider = Provider<ApiClient>((ref) => ApiClient());
final appProvider = NotifierProvider<AppController, AppState>(
  AppController.new,
);
final businessesProvider = FutureProvider<List<Business>>((ref) async {
  final api = ref.watch(apiProvider);
  final prefs = ref.watch(prefsProvider);
  try {
    final data = await api.request('/businesses');
    await prefs.setString('publicBusinesses', jsonEncode(data));
    await prefs.setString(
      'publicUpdated',
      DateTime.now().toUtc().toIso8601String(),
    );
    return (data['items'] as List).map((e) => Business(Json.from(e))).toList();
  } catch (_) {
    final cache = prefs.getString('publicBusinesses');
    if (cache == null) rethrow;
    return ((jsonDecode(cache) as Map)['items'] as List)
        .map((e) => Business(Json.from(e)..['cached'] = true))
        .toList();
  }
});
final portfolioProvider = FutureProvider<Json>((ref) {
  ref.watch(appProvider);
  return ref.read(apiProvider).request('/portfolio');
});
final activityProvider = FutureProvider<Json>((ref) {
  ref.watch(appProvider);
  return ref.read(apiProvider).request('/activity');
});
final inboxProvider = FutureProvider<Json>((ref) {
  ref.watch(appProvider);
  return ref.read(apiProvider).request('/notifications');
});

class AppState {
  const AppState({
    this.language = 'en',
    this.theme = 'system',
    this.reduceMotion = false,
    this.introSeen = false,
    this.user,
    this.saved = const {},
    this.compared = const {},
  });
  final String language, theme;
  final bool reduceMotion, introSeen;
  final Json? user;
  final Set<String> saved, compared;
  bool get signedIn => user != null;
  AppState copy({
    String? language,
    String? theme,
    bool? reduceMotion,
    bool? introSeen,
    Json? user,
    bool clearUser = false,
    Set<String>? saved,
    Set<String>? compared,
  }) => AppState(
    language: language ?? this.language,
    theme: theme ?? this.theme,
    reduceMotion: reduceMotion ?? this.reduceMotion,
    introSeen: introSeen ?? this.introSeen,
    user: clearUser ? null : user ?? this.user,
    saved: saved ?? this.saved,
    compared: compared ?? this.compared,
  );
}

class AppController extends Notifier<AppState> {
  final secure = const FlutterSecureStorage();
  @override
  AppState build() {
    final p = ref.read(prefsProvider);
    return AppState(
      language: p.getString('language') ?? 'en',
      theme: p.getString('theme') ?? 'system',
      reduceMotion: p.getBool('reduceMotion') ?? false,
      introSeen: p.getBool('introSeen') ?? false,
    );
  }

  Future<void> restore() async {
    final token = await secure.read(key: 'session');
    if (token == null) return;
    ref.read(apiProvider).token = token;
    try {
      await refreshUser();
    } catch (_) {
      await signOut(localOnly: true);
    }
  }

  Future<void> refreshUser() async {
    final api = ref.read(apiProvider);
    final user = await api.request('/me');
    final saved = await api.request('/saved');
    state = state.copy(
      user: user,
      saved: (saved['businessIds'] as List).map((e) => e.toString()).toSet(),
    );
    final p = user['preferences'];
    if (p is Map) {
      await preferences(
        language: p['language'] as String?,
        theme: p['theme'] as String?,
        reduceMotion: p['motion'] == 'reduced',
        sync: false,
      );
    }
  }

  Future<void> login(String email, String password) async {
    final result = await ref
        .read(apiProvider)
        .request(
          '/auth/login',
          method: 'POST',
          body: {'email': email, 'password': password},
        );
    ref.read(apiProvider).token = result['accessToken'];
    await secure.write(key: 'session', value: result['accessToken']);
    await refreshUser();
  }

  Future<void> signOut({bool localOnly = false}) async {
    if (!localOnly) {
      await ref.read(apiProvider).request('/auth/logout', method: 'POST');
    }
    await secure.delete(key: 'session');
    ref.read(apiProvider).token = null;
    state = state.copy(clearUser: true, saved: {}, compared: {});
  }

  Future<void> preferences({
    String? language,
    String? theme,
    bool? reduceMotion,
    bool sync = true,
  }) async {
    state = state.copy(
      language: language,
      theme: theme,
      reduceMotion: reduceMotion,
    );
    final p = ref.read(prefsProvider);
    await p.setString('language', state.language);
    await p.setString('theme', state.theme);
    await p.setBool('reduceMotion', state.reduceMotion);
    if (sync && state.signedIn) {
      await ref
          .read(apiProvider)
          .request(
            '/me',
            method: 'PATCH',
            body: {
              'preferences': {
                'language': state.language,
                'theme': state.theme,
                'motion': state.reduceMotion ? 'reduced' : 'system',
                'notifications': true,
              },
            },
          );
    }
  }

  Future<void> finishIntro() async {
    await ref.read(prefsProvider).setBool('introSeen', true);
    state = state.copy(introSeen: true);
  }

  Future<void> save(String id) async {
    final before = state.saved;
    state = state.copy(
      saved: before.contains(id) ? ({...before}..remove(id)) : {...before, id},
    );
    try {
      await ref.read(apiProvider).request('/saved/$id', method: 'POST');
    } catch (_) {
      state = state.copy(saved: before);
      rethrow;
    }
  }

  void compare(String id) {
    if (state.compared.contains(id)) {
      state = state.copy(compared: {...state.compared}..remove(id));
    } else if (state.compared.length < 3) {
      state = state.copy(compared: {...state.compared, id});
    }
  }
}
