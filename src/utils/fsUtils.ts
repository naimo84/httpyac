import { fileProvider } from '../io';
import { PathLike } from '../models';
import { isString } from './stringUtils';


export async function toAbsoluteFilename(fileName: PathLike | undefined, baseName: PathLike | undefined, isFolder = false): Promise<PathLike | undefined> {
  if (fileName) {
    if (fileProvider.isAbsolute(fileName) && await fileProvider.exists(fileName)) {
      return fileName;
    }
    if (baseName) {
      let dirName: PathLike = baseName;
      if (!isFolder) {
        dirName = fileProvider.dirname(baseName) || baseName;
      }
      if (isString(fileName)) {
        const absolute = fileProvider.joinPath(dirName, fileName);
        if (await fileProvider.exists(absolute)) {
          return absolute;
        }
      }
    }
  }
  return undefined;
}

export function replaceInvalidChars(fileName: string): string {
  const result = fileName.replace(/[/\\?%*:|"<>]/gu, '_');
  return result.split('_').filter(obj => obj.length > 0).join('_');
}


export function shortenFileName(fileName: string, maxChars = 50): string {
  const result: Array<string> = [];

  let charLength = 0;
  for (const item of fileName.split('_').reverse()) {
    if (item.length + charLength < maxChars) {
      result.push(item);
      charLength += (item.length + 1);
    } else if (result.length === 0) {
      result.push(item);
    }
  }
  const joinedString = result.reverse().join('_');
  return joinedString.slice(Math.max(joinedString.length - maxChars, 0));
}


export async function findRootDirOfFile(filename: PathLike, workingDir?: PathLike, ...files: Array<string>): Promise<PathLike | undefined> {
  let file = filename;
  if (!fileProvider.isAbsolute(filename) && workingDir) {
    file = fileProvider.joinPath(workingDir, fileProvider.fsPath(filename));
  }
  return await findRootDir(fileProvider.dirname(file), ...files);
}

export async function findRootDir(currentDir: PathLike | undefined, ...files: Array<string>): Promise<PathLike | undefined> {
  if (currentDir) {
    const dirFiles = await fileProvider.readdir(currentDir);

    if (dirFiles.some(file => files.indexOf(file) >= 0)) {
      return currentDir;
    }
    for (const file of files) {
      if (dirFiles.some(obj => file.startsWith(obj))) {
        const dir = fileProvider.joinPath(currentDir, file);
        if (await fileProvider.exists(dir)) {
          return fileProvider.dirname(dir);
        }
      }
    }
    if (fileProvider.dirname(currentDir) !== currentDir) {
      return findRootDir(fileProvider.dirname(currentDir), ...files);
    }
  }
  return undefined;
}
