/// Route path constants shared between the router and (later) any widget
/// that needs to know a path, e.g. for testing.
class AppRoutes {
  AppRoutes._();

  static const splash = '/';
  static const login = '/login';
  static const pendingReview = '/pending-review';
  static const correctionRequired = '/correction-required';
  static const rejected = '/rejected';
  static const registrationIncomplete = '/registration-incomplete';
  static const employeeOnly = '/employee-only';
  static const home = '/home';
  static const jobs = '/jobs';
  static const notifications = '/notifications';
  static const more = '/more';
  static const moreProfile = '/more/profile';
  static const morePerformance = '/more/performance';
  static const moreDocuments = '/more/documents';
  static const moreServices = '/more/services';
  static const moreLocations = '/more/locations';
  static const moreSettings = '/more/settings';
  static const moreSettingsSecurity = '/more/settings/security';
  static const moreSettingsAppearance = '/more/settings/appearance';
  static const moreSettingsNotifications = '/more/settings/notifications';
  static const moreSettingsPrivacy = '/more/settings/privacy';

  // Admin / Workforce Operations Center routes
  static const adminHome = '/admin/home';
  static const adminEmployees = '/admin/employees';
  static const adminApplications = '/admin/applications';
  static const adminApplicationDetail = '/admin/applications/:id';
  static const adminServices = '/admin/services';
  static const adminSkills = '/admin/skills';
  static const adminJobs = '/admin/jobs';
  static const adminDispatch = '/admin/dispatch';
  static const adminLiveWorkforce = '/admin/live-workforce';
  static const adminReports = '/admin/reports';
  static const adminSettings = '/admin/settings';
}
