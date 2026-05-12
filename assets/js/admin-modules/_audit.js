/**
 * Admin Audit Log helper — admin-modules/_audit.js
 * All admin-side writes in every phase call logAdminAction().
 * Requires: Firebase compat Firestore + Auth available on window.firebase
 */
(function (root) {
  'use strict';

  root.RR = root.RR || {};
  root.RR.admin = root.RR.admin || {};

  /**
   * Append a record to admin_audit/{autoid}.
   * @param {string} action   e.g. "photo_of_week.set"
   * @param {string} target   doc ID, URL, or descriptive name
   * @param {object} metadata optional extra data (keep small)
   */
  root.RR.admin.logAdminAction = function (action, target, metadata) {
    try {
      const auth = root.firebase && root.firebase.auth && root.firebase.auth();
      const db   = root.firebase && root.firebase.firestore && root.firebase.firestore();
      if (!db) {
        console.warn('[audit] Firestore not available — skipping audit log');
        return Promise.resolve();
      }
      const user = auth ? auth.currentUser : null;
      return db.collection('admin_audit').add({
        ts:       root.firebase.firestore.FieldValue.serverTimestamp(),
        uid:      user ? user.uid   : 'unknown',
        email:    user ? user.email : 'unknown',
        action:   String(action),
        target:   String(target  || ''),
        metadata: metadata || {}
      }).catch(function (e) {
        console.warn('[audit] write failed:', e);
      });
    } catch (e) {
      console.warn('[audit] exception:', e);
      return Promise.resolve();
    }
  };

  // Short alias
  root.logAdminAction = root.RR.admin.logAdminAction;

})(window);
