import { render, screen, userEvent } from '@testing-library/react-native'
import {
  TutorialOverlay,
  type TutorialStep,
} from '@/src/features/annotate/components/TutorialOverlay'

/**
 * The overlay's Modal stays mounted between opens. Its step index used to
 * survive a close, so a reopened tutorial resumed on its last step with the
 * wrong counter, and a shorter steps array indexed past its end and threw.
 */

const step = (n: number): TutorialStep => ({
  id: `s${n}`,
  title: `Step ${n}`,
  body: `Body ${n}`,
  primaryLabel: `Next ${n}`,
})
const handlers = {
  onShow: jest.fn(),
  onStepCompleted: jest.fn(),
  onSkip: jest.fn(),
  onComplete: jest.fn(),
}

it('starts again at step 1 when reopened', async () => {
  const steps = [step(1), step(2), step(3)]
  const { rerender } = render(
    <TutorialOverlay open steps={steps} {...handlers} />,
  )
  await userEvent.press(screen.getByText('Next 1'))
  await userEvent.press(screen.getByText('Next 2'))
  expect(screen.getByText('Step 3')).toBeTruthy()

  rerender(<TutorialOverlay open={false} steps={steps} {...handlers} />)
  rerender(<TutorialOverlay open steps={steps} {...handlers} />)
  expect(screen.getByText('Step 1')).toBeTruthy()
  expect(screen.getByText('1 / 3')).toBeTruthy()
})

it('stays on a real step when the steps array shrinks', async () => {
  const { rerender } = render(
    <TutorialOverlay open steps={[step(1), step(2)]} {...handlers} />,
  )
  await userEvent.press(screen.getByText('Next 1'))
  rerender(<TutorialOverlay open steps={[step(1)]} {...handlers} />)
  expect(screen.getByText('Step 1')).toBeTruthy()
})
