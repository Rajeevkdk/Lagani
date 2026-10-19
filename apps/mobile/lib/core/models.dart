typedef Json = Map<String, dynamic>;

/// Exact decimal conversion only. All allocations and projections come from API.
String rupeesToPaisa(String input) {
  if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(input.trim())) {
    throw const FormatException(
      'Enter a positive amount with up to two decimals.',
    );
  }
  final parts = input.trim().split('.');
  final value =
      BigInt.parse(parts[0]) * BigInt.from(100) +
      BigInt.parse(parts.length == 1 ? '0' : parts[1].padRight(2, '0'));
  if (value <= BigInt.zero) {
    throw const FormatException('Amount must be positive.');
  }
  return value.toString();
}

String money(Object? value) {
  final paisa = BigInt.tryParse(value?.toString() ?? '0') ?? BigInt.zero;
  final absolute = paisa.abs();
  final rupees = (absolute ~/ BigInt.from(100)).toString();
  final formatted = rupees.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (match) => '${match[1]},',
  );
  final decimal = (absolute % BigInt.from(100)).toString().padLeft(2, '0');
  return 'NPR ${paisa.isNegative ? '-' : ''}$formatted.$decimal';
}

String nepalDate(Object? raw) {
  final date = DateTime.tryParse(raw?.toString() ?? '')?.toUtc();
  if (date == null) return '—';
  final local = date.add(const Duration(hours: 5, minutes: 45));
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')} NPT';
}

class Business {
  Business(this.data);
  final Json data;
  String get id => data['id'].toString();
  String get name => data['name']?.toString() ?? '';
  String get tagline => data['tagline']?.toString() ?? '';
  String get sector => data['sector']?.toString() ?? '';
  String get location => data['location']?.toString() ?? '';
  String get story => data['story']?.toString() ?? '';
  String get status => data['status']?.toString() ?? '';
  Json? get round => data['round'] is Map ? Json.from(data['round']) : null;
  Json? get report => data['report'] is Map ? Json.from(data['report']) : null;
  List<String> get risks =>
      (data['risks'] as List? ?? []).map((e) => e.toString()).toList();
}

class Quote {
  Quote(this.data);
  final Json data;
  String get id => data['id'].toString();
  String get shares => data['shares'].toString();
  String get amount => money(data['amountPaisa']);
  String get ownership => '${data['ownershipPercent']}%';
  String get terms => data['termsVersion'].toString();
}
