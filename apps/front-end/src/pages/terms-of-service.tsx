import Head from "next/head";
import type { ReactElement } from "react";

import { BasicLayout } from "@/components";
import type { NextPageWithLayout } from "@/utils";

const TermsOfService: NextPageWithLayout = (): ReactElement => {
  return (
    <>
      <Head>
        <title>Terms of Service | Stableit</title>
      </Head>
      <div class="doc-page">
        <h1>Terms of Service</h1>
        <p>
          Welcome to Stableit. By using our platform, you agree to the following
          terms and acknowledge our privacy practices. We respect your data and
          are committed to keeping your information secure. No nonsense, just
          transparency.
        </p>
        <p></p>
      </div>
    </>
  );
};

TermsOfService.getLayout = (page: ReactElement): ReactElement => (
  <BasicLayout>{page}</BasicLayout>
);

export default TermsOfService;
