import { Assets, Container, Graphics, Rectangle, Texture, TilingSprite, Ticker  } from 'pixi.js'

import { findOfficePath } from './officeNavigation'
import { createFurnitureLayout } from './createFurnitureLayout'
import { createOfficeCharacter } from './createOfficeCharacter'

import type { OfficeFacing } from './officeSeat'


// 전체 오피스 맵의 크기 정의: 45칸 x 40칸, 각 칸은 16px (타일 크기)
export const OFFICE_MAP_SIZE = {
    width: 720,
    height: 640
}


/**
 * 바닥, 벽, 가구를 배치하고 좌석에 캐릭터를 연결해 오피스 장면을 생성
 * 중앙 위쪽 끝 좌석 캐릭터에는 좌석과 통로를 왕복하는 클릭 동작 연결
 *
 * @param ticker    캐릭터가 이동하는 동안 위치와 걷기 프레임을 갱신하는 ticker
 *
 * @returns         오피스 컨테이너와 선택 가능한 좌석 ID 목록
 */
export async function createOfficeLayout(
    ticker: Ticker,
    onSeatSelect: (seatId: string) => void,
) {
    const base = `${import.meta.env.BASE_URL}assets/`

    const [floorTexture, wallAtlas, plainFloor, gridFloor, checkFloor, furnitureLayout] = await Promise.all([
        Assets.load<Texture>(`${base}floors/floor_6.png`),
        Assets.load<Texture>(`${base}walls/wall_0.png`),
        Assets.load<Texture>(`${base}floors/floor_0.png`),
        Assets.load<Texture>(`${base}floors/floor_3.png`),
        Assets.load<Texture>(`${base}floors/floor_7.png`),
        createFurnitureLayout(),
    ])

    const { container: furniture, seats, deskBounds } = furnitureLayout

    let endCharacter: Awaited<ReturnType<typeof createOfficeCharacter>> | undefined

    try {
        for (const [index, seat] of seats.entries()) {
            const character = await createOfficeCharacter(index % 6, seat.facing)
            seat.occupantLayer.addChild(character.sprite)

            character.sprite.eventMode = 'static'
            character.sprite.cursor = 'pointer'
            character.sprite.on(
                'pointertap', () => onSeatSelect(seat.id)
            )

            if (seat.id === 'central-upper-end') {
                endCharacter = character
            }
        }
    } catch (error) {
        // 캐릭터 로딩에 실패하면 앞서 좌석에 붙인 캐릭터도 가구와 함께 정리
        furniture.destroy({ children: true })
        throw error
    }

    // 픽셀 필터 설정
    for (const texture of [floorTexture, wallAtlas, plainFloor, gridFloor, checkFloor]) {
        texture.source.scaleMode = 'nearest'
    }

    
    // 오피스 컨테이너 생성
    const office = new Container()


    // 바닥 타일 생성
    const floor = new TilingSprite({
        texture: floorTexture,
        width: 688,
        height: 608
    })
    floor.position.set(16, 20)
    floor.tint = 0xbc956f


    // 각 방의 바닥 생성
    const roomFloors = new Container()

    const rooms = [
        // 대표실
        { left: 16, top: 20, right: 228, bottom: 381, texture: floorTexture, tint: 0xb68564 },
        // 프로젝트실
        { left: 16, top: 381, right: 228, bottom: 628, texture: gridFloor, tint: 0x8caba8 },
        // 회의실
        { left: 479, top: 20, right: 704, bottom: 344, texture: plainFloor, tint: 0x6f97ad },
        // 탕비실
        { left: 479, top: 344, right: 704, bottom: 628, texture: gridFloor, tint: 0xb6ac89 },
        // 쇼룸
        { left: 228, top: 475, right: 479, bottom: 628, texture: checkFloor, tint: 0x82949d },
    ]

    for (const { left, top, right, bottom, texture, tint } of rooms) {
        const roomFloor = new TilingSprite({
            texture,
            width: right - left,
            height: bottom - top,
        })
        roomFloor.position.set(left, top)
        roomFloor.tint = tint
        roomFloors.addChild(roomFloor)
    }


    // 벽 텍스처 생성
    const wallTexture = new Texture({
        source: wallAtlas.source,
        frame: new Rectangle(48, 0, 16, 32),
    })
    office.once('destroyed', () => wallTexture.destroy())

    const wallFaces = new Container()
    const wallEdges = new Graphics()


    // [왼쪽 X, 오른쪽 X, 바닥과 만나는 Y, 화면에 보이는 벽 높이]
    const horizontalWalls = [
        [16, 704, 20, 16],      // 위쪽 외벽
        [16, 267, 628, 7],      // 아래쪽 외벽 왼쪽
        [345, 704, 628, 7],     // 아래쪽 외벽 오른쪽
        [16, 228, 381, 7],      // 대표실과 프로젝트실 사이
        [479, 704, 344, 16],    // 회의실과 탕비실 사이
        [228, 354, 475, 7],     // 쇼룸 개구부 왼쪽
        [448, 479, 475, 7],     // 쇼룸 개구부 오른쪽
    ] as const

    // 벽 생성
    for (const [left, right, y, height] of horizontalWalls) {
        const width = right - left
        const top = y - height
        const wall = new TilingSprite({
            texture: wallTexture,
            width,
            height,
            tileScale: { x: 1, y: height / wallTexture.height },
        })
        wall.position.set(left, top)
        wall.tint = 0x6e8395
        wallFaces.addChild(wall)

        wallEdges.rect(left, top, width, 2).fill(0xadbdc8)
        wallEdges.rect(left, y, width, 2).fill(0x354855)
    }


    // 오피스 각 공간별 출입구 생성: [벽의 중심 X, 시작 Y, 끝 Y]
    const verticalWalls = [
        [16, 20, 628],     // 왼쪽 외벽
        [704, 20, 628],    // 오른쪽 외벽
        [228, 20, 279],    // 대표실 입구는 Y = 279~314
        [228, 314, 394],   // 연구소 입구는 Y = 394~430
        [228, 430, 628],
        [479, 20, 295],    // 회의실 입구는 Y = 295~331
        [479, 331, 344],   // 탕비실 입구는 Y = 344~407
        [479, 407, 628],
    ] as const

    for (const [x, top, bottom] of verticalWalls) {
        const height = bottom - top

        wallEdges.rect(x - 4, top, 9, height).fill(0x354855)
        wallEdges.rect(x - 3, top, 6, height).fill(0x6e8395)
        wallEdges.rect(x - 2, top, 2, height).fill(0xadbdc8)
    }

    const floorBounds = new Rectangle(floor.x, floor.y, floor.width, floor.height)
    // 벽 구간에서 충돌 범위를 계산
    // 출입구는 벽 구간 사이의 빈 공간
    const wallClearance = 8
    const wallBounds = [
        ...horizontalWalls.map(([left, right, y, height]) =>
            new Rectangle(left, y - height, right - left, height + 2),
        ),
        ...verticalWalls.map(([x, top, bottom]) =>
            new Rectangle(x - 4, top, 9, bottom - top),
        ),
    ].map((wall) => wall.pad(wallClearance))

    const blockedBounds = [
        ...wallBounds,
        ...deskBounds.map((desk) => desk.clone().pad(wallClearance)),
    ]

    const movingCharacters = new Container()
    // 공용 바닥 위에 방별 바닥을 깔고, 바닥 경계가 벽 아래에 오도록 벽을 마지막에 추가
    office.addChild(floor, roomFloors, furniture, wallFaces, wallEdges, movingCharacters)

    const endSeat = seats.find((seat) => seat.id === 'central-upper-end')

    if (endCharacter && endSeat) {
        const { sprite: character, setPose } = endCharacter
        const { occupantLayer, facing: seatedFacing } = endSeat
        let isMoving = false

        character.on('pointertap', () => {
            if (isMoving) return

            const returningToSeat = character.parent === movingCharacters
            const seatPosition = movingCharacters.toLocal({ x: 0, y: 0 }, occupantLayer)

            // 스프라이트 좌표 (220, 270)는 발 위치 (228, 300)에 해당
            const ownerDoorway = { x: 220, y: 270 }
            const aboveSeat = { x: seatPosition.x, y: 26 }
            const aisleCorner = { x: 280, y: 26 }
            const seatTarget = { x: seatPosition.x, y: seatPosition.y }
            const ownerRoomTarget = { x: 120, y: 26 }

            // 먼저 책상 위쪽으로 빠져나온 뒤 왼쪽 통로로 이동
            const requestedWaypoints = returningToSeat
                ? [ownerDoorway, aisleCorner, aboveSeat, seatTarget]
                : [aboveSeat, aisleCorner, ownerDoorway, ownerRoomTarget]

            const start = returningToSeat ? character.position : seatPosition
            // 16×32px 스프라이트의 왼쪽 위 좌표를 발 중앙 근처로 옮겨 충돌을 검사
            const toFootPoint = ({ x, y }: { x: number; y: number }) => ({
                x: x + 8,
                y: y + 30,
            })

            const waypoints: { x: number; y: number; facing: OfficeFacing }[] = []
            let from = toFootPoint(start)

            for (const requestedPoint of requestedWaypoints) {
                const goal = toFootPoint(requestedPoint)
                const path = findOfficePath(from, goal, floorBounds, blockedBounds)

                if (!path) return

                for (const point of path) {
                    const dx = point.x - from.x
                    const dy = point.y - from.y

                    if (dx === 0 && dy === 0) continue

                    const facing: OfficeFacing = Math.abs(dx) > Math.abs(dy)
                        ? (dx < 0 ? 'left' : 'right')
                        : (dy < 0 ? 'up' : 'down')

                    waypoints.push({ x: point.x - 8, y: point.y - 30, facing })

                    from = point
                }
            }

            if (waypoints.length === 0) return

            isMoving = true
            character.cursor = 'default'

            // 부모를 바꿔도 화면상의 현재 위치를 유지
            if (!returningToSeat) {
                movingCharacters.reparentChild(character)
            }

            const walkColumns = [0, 1, 2, 1] as const
            const speed = 80 // 초당 이동 거리(px)
            let waypointIndex = 0
            let walkElapsedMs = 0


            /**
             * 이전 프레임 이후 지난 시간만큼 캐릭터를 다음 경유점으로 이동
             * 이동 방향에 맞춰 걷기 프레임을 갱신하고, 마지막 경유점에 도착하면 정지 자세로 전환
             *
             * 좌석으로 돌아온 경우 착석 레이어에 다시 결합
             */
            const updateMovement = (frame: Ticker) => {
                const target = waypoints[waypointIndex]
                const dx = target.x - character.x
                const dy = target.y - character.y
                const distance = Math.hypot(dx, dy)
                const step = speed * frame.deltaMS / 1000

                walkElapsedMs += frame.deltaMS

                const walkIndex = Math.floor(walkElapsedMs / 120) % walkColumns.length

                setPose(target.facing, walkColumns[walkIndex])

                if (distance <= step) {
                    character.position.set(target.x, target.y)
                    waypointIndex++

                    if (waypointIndex === waypoints.length) {
                        if (returningToSeat) {
                            occupantLayer.addChild(character)
                            character.position.set(0, 0)
                        }

                        setPose(returningToSeat ? seatedFacing : target.facing)
                        ticker.remove(updateMovement)
                        ticker.stop()

                        character.cursor = 'pointer'
                        isMoving = false
                    }
                    return
                }

                character.x += dx / distance * step
                character.y += dy / distance * step
            }

            ticker.add(updateMovement)
            ticker.start()
        })
    }

    return {
        office,
        seatOptions: seats.map(({ id, label }) => ({ id, label })),
    }
}