import axios from "axios";
import fs from "fs";
import repos from "./repos.json";
type RepoConfig = {
  user: string;
  repo: string;
};
type ReleaseFile = {
  releases: Partial<ReleaseStatistics>;
};
type ReleaseAsset = {
  name: string;
  created_at: string;
  downloads: Record<string, number>;
};
type ReleaseInfo = {
  assets: Record<string, ReleaseAsset>;
  created_at: string;
  name: string;
};
type ReleaseStatistics = Record<string, ReleaseInfo>;
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
function getRepoDataPath(repo: RepoConfig) {
  return `${getRepoFolderPath(repo)}/data.json`;
}
function getRepoRawDataPath(repo: RepoConfig) {
  return `${getRepoFolderPath(repo)}/raw`;
}
function createFolderIfNeeded(repos: RepoConfig[]) {
  repos.forEach((repo) => {
    var filepath = getRepoDataPath(repo);
    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(getRepoFolderPath(repo), { recursive: true });
      fs.writeFileSync(filepath, `{"releases":{}}`);
    }
    const rawDataFolder = getRepoRawDataPath(repo);
    if (!fs.existsSync(rawDataFolder)) {
      fs.mkdirSync(rawDataFolder, { recursive: true });
    }
  });
}
function getCurDate() {
  return new Date().toISOString().split("T")[0];
}
function formatResponse(responseList: any[]): ReleaseStatistics[] {
  const resultList: ReleaseStatistics[] = [];
  responseList.forEach((response) => {
    const result: ReleaseStatistics = {};
    response.forEach((release: any) => {
      const { id, assets, created_at, name } = release;
      result[id] = {
        created_at,
        name,
        assets: {},
      };
      let total = 0;
      const curDate = getCurDate();
      assets.forEach((asset: any) => {
        result[id].assets[asset.id] = {
          name: asset.name,
          created_at: asset.created_at,
          downloads: {} as any,
        };
        result[id].assets[asset.id].downloads = {
          [curDate]: asset.download_count,
        };
        total += asset.download_count;
      });
      const totalName = "total";
      result[id].assets[totalName] = {
        name: totalName,
        created_at: "",
        downloads: {
          [curDate]: total,
        },
      };
      resultList.push(result);
    });
  });
  return resultList;
}
function insertNewData(dataList: ReleaseStatistics[], repos: RepoConfig[]) {
  const resultList = repos.map((repo, index) => {
    const historyData: ReleaseFile = require(getRepoDataPath(repo));
    const newData = dataList[index];
    Object.entries(newData).forEach(([releaseId, releaseData]) => {
      const historyRelease = historyData.releases;
      if (!historyRelease[releaseId]) {
        historyRelease[releaseId] = releaseData;
        return;
      }
      Object.entries(releaseData.assets).forEach(([assetId, assetData]) => {
        const downloads = historyRelease[releaseId]!.assets[assetId].downloads;
        Object.entries(assetData.downloads).forEach(([curDate, count]) => {
          downloads[curDate] = count;
        });
      });
    });
    return historyData;
  });
  return resultList;
}
function writeToFile(
  dataList: any[],
  repos: RepoConfig[],
  getPath: (repo: RepoConfig) => string
) {
  repos.forEach((repo, index) => {
    const path = getPath(repo);
    const data = dataList[index];
    fs.writeFileSync(path, JSON.stringify(data));
  });
}
async function main() {
  const repos = getReposConfig();
  createFolderIfNeeded(repos);
  const responseList = await fetchReposData(repos);
  writeToFile(
    responseList,
    repos,
    (repo) => getRepoRawDataPath(repo) + "/" + getCurDate() + ".json"
  );
  const formattedData = formatResponse(responseList);
  const integratedData = insertNewData(formattedData, repos);
  writeToFile(integratedData, repos, (repo) => getRepoDataPath(repo));
  process.exit(0);
}
main();
