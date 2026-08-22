import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class DocumentsApi {
  DocumentsApi(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> uploadDocument({
    required String category,
    required String filePath,
    String? title,
    String? documentNumber,
  }) async {
    final fileName = filePath.split(RegExp(r'[/\\]')).last;
    final map = <String, dynamic>{
      'category': category,
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    };
    if (title != null && title.isNotEmpty) {
      map['title'] = title;
    }
    if (documentNumber != null && documentNumber.isNotEmpty) {
      map['document_number'] = documentNumber;
    }

    final formData = FormData.fromMap(map);
    final response = await _dio.post(
      '/workforce/onboarding/documents/',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return response.data as Map<String, dynamic>;
  }
}

final documentsApiProvider = Provider<DocumentsApi>((ref) {
  return DocumentsApi(ref.watch(apiClientProvider));
});
