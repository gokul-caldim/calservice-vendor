import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/loading_button.dart';
import '../../data/job_actions_repository.dart';
import '../../domain/job.dart';
import '../jobs_providers.dart';

/// Modal bottom sheet for recording Cash on Service collection.
class CashCollectionSheet extends ConsumerStatefulWidget {
  const CashCollectionSheet({super.key, required this.job, this.initialAmount});

  final Job job;
  final double? initialAmount;

  static Future<bool?> show(BuildContext context, Job job, {double? initialAmount}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
      ),
      builder: (context) => CashCollectionSheet(job: job, initialAmount: initialAmount),
    );
  }

  @override
  ConsumerState<CashCollectionSheet> createState() => _CashCollectionSheetState();
}

class _CashCollectionSheetState extends ConsumerState<CashCollectionSheet> {
  late final TextEditingController _amountController;
  bool _isRecording = false;
  String? _error;

  double get _amountDue => widget.job.totalAmount ?? 0.0;
  double get _amountReceived => double.tryParse(_amountController.text.trim()) ?? 0.0;
  double get _changeToReturn => _amountReceived > _amountDue ? _amountReceived - _amountDue : 0.0;

  @override
  void initState() {
    super.initState();
    final defaultAmount = widget.initialAmount ?? widget.job.totalAmount ?? 0.0;
    _amountController = TextEditingController(
      text: defaultAmount > 0 ? defaultAmount.toStringAsFixed(2) : '',
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_amountReceived < _amountDue) {
      setState(() {
        _error = 'Amount received (₹${_amountReceived.toStringAsFixed(2)}) cannot be less than amount due (₹${_amountDue.toStringAsFixed(2)}).';
      });
      return;
    }

    setState(() {
      _isRecording = true;
      _error = null;
    });

    try {
      final message = await ref
          .read(jobActionsRepositoryProvider)
          .collectCash(widget.job.id, _amountReceived);

      ref.invalidate(activeJobsProvider);
      ref.invalidate(completedJobsProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: const Color(0xFFD97706),
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) setState(() => _error = describeDioError(e, fallback: 'Cash collection failed.'));
    } catch (_) {
      if (mounted) setState(() => _error = 'Cash collection failed.');
    } finally {
      if (mounted) setState(() => _isRecording = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          Row(
            children: [
              const Icon(Icons.payments_outlined, size: 22, color: Color(0xFFD97706)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Collect Cash — ${widget.job.requestId}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.of(context).pop(false),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Service & Due Amount Box
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Service:', style: TextStyle(fontSize: 12, color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
                    Flexible(
                      child: Text(
                        widget.job.displayTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF78350F)),
                      ),
                    ),
                  ],
                ),
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: AppSpacing.sm,
                  runSpacing: 2,
                  children: [
                    const Text('Amount Due:', style: TextStyle(fontSize: 12, color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
                    Text(
                      '₹${_amountDue.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF78350F),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 8),
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(color: const Color(0xFFFECDD3)),
              ),
              child: Text(
                _error!,
                style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
              ),
            ),
          ],

          // Amount Received Input
          const Text(
            'Cash Amount Received from Customer (₹)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              prefixText: '₹ ',
              prefixStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),

          if (_changeToReturn > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(AppRadius.chip),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Change to Return Customer:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF065F46)),
                  ),
                  Text(
                    '₹${_changeToReturn.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'monospace',
                      color: Color(0xFF065F46),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Submitting will generate a secure 6-digit confirmation code for the customer and notify them to confirm payment receipt.',
            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.35),
          ),

          const SizedBox(height: AppSpacing.lg),

          LoadingButton(
            label: 'CONFIRM CASH RECEIVED',
            icon: Icons.payments_rounded,
            isLoading: _isRecording,
            onPressed: _amountReceived >= _amountDue ? _submit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
              textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, letterSpacing: 0.5),
            ),
          ),
        ],
      ),
      ),
    );
  }
}
