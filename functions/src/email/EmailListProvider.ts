/**
 * A mailing-list service. To add one, implement this and register it in
 * email/index.ts; nothing else in the app or the functions changes.
 */
export interface EmailListProvider {
  /**
   * Put the address on the list. When the address is not verified, the service
   * must confirm it with the owner first (double opt-in).
   */
  subscribe(email: string, options: { emailVerified: boolean }): Promise<void>
  unsubscribe(email: string): Promise<void>
}

export interface EmailListConfig {
  apiKey: string
  listId: string
}
