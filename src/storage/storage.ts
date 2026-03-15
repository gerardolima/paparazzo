/**
 * An adapter interface abstracting the filesystem or cloud storage targets
 * for saving daily screenshots and their raw extracted text.
 */
export interface Storage {
  saveScreenshot(filename: string, data: Buffer): Promise<void>
  saveText(filename: string, content: string): Promise<void>
}
