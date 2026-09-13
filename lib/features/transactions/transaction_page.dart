import 'package:flutter/material.dart';
import '../../core/ui/hope_l10n.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../evidence/evidence_picker.dart';
import '../../core/uploads/upload_queue.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/transactions/payment.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../../core/theme/app_theme.dart';
import 'transaction_controller.dart';
part 'transaction_evidence.part.dart';

class TransactionPage extends StatefulWidget {
  const TransactionPage({
    super.key,
    required this.repository,
    required this.uploadQueue,
    required this.jobId,
  });
  final TransactionRepository repository;
  final UploadQueue uploadQueue;
  final String jobId;
  @override
  State<TransactionPage> createState() => _TransactionPageState();
}

class _TransactionPageState extends State<TransactionPage> {
  HopePayment? payment;
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    try {
      if (mounted) setState(() => error = null);
      final data = await TransactionController(
              repository: widget.repository, jobId: widget.jobId)
          .load();
      if (mounted) {
        setState(() => payment = data);
      }
    } catch (e) {
      if (mounted) {
        setState(() => error = apiErrorMessage(e,
            fallback: HopeCopy.of(context).copy_operation_failed_eb38c4c));
      }
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> action(String operation) async {
    setState(() => loading = true);
    try {
      final next = await TransactionController(
              repository: widget.repository, jobId: widget.jobId)
          .execute(operation);
      if (mounted) {
        setState(() => payment = next);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(HopeCopy.of(context).copy_operation_completed_66dd356)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(e,
                fallback:
                    HopeCopy.of(context).copy_operation_failed_eb38c4c))));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading && payment == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (error != null && payment == null) {
      return Scaffold(
          body: Center(
              child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                        onPressed: loading ? null : refresh,
                        child: Text(HopeCopy.of(context).copy_retry_49f3eba))
                  ]))));
    }
    final status = payment?.status ?? 'NO_TRANSACTION';
    final job = payment?.job;
    final isOwner = context.read<AuthController>().user?['id']?.toString() ==
        job?.ownerId?.toString();
    return Directionality(
      textDirection: Localizations.localeOf(context).languageCode == 'en'
          ? TextDirection.ltr
          : TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
            leading: IconButton(
                onPressed: () => Navigator.maybePop(context),
                icon: Icon(Localizations.localeOf(context).languageCode == 'en'
                    ? Icons.arrow_back_rounded
                    : Icons.arrow_forward_rounded),
                tooltip: HopeCopy.of(context).copy_back_6e09f79),
            title: Text(HopeCopy.of(context).copy_transaction_7e0ea3b)),
        body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              Row(children: [
                const HopeMark(size: 38),
                const Spacer(),
                StatusPill(
                    status == 'NO_TRANSACTION'
                        ? HopeCopy.of(context).copy_no_payment_1337b58
                        : status,
                    color: status == 'RELEASED'
                        ? AppColors.success
                        : AppColors.primary)
              ]),
              const SizedBox(height: 20),
              if (job != null)
                Text(job.title,
                    style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 14),
              HopeSurface(
                  padding: const EdgeInsets.all(18),
                  child: Column(children: [
                    Row(children: [
                      Expanded(
                          child: Text(
                              HopeCopy.of(context).copy_payment_status_e1b6f0c,
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Text(status,
                          style: Theme.of(context).textTheme.titleMedium)
                    ]),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(
                          child: Text(HopeCopy.of(context).copy_amount_6400812,
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Text('${payment?.amount ?? '-'}',
                          style: Theme.of(context).textTheme.titleMedium)
                    ]),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(
                          child: Text(
                              HopeCopy.of(context).copy_reference_aa63360,
                              style: Theme.of(context).textTheme.bodyMedium)),
                      Flexible(
                          child: Text(payment?.providerRef ?? '—',
                              textAlign: TextAlign.left,
                              style: Theme.of(context).textTheme.titleMedium))
                    ]),
                  ])),
              if (payment?.fees != null) ...[
                const SizedBox(height: 12),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                              HopeCopy.of(context)
                                  .copy_financial_details_f24007d,
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 12),
                          _moneyRow(
                              HopeCopy.of(context).copy_base_amount_82586c0,
                              payment!.fees!.baseAmount),
                          _moneyRow(
                              HopeCopy.of(context).copy_employer_fee_3a30b60,
                              payment!.fees!.employerFee),
                          _moneyRow(
                              HopeCopy.of(context).copy_worker_fee_85a35aa,
                              payment!.fees!.workerFee),
                          const Divider(height: 20),
                          _moneyRow(
                              HopeCopy.of(context).copy_employer_charge_9740283,
                              payment!.fees!.employerCharge,
                              strong: true),
                          _moneyRow(
                              HopeCopy.of(context).copy_worker_payout_45f6bb9,
                              payment!.fees!.providerPayout,
                              strong: true),
                        ])),
              ],
              const SizedBox(height: 14),
              if (status == 'NO_TRANSACTION')
                FilledButton.icon(
                    onPressed: loading ? null : () => action('fund'),
                    icon: const Icon(Icons.account_balance_wallet_rounded),
                    label:
                        Text(HopeCopy.of(context).copy_fund_payment_c223336)),
              if (status == 'HELD' && isOwner)
                OutlinedButton.icon(
                    onPressed: loading ? null : () => action('refund'),
                    icon: const Icon(Icons.undo_rounded),
                    label:
                        Text(HopeCopy.of(context).copy_request_refund_c55b9aa)),
              if (job != null)
                EvidenceActions(
                    repository: widget.repository,
                    uploadQueue: widget.uploadQueue,
                    jobId: widget.jobId,
                    job: {
                      ...job.toMap(),
                      'paymentStatus': payment?.paymentStatus,
                    },
                    onChanged: refresh),
            ]),
      ),
    );
  }
}

Widget _moneyRow(String label, dynamic value, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Expanded(child: Text(label)),
        Text('${value ?? '—'}',
            style: TextStyle(
                fontWeight: strong ? FontWeight.w800 : FontWeight.w500))
      ]),
    );
