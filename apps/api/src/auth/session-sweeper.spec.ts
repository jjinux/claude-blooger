import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionSweeper, SWEEP_MAX_MS, SWEEP_MIN_MS } from './session-sweeper.js'
import type { TypeOrmSessionStore } from './typeorm-session.store.js'

function makeStore(pruneExpired: () => Promise<number>) {
  return { pruneExpired: vi.fn(pruneExpired) } as unknown as TypeOrmSessionStore & {
    pruneExpired: ReturnType<typeof vi.fn>
  }
}

describe('SessionSweeper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sweeps nothing until the first delay has elapsed', () => {
    const store = makeStore(async () => 0)
    const sweeper = new SessionSweeper(store, () => 0)

    sweeper.start()
    vi.advanceTimersByTime(SWEEP_MIN_MS - 1)

    expect(store.pruneExpired).not.toHaveBeenCalled()
    sweeper.stop()
  })

  it('picks a delay inside the twenty-to-sixty-minute window', () => {
    const shortest = new SessionSweeper(
      makeStore(async () => 0),
      () => 0,
    )
    const longest = new SessionSweeper(
      makeStore(async () => 0),
      () => 1,
    )
    const middle = new SessionSweeper(
      makeStore(async () => 0),
      () => 0.5,
    )

    expect(shortest.nextDelayMs()).toBe(SWEEP_MIN_MS)
    expect(longest.nextDelayMs()).toBe(SWEEP_MAX_MS)
    expect(middle.nextDelayMs()).toBe((SWEEP_MIN_MS + SWEEP_MAX_MS) / 2)
  })

  /**
   * The point of the whole design: a fresh delay before every sweep, so two
   * processes that started together do not stay in lockstep. A `setInterval`
   * would pass the test above and fail this one.
   */
  it('re-randomises the delay before every sweep, not only the first', async () => {
    const store = makeStore(async () => 0)
    const draws = [0, 1, 0.5]
    let draw = 0
    const sweeper = new SessionSweeper(store, () => draws[draw++ % draws.length] ?? 0)

    sweeper.start()

    await vi.advanceTimersByTimeAsync(SWEEP_MIN_MS)
    expect(store.pruneExpired).toHaveBeenCalledTimes(1)

    // The second delay was drawn as 1, so the maximum: nothing at 20 minutes.
    await vi.advanceTimersByTimeAsync(SWEEP_MIN_MS)
    expect(store.pruneExpired).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(SWEEP_MAX_MS - SWEEP_MIN_MS)
    expect(store.pruneExpired).toHaveBeenCalledTimes(2)

    sweeper.stop()
  })

  it('keeps sweeping after one fails', async () => {
    let calls = 0
    const store = makeStore(async () => {
      calls += 1
      if (calls === 1) throw new Error('database went away')
      return 0
    })
    const sweeper = new SessionSweeper(store, () => 0)

    sweeper.start()
    await vi.advanceTimersByTimeAsync(SWEEP_MIN_MS)
    await vi.advanceTimersByTimeAsync(SWEEP_MIN_MS)

    expect(store.pruneExpired).toHaveBeenCalledTimes(2)
    sweeper.stop()
  })

  it('stops when the application shuts down', async () => {
    const store = makeStore(async () => 0)
    const sweeper = new SessionSweeper(store, () => 0)

    sweeper.onApplicationBootstrap()
    sweeper.onApplicationShutdown()
    await vi.advanceTimersByTimeAsync(SWEEP_MAX_MS * 3)

    expect(store.pruneExpired).not.toHaveBeenCalled()
  })

  /**
   * Housekeeping must never be the reason node stays alive. Without `unref()` a
   * referenced timer would also hold the whole test run open for up to an hour.
   */
  it('unrefs its timer, so it cannot hold the process open', () => {
    const timers: { unref: ReturnType<typeof vi.fn> }[] = []
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      const timer = { unref: vi.fn() }
      timers.push(timer)
      return timer as unknown as NodeJS.Timeout
    })

    const sweeper = new SessionSweeper(
      makeStore(async () => 0),
      () => 0,
    )
    sweeper.start()

    expect(timers).toHaveLength(1)
    expect(timers[0]?.unref).toHaveBeenCalledOnce()

    setTimeoutSpy.mockRestore()
    sweeper.stop()
  })
})
