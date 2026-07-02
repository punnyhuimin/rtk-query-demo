import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'app/hooks';
import { selectWorkspace, selectSelectedWorkspaceId } from './workspaceSlice';
import { useGetWorkspacesQuery, useUpsertWorkspaceMutation } from './workspaceApi';
import type { Workspace } from 'types';

const Workspaces = () => {
  const dispatch = useAppDispatch();
  const selectedWorkspaceId = useAppSelector(selectSelectedWorkspaceId);
  const { data: workspaces = [] } = useGetWorkspacesQuery();
  const [upsertWorkspace] = useUpsertWorkspaceMutation();

  const toggleEditable = useCallback((workspace: Workspace) => {
    upsertWorkspace({ ...workspace, isEditable: !workspace.isEditable });
  }, [upsertWorkspace]);

  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
      {workspaces.map(ws => (
        <div
          key={ws.id}
          style={{
            padding: '8px 12px',
            border: `2px solid ${selectedWorkspaceId === ws.id ? '#0066cc' : '#ccc'}`,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={() => dispatch(selectWorkspace(ws.id))}
        >
          <strong>{ws.name}</strong>
          <label
            style={{ display: 'block', fontSize: '0.85em', cursor: 'pointer' }}
            onClick={e => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={ws.isEditable}
              onChange={() => toggleEditable(ws)}
            />
            {' '}Editable
          </label>
        </div>
      ))}
    </div>
  );
};

export default Workspaces;
