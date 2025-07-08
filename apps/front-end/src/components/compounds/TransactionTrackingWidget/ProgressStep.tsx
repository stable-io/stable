import Image from "next/image";
import type { ReactElement } from "react";

import { StepSeparator } from "./StepSeparator";

import type { StepStatus } from "@/constants";

export interface ProgressStepProps {
  title: string;
  description?: string;
  status: StepStatus;
}

export const ProgressStep = ({
  title,
  description,
  status,
}: ProgressStepProps): ReactElement | undefined =>
  status === "pending" ? undefined : (
    <>
      <StepSeparator />
      <div className="step">
        <div
          className={`icon ${status === "complete" ? "completed-step" : status === "failed" ? "failed-step" : "inprogress-step"}`}
        >
          {status === "complete" ? (
            <Image
              src="/imgs/check.svg"
              className="check-icon"
              alt="Completed"
              width={16}
              height={16}
            />
          ) : status === "failed" ? (
            <Image
              src="/imgs/warning.svg"
              className="warning-icon"
              alt="Failed"
              width={24}
              height={24}
            />
          ) : (
            <div className="spinner"></div>
          )}
        </div>
        <div className="details">
          <div className="step-title">{title}</div>
          {description && <div className="step-desc">{description}</div>}
        </div>
      </div>
    </>
  );
