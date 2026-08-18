# Remote Repository Mapping — blueforge-studio

> Proposed: 2026-04-10
> GitHub org: `blueforge-studio`
> Visibility: All private

## Mapping

| # | Local Path | Remote Name | GitHub URL | Type | Notes |
|---|-----------|-------------|------------|------|-------|
| **Core** |
| 1 | `lq-core/` | `lq-core` | `blueforge-studio/lq-core` | Monorepo | Core engine, libs, AI services |
| 2 | `lq-site/` | `lq-site` | `blueforge-studio/lq-site` | Standalone | Next.js 16 marketing site |
| 3 | `lq-operations/` | `lq-operations` | `blueforge-studio/lq-operations` | Standalone | Scaffolding, CI templates |
| 4 | `books-platform/` | `books-platform` | `blueforge-studio/books-platform` | Monorepo | 7 book apps + 2 packages |
| 5 | `lq-tools/` | `lq-tools` | `blueforge-studio/lq-tools` | Monorepo | Shared dev tooling (7 packages) |
| **Language Groups (14)** |
| 5 | `lang-quest/lq-african/` | `lq-african` | `blueforge-studio/lq-african` | App | African languages |
| 6 | `lang-quest/lq-balkan/` | `lq-balkan` | `blueforge-studio/lq-balkan` | App | Balkan languages |
| 7 | `lang-quest/lq-celtic/` | `lq-celtic` | `blueforge-studio/lq-celtic` | App | Celtic languages |
| 8 | `lang-quest/lq-east-asian/` | `lq-east-asian` | `blueforge-studio/lq-east-asian` | App | East Asian languages |
| 9 | `lang-quest/lq-english/` | `lq-english` | `blueforge-studio/lq-english` | App | English |
| 10 | `lang-quest/lq-germanic/` | `lq-germanic` | `blueforge-studio/lq-germanic` | App | Germanic languages |
| 11 | `lang-quest/lq-middle-eastern/` | `lq-middle-eastern` | `blueforge-studio/lq-middle-eastern` | App | Middle Eastern languages |
| 12 | `lang-quest/lq-nordic/` | `lq-nordic` | `blueforge-studio/lq-nordic` | App | Nordic languages |
| 13 | `lang-quest/lq-romance/` | `lq-romance` | `blueforge-studio/lq-romance` | App | Romance languages |
| 14 | `lang-quest/lq-slavic/` | `lq-slavic` | `blueforge-studio/lq-slavic` | App | Slavic languages |
| 15 | `lang-quest/lq-south-asian/` | `lq-south-asian` | `blueforge-studio/lq-south-asian` | App | South Asian languages |
| 16 | `lang-quest/lq-southeast-asian/` | `lq-southeast-asian` | `blueforge-studio/lq-southeast-asian` | App | Southeast Asian languages |
| 17 | `lang-quest/lq-uralic/` | `lq-uralic` | `blueforge-studio/lq-uralic` | App | Uralic languages |
| 18 | `lang-quest/lq-west-slavic/` | `lq-west-slavic` | `blueforge-studio/lq-west-slavic` | App | West Slavic languages |
| **School Subjects (6)** |
| 19 | `school-quest/lq-geography/` | `lq-geography` | `blueforge-studio/lq-geography` | App | Geography |
| 20 | `school-quest/lq-history/` | `lq-history` | `blueforge-studio/lq-history` | App | History |
| 21 | `school-quest/lq-math/` | `lq-math` | `blueforge-studio/lq-math` | App | Math |
| 22 | `school-quest/lq-reading/` | `lq-reading` | `blueforge-studio/lq-reading` | App | Reading |
| 23 | `school-quest/lq-science/` | `lq-science` | `blueforge-studio/lq-science` | App | Science |
| 24 | `school-quest/lq-writing/` | `lq-writing` | `blueforge-studio/lq-writing` | App | Writing |

**Total: 25 private repos**

## Creation Script (pending approval)

```bash
#!/bin/bash
# Create all repos on blueforge-studio GitHub org
# Requires: gh auth login with org admin access

REPOS=(
  lq-core lq-site lq-operations books-platform
  lq-african lq-balkan lq-celtic lq-east-asian lq-english
  lq-germanic lq-middle-eastern lq-nordic lq-romance lq-slavic
  lq-south-asian lq-southeast-asian lq-uralic lq-west-slavic
  lq-geography lq-history lq-math lq-reading lq-science lq-writing
)

for repo in "${REPOS[@]}"; do
  echo "Creating blueforge-studio/$repo..."
  gh repo create "blueforge-studio/$repo" --private --description "LearnQuest — $repo"
done
```

## Push Script (after creation)

```bash
#!/bin/bash
BASE="/Users/kmandrup/Projects/Repos/learn-quest"

# Core repos (direct children)
for repo in lq-core lq-site lq-operations books-platform; do
  cd "$BASE/$repo"
  git remote add origin "git@github.com:blueforge-studio/$repo.git" 2>/dev/null
  git push -u origin main
done

# Lang-quest repos
for repo in lq-african lq-balkan lq-celtic lq-east-asian lq-english lq-germanic lq-middle-eastern lq-nordic lq-romance lq-slavic lq-south-asian lq-southeast-asian lq-uralic lq-west-slavic; do
  cd "$BASE/lang-quest/$repo"
  git remote add origin "git@github.com:blueforge-studio/$repo.git" 2>/dev/null
  git push -u origin main
done

# School-quest repos
for repo in lq-geography lq-history lq-math lq-reading lq-science lq-writing; do
  cd "$BASE/school-quest/$repo"
  git remote add origin "git@github.com:blueforge-studio/$repo.git" 2>/dev/null
  git push -u origin main
done
```

## Naming Convention

- All repos use the local folder name directly (e.g., `lq-nordic`, not `learnquest-nordic`)
- No `learn-quest-` or `lang-quest-` prefix — keeps names short
- Consistent `lq-` prefix identifies LearnQuest repos in the org
- `books-platform` and `lq-operations` don't use `lq-` prefix since they're standalone projects with distinct identities
