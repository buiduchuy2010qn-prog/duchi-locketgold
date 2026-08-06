import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [appSource, routeSource, adminRouteSource] = await Promise.all([
  readFile("api/app.js", "utf8"),
  readFile("api/src/routes/index.js", "utf8"),
  readFile("api/src/routes/adminRoutes.js", "utf8"),
]);

test("không tồn tại endpoint công khai xóa toàn bộ dữ liệu tường lửa", () => {
  assert.doesNotMatch(appSource, /app\.get\(["']\/api\/unban-all["']/);
  assert.doesNotMatch(appSource, /DELETE\s+FROM\s+ip_blacklist/i);
  assert.doesNotMatch(appSource, /DELETE\s+FROM\s+web_security_threats/i);
});

test("route gốc API chỉ trả trạng thái và không thay đổi cơ sở dữ liệu", () => {
  const rootRouteStart = routeSource.indexOf('app.get("/"');
  const healthRouteStart = routeSource.indexOf('app.get("/health"');

  assert.notEqual(rootRouteStart, -1);
  assert.notEqual(healthRouteStart, -1);

  const rootRouteSource = routeSource.slice(rootRouteStart, healthRouteStart);
  assert.doesNotMatch(rootRouteSource, /DELETE\s+FROM/i);
  assert.doesNotMatch(rootRouteSource, /@neondatabase\/serverless/);
  assert.match(rootRouteSource, /Huy Locket API is running/);
});

test("quản trị viên vẫn có công cụ xóa cảnh báo và mở khóa từng IP", () => {
  assert.match(
    adminRouteSource,
    /router\.delete\(["']\/security-threats["']/,
  );
  assert.match(
    adminRouteSource,
    /router\.delete\(["']\/ip-blacklist\/:ip["']/,
  );
  assert.match(adminRouteSource, /requireActiveAdminSession/);
});
