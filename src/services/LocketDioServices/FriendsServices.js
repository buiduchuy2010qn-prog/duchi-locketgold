import * as utils from "@/utils";
import api from "@/libs/axios";
import { instanceMain } from "@/libs/instanceMain";
import { fetchUserById } from "../LocketServices";
import axios from "axios";

//lấy toàn bộ danh sách bạn bè (uid, createdAt) từ API
// {
//     "uid": "",
//     "createdAt": 1753470386025,
//     "updatedAt": 1753470389669,
//     "sharedHistoryOn": 1753470389647
//     "hidden": true
// }
export const getListIdFriends = async () => {
  try {
    const res = await api.post("locket/getAllFriendsV2");
    const body = res?.data;

    // Hỗ trợ nhiều shape response
    let allFriends =
      body?.data ??
      body?.result?.data ??
      body?.friends ??
      (Array.isArray(body) ? body : null);

    if (!Array.isArray(allFriends)) {
      console.warn("[friends] unexpected response shape", body);
      return null;
    }

    // Lọc null từ gRPC simplify
    return allFriends.filter(
      (f) => f && (f.uid || f.user_uid || f.userUid || f.user),
    ).map((f) => ({
      ...f,
      uid: f.uid || f.user_uid || f.userUid || f.user,
    }));
  } catch (err) {
    console.error("❌ Lỗi khi gọi API get-friends:", err);
    return null;
  }
};

export const loadFriendDetailsV3 = async (friends) => {
  if (!friends || friends.length === 0) {
    return []; // Không fetch nếu không có bạn bè
  }

  const batchSize = 20;
  const allResults = [];

  for (let i = 0; i < friends.length; i += batchSize) {
    const batch = friends.slice(i, i + batchSize);

    try {
      const results = await Promise.allSettled(
        batch.map((friend) =>
          fetchUserById(friend?.uid).then((res) =>
            utils.normalizeFriendDataV2(res),
          ),
        ),
      );

      const successResults = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      allResults.push(...successResults);

      // Nghỉ một chút nếu còn batch
      if (i + batchSize < friends.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý batch:", err);
    }
  }

  return allResults;
};

// Hàm tìm bạn qua username
export const FindFriendByUserName = async (eqfriend, config = {}) => {
  const { idToken } = utils.getToken();
  if (!idToken) {
    const error = new Error("Authentication required");
    error.code = "AUTH_REQUIRED";
    error.status = 401;
    throw error;
  }

  try {
    const body = {
      username: eqfriend,
    };
    const response = await instanceMain.post("locket/getUserByData", body, config);

    return response.data;
  } catch (error) {
    if (!axios.isCancel(error)) {
      console.error("[friends] search request failed", {
        status: error?.response?.status || null,
        code: error?.code || null,
      });
    }
    throw error;
  }
};
