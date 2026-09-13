import '../../core/marketplace/job.dart';

String normalizePersian(String input) {
  var s = input.toLowerCase();
  const letterMap = {
    'ي': 'ی',
    'ك': 'ک',
    'ة': 'ه',
    'ؤ': 'و',
    'إ': 'ا',
    'أ': 'ا',
    'آ': 'ا',
    'ۀ': 'ه'
  };
  letterMap.forEach((from, to) => s = s.replaceAll(from, to));
  s = s.replaceAll(RegExp(r'[\u064B-\u065F\u0670\u200f]'), ' ');
  s = s.replaceAll('\u200c', '');
  const digitMap = {
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };
  digitMap.forEach((from, to) => s = s.replaceAll(from, to));
  return s.replaceAll(RegExp(r'\s+'), ' ').trim();
}

List<HopeJob> filterJobs({
  required List<HopeJob> jobs,
  required String query,
  required String kind,
  required String visibility,
  required String activeCity,
  required String category,
}) {
  final q = normalizePersian(query.trim());
  return jobs.where((j) {
    final jobCity = j.city ?? 'آنلاین';
    final text = normalizePersian([j.title, j.description, j.city, j.category]
        .map((e) => '$e')
        .join(' '));
    final kindOk = kind == 'ALL' || j.kind == kind;
    final visOk = visibility == 'ALL' || j.visibility == visibility;
    final cityOk =
        activeCity == 'همه' || jobCity == activeCity || jobCity == 'آنلاین';
    // The category picker hands back a category *slug* (see
    // `_pickCategory` in jobs_page.dart), while a job's `category` field is
    // the already-localized display name (see `categoryView()` on the
    // server). Comparing the slug against the display name never matched,
    // so every non-"ALL" category silently emptied the list. `categoryId`
    // is the raw value the client sent at job-creation time, which for
    // this app is always the slug -- match on that first, and fall back to
    // matching the display name too, in case a job was created through a
    // different path where categoryId is a real id and `category` happens
    // to equal the filter value.
    final categoryOk =
        category == 'ALL' || j.categoryId == category || j.category == category;
    return kindOk &&
        visOk &&
        cityOk &&
        categoryOk &&
        (q.isEmpty || text.contains(q));
  }).toList();
}
