import { Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react'

// Encuadre de una foto antes de subirla: un cuadro fijo 4:3 (el de las
// tarjetas del catálogo) donde el usuario arrastra la foto y la acerca o
// aleja (con dos dedos, la rueda del mouse o la barra). Arranca con la foto
// entera; lo que quede fuera de la foto se completa en blanco.

export type PhotoCrop = { x: number; y: number; width: number; height: number }

type Props = {
  src: string
  imageWidth: number
  imageHeight: number
  disabled?: boolean
  onCancel: () => void
  onConfirm: (crop: PhotoCrop) => void
}

const ASPECT = 4 / 3
const MAX_ZOOM = 5

type View = { zoom: number; x: number; y: number }

export function PhotoCropper({
  src,
  imageWidth,
  imageHeight,
  disabled = false,
  onCancel,
  onConfirm,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number } | null>(null)

  // Escala con la que la foto entra entera en el cuadro (zoom 1).
  const baseScale =
    frame.width > 0 ? Math.min(frame.width / imageWidth, frame.height / imageHeight) : 1

  // Lleva la foto a una posición válida: si es más chica que el cuadro queda
  // centrada; si es más grande, sin dejar bordes vacíos de su lado.
  const clamp = useCallback(
    (next: View): View => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom))
      const scale = baseScale * zoom
      const width = imageWidth * scale
      const height = imageHeight * scale
      const fit = (offset: number, size: number, box: number) =>
        size <= box ? (box - size) / 2 : Math.min(0, Math.max(box - size, offset))
      return {
        zoom,
        x: fit(next.x, width, frame.width),
        y: fit(next.y, height, frame.height),
      }
    },
    [baseScale, frame.height, frame.width, imageHeight, imageWidth],
  )

  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) return
    const measure = () => {
      const width = element.clientWidth
      setFrame({ width, height: width / ASPECT })
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  // Al medir el cuadro (o si cambia), la foto arranca entera y centrada.
  useEffect(() => {
    setView((current) => clamp({ ...current, zoom: current.zoom }))
  }, [clamp])

  // Acerca o aleja manteniendo fijo el punto (px, py) del cuadro.
  const zoomAt = (zoom: number, px: number, py: number) =>
    setView((current) => {
      const target = Math.min(MAX_ZOOM, Math.max(1, zoom))
      const ratio = target / current.zoom
      return clamp({
        zoom: target,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      })
    })

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = frameRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) }
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous || disabled) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const middle = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
      const ratio = distance / pinch.current.distance
      pinch.current = { distance }
      zoomAt(view.zoom * ratio, middle.x, middle.y)
      return
    }
    setView((current) =>
      clamp({
        ...current,
        x: current.x + event.clientX - previous.x,
        y: current.y + event.clientY - previous.y,
      }),
    )
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled) return
    const point = localPoint(event)
    zoomAt(view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), point.x, point.y)
  }

  const confirm = () => {
    const scale = baseScale * view.zoom
    onConfirm({
      x: -view.x / scale,
      y: -view.y / scale,
      width: frame.width / scale,
      height: frame.height / scale,
    })
  }

  const scale = baseScale * view.zoom
  return (
    <div className="photo-cropper">
      <p className="photo-cropper__hint">
        Arrastrá la foto para ubicar la moto y acercala con dos dedos o con la barra. Lo que
        queda dentro del cuadro es lo que se ve en el catálogo.
      </p>
      <div
        aria-label="Encuadre de la foto"
        className="photo-cropper__frame"
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        ref={frameRef}
        role="img"
        style={{ aspectRatio: '4 / 3' }}
      >
        {frame.width > 0 && (
          <img
            alt=""
            draggable={false}
            src={src}
            style={{
              width: imageWidth * scale,
              height: imageHeight * scale,
              transform: `translate(${view.x}px, ${view.y}px)`,
            }}
          />
        )}
      </div>
      <div className="photo-cropper__zoom">
        <button
          aria-label="Alejar"
          className="icon-button"
          disabled={disabled || view.zoom <= 1}
          onClick={() => zoomAt(view.zoom / 1.25, frame.width / 2, frame.height / 2)}
          type="button"
        >
          <Minus size={18} />
        </button>
        <input
          aria-label="Zoom"
          disabled={disabled}
          max={MAX_ZOOM}
          min={1}
          onChange={(event) =>
            zoomAt(Number(event.target.value), frame.width / 2, frame.height / 2)
          }
          step={0.01}
          type="range"
          value={view.zoom}
        />
        <button
          aria-label="Acercar"
          className="icon-button"
          disabled={disabled || view.zoom >= MAX_ZOOM}
          onClick={() => zoomAt(view.zoom * 1.25, frame.width / 2, frame.height / 2)}
          type="button"
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="photo-cropper__actions">
        <button
          className="button button--secondary"
          disabled={disabled}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="button button--primary"
          disabled={disabled || frame.width === 0}
          onClick={confirm}
          type="button"
        >
          Usar esta foto
        </button>
      </div>
    </div>
  )
}
