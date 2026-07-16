// Shared TypeScript types between client and server
export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  reply: string
}
