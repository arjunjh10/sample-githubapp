import { Request, Response, NextFunction } from "express";
import { getAuthenticatedOctaKitClient } from '../auth';

export const addNewLabelToPullRequest = async (req: Request, res: Response, next: NextFunction, token: string) => {
  const ockaKit = await getAuthenticatedOctaKitClient(token);
  if (req.headers['x-github-event'] === 'pull_request') {
    const {repository, pull_request} = req.body;

     // Add here some custom logic to determine if running full-suite or not
    const resp = await ockaKit.pulls.listFiles({
      owner: repository.owner.login,
      repo: repository.name,
      pull_number: pull_request.number
    });

    const fileNames = resp.data.map(d => d.filename);
    console.log('Change files', fileNames);

    const findIndex = fileNames.findIndex(f => f.match('tests/features'));

    if (findIndex > -1) {
      const myLabel = '@e2efull'
      console.log(`Adding a new label called ${myLabel}`);
      const label = await ockaKit.issues.addLabels({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: pull_request.number,
        labels: [myLabel]
      })
    }
  }
  next();
}