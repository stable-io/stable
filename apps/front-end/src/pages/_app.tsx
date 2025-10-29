// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { AppProps } from "next/app";
import Head from "next/head";
import type { ReactElement } from "react";

import { DynamicProvider, StableProvider } from "@/providers";
import type { NextPageWithLayout } from "@/utils";
import "@/styles/globals.css";

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const App = ({ Component, pageProps }: AppPropsWithLayout): ReactElement => {
  const getLayout =
    Component.getLayout ?? ((page: ReactElement): ReactElement => page);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DynamicProvider>
        <StableProvider>
          {getLayout(<Component {...pageProps} />)}
        </StableProvider>
      </DynamicProvider>
    </>
  );
};

export default App;
