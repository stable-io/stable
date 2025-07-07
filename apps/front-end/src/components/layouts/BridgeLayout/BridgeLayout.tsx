import type { PropsWithChildren, ReactElement } from "react";
import { Announcement } from "@/components/sections";
import { Background } from "../../elements/Background";
import { Footer } from "../../sections/Footer";
import { Header } from "../../sections/Header";

export type BridgeLayoutProps = PropsWithChildren<object>;

export const BridgeLayout = ({ children }: BridgeLayoutProps): ReactElement => (
  <div className="bridge-app main">
    <Background />
    <Announcement />
    <div className="container">
      <Header />
      <div className="main-content">{children}</div>
      <Footer />
    </div>
  </div>
);
