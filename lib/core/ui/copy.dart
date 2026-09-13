import 'package:flutter/material.dart';
import 'hope_l10n.dart';

@Deprecated('Use HopeCopy.of(context).<key> for static UI copy.')
String tx(BuildContext context, String fa, String en) =>
    Localizations.localeOf(context).languageCode == 'en' ? en : fa;

String moneyLabel(BuildContext context, Object value) =>
    HopeCopy.of(context).copy_value_irr_ed45261(value);

String opportunityKindLabel(BuildContext context, String? value) =>
    switch ((value ?? '').toUpperCase()) {
      'MISSION' => HopeCopy.of(context).copy_mission_fb4c5e1,
      'JOB' => HopeCopy.of(context).copy_job_ce2feba,
      _ => HopeCopy.of(context).copy_opportunity_62cf572,
    };

String opportunityVisibilityLabel(BuildContext context, String? value) =>
    switch ((value ?? '').toUpperCase()) {
      'SPECIALIZED' => HopeCopy.of(context).copy_specialized_5d1ca04,
      _ => HopeCopy.of(context).copy_public_21e97be,
    };
