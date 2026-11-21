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


interface PathNode {
    point: PointData
    cost: number
    estimate: number
    previous?: PathNode
}


function connectOrthogonally(
    from: PointData,
    to: PointData,
    floorBounds: Rectangle,
    walls: readonly Rectangle[],
): PointData[] | null {
    if (from.x === to.x || from.y === to.y) {
        return canWalkPath(from, [to], floorBounds, walls) ? [to] : null
    }

    const corners = [
        { x: from.x, y: to.y },
        { x: to.x, y: from.y },
    ]

    for (const corner of corners) {
        const path = [corner, to]
        if (canWalkPath(from, path, floorBounds, walls)) return path
    }

    return null
}


/**
 * 시작 발 위치에서 목적지까지 벽을 피하는 경유점을 찾기
 * 반환한 경로에는 목적지가 포함되며, 도달할 수 없으면 null을 반환
 *
 * @param start
 * @param goal
 * @param floorBounds
 * @param walls
 */
export function findOfficePath(
    start: PointData,
    goal: PointData,
    floorBounds: Rectangle,
    walls: readonly Rectangle[],
): PointData[] | null {
    const direct = connectOrthogonally(start, goal, floorBounds, walls)
    if (direct) return direct

    const gridSize = 8
    const directions = [[8, 0], [-8, 0], [0, 8], [0, -8]] as const
    const keyOf = ({ x, y }: PointData) => `${x},${y}`
    const distanceToGoal = ({ x, y }: PointData) => Math.hypot(goal.x - x, goal.y - y)
    const bestCost = new Map<string, number>([[keyOf(start), 0]])
    const open: PathNode[] = [
        { point: start, cost: 0, estimate: distanceToGoal(start) },
    ]

    while (open.length > 0) {
        // 지금까지 이동한 거리와 목적지까지의 예상 거리가 가장 작은 점부터 확인
        open.sort((a, b) => b.estimate - a.estimate)

        const current = open.pop()

        if (!current) break
        if (current.cost !== bestCost.get(keyOf(current.point))) continue

        const goalPath = distanceToGoal(current.point) <= gridSize
            ? connectOrthogonally(current.point, goal, floorBounds, walls)
            : null

        if (goalPath) {
            const points: PointData[] = []

            for (let node = current; node.previous; node = node.previous) {
                points.push(node.point)
            }

            points.reverse()
            points.push(...goalPath)

            const simplified: PointData[] = []
            let from = start

            for (let index = 0; index < points.length;) {
                let farthest = points.length - 1
                let shortcut = connectOrthogonally(from, points[farthest], floorBounds, walls)

                while (!shortcut && farthest > index) {
                    farthest--
                    shortcut = connectOrthogonally(from, points[farthest], floorBounds, walls)
                }

                if (!shortcut) return null

                simplified.push(...shortcut)
                from = points[farthest]
                index = farthest + 1
            }

            return simplified
        }

        for (const [dx, dy] of directions) {
            const next = { x: current.point.x + dx, y: current.point.y + dy }
            const key = keyOf(next)
            const cost = current.cost + gridSize

            if (cost >= (bestCost.get(key) ?? Infinity)) continue
            if (!canWalkPath(current.point, [next], floorBounds, walls)) continue

            bestCost.set(key, cost)

            open.push({
                point: next,
                cost,
                estimate: cost + distanceToGoal(next),
                previous: current,
            })
        }
    }

    return null
}