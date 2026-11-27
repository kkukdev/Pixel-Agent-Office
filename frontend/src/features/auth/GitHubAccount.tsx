import { useEffect, useState } from 'react'


type AccountState =
    | { status: 'loading' }
    | { status: 'signed-out' }
    | { status: 'signed-in'; login: string }
    | { status: 'error' }


const authPath = '/api/auth/github'


export function GitHubAccount() {
    const [account, setAccount] = useState<AccountState>({ status: 'loading' })
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [logoutError, setLogoutError] = useState(false)

    useEffect(() => {
        const controller = new AbortController()

        async function loadAccount() {
            try {
                const response = await fetch(`${authPath}/session`, {
                    signal: controller.signal,
                })

                if (response.status === 401) {
                    setAccount({ status: 'signed-out' })
                    return
                }
                if (!response.ok) {
                    throw new Error('GitHub 세션 조회 실패')
                }

                const data = await response.json()
                if (typeof data?.login !== 'string' || !data.login) {
                    throw new Error('GitHub 사용자명 누락')
                }
                if (!controller.signal.aborted) {
                    setAccount({ status: 'signed-in', login: data.login })
                }
            } catch {
                if (!controller.signal.aborted) {
                    setAccount({ status: 'error' })
                }
            }
        }

        void loadAccount()
        return () => controller.abort()
    }, [])

    async function signOut() {
        setIsSigningOut(true)
        setLogoutError(false)

        try {
            const response = await fetch(`${authPath}/logout`, {
                method: 'POST',
                headers: { 'X-Office-Action': 'github-logout' },
            })

            if (response.status !== 204) {
                throw new Error('GitHub 로그아웃 실패')
            }

            setAccount({ status: 'signed-out' })
        } catch {
            setLogoutError(true)
        } finally {
            setIsSigningOut(false)
        }
    }

    if (account.status === 'loading') {
        return <p role="status">GitHub 연결을 확인하는 중입니다.</p>
    }
    if (account.status === 'error') {
        return <p role="alert">GitHub 연결 상태를 확인하지 못했습니다.</p>
    }
    if (account.status === 'signed-out') {
        return <a href={`${authPath}/login`}>GitHub 계정 연결</a>
    }

    return (
        <div>
            <span>GitHub @{account.login}</span>{' '}
            <button type="button" onClick={() => void signOut()} disabled={isSigningOut}>{isSigningOut ? '로그아웃 중...' : '로그아웃'}</button>
            {logoutError && <p role="alert">로그아웃하지 못했습니다.</p>}
        </div>
    )
}