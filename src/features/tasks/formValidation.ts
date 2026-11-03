export function reworkCommentError(comment: string): string | null {
  return comment.trim() ? null : "Укажите комментарий для возврата задачи на доработку.";
}
