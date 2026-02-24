/**
 * Auth0 Post Login Action — adds the user's email as a
 * top-level access-token claim so downstream APIs (e.g. the
 * sync-api worker) can read it from the JWT without an
 * extra Management API call.
 */
exports.onExecutePostLogin = async (event, api) => {
  if (event.user.email) {
    api.accessToken.setCustomClaim("email", event.user.email);
  }
};
