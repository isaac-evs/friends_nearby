// Placeholder for the SQS worker. Should batch events and write to S3.
export const handler = async (event) => {
  console.log(`received ${event.Records.length} records`);
  return { batchItemFailures: [] };
};
