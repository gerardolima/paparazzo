/**
 * AIStructurer uses a Multimodal LLM to analyze a screenshot and extract
 * structured, translated HTML fragment content based on the visual layout.
 */
export interface AIClient {
  getText(screenshotBuffer: Buffer, country: string): Promise<string>
}
