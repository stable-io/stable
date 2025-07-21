import type { Route } from "@stable-io/sdk";
import { useCallback, useEffect, useReducer } from "react";

import type { StepStatus, AvailableChains } from "@/constants";

interface UIStep {
  title: string;
  description?: string;
  status: StepStatus;
}

interface UIStepsState {
  authorization: UIStep;
  sending: UIStep;
  moving: UIStep;
  // finalizing: UIStep;
}

interface TransferState {
  uiSteps: UIStepsState;
  isCurrent: boolean;
  isActive: boolean;
  isTransferInProgress: boolean;
  timeRemaining: number;
}

const initialUISteps: UIStepsState = {
  authorization: {
    title: "Authorizing transfer",
    status: "pending",
  },
  sending: {
    title: "Sending transfer to the source chain",
    status: "pending",
  },
  moving: {
    title: "Funds are arriving on the destination chain",
    status: "pending",
  },
} as const;

const initialTransferState: TransferState = {
  uiSteps: initialUISteps,
  isCurrent: false,
  isActive: false,
  isTransferInProgress: false,
  timeRemaining: 0,
};

const STEP_ORDER = ["authorization", "sending", "moving"] as const;
type StepName = (typeof STEP_ORDER)[number];

const STEP_COMPLETE_STATES = {
  authorization: {
    title: "Authorization Complete",
    description: "You're all set. Wallet permissions confirmed.",
    status: "complete",
  },
  sending: {
    title: "Transfer Sent",
    description: "Transfer has completed on the source chain.",
    status: "complete",
  },
  moving: {
    title: "Transfer Completed",
    description: "Your assets are now available in the destination wallet.",
    status: "complete",
  },
} as const;

const setStepInProgress = (
  inProgressStep: StepName,
  state: UIStepsState,
): UIStepsState =>
  STEP_ORDER.slice(0, STEP_ORDER.indexOf(inProgressStep) + 1).reduce(
    (acc, stepName) => ({
      ...acc,
      [stepName]:
        stepName === inProgressStep
          ? {
              ...acc[stepName],
              status: "inProgress",
            }
          : STEP_COMPLETE_STATES[stepName],
    }),
    state,
  );

const setStepCompleted = (
  stepName: StepName,
  state: UIStepsState,
): UIStepsState => ({
  ...state,
  [stepName]: STEP_COMPLETE_STATES[stepName],
});

const setStepFailed = (state: UIStepsState): UIStepsState => {
  const failedStepIndex = STEP_ORDER.findIndex(
    (stepName) => state[stepName].status === "inProgress",
  );
  return failedStepIndex === -1
    ? state
    : {
        ...state,
        [STEP_ORDER[failedStepIndex]!]: {
          ...state[STEP_ORDER[failedStepIndex]!],
          title: "Something went wrong",
          description: undefined,
          status: "failed",
        },
      };
};

type TransferAction =
  | { type: "DISMISS" }
  | { type: "SET_TIME_REMAINING"; time: number }
  | { type: "RESET_TRANSFER"; estimatedDuration?: number }
  | { type: "TRANSFER_INITIATED" }
  | { type: "PERMIT_SIGNED" }
  | { type: "APPROVAL_SENT" }
  | { type: "TRANSFER_SENT" }
  | { type: "TRANSFER_CONFIRMED" }
  | { type: "HOP_RECEIVED" }
  | { type: "HOP_CONFIRMED" }
  | { type: "TRANSFER_RECEIVED" }
  | { type: "TRANSFER_COMPLETED" }
  | { type: "TRANSFER_FAILED" };

const transferReducer = (
  state: TransferState,
  action: TransferAction,
): TransferState => {
  switch (action.type) {
    case "DISMISS":
      return {
        ...state,
        isCurrent: false,
      };

    case "SET_TIME_REMAINING":
      return {
        ...state,
        timeRemaining: action.time,
      };

    case "RESET_TRANSFER":
      return {
        ...initialTransferState,
        timeRemaining: action.estimatedDuration ?? 0,
      };

    case "TRANSFER_INITIATED":
      return {
        ...state,
        isCurrent: true,
        isActive: true,
        uiSteps: setStepInProgress("authorization", state.uiSteps),
      };

    case "PERMIT_SIGNED":
    case "APPROVAL_SENT":
      return state;

    case "TRANSFER_SENT":
      return {
        ...state,
        isTransferInProgress: true,
        uiSteps: setStepInProgress("sending", state.uiSteps),
      };

    case "TRANSFER_CONFIRMED":
      return {
        ...state,
        uiSteps: setStepInProgress("moving", state.uiSteps),
      };

    case "HOP_RECEIVED":
      return state;

    case "HOP_CONFIRMED":
      return state;

    case "TRANSFER_RECEIVED":
      return {
        ...state,
        isActive: false,
        isTransferInProgress: false,
        timeRemaining: 0,
        uiSteps: setStepCompleted("moving", state.uiSteps),
      };

    case "TRANSFER_FAILED":
      return {
        ...state,
        isActive: false,
        isTransferInProgress: false,
        timeRemaining: 0,
        uiSteps: setStepFailed(state.uiSteps),
      };

    default:
      return state;
  }
};

interface UseTransferProgressReturn extends Omit<TransferState, "uiSteps"> {
  resetTransfer: () => void;
  dismiss: () => void;
  steps: readonly UIStep[];
}

export const useTransferProgress = (
  route?: Route<AvailableChains, AvailableChains>,
): UseTransferProgressReturn => {
  const [state, dispatch] = useReducer(transferReducer, initialTransferState);

  const resetTransfer = useCallback(() => {
    if (!route)
      throw new Error("resetTransfer can't be called without a route set");
    dispatch({
      type: "RESET_TRANSFER",
      estimatedDuration: route.estimatedDuration.toUnit("sec").toNumber(),
    });
  }, [route]);

  const dismiss = useCallback(() => {
    dispatch({ type: "DISMISS" });
  }, []);

  useEffect(() => {
    dispatch({
      type: "SET_TIME_REMAINING",
      time: route?.estimatedDuration.toUnit("sec").toNumber() ?? 0,
    });
  }, [route?.estimatedDuration]);

  useEffect(() => {
    if (!state.isTransferInProgress || state.timeRemaining <= 0) return;

    const interval = setInterval(() => {
      dispatch({
        type: "SET_TIME_REMAINING",
        time: Math.max(0, state.timeRemaining - 1),
      });
    }, 1000);

    return (): void => {
      clearInterval(interval);
    };
  }, [state.isTransferInProgress, state.timeRemaining]);

  useEffect(() => {
    if (!route) return;

    const handleTransferInitiated = (): void => {
      dispatch({ type: "TRANSFER_INITIATED" });
    };

    const handlePermitSigned = (): void => {
      dispatch({ type: "PERMIT_SIGNED" });
    };

    const handleApprovalSent = (): void => {
      dispatch({ type: "APPROVAL_SENT" });
    };

    const handleTransferSent = (): void => {
      dispatch({ type: "TRANSFER_SENT" });
    };

    const handleTransferConfirmed = (): void => {
      dispatch({ type: "TRANSFER_CONFIRMED" });
    };

    const handleHopReceived = (): void => {
      dispatch({ type: "HOP_RECEIVED" });
    };

    const handleHopConfirmed = (): void => {
      dispatch({ type: "HOP_CONFIRMED" });
    };

    const handleTransferReceived = (): void => {
      dispatch({ type: "TRANSFER_RECEIVED" });
    };

    const handleTransferFailed = (): void => {
      dispatch({ type: "TRANSFER_FAILED" });
    };

    route.progress.on("transfer-initiated", handleTransferInitiated);
    route.progress.on("message-signed", handlePermitSigned);
    route.progress.on("approval-sent", handleApprovalSent);
    route.progress.on("transfer-sent", handleTransferSent);
    route.progress.on("transfer-confirmed", handleTransferConfirmed);
    route.progress.on("hop-received", handleHopReceived);
    route.progress.on("hop-confirmed", handleHopConfirmed);
    route.progress.on("transfer-received", handleTransferReceived);
    route.progress.on("error", handleTransferFailed);

    return (): void => {
      route.progress.off("permit-signed", handlePermitSigned);
      route.progress.off("approval-sent", handleApprovalSent);
      route.progress.off("transfer-sent", handleTransferSent);
      route.progress.off("transfer-confirmed", handleTransferConfirmed);
      route.progress.off("hop-received", handleHopReceived);
      route.progress.off("hop-confirmed", handleHopConfirmed);
      route.progress.off("transfer-received", handleTransferReceived);
      route.progress.off("error", handleTransferFailed);
    };
  }, [route]);

  const { uiSteps, ...stateToExpose } = state;
  const steps = STEP_ORDER.map((stepName) => uiSteps[stepName]);
  return {
    ...stateToExpose,
    resetTransfer,
    dismiss,
    steps,
  };
};
