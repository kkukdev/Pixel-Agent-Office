import type { Application, Container } from 'pixi.js'


type ViewPoint = { 
    x: number,
    y: number 
}


const MAX_ZOOM = 2.5
const WHEEL_ZOOM_STEP = 1.12
const DRAG_THRESHOLD = 6


export function bindOfficeViewport(app: Application, office: Container) {
    const canvas = app.canvas
    const listeners = new AbortController()
    const { signal } = listeners
    const pointers = new Map<number, ViewPoint>()

    let dragStart: ViewPoint | undefined
    let didDrag = false


    // CSS로 축소된 캔버스의 포인터 좌표를 Pixi 화면 좌표로 변환
    function toScreenPoint(event: MouseEvent): ViewPoint {
        const bounds = canvas.getBoundingClientRect()

        return {
            x: (event.clientX - bounds.left) * app.screen.width / bounds.width,
            y: (event.clientY - bounds.top) * app.screen.height / bounds.height,
        }
    }


    function applyView(scale: number, x: number, y: number) {
        const minX = app.screen.width * (1 - scale)
        const minY = app.screen.height * (1 - scale)

        office.scale.set(scale)
        office.position.set(
            Math.max(minX, Math.min(0, x)),
            Math.max(minY, Math.min(0, y)),
        )

        app.render()
    }


    // 확대 전 기준점 아래의 지도 위치가 확대 후 기준점에 오도록 배율과 위치를 적용
    function zoomAt(scale: number, before: ViewPoint, after = before) {
        const nextScale = Math.max(1, Math.min(MAX_ZOOM, scale))
        const ratio = nextScale / office.scale.x

        applyView(
            nextScale,
            after.x - (before.x - office.x) * ratio,
            after.y - (before.y - office.y) * ratio,
        )
    }


    function onWheel(event: WheelEvent) {
        if (event.deltaY === 0) return

        event.preventDefault()

        const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP
        zoomAt(office.scale.x * factor, toScreenPoint(event))
    }


    function onPointerDown(event: PointerEvent) {
        if (event.button !== 0 || pointers.size >= 2) return

        const point = toScreenPoint(event)

        if (pointers.size === 0) {
            dragStart = point
            didDrag = false
        }

        pointers.set(event.pointerId, point)
        canvas.setPointerCapture(event.pointerId)

        if (pointers.size === 2) didDrag = true
    }


    function onPointerMove(event: PointerEvent) {
        const previous = pointers.get(event.pointerId)

        if (!previous) return

        const point = toScreenPoint(event)
        pointers.set(event.pointerId, point)

        if (pointers.size === 2) {
            const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1]

            if (!other) return

            const previousDistance = Math.hypot(previous.x - other.x, previous.y - other.y)
            const distance = Math.hypot(point.x - other.x, point.y - other.y)

            if (previousDistance === 0) return

            zoomAt(
                office.scale.x * distance / previousDistance,
                { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 },
                { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 },
            )

            return
        }

        let from = previous

        if (!didDrag && dragStart) {
            const distance = Math.hypot(point.x - dragStart.x, point.y - dragStart.y)
            if (distance < DRAG_THRESHOLD) return

            didDrag = true
            from = dragStart
        }

        applyView(office.scale.x, office.x + point.x - from.x, office.y + point.y - from.y)
    }


    function onPointerEnd(event: PointerEvent) {
        pointers.delete(event.pointerId)

        // Pixi의 pointertap 처리까지 드래그 여부를 유지
        // 다음 조작이 시작되면 onPointerDown에서 초기화
    }


    canvas.addEventListener('wheel', onWheel, { passive: false, signal })
    canvas.addEventListener('pointerdown', onPointerDown, { signal })
    canvas.addEventListener('pointermove', onPointerMove, { signal })
    canvas.addEventListener('pointerup', onPointerEnd, { signal })
    canvas.addEventListener('pointercancel', onPointerEnd, { signal })
    canvas.addEventListener('lostpointercapture', onPointerEnd, { signal })

    return {
        didDrag: () => didDrag,
        reset: () => applyView(1, 0, 0),
        destroy: () => listeners.abort(),
    }
}