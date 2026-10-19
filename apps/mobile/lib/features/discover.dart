import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/design.dart';
import '../core/models.dart';
import '../core/state.dart';
import '../core/strings.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    final businesses = ref.watch(businessesProvider);
    if (!state.introSeen) return const Introduction();
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(businessesProvider);
        await ref.read(businessesProvider.future);
      },
      child: PageBody(
        children: [
          const Align(alignment: Alignment.centerLeft, child: SimulationPill()),
          const SizedBox(height: 22),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: motionDuration(context, ref, 350),
            builder: (context, value, child) => Opacity(
              opacity: value,
              child: Transform.translate(
                offset: Offset(0, 12 * (1 - value)),
                child: child,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(ref, 'welcome'),
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 12),
                const T('welcomeBody'),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const SizedBox(height: 210, child: StoryArt(seed: 0)),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => context.go('/explore'),
            icon: const Icon(Icons.arrow_forward),
            label: const T('discover'),
          ),
          if (state.signedIn) ...[
            const Heading('virtualBalance'),
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    money(state.user?['availablePaisa']),
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const T('noMoney'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => context.push('/owner'),
              icon: const Icon(Icons.storefront_outlined),
              label: const T('owner'),
            ),
          ],
          Heading(
            'featured',
            action: 'all',
            onTap: () => context.go('/explore'),
          ),
          businesses.when(
            data: (items) => Column(
              children: [
                if (items.isNotEmpty && items.first.data['cached'] == true)
                  const _CachedNotice(),
                for (final (index, business) in items.take(3).indexed)
                  BusinessCard(business, index: index),
              ],
            ),
            error: (e, _) => MessageState(
              error: e,
              retry: () => ref.invalidate(businessesProvider),
            ),
            loading: () => const LoadingCards(),
          ),
          if (state.saved.isNotEmpty) ...[
            const Heading('saved'),
            businesses.maybeWhen(
              data: (items) => Column(
                children: [
                  for (final business in items.where(
                    (b) => state.saved.contains(b.id),
                  ))
                    BusinessCard(business),
                ],
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
          const SizedBox(height: 16),
          Panel(
            color: Theme.of(context).brightness == Brightness.dark
                ? null
                : accents[2],
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.auto_stories_outlined, size: 30),
                const SizedBox(height: 12),
                Text(
                  tr(ref, 'learning'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const T('learningBody'),
                TextButton.icon(
                  onPressed: () => context.push('/learn'),
                  icon: const Icon(Icons.arrow_forward),
                  label: const T('start'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class Introduction extends ConsumerStatefulWidget {
  const Introduction({super.key});
  @override
  ConsumerState<Introduction> createState() => _IntroductionState();
}

class _IntroductionState extends ConsumerState<Introduction> {
  int step = 0;
  @override
  Widget build(BuildContext context) => PageBody(
    children: [
      Align(
        alignment: Alignment.centerRight,
        child: TextButton(
          onPressed: () => ref.read(appProvider.notifier).finishIntro(),
          child: const T('skip'),
        ),
      ),
      const SimulationPill(),
      const SizedBox(height: 24),
      AnimatedSwitcher(
        duration: motionDuration(context, ref, 450),
        child: SizedBox(
          key: ValueKey(step),
          height: 240,
          child: StoryArt(seed: step),
        ),
      ),
      const SizedBox(height: 26),
      Text(
        tr(ref, ['introTitle', 'introResearch', 'introOwn'][step]),
        style: Theme.of(context).textTheme.headlineLarge,
      ),
      const SizedBox(height: 16),
      const T('introBody'),
      const SizedBox(height: 12),
      const T('introDetail'),
      const SizedBox(height: 24),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(
          3,
          (i) => AnimatedContainer(
            duration: motionDuration(context, ref),
            width: i == step ? 24 : 8,
            height: 8,
            margin: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: i == step ? purple : Colors.grey,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
      ),
      const SizedBox(height: 24),
      FilledButton(
        onPressed: () {
          if (step < 2) {
            setState(() => step++);
          } else {
            ref.read(appProvider.notifier).finishIntro();
          }
        },
        child: T(step < 2 ? 'continue' : 'start'),
      ),
    ],
  );
}

class _CachedNotice extends ConsumerWidget {
  const _CachedNotice();
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Panel(
      child: Column(
        children: [
          const T('cached'),
          Text(
            '${tr(ref, 'updated')}: ${nepalDate(ref.read(prefsProvider).getString('publicUpdated'))}',
          ),
        ],
      ),
    ),
  );
}

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});
  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  String query = '', sector = '', location = '', status = '', order = 'newest';
  bool savedOnly = false;
  int visible = 6;
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    return PageBody(
      children: [
        Text(
          tr(ref, 'discover'),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: InputDecoration(
            labelText: tr(ref, 'search'),
            prefixIcon: const Icon(Icons.search),
          ),
          onChanged: (value) => setState(() {
            query = value.toLowerCase();
            visible = 6;
          }),
        ),
        const SizedBox(height: 12),
        ref
            .watch(businessesProvider)
            .when(
              data: (all) {
                final filtered = all
                    .where(
                      (b) =>
                          '${b.name} ${b.location} ${b.story}'
                              .toLowerCase()
                              .contains(query) &&
                          (sector.isEmpty || b.sector == sector) &&
                          (location.isEmpty || b.location == location) &&
                          (status.isEmpty ||
                              (b.round?['status'] ?? b.status) == status) &&
                          (!savedOnly || state.saved.contains(b.id)),
                    )
                    .toList();
                if (order == 'nameOrder') {
                  filtered.sort((a, b) => a.name.compareTo(b.name));
                }
                Widget dropdown(
                  String label,
                  String value,
                  Iterable<String> values,
                  void Function(String) change,
                ) => DropdownButtonFormField<String>(
                  initialValue: value,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: tr(ref, label)),
                  items: [
                    DropdownMenuItem(value: '', child: T('all')),
                    for (final item in values.toSet())
                      DropdownMenuItem(value: item, child: Text(item)),
                  ],
                  onChanged: (v) => setState(() {
                    change(v ?? '');
                    visible = 6;
                  }),
                );
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      children: [
                        FilterChip(
                          label: T('showSaved'),
                          selected: savedOnly,
                          onSelected: (v) => setState(() => savedOnly = v),
                        ),
                        for (final sort in ['newest', 'nameOrder'])
                          ChoiceChip(
                            label: T(sort),
                            selected: order == sort,
                            onSelected: (_) => setState(() => order = sort),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    dropdown(
                      'sector',
                      sector,
                      all.map((b) => b.sector),
                      (v) => sector = v,
                    ),
                    const SizedBox(height: 12),
                    dropdown(
                      'location',
                      location,
                      all.map((b) => b.location),
                      (v) => location = v,
                    ),
                    const SizedBox(height: 12),
                    dropdown(
                      'status',
                      status,
                      all.map(
                        (b) => (b.round?['status'] ?? b.status).toString(),
                      ),
                      (v) => status = v,
                    ),
                    const SizedBox(height: 12),
                    const T('defaultOrder'),
                    if (state.compared.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: FilledButton.icon(
                          onPressed: () => context.push('/compare'),
                          icon: const Icon(Icons.compare_arrows),
                          label: Text(
                            '${tr(ref, 'compare')} (${state.compared.length}/3)',
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),
                    if (all.isNotEmpty && all.first.data['cached'] == true)
                      const _CachedNotice(),
                    if (filtered.isEmpty) const MessageState(empty: true),
                    for (final (i, business) in filtered.take(visible).indexed)
                      BusinessCard(business, index: i),
                    if (filtered.length > visible)
                      OutlinedButton(
                        onPressed: () => setState(() => visible += 6),
                        child: const T('continue'),
                      ),
                  ],
                );
              },
              error: (e, _) => MessageState(
                error: e,
                retry: () => ref.invalidate(businessesProvider),
              ),
              loading: () => const LoadingCards(),
            ),
      ],
    );
  }
}

final businessProvider = FutureProvider.family<Business, String>(
  (ref, id) async =>
      Business(await ref.watch(apiProvider).request('/businesses/$id')),
);

class BusinessDetailScreen extends ConsumerWidget {
  const BusinessDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Brand()),
    body: ref
        .watch(businessProvider(id))
        .when(
          data: (b) => PageBody(
            children: [
              const SimulationPill(),
              const SizedBox(height: 20),
              Hero(
                tag: 'business-$id',
                child: const SizedBox(height: 230, child: StoryArt(seed: 1)),
              ),
              const SizedBox(height: 20),
              Text(b.name, style: Theme.of(context).textTheme.headlineLarge),
              Text('${b.sector} · ${b.location}'),
              const SizedBox(height: 8),
              const T('fictional'),
              const Heading('about'),
              Text(b.story),
              Fact('founder', b.data['founderName']?.toString() ?? '—'),
              const Heading('fundingUse'),
              for (final use in b.data['fundingUse'] as List? ?? [])
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('• $use'),
                ),
              const Heading('terms'),
              if (b.round == null)
                const T('noRound')
              else
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Fact('target', money(b.round!['targetPaisa'])),
                      Fact('committed', money(b.round!['committedPaisa'])),
                      Fact('sharePrice', money(b.round!['sharePricePaisa'])),
                      Fact(
                        'founderShares',
                        b.round!['existingShares'].toString(),
                      ),
                      Fact('termsVersion', b.round!['termsVersion'].toString()),
                      Fact('deadline', nepalDate(b.round!['deadline'])),
                      const T('termsFrozen'),
                    ],
                  ),
                ),
              const Heading('financials'),
              for (final row in b.data['financials'] as List? ?? [])
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        row['period'].toString(),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Fact('revenue', money(row['revenuePaisa'])),
                      Fact('cash', money(row['openingCashPaisa'])),
                      Text(row['source']?.toString() ?? ''),
                    ],
                  ),
                ),
              const Heading('risks'),
              for (final risk in b.risks)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline, size: 20),
                      const SizedBox(width: 8),
                      Expanded(child: Text(risk)),
                    ],
                  ),
                ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () => context.push('/report/$id'),
                icon: const Icon(Icons.analytics_outlined),
                label: const T('report'),
              ),
              const SizedBox(height: 12),
              if (b.round?['status'] == 'open')
                FilledButton(
                  onPressed: () => context.push('/invest/$id'),
                  child: const T('calculate'),
                ),
              const SizedBox(height: 16),
              const T('dilution'),
              const Heading('ownerUpdate'),
              for (final update in b.data['updates'] as List? ?? [])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          update['title'].toString(),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(update['body'].toString()),
                        Text(nepalDate(update['createdAt'])),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          error: (e, _) => MessageState(
            error: e,
            retry: () => ref.invalidate(businessProvider(id)),
          ),
          loading: () =>
              const Padding(padding: EdgeInsets.all(20), child: LoadingCards()),
        ),
  );
}

class CompareScreen extends ConsumerWidget {
  const CompareScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const T('compare')),
    body: ref
        .watch(businessesProvider)
        .when(
          data: (items) => PageBody(
            children: [
              const T('compareLimit'),
              const SizedBox(height: 16),
              for (final b in items.where(
                (b) => ref.watch(appProvider).compared.contains(b.id),
              ))
                Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          b.name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Fact('sector', b.sector),
                        Fact('location', b.location),
                        Fact(
                          'status',
                          b.round?['status']?.toString() ?? b.status,
                        ),
                        Fact('target', money(b.round?['targetPaisa'])),
                        Fact('sharePrice', money(b.round?['sharePricePaisa'])),
                        const Heading('risks'),
                        Text(b.risks.join('\n')),
                        OutlinedButton(
                          onPressed: () => context.push('/business/${b.id}'),
                          child: const T('view'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          error: (e, _) => MessageState(error: e),
          loading: () => const LoadingCards(),
        ),
  );
}

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  String scenario = 'base';
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const T('report')),
    body: ref
        .watch(businessProvider(widget.id))
        .when(
          data: (b) {
            final report = b.report;
            if (report == null) return const Center(child: T('noReport'));
            final scenarios = report['scenarios'];
            final chosen = scenarios is Map
                ? scenarios[scenario]
                : scenarios is List
                ? scenarios
                      .where(
                        (e) =>
                            e['name'] == scenario || e['scenario'] == scenario,
                      )
                      .firstOrNull
                : null;
            final rows = chosen is Map
                ? (chosen['months'] ?? chosen['rows'] ?? []) as List
                : chosen is List
                ? chosen
                : <dynamic>[];
            return PageBody(
              children: [
                const SimulationPill(),
                const SizedBox(height: 14),
                const T('reportLabel'),
                Text(b.name, style: Theme.of(context).textTheme.headlineMedium),
                Text(report['executiveSummary']?.toString() ?? ''),
                Fact('version', report['version']?.toString() ?? ''),
                Fact('updated', nepalDate(report['approvedAt'])),
                const Heading('evidence'),
                for (final evidence in report['evidence'] as List? ?? [])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Panel(child: SelectableText(_readable(evidence))),
                  ),
                const Heading('assumptions'),
                SelectableText(_readable(report['assumptions'])),
                const Heading('scenarios'),
                const T('projectionNote'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final s in ['downside', 'base', 'upside'])
                      ChoiceChip(
                        label: T(s),
                        selected: scenario == s,
                        onSelected: (_) => setState(() => scenario = s),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                AnimatedSwitcher(
                  duration: motionDuration(context, ref, 300),
                  child: SizedBox(
                    key: ValueKey(scenario),
                    height: 180,
                    width: double.infinity,
                    child: Semantics(
                      label:
                          '${tr(ref, 'revenue')}. ${tr(ref, 'projectionNote')}',
                      child: CustomPaint(painter: ProjectionPainter(rows)),
                    ),
                  ),
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: [
                      DataColumn(label: T('month')),
                      DataColumn(label: T('revenue')),
                      DataColumn(label: T('profit')),
                      DataColumn(label: T('cash')),
                    ],
                    rows: [
                      for (final row in rows)
                        DataRow(
                          cells: [
                            DataCell(
                              Text((row['month'] ?? row['period']).toString()),
                            ),
                            DataCell(Text(money(row['revenuePaisa']))),
                            DataCell(Text(money(row['profitPaisa']))),
                            DataCell(Text(money(row['closingCashPaisa']))),
                          ],
                        ),
                    ],
                  ),
                ),
                const Heading('missing'),
                Text(_readable(report['missingData'])),
                const Heading('risks'),
                Text(_readable(report['materialRisks'])),
                const Heading('terms'),
                Text(_readable(report['formulas'])),
              ],
            );
          },
          error: (e, _) => MessageState(
            error: e,
            retry: () => ref.invalidate(businessProvider(widget.id)),
          ),
          loading: () => const LoadingCards(),
        ),
  );
}

String _readable(dynamic value) {
  if (value == null) return '—';
  if (value is Map) {
    return value.entries
        .map((e) => '${e.key}: ${_readable(e.value)}')
        .join('\n');
  }
  if (value is List) return value.map(_readable).join('\n\n');
  return value.toString();
}

class ProjectionPainter extends CustomPainter {
  ProjectionPainter(this.rows);
  final List rows;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.withValues(alpha: .25)
      ..strokeWidth = 1;
    for (int i = 0; i < 5; i++) {
      final y = i * (size.height - 12) / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    if (rows.length < 2) return;
    final values = rows
        .map((r) => double.tryParse(r['revenuePaisa'].toString()) ?? 0)
        .toList();
    final max = values.fold<double>(1, (a, b) => a > b ? a : b);
    final path = Path();
    for (int i = 0; i < values.length; i++) {
      final x = i * size.width / (values.length - 1),
          y = size.height - 12 - values[i] / max * (size.height - 24);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    paint
      ..color = purple
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant ProjectionPainter oldDelegate) =>
      oldDelegate.rows != rows;
}
