import { useMemo } from "react";
import { useAuthStore, useMembersGroupStore } from "@/stores";

export function useIsGroupMember(groupId) {
  const currentUser = useAuthStore((s) => s.user);

  const groupMembersMap = useMembersGroupStore((s) => s.groupMembersMap);

  return useMemo(() => {
    if (!currentUser?.uid) return false;

    const memberIds = groupMembersMap[groupId] || [];
    const isOwner =
      groupId && String(groupId).startsWith(`${currentUser.uid}-`);

    // Chủ nhóm luôn có quyền nhắn, kể cả payload `users` của Locket
    // không lặp lại user tạo nhóm.
    return Boolean(isOwner || memberIds.includes(currentUser.uid));
  }, [currentUser?.uid, groupId, groupMembersMap]);
}
