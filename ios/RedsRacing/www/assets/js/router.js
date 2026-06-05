// assets/js/router-fixed.js
import { navigateToInternal } from "./navigation-helpers.js";
import { monitorAuthState } from "./auth-utils.js";
import { resolveAppRoleForUser, defaultDashboardPath } from "./roles.js";

let isProcessing = false;

monitorAuthState(
  async (user) => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      if (user) {
        const appRole = await resolveAppRoleForUser(user, { forceTokenRefresh: true });
        navigateToInternal(defaultDashboardPath(appRole));
      } else {
        navigateToInternal("/login.html");
      }
    } catch (error) {
      navigateToInternal("/login.html");
    } finally {
      isProcessing = false;
    }
  },
  () => {
    isProcessing = false;
    navigateToInternal("/login.html");
  },
);
