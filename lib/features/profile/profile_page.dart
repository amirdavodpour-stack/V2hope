import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/marketplace/application.dart';
import '../../core/profile/profile_repository.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/router/app_routes.dart';
import '../../core/settings/settings_controller.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/hope_l10n.dart';
import 'profile_controller.dart';

import '../../core/ui/premium_components.dart';
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  late final ProfileController _controller;

  @override
  void initState() {
    super.initState();
    _controller =
        ProfileController(repository: context.read<ProfileRepository>());
  }

  Future<HopeProviderProfile>? profile;
  Future<List<HopeApplication>>? applications;
  String? _loadedUserId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = context.read<AuthController>().user?['id']?.toString();
    if (id == _loadedUserId) return;
    _loadedUserId = id;
    if (id == null) {
      profile = null;
      applications = null;
      return;
    }
    profile = _controller.loadProfile().catchError(
          (_) => const HopeProviderProfile(
              providerType: '', capacity: '', verificationStatus: '',
              trustSignals: <String, dynamic>{}),
        );
    applications = _controller.loadApplications().catchError(
          (_) => const <HopeApplication>[],
        );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final settings = context.watch<HopeSettingsController>();
    final theme = context.watch<ThemeController>();

    if (auth.isGuest) {
      return _guest(context, settings, theme);
    }

    final user = auth.user ?? <String, dynamic>{};
    final name = '${user['displayName'] ?? 'HOPE'}';
    final initial = name.isEmpty ? 'H' : name.characters.first.toUpperCase();

    return Material(
      color: Colors.transparent,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 122),
        children: [
          PremiumHeader(
            eyebrow: HopeCopy.of(context).copy_profile_8b081d3,
            title: '${HopeCopy.of(context).copy_hello_fc7ef4a}, $name',
            subtitle: HopeCopy.of(context)
                .copy_professional_identity_preferences_and_acco_7f164ce,
            trailing: const HopeMark(size: 42, showText: false),
          ),
          const SizedBox(height: 18),
          PremiumPanel(
            highlight: true,
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 31,
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(
                        '${user['email'] ?? ''}',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 7),
                      StatusPill(
                        HopeCopy.of(context).copy_active_account_bef80da,
                        color: AppColors.success,
                        icon: Icons.verified_rounded,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 19),
          SectionTitle(
            title: HopeCopy.of(context).copy_personal_settings_4ecc5fa,
            subtitle: HopeCopy.of(context)
                .copy_controls_that_make_hope_fit_you_better_ace4c0c,
          ),
          const SizedBox(height: 10),
          _settingsCard(context, settings, theme),
          const SizedBox(height: 19),
          FutureBuilder<HopeProviderProfile>(
            future: profile,
            builder: (context, snapshot) {
              final data = snapshot.data;

              return PremiumPanel(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const HopeIconTile(
                        Icons.work_history_outlined,
                      ),
                      title: Text(
                        HopeCopy.of(context).copy_work_profile_885ecac,
                      ),
                      subtitle: Text(
                        '${data?.providerType.isNotEmpty == true ? data!.providerType : HopeCopy.of(context).copy_professional_user_54818b8} • ${data?.capacity.isNotEmpty == true ? data!.capacity : HopeCopy.of(context).copy_open_to_work_aa59263}',
                      ),
                    ),
                    const Divider(height: 1),
                    if (data != null && (data.isVerified || data.completedJobs > 0)) ...[
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: HopeIconTile(
                          data.isVerified ? Icons.verified_rounded : Icons.workspace_premium_outlined,
                          filled: data.isVerified,
                        ),
                        title: const Text('Trust signals'),
                        subtitle: Text(
                          data.isVerified
                              ? '${data.completedJobs} completed jobs${data.activeJobs > 0 ? ' • ${data.activeJobs} active' : ''}'
                              : '${data.completedJobs} completed jobs',
                        ),
                      ),
                      const Divider(height: 1),
                    ],
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const HopeIconTile(
                        Icons.admin_panel_settings_outlined,
                      ),
                      title: Text(
                        HopeCopy.of(context).copy_verification_c45fea9,
                      ),
                      subtitle: Text(
                        data?.verificationStatus.isNotEmpty == true
                            ? data!.verificationStatus
                            : HopeCopy.of(context).copy_not_completed_f8a6746,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 14),
          FutureBuilder<List<HopeApplication>>(
            future: applications,
            builder: (context, snapshot) {
              final list = snapshot.data ?? const <HopeApplication>[];

              if (list.isEmpty) {
                return const SizedBox.shrink();
              }

              return PremiumPanel(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      HopeCopy.of(context).copy_my_job_applications_90701f0,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    ...list.take(6).map<Widget>((a) {
                      final status = a.status;

                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: HopeIconTile(
                          status == 'ACCEPTED'
                              ? Icons.check_circle_rounded
                              : Icons.work_outline_rounded,
                          filled: status == 'ACCEPTED',
                        ),
                        title: Text(
                          a.jobTitle.isEmpty
                              ? HopeCopy.of(context).copy_job_ce2feba
                              : a.jobTitle,
                        ),
                        subtitle: Text(a.statusLabel),
                        trailing: a.canWithdraw
                            ? IconButton(
                                onPressed: () async {
                                  try {
                                    await _controller.withdrawApplication(a.id);
                                    if (!mounted) return;
                                    setState(() {
                                      applications = _controller
                                          .loadApplications()
                                          .catchError(
                                              (_) => const <HopeApplication>[]);
                                    });
                                  } catch (error) {
                                    if (!mounted || !context.mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                          content: Text(apiErrorMessage(error,
                                              fallback: HopeCopy.of(context)
                                                  .copy_operation_failed_eb38c4c))),
                                    );
                                  }
                                },
                                tooltip:
                                    HopeCopy.of(context).copy_cancel_9955c4b,
                                icon: const Icon(Icons.undo_rounded),
                              )
                            : null,
                      );
                    }),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 14),
          if (auth.user?['role'] == 'ADMIN')
            FilledButton.tonalIcon(
              onPressed: () => Navigator.push(context, HopeRoutes.admin()),
              icon: const Icon(Icons.admin_panel_settings_rounded),
              label: Text(
                HopeCopy.of(context).copy_open_admin_panel_39f3cb8,
              ),
            ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => Navigator.push(context, HopeRoutes.about()),
            icon: const Icon(Icons.info_outline_rounded),
            label: Text(HopeCopy.of(context).copy_about_hope_f8ee86b),
          ),
          const SizedBox(height: 10),
          ListTile(
            leading: const HopeIconTile(
              Icons.logout_rounded,
              color: AppColors.danger,
            ),
            title: Text(
              HopeCopy.of(context).copy_log_out_04a94c7,
              style: TextStyle(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppColors.dangerDark
                    : AppColors.danger,
                fontWeight: FontWeight.w800,
              ),
            ),
            onTap: auth.logout,
          ),
        ],
      ),
    );
  }

  Widget _guest(
    BuildContext context,
    HopeSettingsController settings,
    ThemeController theme,
  ) {
    return Material(
      color: Colors.transparent,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 122),
        children: [
          const HopeMark(),
          const SizedBox(height: 24),
          Text(
            HopeCopy.of(context).copy_profile_8b081d3,
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 6),
          Text(
            HopeCopy.of(context)
                .copy_create_an_account_to_apply_post_and_person_6fd6b91,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 18),
          GradientHero(
            eyebrow: HopeCopy.of(context).copy_hope_account_4ba3966,
            title: HopeCopy.of(context)
                .copy_a_home_for_your_professional_path_52dbb09,
            message: HopeCopy.of(context)
                .copy_keep_your_profile_opportunities_transactio_39f443d,
            icon: Icons.person_rounded,
            action: Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: () =>
                        Navigator.push(context, HopeRoutes.register()),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                    ),
                    child: Text(
                      HopeCopy.of(context).copy_create_account_bfa3517,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () =>
                        Navigator.push(context, HopeRoutes.login()),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white54),
                    ),
                    child: Text(
                      HopeCopy.of(context).copy_log_in_b4c960b,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _settingsCard(context, settings, theme),
        ],
      ),
    );
  }

  Widget _settingsCard(
    BuildContext context,
    HopeSettingsController settings,
    ThemeController theme,
  ) {
    return HopeSurface(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(15, 15, 15, 8),
            child: Row(
              children: [
                const HopeIconTile(
                  Icons.tune_rounded,
                  filled: true,
                  size: 42,
                ),
                const SizedBox(width: 10),
                Text(
                  HopeCopy.of(context).copy_settings_a8a6c67,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
          ListTile(
            leading: const HopeIconTile(Icons.translate_rounded),
            title: Text(
              HopeCopy.of(context).copy_app_language_789c9c4,
            ),
            subtitle: Text(
              settings.language == 'fa'
                  ? HopeCopy.of(context).copy_language_persian_3ffcd3e
                  : HopeCopy.of(context).copy_language_english_d9f5a4a,
            ),
            trailing: SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'fa',
                  label: Text(
                    HopeCopy.of(context).copy_persian_62775b3,
                  ),
                ),
                ButtonSegment(
                  value: 'en',
                  label: Text(
                    HopeCopy.of(context).copy_english_8396fe3,
                  ),
                ),
              ],
              selected: {settings.language},
              onSelectionChanged: (value) => settings.setLanguage(value.first),
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const HopeIconTile(Icons.dark_mode_outlined),
            title: Text(
              HopeCopy.of(context).copy_appearance_c90f540,
            ),
            subtitle: Text(_themeLabel(context, theme.mode)),
            onTap: () => _pickTheme(context, settings, theme),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const HopeIconTile(Icons.location_on_outlined),
            title: Text(
              HopeCopy.of(context).copy_location_city_46ccc39,
            ),
            subtitle: Text(
              '${settings.city} • ${settings.locationEnabled ? HopeCopy.of(context).copy_location_on_dad416c : HopeCopy.of(context).copy_manual_selection_90510b2}',
            ),
            trailing: Switch(
              value: settings.locationEnabled,
              onChanged: (value) async {
                if (value) {
                  final ok = await settings.enableLocation();
                  if (!ok && mounted && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          HopeCopy.of(context)
                              .copy_location_permission_was_not_enabled_you_ca_ba53b81,
                        ),
                      ),
                    );
                  }
                } else {
                  await settings.disableLocation();
                }
              },
            ),
          ),
          ListTile(
            leading: const HopeIconTile(Icons.map_outlined),
            title: Text(
              HopeCopy.of(context).copy_choose_another_city_1375095,
            ),
            onTap: () => _pickCity(context, settings),
          ),
          const Divider(height: 1),
          SwitchListTile.adaptive(
            contentPadding: const EdgeInsets.symmetric(horizontal: 15),
            secondary: const HopeIconTile(
              Icons.notifications_none_rounded,
            ),
            title: Text(
              HopeCopy.of(context).copy_notifications_370b4a1,
            ),
            subtitle: Text(
              HopeCopy.of(context)
                  .copy_new_opportunities_and_application_updates_d3e84aa,
            ),
            value: settings.notifications,
            onChanged: settings.setNotifications,
          ),
          SwitchListTile.adaptive(
            contentPadding: const EdgeInsets.symmetric(horizontal: 15),
            secondary: const HopeIconTile(
              Icons.auto_awesome_outlined,
            ),
            title: Text(
              HopeCopy.of(context).copy_personalized_recommendations_a4e4411,
            ),
            subtitle: Text(
              HopeCopy.of(context)
                  .copy_based_on_city_and_professional_interests_e0ba2f1,
            ),
            value: settings.personalizedRecommendations,
            onChanged: settings.setPersonalizedRecommendations,
          ),
          SwitchListTile.adaptive(
            contentPadding: const EdgeInsets.symmetric(horizontal: 15),
            secondary: const HopeIconTile(Icons.bedtime_outlined),
            title: Text(
              HopeCopy.of(context).copy_quiet_hours_02885b4,
            ),
            subtitle: Text(
              HopeCopy.of(context).copy_limit_notifications_during_rest_b5e0db3,
            ),
            value: settings.quietHours,
            onChanged: settings.setQuietHours,
          ),
          SwitchListTile.adaptive(
            contentPadding: const EdgeInsets.symmetric(horizontal: 15),
            secondary: const HopeIconTile(Icons.view_agenda_outlined),
            title: Text(
              HopeCopy.of(context).copy_compact_cards_71ed24c,
            ),
            subtitle: Text(
              HopeCopy.of(context).copy_fit_more_information_on_a_page_aedc497,
            ),
            value: settings.compactCards,
            onChanged: settings.setCompactCards,
          ),
          const Divider(height: 1),
          ListTile(
            leading: const HopeIconTile(Icons.info_outline_rounded),
            title: Text(
              HopeCopy.of(context).copy_about_hope_f8ee86b,
            ),
            subtitle: Text(
              HopeCopy.of(context).copy_mission_jobs_fees_and_privacy_a947037,
            ),
            onTap: () => Navigator.push(context, HopeRoutes.about()),
          ),
        ],
      ),
    );
  }

  String _themeLabel(BuildContext context, ThemeMode mode) {
    return switch (mode) {
      ThemeMode.dark => HopeCopy.of(context).copy_dark_c5832d8,
      ThemeMode.light => HopeCopy.of(context).copy_light_096ac39,
      _ => HopeCopy.of(context).copy_use_system_setting_a8649f8,
    };
  }

  Future<void> _pickTheme(
    BuildContext context,
    HopeSettingsController settings,
    ThemeController theme,
  ) async {
    final value = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            title: Text(
              HopeCopy.of(context).copy_use_system_setting_a8649f8,
            ),
            onTap: () => Navigator.pop(context, 'system'),
          ),
          ListTile(
            title: Text(HopeCopy.of(context).copy_light_096ac39),
            onTap: () => Navigator.pop(context, 'light'),
          ),
          ListTile(
            title: Text(HopeCopy.of(context).copy_dark_c5832d8),
            onTap: () => Navigator.pop(context, 'dark'),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );

    if (value != null) {
      await theme.setMode(
        switch (value) {
          'dark' => ThemeMode.dark,
          'light' => ThemeMode.light,
          _ => ThemeMode.system,
        },
      );
    }
  }

  Future<void> _pickCity(
    BuildContext context,
    HopeSettingsController settings,
  ) async {
    final value = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => ListView(
        padding: const EdgeInsets.all(18),
        shrinkWrap: true,
        children: [
          Text(
            HopeCopy.of(context).copy_choose_your_preferred_city_c19f66a,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          ...HopeSettingsController.cities.map(
            (value) => ListTile(
              title: Text(value),
              trailing: value == settings.city
                  ? const Icon(Icons.check_rounded)
                  : null,
              onTap: () => Navigator.pop(context, value),
            ),
          ),
        ],
      ),
    );

    if (value != null) {
      await settings.setCity(value);
    }
  }
}
