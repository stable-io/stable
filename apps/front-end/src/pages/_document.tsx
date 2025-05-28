import { Html, Head, Main, NextScript } from "next/document";

const Document = () => (
  <Html lang="en">
    <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <link rel="shortcut icon" href="/imgs/favicon-hi.png" />
      <link rel="icon" sizes="196x196" href="/imgs/favicon-hi.png" />
      <meta
        itemProp="name"
        content="Stable | Move USDC across networks with high speed and minimal costs"
      />
      <meta
        itemProp="description"
        content="Powered by Circle, Stable's SDK enables instant USDC transfers across networks."
      />
      <meta
        itemProp="image"
        content="https://stable-e58ff.web.app/imgs/og.jpg" /* @todo */
      />
      <meta
        property="og:title"
        content="Stable | Move USDC across networks with high speed and minimal costs"
      />
      <meta
        property="og:description"
        content="Powered by Circle, Stable's SDK enables instant USDC transfers across networks."
      />
      <meta property="og:type" content="website" />
      <meta
        property="og:image"
        content="https://stable-e58ff.web.app/imgs/og.jpg" /* @todo */
      />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="700" />
      <meta
        property="og:image:alt"
        content="Move USDC across networks with high speed and minimal costs"
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta
        name="twitter:title"
        content="Stable | Move USDC across networks with high speed and minimal costs"
      />
      <meta
        name="twitter:description"
        content="Powered by Circle, Stable's SDK enables instant USDC transfers across networks."
      />
      <meta
        name="twitter:image"
        content="https://stable-e58ff.web.app/imgs/og.jpg" /* @todo */
      />
      <meta
        name="twitter:image:src"
        content="https://stable-e58ff.web.app/imgs/og.jpg" /* @todo */
      />
    </Head>
    <body>
      <Main />
      <NextScript />
    </body>
  </Html>
);

export default Document;
