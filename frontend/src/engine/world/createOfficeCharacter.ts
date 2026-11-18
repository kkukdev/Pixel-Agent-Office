import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'

import type { OfficeFacing } from './officeSeat'


export async function createOfficeCharacter(appearance: number, facing: OfficeFacing) {
    const sheet = await Assets.load<Texture>(
        `${import.meta.env.BASE_URL}assets/characters/char_${appearance}.png`,
    )
    sheet.source.scaleMode = 'nearest'

    const frameY: Record<OfficeFacing, number> = {
        down: 0,
        up: 32,
        left: 64,
        right: 64,
    }

    // 첫째 행은 아래, 둘째 행은 위, 셋째 행은 오른쪽을 보는 프레임
    const frame = new Texture({
        source: sheet.source,
        frame: new Rectangle(16, frameY[facing], 16, 32),
    })
    const character = new Sprite(frame)

    if (facing === 'left') {
        character.anchor.x = 1
        character.scale.x = -1
    }

    // 캐릭터를 정리할 때 잘라낸 프레임을 함께 정리
    character.once('destroyed', () => frame.destroy())

    return character
}