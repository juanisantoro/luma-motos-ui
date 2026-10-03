import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AssistantAnswer = {
  answer: string
  covered: boolean
}

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

// El manual lo elige la API por el rol de la sesión: acá sólo viajan la
// pregunta y los últimos mensajes de la conversación.
export function askAssistant(question: string, history: AssistantMessage[]) {
  return apiRequest<AssistantAnswer>('/assistant/ask', {
    method: 'POST',
    token: authToken(),
    body: { question, history },
  })
}
