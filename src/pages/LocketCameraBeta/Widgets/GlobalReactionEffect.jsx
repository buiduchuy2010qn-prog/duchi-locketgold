import { lazy, Suspense } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useReactionStore } from "@/stores";

const ReactionEffect = lazy(
  () => import("@/components/Effects/ReactionEffect"),
);

export default function GlobalReactionEffect() {
  const { perfMode } = useTheme();
  const reaction = useReactionStore((s) => s.reaction);

  if (!reaction || perfMode === "lite") return null;

  return (
    <Suspense fallback={null}>
      <ReactionEffect
        key={reaction.id}
        emojis={reaction.reactions}
        count={30}
        direction="up"
      />
    </Suspense>
  );
}
