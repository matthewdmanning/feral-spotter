import { render, screen } from '@testing-library/react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { TextField } from '@/src/shared/ui/atoms/TextField'

it('keeps nested labels and inputs capped and scalable despite caller overrides', async () => {
  await render(
    <>
      <Text allowFontScaling={false} maxFontSizeMultiplier={0}>
        Consent <Text maxFontSizeMultiplier={1}>details</Text>
      </Text>
      <TextField
        label="Email"
        allowFontScaling={false}
        maxFontSizeMultiplier={0}
      />
    </>,
  )
  for (const node of [
    screen.getByText(/Consent/),
    screen.getByText('details'),
    screen.getByText('Email'),
    screen.getByLabelText('Email'),
  ]) {
    expect(node.props.allowFontScaling).toBe(true)
    expect(node.props.maxFontSizeMultiplier).toBe(2)
  }
})
