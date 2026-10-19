import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.uncertain = false});
  final String message;
  final int? status;
  final bool uncertain;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
    : client = client ?? http.Client(),
      baseUrl =
          baseUrl ??
          const String.fromEnvironment(
            'API_URL',
            defaultValue: 'http://10.0.2.2:4000/api',
          );
  final http.Client client;
  final String baseUrl;
  String? token;

  Future<Json> request(String path, {String method = 'GET', Json? body}) async {
    final url = Uri.parse('$baseUrl$path');
    if (kReleaseMode && url.scheme != 'https') {
      throw ApiException('Release builds require a configured HTTPS API_URL.');
    }
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
    try {
      final request = http.Request(method, url)..headers.addAll(headers);
      if (body != null) request.body = jsonEncode(body);
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 20));
      final response = await http.Response.fromStream(
        streamed,
      ).timeout(const Duration(seconds: 20));
      final value = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
      if (response.statusCode >= 400) {
        final message = value is Map
            ? value['message'] ??
                  (value['error'] is Map
                      ? value['error']['message']
                      : value['error']) ??
                  'Request failed'
            : 'Request failed';
        throw ApiException(message.toString(), status: response.statusCode);
      }
      return value is Map ? Json.from(value) : {'items': value};
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw ApiException(
        'Connection timed out. Check activity before retrying a commitment.',
        uncertain: method != 'GET',
      );
    } catch (_) {
      throw ApiException(
        'Unable to reach the server. Check your connection and retry.',
        uncertain: method != 'GET',
      );
    }
  }
}
