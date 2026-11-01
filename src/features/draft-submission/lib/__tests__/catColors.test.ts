import { pickCatColorSlot } from '../catColors'

const SIZE = 3
const fresh = () => Array<number>(SIZE).fill(0)

// Walks the real flow: a cat takes a slot, and removing it frees the slot.
function simulate(steps: ('add' | number)[]) {
  const uses = fresh()
  const cats: number[] = []
  const added: number[] = []
  for (const step of steps) {
    if (step === 'add') {
      const slot = pickCatColorSlot(uses, cats)
      uses[slot] += 1
      cats.push(slot)
      added.push(slot)
    } else {
      cats.splice(step, 1)
    }
  }
  return added
}

describe('pickCatColorSlot', () => {
  it('hands out every slot once before reusing any', () => {
    expect(simulate(['add', 'add', 'add'])).toEqual([0, 1, 2])
  })

  it('does not reuse a removed cat’s slot while an unused one remains', () => {
    // Remove the first cat (slot 0); the next cat must take unused slot 2.
    expect(simulate(['add', 'add', 0, 'add'])).toEqual([0, 1, 2])
  })

  it('reuses a removed cat’s slot once the palette is exhausted', () => {
    // Cats hold 0,1,2; removing the middle one frees slot 1 only.
    expect(simulate(['add', 'add', 'add', 1, 'add'])).toEqual([0, 1, 2, 1])
  })

  it('shares the least-shared slot when every slot is held', () => {
    expect(simulate(['add', 'add', 'add', 'add', 'add'])).toEqual([
      0, 1, 2, 0, 1,
    ])
  })
})
