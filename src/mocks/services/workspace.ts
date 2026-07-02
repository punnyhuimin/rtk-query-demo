import { http, HttpResponse, delay } from 'msw';
import { getWorkspaces, saveWorkspaces } from 'mocks/data';
import { merge } from './utils';
import type { Workspace } from 'types';

let workspaces = getWorkspaces();

const workspaceHandlers = [
  http.get('/api/v1/workspace', async () => {
    await delay();
    return HttpResponse.json(workspaces);
  }),
  http.put('/api/v1/workspace', async ({ request }) => {
    const body = await request.json() as Partial<Workspace> | null;
    if (!body?.id) {
      return new HttpResponse(null, { status: 400, statusText: 'No data' });
    }
    const workspace: Workspace = {
      id: body.id,
      name: body.name ?? '',
      isEditable: body.isEditable ?? true,
    };
    workspaces = merge(workspaces, [workspace], (a, b) => a.id === b.id);
    saveWorkspaces(workspaces);
    await delay();
    return HttpResponse.json(workspace, { status: 201 });
  }),
];

export default workspaceHandlers;
