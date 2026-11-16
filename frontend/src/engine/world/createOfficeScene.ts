import { Assets, Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js'


export async function createOfficeScene() {
    const base = `${import.meta.env.BASE_URL}assets/`

    // 필요한 텍스처를 비동기적으로 로드
    const [deskTexture, pcFront, pcBack, chairBack, chairFront, characterSheets, meetingTableTexture, meetingFloorTexture, floorTexture] = 
        await Promise.all([
            Assets.load<Texture>(`${base}furniture/DESK/DESK_FRONT.png`),
            Assets.load<Texture>(`${base}furniture/PC/PC_FRONT_ON_1.png`),
            Assets.load<Texture>(`${base}furniture/PC/PC_BACK.png`),
            Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png`),
            Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png`),
            Promise.all(
                Array.from({ length: 6 }, (_, index) =>
                    Assets.load<Texture>(`${base}characters/char_${index}.png`),
                ),
            ),
            Assets.load<Texture>(`${base}furniture/TABLE_FRONT/TABLE_FRONT.png`),
            Assets.load<Texture>(`${base}floors/floor_0.png`),
            Assets.load<Texture>(`${base}floors/floor_6.png`),
        ])

    // 픽셀 필터 설정
    // - 모든 텍스처에 대해 scaleMode를 'nearest'로 설정하여 픽셀 아트 스타일을 유지
    for (const texture of [deskTexture, pcFront, pcBack, chairBack, chairFront, ...characterSheets, meetingTableTexture, meetingFloorTexture, floorTexture]) {
        texture.source.scaleMode = 'nearest'
    }

    function createDeveloperSeat(x: number, row: 'top' | 'bottom', characterSheet: Texture) {
        const isTopRow = row === 'top'
        const desk = new Sprite(deskTexture)
        const pc = new Sprite(isTopRow ? pcBack : pcFront)
        const chair = new Sprite(isTopRow ? chairFront : chairBack)

        const deskY = isTopRow ? 10 : 7
        const chairY = deskY + (isTopRow ? -24 : 21)

        desk.position.set(0, deskY)
        pc.position.set(desk.x + 16, desk.y)
        chair.position.set(16, chairY)

        const seat = new Container()
        seat.position.set(x, isTopRow ? 112 : 130)

        // 위쪽 좌석은 아래를, 아래쪽 좌석은 위를 향하는 프레임을 사용
        const frameY = isTopRow ? 0 : 32
        const developerTexture = new Texture({
            source: characterSheet.source,
            frame: new Rectangle(16, frameY, 16, 32),
        })
        
        const developer = new Sprite(developerTexture)

        developer.position.set(chair.x, chair.y)
        developer.once('destroyed', () => developerTexture.destroy())

        if (isTopRow) {
            seat.addChild(chair, developer, desk, pc)
        } else {
            // 앉은 캐릭터 앞에 의자 등받이가 보이도록 의자를 마지막에 그리도록 순서를 조정
            seat.addChild(desk, pc, developer, chair)
        }

        return seat
    }

    const floor = new TilingSprite({
        texture: floorTexture,
        width: 512,
        height: 272,
    })
    floor.position.set(16, 32)
    floor.tint = 0xd29d71

    const office = new Container()
    // 좌석이 바닥 위에 그려지도록 바닥을 먼저 추가
    office.addChild(floor)

    for (const [column, x] of [48, 92,136].entries()) {
        office.addChild(createDeveloperSeat(x, 'top', characterSheets[column + 3]))
        office.addChild(createDeveloperSeat(x, 'bottom', characterSheets[column]))
    }

    // 회의 영역 설정: 사무실 오른쪽 위에 배치
    // - 회의 영역은 테이블과 의자로 구성되며, 의자는 테이블 앞뒤로 배치
    const meetingArea = new Container()
    meetingArea.position.set(272, 112)

    const meetingFloor = new TilingSprite({
        texture: meetingFloorTexture,
        width: 128,
        height: 90,
    })
    meetingFloor.position.set(0, -5)
    meetingArea.addChild(meetingFloor)

    const chairXs = [20, 44, 68, 92]

    // 위쪽 의자의 아랫부분은 테이블 뒤로 들어가도록 설정
    for (const x of chairXs) {
        const chair = new Sprite(chairFront)
        chair.position.set(x, -9)
        meetingArea.addChild(chair)
    }

    const meetingTable = new Sprite(meetingTableTexture)
    meetingTable.width = 96
    meetingTable.height = 48
    meetingTable.position.set(16, 7)
    meetingArea.addChild(meetingTable)

    for (const x of chairXs) {
        const chair = new Sprite(chairBack)
        chair.position.set(x, 38)
        meetingArea.addChild(chair)
    }

    office.addChild(meetingArea)

    return office
}