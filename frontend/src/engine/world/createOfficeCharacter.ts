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
        dynamic: true,
    })
    const sprite = new Sprite(frame)

    function setPose(direction: OfficeFacing, column = 1) {
        const x = column * 16
        const y = frameY[direction]

        if (frame.frame.x !== x || frame.frame.y !== y) {
            frame.frame.x = x
            frame.frame.y = y
            frame.update()
        }

        // 좌우 반전해도 스프라이트가 같은 위치에 그려지도록 앵커를 맞춘다.
        sprite.anchor.x = direction === 'left' ? 1 : 0
        sprite.scale.x = direction === 'left' ? -1 : 1
    }

    setPose(facing)
    sprite.once('destroyed', () => frame.destroy())

    return { sprite, setPose }
}