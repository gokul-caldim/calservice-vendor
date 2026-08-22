import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme/app_theme.dart';

/// Bottom sheet offering Camera or Gallery, then returns the picked file
/// path (or null if cancelled). This is a mobile-native adaptation of the
/// web app's custom WebRTC camera modal — same backend requirement (one
/// image file per slot), different, more native capture UX.
Future<String?> pickJobPhoto(BuildContext context) async {
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
            title: const Text('Take Photo'),
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

  if (source == null) return null;

  final picker = ImagePicker();
  final file = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 1600);
  return file?.path;
}
