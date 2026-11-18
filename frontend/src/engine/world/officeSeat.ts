import type { Container } from 'pixi.js'


export type OfficeFacing = 'up' | 'down' | 'left' | 'right'

export interface OfficeSeat {
    id: string
    facing: OfficeFacing
    occupantLayer: Container
}