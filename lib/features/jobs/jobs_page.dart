import 'package:flutter/material.dart';
import '../../core/ui/hope_l10n.dart';
import 'package:provider/provider.dart';
import '../../core/application/application_registry.dart';
import '../../core/application/application_registry_context.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/router/app_routes.dart';
import '../../core/settings/settings_controller.dart';
import '../../core/marketplace/category.dart';
import '../../core/marketplace/job.dart';
import '../../core/marketplace/saved_search_repository.dart';
import '../../core/ui/components.dart';
import '../../core/ui/premium_components.dart';
import '../../core/theme/hope_v2_design.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/copy.dart';
import 'jobs_query_logic.dart';

part 'jobs_widgets.part.dart';
part 'jobs_filter_bar.part.dart';

ApplicationRegistry _applicationRegistry(BuildContext context) => applicationRegistryOf(context);

class JobsPage extends StatefulWidget {
  const JobsPage({super.key});
  @override
  State<JobsPage> createState() => _JobsPageState();
}

class _JobsPageState extends State<JobsPage> {
  late Future<List<HopeJob>> _future;
  String _query = '';
  String _kind = 'ALL';
  String _visibility = 'ALL';
  String _city = 'AUTO';
  String _category = 'ALL';
  List<HopeCategory> _categories = const [];
  List<HopeSavedSearch> _savedSearches = const [];
  String? _categoryError;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_categoriesFutureInitialized) return;
    _categoriesFutureInitialized = true;
    _loadCategories();
    _loadSavedSearches();
  }

  bool _categoriesFutureInitialized = false;
  Future<List<HopeCategory>> _loadCategories() async {
    try {
      final parsed =
          await _applicationRegistry(context).listCategories();
      if (mounted) {
        setState(() => _categories = parsed);
      }
      return parsed;
    } catch (error) {
      if (mounted) {
        setState(() => _categoryError =
            apiErrorMessage(error, fallback: 'دسته‌بندی‌ها بارگذاری نشدند.'));
      }
      return const [];
    }
  }

  @override
  void initState() {
    super.initState();
    _future = _loadOpportunities();
  }


  Future<void> _loadSavedSearches() async {
    try {
      final items = await _applicationRegistry(context).savedSearches.list();
      if (mounted) setState(() => _savedSearches = items);
    } catch (_) {
      if (mounted) setState(() => _savedSearches = const []);
    }
  }

  String _savedSearchName() {
    final parts = <String>[];
    if (_query.trim().isNotEmpty) parts.add(_query.trim());
    if (_kind != 'ALL') parts.add(_kind);
    if (_visibility != 'ALL') parts.add(_visibility);
    if (_category != 'ALL') parts.add(_category);
    if (_city != 'AUTO') parts.add(_city);
    return parts.isEmpty ? (Localizations.localeOf(context).languageCode == 'en' ? 'All opportunities' : 'همه فرصت‌ها') : parts.join(' • ');
  }

  Future<void> _saveCurrentSearch() async {
    final locale = Localizations.localeOf(context).languageCode;
    final controller = TextEditingController(text: _savedSearchName());
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(locale == 'en' ? 'Save search' : 'ذخیره جست‌وجو'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 60,
          decoration: InputDecoration(hintText: locale == 'en' ? 'Search name' : 'نام جست‌وجو'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(locale == 'en' ? 'Cancel' : 'لغو')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: Text(locale == 'en' ? 'Save' : 'ذخیره')),
        ],
      ),
    );
    controller.dispose();
    if (!mounted || name == null || name.isEmpty) return;
    final now = DateTime.now().toUtc().toIso8601String();
    final saved = HopeSavedSearch(id: 'search-${now.hashCode.abs()}', name: name, query: _query, kind: _kind, visibility: _visibility, city: _city, category: _category, updatedAt: now);
    await _applicationRegistry(context).savedSearches.upsert(saved);
    await _loadSavedSearches();
  }

  Future<void> _openSavedSearches() async {
    if (_savedSearches.isEmpty) return;
    final selected = await showModalBottomSheet<HopeSavedSearch>(
      context: context,
      showDragHandle: true,
      builder: (context) => ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        shrinkWrap: true,
        itemCount: _savedSearches.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final item = _savedSearches[index];
          return ListTile(
            title: Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text([item.query, item.kind == 'ALL' ? '' : item.kind, item.visibility == 'ALL' ? '' : item.visibility].where((value) => value.isNotEmpty).join(' • ')),
            onTap: () => Navigator.pop(context, item),
            trailing: IconButton(
              tooltip: Localizations.localeOf(context).languageCode == 'en' ? 'Delete' : 'حذف',
              onPressed: () async {
                await _applicationRegistry(context).savedSearches.delete(item.id);
                if (context.mounted) Navigator.pop(context);
                await _loadSavedSearches();
              },
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          );
        },
      ),
    );
    if (!mounted || selected == null) return;
    setState(() {
      _query = selected.query;
      _kind = selected.kind;
      _visibility = selected.visibility;
      _city = selected.city;
      _category = selected.category;
      _future = _loadOpportunities();
    });
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    final next = _loadOpportunities();
    setState(() => _future = next);
    await next.catchError((_) => const <HopeJob>[]);
  }

  Future<List<HopeJob>> _loadOpportunities() =>
      _loadOpportunitiesForCity(_city, context.read<HopeSettingsController>());

  Future<List<HopeJob>> _loadOpportunitiesForCity(
      String city, HopeSettingsController settings) {
    // 'AUTO' resolves to the user's own city; 'همه' means "no specific
    // city" (used below for both request paths).
    final String? selectedCity =
        city == 'AUTO' ? settings.city : (city == 'همه' ? null : city);
    // `_filter`/`filterJobs` already narrows the plain (non-personalized)
    // listing by city on the client -- and that's also where jobs with no
    // city ("آنلاین"/online) are deliberately kept visible regardless of
    // which city is selected. The server's `/jobs` filter, by contrast, is
    // an *exact* match with no such carve-out: forwarding `city` there
    // would silently drop every online job whenever a specific city is
    // picked, and drop every job outright for "همه" (no job's city equals
    // that literal string). So `city` is only forwarded to
    // `/jobs/recommended`, where it feeds distance/location scoring rather
    // than acting as a hard filter.
    return _applicationRegistry(context).listOpportunities(
          city: settings.personalizedRecommendations ? selectedCity : null,
          personalizedRecommendations: settings.personalizedRecommendations,
          latitude: settings.locationEnabled ? settings.latitude : null,
          longitude: settings.locationEnabled ? settings.longitude : null,
          search: _query,
          kind: _kind,
          visibility: _visibility,
          categoryId: _category,
        );
  }

  /// Resolves the currently selected category slug (`_category`) back to a
  /// localized display label. `_category` has to stay a plain slug because
  /// that's what `filterJobs` matches against the job data, but showing the
  /// raw slug (e.g. "software-development") to the user was itself a bug --
  /// this looks the slug up in the loaded category list instead.
  String _categoryLabel(BuildContext context) {
    if (_category == 'ALL') {
      return HopeCopy.of(context).copy_all_fields_4f77401;
    }
    final isEn = Localizations.localeOf(context).languageCode == 'en';
    for (final c in _categories) {
      if (c.slug == _category) return c.label(isEn);
    }
    return _category;
  }

  List<HopeJob> _filter(List<HopeJob> jobs) {
    final settings = context.read<HopeSettingsController>();
    final activeCity = _city == 'AUTO' ? settings.city : _city;
    return filterJobs(
      jobs: jobs,
      query: _query,
      kind: _kind,
      visibility: _visibility,
      activeCity: activeCity,
      category: _category,
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<HopeSettingsController>();
    return Material(
        color: Colors.transparent,
        child: RefreshIndicator(
            onRefresh: _refresh,
            child: FutureBuilder<List<HopeJob>>(
                future: _future,
                builder: (context, snapshot) {
                  final jobs = _filter(snapshot.data ?? const <HopeJob>[]);
                  return CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: [
                        SliverPadding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                            sliver: SliverToBoxAdapter(
                                child: _JobsFilterHeader(
                              kind: _kind,
                              visibility: _visibility,
                              categoryError: _categoryError,
                              cityLabel: _city == 'AUTO'
                                  ? '${HopeCopy.of(context).copy_near_1df6db0} ${settings.city}'
                                  : _city,
                              categoryLabel: _categoryLabel(context),
                              resultCount: jobs.length,
                              onQueryChanged: (v) {
                                setState(() => _query = v);
                              },
                              onKindChanged: (v) => setState(() => _kind = v),
                              onVisibilityChanged: (v) =>
                                  setState(() => _visibility = v),
                              onRetryCategories: () {
                                setState(() {
                                  _categoryError = null;
                                  _loadCategories();
                                });
                              },
                              onPickCity: () => _pickCity(context, settings),
                              onPickCategory: () => _pickCategory(context),
                              savedSearchCount: _savedSearches.length,
                              onSaveSearch: _saveCurrentSearch,
                              onOpenSavedSearches: _openSavedSearches,
                            ))),
                        if (snapshot.connectionState == ConnectionState.waiting)
                          SliverPadding(
                              padding:
                                  const EdgeInsets.fromLTRB(20, 0, 20, 122),
                              sliver: SliverList(
                                  delegate: SliverChildListDelegate([
                                const OpportunitySkeletonCard(),
                                const SizedBox(height: 12),
                                const OpportunitySkeletonCard()
                              ])))
                        else if (snapshot.hasError)
                          SliverFillRemaining(
                              hasScrollBody: false,
                              child: EmptyState(
                                  icon: Icons.cloud_off_rounded,
                                  title: HopeCopy.of(context)
                                      .copy_connection_failed_1b34bc9,
                                  message: HopeCopy.of(context)
                                      .copy_the_server_did_not_return_data_try_again_bccfbb3))
                        else if (jobs.isEmpty)
                          SliverFillRemaining(
                              hasScrollBody: false,
                              child: EmptyState(
                                  icon: Icons.search_off_rounded,
                                  title: HopeCopy.of(context)
                                      .copy_no_matching_opportunity_d85e775,
                                  message: HopeCopy.of(context)
                                      .copy_broaden_your_filters_or_try_another_city_e8e32cb))
                        else
                          SliverPadding(
                              padding:
                                  const EdgeInsets.fromLTRB(20, 0, 20, 122),
                              sliver: SliverList(
                                  delegate: SliverChildBuilderDelegate(
                                      (context, index) => Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 12),
                                          child: AnimatedEntrance(
                                              delay: Duration(
                                                  milliseconds:
                                                      35 * index.clamp(0, 10)),
                                              child:
                                                  _JobCard(job: jobs[index]))),
                                      childCount: jobs.length))),
                      ]);
                })));
  }

  Future<void> _pickCity(
      BuildContext context, HopeSettingsController settings) async {
    final c = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => ListView(
        padding: const EdgeInsets.all(20),
        shrinkWrap: true,
        children: [
          Text(HopeCopy.of(context).copy_choose_a_city_a93b334,
              style: Theme.of(context).textTheme.headlineSmall),
          ...[...HopeSettingsController.cities, 'همه'].map((city) => ListTile(
                title: Text(city),
                trailing: (_city == city ||
                        (_city == 'AUTO' && city == settings.city))
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () => Navigator.pop(context, city),
              )),
        ],
      ),
    );
    if (c == null || !mounted) return;
    final nextCity = c == settings.city ? 'AUTO' : c;
    final nextFuture = _loadOpportunitiesForCity(nextCity, settings);
    setState(() {
      _city = nextCity;
      _future = nextFuture;
    });
    await nextFuture.catchError((_) => const <HopeJob>[]);
  }

  Future<void> _pickCategory(BuildContext context) async {
    final categories = _categories;
    final c = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (_) => ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.all(20),
                children: [
                  Text(HopeCopy.of(context).copy_professional_field_4c6b94e,
                      style: Theme.of(context).textTheme.headlineSmall),
                  ListTile(
                      title: Text(HopeCopy.of(context).copy_all_fields_4f77401),
                      onTap: () => Navigator.pop(context, 'ALL')),
                  ...categories.map((x) => ListTile(
                      title: Text(x.label(
                          Localizations.localeOf(context).languageCode ==
                              'en')),
                      subtitle:
                          x.description.isEmpty ? null : Text(x.description),
                      onTap: () => Navigator.pop(context, x.slug)))
                ]));
    if (c != null && mounted) setState(() => _category = c);
  }
}
