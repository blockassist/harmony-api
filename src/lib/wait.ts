export default function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Waiting...')
      resolve()
    }, seconds * 1000)
  })
}
