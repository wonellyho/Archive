import type { Pin } from "../../types/pin";

/**
 * Seed content for the board (#pinboard). Placeholder photography is generated
 * as inline SVG rather than fetched or committed as binaries: the board needs a
 * dozen images in mixed aspect ratios to look inhabited, and these cost nothing
 * to ship and never 404. Real uploads replace them per-pin.
 */

interface Scene {
  /** Sky/base gradient, top → bottom. */
  sky: [string, string];
  /** Two receding land bands, far → near. */
  land: [string, string];
  /** Sun/lamp: x and y as fractions of the frame, radius as a fraction of width. */
  light: [number, number, number];
  /** Horizon height as a fraction of the frame. */
  horizon: number;
}

function photo(width: number, height: number, scene: Scene): string {
  const { sky, land, light, horizon } = scene;
  const [lx, ly, lr] = light;
  const h1 = height * horizon;
  const h2 = height * (horizon + (1 - horizon) * 0.42);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>` +
    `<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${sky[0]}'/><stop offset='1' stop-color='${sky[1]}'/>` +
    `</linearGradient></defs>` +
    `<rect width='${width}' height='${height}' fill='url(#s)'/>` +
    `<circle cx='${(lx * width).toFixed(0)}' cy='${(ly * height).toFixed(0)}' r='${(lr * width).toFixed(0)}' fill='#fff' opacity='0.55'/>` +
    `<path d='M0 ${h1.toFixed(0)} Q ${(width * 0.3).toFixed(0)} ${(h1 - height * 0.11).toFixed(0)} ${(width * 0.58).toFixed(0)} ${(h1 + height * 0.03).toFixed(0)} T ${width} ${(h1 - height * 0.04).toFixed(0)} L ${width} ${height} L 0 ${height} Z' fill='${land[0]}'/>` +
    `<path d='M0 ${h2.toFixed(0)} Q ${(width * 0.42).toFixed(0)} ${(h2 - height * 0.09).toFixed(0)} ${width} ${(h2 + height * 0.04).toFixed(0)} L ${width} ${height} L 0 ${height} Z' fill='${land[1]}'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SCENES: Record<string, Scene> = {
  dusk: {
    sky: ["#f0c9a4", "#d98f63"],
    land: ["#8d5a44", "#5c3730"],
    light: [0.72, 0.26, 0.09],
    horizon: 0.62,
  },
  coast: {
    sky: ["#cfe0e4", "#8fb2bd"],
    land: ["#5f8590", "#3d5d68"],
    light: [0.22, 0.2, 0.07],
    horizon: 0.58,
  },
  field: {
    sky: ["#eae3d2", "#cbc4a8"],
    land: ["#9a9a6c", "#6d7148"],
    light: [0.8, 0.18, 0.08],
    horizon: 0.55,
  },
  night: {
    sky: ["#41435c", "#20222f"],
    land: ["#2b2d3d", "#14151d"],
    light: [0.3, 0.22, 0.05],
    horizon: 0.66,
  },
  bloom: {
    sky: ["#f4dfe0", "#dfb0ac"],
    land: ["#a9707a", "#6f4653"],
    light: [0.6, 0.24, 0.1],
    horizon: 0.6,
  },
  pine: {
    sky: ["#dfe6dc", "#a8b8a4"],
    land: ["#6d8168", "#42533f"],
    light: [0.18, 0.22, 0.06],
    horizon: 0.5,
  },
};

const land = (s: Scene) => photo(640, 440, s);
const tall = (s: Scene) => photo(440, 620, s);
const square = (s: Scene) => photo(520, 520, s);

/**
 * Twelve pins placed by hand, not scattered randomly: a random board reads as
 * noise, while a composed one reads as somebody's wall. Mixed orientations and
 * sizes, generous gaps, and no two pins overlapping by more than a corner.
 *
 * Everything ships square-on and undecorated — tilt and tape are things the
 * owner adds, not defaults the board imposes.
 */
export const MOCK_PINS: Pin[] = [
  {
    id: "pin-1",
    images: [land(SCENES.dusk), land(SCENES.coast), tall(SCENES.bloom)],
    content:
      "USC에서 마지막 날.\n\n한 달 동안 매일 지나가던 길인데 마지막 날이 되니 조금 다르게 보였다. 별것 아닌 골목이었는데.",
    x: 3,
    y: 6,
    width: 280,
    height: 200,
    createdAt: "2026-07-28T09:00:00.000Z",
  },
  {
    id: "pin-2",
    images: [],
    content:
      "무언가를 오래 좋아하는 일에도 연습이 필요하다는 걸 요즘 배우는 중.",
    x: 26.5,
    y: 4,
    width: 200,
    height: 150,
    createdAt: "2026-07-21T11:30:00.000Z",
  },
  {
    id: "pin-3",
    images: [tall(SCENES.bloom), tall(SCENES.pine)],
    content: "봄에 찍어둔 사진. 그날은 바람이 계속 불었다.",
    x: 44,
    y: 7,
    width: 200,
    height: 270,
    createdAt: "2026-04-14T08:10:00.000Z",
  },
  {
    id: "pin-4",
    images: [
      land(SCENES.field),
      land(SCENES.dusk),
      land(SCENES.night),
      square(SCENES.coast),
    ],
    content:
      "여름 끝. 해가 지는 게 눈에 띄게 빨라지던 주.\n\n네 장 다 같은 자리에서 십 분 간격으로 찍었다.",
    x: 62,
    y: 5,
    width: 330,
    height: 230,
    createdAt: "2026-08-30T18:40:00.000Z",
  },
  {
    id: "pin-5",
    images: [square(SCENES.night)],
    content: "새벽 두 시, 창밖.",
    x: 87,
    y: 14,
    width: 160,
    height: 160,
    createdAt: "2026-06-02T17:05:00.000Z",
  },
  {
    id: "pin-6",
    images: [tall(SCENES.pine), tall(SCENES.field)],
    content:
      "혼자 갔던 산. 정상까지는 못 갔고 중턱에서 한참 앉아 있다 내려왔는데, 그날 하루가 제일 기억에 남는다.",
    x: 5,
    y: 38,
    width: 210,
    height: 290,
    createdAt: "2026-05-19T02:20:00.000Z",
  },
  {
    id: "pin-7",
    images: [land(SCENES.coast), land(SCENES.bloom)],
    content: "바다는 매번 비슷하게 찍히는데도 매번 다시 찍게 된다.",
    x: 23,
    y: 42,
    width: 300,
    height: 210,
    createdAt: "2026-03-08T05:00:00.000Z",
  },
  {
    id: "pin-8",
    images: [],
    content: "좋아하는 것들 목록은 결국 나에 대한 설명이 된다.",
    x: 48,
    y: 46,
    width: 190,
    height: 140,
    createdAt: "2026-02-11T13:00:00.000Z",
  },
  {
    id: "pin-9",
    images: [tall(SCENES.dusk), tall(SCENES.night), tall(SCENES.coast)],
    content:
      "겨울에 찍은 필름. 현상까지 두 달이 걸려서, 받았을 땐 이미 봄이었다.",
    x: 65,
    y: 40,
    width: 220,
    height: 290,
    createdAt: "2026-01-27T07:45:00.000Z",
  },
  {
    id: "pin-10",
    images: [land(SCENES.pine)],
    content: "가는 길에 잠깐 세워서.",
    x: 84,
    y: 45,
    width: 180,
    height: 130,
    createdAt: "2026-05-03T01:15:00.000Z",
  },
  {
    id: "pin-11",
    images: [land(SCENES.bloom), square(SCENES.field)],
    content: "생일. 케이크는 사진이 없고 창밖만 찍어놨다.",
    x: 24,
    y: 72,
    width: 260,
    height: 175,
    createdAt: "2026-06-21T10:00:00.000Z",
  },
  {
    id: "pin-12",
    images: [square(SCENES.coast)],
    content: "이 색을 오래 기억하고 싶어서.",
    x: 47,
    y: 68,
    width: 170,
    height: 170,
    createdAt: "2026-07-09T04:30:00.000Z",
  },
].map((seed, i) => ({
  ...seed,
  rotation: 0,
  z: i + 1,
  decoration: "none" as const,
  variant: seed.images.length === 0 ? ("memo" as const) : ("photo" as const),
}));
