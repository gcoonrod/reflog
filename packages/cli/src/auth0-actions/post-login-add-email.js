/**
 * Auth0 Post Login Action — adds the user's email as a
 * namespaced access-token claim so downstream APIs (e.g. the
 * sync-api worker) can read it from the JWT without an
 * extra Management API call.
 */
exports.onExecutePostLogin = async (event, api) => {
  if (event.user.email && event.user.email_verified) {
    api.accessToken.setCustomClaim(
      "https://reflog.app/claims/email",
      event.user.email,
    );
  }
};
