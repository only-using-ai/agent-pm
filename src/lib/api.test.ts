import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getApiBase,
  listProjects,
  createProject,
  getProject,
  updateProject,
  archiveProject,
  archiveAgent,
  listProjectColumns,
  createProjectColumn,
  updateProjectColumn,
  deleteProjectColumn,
  listAllWorkItems,
  listWorkItems,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  archiveWorkItem,
  addWorkItemComment,
  listInbox,
  approveInboxItem,
  rejectInboxItem,
  listPrompts,
  getPrompt,
  updatePrompt,
  getContext,
  updateContext,
  listContextFiles,
  listProjectFiles,
  getProjectFileContent,
  updateProjectFileContent,
  deleteProjectFile,
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  getProfile,
  updateProfile,
  getProfileAvatarUrl,
  linkAssetToWorkItem,
  deleteContextFile,
  uploadContextFile,
  uploadProfileAvatar,
} from './api'

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('import.meta', { env: {} })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getApiBase', () => {
    it('returns base URL without trailing slash', () => {
      expect(getApiBase()).toBe('http://localhost:38472')
    })
  })

  describe('getProfileAvatarUrl', () => {
    it('returns profile avatar URL', () => {
      expect(getProfileAvatarUrl()).toBe('http://localhost:38472/api/profile/avatar')
    })
  })

  describe('listProjects', () => {
    it('returns projects on success', async () => {
      const data = [{ id: '1', name: 'P1', priority: null, description: null, path: null, project_context: null, created_at: '2024-01-01' }]
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) } as Response)
      const result = await listProjects()
      expect(result).toEqual(data)
    })

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
      await expect(listProjects()).rejects.toThrow('Failed to list projects')
    })
  })

  describe('createProject', () => {
    it('returns created project on success', async () => {
      const body = { name: 'New' }
      const created = { id: '2', name: 'New', priority: null, description: null, path: null, project_context: null, created_at: '2024-01-01' }
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) } as Response)
      const result = await createProject(body)
      expect(result).toEqual(created)
    })

    it('throws with server error message when available', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Name is required' }),
      } as Response)
      await expect(createProject({ name: '' })).rejects.toThrow('Name is required')
    })
  })

  describe('getProject', () => {
    it('returns null on 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ status: 404, ok: false } as Response)
      const result = await getProject('missing')
      expect(result).toBeNull()
    })

    it('returns project on success', async () => {
      const proj = { id: '1', name: 'P1', priority: null, description: null, path: null, project_context: null, created_at: '2024-01-01' }
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(proj) } as Response)
      const result = await getProject('1')
      expect(result).toEqual(proj)
    })
  })

  describe('updateProject', () => {
    it('returns updated project on success', async () => {
      const updated = { id: '1', name: 'Updated', priority: null, description: null, path: null, project_context: null, created_at: '2024-01-01' }
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) } as Response)
      const result = await updateProject('1', { name: 'Updated' })
      expect(result).toEqual(updated)
    })
  })

  describe('archiveProject', () => {
    it('throws on non-ok with error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot archive' }),
      } as Response)
      await expect(archiveProject('1')).rejects.toThrow('Cannot archive')
    })
  })

  describe('listProjectColumns', () => {
    it('returns columns on success', async () => {
      const cols = [{ project_id: 'p1', id: 'c1', title: 'Todo', color: '#ccc', position: 0 }]
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(cols) } as Response)
      const result = await listProjectColumns('p1')
      expect(result).toEqual(cols)
    })
  })

  describe('getWorkItem', () => {
    it('returns null on 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ status: 404, ok: false } as Response)
      const result = await getWorkItem('p1', 'wi1')
      expect(result).toBeNull()
    })
  })

  describe('getApiBase strips trailing slash', () => {
    it('removes trailing slash from base URL', () => {
      // getApiBase uses import.meta.env at load time; we test the behavior
      const base = getApiBase()
      expect(base.endsWith('/')).toBe(false)
    })
  })

  const mockJson = (data: unknown) => ({ ok: true, json: () => Promise.resolve(data) } as Response)

  it('archiveAgent returns result on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'a1', name: 'A', archived_at: '2024-01-01' }) as Response)
    const r = await archiveAgent('a1')
    expect(r.archived_at).toBe('2024-01-01')
  })

  it('createProjectColumn succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ project_id: 'p1', id: 'c1', title: 'Col', color: '#ccc', position: 0 }) as Response)
    const r = await createProjectColumn('p1', { title: 'Col' })
    expect(r.title).toBe('Col')
  })

  it('updateProjectColumn succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ project_id: 'p1', id: 'c1', title: 'Updated', color: '#ccc', position: 0 }) as Response)
    const r = await updateProjectColumn('p1', 'c1', { title: 'Updated' })
    expect(r.title).toBe('Updated')
  })

  it('deleteProjectColumn succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await expect(deleteProjectColumn('p1', 'c1')).resolves.toBeUndefined()
  })

  it('listAllWorkItems with includeArchived', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson([{ id: 'wi1', project_id: 'p1', title: 'T', priority: 'Medium', description: null, assigned_to: null, depends_on: null, status: 'todo', require_approval: false, archived_at: null, created_at: '', updated_at: '', project_name: 'P' }]) as Response)
    const r = await listAllWorkItems({ includeArchived: true })
    expect(r).toHaveLength(1)
  })

  it('listWorkItems succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson([]) as Response)
    const r = await listWorkItems('p1')
    expect(r).toEqual([])
  })

  it('createWorkItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'wi1', project_id: 'p1', title: 'T', priority: 'Medium', description: null, assigned_to: null, depends_on: null, status: 'todo', require_approval: false, archived_at: null, created_at: '', updated_at: '' }) as Response)
    const r = await createWorkItem('p1', { title: 'T' })
    expect(r.title).toBe('T')
  })

  it('updateWorkItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'wi1', project_id: 'p1', title: 'Updated', priority: 'Medium', description: null, assigned_to: null, depends_on: null, status: 'in_progress', require_approval: false, archived_at: null, created_at: '', updated_at: '' }) as Response)
    const r = await updateWorkItem('p1', 'wi1', { status: 'in_progress' })
    expect(r.status).toBe('in_progress')
  })

  it('archiveWorkItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'wi1', project_id: 'p1', title: 'T', priority: 'Medium', description: null, assigned_to: null, depends_on: null, status: 'todo', require_approval: false, archived_at: '2024-01-01', created_at: '', updated_at: '' }) as Response)
    const r = await archiveWorkItem('p1', 'wi1')
    expect(r.archived_at).toBe('2024-01-01')
  })

  it('addWorkItemComment succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'c1', work_item_id: 'wi1', author_type: 'user', author_id: null, body: 'Hi', created_at: '' }) as Response)
    const r = await addWorkItemComment('p1', 'wi1', 'Hi')
    expect(r.body).toBe('Hi')
  })

  it('listInbox with status all', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson([]) as Response)
    const r = await listInbox({ status: 'all' })
    expect(r).toEqual([])
  })

  it('approveInboxItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'i1', project_id: 'p1', work_item_id: 'wi1', agent_id: null, agent_name: 'A', body: '', status: 'approved', created_at: '', resolved_at: '' }) as Response)
    const r = await approveInboxItem('i1')
    expect(r.status).toBe('approved')
  })

  it('rejectInboxItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'i1', project_id: 'p1', work_item_id: 'wi1', agent_id: null, agent_name: 'A', body: '', status: 'rejected', created_at: '', resolved_at: '' }) as Response)
    const r = await rejectInboxItem('i1')
    expect(r.status).toBe('rejected')
  })

  it('listPrompts succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson([]) as Response)
    const r = await listPrompts()
    expect(r).toEqual([])
  })

  it('getPrompt returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ status: 404, ok: false } as Response)
    const r = await getPrompt('key')
    expect(r).toBeNull()
  })

  it('updatePrompt succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ key: 'k', name: 'N', content: 'C', updated_at: '' }) as Response)
    const r = await updatePrompt('k', { content: 'C' })
    expect(r.content).toBe('C')
  })

  it('getContext succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ content: 'ctx' }) as Response)
    const r = await getContext()
    expect(r.content).toBe('ctx')
  })

  it('updateContext succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ content: 'updated' }) as Response)
    const r = await updateContext('updated')
    expect(r.content).toBe('updated')
  })

  it('listContextFiles returns files array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ files: [{ name: 'f', size: 0, updatedAt: '' }] }) as Response)
    const r = await listContextFiles()
    expect(r).toHaveLength(1)
  })

  it('listProjectFiles succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ tree: [] }) as Response)
    const r = await listProjectFiles('p1')
    expect(r.tree).toEqual([])
  })

  it('getProjectFileContent succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ content: 'file content' }) as Response)
    const r = await getProjectFileContent('p1', 'path/to/file')
    expect(r.content).toBe('file content')
  })

  it('updateProjectFileContent succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ content: 'updated' }) as Response)
    const r = await updateProjectFileContent('p1', 'path', 'updated')
    expect(r.content).toBe('updated')
  })

  it('deleteProjectFile succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await expect(deleteProjectFile('p1', 'path')).resolves.toBeUndefined()
  })

  it('listAssets succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ flat: [], tree: [] }) as Response)
    const r = await listAssets('p1')
    expect(r.flat).toEqual([])
    expect(r.tree).toEqual([])
  })

  it('getAsset returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ status: 404, ok: false } as Response)
    const r = await getAsset('p1', 'a1')
    expect(r).toBeNull()
  })

  it('createAsset succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'a1', project_id: 'p1', parent_id: null, name: 'N', type: 'file', path: null, url: null, created_at: '' }) as Response)
    const r = await createAsset('p1', { name: 'N', type: 'file' })
    expect(r.name).toBe('N')
  })

  it('updateAsset succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ id: 'a1', project_id: 'p1', parent_id: null, name: 'N', type: 'file', path: null, url: null, created_at: '' }) as Response)
    const r = await updateAsset('p1', 'a1', { name: 'N' })
    expect(r.name).toBe('N')
  })

  it('deleteAsset succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await expect(deleteAsset('p1', 'a1')).resolves.toBeUndefined()
  })

  it('getProfile succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ first_name: 'F', last_name: 'L', avatar_url: null }) as Response)
    const r = await getProfile()
    expect(r.first_name).toBe('F')
  })

  it('updateProfile succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ first_name: 'F', last_name: 'L', avatar_url: null }) as Response)
    const r = await updateProfile({ first_name: 'F' })
    expect(r.first_name).toBe('F')
  })

  it('linkAssetToWorkItem succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ linked: true }) as Response)
    const r = await linkAssetToWorkItem('p1', 'wi1', 'a1')
    expect(r.linked).toBe(true)
  })

  it('deleteContextFile succeeds on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await expect(deleteContextFile('f')).resolves.toBeUndefined()
  })

  it('createProject throws when server returns error without error body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) } as Response)
    await expect(createProject({ name: 'x' })).rejects.toThrow('Failed to create project')
  })

  it('createProject throws generic when res.json() rejects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: () => Promise.reject(new Error('parse')) } as Response)
    await expect(createProject({ name: 'x' })).rejects.toThrow('Failed to create project')
  })

  it('uploadContextFile succeeds', async () => {
    const file = new File(['content'], 'ctx.md', { type: 'text/markdown' })
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ name: 'ctx.md', size: 7, updatedAt: '' }) as Response)
    const r = await uploadContextFile(file)
    expect(r.name).toBe('ctx.md')
  })

  it('uploadProfileAvatar succeeds', async () => {
    const file = new File([new Blob(['x'])], 'avatar.png', { type: 'image/png' })
    vi.mocked(fetch).mockResolvedValueOnce(mockJson({ first_name: 'F', last_name: 'L', avatar_url: '/api/profile/avatar' }) as Response)
    const r = await uploadProfileAvatar(file)
    expect(r.avatar_url).toBe('/api/profile/avatar')
  })
})
