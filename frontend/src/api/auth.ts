import client from './client'

export async function login(email: string, password: string) {
  const { data } = await client.post('/auth/login', { email, password })
  localStorage.setItem('token', data.token)
  return data
}

export async function signup(email: string, password: string) {
  const { data } = await client.post('/auth/signup', { email, password })
  localStorage.setItem('token', data.token)
  return data
}
