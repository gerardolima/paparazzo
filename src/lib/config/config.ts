export function loadEnv(...names: string[]): string[] {
  return names.map((name) => {
    const value = process.env[name]
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
  })
}
