/** 3D 공간에 떠 있는 글자 라벨 (캔버스 텍스처 스프라이트, DOM 없음). */
import { useMemo } from 'react'
import * as THREE from 'three'

const cache = new Map<string, { tex: THREE.Texture; aspect: number }>()

function labelTexture(text: string, bg: string, fg: string) {
  const key = text + bg + fg
  const hit = cache.get(key)
  if (hit) return hit
  const font = 'bold 44px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = font
  const w = Math.ceil(g.measureText(text).width) + 44
  c.width = w
  c.height = 72
  g.font = font
  g.fillStyle = bg
  g.beginPath()
  g.roundRect(0, 0, w, 72, 30)
  g.fill()
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, 38)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const v = { tex, aspect: w / 72 }
  cache.set(key, v)
  return v
}

export function Label({ text, position, height = 0.12, bg = 'rgba(43,33,28,0.82)', fg = '#ffffff' }: { text: string; position: THREE.Vector3Tuple; height?: number; bg?: string; fg?: string }) {
  const { tex, aspect } = useMemo(() => labelTexture(text, bg, fg), [text, bg, fg])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  )
}
