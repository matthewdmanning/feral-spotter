/** One step of the annotation tutorial overlay (config/tutorial.ts). */
export interface TutorialStep {
  id: string
  title: string
  body: string
  /** Label for the primary (advance) button on this step */
  primaryLabel: string
}
