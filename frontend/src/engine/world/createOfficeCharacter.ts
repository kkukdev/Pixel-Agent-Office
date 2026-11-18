import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'

import type { OfficeFacing } from './officeSeat'


export async function createOfficeCharacter(appearance: number, facing: OfficeFacing) {
    const sheet = await Assets.load<Texture>(
        `${import.meta.env.BASE_URL}assets/characters/char_${appearance}.png`,
    )
    sheet.source.scaleMode = 'nearest'


    // 시트의 첫 행은 아래를, 둘째 행은 위를 보는 프레임
    const frame = new Texture({
        source: sheet.source,
        frame: new Rectangle(16, facing === 'down' ? 0 : 32, 16, 32),
    })

    const character = new Sprite(frame)

    // 캐릭터를 정리할 때 잘라낸 프레임을 함께 정리
    character.once('destroyed', () => frame.destroy())

    return character
}