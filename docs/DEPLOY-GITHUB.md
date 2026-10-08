# Publishing from GitHub

Frontend on GitHub Pages, backend on Render's free web service. The backend serves `fixtures/data`
(6 MB), not the full corpus.

| Part | File | Result |
|---|---|---|
| Gate and frontend | `.github/workflows/ci-cd.yml` | `https://<owner>.github.io/<repository>/` |
| Backend | `render.yaml` | `https://scene-graph-studio-api.onrender.com` |

## One-time setup (also the student exercise)

1. Fork or create the repository on GitHub. If Gitea is the primary, add a push mirror there
   (Repository > Settings > Push Mirrors) with a fine-grained token that has Contents read/write.
2. GitHub: Settings > Pages > Source: GitHub Actions.
3. Render: New > Blueprint > pick the repository. Set `SGS_CORS_ORIGINS` to the Pages origin
   (scheme and host, no path, no trailing slash).
4. GitHub: Settings > Secrets and variables > Actions > Variables > `SGS_API_BASE` = the Render URL.
5. Re-run the workflow (Actions > ci-cd > Run workflow) so the build reads the variable.

## Behaviour to expect

- The free instance sleeps after 15 minutes idle; the first lab request after that takes about a minute.
- It has no persistent disk, and no checkpoint or `torch` build: live inference is reported unavailable.
- Only the datasets in `fixtures/data` have slices; the others report `images_present: false`.
- `VITE_API_BASE` empty (the default) keeps the local `npm start` behaviour unchanged.
