import 'package:flutter/material.dart';
import '../theme/hope_v2_design.dart';
import '../transactions/payment.dart';
import 'premium_components.dart';

class PremiumPaymentSummary extends StatelessWidget {
  const PremiumPaymentSummary({super.key, required this.payment});

  final HopePayment payment;

  String _statusLabel() {
    switch (payment.status) {
      case 'HELD':
        return 'در امانت';
      case 'HOLD_PENDING':
        return 'در انتظار تأیید';
      case 'RELEASE_PENDING':
        return 'در انتظار تسویه';
      case 'RELEASED':
        return 'تسویه شده';
      case 'REFUNDED':
        return 'بازپرداخت شده';
      case 'HOLD_FAILED':
        return 'خطا در پرداخت';
      case 'RELEASE_FAILED':
        return 'خطا در تسویه';
      case 'NO_TRANSACTION':
        return 'هنوز پرداختی ثبت نشده';
      default:
        return payment.status;
    }
  }

  IconData _statusIcon() {
    switch (payment.status) {
      case 'RELEASED':
        return Icons.check_circle_rounded;
      case 'REFUNDED':
        return Icons.undo_rounded;
      case 'HOLD_FAILED':
      case 'RELEASE_FAILED':
        return Icons.error_outline_rounded;
      case 'HELD':
        return Icons.lock_clock_rounded;
      default:
        return Icons.payments_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = payment.amount;
    final fees = payment.fees;
    final status = _statusLabel();
    return Semantics(
      container: true,
      label: 'وضعیت پرداخت: $status',
      child: PremiumPanel(
        padding: const EdgeInsets.all(HopeV2Spacing.lg),
        semanticLabel: 'جزئیات پرداخت، $status',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_statusIcon(), size: 22),
                const SizedBox(width: HopeV2Spacing.sm),
                Expanded(
                  child: Text(status,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                ),
                if (amount != null)
                  Text('${amount.toString()} ${fees?.currency ?? ''}'.trim(),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
              ],
            ),
            if (fees != null) ...[
              const SizedBox(height: HopeV2Spacing.md),
              Wrap(
                spacing: HopeV2Spacing.md,
                runSpacing: HopeV2Spacing.sm,
                children: [
                  if (fees.employerCharge != null)
                    _Metric(label: 'مبلغ نهایی', value: '${fees.employerCharge} ${fees.currency}'),
                  if (fees.providerPayout != null)
                    _Metric(label: 'دریافتی مجری', value: '${fees.providerPayout} ${fees.currency}'),
                  if (fees.platformFee != null)
                    _Metric(label: 'کارمزد پلتفرم', value: '${fees.platformFee} ${fees.currency}'),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 42),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: .55),
          borderRadius: BorderRadius.circular(HopeV2Radii.sm),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 2),
            Text(value, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
          ],
        ),
      );
}
