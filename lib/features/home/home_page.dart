import 'package:flutter/material.dart';
import '../../core/router/app_routes.dart';
import '../../core/ui/hope_l10n.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/settings/settings_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../jobs/jobs_page.dart';
import '../profile/profile_page.dart';
import '../transactions/transactions_page.dart';
import 'premium_home_feed.dart';
part 'home_widgets.part.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int tab = 0;
  late final List<Widget?> _tabs = List<Widget?>.filled(5, null);
  Widget _buildTab(int index) => _tabs[index] ??= switch (index) {
        0 => PremiumHomeFeed(onOpenExplore: () => _selectTab(1)),
        1 => const JobsPage(key: ValueKey('explore')),
        2 => TransactionsPage(
            key: const ValueKey('transactions'),
            repository: context.read<TransactionRepository>(),
          ),
        3 => const ProfilePage(key: ValueKey('profile')),
        4 => const SizedBox.shrink(),
        _ => const SizedBox.shrink(),
      };

  void _selectTab(int value) {
    if (value == tab) return;
    setState(() => tab = value);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final settings = context.watch<HopeSettingsController>();
    final isEn = Localizations.localeOf(context).languageCode == 'en';
    return Scaffold(
      body: SafeArea(
          child: IndexedStack(
              index: tab,
              children: List.generate(
                  4,
                  (i) =>
                      _tabs[i] ??
                      (i == tab ? _buildTab(tab) : const SizedBox.shrink())))),
      floatingActionButton: tab == 0
          ? FloatingActionButton.extended(
              onPressed: () => _openCreate(context),
              icon: const Icon(Icons.add_rounded),
              label: Text(HopeCopy.of(context).copy_post_opportunity_0389bce),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: _selectTab,
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.home_outlined),
              selectedIcon: const Icon(Icons.home_rounded),
              label: HopeCopy.of(context).copy_home_ce76258),
          NavigationDestination(
              icon: const Icon(Icons.explore_outlined),
              selectedIcon: const Icon(Icons.explore_rounded),
              label: HopeCopy.of(context).copy_explore_115e9fd),
          NavigationDestination(
              icon: const Icon(Icons.swap_horiz_rounded),
              selectedIcon: const Icon(Icons.swap_horizontal_circle_rounded),
              label: HopeCopy.of(context).copy_activity_4b38716),
          NavigationDestination(
              icon: const Icon(Icons.person_outline_rounded),
              selectedIcon: const Icon(Icons.person_rounded),
              label: HopeCopy.of(context).copy_profile_8b081d3),
        ],
      ),
      drawer: Drawer(
          child: SafeArea(
              child: ListView(padding: const EdgeInsets.all(16), children: [
        const HopeMark(size: 48),
        const SizedBox(height: 18),
        Text(HopeCopy.of(context).copy_your_professional_path_2da0026,
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text(
            HopeCopy.of(context)
                .copy_find_the_right_opportunity_or_create_one_c8a9e6f,
            style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 20),
        _drawerTile(context, Icons.explore_rounded,
            HopeCopy.of(context).copy_explore_missions_jobs_3846ebd, () {
          Navigator.pop(context);
          _selectTab(1);
        }),
        _drawerTile(context, Icons.add_business_rounded,
            HopeCopy.of(context).copy_post_a_mission_or_job_364fb6f, () {
          Navigator.pop(context);
          _openCreate(context);
        }),
        if (!auth.isGuest)
          _drawerTile(context, Icons.notifications_rounded,
              HopeCopy.of(context).copy_notifications_370b4a1, () {
            Navigator.pop(context);
            Navigator.push(context, HopeRoutes.notifications());
          }),
        if (auth.user?['role'] == 'ADMIN')
          _drawerTile(context, Icons.admin_panel_settings_rounded,
              HopeCopy.of(context).copy_admin_panel_348cd94, () {
            Navigator.pop(context);
            Navigator.push(context, HopeRoutes.admin());
          }),
        const Divider(height: 26),
        ListTile(
            leading: const HopeIconTile(Icons.location_on_outlined),
            title: Text(HopeCopy.of(context).copy_current_location_182622a),
            subtitle: Text(settings.city),
            onTap: () {
              Navigator.pop(context);
              _selectTab(3);
            }),
        ListTile(
            leading: const HopeIconTile(Icons.translate_rounded),
            title: Text((isEn
                ? HopeCopy.of(context).copy_language_english_d9f5a4a
                : HopeCopy.of(context).copy_language_persian_3ffcd3e)),
            onTap: () async {
              await settings
                  .setLanguage(settings.language == 'fa' ? 'en' : 'fa');
              if (mounted) setState(() {});
            }),
      ]))),
    );
  }

  Widget _drawerTile(BuildContext context, IconData icon, String label,
          VoidCallback tap) =>
      ListTile(
          leading: HopeIconTile(icon, filled: true, size: 42),
          title:
              Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
          onTap: tap);

  void _openCreate(BuildContext context) {
    final auth = context.read<AuthController>();
    if (auth.isGuest) {
      _showSignIn(context);
      return;
    }
    Navigator.push(context, HopeRoutes.createJob());
  }
}

void _showSignIn(BuildContext context) {
  showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
          child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 6, 22, 28),
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const HopeMark(size: 48),
                    const SizedBox(height: 16),
                    Text(HopeCopy.of(context).copy_start_here_555e56f,
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 7),
                    Text(
                        HopeCopy.of(context)
                            .copy_create_an_account_or_log_in_to_post_opport_6bc74a1,
                        style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          Navigator.push(context, HopeRoutes.register());
                        },
                        icon: const Icon(Icons.person_add_alt_1_rounded),
                        label: Text(
                            HopeCopy.of(context).copy_create_account_bfa3517)),
                    const SizedBox(height: 9),
                    OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(sheetContext);
                          Navigator.push(context, HopeRoutes.login());
                        },
                        icon: const Icon(Icons.login_rounded),
                        label: Text(HopeCopy.of(context).copy_log_in_b4c960b)),
                  ]))));
}
