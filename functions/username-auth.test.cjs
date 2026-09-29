/**
 * Lightweight unit checks for username helpers (no Firestore).
 * Run: node functions/username-auth.test.cjs
 */
const {
  isEmailIdentifier,
  normalizeUsername,
  validateUsernameFormat,
} = require("./username-auth");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

assert(isEmailIdentifier("a@b.co"), "email ok");
assert(!isEmailIdentifier("racefan8"), "username not email");
assert(normalizeUsername("@Race_Fan") === "race_fan", "normalize strips @ and case");

try {
  validateUsernameFormat("ab");
  assert(false, "too short should throw");
} catch (e) {
  assert(e.code === "invalid-argument" || /3/.test(e.message), "too short throws");
}

try {
  validateUsernameFormat("good_name");
  assert(true, "good_name valid");
} catch (e) {
  assert(false, "good_name should be valid: " + e.message);
}

try {
  validateUsernameFormat("admin");
  assert(false, "reserved should throw");
} catch (e) {
  assert(/reserved/i.test(e.message), "reserved throws");
}

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("All username-auth unit checks passed");
