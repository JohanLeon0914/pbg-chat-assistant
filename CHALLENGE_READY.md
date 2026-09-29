# PBG Engineering Challenge Ready Notes

## Local app

- Dev: `npm run dev`
- Build check: `npm run build`
- Lint check: `npm run lint`
- Stack: Next.js, TypeScript, Tailwind CSS, App Router

## Google Cloud

- Active project: `f1-ml-project`
- Active account: `johanleon991@gmail.com`
- Firestore API: enabled
- Firestore databases at prep time: none
- Suggested Firestore database command only if persistence is needed:

```sh
gcloud firestore databases create --project=f1-ml-project --database='(default)' --location=nam5
```

Use another location only if the challenge requires it. The database location is not something to pick casually.

## GitHub

`gh` is not installed and no GitHub token is currently available through `git credential`.
Create the remote once a token is available:

```sh
git remote add origin https://github.com/JohanLeon0914/pbg-engineering-challenge.git
git push -u origin main
```

