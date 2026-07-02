import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface WorkspaceState {
  selectedWorkspaceId: string | undefined;
}

const initialState: WorkspaceState = {
  selectedWorkspaceId: undefined,
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    selectWorkspace(state, { payload }: PayloadAction<string>) {
      state.selectedWorkspaceId = payload;
    },
  },
});

export const { selectWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;

type WorkspaceRoot = { workspace: WorkspaceState };
export const selectSelectedWorkspaceId = (state: WorkspaceRoot) => state.workspace.selectedWorkspaceId;
