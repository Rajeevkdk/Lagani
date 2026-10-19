import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/design.dart';
import '../core/models.dart';
import '../core/state.dart';
import '../core/strings.dart';
import 'discover.dart';

class InvestScreen extends ConsumerStatefulWidget {
  const InvestScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<InvestScreen> createState() => _InvestScreenState();
}

class _InvestScreenState extends ConsumerState<InvestScreen> {
  final amount = TextEditingController(text: '100000');
  Quote? quote;
  Json? receipt;
  bool risk = false, simulation = false, busy = false, uncertain = false;
  String? error;
  String key = '';
  @override
  void dispose() {
    amount.dispose();
    super.dispose();
  }

  Future<void> getQuote(String roundId) async {
    setState(() {
      busy = true;
      error = null;
      quote = null;
      risk = false;
      simulation = false;
    });
    try {
      final result = await ref
          .read(apiProvider)
          .request(
            '/rounds/$roundId/quote',
            method: 'POST',
            body: {'amountPaisa': rupeesToPaisa(amount.text)},
          );
      if (mounted) {
        setState(() {
          quote = Quote(result);
          key =
              'mobile-${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> commit() async {
    if (busy || quote == null || !risk || !simulation) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await ref
          .read(apiProvider)
          .request(
            '/commitments',
            method: 'POST',
            body: {
              'quoteId': quote!.id,
              'riskAcknowledged': true,
              'idempotencyKey': key,
            },
          );
      ref.invalidate(portfolioProvider);
      ref.invalidate(activityProvider);
      ref.invalidate(inboxProvider);
      ref.invalidate(businessProvider(widget.id));
      ref.invalidate(businessesProvider);
      await ref.read(appProvider.notifier).refreshUser();
      if (mounted) {
        setState(() {
          receipt = result;
          uncertain = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          uncertain = e is ApiException && e.uncertain;
        });
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const T('calculate')),
    body: SignInGate(
      child: ref
          .watch(businessProvider(widget.id))
          .when(
            data: (business) {
              if (receipt != null) {
                return PageBody(
                  children: [
                    const SimulationPill(),
                    const SizedBox(height: 25),
                    Icon(
                      Icons.check_circle_outline,
                      size: 72,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      tr(ref, 'confirmed'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const T('receipt'),
                    const SizedBox(height: 20),
                    Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            business.name,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Fact('amount', money(receipt!['amountPaisa'])),
                          Fact('shares', receipt!['shares'].toString()),
                          Fact('status', receipt!['status'].toString()),
                          Fact(
                            'termsVersion',
                            receipt!['termsVersion'].toString(),
                          ),
                          SelectableText(receipt!['id'].toString()),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    const T('pending'),
                    const T('noMoney'),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: () => context.go('/portfolio'),
                      child: const T('portfolio'),
                    ),
                  ],
                );
              }
              final round = business.round;
              if (round == null) return const Center(child: T('noRound'));
              return PageBody(
                children: [
                  const SimulationPill(),
                  const SizedBox(height: 20),
                  Text(
                    business.name,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  const T('quoteInfo'),
                  const SizedBox(height: 20),
                  TextField(
                    controller: amount,
                    enabled: !busy && !uncertain,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: InputDecoration(labelText: tr(ref, 'amount')),
                    onChanged: (_) => setState(() {
                      quote = null;
                      risk = false;
                      simulation = false;
                    }),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: busy || uncertain
                        ? null
                        : () => getQuote(round['id'].toString()),
                    child: busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const T('getQuote'),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(
                        error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  if (uncertain) ...[
                    const SizedBox(height: 12),
                    const T('uncertain'),
                    TextButton(
                      onPressed: () => context.go('/activity'),
                      child: const T('checkActivity'),
                    ),
                  ],
                  if (quote != null) ...[
                    const Heading('quote'),
                    Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Fact('amount', quote!.amount),
                          Fact('shares', quote!.shares),
                          Fact('ownership', quote!.ownership),
                          Fact('fees', money(quote!.data['feesPaisa'])),
                          Fact(
                            'virtualBalance',
                            money(quote!.data['availablePaisa']),
                          ),
                          Fact('termsVersion', quote!.terms),
                          Fact('expires', nepalDate(quote!.data['expiresAt'])),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const T('simulatedOwnership'),
                    const T('dilution'),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const T('riskAck'),
                      value: risk,
                      onChanged: busy
                          ? null
                          : (v) => setState(() => risk = v ?? false),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const T('simulationAck'),
                      value: simulation,
                      onChanged: busy
                          ? null
                          : (v) => setState(() => simulation = v ?? false),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    FilledButton(
                      onPressed: risk && simulation && !busy ? commit : null,
                      child: T(uncertain ? 'retry' : 'confirm'),
                    ),
                  ],
                  const SizedBox(height: 20),
                  const T('noMoney'),
                ],
              );
            },
            error: (e, _) => MessageState(
              error: e,
              retry: () => ref.invalidate(businessProvider(widget.id)),
            ),
            loading: () => const LoadingCards(),
          ),
    ),
  );
}

class PortfolioScreen extends ConsumerWidget {
  const PortfolioScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => SignInGate(
    child: ref
        .watch(portfolioProvider)
        .when(
          data: (data) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(portfolioProvider);
              await ref.read(portfolioProvider.future);
            },
            child: PageBody(
              children: [
                const SimulationPill(),
                const SizedBox(height: 22),
                Text(
                  tr(ref, 'portfolio'),
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 16),
                Panel(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? null
                      : accents[1],
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Fact('available', money(data['availablePaisa'])),
                      Fact('committed', money(data['committedPaisa'])),
                      Fact('invested', money(data['investedPaisa'])),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const T('atCost'),
                const Heading('holdings'),
                if ((data['holdings'] as List).isEmpty)
                  const MessageState(empty: true),
                for (final holding in data['holdings'] as List)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            holding['businessName'].toString(),
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const T('simulatedOwnership'),
                          Fact('shares', holding['shares'].toString()),
                          Fact('ownership', '${holding['ownershipPercent']}%'),
                          Fact('invested', money(holding['costPaisa'])),
                          TextButton(
                            onPressed: () => _receipt(
                              context,
                              ref,
                              holding['commitmentId'].toString(),
                            ),
                            child: const T('receipt'),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          error: (e, _) => MessageState(
            error: e,
            retry: () => ref.invalidate(portfolioProvider),
          ),
          loading: () => const LoadingCards(),
        ),
  );
}

Future<void> _receipt(BuildContext context, WidgetRef ref, String id) async {
  try {
    final receipt = await ref
        .read(apiProvider)
        .request('/commitments/$id/receipt');
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SimulationPill(),
            const SizedBox(height: 16),
            const T('receipt'),
            const SizedBox(height: 16),
            for (final entry in receipt.entries)
              if (entry.value is! Map)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: SelectableText('${entry.key}: ${entry.value}'),
                ),
            const SizedBox(height: 16),
            const T('noMoney'),
          ],
        ),
      ),
    );
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});
  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  String query = '';
  final Set<String> pendingCancels = {};
  @override
  Widget build(BuildContext context) => SignInGate(
    child: PageBody(
      children: [
        Text(
          tr(ref, 'activity'),
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: InputDecoration(
            labelText: tr(ref, 'transactionSearch'),
            prefixIcon: const Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => query = v.toLowerCase()),
        ),
        const Heading('commitments'),
        ref
            .watch(portfolioProvider)
            .when(
              data: (p) => Column(
                children: [
                  for (final c in p['commitments'] as List)
                    if (c.toString().toLowerCase().contains(query))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Panel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                (c['businessName'] ?? c['id']).toString(),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Fact('amount', money(c['amountPaisa'])),
                              Fact('status', c['status'].toString()),
                              Fact('shares', c['shares'].toString()),
                              TextButton(
                                onPressed: () =>
                                    _receipt(context, ref, c['id'].toString()),
                                child: const T('receipt'),
                              ),
                              if (c['status'] == 'pending' ||
                                  c['status'] == 'committed')
                                OutlinedButton(
                                  onPressed: pendingCancels.contains(c['id'])
                                      ? null
                                      : () async {
                                          setState(
                                            () => pendingCancels.add(c['id']),
                                          );
                                          try {
                                            await ref
                                                .read(apiProvider)
                                                .request(
                                                  '/commitments/${c['id']}/cancel',
                                                  method: 'POST',
                                                );
                                            ref.invalidate(portfolioProvider);
                                            ref.invalidate(activityProvider);
                                            ref.invalidate(inboxProvider);
                                            await ref
                                                .read(appProvider.notifier)
                                                .refreshUser();
                                          } catch (e) {
                                            if (context.mounted) {
                                              showError(context, e);
                                            }
                                          } finally {
                                            if (mounted) {
                                              setState(
                                                () => pendingCancels.remove(
                                                  c['id'],
                                                ),
                                              );
                                            }
                                          }
                                        },
                                  child: const T('cancel'),
                                ),
                            ],
                          ),
                        ),
                      ),
                ],
              ),
              error: (e, _) => MessageState(
                error: e,
                retry: () => ref.invalidate(portfolioProvider),
              ),
              loading: () => const LoadingCards(),
            ),
        const Heading('activity'),
        ref
            .watch(activityProvider)
            .when(
              data: (data) {
                final items = (data['items'] as List)
                    .where((e) => e.toString().toLowerCase().contains(query))
                    .toList();
                return items.isEmpty
                    ? const MessageState(empty: true)
                    : Column(
                        children: [
                          for (final item in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Panel(
                                child: Row(
                                  children: [
                                    const Icon(Icons.swap_horiz),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item['title']?.toString() ??
                                                item['type'].toString(),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          Text(money(item['amountPaisa'])),
                                          Text(
                                            nepalDate(item['createdAt']),
                                            style: const TextStyle(
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      );
              },
              error: (e, _) => MessageState(
                error: e,
                retry: () => ref.invalidate(activityProvider),
              ),
              loading: () => const LoadingCards(),
            ),
      ],
    ),
  );
}

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const T('inbox')),
    body: SignInGate(
      child: ref
          .watch(inboxProvider)
          .when(
            data: (data) => PageBody(
              children: [
                const T('pushStatus'),
                const SizedBox(height: 18),
                if ((data['items'] as List).isEmpty)
                  const MessageState(empty: true),
                for (final item in data['items'] as List)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Icon(
                                item['readAt'] == null
                                    ? Icons.mark_email_unread_outlined
                                    : Icons.drafts_outlined,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  item['title'].toString(),
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(item['body'].toString()),
                          Text(nepalDate(item['createdAt'])),
                          if (item['readAt'] == null)
                            TextButton(
                              onPressed: () async {
                                try {
                                  await ref
                                      .read(apiProvider)
                                      .request(
                                        '/notifications/${item['id']}/read',
                                        method: 'POST',
                                      );
                                  ref.invalidate(inboxProvider);
                                } catch (e) {
                                  if (context.mounted) showError(context, e);
                                }
                              },
                              child: const T('markRead'),
                            ),
                          if (item['link'] is String &&
                              ((item['link'] as String).startsWith(
                                    '/business/',
                                  ) ||
                                  (item['link'] as String).startsWith(
                                    '/portfolio',
                                  ) ||
                                  (item['link'] as String).startsWith(
                                    '/owner',
                                  )))
                            OutlinedButton(
                              onPressed: () => context.push(item['link']),
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
              retry: () => ref.invalidate(inboxProvider),
            ),
            loading: () => const LoadingCards(),
          ),
    ),
  );
}
