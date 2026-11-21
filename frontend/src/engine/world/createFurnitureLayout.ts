import { Assets, Container, Sprite, Texture, Rectangle } from 'pixi.js'

import type { OfficeSeat } from './officeSeat'


// 오피스에 배치할 가구 레이아웃 생성
export async function createFurnitureLayout() {
    const base = `${import.meta.env.BASE_URL}assets/`

    // 가구 텍스처 로드
    const [deskFront, deskSide, pcFront, pcSide, pcBack, chairFront, chairSide, chairBack, meetingChairFront, meetingChairSide] = await Promise.all([
        Assets.load<Texture>(`${base}furniture/DESK/DESK_FRONT.png`),
        Assets.load<Texture>(`${base}furniture/DESK/DESK_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_FRONT_ON_1.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_BACK.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png`),
        Assets.load<Texture>(`${base}furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png`),
        Assets.load<Texture>(`${base}furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_SIDE.png`),
    ])

    // 픽셀 필터 설정
    for (const texture of [
        deskFront, deskSide,
        pcFront, pcSide, pcBack,
        chairFront, chairSide, chairBack,
        meetingChairFront, meetingChairSide
    ]) {
        texture.source.scaleMode = 'nearest'
    }


    // 가구 컨테이너 생성
    const furniture = new Container()


    // 캐릭터를 앉힐 좌석 목록
    const seats: OfficeSeat[] = []
    const sideSeats: OfficeSeat[] = []
    const deskBounds: Rectangle[] = []


    // 책상 크기 설정
    const deskWidth = 32    // 책상 폭 설정
    const deskHeight = 80   // 책상 높이 설정
    const rowPitch = 52


    // 중앙 업무 공간 배치 함수
    function createSideWorkstations(groupId: string, x: number, y: number, rowCount: number) {
        const workstation = new Container()
        workstation.position.set(x, y)

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const row = new Container()
            row.y = rowIndex * rowPitch

            for (const isRight of [false, true]) {
                const desk = new Sprite(deskSide)
                desk.width = deskWidth
                desk.height = deskHeight

                const pc = new Sprite(pcSide)
                const chair = new Sprite(chairSide)

                if (isRight) {
                    // 오른쪽 가구 배치 (좌우 반전)
                    desk.scale.x *= -1
                    pc.scale.x = -1
                    chair.scale.x = -1

                    desk.x = deskWidth * 2
                    pc.position.set(deskWidth + 16, 25)
                    chair.position.set(deskWidth * 2 + 16, 22)
                } else {
                    // 왼쪽 가구 배치
                    pc.position.set(deskWidth - 16, 25)
                    chair.position.set(-16, 22)
                }

                const occupantLayer = new Container()
                occupantLayer.position.set(chair.x + (isRight ? -14 : -2), chair.y)

                sideSeats.push({
                    id: `${groupId}-${rowIndex + 1}-${isRight ? 'right' : 'left'}`,
                    facing: isRight ? 'left' : 'right',
                    occupantLayer,
                })

                row.addChild(desk, pc, chair, occupantLayer)
            }

            workstation.addChild(row)
        }

        // 책상이 보이는 구간: Y = 11 ~ 59
        const visibleTop = Math.round(deskHeight * 11 / 64)
        const visibleBottom = Math.round(deskHeight * 59 / 64)

        deskBounds.push(new Rectangle(
            x,
            y + visibleTop,
            deskWidth * 2,
            (rowCount - 1) * rowPitch + visibleBottom - visibleTop,
        ))

        return workstation
    }


    // 중앙 아래 책상 및 의자 배치
    const lowerWorkstations = createSideWorkstations('central-lower', 322, 220, 3)
    // 중앙 위 책상 및 의자 배치
    const upperWorkstations = createSideWorkstations('central-upper', 322, 76, 2)

    // 위쪽 한자리 추가
    const endDesk = new Sprite(deskFront)
    endDesk.width = 70
    endDesk.height = 58
    endDesk.position.set(-3, -33)

    const endPC = new Sprite(pcBack)
    endPC.position.set(deskWidth - 8, -14)

    const endChair = new Sprite(chairFront)
    endChair.position.set(deskWidth - 8, -38)

    const endOccupantLayer = new Container()
    endOccupantLayer.position.copyFrom(endChair.position)

    seats.push({
        id: 'central-upper-end',
        facing: 'down',
        occupantLayer: endOccupantLayer,
    })

    // 앉은 캐릭터가 의자 앞에 보이고 하체는 책상에 가려지도록 순서 조정
    upperWorkstations.addChildAt(endChair, 0)
    upperWorkstations.addChildAt(endOccupantLayer, 1)
    upperWorkstations.addChildAt(endDesk, 2)
    upperWorkstations.addChild(endPC)


    // 프로젝트실 책상 및 의자 배치
    const projectWorkstations = new Container()
    projectWorkstations.position.set(55, 462)

    const projectDeskWidth = 70
    const projectDeskHeight = 58

    for (const [column, x] of [0, 64].entries()) {
        for (const isBottom of [false, true]) {
            const y = isBottom ? 38 : 12
            const centerX = x + projectDeskWidth / 2

            const desk = new Sprite(deskFront)
            desk.width = projectDeskWidth
            desk.height = projectDeskHeight
            desk.position.set(x, y)

            const pc = new Sprite(isBottom ? pcFront : pcBack)
            pc.position.set(centerX - pc.width / 2, y + (isBottom ? 12 : 19))

            const chair = new Sprite(isBottom ? chairBack : chairFront)
            chair.position.set(centerX - chair.width / 2, y + (isBottom ? 41 : -5))
            
            const occupantLayer = new Container()
            occupantLayer.position.copyFrom(chair.position)

            seats.push({
                id: `project-${column + 1}-${isBottom ? 'bottom' : 'top'}`,
                facing: isBottom ? 'up' : 'down',
                occupantLayer,
            })

            if (isBottom) {
                projectWorkstations.addChild(desk, pc, occupantLayer, chair)
            } else {
                projectWorkstations.addChild(chair, occupantLayer, desk, pc)
            }
        }
    }


    // 회의실 테이블 및 의자 배치
    const meetingArea = new Container()
    meetingArea.position.set(560, 80)

    // 회의실 테이블 설정 (텍스처, 크기)
    // - 업무석과 같은 크기의 책상 6개를 2열 × 3행으로 붙여 회의 테이블을 구성
    const tableWidth = deskWidth * 2

    // 회의실 의자 설정 (텍스처, 위치)
    // - 회의실 의자는 회의실 테이블을 기준으로 위치 계산
    const endMeetingChair = new Sprite(meetingChairFront)
    endMeetingChair.position.set((tableWidth - endMeetingChair.width) / 2, 0)

    meetingArea.addChild(endMeetingChair)

    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
        const rowY = rowIndex * rowPitch

        const leftDesk = new Sprite(deskSide)
        leftDesk.width = deskWidth
        leftDesk.height = deskHeight
        leftDesk.position.set(0, rowY)

        const rightDesk = new Sprite(deskSide)
        rightDesk.width = deskWidth
        rightDesk.height = deskHeight
        rightDesk.scale.x *= -1
        rightDesk.position.set(tableWidth, rowY)

        meetingArea.addChild(leftDesk, rightDesk)

        // 각 책상의 바깥쪽에 의자 두 개를 배치
        for (const offsetY of [23, 49]) {
            const y = rowY + offsetY

            const leftChair = new Sprite(meetingChairSide)
            leftChair.position.set(-14, y)

            const rightChair = new Sprite(meetingChairSide)
            rightChair.scale.x = -1
            rightChair.position.set(tableWidth + 14, y)

            meetingArea.addChild(leftChair, rightChair)
        }
    }


    // 가구 컨테이너에 배치
    furniture.addChild(lowerWorkstations, upperWorkstations, projectWorkstations, meetingArea)
    return { container: furniture, seats: [...seats, ...sideSeats], deskBounds }
}