# CREOVA public website (testing)

This branch contains the first public-facing CREOVA landing page and an email-auth callback landing page.

## Intended GitHub Pages URL

https://gabrieltonny16-alt.github.io/CREOVA/

## Authentication callback URL

https://gabrieltonny16-alt.github.io/CREOVA/auth/callback/

Do not add the callback URL to Supabase production redirect settings until the site is published and the app callback handling is tested.

## Publish with GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, select branch `site/creova-public` and folder `/ (root)`, then save. GitHub Pages activation is a repository setting and has not been changed by this commit.

This is a static landing page. The callback page currently provides an app-opening handoff; it does not itself verify Supabase tokens or establish an authenticated session.
