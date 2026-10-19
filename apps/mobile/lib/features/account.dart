import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/design.dart';
import '../core/state.dart';
import '../core/strings.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController(),
      token = TextEditingController();
  String mode = 'signIn', message = '';
  bool busy = false;
  @override
  void dispose() {
    for (final c in [email, password, name, token]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      busy = true;
      message = '';
    });
    try {
      final api = ref.read(apiProvider);
      switch (mode) {
        case 'signIn':
          await ref
              .read(appProvider.notifier)
              .login(email.text.trim(), password.text);
          if (mounted) context.go('/profile');
        case 'signUp':
          await api.request(
            '/auth/register',
            method: 'POST',
            body: {
              'email': email.text.trim(),
              'password': password.text,
              'name': name.text.trim(),
            },
          );
          if (mounted) {
            setState(() {
              mode = 'verify';
              message = tr(ref, 'verifySent');
            });
          }
        case 'verify':
          await api.request(
            '/auth/verify',
            method: 'POST',
            body: {'token': token.text.trim()},
          );
          if (mounted) {
            setState(() {
              mode = 'signIn';
              message = tr(ref, 'verified');
            });
          }
        case 'reset':
          if (token.text.trim().isEmpty) {
            await api.request(
              '/auth/reset-request',
              method: 'POST',
              body: {'email': email.text.trim()},
            );
            if (mounted) setState(() => message = tr(ref, 'resetSent'));
          } else {
            await api.request(
              '/auth/reset',
              method: 'POST',
              body: {'token': token.text.trim(), 'password': password.text},
            );
            if (mounted) {
              setState(() {
                mode = 'signIn';
                message = tr(ref, 'resetDone');
              });
            }
          }
      }
    } catch (e) {
      if (mounted) setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Brand()),
    body: PageBody(
      children: [
        const SimulationPill(),
        const SizedBox(height: 20),
        Text(tr(ref, mode), style: Theme.of(context).textTheme.headlineLarge),
        const SizedBox(height: 8),
        const T('authBody'),
        const SizedBox(height: 22),
        if (mode == 'signUp') ...[
          TextField(
            controller: name,
            autofillHints: const [AutofillHints.name],
            decoration: InputDecoration(labelText: tr(ref, 'name')),
          ),
          const SizedBox(height: 14),
        ],
        if (mode != 'verify') ...[
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: InputDecoration(labelText: tr(ref, 'email')),
          ),
          const SizedBox(height: 14),
        ],
        if (mode != 'verify') ...[
          TextField(
            controller: password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(
              labelText: tr(ref, mode == 'reset' ? 'newPassword' : 'password'),
            ),
          ),
          const SizedBox(height: 14),
        ],
        if (mode == 'verify' || mode == 'reset') ...[
          TextField(
            controller: token,
            decoration: InputDecoration(labelText: tr(ref, 'token')),
          ),
          const SizedBox(height: 14),
        ],
        if (message.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(message),
          ),
        FilledButton(
          onPressed: busy ? null : submit,
          child: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : T(mode),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [
            for (final option in ['signIn', 'signUp', 'verify', 'reset'])
              if (option != mode)
                TextButton(
                  onPressed: busy
                      ? null
                      : () => setState(() {
                          mode = option;
                          message = '';
                        }),
                  child: T(option),
                ),
          ],
        ),
        TextButton(onPressed: () => context.go('/'), child: const T('guest')),
      ],
    ),
  );
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool? adult, accepted;
  bool busy = false;
  Future<void> action(Future<void> Function() callback) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await callback();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider),
        controller = ref.read(appProvider.notifier);
    return PageBody(
      children: [
        Text(
          state.user?['name']?.toString() ?? tr(ref, 'profile'),
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 8),
        const SimulationPill(),
        if (!state.signedIn) ...[
          const SizedBox(height: 18),
          FilledButton(
            onPressed: () => context.push('/auth'),
            child: const T('signIn'),
          ),
        ],
        const Heading('preferences'),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tr(ref, 'language'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'en', label: Text('English')),
                  ButtonSegment(value: 'ne', label: Text('नेपाली')),
                ],
                selected: {state.language},
                onSelectionChanged: (value) =>
                    action(() => controller.preferences(language: value.first)),
              ),
              const SizedBox(height: 20),
              Text(
                tr(ref, 'theme'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Wrap(
                spacing: 8,
                children: [
                  for (final theme in ['system', 'light', 'dark'])
                    ChoiceChip(
                      label: T(theme),
                      selected: state.theme == theme,
                      onSelected: (_) =>
                          action(() => controller.preferences(theme: theme)),
                    ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const T('reduceMotion'),
                value: state.reduceMotion,
                onChanged: (v) =>
                    action(() => controller.preferences(reduceMotion: v)),
              ),
              const T('pushStatus'),
            ],
          ),
        ),
        if (state.signedIn) ...[
          const Heading('account'),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const T('adult'),
            value: adult ?? state.user?['adultConfirmed'] == true,
            onChanged: (v) => setState(() => adult = v),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const T('acceptTerms'),
            value: accepted ?? state.user?['termsAccepted'] == true,
            onChanged: (v) => setState(() => accepted = v),
          ),
          FilledButton(
            onPressed: busy
                ? null
                : () => action(() async {
                    await ref
                        .read(apiProvider)
                        .request(
                          '/me',
                          method: 'PATCH',
                          body: {
                            'adultConfirmed':
                                adult ?? state.user?['adultConfirmed'] == true,
                            'termsAccepted':
                                accepted ??
                                state.user?['termsAccepted'] == true,
                          },
                        );
                    await controller.refreshUser();
                    if (context.mounted) {
                      ScaffoldMessenger.of(
                        context,
                      ).showSnackBar(SnackBar(content: T('profileSaved')));
                    }
                  }),
            child: const T('saveProfile'),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () => context.push('/owner'),
            icon: const Icon(Icons.storefront_outlined),
            label: const T('owner'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => _support(context, ref),
            child: const T('support'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => action(() async {
              final data = await ref.read(apiProvider).request('/me/export');
              if (context.mounted) {
                await showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (_) => SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: SelectableText(
                      const JsonEncoder.withIndent('  ').convert(data),
                    ),
                  ),
                );
              }
            }),
            child: const T('export'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: busy ? null : () => action(() => controller.signOut()),
            child: const T('signOut'),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => _delete(context, ref),
            child: Text(
              tr(ref, 'deletion'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
        TextButton(
          onPressed: () => context.push('/privacy'),
          child: const T('privacy'),
        ),
        TextButton(
          onPressed: () => context.push('/learn'),
          child: const T('learning'),
        ),
      ],
    );
  }
}

Future<void> _support(BuildContext context, WidgetRef ref) async {
  final subject = TextEditingController(), body = TextEditingController();
  await showDialog<void>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: const T('support'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: subject,
              decoration: InputDecoration(labelText: tr(ref, 'title')),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: body,
              maxLines: 4,
              decoration: InputDecoration(labelText: tr(ref, 'body')),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog),
          child: const T('close'),
        ),
        FilledButton(
          onPressed: () async {
            try {
              await ref
                  .read(apiProvider)
                  .request(
                    '/support',
                    method: 'POST',
                    body: {'subject': subject.text, 'body': body.text},
                  );
              if (dialog.mounted) Navigator.pop(dialog);
              if (context.mounted) {
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: T('requestSent')));
              }
            } catch (e) {
              if (dialog.mounted) showError(dialog, e);
            }
          },
          child: const T('send'),
        ),
      ],
    ),
  );
  subject.dispose();
  body.dispose();
}

Future<void> _delete(BuildContext context, WidgetRef ref) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: const T('deletion'),
      content: const T('deleteBody'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog, false),
          child: const T('close'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialog, true),
          child: const T('deleteConfirm'),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  try {
    final result = await ref
        .read(apiProvider)
        .request('/me/deletion', method: 'POST', body: {'confirm': true});
    await ref.read(appProvider.notifier).signOut(localOnly: true);
    if (context.mounted) {
      await showDialog<void>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const T('deletion'),
          content: SelectableText(
            '${result['status']}\n${result['message']}\n${result['id']}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog),
              child: const T('close'),
            ),
          ],
        ),
      );
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const T('privacy')),
    body: const PageBody(
      children: [
        SimulationPill(),
        SizedBox(height: 24),
        T('privacyBody'),
        SizedBox(height: 20),
        T('noMoney'),
        SizedBox(height: 20),
        T('dilution'),
        SizedBox(height: 20),
        T('uploadNotice'),
      ],
    ),
  );
}

class LearningScreen extends ConsumerStatefulWidget {
  const LearningScreen({super.key});
  @override
  ConsumerState<LearningScreen> createState() => _LearningScreenState();
}

class _LearningScreenState extends ConsumerState<LearningScreen> {
  String? answer;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const T('learning')),
    body: PageBody(
      children: [
        const SizedBox(height: 180, child: StoryArt(seed: 2)),
        const SizedBox(height: 20),
        const T('learningBody'),
        for (final prefix in ['equity', 'dilution', 'valuation', 'risk']) ...[
          Heading('${prefix}Title'),
          Panel(child: T('${prefix}Body')),
        ],
        const Heading('check'),
        const T('question'),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          children: [
            for (final key in ['answerYes', 'answerNo'])
              OutlinedButton(
                onPressed: () => setState(
                  () => answer = key == 'answerNo' ? 'correct' : 'incorrect',
                ),
                child: T(key),
              ),
          ],
        ),
        if (answer != null)
          Padding(padding: const EdgeInsets.only(top: 12), child: T(answer!)),
      ],
    ),
  );
}
