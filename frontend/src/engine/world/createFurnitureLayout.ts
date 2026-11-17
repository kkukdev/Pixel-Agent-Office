import { Assets, Container, Sprite, Texture } from 'pixi.js'


// 오피스에 배치할 가구 레이아웃 생성
export async function createFurnitureLayout() {
    const base = `${import.meta.env.BASE_URL}assets/`

    // 가구 텍스처 로드
    const [deskFront, deskSide, pcFront, pcSide, pcBack, chairFront, chairSide, chairBack] = await Promise.all([
        Assets.load<Texture>(`${base}furniture/DESK/DESK_FRONT.png`),
        Assets.load<Texture>(`${base}furniture/DESK/DESK_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_FRONT_ON_1.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_BACK.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png`),
    ])

    // 픽셀 필터 설정
    for (const texture of [deskFront, deskSide, pcFront, pcSide, pcBack, chairFront, chairSide, chairBack]) {
        texture.source.scaleMode = 'nearest'
    }


    // 가구 컨테이너 생성
    const furniture = new Container()


    // 책상 크기 설정
    const deskWidth = 32    // 책상 폭 설정
    const deskHeight = 80   // 책상 높이 설정
    const rowPitch = 52


    // 중앙 업무 공간 배치 함수
    function createSideWorkstations(x: number, y: number, rowCount: number) {
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

                row.addChild(desk, pc, chair)
            }

            workstation.addChild(row)
        }

        return workstation
    }


    // 중앙 아래 책상 및 의자 배치
    const lowerWorkstations = createSideWorkstations(322, 220, 3)


    // 중앙 위 책상 및 의자 배치
    const upperWorkstations = createSideWorkstations(322, 76, 2)

    // 위쪽 한자리 추가
    const endDesk = new Sprite(deskFront)
    endDesk.width = 70
    endDesk.height = 58
    endDesk.position.set(-3, -33)

    const endPC = new Sprite(pcBack)
    endPC.position.set(deskWidth - 8, -14)

    const endChair = new Sprite(chairFront)
    endChair.position.set(deskWidth - 8, -38)

    upperWorkstations.addChildAt(endChair, 0)
    upperWorkstations.addChildAt(endDesk, 1)
    upperWorkstations.addChild(endPC)


    // 프로젝트실 책상 및 의자 배치
    const projectWorkstations = new Container()
    projectWorkstations.position.set(55, 462)

    const projectDeskWidth = 70
    const projectDeskHeight = 58

    for (const x of [0, 64]) {
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

            if (isBottom) {
                projectWorkstations.addChild(desk, pc, chair)
            } else {
                projectWorkstations.addChild(chair, desk, pc)
            }
        }
    }


    // 가구 컨테이너에 배치
    furniture.addChild(lowerWorkstations, upperWorkstations, projectWorkstations)
    return furniture
}