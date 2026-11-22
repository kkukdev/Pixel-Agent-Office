import { Application } from 'pixi.js'
import { useEffect, useRef, useState } from "react"

import { createOfficeLayout, OFFICE_MAP_SIZE } from '../../engine/world/createOfficeLayout'


export function OfficeCanvas({
    onSeatSelect,
    onSeatsReady,
}: {
    onSeatSelect: (seatId: string) => void
    onSeatsReady: (seatIds: string[]) => void
}) {
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

                const { office, seatIds } = await createOfficeLayout(app.ticker, onSeatSelect)
                if (disposed) {
                    office.destroy({ children: true })
                    return
                }

                app.stage.addChild(office)
                host?.appendChild(app.canvas)
                app.render()
                onSeatsReady(seatIds)
            } catch (error) {
                if (disposed) return

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

            if (initialized) {
                app.destroy({removeView: true}, {children: true})
            }            
        }
    }, [onSeatSelect, onSeatsReady])

    return (
        <>
            <div className="office-canvas" ref={hostRef} aria-hidden="true" />
            {loadFailed && <p role="status">오피스 화면을 불러오지 못했습니다.</p>}
        </>
    )
}