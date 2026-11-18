import type { Container } from 'pixi.js'


export type OfficeFacing = 'up' | 'down'

export interface OfficeSeat {
    id: string
    facing: OfficeFacing
    occupantLayer: Container
}