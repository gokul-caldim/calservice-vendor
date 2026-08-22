import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../profile/presentation/profile_providers.dart';
import '../data/documents_repository.dart';

class DocumentsController extends StateNotifier<AsyncValue<void>> {
  DocumentsController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  Future<bool> uploadDocument({
    required String category,
    required String filePath,
    String? title,
    String? documentNumber,
  }) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(documentsRepositoryProvider).uploadDocument(
            category: category,
            filePath: filePath,
            title: title,
            documentNumber: documentNumber,
          );
      _ref.invalidate(employeeProfileProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final documentsControllerProvider =
    StateNotifierProvider<DocumentsController, AsyncValue<void>>((ref) {
  return DocumentsController(ref);
});
