const express = require("express");
const { verifyIdToken, verifyDioToken } = require("../../../middlewares/Auth");
const { uploadMediaV3 } = require("../controllers/post.controller");
const { validateOverlayType } = require("../../../middlewares/validateOverlayType");
const { logRequestInfo } = require("../../../middlewares/logRequestInfo");
const { checkAppMeta } = require("../../../middlewares/checkMeta");
const { uploadLimit } = require("../../../middlewares/securityRateLimiter");
const { uploadIdempotency } = require("../middlewares/uploadIdempotency");

const momentRoutes = express.Router();

momentRoutes.post(
  "/postMomentV2",
  checkAppMeta,
  logRequestInfo,
  validateOverlayType,
  verifyIdToken,
  uploadIdempotency,
  uploadLimit,
  verifyDioToken,
  uploadMediaV3,
);

module.exports = { momentRoutes };
