import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/ui/hope_l10n.dart';
import '../../core/admin/admin_repository.dart';
import '../../core/application/application_registry.dart';
import '../../core/application/application_registry_context.dart';
import '../../core/marketplace/job.dart';
import '../../core/marketplace/application.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/ui/components.dart';
import '../../core/theme/app_theme.dart';

import '../../core/ui/premium_components.dart';

ApplicationRegistry _applicationRegistry(BuildContext context) => applicationRegistryOf(context);

class AdminPage extends StatefulWidget {
  const AdminPage({super.key});
  @override
  State<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends State<AdminPage>
    with SingleTickerProviderStateMixin {
  late Future<HopeAdminSummary> _summary;
  late Future<List<HopeJob>> _jobs;
  late Future<List<HopeApplication>> _applications;
  late Future<List<HopeAdminUser>> _users;
  late Future<List<HopeAdminAuditEvent>> _audit;
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _reload();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _reload() {
    final repository = context.read<AdminRepository>();
    _summary = repository.getSummary();
    _jobs = repository.listJobs();
    _applications = repository.listApplications();
    _users = repository.listUsers();
    _audit = repository.listAudit();
    if (mounted) setState(() {});
  }

  Future<void> _runAction(Future<void> Function() action) async {
    try {
      await action();
      if (!mounted) return;
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(apiErrorMessage(error,
                fallback: HopeCopy.of(context).copy_operation_failed_eb38c4c))),
      );
    }
  }

  String _initial(String value) {
    final text = value.trim();
    return text.isEmpty ? '?' : text.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: Localizations.localeOf(context).languageCode == 'en'
            ? TextDirection.ltr
            : TextDirection.rtl,
        child: Scaffold(
          appBar: AppBar(
              title: Text(HopeCopy.of(context).copy_hope_admin_center_912aa06)),
          body: RefreshIndicator(
            onRefresh: () async => _reload(),
            child: PremiumPageFrame(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 48),
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  PremiumHeader(
                    eyebrow: HopeCopy.of(context).copy_control_center_15e20c8,
                    title: HopeCopy.of(context)
                        .copy_monitor_and_manage_hope_in_one_place_bea3b7d,
                    subtitle: HopeCopy.of(context)
                        .copy_review_users_opportunities_applications_an_e30b9d2,
                    trailing: const HopeIconTile(
                      Icons.admin_panel_settings_rounded,
                      size: 50,
                      filled: true,
                    ),
                  ),
                const SizedBox(height: 18),
                FutureBuilder<HopeAdminSummary>(
                    future: _summary,
                    builder: (context, s) => _summaryGrid(context, s.data)),
                const SizedBox(height: 18),
                TabBar(controller: _tabs, isScrollable: true, tabs: [
                  Tab(text: HopeCopy.of(context).copy_opportunities_015066e),
                  Tab(text: HopeCopy.of(context).copy_applications_6655869),
                  Tab(text: HopeCopy.of(context).copy_users_200338b),
                  Tab(text: HopeCopy.of(context).copy_audit_log_ff87181),
                ]),
                SizedBox(
                    height: 620,
                    child: TabBarView(controller: _tabs, children: [
                      _jobsTab(context),
                      _applicationsTab(context),
                      _usersTab(context),
                      _auditTab(context)
                    ])),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _summaryGrid(BuildContext context, HopeAdminSummary? raw) {
    final m = raw;
    final items = [
      [
        'users',
        HopeCopy.of(context).copy_users_200338b,
        Icons.people_alt_outlined
      ],
      [
        'published_opportunities',
        HopeCopy.of(context).copy_published_1a00f35,
        Icons.public_rounded
      ],
      [
        'missions',
        HopeCopy.of(context).copy_missions_a833d13,
        Icons.task_alt_rounded
      ],
      [
        'jobs',
        HopeCopy.of(context).copy_jobs_ebf9a80,
        Icons.work_outline_rounded
      ],
      [
        'pending_applications',
        HopeCopy.of(context).copy_pending_86ad26d,
        Icons.hourglass_top_rounded
      ],
      [
        'audit_events',
        HopeCopy.of(context).copy_audit_events_7f47fd5,
        Icons.fact_check_outlined
      ],
    ];
    return GridView.count(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 2.25,
        children: items
            .map((e) => PremiumPanel(
                padding: const EdgeInsets.all(13),
                child: Row(children: [
                  HopeIconTile(e[2] as IconData, filled: true, size: 40),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                        Text('${m?[e[0] as String] ?? 0}',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        Text('${e[1]}',
                            style: Theme.of(context).textTheme.bodySmall)
                      ]))
                ])))
            .toList());
  }

  Widget _errorState(BuildContext context, Object? error,
      {required VoidCallback retry}) {
    if (error == null) return const SizedBox.shrink();
    return Padding(
        padding: const EdgeInsets.all(20),
        child: EmptyState(
            icon: Icons.cloud_off_rounded,
            title: HopeCopy.of(context).copy_connection_failed_1b34bc9,
            message: apiErrorMessage(error,
                fallback: HopeCopy.of(context)
                    .copy_the_server_did_not_return_data_try_again_bccfbb3),
            action: FilledButton(
                onPressed: retry,
                child: Text(HopeCopy.of(context).copy_retry_49f3eba))));
  }

  Widget _jobsTab(BuildContext context) => FutureBuilder<List<HopeJob>>(
      future: _jobs,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _errorState(context, snapshot.error, retry: _reload);
        }
        final list = snapshot.data ?? const <HopeJob>[];
        if (list.isEmpty) {
          return EmptyState(
              icon: Icons.work_outline,
              title: HopeCopy.of(context).copy_no_opportunities_a112400,
              message:
                  HopeCopy.of(context).copy_opportunities_appear_here_d85bef9);
        }
        return ListView(
            padding: const EdgeInsets.only(top: 14),
            children: list.take(50).map<Widget>((job) {
              final status = job.status ?? '—';
              return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: HopeSurface(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        HopeIconTile(
                            job.isJob
                                ? Icons.work_outline_rounded
                                : Icons.task_alt_rounded,
                            filled: true),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(job.title,
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 3),
                              Text(
                                  '${job.kind} • ${job.city ?? HopeCopy.of(context).copy_remote_dcbb625} • $status')
                            ])),
                        if (status == 'DRAFT')
                          IconButton(
                              onPressed: () =>
                                  _moderateJob(job.id, 'PUBLISHED'),
                              tooltip:
                                  HopeCopy.of(context).copy_publish_5cfd26b,
                              icon: const Icon(Icons.publish_rounded)),
                        if (status == 'PUBLISHED')
                          IconButton(
                              onPressed: () =>
                                  _moderateJob(job.id, 'CANCELLED'),
                              tooltip:
                                  HopeCopy.of(context).copy_disable_73bea34,
                              icon: const Icon(Icons.block_outlined)),
                        IconButton(
                            onPressed: () => _removeJob(job.id),
                            tooltip: HopeCopy.of(context).copy_delete_b17eb9d,
                            icon: const Icon(Icons.delete_outline_rounded,
                                color: AppColors.danger)),
                      ])));
            }).toList());
      });

  Widget _applicationsTab(BuildContext context) => FutureBuilder<
          List<HopeApplication>>(
      future: _applications,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _errorState(context, snapshot.error, retry: _reload);
        }
        final list = snapshot.data ?? const <HopeApplication>[];
        if (list.isEmpty) {
          return EmptyState(
              icon: Icons.inbox_outlined,
              title: HopeCopy.of(context).copy_no_applications_0917e11,
              message: HopeCopy.of(context)
                  .copy_job_applications_are_managed_here_1b21e96);
        }
        return ListView(
            padding: const EdgeInsets.only(top: 14),
            children: list.take(50).map<Widget>((a) {
              final status = a.status;
              return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: HopeSurface(
                      padding: const EdgeInsets.all(14),
                      child: Column(children: [
                        ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const HopeIconTile(
                                Icons.description_outlined,
                                filled: true),
                            title: Text(
                                HopeCopy.of(context).copy_candidate_c67d7bf),
                            subtitle: Text(
                                '${a.jobTitle.isEmpty ? HopeCopy.of(context).copy_job_ce2feba : a.jobTitle} • $status')),
                        if (status == 'PENDING')
                          Row(children: [
                            Expanded(
                                child: OutlinedButton.icon(
                                    onPressed: () =>
                                        _applicationAction(a.id, 'shortlist'),
                                    icon: const Icon(Icons.star_border_rounded),
                                    label: Text(HopeCopy.of(context)
                                        .copy_shortlist_8a78995))),
                            const SizedBox(width: 8),
                            Expanded(
                                child: FilledButton.icon(
                                    onPressed: () =>
                                        _applicationAction(a.id, 'select'),
                                    icon: const Icon(Icons.send_rounded),
                                    label: Text(HopeCopy.of(context)
                                        .copy_forward_5ec70ea))),
                            const SizedBox(width: 8),
                            IconButton(
                                onPressed: () =>
                                    _applicationAction(a.id, 'reject'),
                                tooltip: HopeCopy.of(context)
                                    .copy_reject_application_9682e01,
                                icon: const Icon(Icons.close_rounded,
                                    color: AppColors.danger))
                          ]),
                        if (status == 'SHORTLISTED')
                          Row(children: [
                            Expanded(
                                child: FilledButton.icon(
                                    onPressed: () =>
                                        _applicationAction(a.id, 'select'),
                                    icon: const Icon(Icons.send_rounded),
                                    label: Text(HopeCopy.of(context)
                                        .copy_forward_to_employer_0baa2e1))),
                            IconButton(
                                onPressed: () =>
                                    _applicationAction(a.id, 'reject'),
                                tooltip: HopeCopy.of(context)
                                    .copy_reject_application_9682e01,
                                icon: const Icon(Icons.close_rounded,
                                    color: AppColors.danger))
                          ])
                      ])));
            }).toList());
      });

  Widget _usersTab(BuildContext context) => FutureBuilder<List<HopeAdminUser>>(
      future: _users,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _errorState(context, snapshot.error, retry: _reload);
        }
        final list = snapshot.data ?? const <HopeAdminUser>[];
        if (list.isEmpty) {
          return EmptyState(
              icon: Icons.people_outline,
              title: HopeCopy.of(context).copy_users_200338b,
              message: HopeCopy.of(context)
                  .copy_the_server_did_not_return_data_try_again_bccfbb3);
        }
        return ListView(
            padding: const EdgeInsets.only(top: 14),
            children: list.take(100).map<Widget>((u) {
              final status = u.status;
              return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: HopeSurface(
                      padding: const EdgeInsets.all(12),
                      child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                              child: Text(_initial(u.displayName))),
                          title: Text(u.displayName),
                          subtitle: Text(
                              '${u.email.isEmpty ? '—' : u.email} • ${u.role} • $status'),
                          trailing: u.role == 'ADMIN'
                              ? null
                              : IconButton(
                                  onPressed: () => _setUserStatus(
                                      u.id,
                                      status == 'ACTIVE'
                                          ? 'SUSPENDED'
                                          : 'ACTIVE'),
                                  tooltip: status == 'ACTIVE'
                                      ? HopeCopy.of(context)
                                          .copy_suspend_44bded8
                                      : HopeCopy.of(context)
                                          .copy_activate_2215693,
                                  icon: Icon(status == 'ACTIVE'
                                      ? Icons.pause_circle_outline
                                      : Icons.play_circle_outline)))));
            }).toList());
      });

  Widget _auditTab(BuildContext context) =>
      FutureBuilder<List<HopeAdminAuditEvent>>(
          future: _audit,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _errorState(context, snapshot.error, retry: _reload);
            }
            final list = snapshot.data ?? const <HopeAdminAuditEvent>[];
            return ListView(
                padding: const EdgeInsets.only(top: 14),
                children: list.take(100).map<Widget>((a) {
                  return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: HopeSurface(
                          padding: const EdgeInsets.all(12),
                          child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading:
                                  const HopeIconTile(Icons.history_rounded),
                              title: Text(a.action),
                              subtitle: Text(
                                  '${a.actorName.isEmpty ? HopeCopy.of(context).copy_system_bf4e081 : a.actorName} • ${a.entityType} • ${a.createdAt}'))));
                }).toList());
          });

  Future<void> _applicationAction(String id, String action) {
    final repository = context.read<AdminRepository>();
    return _runAction(() async {
      switch (action) {
        case 'shortlist':
          return await repository.shortlistApplication(id);
        case 'select':
          return await repository.forwardApplication(id);
        case 'reject':
          return await repository.rejectApplication(id);
        default:
          throw ArgumentError.value(action, 'action');
      }
    });
  }

  Future<void> _moderateJob(String id, String status) =>
      _runAction(() => _applicationRegistry(context).adminCommands.moderateJob(id, status));

  Future<void> _setUserStatus(String id, String status) => _runAction(
      () => _applicationRegistry(context).adminCommands.setUserStatus(id, status));

  Future<void> _removeJob(String id) =>
      _runAction(() => _applicationRegistry(context).adminCommands.deleteJob(id));
}
