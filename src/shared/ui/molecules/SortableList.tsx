/**
 * shared/ui/molecules/SortableList.tsx
 *
 * A column of rows the user reorders by dragging each row's handle. The
 * dragged row follows the finger and lifts by `interaction.dragScale`; the
 * rows it passes slide out of its way. Release commits the new order through
 * `onReorder`; a gesture taken over by the system cancels without a change.
 *
 * Rows keep content-driven heights (font scaling grows them), so drop targets
 * come from each row's measured layout, not from a fixed row height. The pan
 * responder mirrors InsetCropBubble's, so tests drive it with responder events.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  PanResponder,
  View,
  type LayoutRectangle,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { DotsSixVerticalIcon } from 'phosphor-react-native/src/icons/DotsSixVertical'
import { styles } from './SortableList.styles'

type RowLayout = Pick<LayoutRectangle, 'y' | 'height'>

/** Where the dragged row lands: past every row whose midpoint its center crossed. */
export function dropIndex(
  rows: readonly RowLayout[],
  from: number,
  dy: number,
): number {
  const center = rows[from].y + rows[from].height / 2 + dy
  return rows.reduce((target, row, index) => {
    const middle = row.y + row.height / 2
    if (index > from && center > middle) return target + 1
    if (index < from && center < middle) return target - 1
    return target
  }, from)
}

function moveKey(keys: readonly string[], from: number, to: number) {
  const next = [...keys]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

interface Drag {
  key: string
  from: number
  target: number
  /** How far a passed row slides: the dragged row's height plus the gap. */
  shift: number
}

/** A passed row slides by the dragged row's height; others stay put. */
function rowOffset(index: number, drag: Drag): number {
  if (drag.from < index && index <= drag.target) return -drag.shift
  if (drag.target <= index && index < drag.from) return drag.shift
  return 0
}

interface RowHandlers {
  start: (key: string) => void
  move: (dy: number) => void
  end: (dy: number | null) => void
}

function SortableRow({
  rowKey,
  index,
  drag,
  label,
  handlers,
  onLayout,
  children,
}: {
  rowKey: string
  index: number
  drag: Drag | null
  label: string
  handlers: RowHandlers
  onLayout: (layout: RowLayout) => void
  children: ReactNode
}) {
  const { theme } = useUnistyles()
  // useState, not useRef: reading `.current` in render trips react-hooks/refs.
  const [offset] = useState(() => new Animated.Value(0))
  // `handlers` stays the same object for a whole drag, so the responder (and
  // its gesture state) is never rebuilt mid-gesture.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // A drag keeps the touch: the page scroll never takes it over.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => handlers.start(rowKey),
        onPanResponderMove: (_, { dy }) => {
          offset.setValue(dy)
          handlers.move(dy)
        },
        onPanResponderRelease: (_, { dy }) => handlers.end(dy),
        onPanResponderTerminate: () => handlers.end(null),
      }),
    [handlers, rowKey, offset],
  )
  const active = drag?.key === rowKey
  const slide = drag && !active ? rowOffset(index, drag) : null
  useEffect(() => {
    if (!drag) offset.setValue(0)
    else if (slide !== null)
      Animated.spring(offset, { toValue: slide, useNativeDriver: true }).start()
  }, [drag, slide, offset])
  return (
    <Animated.View
      onLayout={({ nativeEvent }) => onLayout(nativeEvent.layout)}
      style={[
        styles.row,
        active && styles.activeRow,
        {
          transform: [
            { translateY: offset },
            { scale: active ? theme.interaction.dragScale : 1 },
          ],
        },
      ]}
    >
      <View style={styles.content}>{children}</View>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        style={styles.handle}
      >
        <DotsSixVerticalIcon
          size={theme.iconSize.lg}
          color={theme.colors.text}
        />
      </View>
    </Animated.View>
  )
}

interface SortableListProps<T> {
  data: readonly T[]
  keyOf: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Names the row a handle moves, e.g. "Move Local Rescue". */
  handleLabel: (item: T) => string
  onReorder: (keys: string[]) => void
  /** True while a row is held, so a parent can pause its scrolling. */
  onDragActiveChange?: (active: boolean) => void
}

export function SortableList<T>({
  data,
  keyOf,
  renderItem,
  handleLabel,
  onReorder,
  onDragActiveChange,
}: SortableListProps<T>) {
  const { theme } = useUnistyles()
  const [drag, setDrag] = useState<Drag | null>(null)
  const held = useRef<Drag | null>(null)
  const layouts = useRef(new Map<string, RowLayout>())
  // A value, not the array: the handlers below change only when the order does.
  const order = JSON.stringify(data.map(keyOf))
  const gap = theme.layout.stackGap
  const handlers = useMemo((): RowHandlers => {
    const keys: string[] = JSON.parse(order)
    const measured = () =>
      keys.map((key) => layouts.current.get(key) ?? { y: 0, height: 0 })
    const update = (next: Drag | null) => {
      held.current = next
      setDrag(next)
    }
    return {
      start: (key) => {
        const from = keys.indexOf(key)
        update({
          key,
          from,
          target: from,
          shift: measured()[from].height + gap,
        })
        onDragActiveChange?.(true)
      },
      move: (dy) => {
        const now = held.current
        if (!now) return
        const target = dropIndex(measured(), now.from, dy)
        if (target !== now.target) update({ ...now, target })
      },
      end: (dy) => {
        const now = held.current
        if (!now) return
        const landing =
          dy === null ? now.from : dropIndex(measured(), now.from, dy)
        update(null)
        onDragActiveChange?.(false)
        if (landing !== now.from) onReorder(moveKey(keys, now.from, landing))
      },
    }
  }, [order, gap, onReorder, onDragActiveChange])
  return (
    <View style={styles.list}>
      {data.map((item, index) => {
        const key = keyOf(item)
        return (
          <SortableRow
            key={key}
            rowKey={key}
            index={index}
            drag={drag}
            label={handleLabel(item)}
            handlers={handlers}
            onLayout={(layout) => layouts.current.set(key, layout)}
          >
            {renderItem(item)}
          </SortableRow>
        )
      })}
    </View>
  )
}
