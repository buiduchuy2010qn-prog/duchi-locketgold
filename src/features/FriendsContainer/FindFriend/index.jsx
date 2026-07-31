import { useState, useRef } from "react";
import axios from "axios";
import NormalItemFriend from "./NormalItemFriend";
import { FaSearchPlus } from "react-icons/fa";
import SearchInput from "@/components/uikit/Input/SearchInput";
import CelebItemFriend from "./CelebItemFriend";
import {
  SonnerInfo,
  SonnerPromiseV2,
  SonnerWarning,
} from "@/components/uikit/SonnerToast";
import {
  FindFriendByUserName,
  getFriendshipStatus,
  SendRequestToCelebrity,
  SendRequestToFriend,
  shareHistoryWithFriend,
} from "@/services";
import BouncyLoader from "@/components/uikit/Loading/Bouncy";
import { useFeatureVisible } from "@/hooks/useFeature";
import { useNavigate } from "react-router-dom";
import { useShareHistory } from "@/stores";
import { useTranslation } from "react-i18next";

const FindFriend = () => {
  const { t } = useTranslation("features");
  const navigate = useNavigate();
  const isSendRequest = useFeatureVisible("send_friend_request");

  const { shareHistoryOn, toggleShareHistoryOn } = useShareHistory();

  const [searchState, setSearchState] = useState("idle"); // idle, loading, success, empty, error
  const [errorMsg, setErrorMsg] = useState("");
  const abortControllerRef = useRef(null);

  const [searchTermFind, setSearchTermFind] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [isFocusedFind, setIsFocusedFind] = useState(null);
  const [sending, setSending] = useState(false); // 👉 NEW

  const [friendshipStatus, setFriendshipStatus] = useState("NONE");

  const handleFindFriend = async (rawUsername) => {
    if (!rawUsername) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const username = rawUsername.replace(/^@/, "").trim();

    setSearchState("loading");
    setFoundUser(null);
    setErrorMsg("");

    try {
      const promise = FindFriendByUserName(username, { signal: abortController.signal });
      const result = await SonnerPromiseV2(promise, {
        loading: t("friends.find.searching_user"),
        success: t("friends.find.user_found"),
        error: (err) => {
          if (axios.isCancel(err)) return "Đã hủy tìm kiếm trước";
          if (err?.message === t("friends.find.user_not_exist") || err?.message === "Người dùng không tồn tại" || err?.response?.status === 404) {
            return t("friends.find.user_not_exist");
          }
          return t("friends.find.error_try_again");
        },
      });

      if (result?.success && result?.data) {
        setFoundUser(result.data);
        setSearchState("success");
        const status = await getFriendshipStatus(result.data.uid);
        setFriendshipStatus(status);
      } else {
        setSearchState("empty");
      }
    } catch (err) {
      if (axios.isCancel(err)) return; // Bỏ qua nếu là request cũ bị hủy
      
      if (err?.message === t("friends.find.user_not_exist") || err?.message === "Người dùng không tồn tại" || err?.response?.status === 404) {
        setSearchState("empty");
      } else {
        setSearchState("error");
        setErrorMsg(t("friends.find.error_try_again"));
      }
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser || sending) return;

    if (!isSendRequest) {
      SonnerWarning(
        t("friends.find.feature_locked_title"),
        t("friends.find.feature_locked_desc"),
        {
          action: {
            label: t("friends.find.upgrade_label"),
            onClick: () => navigate("/pricing"),
          },
        },
      );
      return;
    }

    try {
      setSending(true);

      if (foundUser?.celebrity) {
        const res = await SonnerPromiseV2(
          SendRequestToCelebrity(foundUser.uid),
          {
            loading: t("friends.find.sending_request"),
            success: t("friends.find.send_success"),
            error: (err) => err?.message || t("friends.find.send_failed"),
          },
        );

        if (res?.success) {
          setFriendshipStatus("OUTGOING");

          setFoundUser((prev) => ({
            ...prev,
            friendship_status: "outgoing-follow-request",
          }));
        }

        return;
      }

      const res = await SonnerPromiseV2(SendRequestToFriend(foundUser.uid), {
        loading: t("friends.find.sending_request"),
        success: t("friends.find.send_success"),
        error: (err) => err?.message || t("friends.find.send_failed"),
      });

      if (res?.status === "real-user") {
        setFriendshipStatus("OUTGOING");

        if (shareHistoryOn) {
          SonnerInfo(t("friends.find.history_share_info"));

          await shareHistoryWithFriend(foundUser.uid);
        }
      }
    } catch (error) {
      // SonnerPromise đã hiện lỗi rồi
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const isCelebrity = foundUser?.celebrity === true;

  return (
    <div>
      <h2 className="flex items-center gap-2 text-md font-semibold mb-1">
        <FaSearchPlus size={22} /> {t("friends.find.search_title")}
      </h2>
      <p className="text-sm">{t("friends.find.anti_spam")}</p>

      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium">{t("friends.find.share_history_title")}</p>
            <p className="text-sm text-base-content/60">
              {t("friends.find.share_history_desc")}
            </p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={shareHistoryOn}
          onChange={toggleShareHistoryOn}
          className="toggle toggle-secondary"
        />
      </div>

      <div className="flex gap-2 items-center">
        <SearchInput
          searchTerm={searchTermFind}
          setSearchTerm={setSearchTermFind}
          isFocused={isFocusedFind}
          setIsFocused={setIsFocusedFind}
          placeholder={t("friends.find.add_friend_placeholder")}
        />

        {searchTermFind && (
          <button
            disabled={searchState === "loading"}
            className="btn btn-base-200 text-base flex items-center gap-2 rounded-full disabled:opacity-50"
            onClick={() => handleFindFriend(searchTermFind)}
          >
            {searchState === "loading" ? (
              <>
                <BouncyLoader size={25} /> {t("friends.find.wait")}
              </>
            ) : (
              t("friends.find.search_btn")
            )}
          </button>
        )}
      </div>

      <div className="w-full flex justify-center mt-2">
        {searchState === "loading" && (
          <p className="text-gray-400 h-[70px] text-center flex items-center justify-center">
            {t("friends.find.searching")}
          </p>
        )}

        {searchState === "empty" && (
          <p className="text-gray-400 h-[70px] text-center flex items-center justify-center">
            {t("friends.find.user_not_exist", "Không tìm thấy người dùng")}
          </p>
        )}

        {searchState === "error" && (
          <div className="text-error h-[70px] text-center flex flex-col items-center justify-center">
            <p>{errorMsg}</p>
            <button className="btn btn-sm btn-outline mt-2" onClick={() => handleFindFriend(searchTermFind)}>
              Thử lại
            </button>
          </div>
        )}

        {searchState === "idle" && (
          <p className="text-gray-400 h-[70px] text-center flex items-center justify-center">
            {t("friends.find.no_data")}
          </p>
        )}

        {searchState === "success" && foundUser && (
          isCelebrity ? (
            <CelebItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={searchState === "loading"}
            />
          ) : (
            <NormalItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={sending}
              disabled={sending}
              status={friendshipStatus}
            />
          )
        )}
      </div>
    </div>
  );
};

export default FindFriend;
