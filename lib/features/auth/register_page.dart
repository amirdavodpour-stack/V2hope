import 'package:flutter/material.dart';
import '../../core/ui/hope_l10n.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});
  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool obscure = true;
  bool loading = false;

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (name.text.trim().isEmpty ||
        email.text.trim().isEmpty ||
        password.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              HopeCopy.of(context).copy_please_complete_all_fields_55c07bb)));
      return;
    }
    if (password.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(HopeCopy.of(context)
              .copy_password_must_be_at_least_8_characters_8ad17c6)));
      return;
    }
    setState(() => loading = true);
    try {
      await context
          .read<AuthController>()
          .register(email.text.trim(), password.text, name.text.trim());
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(error,
                fallback: HopeCopy.of(context)
                    .copy_registration_failed_please_try_again_bbb72e2))));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: Localizations.localeOf(context).languageCode == 'en'
            ? TextDirection.ltr
            : TextDirection.rtl,
        child: Scaffold(
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 30),
              children: [
                Row(children: [
                  IconButton(
                      onPressed: () => Navigator.maybePop(context),
                      icon: Icon(
                          Localizations.localeOf(context).languageCode == 'en'
                              ? Icons.arrow_back_rounded
                              : Icons.arrow_forward_rounded),
                      tooltip: HopeCopy.of(context).copy_back_6e09f79),
                  const Spacer(),
                  const HopeMark(size: 40)
                ]),
                const SizedBox(height: 32),
                const HopeIconTile(Icons.person_add_alt_1_rounded, size: 60),
                const SizedBox(height: 18),
                Text(
                    HopeCopy.of(context)
                        .copy_start_a_good_collaboration_9df52cf,
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 8),
                Text(
                    HopeCopy.of(context)
                        .copy_create_a_hope_account_and_take_the_first_s_9ccd119,
                    style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 24),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(children: [
                      TextField(
                          controller: name,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                              labelText:
                                  HopeCopy.of(context).copy_full_name_c7448f1,
                              prefixIcon:
                                  const Icon(Icons.person_outline_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          textDirection: TextDirection.ltr,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                              labelText:
                                  HopeCopy.of(context).copy_email_0cc870e,
                              prefixIcon:
                                  const Icon(Icons.mail_outline_rounded))),
                      const SizedBox(height: 12),
                      TextField(
                          controller: password,
                          obscureText: obscure,
                          textDirection: TextDirection.ltr,
                          decoration: InputDecoration(
                              labelText:
                                  HopeCopy.of(context).copy_password_656eabe,
                              prefixIcon:
                                  const Icon(Icons.lock_outline_rounded),
                              suffixIcon: IconButton(
                                  icon: Icon(obscure
                                      ? Icons.visibility_off_rounded
                                      : Icons.visibility_rounded),
                                  tooltip: obscure
                                      ? HopeCopy.of(context).showPasswordTooltip
                                      : HopeCopy.of(context)
                                          .hidePasswordTooltip,
                                  onPressed: () =>
                                      setState(() => obscure = !obscure)))),
                      const SizedBox(height: 8),
                      Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                              HopeCopy.of(context)
                                  .copy_at_least_8_characters_eb24592,
                              style: Theme.of(context).textTheme.bodyMedium)),
                      const SizedBox(height: 15),
                      FilledButton(
                          onPressed: loading ? null : submit,
                          child: loading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : Text(HopeCopy.of(context)
                                  .copy_create_account_bfa3517)),
                    ])),
                const SizedBox(height: 14),
                Text(
                    HopeCopy.of(context)
                        .copy_your_account_data_is_kept_securely_by_hope_b91dd1f,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ),
      );
}
