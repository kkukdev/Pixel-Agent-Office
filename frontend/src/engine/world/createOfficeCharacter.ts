import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'


export async function createOfficeCharacter() {
    const sheet = await Assets.load<Texture>(
        `${import.meta.env.BASE_URL}assets/characters/char_0.png`,
    )
    sheet.source.scaleMode = 'nearest'


    // 두 번째 칸의 정면 프레임을 사용
    const frame = new Texture({
        source: sheet.source,
        frame: new Rectangle(16, 0, 16, 32),
    })

    const character = new Sprite(frame)

    // 캐릭터를 정리할 때 잘라낸 프레임을 함께 정리
    character.once('destroyed', () => frame.destroy())

    return character
}