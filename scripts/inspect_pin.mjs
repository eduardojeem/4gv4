async function main() {
  const res = await fetch('https://www.pinterest.com/pin/781093129169602903/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  const html = await res.text()

  const pinImages = [...html.matchAll(/https:\/\/i\.pinimg\.com\/[^\s"'<>\\]+/g)].map(m => m[0])
  console.log('Pin Images found:', [...new Set(pinImages)].slice(0, 8))

  const metas = [...html.matchAll(/<meta[^>]+>/gi)].map(m => m[0])
  const relevantMetas = metas.filter(m => m.includes('image') || m.includes('description') || m.includes('title'))
  console.log('Relevant metas:', relevantMetas)
}

main().catch(console.error)
