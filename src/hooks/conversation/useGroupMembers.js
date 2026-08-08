// hooks/useGroupMembers.js

import { useMemo } from "react";
import { useAuthStore, useMembersGroupStore } from "@/stores";

export function useGroupMembers(groupId) {
  const currentUser = useAuthStore((s) => s.user);
  const membersMap = useMembersGroupStore((s) => s.membersMap);
  const groupMembersMap = useMembersGroupStore((s) => s.groupMembersMap);

  return useMemo(() => {
    if (!groupId) return [];

    const currentUid = currentUser?.uid;
    const selfMember = currentUid
      ? {
          uid: currentUid,
          firstName:
            currentUser?.firstName ||
            currentUser?.displayName ||
            currentUser?.username ||
            "",
          lastName: currentUser?.lastName || "",
          username: currentUser?.username || currentUser?.displayName || "",
          profilePic:
            currentUser?.profilePic ||
            currentUser?.profilePicture ||
            currentUser?.photoURL ||
            null,
          status: "self",
        }
      : null;

    const resolvedMembers = (groupMembersMap[groupId] || [])
      .map((uid) => (uid === currentUid ? selfMember : membersMap[uid]))
      .filter(Boolean);

    // getGroupsState chỉ trả các nhóm tài khoản hiện tại đang tham gia,
    // nhưng profile của chính mình không được fetch vào membersMap.
    // Thêm profile hiện tại để số người, avatar và danh sách không bị thiếu 1.
    if (
      selfMember &&
      !resolvedMembers.some((member) => member.uid === currentUid)
    ) {
      resolvedMembers.unshift(selfMember);
    }

    return resolvedMembers;
  }, [currentUser, groupId, membersMap, groupMembersMap]);
}
