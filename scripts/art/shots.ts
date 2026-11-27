/**
 * Where the starter content's pictures (scripts/art/demo-pictures.tsx) put
 * their packs, in a square studio: one pack each, standing on the floor in
 * the middle. Numbers only, so tests/packs.test.mjs checks that every pack
 * and its shadow sits inside its picture.
 */
import { DX, type BagSpec, type BoxSpec, type CanSpec, type CupSpec } from "../../components/illustrations/geometry"

/** A picture's side, and the line the packs stand on. */
export const SIZE = 1200
export const FLOOR = 1000

/** The box: a cereal box, and each person's pack on the team page. */
const BOX_W = 520
const BOX_D = 190
export const BOX: BoxSpec = { kind: "box", x: Math.round(SIZE / 2 - (BOX_W + BOX_D * DX) / 2), y: FLOOR - 700, w: BOX_W, h: 700, d: BOX_D }

const can = (w: number, h: number, ry: number): CanSpec => ({ kind: "can", x: SIZE / 2 - w / 2, top: FLOOR - h, w, h, ry })

export const DRINK = can(330, 640, 36)
export const FOOD = can(460, 440, 46)
export const SHRIMP = can(540, 300, 58)
export const NOODLES: CupSpec = { kind: "cup", cx: SIZE / 2, top: FLOOR - 520, wTop: 470, wBottom: 340, h: 520, ry: 52 }
export const COFFEE: BagSpec = { kind: "bag", x: SIZE / 2 - 220, y: FLOOR - 700, w: 440, h: 700 }

/** Every pack a picture is drawn with. */
export const SHOTS = { BOX, DRINK, FOOD, SHRIMP, NOODLES, COFFEE }
