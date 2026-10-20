import type {
  DraftReview,
  DraftReviewRepository,
} from "../rules/draftReviewRepository.ts";

/** An in-memory DraftReviewRepository; `saved` records every change. */
export function fakeDraftReviewRepository(reviews: DraftReview[] = []) {
  let rows = [...reviews];
  const saved: string[] = [];
  const repository: DraftReviewRepository = {
    listReviews: async () => [...rows],
    async saveReview(review) {
      saved.push(`${review.verdict} ${review.cardId} ${review.draftHash}`);
      rows = [
        ...rows.filter(
          (r) => r.cardId !== review.cardId || r.draftHash !== review.draftHash,
        ),
        review,
      ];
    },
    async clearReview(cardId, draftHash) {
      saved.push(`clear ${cardId} ${draftHash}`);
      rows = rows.filter(
        (r) => r.cardId !== cardId || r.draftHash !== draftHash,
      );
    },
  };
  return { repository, saved };
}
