import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyUploadFailure,
  rateLimitCooldownRemaining,
  shouldResumeAfterReconnect,
  UPLOAD_QUEUE_ERROR,
} from "../../src/stores/PostStores/uploadQueuePolicy.js";

test("429 is kept for manual retry after cooldown", () => {
  const result = classifyUploadFailure(
    { response: { status: 429 } },
    { online: true },
  );

  assert.equal(result.code, UPLOAD_QUEUE_ERROR.RATE_LIMITED);
  assert.equal(result.autoRetry, false);
  assert.ok(
    rateLimitCooldownRemaining({
      errorCode: UPLOAD_QUEUE_ERROR.RATE_LIMITED,
      lastTried: new Date().toISOString(),
    }) > 0,
  );
});

test("offline failure only resumes in the same browser session", () => {
  const result = classifyUploadFailure(new Error("Network Error"), {
    online: false,
  });
  const item = { queueSessionId: "session-a", errorCode: result.code };

  assert.equal(result.code, UPLOAD_QUEUE_ERROR.OFFLINE);
  assert.equal(shouldResumeAfterReconnect(item, "session-a"), true);
  assert.equal(shouldResumeAfterReconnect(item, "session-b"), false);
});

test("server errors retry automatically but user errors do not", () => {
  const server = classifyUploadFailure(
    { response: { status: 503 } },
    { online: true },
  );
  const invalid = classifyUploadFailure(
    { response: { status: 400 } },
    { online: true },
  );

  assert.equal(server.code, UPLOAD_QUEUE_ERROR.SERVER);
  assert.equal(server.autoRetry, true);
  assert.equal(invalid.code, UPLOAD_QUEUE_ERROR.FAILED);
  assert.equal(invalid.autoRetry, false);
});

test("expired media and invalid API responses remain visible without retry", () => {
  const expired = classifyUploadFailure(
    { response: { status: 404 } },
    { online: true },
  );
  const invalid = classifyUploadFailure(
    { message: "INVALID_UPLOAD_RESPONSE" },
    { online: true },
  );

  assert.deepEqual(expired, {
    code: UPLOAD_QUEUE_ERROR.MEDIA_EXPIRED,
    autoRetry: false,
    resumeOnReconnect: false,
  });
  assert.equal(invalid.code, UPLOAD_QUEUE_ERROR.INVALID_RESPONSE);
  assert.equal(invalid.autoRetry, false);
});
