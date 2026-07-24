import { MAX_FILE_SIZE_BYTES, validateUploadFile } from '../fileValidation'

describe('validateUploadFile', () => {
  it('accepts a valid jpeg and returns its extension', () => {
    const result = validateUploadFile({ type: 'image/jpeg', size: 1024 })
    expect(result).toEqual({ ok: true, extension: 'jpg' })
  })

  it('rejects an unsupported mime type', () => {
    const result = validateUploadFile({ type: 'application/pdf', size: 1024 })
    expect(result).toEqual({
      ok: false,
      status: 415,
      error: 'Unsupported file type: application/pdf',
    })
  })

  it('rejects an empty file', () => {
    const result = validateUploadFile({ type: 'image/png', size: 0 })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ status: 400 })
  })

  it('rejects a file over the size cap', () => {
    const result = validateUploadFile({ type: 'image/png', size: MAX_FILE_SIZE_BYTES + 1 })
    expect(result).toMatchObject({ ok: false, status: 413 })
  })

  it('accepts a file exactly at the size cap', () => {
    const result = validateUploadFile({ type: 'image/png', size: MAX_FILE_SIZE_BYTES })
    expect(result.ok).toBe(true)
  })
})
