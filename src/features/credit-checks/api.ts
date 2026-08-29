import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type { CreditCheckResponse, CreditDocumentType } from './types'

export function verifyCreditDocument(
  documentType: CreditDocumentType,
  documentNumber: string,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    documentType,
    documentNumber: documentNumber.trim(),
  })

  return apiRequest<CreditCheckResponse>(
    `/credit-inquiries/verify?${search.toString()}`,
    {
      token: sessionStorage.getItem(AUTH_TOKEN_KEY),
      ...(signal ? { signal } : {}),
    },
  )
}

