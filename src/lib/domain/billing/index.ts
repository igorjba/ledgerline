/** Public surface of the billing engine. */

export {
  computeInvoice,
  type ComputedInvoice,
  type InvoiceInput,
  type InvoiceLine,
} from "./invoice";
export {
  emptyReadings,
  ingestReading,
  outcomeLabel,
  readingsForCycle,
  readingValidRange,
  type IngestOutcome,
  type IngestResult as ReadingIngestResult,
  type ReadingsState,
} from "./readings";
export {
  addRecognised,
  adjustmentLegs,
  diffAgainst,
  isZeroDelta,
  recognisedFrom,
  type AdjustmentDelta,
  type AdjustmentNote,
  type IssuedInvoice,
  type Recognised,
} from "./adjustment";
export {
  createBillingState,
  declareFlag,
  drainOutbox,
  flagFor,
  ingest,
  invoiceAsOf,
  issueInvoice,
  pendingOutbox,
  reconcile,
  type BillingState,
  type IngestResult,
  type IssueResult,
  type OutboxEvent,
  type OutboxEventType,
  type ReconcileResult,
} from "./engine";
