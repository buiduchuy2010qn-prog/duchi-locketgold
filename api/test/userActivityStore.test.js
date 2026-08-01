const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeIdentity } = require("../src/services/userActivityStore");

test("uses only the verified Locket profile for the visible user identity", () => {
  const identity = normalizeIdentity(
    {
      uid: "verified-uid",
      email: "verified@example.test",
      name: "Token Name",
      firebase: { sign_in_provider: "password" },
    },
    {
      username: "verified-user-name",
      firstName: "Verified",
      lastName: "Profile",
      profilePicture: "https://example.test/profile.jpg",
    },
  );

  assert.equal(identity.uid, "verified-uid");
  assert.equal(identity.email, "verified@example.test");
  assert.equal(identity.username, "verified-user-name");
  assert.equal(identity.displayName, "Verified Profile");
  assert.equal(identity.profilePicture, "https://example.test/profile.jpg");
  assert.equal(identity.authProvider, "password");
});
