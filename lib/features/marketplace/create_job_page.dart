import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/marketplace/category.dart';
import '../../core/application/application_registry.dart';
import '../../core/application/application_registry_context.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/settings/settings_controller.dart';
import '../../core/ui/components.dart';
import '../../core/ui/hope_l10n.dart';
import 'create_job_payload.dart';

import '../../core/theme/app_theme.dart';

part 'create_job_widgets.part.dart';

ApplicationRegistry _applicationRegistry(BuildContext context) => applicationRegistryOf(context);

class CreateJobPage extends StatefulWidget {
  const CreateJobPage({super.key});

  @override
  State<CreateJobPage> createState() => _CreateJobPageState();
}

class _CreateJobPageState extends State<CreateJobPage> {
  final title = TextEditingController();
  final desc = TextEditingController();
  final min = TextEditingController();
  final max = TextEditingController();
  final duration = TextEditingController(text: '8');
  final salary = TextEditingController();
  final deadline = TextEditingController();
  final accept = TextEditingController();

  bool busy = false;
  String kind = 'MISSION';
  String visibility = 'PUBLIC';
  String schedule = 'FULL_TIME';
  String city = '';
  String? categoryId;

  late Future<List<HopeCategory>> _categoriesFuture;

  @override
  void initState() {
    super.initState();
    city = context.read<HopeSettingsController>().city;
    _categoriesFuture = _loadCategories();
  }

  Future<List<HopeCategory>> _loadCategories() =>
      _applicationRegistry(context).listCategories();

  @override
  void dispose() {
    for (final controller in [
      title,
      desc,
      min,
      max,
      duration,
      salary,
      deadline,
      accept,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    final effectiveMin = kind == 'JOB' ? salary.text : min.text;
    final effectiveMax = kind == 'JOB' ? salary.text : max.text;
    final selectedCategory = categoryId;
    if (selectedCategory == null || selectedCategory.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(HopeCopy.of(context)
              .copy_choose_a_professional_category_b4cf5b8)));
      return;
    }
    final input = CreateJobPayloadInput(
      title: title.text,
      description: desc.text,
      categoryId: selectedCategory,
      minBudget: effectiveMin,
      maxBudget: effectiveMax,
      duration: duration.text,
      acceptanceCriteria: accept.text,
      city: city.isEmpty ? context.read<HopeSettingsController>().city : city,
      kind: kind,
      visibility: visibility,
      schedule: schedule,
      monthlySalary: salary.text,
      applicationDeadline: deadline.text,
    );
    final validation = validateCreateOpportunity(
      input: input,
      defaultAcceptanceCriteria:
          HopeCopy.of(context).copy_as_described_in_the_opportunity_836cb3e,
    );
    if (!validation.isValid) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(validation.error!)));
      return;
    }
    if (kind == 'JOB' && deadline.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(HopeCopy.of(context)
              .copy_set_an_application_deadline_for_jobs_5fd80f8)));
      return;
    }
    setState(() => busy = true);
    try {
      final body = buildCreateOpportunityPayload(CreateJobPayloadInput(
        title: title.text,
        description: desc.text,
        categoryId: selectedCategory,
        minBudget: effectiveMin,
        maxBudget: effectiveMax,
        duration: duration.text,
        acceptanceCriteria: accept.text.trim().isEmpty
            ? HopeCopy.of(context).copy_as_described_in_the_opportunity_836cb3e
            : accept.text,
        city: city.isEmpty ? context.read<HopeSettingsController>().city : city,
        kind: kind,
        visibility: visibility,
        schedule: schedule,
        monthlySalary: salary.text,
        applicationDeadline: deadline.text,
      ));
      final useCase = _applicationRegistry(context).createOpportunity;
      final created = await useCase(body);
      await useCase.publish(created.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text(HopeCopy.of(context).copy_opportunity_published_81a9fd1)));
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(apiErrorMessage(error,
              fallback: HopeCopy.of(context)
                  .copy_the_server_did_not_return_data_try_again_bccfbb3))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEn = Localizations.localeOf(context).languageCode == 'en';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          HopeCopy.of(context).copy_post_a_new_opportunity_f7fe3d9,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 40),
        children: [
          _TypeHero(
            kind: kind,
            onChanged: (value) => setState(() => kind = value),
          ),
          const SizedBox(height: 18),
          SectionTitle(
            title: HopeCopy.of(context).copy_audience_visibility_5a0ddcb,
            subtitle:
                HopeCopy.of(context).copy_make_it_public_or_specialized_e890215,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _VisibilityCard(
                  icon: Icons.public_rounded,
                  title: HopeCopy.of(context).copy_public_21e97be,
                  sub: HopeCopy.of(context).copy_for_everyone_ebc769c,
                  value: 'PUBLIC',
                  selected: visibility == 'PUBLIC',
                  onSelected: (v) => setState(() => visibility = v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _VisibilityCard(
                  icon: Icons.auto_awesome_rounded,
                  title: HopeCopy.of(context).copy_specialized_5d1ca04,
                  sub: HopeCopy.of(context).copy_for_a_specific_field_9b79bd6,
                  value: 'SPECIALIZED',
                  selected: visibility == 'SPECIALIZED',
                  onSelected: (v) => setState(() => visibility = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          HopeSurface(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: title,
                  decoration: InputDecoration(
                    labelText: HopeCopy.of(context).copy_title_d4694a2,
                    prefixIcon: const Icon(Icons.title_rounded),
                  ),
                ),
                const SizedBox(height: 11),
                TextField(
                  controller: desc,
                  maxLines: 5,
                  decoration: InputDecoration(
                    labelText:
                        HopeCopy.of(context).copy_full_description_c4dea43,
                    alignLabelWithHint: true,
                    prefixIcon: const Icon(Icons.notes_rounded),
                  ),
                ),
                const SizedBox(height: 11),
                FutureBuilder<List<HopeCategory>>(
                  future: _categoriesFuture,
                  builder: (context, snapshot) {
                    final categories = snapshot.data ?? const <HopeCategory>[];
                    return DropdownButtonFormField<String>(
                      initialValue: categoryId,
                      decoration: InputDecoration(
                        labelText: HopeCopy.of(context)
                            .copy_professional_category_a8c7c42,
                        hintText:
                            HopeCopy.of(context).copy_choose_a_category_b77d860,
                        prefixIcon: const Icon(Icons.category_outlined),
                      ),
                      items: categories.map((category) {
                        final depth = category.parentId == null ? 0 : 1;
                        return DropdownMenuItem<String>(
                          value: category.slug,
                          child: Text(
                            '${depth == 0 ? '' : '  ↳ '}${category.label(isEn)}',
                          ),
                        );
                      }).toList(),
                      onChanged: (value) => setState(() => categoryId = value),
                    );
                  },
                ),
                const SizedBox(height: 11),
                DropdownButtonFormField<String>(
                  initialValue: city,
                  decoration: InputDecoration(
                    labelText: HopeCopy.of(context).copy_city_3d7dc3e,
                    prefixIcon: const Icon(Icons.location_on_outlined),
                  ),
                  items: [
                    ...HopeSettingsController.cities.map(
                      (value) => DropdownMenuItem<String>(
                        value: value,
                        child: Text(value),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() => city = value ?? city),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          SectionTitle(
            title: kind == 'MISSION'
                ? HopeCopy.of(context).copy_price_time_4d31a36
                : HopeCopy.of(context).copy_salary_schedule_bab0cb3,
            subtitle: kind == 'MISSION'
                ? HopeCopy.of(context)
                    .copy_set_a_defined_price_and_delivery_time_1e53f1a
                : HopeCopy.of(context)
                    .copy_the_first_month_salary_determines_hope_s_j_ca73bd3,
          ),
          const SizedBox(height: 10),
          if (kind == 'MISSION')
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: min,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: HopeCopy.of(context).copy_minimum_pay_38cc5ec,
                      prefixIcon: const Icon(Icons.payments_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: max,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: HopeCopy.of(context).copy_maximum_pay_b51ad57,
                      prefixIcon:
                          const Icon(Icons.account_balance_wallet_outlined),
                    ),
                  ),
                ),
              ],
            )
          else
            TextField(
              controller: salary,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: HopeCopy.of(context).copy_monthly_salary_1d770dc,
                prefixIcon: const Icon(Icons.payments_rounded),
              ),
            ),
          const SizedBox(height: 11),
          if (kind == 'MISSION')
            TextField(
              controller: duration,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: HopeCopy.of(context).copy_duration_hours_f4ca1cf,
                prefixIcon: const Icon(Icons.schedule_rounded),
              ),
            )
          else
            Column(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: schedule,
                  decoration: InputDecoration(
                    labelText: HopeCopy.of(context).copy_schedule_3af1939,
                    prefixIcon: const Icon(Icons.timelapse_rounded),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: 'PART_TIME',
                      child: Text(
                        HopeCopy.of(context).copy_part_time_086787b,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'FULL_TIME',
                      child: Text(
                        HopeCopy.of(context).copy_full_time_1e4bd4e,
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      setState(() => schedule = value ?? schedule),
                ),
                const SizedBox(height: 11),
                TextField(
                  controller: deadline,
                  decoration: InputDecoration(
                    labelText:
                        HopeCopy.of(context).copy_application_deadline_782fb61,
                    hintText: '2026-09-30',
                    prefixIcon: const Icon(Icons.event_outlined),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 20),
          HopeSurface(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  HopeCopy.of(context).copy_hope_fee_2ea514e,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  kind == 'MISSION'
                      ? HopeCopy.of(context)
                          .copy_10_from_the_employer_and_10_from_the_candi_cf15dfa
                      : HopeCopy.of(context)
                          .copy_30_of_the_candidate_s_first_month_pay_is_c_d6da53b,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          TextField(
            controller: accept,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: HopeCopy.of(context)
                  .copy_acceptance_selection_criteria_a061aef,
              alignLabelWithHint: true,
              prefixIcon: const Icon(Icons.fact_check_outlined),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: busy ? null : submit,
            icon: const Icon(Icons.rocket_launch_rounded),
            label: busy
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    HopeCopy.of(context).copy_publish_opportunity_9993b91,
                  ),
          ),
        ],
      ),
    );
  }
}
