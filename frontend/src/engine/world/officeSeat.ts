import type { Container } from 'pixi.js'


export type OfficeFacing = 'up' | 'down' | 'left' | 'right'

export type OfficeSeatOption = Pick<OfficeSeat, 'id' | 'label'>


export interface OfficeSeat {
    id: string
    label: string
    facing: OfficeFacing
    occupantLayer: Container
}