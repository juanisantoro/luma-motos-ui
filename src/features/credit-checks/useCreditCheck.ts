import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, NetworkError } from '../../shared/api/client'
import { verifyCreditDocument } from './api'
import type {
  CreditCheckState,
  CreditDocumentType,
} from './types'

const MIN_DOCUMENT_LENGTH = 5

function creditCheckErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos consultar los antecedentes crediticios. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Revisá el documento ingresado antes de continuar.'
    }
    if (error.status === 403) {
      return 'No tenés permiso para consultar antecedentes crediticios.'
    }
  }
  return 'No pudimos consultar los antecedentes crediticios. Intentá nuevamente.'
}

type UseCreditCheckOptions = {
  documentType: CreditDocumentType
  documentNumber: string
  enabled?: boolean
  debounceMs?: number
}

export function useCreditCheck({
  documentType,
  documentNumber,
  enabled = true,
  debounceMs = 350,
}: UseCreditCheckOptions) {
  const [state, setState] = useState<CreditCheckState>({ status: 'idle' })
  const [requestKey, setRequestKey] = useState(0)
  const lastCompletedRef = useRef('')
  const normalizedDocument = documentNumber.trim()

  const retry = useCallback(() => {
    lastCompletedRef.current = ''
    setRequestKey((current) => current + 1)
  }, [])

  const reset = useCallback(() => {
    lastCompletedRef.current = ''
    setState({ status: 'idle' })
  }, [])

  useEffect(() => {
    const queryKey = `${documentType}:${normalizedDocument}`
    if (!enabled || normalizedDocument.length < MIN_DOCUMENT_LENGTH) {
      lastCompletedRef.current = ''
      setState({ status: 'idle' })
      return
    }
    if (lastCompletedRef.current === queryKey) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setState({ status: 'loading' })
      void verifyCreditDocument(
        documentType,
        normalizedDocument,
        controller.signal,
      )
        .then((response) => {
          lastCompletedRef.current = queryKey
          setState(
            response.found
              ? { status: 'success', data: response }
              : { status: 'not-found', checkedAt: response.checkedAt },
          )
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setState({ status: 'error', message: creditCheckErrorMessage(error) })
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    debounceMs,
    documentType,
    enabled,
    normalizedDocument,
    requestKey,
  ])

  return { state, retry, reset }
}

