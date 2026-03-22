import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * AIStructurer uses a Multimodal LLM to analyze a screenshot and extract
 * structured, translated Markdown content based on the visual layout.
 */
export class AIClient {
  readonly #genAI: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.#genAI = new GoogleGenerativeAI(apiKey)
  }

  async structureAndTranslate(screenshotBuffer: Buffer, country: string): Promise<string> {
    // const model = 'gemini-flash-latest'
    const model = 'models/gemini-3.1-flash-lite-preview'
    const ai = this.#genAI.getGenerativeModel({ model })

    const prompt = `
      Act as a news editor. Analyze the provided screenshot of a news website.
      The website is from ${country}.

      Tasks:
      1. Extract all significant news headlines and summaries.
      2. If the text is NOT in English, translate it to English.
      3. Organize the content into a clean Markdown format.
      4. Remove noise like navigation menus, cookie banners, and ads.

      Return ONLY the Markdown content.
    `

    const result = await ai.generateContent([
      prompt,
      {
        inlineData: {
          data: screenshotBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      },
    ])

    return result.response.text()
  }
}
