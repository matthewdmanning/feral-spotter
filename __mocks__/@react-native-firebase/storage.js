// Manual Jest mock — @react-native-firebase/storage's native module isn't
// available under Jest. Statically imported by
// src/lib/upload/firebaseUpload.ts, so the real package must never load in
// tests.
module.exports = {
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  putFile: jest.fn(() => {
    const task = Promise.resolve()
    task.on = jest.fn()
    return task
  }),
  getDownloadURL: jest.fn(() =>
    Promise.resolve('https://example.com/mock.jpg'),
  ),
}
