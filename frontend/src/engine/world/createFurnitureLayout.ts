import { Assets, Container, Sprite, Texture } from 'pixi.js'


// 오피스에 배치할 가구 레이아웃 생성
export async function createFurnitureLayout() {
    const base = `${import.meta.env.BASE_URL}assets/`

    // 가구 텍스처 로드
    const [deskSide, pcSide, chairSide] = await Promise.all([
        Assets.load<Texture>(`${base}furniture/DESK/DESK_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/PC/PC_SIDE.png`),
        Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png`),
    ])

    // 픽셀 필터 설정
    for (const texture of [deskSide, pcSide, chairSide]) {
        texture.source.scaleMode = 'nearest'
    }


    // 가구 컨테이너 생성
    const furniture = new Container()


    // 작업공간 컨테이너 생성
    const workstation = new Container()
    workstation.position.set(322, 220)  // 작업공간 시작 위치 설정


    // 책상 배치
    const deskWidth = 32    // 책상 폭 설정
    const deskHeight = 80   // 책상 높이 설정
    const rowPitch = 52

    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
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

    furniture.addChild(workstation)
    return furniture
}