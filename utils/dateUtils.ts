import _ from "lodash";

export function getNextCollectionDate(jobs: any[]): Date | null {
  const next = _.minBy(jobs, (job: any) => new Date(job.ScheduledStart));
  return next ? new Date(next.ScheduledStart) : null;
}
