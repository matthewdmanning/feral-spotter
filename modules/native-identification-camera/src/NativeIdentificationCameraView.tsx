import { requireNativeView } from 'expo'
import { forwardRef, type ComponentType, type ForwardedRef } from 'react'
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
    cachedView = requireNativeView<NativeIdentificationCameraProps>(
      'NativeIdentificationCamera',
    ) as NativeViewComponent
  }
  return cachedView
}

export const NativeIdentificationCameraView = forwardRef<
  NativeIdentificationCameraRef,
  NativeIdentificationCameraProps
>((props, ref) => {
  // getNativeView already caches in cachedView, so a useMemo around it would be
  // a second cache for the same value.
  const NativeView = getNativeView()
  return <NativeView {...props} ref={ref} />
})

NativeIdentificationCameraView.displayName = 'NativeIdentificationCameraView'
