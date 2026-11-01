import 'react-native-svg'

// Phosphor 3.0.6 passes a web CSS class to Svg. react-native-svg 15.15.4
// forwards it on web, but omits it from the shared SvgProps declaration.
// Remove this augmentation when upstream includes the prop.
declare module 'react-native-svg' {
  interface SvgProps {
    className?: string
  }
}
