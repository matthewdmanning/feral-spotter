/**
 * test-utils/mswServer.ts
 * The suite's one MSW server (jest.setup.js starts it). Tests add handlers
 * with server.use(); they are reset after each test. A request no handler
 * answers fails the test.
 */

import { setupServer } from 'msw/node'

export const server = setupServer()
