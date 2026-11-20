import { t } from "../i18n/index.ts";

export const GITHUB_URL = "https://github.com/dihydrogenmonoxid-ama/Orgamorph";

export function GitHubLink() {
  return (
    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
      {t("about.github")}
    </a>
  );
}
