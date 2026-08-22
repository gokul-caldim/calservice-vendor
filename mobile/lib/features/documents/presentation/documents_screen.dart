import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/async_value_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/status_chip.dart';
import '../../profile/domain/employee_profile.dart';
import '../../profile/presentation/profile_providers.dart';
import 'documents_providers.dart';

/// Complete Documents module mirroring EmployeeDashboardPage.jsx documents tab
/// with native mobile file capture, status tracking, preview dialogs, and overview metrics.
class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(employeeProfileProvider);
    final actionState = ref.watch(documentsControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Documents'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh documents',
            onPressed: () => ref.refresh(employeeProfileProvider.future),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(employeeProfileProvider.future),
        child: AsyncValueView<EmployeeProfile>(
          value: profileAsync,
          onRetry: () => ref.invalidate(employeeProfileProvider),
          builder: (context, profile) {
            final documents = profile.documents;

            final totalCount = documents.length;
            final approvedCount = documents.where((d) => d.isApproved).length;
            final pendingCount = documents.where((d) => d.isPending).length;
            final rejectedCount = documents.where((d) => d.isRejected).length;

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                _DocumentsSummaryStrip(
                  total: totalCount,
                  approved: approvedCount,
                  pending: pendingCount,
                  rejected: rejectedCount,
                ),
                const SizedBox(height: AppSpacing.lg),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          border: Border(bottom: BorderSide(color: AppColors.border)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.shield_outlined, size: 16, color: AppColors.primary),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Text(
                                          'VERIFIED IDENTIFICATION & DOSSIER',
                                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                                color: AppColors.textPrimary,
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Mandatory KYC dossier and government identity credentials on file.',
                                    style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Text(
                                'ID: ${profile.employeeId ?? 'Pending'}',
                                style: const TextStyle(fontSize: 10.5, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (documents.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(AppSpacing.xl),
                          child: EmptyState(
                            icon: Icons.folder_open_outlined,
                            title: 'No onboarding dossier documents on file.',
                            message: 'Uploaded identity proofs and compliance certificates will appear here.',
                            compact: true,
                          ),
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: documents.length,
                          separatorBuilder: (context, index) => Divider(height: 1, color: AppColors.border),
                          itemBuilder: (context, index) => _DocumentItemTile(
                            document: documents[index],
                            isUploading: actionState.isLoading,
                            onUpload: () => _handleDocUpload(context, ref, documents[index]),
                            onPreview: () => _handleDocPreview(context, documents[index]),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _handleDocUpload(BuildContext context, WidgetRef ref, EmployeeDocument doc) async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text('Take Photo of ${doc.title}'),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from Gallery'),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );

    if (source == null) return;

    final image = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 1600);
    if (image == null) return;

    final success = await ref.read(documentsControllerProvider.notifier).uploadDocument(
          category: doc.category,
          filePath: image.path,
          title: doc.title,
          documentNumber: doc.documentNumber,
        );

    if (!context.mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${doc.title} uploaded successfully.'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to upload ${doc.title}.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  void _handleDocPreview(BuildContext context, EmployeeDocument doc) {
    if (!doc.hasFile) return;

    final url = doc.fileUrl!;
    final isImage = url.toLowerCase().contains(RegExp(r'\.(jpeg|jpg|png|gif|webp)')) ||
        url.startsWith('data:image');

    if (isImage) {
      showDialog(
        context: context,
        builder: (context) => Dialog(
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppBar(
                title: Text(doc.title, style: const TextStyle(fontSize: 14)),
                automaticallyImplyLeading: false,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              InteractiveViewer(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) return child;
                    return const SizedBox(
                      height: 250,
                      child: Center(child: CircularProgressIndicator()),
                    );
                  },
                  errorBuilder: (context, error, stack) => const SizedBox(
                    height: 200,
                    child: Center(child: Text('Failed to load image preview')),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.open_in_browser, size: 16),
                      label: const Text('Open External'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    }
  }
}

// ── Summary Strip ─────────────────────────────────────────────────────────────

class _DocumentsSummaryStrip extends StatelessWidget {
  const _DocumentsSummaryStrip({
    required this.total,
    required this.approved,
    required this.pending,
    required this.rejected,
  });

  final int total;
  final int approved;
  final int pending;
  final int rejected;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 520 ? 4 : (constraints.maxWidth < 280 ? 1 : 2);
        final cardWidth = ((constraints.maxWidth - (AppSpacing.sm * (crossAxisCount - 1))) / crossAxisCount).floorToDouble();

        final items = [
          (
            'Total Dossier',
            '$total',
            Icons.folder_outlined,
            AppColors.primary,
          ),
          (
            'Verified',
            '$approved',
            Icons.verified_outlined,
            const Color(0xFF10B981),
          ),
          (
            'Pending Review',
            '$pending',
            Icons.hourglass_top_rounded,
            const Color(0xFFF59E0B),
          ),
          (
            'Action Needed',
            '$rejected',
            Icons.warning_amber_rounded,
            const Color(0xFFEF4444),
          ),
        ];

        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final item in items)
              SizedBox(
                width: cardWidth,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                item.$1.toUpperCase(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(item.$3, size: 14, color: item.$4),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.$2,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ── Document Item Tile ────────────────────────────────────────────────────────

class _DocumentItemTile extends StatelessWidget {
  const _DocumentItemTile({
    required this.document,
    required this.isUploading,
    required this.onUpload,
    required this.onPreview,
  });

  final EmployeeDocument document;
  final bool isUploading;
  final VoidCallback onUpload;
  final VoidCallback onPreview;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.description_outlined, size: 20, color: AppColors.primary),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              document.title,
                              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          StatusChip(status: document.status, dense: true),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        document.category.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (document.documentNumber != null && document.documentNumber!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Text('Doc No: ', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  Flexible(
                    child: Text(
                      document.documentNumber!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ],
            if (document.expiryDate != null && document.expiryDate!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Row(
                children: [
                  Text('Expiry: ', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  Flexible(
                    child: Text(
                      document.expiryDate!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                    ),
                  ),
                ],
              ),
            ],
            if (document.status.toLowerCase() == 'rejected' &&
                document.rejectionReason != null &&
                document.rejectionReason!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline, size: 14, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Rejection Reason: ${document.rejectionReason}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF991B1B)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              if (document.hasFile)
                OutlinedButton.icon(
                  onPressed: onPreview,
                  icon: const Icon(Icons.visibility_outlined, size: 14),
                  label: const Text('Preview / View', style: TextStyle(fontSize: 11.5)),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    visualDensity: VisualDensity.compact,
                  ),
                )
              else
                Text(
                  'No file attached',
                  style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                ),
              ElevatedButton.icon(
                onPressed: isUploading ? null : onUpload,
                icon: const Icon(Icons.upload_file_rounded, size: 14),
                label: Text(document.hasFile ? 'Replace' : 'Upload', style: const TextStyle(fontSize: 11.5)),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(0, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ],
      ),
      ),
    );
  }
}
