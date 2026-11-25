import { useEffect, useState } from 'react'

type Project = { project_id: string }
type PullRequest = { number: number; title: string }

type ListState<T> =
  | { status: 'loading' }
  | { status: 'ready'; items: T[] }
  | { status: 'error'; message: string }


/** 컴포넌트가 사라지면 사용 중인 목록 요청을 취소 */
function useApiList<T>(url: string): ListState<T> {
    const [state, setState] = useState<ListState<T>>({ status: 'loading' })

    useEffect(() => {
        const controller = new AbortController()

        async function load() {
            try {
                const response = await fetch(url, { signal: controller.signal })

                if (response.status === 401) {
                    throw new Error('관리자 로그인이 필요합니다.')
                }
                if (response.status === 403) {
                    throw new Error('관리자 권한이 필요합니다.')
                }
                if (!response.ok) {
                    throw new Error('목록을 불러오지 못했습니다.')
                }

                const items: unknown = await response.json()
                if (!Array.isArray(items)) {
                    throw new Error('목록 응답 형식이 올바르지 않습니다.')
                }

                if (!controller.signal.aborted) {
                    setState({
                        status: 'ready',
                        items: items as T[],
                    })
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setState({
                        status: 'error',
                        message: error instanceof Error ? error.message : '목록을 불러오지 못했습니다.',
                    })
                }
            }
        }

        void load()

        return () => controller.abort()
    }, [url])

    return state
}


function PullRequestPicker({ projectId }: { projectId: string }) {
    const state = useApiList<PullRequest>(
        `/api/projects/${encodeURIComponent(projectId)}/pulls`,
    )
    const pulls = state.status === 'ready' ? state.items : []

    return (
        <div>
            <label htmlFor="review-pull">PR 선택</label>
            <select id="review-pull" name="pull_number" defaultValue="" disabled={pulls.length === 0}>
                <option value="">PR을 선택해 주세요</option>
                {pulls.map(({ number, title}) => (
                    <option key={number} value={number}>{`#${number} ${title}`}</option>
                ))}
            </select>

            {state.status === 'loading' && <p role="status">PR을 불러오는 중입니다.</p>}
            {state.status === 'error' && <p role="alert">{state.message}</p>}
            {state.status === 'ready' && pulls.length === 0 && (
                <p role="status">열린 PR이 없습니다.</p>
            )}
        </div>
    )
}


export function ReviewTargetPicker() {
    const state = useApiList<Project>('/api/projects')
    const [projectId, setProjectId] = useState('')
    const projects = state.status === 'ready' ? state.items : []

    return (
        <div className="review-target-picker">
            <div>
                <label htmlFor="review-project">리뷰 프로젝트</label>
                <select id="review-project" value={projectId} disabled={projects.length === 0} onChange={(event) => setProjectId(event.target.value)}>
                    <option value="">프로젝트를 선택해 주세요.</option>
                    {projects.map(({ project_id }) => (
                        <option key={project_id} value={project_id}>{project_id}</option>
                    ))}
                </select>
                {state.status === 'loading' && <p role="status">프로젝트를 불러오는 중입니다.</p>}
                {state.status === 'error' && <p role="alert">{state.message}</p>}
                {state.status === 'ready' && projects.length === 0 && (
                    <p role="status">등록된 프로젝트가 없습니다.</p>
                )}
            </div>
            {projectId && <PullRequestPicker key={projectId} projectId={projectId} />}
        </div>
    )
}