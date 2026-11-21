import type { PointData, Rectangle } from 'pixi.js'


/**
 * 시작점에서 각 경유점을 순서대로 잇는 직선 경로를 검사
 *
 * @param start         오피스 좌표계에서 캐릭터의 시작 위치
 * @param waypoints     같은 좌표계의 경유점 목록으로, 검사 순서대로 전달
 * @param floorBounds   캐릭터가 이동할 수 있는 바닥 영역
 * @param walls         이동을 막는 벽 영역 목록
 *
 * @returns             검사한 지점이 모두 바닥 안에 있고 벽 밖에 있으면 true, 아니면 false
 */
export function canWalkPath(
    start: PointData,
    waypoints: readonly PointData[],
    floorBounds: Rectangle,
    walls: readonly Rectangle[],
) {
    let from = start

    for (const to of waypoints) {
        const dx = to.x - from.x
        const dy = to.y - from.y
        // 경유점 사이에 놓인 벽도 감지할 수 있도록 약 1px 간격으로 검사
        const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy)))

        for (let index = 0; index <= samples; index++) {
            const progress = index / samples
            const x = from.x + dx * progress
            const y = from.y + dy * progress

            if (!floorBounds.contains(x, y) || walls.some((wall) => wall.contains(x, y))) {
                return false
            }
        }

        from = to
    }

    return true
}