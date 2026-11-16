import { Assets, Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js'


export async function createOfficeScene() {
    const base = `${import.meta.env.BASE_URL}assets/`

    const [deskTexture, pcFront, pcBack, chairBack, chairFront, characterSheets, floorTexture] = 
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
            Assets.load<Texture>(`${base}floors/floor_6.png`),
        ])

    for (const texture of [deskTexture, pcFront, pcBack, chairBack, chairFront, ...characterSheets, floorTexture]) {
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

    return office
}