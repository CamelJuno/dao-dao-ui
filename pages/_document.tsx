import Document, { Html, Head, Main, NextScript } from 'next/document'
import { defaultTheme } from 'components/ThemeToggle'
import React from 'react'

class MyDocument extends Document {
  static async getInitialProps(ctx: any) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    const title = process.env.NEXT_PUBLIC_SITE_TITLE
    const description = process.env.NEXT_PUBLIC_SITE_DESCRIPTION
    const image = process.env.NEXT_PUBLIC_SITE_IMAGE
    const url = process.env.NEXT_PUBLIC_SITE_URL

    return (
      <Html data-theme={defaultTheme}>
        <Head>
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="msapplication-TileColor" content="#da532c" />
          <meta name="theme-color" content="#ffffff" />
          <meta name="title" content={title} key="title" />
          <meta name="description" content={description} key="description" />
          <meta property="twitter:title" content={title} key="twitter:title" />
          <meta
            property="twitter:card"
            content="summary_large_image"
            key="twitter:card"
          />
          <meta
            property="twitter:description"
            content={description}
            key="twitter:description"
          />
          <meta property="twitter:image" content={image} key="twitter:image" />
          <meta property="twitter:url" content={url} key="twitter:url" />
          <meta
            property="og:description"
            content={description}
            key="og:description"
          />
          <meta property="og:image" content={image} key="og:image" />
          <meta property="og:title" content={title} key="og:title" />
          <meta property="og:type" content="website" key="og:type" />
          <meta property="og:url" content={url} key="og:url" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument