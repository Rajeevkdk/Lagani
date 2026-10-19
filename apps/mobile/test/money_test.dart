import 'package:flutter_test/flutter_test.dart';
import 'package:lagani/core/models.dart';

void main() {
  test('decimal parsing retains paisa precision without floating point', () {
    expect(rupeesToPaisa('100000'), '10000000');
    expect(rupeesToPaisa('100000.01'), '10000001');
    expect(rupeesToPaisa('0.10'), '10');
    expect(rupeesToPaisa('9007199254740993.99'), '900719925474099399');
  });
  test(
    'rejects fractional paisa, negatives, zero, exponent, malformed input',
    () {
      for (final input in ['10.001', '-2', '0', '1e5', 'NaN', '1,000', '']) {
        expect(
          () => rupeesToPaisa(input),
          throwsFormatException,
          reason: input,
        );
      }
    },
  );
  test('NPR formatting is exact including debit and very large amount', () {
    expect(money('10000001'), 'NPR 100,000.01');
    expect(money('-1001'), 'NPR -10.01');
    expect(money('900719925474099399'), 'NPR 9,007,199,254,740,993.99');
  });
  test('Nepal date uses 45-minute offset and correct day rollover', () {
    expect(nepalDate('2026-10-18T23:30:00Z'), '2026-10-19 05:15 NPT');
  });
}
