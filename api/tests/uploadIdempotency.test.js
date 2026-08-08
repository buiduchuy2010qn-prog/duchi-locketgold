const test = require("node:test");
const assert = require("node:assert/strict");
const {
  runIdempotentUpload,
} = require("../src/modules/moment/utils/uploadIdempotency");

const uniqueKey = (label) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

test("concurrent retries share one upload side effect", async () => {
  const idempotencyKey = uniqueKey("concurrent");
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const work = async () => {
    calls += 1;
    await gate;
    return { momentId: "moment-1" };
  };

  const first = runIdempotentUpload({
    userId: "user-test",
    idempotencyKey,
    work,
  });
  const second = runIdempotentUpload({
    userId: "user-test",
    idempotencyKey,
    work,
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 1);

  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a.result, { momentId: "moment-1" });
  assert.deepEqual(b.result, { momentId: "moment-1" });
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
});

test("completed upload result is replayed without running work again", async () => {
  const idempotencyKey = uniqueKey("completed");
  let calls = 0;
  const work = async () => {
    calls += 1;
    return { momentId: "moment-2" };
  };

  const first = await runIdempotentUpload({
    userId: "user-test",
    idempotencyKey,
    work,
  });
  const second = await runIdempotentUpload({
    userId: "user-test",
    idempotencyKey,
    work,
  });

  assert.equal(calls, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.result, { momentId: "moment-2" });
});

test("different users do not share idempotency results", async () => {
  const idempotencyKey = uniqueKey("users");
  let calls = 0;

  await runIdempotentUpload({
    userId: "user-a",
    idempotencyKey,
    work: async () => ({ call: ++calls }),
  });
  await runIdempotentUpload({
    userId: "user-b",
    idempotencyKey,
    work: async () => ({ call: ++calls }),
  });

  assert.equal(calls, 2);
});
