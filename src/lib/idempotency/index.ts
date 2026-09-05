export type IdempotentOperation = 'action.submit' | 'macro.draft.create' | 'macro.draft.clone' | 'market.draft.create' | 'market.draft.clone' | 'macro.comment.create';
/** Create once per user action. Frozen serialized body and key travel together on every retry. */
export function logicalOperation<T>(operation: IdempotentOperation, body: T) {
  return Object.freeze({ operation, key: crypto.randomUUID(), body: JSON.stringify(body) });
}
export type LogicalOperation = ReturnType<typeof logicalOperation>;
