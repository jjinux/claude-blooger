import { useSearchParams } from 'react-router'

/** Reads `?page=`, falling back to 1 for anything missing or nonsensical. */
export function usePageParam(): number {
  const [params] = useSearchParams()
  const raw = Number(params.get('page'))
  return Number.isInteger(raw) && raw >= 1 ? raw : 1
}
