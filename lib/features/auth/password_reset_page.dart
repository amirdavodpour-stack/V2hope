import 'package:flutter/material.dart';
import '../../core/ui/hope_l10n.dart';
import '../../core/application/application_registry.dart';
import '../../core/application/application_registry_context.dart';
import '../../core/network/api_error_presenter.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/components.dart';


ApplicationRegistry _applicationRegistry(BuildContext context) => applicationRegistryOf(context);

class PasswordResetPage extends StatefulWidget {
  const PasswordResetPage({super.key});
  @override
  State<PasswordResetPage> createState() => _PasswordResetPageState();
}

class _PasswordResetPageState extends State<PasswordResetPage> {
  final email = TextEditingController();
  bool loading = false;
  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (email.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(HopeCopy.of(context).copy_enter_your_email_2562106)));
      return;
    }
    setState(() => loading = true);
    try {
      await _applicationRegistry(context).requestPasswordReset(email.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(HopeCopy.of(context)
                .copy_if_the_account_exists_a_reset_request_has__b974d8e)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(apiErrorMessage(error,
                fallback: HopeCopy.of(context)
                    .copy_the_reset_request_could_not_be_submitted_475bdfd))));
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
                const SizedBox(height: 34),
                const HopeIconTile(Icons.mark_email_unread_outlined, size: 60),
                const SizedBox(height: 20),
                Text(HopeCopy.of(context).copy_reset_password_18b5d1c,
                    style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 8),
                Text(
                    HopeCopy.of(context)
                        .copy_enter_your_account_email_and_we_will_start_16caa6e,
                    style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 24),
                HopeSurface(
                    padding: const EdgeInsets.all(18),
                    child: Column(children: [
                      TextField(
                          controller: email,
                          keyboardType: TextInputType.emailAddress,
                          textDirection: TextDirection.ltr,
                          decoration: InputDecoration(
                              labelText:
                                  HopeCopy.of(context).copy_email_0cc870e,
                              prefixIcon:
                                  const Icon(Icons.mail_outline_rounded))),
                      const SizedBox(height: 14),
                      FilledButton(
                          onPressed: loading ? null : submit,
                          child: loading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : Text(HopeCopy.of(context)
                                  .copy_send_request_0480e80)),
                    ])),
                const SizedBox(height: 16),
                EmptyState(
                    icon: Icons.shield_outlined,
                    title: HopeCopy.of(context).copy_you_are_covered_1bbe449,
                    message: HopeCopy.of(context)
                        .copy_for_security_the_response_is_intentionally_6574fa6),
              ])),
        ),
      );
}
