import { computeSunAccess, type SunAccessInput } from './sunAccessLogic'

export type SunAccessWorkerRequest = {
  type: 'compute'
  requestId: number
  input: SunAccessInput
}

export type SunAccessWorkerResponse = {
  type: 'result'
  requestId: number
  results: ReturnType<typeof computeSunAccess>
}

self.onmessage = (ev: MessageEvent<SunAccessWorkerRequest>) => {
  const msg = ev.data
  if (msg.type !== 'compute') return
  const results = computeSunAccess(msg.input)
  const response: SunAccessWorkerResponse = {
    type: 'result',
    requestId: msg.requestId,
    results,
  }
  self.postMessage(response)
}
