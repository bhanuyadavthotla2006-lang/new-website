// Minimal API service wrapper
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export async function chat(message: string){
  const res = await axios.post(`${API_BASE}/api/chat`, { message })
  return res.data
}
