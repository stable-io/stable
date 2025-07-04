import type { PropsWithChildren, ReactElement } from "react";

import { Background } from "../../elements/Background";
import { Footer } from "../../sections/Footer";
import { Header } from "../../sections/Header";

export type BridgeLayoutProps = PropsWithChildren<object>;

export const BridgeLayout = ({ children }: BridgeLayoutProps): ReactElement => (
  <div className="bridge-app main">
    <Background />
    <div className="container">
      <Header />
      <div className="main-content">{children}</div>
      <Footer />
    </div>
  </div>
);
