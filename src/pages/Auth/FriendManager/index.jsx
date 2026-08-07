import React, { useEffect } from "react";
import { BookUser } from "lucide-react";
import { useAppNavigation } from "@/context/AppContext";
import FriendsContainer from "@/features/FriendsContainer";

const FriendManager = () => {
  const { isFriendsTabOpen, setFriendsTabOpen } = useAppNavigation();

  useEffect(() => {
    setFriendsTabOpen(true);
    return () => setFriendsTabOpen(false);
  }, [setFriendsTabOpen]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-base-100 text-base-content px-4 text-center gap-3">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-base-200">
        <BookUser className="w-6 h-6" />
      </div>
      <p className="font-medium">Quản lý bạn bè</p>
      <p className="text-sm text-base-content/60">
        Tìm bạn, quản lý lời mời và Canh Slot Celeb.
      </p>
      {!isFriendsTabOpen && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setFriendsTabOpen(true)}
        >
          Mở quản lý bạn bè
        </button>
      )}
      <FriendsContainer />
    </div>
  );
};

export default FriendManager;
