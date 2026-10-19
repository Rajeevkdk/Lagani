import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/design.dart';
import '../core/models.dart';
import '../core/state.dart';
import '../core/strings.dart';

final ownerProvider = FutureProvider<List<Business>>((ref) async {
  ref.watch(appProvider);
  final data = await ref.watch(apiProvider).request('/owner/businesses');
  return (data['items'] as List).map((e) => Business(Json.from(e))).toList();
});

class OwnerScreen extends ConsumerWidget {
  const OwnerScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const T('owner')),
    body: SignInGate(
      child: PageBody(
        children: [
          const SimulationPill(),
          const SizedBox(height: 20),
          Text(
            tr(ref, 'ownerBody'),
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => context.push('/owner/new'),
            icon: const Icon(Icons.add),
            label: const T('createBusiness'),
          ),
          const SizedBox(height: 20),
          ref
              .watch(ownerProvider)
              .when(
                data: (items) => items.isEmpty
                    ? const MessageState(empty: true)
                    : Column(
                        children: [
                          for (final b in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Panel(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      b.name,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleLarge,
                                    ),
                                    Fact('status', b.status),
                                    if (b.round != null) ...[
                                      Fact(
                                        'committed',
                                        money(b.round!['committedPaisa']),
                                      ),
                                      Fact(
                                        'target',
                                        money(b.round!['targetPaisa']),
                                      ),
                                    ],
                                    OutlinedButton(
                                      onPressed: () =>
                                          context.push('/owner/${b.id}'),
                                      child: const T('view'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                error: (e, _) => MessageState(
                  error: e,
                  retry: () => ref.invalidate(ownerProvider),
                ),
                loading: () => const LoadingCards(),
              ),
        ],
      ),
    ),
  );
}

class OwnerEditScreen extends ConsumerStatefulWidget {
  const OwnerEditScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<OwnerEditScreen> createState() => _OwnerEditScreenState();
}

class _OwnerEditScreenState extends ConsumerState<OwnerEditScreen> {
  final fields = <String, TextEditingController>{
    for (final key in [
      'name',
      'sector',
      'location',
      'tagline',
      'story',
      'founderName',
      'registration',
      'pan',
      'controllers',
      'bankOwnership',
      'existingShares',
      'preMoneyPaisa',
      'targetPaisa',
      'sharePricePaisa',
      'minPaisa',
      'incrementPaisa',
      'risks',
      'fundingUse',
      'csv',
      'updateTitle',
      'updateBody',
    ])
      key: TextEditingController(),
  };
  Business? business;
  String? id;
  bool loading = true, busy = false, guidelines = false;
  String? message;
  Json? preview;
  @override
  void initState() {
    super.initState();
    Future.microtask(load);
  }

  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> load() async {
    try {
      id = widget.id == 'new' ? null : widget.id;
      if (id != null) {
        final all = await ref.read(ownerProvider.future);
        business = all.firstWhere((b) => b.id == id);
        for (final key in [
          'name',
          'sector',
          'location',
          'tagline',
          'story',
          'founderName',
        ]) {
          fields[key]!.text = business!.data[key]?.toString() ?? '';
        }
        final private = business!.data['privateDetails'] as Map?;
        for (final key in [
          'registration',
          'pan',
          'controllers',
          'bankOwnership',
        ]) {
          fields[key]!.text = private?[key]?.toString() ?? '';
        }
        for (final key in [
          'existingShares',
          'preMoneyPaisa',
          'targetPaisa',
          'sharePricePaisa',
          'minPaisa',
          'incrementPaisa',
        ]) {
          fields[key]!.text = business!.round?[key]?.toString() ?? '';
        }
        fields['risks']!.text = business!.risks.join('\n');
        fields['fundingUse']!.text =
            (business!.data['fundingUse'] as List? ?? []).join('\n');
      } else {
        final draft = ref.read(prefsProvider).getString('ownerDraft');
        if (draft != null) {
          final values = jsonDecode(draft) as Map;
          for (final entry in values.entries) {
            fields[entry.key]?.text = entry.value.toString();
          }
        }
      }
      fields['csv']!.text =
          (await ref.read(apiProvider).request('/financials/template'))['csv']
              .toString();
    } catch (e) {
      message = e.toString();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> run(Future<void> Function() fn) async {
    if (busy) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> save() async {
    final api = ref.read(apiProvider);
    final data = <String, dynamic>{
      for (final key in [
        'name',
        'sector',
        'location',
        'tagline',
        'story',
        'founderName',
      ])
        key: fields[key]!.text,
    };
    // Public fictional draft fields only. No picked document bytes are persisted.
    await ref.read(prefsProvider).setString('ownerDraft', jsonEncode(data));
    if (id == null) {
      final result = await api.request(
        '/owner/businesses',
        method: 'POST',
        body: data,
      );
      id = result['id'].toString();
    }
    final details = <String, dynamic>{
      ...data,
      'privateDetails': {
        for (final key in [
          'registration',
          'pan',
          'controllers',
          'bankOwnership',
        ])
          key: fields[key]!.text,
      },
      'risks': fields['risks']!.text
          .split('\n')
          .where((v) => v.trim().isNotEmpty)
          .toList(),
      'fundingUse': fields['fundingUse']!.text
          .split('\n')
          .where((v) => v.trim().isNotEmpty)
          .toList(),
    };
    final round = <String, dynamic>{
      for (final key in [
        'existingShares',
        'preMoneyPaisa',
        'targetPaisa',
        'sharePricePaisa',
        'minPaisa',
        'incrementPaisa',
      ])
        if (fields[key]!.text.trim().isNotEmpty) key: fields[key]!.text.trim(),
    };
    if (round.isNotEmpty) details['round'] = round;
    await api.request('/owner/businesses/$id', method: 'PATCH', body: details);
    ref.invalidate(ownerProvider);
    if (mounted) setState(() => message = tr(ref, 'draftSaved'));
  }

  Future<void> reload() async {
    ref.invalidate(ownerProvider);
    final items = await ref.read(ownerProvider.future);
    if (mounted) setState(() => business = items.firstWhere((b) => b.id == id));
  }

  Widget field(String key, String label, {int lines = 1}) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextField(
      controller: fields[key],
      maxLines: lines,
      enabled: !busy,
      decoration: InputDecoration(labelText: tr(ref, label)),
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: T(id == null ? 'createBusiness' : 'owner')),
    body: SignInGate(
      child: loading
          ? const LoadingCards()
          : PageBody(
              children: [
                const SimulationPill(),
                const SizedBox(height: 16),
                const T('uploadNotice'),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: SelectableText(message!),
                  ),
                if (busy) const LinearProgressIndicator(),
                const Heading('about'),
                field('name', 'businessName'),
                field('sector', 'sector'),
                field('location', 'location'),
                field('tagline', 'tagline'),
                field('founderName', 'founderName'),
                field('story', 'story', lines: 4),
                const Heading('documents'),
                field('registration', 'registration'),
                field('pan', 'pan'),
                field('controllers', 'controllers', lines: 2),
                field('bankOwnership', 'bankOwnership'),
                const Heading('terms'),
                field('existingShares', 'founderShares'),
                field('preMoneyPaisa', 'preMoneyPaisa'),
                field('targetPaisa', 'targetPaisa'),
                field('sharePricePaisa', 'sharePricePaisa'),
                field('minPaisa', 'minPaisa'),
                field('incrementPaisa', 'incrementPaisa'),
                field('risks', 'risks', lines: 3),
                field('fundingUse', 'fundingUse', lines: 3),
                FilledButton(
                  onPressed: busy ? null : () => run(save),
                  child: const T('saveDraft'),
                ),
                if (id != null) ...[
                  const Heading('financials'),
                  field('csv', 'csvInput', lines: 6),
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            final result = await ref
                                .read(apiProvider)
                                .request(
                                  '/owner/businesses/$id/financials',
                                  method: 'POST',
                                  body: {
                                    'csv': fields['csv']!.text,
                                    'confirm': false,
                                  },
                                );
                            setState(() => preview = result);
                          }),
                    child: const T('preview'),
                  ),
                  if (preview != null) ...[
                    SelectableText(
                      const JsonEncoder.withIndent('  ').convert(preview),
                    ),
                    FilledButton(
                      onPressed: busy || (preview!['errors'] as List).isNotEmpty
                          ? null
                          : () => run(() async {
                              await ref
                                  .read(apiProvider)
                                  .request(
                                    '/owner/businesses/$id/financials',
                                    method: 'POST',
                                    body: {
                                      'csv': fields['csv']!.text,
                                      'confirm': true,
                                    },
                                  );
                              setState(() => preview = null);
                              await reload();
                            }),
                      child: const T('saveFinancials'),
                    ),
                  ],
                  const Heading('documents'),
                  const T('uploadNotice'),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            await ref
                                .read(apiProvider)
                                .request(
                                  '/owner/businesses/$id/documents/sample',
                                  method: 'POST',
                                );
                            await reload();
                          }),
                    child: const T('sampleDocument'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            final selected = await FilePicker.pickFiles(
                              type: FileType.custom,
                              allowedExtensions: [
                                'txt',
                                'pdf',
                                'png',
                                'jpg',
                                'jpeg',
                              ],
                            );
                            if (selected.isEmpty) return;
                            final file = selected.single;
                            if ((await file.length() ?? 0) > 5 * 1024 * 1024) {
                              throw Exception(tr(ref, 'fileTooLarge'));
                            }
                            final ext = file.extension?.toLowerCase();
                            final mime = {
                              'txt': 'text/plain',
                              'pdf': 'application/pdf',
                              'png': 'image/png',
                              'jpg': 'image/jpeg',
                              'jpeg': 'image/jpeg',
                            }[ext];
                            if (mime == null) {
                              throw Exception(tr(ref, 'invalidFile'));
                            }
                            await ref
                                .read(apiProvider)
                                .request(
                                  '/owner/businesses/$id/documents',
                                  method: 'POST',
                                  body: {
                                    'name': file.name,
                                    'mimeType': mime,
                                    'contentBase64': base64Encode(
                                      await file.readAsBytes(),
                                    ),
                                    'fictionalAcknowledged': true,
                                  },
                                );
                            await FilePicker.clearTemporaryFiles();
                            await reload();
                            if (mounted) {
                              setState(() => message = tr(ref, 'processing'));
                            }
                          }),
                    icon: const Icon(Icons.upload_file),
                    label: const T('upload'),
                  ),
                  for (final document
                      in business?.data['documents'] as List? ?? [])
                    ListTile(
                      leading: const Icon(Icons.description_outlined),
                      title: Text(document['name'].toString()),
                      subtitle: Text(
                        '${document['status']} · v${document['version']}',
                      ),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            await save();
                            await ref
                                .read(apiProvider)
                                .request(
                                  '/owner/businesses/$id/submit',
                                  method: 'POST',
                                );
                            await reload();
                          }),
                    child: const T('submit'),
                  ),
                  const Heading('timeline'),
                  Fact('status', business?.status ?? 'draft'),
                  for (final event in business?.data['timeline'] as List? ?? [])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Panel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              event['decision'].toString(),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(event['notes'].toString()),
                            Text(nepalDate(event['createdAt'])),
                          ],
                        ),
                      ),
                    ),
                  const Heading('ownerUpdate'),
                  field('updateTitle', 'title'),
                  field('updateBody', 'body', lines: 4),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: guidelines,
                    onChanged: (v) => setState(() => guidelines = v ?? false),
                    title: const T('guidelines'),
                  ),
                  FilledButton(
                    onPressed: busy || !guidelines
                        ? null
                        : () => run(() async {
                            await ref
                                .read(apiProvider)
                                .request(
                                  '/owner/businesses/$id/updates',
                                  method: 'POST',
                                  body: {
                                    'title': fields['updateTitle']!.text,
                                    'body': fields['updateBody']!.text,
                                    'guidelinesAccepted': true,
                                  },
                                );
                            if (mounted) {
                              setState(
                                () => message = tr(ref, 'pendingReview'),
                              );
                            }
                          }),
                    child: const T('send'),
                  ),
                ],
              ],
            ),
    ),
  );
}
