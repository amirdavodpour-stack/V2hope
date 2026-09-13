import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_fa.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('fa')
  ];

  /// Accessibility tooltip on back-navigation icon buttons across the app.
  ///
  /// In fa, this message translates to:
  /// **'بازگشت'**
  String get backButtonTooltip;

  /// Headline shown on the login page.
  ///
  /// In fa, this message translates to:
  /// **'خوش برگشتی.'**
  String get loginWelcomeBack;

  /// Subtitle shown under the login page headline.
  ///
  /// In fa, this message translates to:
  /// **'به فضای کارت برگرد و ادامه بده.'**
  String get loginWelcomeBackSubtitle;

  /// Label for the email text field, reused across auth pages.
  ///
  /// In fa, this message translates to:
  /// **'ایمیل'**
  String get emailLabel;

  /// Label for the password text field, reused across auth pages.
  ///
  /// In fa, this message translates to:
  /// **'رمز عبور'**
  String get passwordLabel;

  /// Tooltip on the password-visibility toggle when the password is currently hidden.
  ///
  /// In fa, this message translates to:
  /// **'نمایش رمز عبور'**
  String get showPasswordTooltip;

  /// Tooltip on the password-visibility toggle when the password is currently visible.
  ///
  /// In fa, this message translates to:
  /// **'پنهان کردن رمز عبور'**
  String get hidePasswordTooltip;

  /// Link to the password-reset page from the login page.
  ///
  /// In fa, this message translates to:
  /// **'رمز عبورت را فراموش کردی؟'**
  String get forgotPassword;

  /// Primary submit button on the login page.
  ///
  /// In fa, this message translates to:
  /// **'ورود به HOPE'**
  String get loginButton;

  /// Button to skip login and browse as a guest.
  ///
  /// In fa, this message translates to:
  /// **'فعلاً به‌عنوان مهمان ادامه بده'**
  String get continueAsGuest;

  /// Divider text between the login form and the sign-up link.
  ///
  /// In fa, this message translates to:
  /// **'یا'**
  String get orDivider;

  /// Link to the registration page from the login page.
  ///
  /// In fa, this message translates to:
  /// **'حساب نداری؟ ساخت حساب'**
  String get noAccountSignUp;

  /// Fine-print notice at the bottom of the login page.
  ///
  /// In fa, this message translates to:
  /// **'ورود به معنای پذیرش قوانین استفاده HOPE است.'**
  String get loginTermsNotice;

  /// Validation message shown when the user submits the login form with an empty email or password.
  ///
  /// In fa, this message translates to:
  /// **'ایمیل و رمز عبور را وارد کن.'**
  String get emailPasswordRequired;

  /// Fallback error message shown when login fails without a more specific server-provided message.
  ///
  /// In fa, this message translates to:
  /// **'ورود ناموفق بود. دوباره تلاش کن.'**
  String get loginFailedGeneric;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'۱۰٪ از کارفرما و ۱۰٪ از کارجو؛ مبلغ کارمزد در صفحه معامله شفاف نمایش داده می‌شود.'**
  String get copy_10_from_the_employer_and_10_from_the_candi_cf15dfa;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'۳۰٪ از دستمزد ماه اول کارجو از سمت کارفرما دریافت می‌شود.'**
  String get copy_30_of_the_candidate_s_first_month_pay_is_c_d6da53b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مسیر بهتر برای پیدا کردن کار'**
  String get copy_a_better_path_to_finding_work_5802652;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اینجا قرار است پیدا کردن کار، واضح‌تر و انسانی‌تر باشد.'**
  String get copy_a_clearer_more_human_way_to_find_work_3553ab8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'یک کار مشخص، با مبلغ مشخص و مسیر تحویل روشن.'**
  String get copy_a_defined_task_with_a_clear_price_and_deli_bf299f3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'یک کار مشخص با مبلغ مشخص'**
  String get copy_a_defined_task_with_defined_pay_77b1068;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'یک خانه برای مسیر حرفه‌ای تو.'**
  String get copy_a_home_for_your_professional_path_52dbb09;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همکاری پاره‌وقت یا تمام‌وقت با دستمزد ماهانه.'**
  String get copy_a_part_time_or_full_time_role_with_monthly_ac5f029;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درباره HOPE'**
  String get copy_about_hope_f8ee86b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تأیید تحویل'**
  String get copy_accept_delivery_195e8bd;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'معیار پذیرش'**
  String get copy_acceptance_criteria_f213cb2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'معیار پذیرش / شرایط انتخاب'**
  String get copy_acceptance_selection_criteria_a061aef;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فعال‌سازی'**
  String get copy_activate_2215693;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فعال'**
  String get copy_active_5726b26;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حساب فعال'**
  String get copy_active_account_bef80da;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فعالیت'**
  String get copy_activity_4b38716;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'رزومه متنی و مهارت‌های مرتبط را وارد کن.'**
  String get copy_add_a_concise_resume_and_relevant_skills_298a4f1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مدیریت ادمین'**
  String get copy_admin_panel_348cd94;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ادمین می‌تواند فرصت‌های نامناسب یا ناسازگار با قوانین HOPE را حذف کند.'**
  String get copy_admins_can_remove_opportunities_that_viola_82df522;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همه'**
  String get copy_all_ba7d5b6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همه حوزه‌ها'**
  String get copy_all_fields_4f77401;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ'**
  String get copy_amount_6400812;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نامزد بدون اطلاعات هویتی'**
  String get copy_anonymous_candidate_ba01a0d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'زبان برنامه'**
  String get copy_app_language_789c9c4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ظاهر برنامه'**
  String get copy_appearance_c90f540;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مهلت درخواست'**
  String get copy_application_deadline_0a6c25c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مهلت دریافت درخواست'**
  String get copy_application_deadline_782fb61;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست‌ها'**
  String get copy_applications_6655869;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهاد بده'**
  String get copy_apply_1b61105;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست برای این شغل'**
  String get copy_apply_for_this_job_3a75a03;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست برای این شغل'**
  String get copy_apply_to_this_job_923b353;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'با رزومه و پیشنهاد حرفه‌ای وارد شو.'**
  String get copy_apply_with_a_strong_professional_profile_13980b1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مطابق شرح فرصت و توافق طرفین.'**
  String get copy_as_described_in_the_opportunity_836cb3e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حداقل ۸ کاراکتر'**
  String get copy_at_least_8_characters_eb24592;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مخاطب و دیده‌شدن'**
  String get copy_audience_visibility_5a0ddcb;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'رویدادهای ثبت‌شده'**
  String get copy_audit_events_7f47fd5;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'گزارش فعالیت'**
  String get copy_audit_log_ff87181;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بازگشت'**
  String get copy_back_6e09f79;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ پایه'**
  String get copy_base_amount_82586c0;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'با توجه به شهر و علایق حرفه‌ای'**
  String get copy_based_on_city_and_professional_interests_e0ba2f1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بر اساس شهر انتخابی و ترجیحاتت'**
  String get copy_based_on_your_city_and_preferences_79e2a31;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فیلترها را کمی بازتر کن یا شهر دیگری را امتحان کن.'**
  String get copy_broaden_your_filters_or_try_another_city_e8e32cb;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انصراف'**
  String get copy_cancel_9955c4b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارجو'**
  String get copy_candidate_c67d7bf;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اطلاعات هویتی کارجو برای جلوگیری از تبانی در مرحله انتخاب مخفی می‌ماند.'**
  String get copy_candidate_identity_stays_hidden_during_sel_6a73883;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتخاب کن'**
  String get copy_choose_79a9d79;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دسته‌بندی را انتخاب کن'**
  String get copy_choose_a_category_b77d860;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شهر را انتخاب کن'**
  String get copy_choose_a_city_a93b334;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حوزه تخصصی را انتخاب کن.'**
  String get copy_choose_a_professional_category_b4cf5b8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتخاب شهر دیگر'**
  String get copy_choose_another_city_1375095;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شهر مورد نظر را انتخاب کن'**
  String get copy_choose_your_preferred_city_c19f66a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شهر'**
  String get copy_city_3d7dc3e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارت‌های فشرده'**
  String get copy_compact_cards_71ed24c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تمام شد'**
  String get copy_completed_4ab501b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اتصال برقرار نشد'**
  String get copy_connection_failed_1b34bc9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کنترل مرکزی'**
  String get copy_control_center_15e20c8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'چیزهایی که تجربه HOPE را برای تو دقیق‌تر می‌کنند.'**
  String get copy_controls_that_make_hope_fit_you_better_ace4c0c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دریافت فعالیت ناموفق بود'**
  String get copy_could_not_load_activity_335b923;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دریافت اعلان‌ها ممکن نشد.'**
  String get copy_could_not_load_notifications_a904a88;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت مدرک انجام نشد.'**
  String get copy_could_not_submit_evidence_9d09019;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'یک حساب HOPE بساز و قدم اول را بردار.'**
  String get copy_create_a_hope_account_and_take_the_first_s_9ccd119;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ساخت حساب'**
  String get copy_create_account_bfa3517;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای پیشنهاد دادن یا ثبت فرصت، یک حساب بساز یا وارد حساب خودت شو.'**
  String get copy_create_an_account_or_log_in_to_post_opport_6bc74a1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حساب بساز تا پیشنهاد بدهی، فرصت ثبت کنی و تنظیمات شخصی داشته باشی.'**
  String get copy_create_an_account_to_apply_post_and_person_6fd6b91;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'موقعیت فعلی'**
  String get copy_current_location_182622a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تاریک'**
  String get copy_dark_c5832d8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مهلت'**
  String get copy_deadline_ffa13f2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ماموریت می‌خواهی یا شغل.'**
  String get copy_decide_whether_you_want_a_mission_or_a_job_3a6f9b5;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارهای مشخص با مبلغ مشخص'**
  String get copy_defined_tasks_with_clear_pay_9120d5e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حذف'**
  String get copy_delete_b17eb9d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تحویل کار'**
  String get copy_deliver_work_49b9e5e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'غیرفعال‌کردن'**
  String get copy_disable_73bea34;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مدت انجام'**
  String get copy_duration_cc42be6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مدت (ساعت)'**
  String get copy_duration_hours_f4ca1cf;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ایمیل'**
  String get copy_email_0cc870e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ پرداختی کارفرما'**
  String get copy_employer_charge_9740283;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارمزد کارفرما'**
  String get copy_employer_fee_3a30b60;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انگلیسی'**
  String get copy_english_8396fe3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ایمیل حساب را وارد کن؛ راهنمای بازیابی برایت ارسال می‌شود.'**
  String get copy_enter_your_account_email_and_we_will_start_16caa6e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ایمیل را وارد کن.'**
  String get copy_enter_your_email_2562106;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاوش'**
  String get copy_explore_115e9fd;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیدا کن'**
  String get copy_explore_837e4eb;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شروع کاوش'**
  String get copy_explore_a80d678;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاوش ماموریت‌ها و شغل‌ها'**
  String get copy_explore_missions_jobs_3846ebd;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حوزه'**
  String get copy_field_fcb7b26;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شهر، حوزه و نوع فرصت را فیلتر کن.'**
  String get copy_filter_by_city_field_and_opportunity_type_1d75340;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فیلترها'**
  String get copy_filters_df4d10e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جزئیات مالی'**
  String get copy_financial_details_f24007d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت مناسب را پیدا کن یا فرصتت را بساز.'**
  String get copy_find_the_right_opportunity_or_create_one_c8a9e6f;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اول مشخص کن دنبال چه نوع همکاری هستی.'**
  String get copy_first_choose_what_kind_of_opportunity_you__f035ca9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اطلاعات بیشتری در یک صفحه'**
  String get copy_fit_more_information_on_a_page_aedc497;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای حوزه مشخص'**
  String get copy_for_a_specific_field_9b79bd6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای همه کارجوها'**
  String get copy_for_everyone_ebc769c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'در فرایند انتخاب شغلی، ادمین فقط رزومه و اطلاعات حرفه‌ای لازم را برای کارفرما ارسال می‌کند.'**
  String get copy_for_jobs_admins_send_only_the_professional_e6e694e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای حفظ امنیت، حتی در صورت نبودن حساب هم پاسخ مشابهی دریافت می‌کنی.'**
  String get copy_for_security_the_response_is_intentionally_6574fa6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ارسال'**
  String get copy_forward_5ec70ea;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ارسال به کارفرما'**
  String get copy_forward_to_employer_0baa2e1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نامزدهای منتخب'**
  String get copy_forwarded_candidates_5de386c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شرح کامل'**
  String get copy_full_description_c4dea43;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نام و نام خانوادگی'**
  String get copy_full_name_c7448f1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تمام‌وقت'**
  String get copy_full_time_1e4bd4e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تأمین بودجه'**
  String get copy_fund_payment_c223336;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'سلام'**
  String get copy_hello_fc7ef4a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'استخدام'**
  String get copy_hire_36ed063;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'خانه'**
  String get copy_home_ce76258;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حساب HOPE'**
  String get copy_hope_account_4ba3966;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مرکز مدیریت HOPE'**
  String get copy_hope_admin_center_912aa06;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارمزد HOPE'**
  String get copy_hope_fee_2ea514e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دوست HOPE'**
  String get copy_hope_friend_b997e02;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مدل درآمدی HOPE'**
  String get copy_hope_revenue_model_8506ac2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ساعت'**
  String get copy_hours_7408608;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'در HOPE چه اتفاقی می‌افتد؟'**
  String get copy_how_hope_works_bea7074;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اگر حساب وجود داشته باشد، درخواست بازیابی ثبت شد.'**
  String get copy_if_the_account_exists_a_reset_request_has__b974d8e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'در جریان'**
  String get copy_in_progress_ed61091;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مصاحبه'**
  String get copy_interview_9734f37;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست‌های شغلی اینجا مدیریت می‌شوند.'**
  String get copy_job_applications_are_managed_here_1b21e96;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست‌های شغلی ابتدا نزد ادمین بررسی می‌شوند؛ کارفرما فقط رزومه و اطلاعات حرفه‌ای نامزدهای منتخب را می‌بیند، نه اطلاعات هویتی آن‌ها.'**
  String get copy_job_applications_are_reviewed_by_an_admin__5098e17;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شغل'**
  String get copy_job_ce2feba;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جزئیات شغل'**
  String get copy_job_details_e815855;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شغل‌ها'**
  String get copy_jobs_ebf9a80;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پروفایل، معاملات، فرصت‌های ثبت‌شده و ترجیحاتت یکجا قرار می‌گیرند.'**
  String get copy_keep_your_profile_opportunities_transactio_39f443d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'آخرین فعالیت‌ها'**
  String get copy_latest_activity_a05277b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'روشن'**
  String get copy_light_096ac39;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اعلان‌ها را در زمان استراحت محدود کن'**
  String get copy_limit_notifications_during_rest_b5e0db3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'موقعیت و شهر'**
  String get copy_location_city_46ccc39;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مکان فعال'**
  String get copy_location_on_dad416c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دسترسی مکان فعال نشد؛ می‌توانی شهر را دستی انتخاب کنی.'**
  String get copy_location_permission_was_not_enabled_you_ca_ba53b81;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'موقعیت مکانی روشن است؛ می‌توانی شهر را از تنظیمات عوض کنی.'**
  String get copy_location_personalization_is_on_you_can_cha_8dd12f4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ورود'**
  String get copy_log_in_b4c960b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'خروج از حساب'**
  String get copy_log_out_04a94c7;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت عمومی برای همه یا تخصصی برای یک حوزه مشخص.'**
  String get copy_make_it_public_or_specialized_e890215;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتخاب دستی'**
  String get copy_manual_selection_90510b2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همه را خواندم'**
  String get copy_mark_all_read_500a31c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حداکثر مبلغ'**
  String get copy_maximum_pay_b51ad57;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'منو'**
  String get copy_menu_1f381a4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیام'**
  String get copy_message_c821412;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حداقل مبلغ'**
  String get copy_minimum_pay_38cc5ec;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بودجه ماموریت'**
  String get copy_mission_budget_923bb6e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جزئیات ماموریت'**
  String get copy_mission_details_78d58d8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ماموریت'**
  String get copy_mission_fb4c5e1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ماموریت، شغل، مدل درآمد و حریم خصوصی'**
  String get copy_mission_jobs_fees_and_privacy_a947037;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ماموریت‌ها'**
  String get copy_missions_a833d13;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همه‌چیز را یکجا ببین و مدیریت کن.'**
  String get copy_monitor_and_manage_hope_in_one_place_bea3b7d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دستمزد ماهانه'**
  String get copy_monthly_pay_d62519b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دستمزد ماهانه'**
  String get copy_monthly_salary_1d770dc;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست‌های شغلی من'**
  String get copy_my_job_applications_90701f0;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اطراف'**
  String get copy_near_1df6db0;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهادهای تازه و وضعیت درخواست‌ها'**
  String get copy_new_opportunities_and_application_updates_d3e84aa;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'هنوز فعالیتی نیست'**
  String get copy_no_activity_yet_264ceb0;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواستی برای بررسی نیست'**
  String get copy_no_applications_0917e11;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت مناسب پیدا نشد'**
  String get copy_no_matching_opportunity_d85e775;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصتی نیست'**
  String get copy_no_opportunities_a112400;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بدون پرداخت'**
  String get copy_no_payment_1337b58;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'هنوز تکمیل نشده'**
  String get copy_not_completed_f8a6746;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اعلان‌ها'**
  String get copy_notifications_370b4a1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهاد شغلی'**
  String get copy_offer_cc3327c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهاد انجام ماموریت'**
  String get copy_offer_for_mission_ced8d4c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهاد انجام ماموریت'**
  String get copy_offer_for_this_mission_f50b00a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'قیمت پیشنهادی'**
  String get copy_offer_price_d8fc5f4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پرداخت یک‌باره'**
  String get copy_one_time_1d496d8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ورود به پنل مدیریت'**
  String get copy_open_admin_panel_39f3cb8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'آماده همکاری'**
  String get copy_open_to_work_aa59263;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'عملیات انجام شد.'**
  String get copy_operation_completed_66dd356;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'عملیات انجام نشد.'**
  String get copy_operation_failed_eb38c4c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت‌ها'**
  String get copy_opportunities_015066e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت‌ها اینجا ظاهر می‌شوند.'**
  String get copy_opportunities_appear_here_d85bef9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت‌ها همین اطراف هم منتظرند.'**
  String get copy_opportunities_may_already_be_nearby_585bbac;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت‌ها به آدم‌های درست می‌رسند.'**
  String get copy_opportunities_meet_the_right_people_d51fef5;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهادهای نزدیک به'**
  String get copy_opportunities_near_9da643a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت'**
  String get copy_opportunity_62cf572;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت با موفقیت منتشر شد.'**
  String get copy_opportunity_published_81a9fd1;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پاره‌وقت/تمام‌وقت'**
  String get copy_part_full_time_4d952a9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پاره‌وقت یا تمام‌وقت و ماهانه'**
  String get copy_part_full_time_with_monthly_pay_abd5afd;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پاره‌وقت'**
  String get copy_part_time_086787b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پاره‌وقت یا تمام‌وقت'**
  String get copy_part_time_or_full_time_a007875;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'رمز عبور'**
  String get copy_password_656eabe;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'رمز عبور باید حداقل ۸ کاراکتر باشد.'**
  String get copy_password_must_be_at_least_8_characters_8ad17c6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ پیشنهادی'**
  String get copy_pay_4121159;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'وجه تسویه شده است.'**
  String get copy_payment_has_been_settled_f8f8f83;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'وضعیت پرداخت'**
  String get copy_payment_status_e1b6f0c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'در انتظار بررسی'**
  String get copy_pending_86ad26d;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فارسی'**
  String get copy_persian_62775b3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تنظیمات شخصی'**
  String get copy_personal_settings_4ecc5fa;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهادهای شخصی‌سازی‌شده'**
  String get copy_personalized_recommendations_a4e4411;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'همه فیلدها را پر کن.'**
  String get copy_please_complete_all_fields_55c07bb;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت ماموریت یا شغل'**
  String get copy_post_a_mission_or_job_364fb6f;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت فرصت جدید'**
  String get copy_post_a_new_opportunity_f7fe3d9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت فرصت'**
  String get copy_post_opportunity_0389bce;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ و زمان'**
  String get copy_price_time_4d31a36;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حوزه تخصصی'**
  String get copy_professional_category_a8c7c42;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'حوزه تخصصی'**
  String get copy_professional_field_4c6b94e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فضای حرفه‌ای، ترجیحات و امنیت حساب'**
  String get copy_professional_identity_preferences_and_acco_7f164ce;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاربر حرفه‌ای'**
  String get copy_professional_user_54818b8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پروفایل'**
  String get copy_profile_8b081d3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پروژه‌ها، وضعیت و پرداخت‌ها در یک نگاه.'**
  String get copy_projects_progress_and_payments_at_a_glance_a0178c8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'عمومی'**
  String get copy_public_21e97be;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتشار'**
  String get copy_publish_5cfd26b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتشار فرصت'**
  String get copy_publish_opportunity_9993b91;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'منتشرشده'**
  String get copy_published_1a00f35;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای تلاش دوباره صفحه را پایین بکش.'**
  String get copy_pull_down_to_try_again_c41d215;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ساعات سکوت'**
  String get copy_quiet_hours_02885b4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهاد متناسب با تو'**
  String get copy_recommended_for_you_e56d06b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مرجع'**
  String get copy_reference_aa63360;

  /// Accessibility label for the admin reject-application icon button.
  ///
  /// In fa, this message translates to:
  /// **'رد درخواست'**
  String get copy_reject_application_9682e01;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'آنلاین'**
  String get copy_remote_dcbb625;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواست بازگشت وجه'**
  String get copy_request_refund_c55b9aa;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بازیابی رمز عبور'**
  String get copy_reset_password_18b5d1c;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فرصت'**
  String get copy_results_2d120a3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'خلاصه رزومه'**
  String get copy_resume_summary_a1cc787;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تلاش دوباره'**
  String get copy_retry_49f3eba;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاربران، فرصت‌ها، درخواست‌ها و رویدادهای حساس را از یک داشبورد بررسی کن.'**
  String get copy_review_users_opportunities_applications_an_e30b9d2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دستمزد و مدل همکاری'**
  String get copy_salary_schedule_bab0cb3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نوع همکاری'**
  String get copy_schedule_3af1939;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جست‌وجو کن...'**
  String get copy_search_dd58413;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ماموریت و شغل را کنار هم ببین؛ بعد دقیق‌تر فیلتر کن.'**
  String get copy_see_missions_and_jobs_together_then_narrow_7e573a3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ارسال پیشنهاد'**
  String get copy_send_offer_8aa1351;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ارسال درخواست'**
  String get copy_send_request_0480e80;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مبلغ و پیام کوتاهت را برای کارفرما بفرست.'**
  String get copy_send_your_price_and_a_short_message_to_the_3961669;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'در حال ارسال…'**
  String get copy_sending_c4b5575;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'یک قیمت مشخص و مدت انجام کار تعیین کن.'**
  String get copy_set_a_defined_price_and_delivery_time_1e53f1a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای شغل، مهلت دریافت درخواست را مشخص کن.'**
  String get copy_set_an_application_deadline_for_jobs_5fd80f8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تنظیمات'**
  String get copy_settings_a8a6c67;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تسویه'**
  String get copy_settle_payment_82af0e6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فهرست کوتاه'**
  String get copy_shortlist_8a78995;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای دیدن پروژه‌ها و پرداخت‌ها وارد حساب شو.'**
  String get copy_sign_in_to_view_your_projects_and_payments_32a2bc2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مهارت‌ها'**
  String get copy_skills_79566c4;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تخصصی'**
  String get copy_specialized_5d1ca04;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شروع یک همکاری خوب.'**
  String get copy_start_a_good_collaboration_9df52cf;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شروع از همین‌جا'**
  String get copy_start_here_555e56f;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاوش را با شهر خودت شروع کن یا هر شهر دیگری را انتخاب کن.'**
  String get copy_start_with_your_city_or_explore_any_other__05a1e84;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'شروع کار'**
  String get copy_start_work_51d8317;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'وضعیت'**
  String get copy_status_b81f9c7;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت'**
  String get copy_submit_201d121;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت درخواست'**
  String get copy_submit_application_43b8707;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت مدرک'**
  String get copy_submit_evidence_bf38455;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'تعلیق'**
  String get copy_suspend_44bded8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'سیستم'**
  String get copy_system_bf4e081;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'برای خواندن باز کن'**
  String get copy_tap_to_mark_as_read_5c9917a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دستمزد ماه اول معیار کارمزد HOPE است.'**
  String get copy_the_first_month_salary_determines_hope_s_j_ca73bd3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جدیدترین وضعیت پروژه‌ها'**
  String get copy_the_most_recent_project_updates_5e402d8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'ثبت درخواست بازیابی انجام نشد.'**
  String get copy_the_reset_request_could_not_be_submitted_475bdfd;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فعلاً داده‌ها از سرور دریافت نشد. دوباره امتحان کن.'**
  String get copy_the_server_did_not_return_data_try_again_bccfbb3;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'معامله تسویه شده است.'**
  String get copy_this_transaction_is_settled_04f8174;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'عنوان، شهر یا مهارت...'**
  String get copy_title_city_or_skill_bccb024;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'عنوان'**
  String get copy_title_d4694a2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کل پروژه‌ها'**
  String get copy_total_projects_78ce548;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'معامله'**
  String get copy_transaction_7e0ea3b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جزئیات معامله'**
  String get copy_transaction_details_d5a9152;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'انتخاب شفاف، بدون نمایش بی‌دلیل اطلاعات هویتی کارجو.'**
  String get copy_transparent_selection_without_unnecessary__32e249a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اعتماد و حریم خصوصی'**
  String get copy_trust_privacy_9f90033;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'بدون عنوان'**
  String get copy_untitled_d89410e;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'طبق تنظیمات سیستم'**
  String get copy_use_system_setting_a8649f8;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کاربران'**
  String get copy_users_200338b;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'\${value} تومان'**
  String copy_value_irr_ed45261(Object value);

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'احراز هویت'**
  String get copy_verification_c45fea9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مشاهده وضعیت معامله'**
  String get copy_view_transaction_a91f1e6;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'HOPE چیست؟'**
  String get copy_what_is_hope_83013ad;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اجرای کار'**
  String get copy_work_execution_cb0edb9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نقش و ظرفیت همکاری'**
  String get copy_work_profile_885ecac;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'وضعیت کار'**
  String get copy_work_status_eb2d6f2;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'کارمزد کارجو'**
  String get copy_worker_fee_85a35aa;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'دریافتی کارجو'**
  String get copy_worker_payout_45f6bb9;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'جزئیات همکاری'**
  String get copy_working_details_4ef3155;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'نگران نباش'**
  String get copy_you_are_covered_1bbe449;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'اعلان جدیدی نداری.'**
  String get copy_you_have_no_new_notifications_45f9685;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'با ساخت حساب، اطلاعات تو در فضای امن HOPE نگهداری می‌شود.'**
  String get copy_your_account_data_is_kept_securely_by_hope_b91dd1f;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'فضای فعالیت خصوصی است'**
  String get copy_your_activity_is_private_1363766;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'درخواستت ثبت شد و برای بررسی ادمین رفت.'**
  String get copy_your_application_was_sent_for_admin_review_5d9c43a;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'پیشنهادت ثبت شد.'**
  String get copy_your_offer_was_submitted_75e3409;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'مسیر حرفه‌ای تو'**
  String get copy_your_professional_path_2da0026;

  /// UI copy migrated from manual bilingual text.
  ///
  /// In fa, this message translates to:
  /// **'با ارسال یا قبول پیشنهاد، جریان کار تو اینجا دیده می‌شود.'**
  String get copy_your_projects_applications_and_payments_wi_bec5340;

  /// Migrated language selector/brand copy.
  ///
  /// In fa, this message translates to:
  /// **'HOPE • کار • رشد • همراهی'**
  String get copy_hope_work_grow_together_6a1d9f0;

  /// Migrated language selector/brand copy.
  ///
  /// In fa, this message translates to:
  /// **'زبان: English'**
  String get copy_language_english_d9f5a4a;

  /// Migrated language selector/brand copy.
  ///
  /// In fa, this message translates to:
  /// **'زبان: فارسی'**
  String get copy_language_persian_3ffcd3e;

  /// Final direct UI string migration.
  ///
  /// In fa, this message translates to:
  /// **'ثبت‌نام انجام نشد. دوباره تلاش کن.'**
  String get copy_registration_failed_please_try_again_bbb72e2;

  /// Final direct UI string migration.
  ///
  /// In fa, this message translates to:
  /// **'لینک/URI (اختیاری)'**
  String get copy_link_uri_optional_1d2307a;

  /// Final direct UI string migration.
  ///
  /// In fa, this message translates to:
  /// **'توضیحات'**
  String get copy_description_24d1e57;

  /// No description provided for @copy_about_mission_description.
  ///
  /// In fa, this message translates to:
  /// **'HOPE یک بازار کار است که دو نیاز متفاوت را از هم جدا می‌کند: «ماموریت» برای کاری مشخص با نتیجه و مبلغ روشن، و «شغل» برای همکاری پاره‌وقت یا تمام‌وقت با دستمزد ماهانه. هدف HOPE این است که مسیر پیدا کردن و پیشنهاد دادن فرصت‌های کاری را ساده‌تر، شفاف‌تر و حرفه‌ای‌تر کند و در عین حال حریم خصوصی کارجو و سلامت فرایند انتخاب را حفظ کند.'**
  String get copy_about_mission_description;

  /// No description provided for @copy_about_mission_fee_short.
  ///
  /// In fa, this message translates to:
  /// **'۱۰٪ از کارفرما + ۱۰٪ از کارجو'**
  String get copy_about_mission_fee_short;

  /// No description provided for @copy_about_job_fee_short.
  ///
  /// In fa, this message translates to:
  /// **'۳۰٪ از دستمزد ماه اول کارجو'**
  String get copy_about_job_fee_short;

  /// No description provided for @copy_pick_file.
  ///
  /// In fa, this message translates to:
  /// **'انتخاب فایل'**
  String get copy_pick_file;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'fa'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'fa':
      return AppLocalizationsFa();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
