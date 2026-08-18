/**
 * Simple async worker pool for parallel API calls.
 * Limits concurrency to avoid rate limits while maximizing throughput.
 */

export interface WorkerJob<T> {
  id: string;
  run: () => Promise<T>;
}

export interface WorkerResult<T> {
  id: string;
  result?: T;
  error?: string;
}

export async function runWorkerPool<T>(
  jobs: WorkerJob<T>[],
  concurrency: number,
  onProgress?: (completed: number, total: number, result: WorkerResult<T>) => void,
): Promise<WorkerResult<T>[]> {
  const results: WorkerResult<T>[] = [];
  let completed = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < jobs.length) {
      const idx = nextIndex++;
      const job = jobs[idx];
      try {
        const result = await job.run();
        const wr: WorkerResult<T> = { id: job.id, result };
        results.push(wr);
        completed++;
        onProgress?.(completed, jobs.length, wr);
      } catch (e) {
        const wr: WorkerResult<T> = { id: job.id, error: e instanceof Error ? e.message : String(e) };
        results.push(wr);
        completed++;
        onProgress?.(completed, jobs.length, wr);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
