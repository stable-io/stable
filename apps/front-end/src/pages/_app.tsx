import type { AppProps } from "next/app";
import Head from "next/head";
import { DynamicProvider } from "@/providers/DynamicProvider";
import { Layout } from "@/components/sections/Layout";
import "@/styles/globals.css";

const App = ({ Component, pageProps }: AppProps) => (
  <>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <DynamicProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </DynamicProvider>
  </>
);

export default App;
