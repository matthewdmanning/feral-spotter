import { requireNativeViewManager } from 'expo-modules-core'
import {
  forwardRef,
  useMemo,
  type ComponentType,
  type ForwardedRef,
} from 'react'
import type {
  NativeIdentificationCameraProps,
  NativeIdentificationCameraRef,
} from './types'

type NativeViewComponent = ComponentType<
  NativeIdentificationCameraProps & {
    ref?: ForwardedRef<NativeIdentificationCameraRef>
  }
>

let cachedView: NativeViewComponent | null = null

function getNativeView(): NativeViewComponent {
  if (!cachedView) {
    cachedView = requireNativeViewManager<NativeIdentificationCameraProps>(
      'NativeIdentificationCamera',
    ) as NativeViewComponent
  }
  return cachedView
}

export const NativeIdentificationCameraView = forwardRef<
  NativeIdentificationCameraRef,
  NativeIdentificationCameraProps
>((props, ref) => {
  const NativeView = useMemo(getNativeView, [])
  return <NativeView {...props} ref={ref} />
})

NativeIdentificationCameraView.displayName = 'NativeIdentificationCameraView'
