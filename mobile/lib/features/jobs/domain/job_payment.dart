import '../../../core/utils/json_parsing.dart';

/// Mirrors the `payment` object from GET /workforce/jobs/{id}/payment/
/// (backend WorkforceJobPaymentDetailView / JobPayment model). Cash-on-
/// service only — the ONLINE payment method is customer-facing, not
/// technician-facing, so this app only ever surfaces CASH_ON_SERVICE state.
class JobPaymentInfo {
  const JobPaymentInfo({
    required this.paymentMethod,
    required this.paymentStatus,
    this.amountDue,
    this.amountPaid,
    this.amountReceived,
    this.changeReturned,
    this.currency,
  });

  factory JobPaymentInfo.fromJson(Map<String, dynamic> json) {
    return JobPaymentInfo(
      paymentMethod: parseString(json['payment_method']) ?? 'CASH_ON_SERVICE',
      paymentStatus: parseString(json['payment_status']) ?? 'PENDING',
      amountDue: parseDouble(json['amount_due']),
      amountPaid: parseDouble(json['amount_paid']),
      amountReceived: parseDouble(json['amount_received']),
      changeReturned: parseDouble(json['change_returned']),
      currency: parseString(json['currency']),
    );
  }

  final String paymentMethod; // ONLINE | CASH_ON_SERVICE
  final String paymentStatus; // PENDING | AUTHORIZED | PAID | CASH_PENDING | FAILED | REFUNDED | CANCELLED
  final double? amountDue;
  final double? amountPaid;
  final double? amountReceived;
  final double? changeReturned;
  final String? currency;

  bool get isOnline => paymentMethod == 'ONLINE';
  bool get isPaid => paymentStatus == 'PAID';
  bool get isCashPending => paymentStatus == 'CASH_PENDING';
}
