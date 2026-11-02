// Zustand's own Jest recipe (zustand.docs.pmnd.rs/guides/testing): every
// store created through `create` records how to return to its initial state.
// jest.setup.js runs those resets after each test, so one test's store writes
// cannot leak into the next. The registry lives on globalThis, and the hook
// lives in setup, because tests that reload modules re-run this file inside a
// test, where Jest forbids registering hooks.
/// <reference types="jest" />
import type * as ZustandExportedTypes from 'zustand'

export * from 'zustand'

const { create: actualCreate } =
  jest.requireActual<typeof ZustandExportedTypes>('zustand')

const storeResetFns: Set<() => void> = ((
  globalThis as { __zustandStoreResets?: Set<() => void> }
).__zustandStoreResets ??= new Set())

const createUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreate(stateCreator)
  const initialState = store.getInitialState()
  storeResetFns.add(() => {
    store.setState(initialState, true)
  })
  return store
}

export const create = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) =>
  typeof stateCreator === 'function'
    ? createUncurried(stateCreator)
    : createUncurried) as typeof ZustandExportedTypes.create
