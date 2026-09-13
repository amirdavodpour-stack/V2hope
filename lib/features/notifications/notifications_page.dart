import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/ui/hope_l10n.dart';
import '../../core/notifications/notification.dart';
import '../../core/application/application_registry.dart';
import '../../core/application/application_registry_context.dart';
import '../../core/network/api_error_presenter.dart';

import '../../core/ui/premium_components.dart';
import '../../core/router/app_routes.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/uploads/upload_queue.dart';

ApplicationRegistry _applicationRegistry(BuildContext context) => applicationRegistryOf(context);

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<HopeNotification> items = const [];
  bool loading = true;
  String? error;
  HopeNotificationPreferences? preferences;
  bool preferencesLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final page =
          await _applicationRegistry(context).listNotifications();
      if (!mounted) return;
      setState(() {
        items = page.items;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = apiErrorMessage(e,
            fallback:
                HopeCopy.of(context).copy_could_not_load_notifications_a904a88);
        loading = false;
      });
    }
  }

  Future<void> _read(String id) async {
    try {
      await _applicationRegistry(context).markNotificationRead(id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(e,
                fallback:
                    HopeCopy.of(context).copy_operation_failed_eb38c4c))));
      }
      return;
    }
    await _load();
  }

  Future<void> _openPreferences() async {
    if (preferencesLoading) return;
    setState(() => preferencesLoading = true);
    try {
      preferences ??= await _applicationRegistry(context).loadNotificationPreferences();
      if (!mounted || preferences == null) return;
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (sheetContext) {
          var current = preferences!;
          return StatefulBuilder(
            builder: (context, setSheetState) => Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 24 + MediaQuery.of(context).viewInsets.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('تنظیمات اعلان‌ها', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  const Text('کانال‌ها و دسته‌بندی اعلان‌ها را کنترل کنید.'),
                  const SizedBox(height: 12),
                  _preferenceSwitch('اعلان داخل برنامه', current.inApp, (value) async { current = await _savePreference('inApp', value, current); setSheetState(() {}); }),
                  _preferenceSwitch('Push', current.push, (value) async { current = await _savePreference('push', value, current); setSheetState(() {}); }),
                  _preferenceSwitch('ایمیل', current.email, (value) async { current = await _savePreference('email', value, current); setSheetState(() {}); }),
                  _preferenceSwitch('به‌روزرسانی درخواست‌ها', current.applicationUpdates, (value) async { current = await _savePreference('applicationUpdates', value, current); setSheetState(() {}); }),
                  _preferenceSwitch('به‌روزرسانی پرداخت‌ها', current.paymentUpdates, (value) async { current = await _savePreference('paymentUpdates', value, current); setSheetState(() {}); }),
                  _preferenceSwitch('بازاریابی', current.marketing, (value) async { current = await _savePreference('marketing', value, current); setSheetState(() {}); }),
                ],
              ),
            ),
          );
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(e, fallback: 'ذخیره تنظیمات اعلان‌ها ناموفق بود.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => preferencesLoading = false);
    }
  }

  Widget _preferenceSwitch(String title, bool value, Future<void> Function(bool) onChanged) =>
      SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        value: value,
        onChanged: (next) { onChanged(next); },
      );

  Future<HopeNotificationPreferences> _savePreference(
      String key, bool value, HopeNotificationPreferences current) async {
    final next = await _applicationRegistry(context).updateNotificationPreferences({key: value});
    preferences = next;
    return next;
  }

  Future<void> _openNotification(HopeNotification n) async {
    if (n.isUnread) {
      try { await _applicationRegistry(context).markNotificationRead(n.id); } catch (_) {}
    }
    if (!mounted) return;
    final jobId = n.jobId;
    if (n.paymentId != null && jobId != null && jobId.isNotEmpty) {
      await Navigator.push(context, HopeRoutes.transaction(
        repository: context.read<TransactionRepository>(),
        uploadQueue: context.read<UploadQueue>(),
        jobId: jobId,
      ));
      return;
    }
    if (jobId != null && jobId.isNotEmpty) {
      try {
        final job = await _applicationRegistry(context).getOpportunity(jobId);
        if (!mounted) return;
        await Navigator.push(context, HopeRoutes.jobDetail(job));
        return;
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('جزئیات پروژه در دسترس نیست.')));
      }
    }
    await _load();
  }

  Future<void> _readAll() async {
    try {
      await _applicationRegistry(context).markAllNotificationsRead();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(e,
                fallback:
                    HopeCopy.of(context).copy_operation_failed_eb38c4c))));
      }
      return;
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: Text(HopeCopy.of(context).copy_notifications_370b4a1),
            actions: [
              IconButton(
                  onPressed: _openPreferences,
                  icon: const Icon(Icons.tune_rounded),
                  tooltip: 'تنظیمات اعلان‌ها'),
              IconButton(
                  onPressed: items.isEmpty ? null : _readAll,
                  icon: const Icon(Icons.done_all_rounded),
                  tooltip: HopeCopy.of(context).copy_mark_all_read_500a31c)
            ]),
        body: PremiumPageFrame(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 48),
          child: RefreshIndicator(
            onRefresh: _load,
            child: loading
                ? ListView(children: const [
                    SizedBox(height: 280),
                    Center(child: CircularProgressIndicator())
                  ])
                : error != null
                    ? ListView(padding: const EdgeInsets.all(24), children: [
                        Text(HopeCopy.of(context)
                            .copy_could_not_load_notifications_a904a88),
                        const SizedBox(height: 12),
                        FilledButton(
                            onPressed: _load,
                            child:
                                Text(HopeCopy.of(context).copy_retry_49f3eba))
                      ])
                    : items.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(24),
                            children: [
                                const SizedBox(height: 80),
                                const Icon(Icons.notifications_none_rounded,
                                    size: 64),
                                const SizedBox(height: 16),
                                Center(
                                    child: Text(HopeCopy.of(context)
                                        .copy_you_have_no_new_notifications_45f9685))
                              ])
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(0, 16, 0, 32),
                            itemCount: items.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final n = items[index];
                              final unread = n.isUnread;
                              return PremiumPanel(
                                  padding: const EdgeInsets.all(16),
                                  highlight: unread,
                                  semanticLabel: n.title,
                                  child: InkWell(
                                      onTap: n.hasAction || unread ? () => _openNotification(n) : null,
                                      borderRadius: BorderRadius.circular(18),
                                      // Notification actions both acknowledge the event and
                                      // route the user to the relevant project when available.
                                      onLongPress: unread ? () => _read(n.id) : null,
                                      child: Semantics(
                                          button: unread,
                                          label: unread
                                              ? '${n.title}، ${n.hasAction ? n.actionLabel : HopeCopy.of(context).copy_tap_to_mark_as_read_5c9917a}'
                                              : n.title,
                                          child: Padding(
                                              padding: const EdgeInsets.all(16),
                                              child: Row(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Icon(unread
                                                        ? Icons
                                                            .notifications_active_rounded
                                                        : Icons
                                                            .notifications_none_rounded),
                                                    const SizedBox(width: 12),
                                                    Expanded(
                                                        child: Column(
                                                            crossAxisAlignment:
                                                                CrossAxisAlignment
                                                                    .start,
                                                            children: [
                                                          Text(n.title,
                                                              style: Theme.of(
                                                                      context)
                                                                  .textTheme
                                                                  .titleMedium
                                                                  ?.copyWith(
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w800)),
                                                          const SizedBox(
                                                              height: 4),
                                                          Text(n.body),
                                                          if (n.hasAction) ...[
                                                            const SizedBox(height: 10),
                                                            Align(
                                                              alignment: AlignmentDirectional.centerStart,
                                                              child: FilledButton.tonalIcon(
                                                                onPressed: () => _openNotification(n),
                                                                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                                                                label: Text(n.actionLabel),
                                                              ),
                                                            ),
                                                          ],
                                                          if (unread) ...[
                                                            const SizedBox(
                                                                height: 7),
                                                            Text(
                                                                HopeCopy.of(
                                                                        context)
                                                                    .copy_tap_to_mark_as_read_5c9917a,
                                                                style: Theme.of(
                                                                        context)
                                                                    .textTheme
                                                                    .labelMedium)
                                                          ]
                                                        ]))
                                                  ])))));
                            }),
          ),
        ),
      );
}
