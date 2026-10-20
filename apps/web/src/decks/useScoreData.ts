// The scores a deck's Stats and Gaps tabs rank cards by: community scores where there are enough
// ratings, otherwise the user's own reviewed scores.
import { useEffect, useState } from "react";
import { useAppSelector } from "../hooks.ts";
import type { CommunityRow } from "../ranking/rank.ts";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";
import { useServices } from "../servicesContext.ts";

export interface ScoreData {
  dimensions: Dimension[];
  community: CommunityRow[];
  minRatingCount: number;
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
}

/** Score data for ranking, or null while it loads. */
export function useScoreData(): ScoreData | null {
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [data, setData] = useState<ScoreData | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
      user ? scores.listAllMyScores(user.id) : Promise.resolve(null),
      user ? scores.listMyReviewedCardIds(user.id) : Promise.resolve(null),
    ]).then(([dimensions, community, minRatingCount, myRows, reviewed]) => {
      if (!live) return;
      setData({
        dimensions,
        community,
        minRatingCount,
        mine:
          myRows && reviewed
            ? { rows: myRows, reviewedCardIds: new Set(reviewed) }
            : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [scores, user]);
  return data;
}
