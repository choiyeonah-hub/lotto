/** 코드로 그린 오리지널 텍스처 (외부 이미지 에셋 없음 → 라이선스 문제 없음). */
import * as THREE from 'three'

const cache = new Map<string, THREE.Texture>()

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 4
  cache.set(key, t)
  return t
}

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, color: string, size = 2) {
  g.fillStyle = color
  for (let i = 0; i < n; i++) g.fillRect(rnd() * w, rnd() * h, size * rnd() + 0.5, size * rnd() + 0.5)
}

export const asphalt = (rx = 8, ry = 2) =>
  make(`asphalt${rx}x${ry}`, 256, 256, (g) => {
    g.fillStyle = '#5b5752'
    g.fillRect(0, 0, 256, 256)
    noise(g, 256, 256, 2600, 'rgba(30,28,26,0.35)')
    noise(g, 256, 256, 1400, 'rgba(160,150,140,0.25)')
    g.strokeStyle = 'rgba(25,22,20,0.55)'
    g.lineWidth = 1.2
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      let x = rnd() * 256
      let y = rnd() * 256
      g.moveTo(x, y)
      for (let k = 0; k < 6; k++) g.lineTo((x += (rnd() - 0.5) * 40), (y += (rnd() - 0.5) * 40))
      g.stroke()
    }
  }, [rx, ry])

export const concrete = (rx = 4, ry = 1) =>
  make(`concrete${rx}x${ry}`, 256, 256, (g) => {
    g.fillStyle = '#b9b2a6'
    g.fillRect(0, 0, 256, 256)
    noise(g, 256, 256, 3000, 'rgba(90,85,78,0.22)')
    noise(g, 256, 256, 600, 'rgba(255,255,255,0.18)', 3)
    g.fillStyle = 'rgba(80,70,60,0.18)'
    g.fillRect(0, 200, 256, 56) // 아래쪽 빗물 얼룩
  }, [rx, ry])

export const brick = (rx = 2, ry = 2, base = '#9a4b37') =>
  make(`brick${rx}x${ry}${base}`, 256, 256, (g) => {
    g.fillStyle = '#cdbfae'
    g.fillRect(0, 0, 256, 256)
    const bh = 16
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? 16 : 0
      for (let col = -1; col < 9; col++) {
        const l = 0.85 + rnd() * 0.3
        g.fillStyle = shade(base, l)
        g.fillRect(col * 32 + off + 1, row * bh + 1, 30, bh - 2)
      }
    }
    noise(g, 256, 256, 1200, 'rgba(0,0,0,0.12)')
  }, [rx, ry])

export const sidewalk = (rx = 20, ry = 1) =>
  make(`sidewalk${rx}x${ry}`, 128, 128, (g) => {
    g.fillStyle = '#8f8a83'
    g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? '#a39b8f' : '#9a8c80'
        g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30)
      }
    noise(g, 128, 128, 500, 'rgba(0,0,0,0.15)')
  }, [rx, ry])

export const dirt = (rx = 4, ry = 4) =>
  make(`dirt${rx}x${ry}`, 256, 256, (g) => {
    g.fillStyle = '#9c8263'
    g.fillRect(0, 0, 256, 256)
    noise(g, 256, 256, 4000, 'rgba(70,52,35,0.3)')
    noise(g, 256, 256, 1500, 'rgba(210,190,160,0.3)')
  }, [rx, ry])

/** 노란 장판 (모노륨) */
export const linoleum = () =>
  make('linoleum', 256, 256, (g) => {
    g.fillStyle = '#d9b26a'
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = 'rgba(150,100,40,0.25)'
    for (let i = 0; i < 8; i++) {
      g.strokeRect(i * 32 + 0.5, 0.5, 32, 256)
    }
    noise(g, 256, 256, 900, 'rgba(120,80,30,0.15)', 3)
  }, [3, 3])

export const wallpaper = () =>
  make('wallpaper', 256, 256, (g) => {
    g.fillStyle = '#efe4cf'
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = 'rgba(190,150,120,0.35)'
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const cx = x * 32 + (y % 2 ? 16 : 0)
        const cy = y * 32 + 16
        for (let k = 0; k < 4; k++) {
          g.beginPath()
          g.ellipse(cx + Math.cos((k * Math.PI) / 2) * 4, cy + Math.sin((k * Math.PI) / 2) * 4, 3, 3, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
  }, [4, 2])

/** 꽃무늬 커튼 */
export const flowerCloth = () =>
  make('flowerCloth', 256, 256, (g) => {
    g.fillStyle = '#f3d9d2'
    g.fillRect(0, 0, 256, 256)
    const colors = ['#d9576b', '#e88a4d', '#c94f86']
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 256
      const y = rnd() * 256
      g.fillStyle = colors[i % 3]
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.beginPath()
        g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 3, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#f7d35c'
      g.beginPath()
      g.arc(x, y, 3, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#5f8f4e'
      g.fillRect(x + 6, y + 8, 7, 3)
    }
  }, [2, 2])

export const wood = (base = '#8a5a35') =>
  make(`wood${base}`, 128, 256, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, 128, 256)
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(40,20,5,${0.08 + rnd() * 0.12})`
      g.beginPath()
      const x = rnd() * 128
      g.moveTo(x, 0)
      g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 3, 256)
      g.stroke()
    }
  })

export const stripes = (a: string, b: string) =>
  make(`stripes${a}${b}`, 64, 64, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : b
      g.fillRect(0, i * 8, 64, 8)
    }
  }, [1, 3])

/** 한글 간판 */
export const signText = (text: string, bg: string, fg: string, w = 512, h = 128) =>
  make(`sign${text}${bg}`, w, h, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,255,255,0.6)'
    g.lineWidth = 6
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = fg
    g.font = `bold ${Math.floor(h * 0.55)}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, w / 2, h / 2 + 4)
  })

function shade(hex: string, l: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, ((n >> 16) & 255) * l)
  const gg = Math.min(255, ((n >> 8) & 255) * l)
  const b = Math.min(255, (n & 255) * l)
  return `rgb(${r | 0},${gg | 0},${b | 0})`
}
