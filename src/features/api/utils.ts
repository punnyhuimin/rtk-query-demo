import { useSelector } from 'react-redux';

export function providesList<T extends { id: string | number }>(
  resultsWithIds: T[] = [],
  tagType: string
) {
  return [
    { type: tagType, id: 'LIST' },
    ...resultsWithIds.map(({ id }) => ({ type: tagType, id })),
  ];
}

export function providesId<T>(
  resultsWithId: T | undefined | null,
  id: string | number,
  tagType: string
) {
  return resultsWithId
    ? [{ type: tagType, id }]
    : ['NOT_FOUND'];
}

export const useIsLoading = () => useSelector(
  (state: { api: { queries: Record<string, { status: string } | undefined> } }) =>
    Object.values(state.api.queries).some(query => query?.status === 'pending')
);
