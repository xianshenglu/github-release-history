import axios from "axios";
import fs from "fs";
import repos from "./repos.json";
type RepoConfig = {
  user: string;
  repo: string;
};

function getReposConfig() {
  return repos.filter((repo) => repo.user === "xianshenglu");
}
async function fetchReposData(repos: RepoConfig[]) {
  const reqList = repos.map(async (repo) => {
    const url = `https://api.github.com/repos/${repo.user}/${repo.repo}/releases`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.log("get repo release failed: ", error?.message);
      return null;
    }
  });
  let resultList = await Promise.all(reqList);
  resultList = resultList.filter((ret) => ret !== null);
  const isAllFailed = resultList.length === 0;
  if (isAllFailed) {
    process.exit(1);
  }
  return resultList;
}
function getRepoFolderPath(repo: RepoConfig) {
  return `./data/${repo.user}/${repo.repo}`;
}
function createFolderIfNeeded(repos: RepoConfig[]) {
  repos.forEach((repo) => {
    var dir = getRepoFolderPath(repo);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function writeToFile(responseList: any[], repos: RepoConfig[]) {
  repos.forEach((repo, index) => {
    const path = getRepoFolderPath(repo) + "/" + Date.now() + ".json";
    const data = responseList[index];
    fs.writeFileSync(path, JSON.stringify(data));
  });
}

async function main() {
  const repos = getReposConfig();
  createFolderIfNeeded(repos);
  const responseList = await fetchReposData(repos);
  writeToFile(responseList, repos);
  process.exit(0);
}
main();
