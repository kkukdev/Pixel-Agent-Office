import { Assets, Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js'


export async function createOfficeScene() {
    const base = `${import.meta.env.BASE_URL}assets/`

    const [deskTexture, pcTexture, chairTexture, characterSheet, floorTexture] = 
        await Promise.all([
            Assets.load<Texture>(`${base}furniture/DESK/DESK_FRONT.png`),
            Assets.load<Texture>(`${base}furniture/PC/PC_FRONT_ON_1.png`),
            Assets.load<Texture>(`${base}furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png`),
            Assets.load<Texture>(`${base}characters/char_0.png`),
            Assets.load<Texture>(`${base}floors/floor_6.png`),
        ])

    for (const texture of [deskTexture, pcTexture, chairTexture, characterSheet, floorTexture]) {
        texture.source.scaleMode = 'nearest'
    }

    // 스프라이트 시트의 두 번째 행, 두 번째 칸은 위를 향해 서 있는 자세
    const developerTexture = new Texture({
        source: characterSheet.source,
        frame: new Rectangle(16, 32, 16, 32),
    })

    const desk = new Sprite(deskTexture)
    const pc = new Sprite(pcTexture)
    const chair = new Sprite(chairTexture)
    const developer = new Sprite(developerTexture)

    desk.position.set(0, 8)
    pc.position.set(16, 6)
    developer.position.set(16, 29)
    chair.position.set(16, 29)

    // 잘라낸 프레임만 정리하고, 다른 캐릭터도 사용할 원본 시트는 보존
    developer.once('destroyed', () => developerTexture.destroy())

    const seat = new Container()
    seat.addChild(desk, pc, developer, chair)
    seat.position.set(32, 128)

    const floor = new TilingSprite({
        texture: floorTexture,
        width: 512,
        height: 272,
    })
    floor.position.set(16, 32)
    floor.tint = 0xd29d71

    const office = new Container()

    // 좌석이 바닥 위에 그려지도록 바닥을 먼저 추가
    office.addChild(floor, seat)

    return office
}