import { Route } from "../index.js";

export interface StepTimings {
  approval?: number;
  transferSent?: number;
  transferConfirmed?: number;
  transferReceived?: number;
}

export interface ExecutionResult {
  source: string;
  target: string;
  corridor: string;
  routeType?: string;
  approvalType?: string;
  transferHash?: string;
  receiveHash?: string;
  stepTimings: StepTimings;
  totalDuration: number;
  errorOccurred: boolean;
  errorMessage?: string;
}

export class ExecutionTracker {
  private result: ExecutionResult;
  private executionStartTime: number;
  private stepStartTime: number;
  private lastStepTime: number;

  constructor(route: Route<any, any, any>) {
    this.result = {
      source: route.intent.sourceChain,
      target: route.intent.targetChain,
      corridor: route.corridor,
      routeType: getRouteType(route),
      approvalType: getApprovalType(route),
      stepTimings: {},
      totalDuration: 0,
      errorOccurred: false,
    };

    this.executionStartTime = performance.now();
    this.stepStartTime = performance.now();
    this.lastStepTime = this.stepStartTime;

    route.progress.on("approval-sent", (e) => {
      this.markStepCompleted("approval", { transactionHash: e.transactionHash });
      console.info(`✓ Approval sent: ${e.transactionHash} (${
        formatTimeDiff(this.getResult().stepTimings.approval!)})`);
    });

    route.progress.on("message-signed", (e) => {
      this.markStepCompleted("approval", { signer: e.signer, messageSigned: e.messageSigned });
      console.info(`✓ Message signed by ${e.signer}. Deadline: ${
        e.messageSigned.message.deadline
      } (${
        formatTimeDiff(this.getResult().stepTimings.approval!)})`);
    });

    route.progress.on("transfer-sent", (e) => {
      this.markStepCompleted("transferSent", { transactionHash: e.transactionHash });
      console.info(`✓ Transfer tx included in blockchain. tx: ${
        e.transactionHash} (${formatTimeDiff(this.getResult().stepTimings.transferSent!)})`);
    });

    route.progress.on("transfer-confirmed", (e) => {
      this.markStepCompleted("transferConfirmed");
      console.info(`✓ Transfer confirmed - Circle attestation received (${
        formatTimeDiff(this.getResult().stepTimings.transferConfirmed!)})`);
    });

    route.progress.on("transfer-received", (e) => {
      this.markStepCompleted("transferReceived", { transactionHash: e.transactionHash });
      console.info(`✓ Transfer received: ${e.transactionHash} (${
        formatTimeDiff(this.getResult().stepTimings.transferReceived!)})`);
    });

    route.progress.on("error", (e) => {
      this.markExecutionFailed(e.type);
      console.info(`✗ Error: ${e.type}`);
    });
  }

  /**
   * Mark a step as completed and record timing.
   * @param stepType - The type of step that was completed
   * @param data - Optional data associated with the step (e.g., transaction hash)
   */
  markStepCompleted(
    stepType: keyof StepTimings,
    data?: { transactionHash?: string; signer?: string; messageSigned?: any },
  ) {
    const now = performance.now();

    if (stepType === "approval") {
      this.result.stepTimings.approval = now - this.stepStartTime;
    } else {
      this.result.stepTimings[stepType] = now - this.lastStepTime;
    }

    this.lastStepTime = now;

    // Handle specific data for each step type
    if (stepType === "transferSent" && data?.transactionHash) {
      this.result.transferHash = data.transactionHash;
    } else if (stepType === "transferReceived" && data?.transactionHash) {
      this.result.receiveHash = data.transactionHash;
    }
  }

  /**
   * Mark the execution as failed with an error message.
   * @param errorMessage - The error message to record
   */
  markExecutionFailed(errorMessage: string) {
    this.result.errorOccurred = true;
    this.result.errorMessage = errorMessage;
  }

  getResult(): ExecutionResult {
    const now = performance.now();
    this.result.totalDuration = now - this.executionStartTime;
    return { ...this.result };
  }
}

export function formatTimeDiff(timeMs: number): string {
  const timeStr = `+${timeMs.toFixed(2)}ms`;

  if (timeMs < 2000) {
    // Green for under 2 seconds
    return `\u001B[32m${timeStr}\u001B[0m`;
  } else if (timeMs <= 10000) {
    // Yellow for 2-10 seconds
    return `\u001B[33m${timeStr}\u001B[0m`;
  } else {
    // Red for over 10 seconds
    return `\u001B[31m${timeStr}\u001B[0m`;
  }
}

function getRouteType(r: Route<any, any, any>) {
  return r.steps.some(
    s => s.type === "gasless-transfer",
  )
    ? "gasless"
    : "normal";
}

function getApprovalType(r: Route<any, any, any>) {
  return r.requiresMessageSignature ? "permit" : "approval";
}
