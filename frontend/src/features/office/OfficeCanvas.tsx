import { Application } from 'pixi.js'
import { useEffect, useRef, useState } from "react"

export function OfficeCanvas() {
    const hostRef = useRef<HTMLDivElement>(null)
    const [loadFailed, setLoadFailed] = useState(false)

    useEffect(() => {
        const host = hostRef.current

        if (!host) return

        const app = new Application()
        let disposed = false
        let initialized = false

        async function mountCanvas() {
            try {
                await app.init({
                    width: 640,
                    height: 260,
                    backgroundColor: 0x0f172a,
                    // 현재 장면은 정적이므로 자동 렌더링 루프를 끄고 app.render()로 한 번만 그림
                    autoStart: false,
                })
            } catch (error) {
                if (!disposed) {
                    console.error('오피스 캔버스 초기화 실패', error)
                    setLoadFailed(true)
                }

                return
            }

            initialized = true

            // StrictMode에서는 초기화가 끝나기 전에 정리 함수가 실행될 수 있음
            // 이 경우 캔버스를 DOM에 붙이기 전에 PixiJS 리소스를 정리
            if (disposed) {
                app.destroy({removeView: true}, {children: true})
                return
            }

            host?.appendChild(app.canvas)
            app.render()
        }

        void mountCanvas()

        return () => {
            disposed = true

            if (initialized) {
                app.destroy({removeView: true}, {children: true})
            }            
        }
    }, [])

    return (
        <>
            <div className="office-canvas" ref={hostRef} aria-hidden="true" />
            {loadFailed && <p role="status">오피스 화면을 불러오지 못했습니다.</p>}
        </>
    )
}