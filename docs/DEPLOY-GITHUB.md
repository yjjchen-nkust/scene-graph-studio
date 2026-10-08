# Publishing scene-graph-studio from GitHub

Frontend on GitHub Pages, backend on Render's free web service, both built from the same push.
The backend serves `fixtures/data` (6 MB), not the NAS corpus.

| Part | File | Result |
|---|---|---|
| Frontend | `.github/workflows/scene-graph-studio-pages.yml` | `https://<owner>.github.io/<repository>/` |
| Backend | `render.yaml` | `https://scene-graph-studio-api.onrender.com` |

## One-time setup (also the student exercise)

1. Gitea: Repository > Settings > Repository > Push Mirrors. URL `https://github.com/<owner>/<repository>.git`,
   username the GitHub account, password a fine-grained token with Contents read/write on that repository.
   Enable "Sync when commits are pushed".
2. GitHub: Settings > Pages > Source: GitHub Actions. (A private repository needs a paid plan for Pages.)
3. Render: New > Blueprint > pick the repository. Confirm `SGS_CORS_ORIGINS` is the Pages origin
   (scheme and host, no path, no trailing slash).
4. GitHub: Settings > Secrets and variables > Actions > Variables > `SGS_API_BASE` = the Render URL.
5. Re-run the Pages workflow (Actions > Run workflow) so the build reads the variable.

## Behaviour to expect

- The free instance sleeps after 15 minutes idle; the first lab request after that takes about a minute.
- It has no persistent disk, and no checkpoint or `torch` build: live inference is reported unavailable.
- Only the datasets in `fixtures/data` have slices; the others report `images_present: false`.
- `VITE_API_BASE` empty (the default) keeps the local `npm start` behaviour unchanged.
