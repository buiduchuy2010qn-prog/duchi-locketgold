const express = require("express");
const router = express.Router();

const { messageControll, friendcontroll, momentcontroll } = require("../controllers");
const { logRequestInfo } = require("../middlewares/logRequestInfo");
const { verifyIdToken, verifyplanAuth, verifyDioToken, onlyMemberCheck } = require("../middlewares/Auth");
const { checkAppMeta } = require("../middlewares/checkMeta");
const { initializeAppCheck } = require("../modules/appcheck");
const { validateOverlayType } = require("../middlewares/validateOverlayType");
const { instanceLocketV2 } = require("../libs/instanceLocket");
const {
  friendRequestLimiter,
  friendSearchLimiter,
} = require("../middlewares/rateLimit");

//Moment V2
// router.post("/getMomentV2", verifyIdToken, momentcontroll.GetMomentsControll);

router.post("/getInfoMomentV2", checkAppMeta, verifyIdToken, verifyDioToken, momentcontroll.GetInfoMomentsControll);
router.get("/getLatestMomentV2", verifyIdToken, momentcontroll.GetLastestMomentsControll);
router.post("/reactMomentV2", verifyIdToken, momentcontroll.ReactMomentsControll);

// Rollcalls — gọi server-to-server để tránh CORS / chặn request trên Android.
// Giữ nguyên response chính thức để frontend không phải đổi cấu trúc dữ liệu.
router.post("/getRollcallPostsV2", verifyIdToken, async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const idToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!idToken) {
    return res.status(401).json({
      success: false,
      message: "Missing Firebase ID token",
    });
  }

  try {
    const upstream = await instanceLocketV2.post(
      "getRollcallPosts",
      req.body,
      {
        meta: { idToken },
        timeout: 30000,
      },
    );

    return res.status(upstream.status || 200).json(upstream.data);
  } catch (error) {
    const status = error?.response?.status || 502;
    const upstreamData = error?.response?.data;

    console.warn("[rollcall-proxy] getRollcallPosts failed", {
      status,
      code: error?.code || null,
      message: error?.message || "Unknown upstream error",
    });

    return res.status(status).json(
      upstreamData && typeof upstreamData === "object"
        ? upstreamData
        : {
            success: false,
            message:
              status === 504
                ? "Rollcalls upstream timeout"
                : "Rollcalls upstream unavailable",
          },
    );
  }
});

//Message V2
// router.post("/getAllMessageV2", verifyIdToken, messageControll.GetAllMessagesControll);
router.post("/sendMessageV2", verifyIdToken, momentcontroll.SendMessageControll);

//Friend V2
router.post("/deleteFriendV2", verifyIdToken, friendcontroll.deleteFriendsController);

// ==================== Friend Requests V2 ====================
router.post("/sendFriendRequestV2", friendRequestLimiter, checkAppMeta, verifyIdToken, verifyDioToken, initializeAppCheck, friendcontroll.SendRequestToFriendsController);
router.post("/sendCelebrityRequestV2", friendRequestLimiter, checkAppMeta, verifyIdToken, verifyDioToken, initializeAppCheck, friendcontroll.SendRequestToCelebrityController);

router.post("/getIncomingFriendRequestsV2", verifyIdToken, friendcontroll.getFriendsRequestController);

router.post("/getAllRequestsV2", verifyIdToken, friendcontroll.getFriendsRequestControllerV2);

router.post("/getOutgoingFriendRequestsV2", verifyIdToken, friendcontroll.getOutgoingRequestsController);
// Xoá lời mời kết bạn
router.post("/deleteIncomingRequestV2", verifyIdToken, friendcontroll.deleteFriendsRequestController);
router.post("/deleteOutgoingRequestV2", verifyIdToken, friendcontroll.deleteOutgingRequestController);

router.post("/acceptFriendRequestV2", verifyIdToken, friendcontroll.AcceptFriendsController);

// Get Friend
router.post("/getUserByData", friendSearchLimiter, verifyIdToken, friendcontroll.getUserController);

module.exports = router;
