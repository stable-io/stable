import type { Route } from "@stable-io/sdk";
import { useCallback, useEffect, useReducer } from "react";

import type { StepStatus } from "@/constants";

interface UIStep {
  title: string;
  description?: string;
  status: StepStatus;
}

interface UIStepsState {
  authorization: UIStep;
  sending: UIStep;
  moving: UIStep;
  finalizing: UIStep;
}

interface TransferState {
  uiSteps: UIStepsState;
  isInProgress: boolean;
  isTransferActive: boolean;
  timeRemaining: number;
}

const initialUISteps: UIStepsState = {
  authorization: {
    title: "Authorizing transfer",
    status: "pending",
  },
  sending: {
    title: "Sending transfer to the network",
    status: "pending",
  },
  moving: {
    title: "Transfer moving through Stableit network",
    status: "pending",
  },
  finalizing: {
    title: "Finalizing transfer",
    status: "pending",
  },
} as const;

const initialTransferState: TransferState = {
  uiSteps: initialUISteps,
  isInProgress: false,
  isTransferActive: false,
  timeRemaining: 0,
};

const STEP_ORDER = [
  "authorization",
  "sending",
  "moving",
  "finalizing",
] as const;
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
    title: "Transfer ready on destination chain",
    description: "Funds are arriving on the destination chain.",
    status: "complete",
  },
  finalizing: {
    title: "Transfer complete",
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
  | { type: "CLOSE_MODAL" }
  | { type: "SET_TIME_REMAINING"; time: number }
  | { type: "RESET_TRANSFER"; estimatedDuration?: number }
  | { type: "TRANSFER_INITIATED" }
  | { type: "PERMIT_SIGNED" }
  | { type: "APPROVAL_SENT" }
  | { type: "TRANSFER_SENT" }
  | { type: "TRANSFER_CONFIRMED" }
  | { type: "HOP_REDEEMED" }
  | { type: "HOP_CONFIRMED" }
  | { type: "TRANSFER_REDEEMED" }
  | { type: "TRANSFER_COMPLETED" }
  | { type: "TRANSFER_FAILED" };

const transferReducer = (
  state: TransferState,
  action: TransferAction,
): TransferState => {
  switch (action.type) {
    case "CLOSE_MODAL":
      return {
        ...state,
        isInProgress: false,
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
        isInProgress: true,
        uiSteps: setStepInProgress("authorization", state.uiSteps),
      };

    case "PERMIT_SIGNED":
    case "APPROVAL_SENT":
      return state;

    case "TRANSFER_SENT":
      return {
        ...state,
        isTransferActive: true,
        uiSteps: setStepInProgress("sending", state.uiSteps),
      };

    case "TRANSFER_CONFIRMED":
      return {
        ...state,
        uiSteps: setStepInProgress("moving", state.uiSteps),
      };

    case "HOP_REDEEMED":
      return state;

    case "HOP_CONFIRMED":
      return {
        ...state,
        uiSteps: setStepInProgress("finalizing", state.uiSteps),
      };

    case "TRANSFER_REDEEMED":
      return {
        ...state,
        isTransferActive: false,
        timeRemaining: 0,
      };

    case "TRANSFER_COMPLETED":
      return state;

    case "TRANSFER_FAILED":
      return {
        ...state,
        isTransferActive: false,
        timeRemaining: 0,
        uiSteps: setStepFailed(state.uiSteps),
      };

    default:
      return state;
  }
};

interface UseTransferProgressReturn extends Omit<TransferState, "uiSteps"> {
  resetTransfer: () => void;
  initiateTransfer: () => void;
  completeTransfer: () => void;
  failTransfer: () => void;
  closeModal: () => void;
  steps: readonly UIStep[];
}

export const useTransferProgress = (
  route?: Route,
): UseTransferProgressReturn => {
  const [state, dispatch] = useReducer(transferReducer, initialTransferState);

  const resetTransfer = useCallback(() => {
    dispatch({
      type: "RESET_TRANSFER",
      estimatedDuration: route?.estimatedDuration,
    });
  }, [route?.estimatedDuration]);

  const initiateTransfer = useCallback(() => {
    dispatch({ type: "TRANSFER_INITIATED" });
  }, []);

  const completeTransfer = useCallback(() => {
    dispatch({ type: "TRANSFER_COMPLETED" });
  }, []);

  const failTransfer = useCallback(() => {
    dispatch({ type: "TRANSFER_FAILED" });
  }, []);

  const closeModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL" });
  }, []);

  useEffect(() => {
    dispatch({
      type: "SET_TIME_REMAINING",
      time: route?.estimatedDuration ?? 0,
    });
  }, [route?.estimatedDuration]);

  useEffect(() => {
    if (!state.isTransferActive || state.timeRemaining <= 0) return;

    const interval = setInterval(() => {
      dispatch({
        type: "SET_TIME_REMAINING",
        time: Math.max(0, state.timeRemaining - 1),
      });
    }, 1000);

    return (): void => {
      clearInterval(interval);
    };
  }, [state.isTransferActive, state.timeRemaining]);

  useEffect(() => {
    if (!route) return;

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

    const handleHopRedeemed = (): void => {
      dispatch({ type: "HOP_REDEEMED" });
    };

    const handleHopConfirmed = (): void => {
      dispatch({ type: "HOP_CONFIRMED" });
    };

    const handleTransferRedeemed = (): void => {
      dispatch({ type: "TRANSFER_REDEEMED" });
    };

    route.progress.on("permit-signed", handlePermitSigned);
    route.progress.on("approval-sent", handleApprovalSent);
    route.progress.on("transfer-sent", handleTransferSent);
    route.progress.on("transfer-confirmed", handleTransferConfirmed);
    route.progress.on("hop-redeemed", handleHopRedeemed);
    route.progress.on("hop-confirmed", handleHopConfirmed);
    route.progress.on("transfer-redeemed", handleTransferRedeemed);

    return (): void => {
      route.progress.off("permit-signed", handlePermitSigned);
      route.progress.off("approval-sent", handleApprovalSent);
      route.progress.off("transfer-sent", handleTransferSent);
      route.progress.off("transfer-confirmed", handleTransferConfirmed);
      route.progress.off("hop-redeemed", handleHopRedeemed);
      route.progress.off("hop-confirmed", handleHopConfirmed);
      route.progress.off("transfer-redeemed", handleTransferRedeemed);
    };
  }, [route]);

  const { uiSteps, ...stateToExpose } = state;
  const steps = STEP_ORDER.map((stepName) => uiSteps[stepName]);
  return {
    ...stateToExpose,
    resetTransfer,
    initiateTransfer,
    completeTransfer,
    failTransfer,
    closeModal,
    steps,
  };
};
