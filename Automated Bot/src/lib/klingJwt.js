// Kling JWT generation using Web Crypto API (zero dependencies)

function base64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeUtf8(str) {
  return new TextEncoder().encode(str)
}

export async function generateKlingJwt(accessKey, secretKey) {
  const header = base64url(encodeUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))

  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    encodeUtf8(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }))
  )

  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, encodeUtf8(signingInput))

  return `${signingInput}.${base64url(sig)}`
}
