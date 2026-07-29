import api from "@/libs/axios";

export const GetAllMoments = async ({
  timestamp = null,
  friendId = null,
  limit = 60,
}) => {
  try {
    const res = await api.post("/locket/getMomentV2", {
      timestamp: timestamp,
      friendId: friendId,
      limit: limit,
    });
    if (!res.data?.data) throw new Error("Invalid response");
    return res.data.data;
  } catch (err) {
    console.warn("❌ GetAllMoments Failed", err);
    throw err; // Important: Throw so store can handle error state
  }
};

export const GetReactionsMoment = async (idMoment) => {
  try {
    const body = {
      data: {
        moment_uid: idMoment,
      },
    };
    const res = await api.post("/locket/getMomentReactions", body);
    const moments = res.data.data;
    return moments;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
};
