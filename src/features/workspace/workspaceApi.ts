import { api } from 'features/api/apiSlice';
import type { Workspace } from 'types';

export const workspaceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<Workspace[], void>({
      query: () => 'workspace',
      providesTags: ['Workspace'],
    }),
    upsertWorkspace: builder.mutation<Workspace, Partial<Workspace>>({
      query: (workspace) => ({
        url: 'workspace',
        method: 'PUT',
        body: workspace,
      }),
      invalidatesTags: ['Workspace'],
    }),
  }),
});

export const { useGetWorkspacesQuery, useUpsertWorkspaceMutation } = workspaceApi;
