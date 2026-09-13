import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../auth/auth_controller.dart';
import '../../features/auth/login_page.dart';
import '../../features/home/home_page.dart';
import '../branding/widgets/hope_logo.dart';
import '../branding/hope_brand.dart';

class AppRouter extends StatelessWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (!auth.initialized) {
      return const _BrandedLoadingScreen();
    }
    // HOPE is browse-first: an account is optional for entering the app.
    // Mutating/account-only actions remain protected by the UI and API.
    return auth.isAuthenticated || auth.isGuest
        ? const HomePage()
        : const LoginPage();
  }
}

/// Branded fallback shown for the brief moment before auth state resolves.
/// In practice `main()` already awaits session restore before `runApp`, so
/// this rarely paints — but it's the one screen a user could see between the
/// native splash and real content, so it carries the same mark instead of a
/// bare spinner.
class _BrandedLoadingScreen extends StatelessWidget {
  const _BrandedLoadingScreen();

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: dark
          ? HopeBrandColors.hopeDeepBackground
          : Theme.of(context).scaffoldBackgroundColor,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HopeLogo.icon(size: 56),
            const SizedBox(height: 22),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation(
                    dark ? Colors.white70 : HopeBrandColors.hopePurple),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
