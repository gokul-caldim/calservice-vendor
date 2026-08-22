import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'documents_api.dart';

class DocumentsRepository {
  DocumentsRepository(this._api);

  final DocumentsApi _api;

  Future<Map<String, dynamic>> uploadDocument({
    required String category,
    required String filePath,
    String? title,
    String? documentNumber,
  }) async {
    return _api.uploadDocument(
      category: category,
      filePath: filePath,
      title: title,
      documentNumber: documentNumber,
    );
  }
}

final documentsRepositoryProvider = Provider<DocumentsRepository>((ref) {
  return DocumentsRepository(ref.watch(documentsApiProvider));
});
