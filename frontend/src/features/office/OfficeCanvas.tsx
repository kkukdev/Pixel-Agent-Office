import { Application } from 'pixi.js'
import { useEffect, useRef, useState } from "react"

import { bindOfficeViewport } from './bindOfficeViewport'
import { createOfficeLayout, OFFICE_MAP_SIZE } from '../../engine/world/createOfficeLayout'

import type { OfficeControls } from '../../engine/world/createOfficeLayout'


export function OfficeCanvas({
    onSeatSelect,
    onOfficeReady,
}: {
    onSeatSelect: (seatId: string) => void
    onOfficeReady: (controls: OfficeControls) => void
}) {
    const hostRef = useRef<HTMLDivElement>(null)
    const resetViewRef = useRef<(() => void) | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)

    useEffect(() => {
        const host = hostRef.current

        if (!host) return

        const app = new Application()

        let disposed = false
        let initialized = false
        let viewport: ReturnType<typeof bindOfficeViewport> | undefined


        function disposeViewport() {
            viewport?.destroy()
            viewport = undefined
            resetViewRef.current = null
        }


        async function mountCanvas() {
            try {
                await app.init({
                    ...OFFICE_MAP_SIZE,
                    backgroundColor: 0x0f172a,
                    // 현재 장면은 정적이므로 자동 렌더링 루프를 끄고 app.render()로 한 번만 그림
                    autoStart: false,
                })

                if (disposed) {
                    app.destroy({removeView: true}, {children: true})
                    return
                }

                initialized = true

                const { office, seatOptions, playMovementDemo } =
                    await createOfficeLayout(app.ticker, (seatId) => {
                        if (!viewport?.didDrag()) onSeatSelect(seatId)
                    })
                if (disposed) {
                    office.destroy({ children: true })
                    return
                }

                app.stage.addChild(office)
                host?.appendChild(app.canvas)

                viewport = bindOfficeViewport(app, office)
                resetViewRef.current = viewport.reset

                app.render()
                onOfficeReady({
                    seatOptions,
                    playMovementDemo: playMovementDemo && (() => {
                        if (!disposed) playMovementDemo()
                    }),
                })
            } catch (error) {
                if (disposed) return

                disposeViewport()

                if (initialized) {
                    app.destroy({ removeView: true }, { children: true })
                    initialized = false
                }

                console.error('오피스 좌석을 불러오지 못했습니다.', error)
                setLoadFailed(true)
            }
        }

        void mountCanvas()

        return () => {
            disposed = true

            disposeViewport()

            if (initialized) {
                app.destroy({removeView: true}, {children: true})
            }            
        }
    }, [onSeatSelect, onOfficeReady])

    return (
        <>
            {!loadFailed && (
                <button type="button" onClick={() => resetViewRef.current?.()}>
                    전체 보기
                </button>
            )}
            <div className="office-canvas" ref={hostRef} aria-hidden="true" />
            {loadFailed && <p role="status">오피스 화면을 불러오지 못했습니다.</p>}
        </>
    )
}