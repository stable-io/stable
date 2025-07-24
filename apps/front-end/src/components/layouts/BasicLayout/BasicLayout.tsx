import type { PropsWithChildren, ReactElement } from "react";

import { Background } from "../../elements/Background";
import { Announcement } from "../../sections/Announcement";
import { Footer } from "../../sections/Footer";
import { Header } from "../../sections/Header";

export type BasicLayoutProps = PropsWithChildren<object>;

export const BasicLayout = ({ children }: BasicLayoutProps): ReactElement => (
  <div className="basic-page main">
    <Background />
    <Announcement />
    <div className="container">
      <Header />
      {children}
      <Footer />
    </div>
  </div>
);
