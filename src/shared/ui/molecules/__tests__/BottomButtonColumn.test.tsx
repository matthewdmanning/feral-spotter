import { render, screen } from '@testing-library/react-native'
import { BottomButtonColumn } from '@/src/shared/ui/molecules/BottomButtonColumn'

const buttons = [
  {
    key: 'continue',
    label: 'Continue',
    onPress: jest.fn(),
    variant: 'primary',
  },
  { key: 'reset', label: 'Reset', onPress: jest.fn(), variant: 'secondary' },
] as const

// The failure this guards: a hidden column that keeps tappable or
// TalkBack-focusable buttons.
it.each([
  { visible: true, pointerEvents: 'auto', hidden: false, importance: 'auto' },
  {
    visible: false,
    pointerEvents: 'none',
    hidden: true,
    importance: 'no-hide-descendants',
  },
])(
  'sets touch and accessibility for visible=$visible',
  ({ visible, pointerEvents, hidden, importance }) => {
    render(<BottomButtonColumn buttons={[...buttons]} visible={visible} />)

    expect(screen.toJSON()).toMatchObject({
      props: {
        pointerEvents,
        accessibilityElementsHidden: hidden,
        importantForAccessibility: importance,
      },
    })
  },
)
