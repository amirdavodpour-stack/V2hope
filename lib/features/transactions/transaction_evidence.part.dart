part of 'transaction_page.dart';

class EvidenceActions extends StatefulWidget {
  const EvidenceActions(
      {super.key,
      required this.repository,
      required this.uploadQueue,
      required this.jobId,
      required this.job,
      required this.onChanged});
  final TransactionRepository repository;
  final UploadQueue uploadQueue;
  final String jobId;
  final Map<String, dynamic> job;
  final VoidCallback onChanged;
  @override
  State<EvidenceActions> createState() => _EvidenceActionsState();
}

class _EvidenceActionsState extends State<EvidenceActions> {
  bool busy = false;
  Future<void> post(String operation) async {
    setState(() => busy = true);
    try {
      switch (operation) {
        case 'start':
          await widget.repository.startJob(widget.jobId);
        case 'deliver':
          await widget.repository.deliverJob(widget.jobId);
        case 'accept':
          await widget.repository.acceptJob(widget.jobId);
        case 'release':
          await widget.repository.releasePayment(widget.jobId);
        default:
          throw StateError('Unsupported work operation: $operation');
      }
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(e,
                fallback:
                    HopeCopy.of(context).copy_operation_failed_eb38c4c))));
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final st = '${widget.job['status'] ?? ''}';
    final paymentStatus = '${widget.job['paymentStatus'] ?? ''}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Divider(height: 32),
      Text(HopeCopy.of(context).copy_work_execution_cb0edb9,
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 12),
      if (st == 'FUNDED')
        FilledButton(
            onPressed: busy ? null : () => post('start'),
            child: Text(HopeCopy.of(context).copy_start_work_51d8317)),
      if (st == 'IN_PROGRESS') ...[
        OutlinedButton(
            onPressed: busy
                ? null
                : () => showDialog(
                    context: context,
                    builder: (_) => EvidenceDialog(
                        repository: widget.repository,
                        uploadQueue: widget.uploadQueue,
                        jobId: widget.jobId,
                        onDone: widget.onChanged)),
            child: Text(HopeCopy.of(context).copy_submit_evidence_bf38455)),
        FilledButton(
            onPressed: busy ? null : () => post('deliver'),
            child: Text(HopeCopy.of(context).copy_deliver_work_49b9e5e))
      ],
      if (st == 'DELIVERED' || st == 'UNDER_REVIEW')
        FilledButton(
            onPressed: busy ? null : () => post('accept'),
            child: Text(HopeCopy.of(context).copy_accept_delivery_195e8bd)),
      if (st == 'COMPLETED' &&
          paymentStatus == 'RELEASE_PENDING' &&
          context.read<AuthController>().user?['id']?.toString() ==
              widget.job['ownerId']?.toString())
        FilledButton(
            onPressed: busy ? null : () => post('release'),
            child: Text(HopeCopy.of(context).copy_settle_payment_82af0e6)),
      if (st == 'COMPLETED' && paymentStatus == 'RELEASED')
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
                HopeCopy.of(context).copy_payment_has_been_settled_f8f8f83)),
      if (st == 'SETTLED')
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
                HopeCopy.of(context).copy_this_transaction_is_settled_04f8174))
    ]);
  }
}

class EvidenceDialog extends StatefulWidget {
  const EvidenceDialog(
      {super.key,
      required this.repository,
      required this.uploadQueue,
      required this.jobId,
      required this.onDone});
  final TransactionRepository repository;
  final UploadQueue uploadQueue;
  final String jobId;
  final VoidCallback onDone;
  @override
  State<EvidenceDialog> createState() => _EvidenceDialogState();
}

class _EvidenceDialogState extends State<EvidenceDialog> {
  final uri = TextEditingController();
  final notes = TextEditingController();
  bool busy = false;
  File? file;
  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    uri.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> pick() async {
    final selected = await EvidencePicker().pickFile();
    if (mounted && selected != null) setState(() => file = selected);
  }

  Future<void> send() async {
    setState(() => busy = true);
    try {
      String evidenceUri = uri.text.trim();
      if (file != null) {
        // Retry with backoff via the upload queue instead of a single
        // direct attempt, so a flaky connection doesn't force the user
        // to re-pick the file and resubmit from scratch.
        final uploaded = await widget.uploadQueue
            .uploadNowWithRetry('/storage/upload', file!);
        if (uploaded is Map && uploaded['key'] is String) {
          evidenceUri = 'storage://${uploaded['key']}';
        }
      }
      if (evidenceUri.isEmpty) {
        throw StateError('Evidence file or URI is required');
      }
      await widget.repository.submitEvidence(
        widget.jobId,
        uri: evidenceUri,
        notes: notes.text.trim(),
        type: file != null ? 'FILE' : 'DELIVERY_LINK',
      );
      if (mounted) {
        Navigator.pop(context);
        widget.onDone();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                HopeCopy.of(context).copy_could_not_submit_evidence_9d09019)));
      }
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
          title: Row(children: [
            const HopeIconTile(Icons.upload_file_rounded, size: 42),
            const SizedBox(width: 10),
            Expanded(
                child: Text(HopeCopy.of(context).copy_submit_evidence_bf38455))
          ]),
          content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
            OutlinedButton.icon(
                onPressed: busy ? null : pick,
                icon: const Icon(Icons.attach_file),
                label: Text(file == null
                    ? HopeCopy.of(context).copy_pick_file
                    : file!.path.split('/').last)),
            TextField(
                controller: uri,
                decoration: InputDecoration(
                    labelText:
                        HopeCopy.of(context).copy_link_uri_optional_1d2307a)),
            TextField(
                controller: notes,
                decoration: InputDecoration(
                    labelText: HopeCopy.of(context).copy_description_24d1e57))
          ])),
          actions: [
            TextButton(
                onPressed: busy ? null : () => Navigator.pop(context),
                child: Text(HopeCopy.of(context).copy_cancel_9955c4b)),
            FilledButton(
                onPressed: busy ? null : send,
                child: Text(HopeCopy.of(context).copy_submit_201d121))
          ]);
}
